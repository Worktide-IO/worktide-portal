// Client-side mirror of the PHP App\Service\Form\FormLogicEvaluator.
//
// The server is always authoritative — it re-evaluates the same rules on submit
// and drops anything the logic hid. This runs only for live UX (show/hide,
// page jumps, live calc totals). The rule semantics MUST match the PHP version
// 1:1; the shared fixtures in FormLogicEvaluatorTest are the contract.
//
// Rule language (deliberately small):
//   conditions read the merged view (answers ∪ calc); op ∈
//     eq|neq|contains|gt|gte|lt|lte|in|empty|not_empty, grouped by all/any.
//   visibility: a target with ≥1 `show` rule defaults hidden (visible iff any
//     show matches); a target with only `hide` rules defaults visible (hidden
//     iff any hide matches); no rule ⇒ visible. `hidden:true` ⇒ prefill field,
//     never user-visible.
//   jump: first matching jump anchored on the current page (then.from === page)
//     sends flow to its target page.
//   calc: structured AST (+ - * /) over field refs / constants; ÷0 ⇒ 0.

import type { CalcNode, CalcRule, FormSchema, LogicCondition, LogicRule } from './portal';

// The single source of truth for "which block types collect an answer" — the
// renderer imports this too, so progress/validation and rendering can't drift.
// Mirrors the backend `FormSchemaNormalizer::INPUT_TYPES` 1:1 (the server
// re-validates against the same set, and formLogic mirrors the PHP evaluator);
// any presentation-only widget must resolve to one of these, never add a new one.
export const INPUT_TYPES = new Set([
  'text', 'long_text', 'number', 'boolean', 'select', 'email', 'url', 'date',
  'multi_select', 'rating', 'scale', 'matrix', 'file',
]);

export type Answers = Record<string, unknown>;

export type Evaluation = {
  calc: Record<string, number>;
  /** merged answers ∪ calc, for condition lookups by callers */
  merged: Answers;
  /** ordered list of reachable page ids (jumps applied) */
  pageOrder: string[];
  visiblePages: Record<string, boolean>;
  visibleBlocks: Record<string, boolean>;
  /** answer keys of active (visible, reachable, non-hidden) input blocks */
  activeKeys: string[];
};

export function evaluateForm(schema: FormSchema, answers: Answers): Evaluation {
  const calc = computeCalc(schema.calc ?? [], answers);
  const merged: Answers = { ...answers, ...calc };

  const logic = schema.logic ?? [];
  const visiblePages: Record<string, boolean> = {};
  const visibleBlocks: Record<string, boolean> = {};

  for (const page of schema.pages) {
    visiblePages[page.id] = isVisible(page.id, logic, merged);
    for (const block of page.blocks) {
      visibleBlocks[block.id] = block.hidden !== true && isVisible(block.id, logic, merged);
    }
  }

  const pageOrder = walkPages(schema, merged, visiblePages);
  const inOrder = new Set(pageOrder);

  const activeKeys: string[] = [];
  for (const page of schema.pages) {
    if (!inOrder.has(page.id) || visiblePages[page.id] === false) continue;
    for (const block of page.blocks) {
      if (!block.key || !INPUT_TYPES.has(block.type)) continue;
      if (block.hidden === true) continue; // prefill field, set server-side
      if (visibleBlocks[block.id] !== false) activeKeys.push(block.key);
    }
  }

  return { calc, merged, pageOrder, visiblePages, visibleBlocks, activeKeys: [...new Set(activeKeys)] };
}

function isVisible(targetId: string, logic: LogicRule[], merged: Answers): boolean {
  let hasShow = false;
  let showMatched = false;
  let hideMatched = false;

  for (const rule of logic) {
    if ((rule.then?.target ?? '') !== targetId) continue;
    const matches = matchesCondition(rule.if, merged);
    if (rule.then.action === 'show') {
      hasShow = true;
      showMatched = showMatched || matches;
    } else if (rule.then.action === 'hide') {
      hideMatched = hideMatched || matches;
    }
  }

  if (hasShow) return showMatched;
  return !hideMatched;
}

