import { portalApi, type FeedbackSubmitInput } from '@/lib/portal';

/**
 * Minimal resilient-submit queue for portal feedback. The portal has no general
 * offline-queue infrastructure (unlike the staff SPA), so this is a tiny,
 * feedback-only localStorage queue: a report filed while the backend is
 * unreachable is held here and replayed on the next app load and whenever the
 * browser comes back online.
 */

const STORAGE_KEY = 'wtp.feedback-queue';
const MAX = 20;

type QueuedFeedback = { id: string; input: FeedbackSubmitInput };

function read(): QueuedFeedback[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: QueuedFeedback[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX)));
  } catch {
    /* quota / disabled */
  }
}

export function queueFeedback(input: FeedbackSubmitInput): void {
  const items = read();
  items.push({ id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, input });
  write(items);
}

let draining = false;

/** Replay queued reports; drops each one once accepted. Safe to call anytime. */
export async function drainFeedbackQueue(): Promise<void> {
  if (draining || typeof navigator !== 'undefined' && !navigator.onLine) return;
  draining = true;
  try {
    for (const item of read()) {
      try {
        await portalApi.submitFeedback(item.input);
        write(read().filter((q) => q.id !== item.id));
      } catch {
        // Still unreachable — stop and retry on the next trigger.
        break;
      }
    }
  } finally {
    draining = false;
  }
}

export function installFeedbackQueueDrainers(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => void drainFeedbackQueue());
  void drainFeedbackQueue();
}
