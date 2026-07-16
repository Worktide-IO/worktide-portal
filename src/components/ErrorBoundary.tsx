import { AlertTriangle, MessageSquarePlus, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import i18n from '@/i18n';
import { openFeedback } from '@/components/feedback/FeedbackWidget';

/**
 * Catches render-time exceptions from the portal page area so one broken page
 * doesn't white out the whole portal (the portal had no boundary before). The
 * fallback offers a retry, a reload, and a "report this" button that opens the
 * feedback reporter prefilled with the caught error — the reporter is mounted
 * as a sibling in PortalLayout, so it stays usable even here.
 */
type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error === null) {
      return this.props.children;
    }
    const t = i18n.t.bind(i18n);
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="max-w-md space-y-4 rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto size-10 text-red-500" />
          <h2 className="text-lg font-semibold">{t('feedback.crash_title')}</h2>
          <p className="text-sm text-slate-600">{t('feedback.crash_body')}</p>
          <pre className="overflow-x-auto rounded border border-red-200 bg-white p-2 text-left text-xs text-red-600">
            {this.state.error.message}
          </pre>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="size-3.5" /> {t('feedback.crash_retry')}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {t('feedback.crash_reload')}
            </button>
            <button
              type="button"
              onClick={() =>
                openFeedback({
                  category: 'bug',
                  title: `${t('feedback.crash_title')}: ${this.state.error?.message ?? ''}`.slice(0, 120),
                  description: t('feedback.crash_report_desc'),
                })
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)] px-3 py-1.5 text-sm font-medium text-white"
            >
              <MessageSquarePlus className="size-3.5" /> {t('feedback.crash_report')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
