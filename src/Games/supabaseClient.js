import { createClient } from '@supabase/supabase-js';

// ══════════════════════════════════════════════════════════
//  FILL IN YOUR SUPABASE CREDENTIALS BELOW
//  1. Go to https://supabase.com → your project → Settings → API
//  2. Copy the "Project URL" and "anon / public" key
// ══════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://bqbgfobkwvhebluqrjuo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iKBpQEJ0fms49iJARILQiQ_Kq5HKpaQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
