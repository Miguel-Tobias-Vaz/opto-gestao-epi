import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Defina ${name} no arquivo .env (veja .env.example).`);
  }
  return value;
}

const url = required('SUPABASE_URL');
const anonKey = required('SUPABASE_ANON_KEY');
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');

const authConfig = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
  flowType: 'implicit' as const,
};

export const supabaseAuth: SupabaseClient = createClient(url, anonKey, {
  auth: authConfig,
});

export const supabase: SupabaseClient = createClient(url, serviceRoleKey, {
  auth: authConfig,
});
