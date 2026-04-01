// src/services/supabaseClient.js
// Supabase JS client for QWICKY cloud sync.
// Uses VITE_ prefixed env vars (public anon key — safe for browser).
// Falls back to disabled mode if env vars are missing.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_QWICKY_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_QWICKY_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.info(
    '[Supabase] Cloud sync disabled — add VITE_QWICKY_SUPABASE_URL and VITE_QWICKY_SUPABASE_ANON_KEY to .env to enable.'
  );
}

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseEnabled = !!supabase;