function walkPages(schema: FormSchema, merged: Answers, visiblePages: Record<string, boolean>): string[] {
  const ids = schema.pages.map((p) => p.id);
  if (ids.length === 0) return [];
  const indexOf = new Map(ids.map((id, i) => [id, i]));
  const logic = schema.logic ?? [];

  const order: string[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (i < ids.length) {
    const pageId = ids[i];
    if (seen.has(pageId)) break; // cycle guard
    seen.add(pageId);

    if (visiblePages[pageId] !== false) order.push(pageId);

    const jumpTarget = jumpTargetFor(pageId, logic, merged);
    const targetIdx = jumpTarget != null ? indexOf.get(jumpTarget) : undefined;
    if (targetIdx !== undefined && targetIdx > i) {
      i = targetIdx;
      continue;
    }
    i += 1;
  }
  return order;
}

function jumpTargetFor(pageId: string, logic: LogicRule[], merged: Answers): string | null {
  for (const rule of logic) {
    if (rule.then?.action !== 'jump') continue;
    if ((rule.then.from ?? '') !== pageId) continue;
    if (matchesCondition(rule.if, merged)) return rule.then.target ?? '';
  }
  return null;
}

function matchesCondition(condition: LogicCondition | undefined, merged: Answers): boolean {
  if (!condition || typeof condition !== 'object') return true;
  if (Array.isArray(condition.all)) return condition.all.every((a) => matchesAtom(a, merged));
  if (Array.isArray(condition.any)) return condition.any.some((a) => matchesAtom(a, merged));
  if (condition.field !== undefined) return matchesAtom(condition, merged);
  return true;
}

function matchesAtom(atom: { field?: string; op?: string; value?: unknown }, merged: Answers): boolean {
  if (!atom || atom.field === undefined) return false;
  const op = atom.op ?? 'eq';
  const expected = atom.value ?? null;
  const actual = merged[atom.field] ?? null;

  switch (op) {
    case 'eq': return looseEquals(actual, expected);
    case 'neq': return !looseEquals(actual, expected);
    case 'empty': return isEmpty(actual);
    case 'not_empty': return !isEmpty(actual);
    case 'contains': return contains(actual, expected);
    case 'in': return Array.isArray(expected) && inList(actual, expected);
    case 'gt': return toNumber(actual) > toNumber(expected);
    case 'gte': return toNumber(actual) >= toNumber(expected);
    case 'lt': return toNumber(actual) < toNumber(expected);
    case 'lte': return toNumber(actual) <= toNumber(expected);
    default: return false;
  }
}

function looseEquals(a: unknown, b: unknown): boolean {
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b);
  if (isNumeric(a) && isNumeric(b)) return toNumber(a) === toNumber(b);
  return String(a) === String(b);
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === '' || v === false) return true;
  return Array.isArray(v) && v.length === 0;
}

function contains(haystack: unknown, needle: unknown): boolean {
  if (Array.isArray(haystack)) return inList(needle, haystack);
  return needle != null && String(haystack).includes(String(needle));
}

function inList(value: unknown, list: unknown[]): boolean {
  return list.some((item) => looseEquals(value, item));
}

function computeCalc(calc: CalcRule[], answers: Answers): Record<string, number> {
  const out: Record<string, number> = {};
  const scope: Answers = { ...answers };
  for (const rule of calc) {
    if (!rule.key) continue;
    const value = evalAst(rule.ast, scope);
    out[rule.key] = value;
    scope[rule.key] = value; // later rules may reference earlier ones
  }
  return out;
}

function evalAst(node: CalcNode | undefined | null, scope: Answers): number {
  if (!node || typeof node !== 'object') return 0;
  if (Object.prototype.hasOwnProperty.call(node, 'const')) {
    return isNumeric(node.const) ? toNumber(node.const) : 0;
  }
  if (Object.prototype.hasOwnProperty.call(node, 'field')) {
    return toNumber(scope[String(node.field)] ?? 0);
  }
  const args = Array.isArray(node.args) ? node.args : [];
  const values = args.map((a) => evalAst(a, scope));
  if (values.length === 0) return 0;

  let acc = values[0];
  for (let k = 1; k < values.length; k += 1) {
    const v = values[k];
    switch (node.op) {
      case '+': acc += v; break;
      case '-': acc -= v; break;
      case '*': acc *= v; break;
      case '/': acc = v === 0 ? 0 : acc / v; break;
      default: break;
    }
  }
  return acc;
}

function isNumeric(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string' && v.trim() !== '') return Number.isFinite(Number(v));
  return false;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (isNumeric(v)) return Number(v);
  return 0;
}
