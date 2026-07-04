import type { PortalTicket } from '@/lib/portal';

// Colour by urgency; low/normal stay muted so the list doesn't shout.
const CLASSES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-amber-100 text-amber-800',
  normal: 'bg-slate-100 text-slate-600',
  low: 'bg-slate-100 text-slate-500',
};

export function PriorityBadge({ ticket }: { ticket: Pick<PortalTicket, 'priority' | 'priorityLabel'> }) {
  const cls = CLASSES[ticket.priority] ?? CLASSES.normal;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{ticket.priorityLabel}</span>
  );
}
