import axios from 'axios';

import { API_BASE } from '@/lib/api';
import type { TranslationsMap } from '@/lib/localize';

/**
 * Anonymous client for the public booking endpoints (`/v1/book/*`). Uses a bare
 * axios instance — NOT the shared `api` — so it never attaches a Bearer token
 * and a 401 can't bounce an anonymous visitor to /login. The slug / cancel-token
 * in the path is the only credential.
 */
const anon = axios.create({ baseURL: API_BASE });

export type BookingMeetingType = {
  slug: string;
  title: string;
  description: string | null;
  translations?: TranslationsMap | null;
  durationMinutes: number;
  locationType: string; // video | phone | in_person
  timezone: string;
  hostName: string | null;
};

export type BookingSlots = {
  slots: string[]; // ISO-8601 UTC instants
  durationMinutes: number;
  timezone: string;
};

export type BookingInput = {
  start: string;
  name: string;
  email: string;
  notes?: string;
  timezone?: string;
  _hp?: string; // honeypot — always empty for real visitors
};

export const publicBooking = {
  type: (slug: string) => anon.get<BookingMeetingType>(`/book/${slug}`).then((r) => r.data),

  slots: (slug: string, from: string, to: string, tz?: string) =>
    anon
      .get<BookingSlots>(`/book/${slug}/slots`, { params: { from, to, ...(tz ? { tz } : {}) } })
      .then((r) => r.data),

  book: (slug: string, input: BookingInput) =>
    anon
      .post<{ success: boolean; cancelToken: string; start: string }>(`/book/${slug}`, input)
      .then((r) => r.data),

  cancelInfo: (token: string) =>
    anon
      .get<{ title: string; start: string; timezone: string; cancelled: boolean }>(`/book/cancel/${token}`)
      .then((r) => r.data),

  cancel: (token: string) =>
    anon.post<{ success: boolean; cancelled: boolean }>(`/book/cancel/${token}`).then((r) => r.data),

  rescheduleInfo: (token: string) =>
    anon
      .get<{ slug: string; title: string; start: string; timezone: string; durationMinutes: number; cancelled: boolean }>(
        `/book/reschedule/${token}`,
      )
      .then((r) => r.data),

  reschedule: (token: string, start: string) =>
    anon
      .post<{ success: boolean; cancelToken: string; start: string }>(`/book/reschedule/${token}`, { start })
      .then((r) => r.data),
};
