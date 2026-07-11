import axios from 'axios';

import { API_BASE } from '@/lib/api';

/**
 * Anonymous client for the public newsletter unsubscribe endpoints
 * (`/v1/newsletter/unsubscribe/*`). Bare axios — no Bearer, no refresh — the
 * signed token in the path is the only credential (like the booking client).
 */
const anon = axios.create({ baseURL: API_BASE });

export const publicNewsletter = {
  info: (token: string) =>
    anon
      .get<{ newsletterTitle: string; unsubscribed: boolean }>(`/newsletter/unsubscribe/${token}`)
      .then((r) => r.data),

  unsubscribe: (token: string) =>
    anon
      .post<{ unsubscribed: boolean; newsletterTitle: string }>(`/newsletter/unsubscribe/${token}`)
      .then((r) => r.data),
};
