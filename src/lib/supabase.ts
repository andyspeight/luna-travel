/**
 * Supabase client setup — lazy-initialized.
 *
 * Clients are created on first access, not at module import time.
 * This means missing env vars don't crash the build.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

type ClientCache = {
  admin: AnySupabase | null;
  publicClient: AnySupabase | null;
};

const cache: ClientCache = { admin: null, publicClient: null };

export function getSupabaseAdmin(): AnySupabase {
  if (!cache.admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url) throw new Error('SUPABASE_URL is not set');
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    cache.admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'luna_travel' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }
  return cache.admin;
}

export function getSupabasePublic(): AnySupabase {
  if (!cache.publicClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url) throw new Error('SUPABASE_URL is not set');
    if (!key) throw new Error('SUPABASE_ANON_KEY is not set');
    cache.publicClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'luna_travel' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }
  return cache.publicClient;
}

/**
 * Useful for API routes to verify env vars are present before doing work.
 * Returns null when healthy, or an error message string when not.
 */
export function checkSupabaseEnv(): string | null {
  if (!process.env.SUPABASE_URL)              return 'SUPABASE_URL is not set';
  if (!process.env.SUPABASE_ANON_KEY)         return 'SUPABASE_ANON_KEY is not set';
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 'SUPABASE_SERVICE_ROLE_KEY is not set';
  return null;
}
