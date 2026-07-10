import { describe, expect, it } from 'vitest';

import { evaluateForm, INPUT_TYPES } from './formLogic';
import type { FormBlock, FormSchema } from './portal';

/**
 * Parity contract for the client branching / jump / calc engine. These fixtures
 * mirror the PHP FormLogicEvaluatorTest 1:1 — the two engines MUST agree, since
 * the server re-validates on submit and any drift silently drops answers.
 */

const block = (id: string, key: string, over: Partial<FormBlock> = {}): FormBlock => ({
  id,
  key,
  type: 'text',
  label: key,
  required: false,
  options: [],
  placeholder: null,
  hidden: false,
  min: null,
  max: null,
  rows: [],
  ...over,
});

const schema = (over: Partial<FormSchema>): FormSchema => ({
  version: 2,
  pages: [],
  logic: [],
  calc: [],
  ...over,
});

describe('evaluateForm — branching', () => {
  it('show rule hides the target until its condition matches', () => {
    const s = schema({
      pages: [{ id: 'p1', title: null, blocks: [block('ba', 'has_site', { type: 'select' }), block('bx', 'site_url', { type: 'url' })] }],
      logic: [{ if: { all: [{ field: 'has_site', op: 'eq', value: 'yes' }] }, then: { action: 'show', target: 'bx' } }],
    });
    expect(evaluateForm(s, { has_site: 'no' }).activeKeys).not.toContain('site_url');
    expect(evaluateForm(s, { has_site: 'yes' }).activeKeys).toContain('site_url');
  });

  it('hide rule is shown by default and hides when matched', () => {
    const s = schema({
      pages: [{ id: 'p1', title: null, blocks: [block('ba', 'kind', { type: 'select' }), block('bx', 'detail')] }],
      logic: [{ if: { all: [{ field: 'kind', op: 'eq', value: 'simple' }] }, then: { action: 'hide', target: 'bx' } }],
    });
    expect(evaluateForm(s, {}).activeKeys).toContain('detail');
    expect(evaluateForm(s, { kind: 'simple' }).activeKeys).not.toContain('detail');
  });

  it('jump skips the intervening page', () => {
    const s = schema({
      pages: [
        { id: 'p1', title: null, blocks: [block('b1', 'type', { type: 'select' })] },
        { id: 'p2', title: null, blocks: [block('b2', 'mid')] },
        { id: 'p3', title: null, blocks: [block('b3', 'end')] },
      ],
      logic: [{ if: { all: [{ field: 'type', op: 'eq', value: 'fast' }] }, then: { action: 'jump', from: 'p1', target: 'p3' } }],
    });
    expect(evaluateForm(s, { type: 'slow' }).pageOrder).toEqual(['p1', 'p2', 'p3']);
    expect(evaluateForm(s, { type: 'fast' }).pageOrder).toEqual(['p1', 'p3']);
    expect(evaluateForm(s, { type: 'fast' }).activeKeys).not.toContain('mid');
  });
});

describe('evaluateForm — calc', () => {
  it('evaluates and chains AST rules', () => {
    const s = schema({
      pages: [{ id: 'p1', title: null, blocks: [block('b1', 'a', { type: 'number' }), block('b2', 'b', { type: 'number' })] }],
      calc: [
        { key: 'sum', ast: { op: '+', args: [{ field: 'a' }, { field: 'b' }] } },
        { key: 'doubled', ast: { op: '*', args: [{ field: 'sum' }, { const: 2 }] } },
      ],
    });
    const { calc } = evaluateForm(s, { a: 3, b: 4 });
    expect(calc.sum).toBe(7);
    expect(calc.doubled).toBe(14);
  });

  it('yields 0 on division by zero', () => {
    const s = schema({
      pages: [{ id: 'p1', title: null, blocks: [block('b1', 'x', { type: 'number' })] }],
      calc: [{ key: 'r', ast: { op: '/', args: [{ field: 'x' }, { const: 0 }] } }],
    });
    expect(evaluateForm(s, { x: 10 }).calc.r).toBe(0);
  });

  it('a calc value is usable in a condition', () => {
    const s = schema({
      pages: [{ id: 'p1', title: null, blocks: [block('b1', 'qty', { type: 'number' }), block('bx', 'bulk_note')] }],
      calc: [{ key: 'total', ast: { op: '*', args: [{ field: 'qty' }, { const: 100 }] } }],
      logic: [{ if: { all: [{ field: 'total', op: 'gte', value: 1000 }] }, then: { action: 'show', target: 'bx' } }],
    });
    expect(evaluateForm(s, { qty: 5 }).activeKeys).not.toContain('bulk_note');
    expect(evaluateForm(s, { qty: 10 }).activeKeys).toContain('bulk_note');
  });
});

describe('INPUT_TYPES — canonical contract (portal M3)', () => {
  // The renderer imports this exact set, so any type it treats as an input must
  // also count toward progress/validation AND be one the server recognizes.
  it('is exactly the backend FormSchemaNormalizer::INPUT_TYPES set', () => {
    expect([...INPUT_TYPES].sort()).toEqual(
      [
        'boolean', 'date', 'email', 'file', 'long_text', 'matrix', 'multi_select',
        'number', 'rating', 'scale', 'select', 'text', 'url',
      ].sort(),
    );
  });

  it('excludes presentation-only aliases the server would drop', () => {
    for (const alias of ['radio', 'checkbox', 'textarea', 'tags']) {
      expect(INPUT_TYPES.has(alias)).toBe(false);
    }
  });

  it('a non-canonical block type never enters activeKeys', () => {
    const s = schema({
      pages: [{ id: 'p1', title: null, blocks: [block('b1', 'pick', { type: 'radio' }), block('b2', 'note', { type: 'long_text' })] }],
    });
    const active = evaluateForm(s, {}).activeKeys;
    expect(active).not.toContain('pick'); // radio is not a server-collected input
    expect(active).toContain('note');
  });
});
