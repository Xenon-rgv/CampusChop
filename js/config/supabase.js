// CampusChop - Supabase Client Configuration
import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from Vite environment or runtime storage fallback
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const storageUrl = typeof window !== 'undefined' ? localStorage.getItem('CAMPUSCHOP_SUPABASE_URL') : null;
const storageAnonKey = typeof window !== 'undefined' ? localStorage.getItem('CAMPUSCHOP_SUPABASE_ANON_KEY') : null;

export const SUPABASE_URL = (storageUrl && storageUrl.trim() !== '') ? storageUrl.trim() : (envUrl || '');
export const SUPABASE_ANON_KEY = (storageAnonKey && storageAnonKey.trim() !== '') ? storageAnonKey.trim() : (envAnonKey || '');

export const isSupabaseConfigured = () => {
  return (
    Boolean(SUPABASE_URL) &&
    Boolean(SUPABASE_ANON_KEY) &&
    !SUPABASE_URL.includes('your-project-id') &&
    !SUPABASE_ANON_KEY.includes('your-anon-key')
  );
};

export const getSupabaseConfig = () => ({
  url: SUPABASE_URL,
  isConfigured: isSupabaseConfigured(),
  isUsingRuntimeOverride: Boolean(storageUrl),
});

export const saveSupabaseRuntimeConfig = (url, key) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('CAMPUSCHOP_SUPABASE_URL', url.trim());
    localStorage.setItem('CAMPUSCHOP_SUPABASE_ANON_KEY', key.trim());
    window.location.reload();
  }
};

export const clearSupabaseRuntimeConfig = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('CAMPUSCHOP_SUPABASE_URL');
    localStorage.removeItem('CAMPUSCHOP_SUPABASE_ANON_KEY');
    window.location.reload();
  }
};

// Fallback dummy client if credentials are not configured yet, so UI does not crash
const defaultDummyUrl = 'https://placeholder.supabase.co';
const defaultDummyKey = 'placeholder-key';

export const supabase = createClient(
  isSupabaseConfigured() ? SUPABASE_URL : defaultDummyUrl,
  isSupabaseConfigured() ? SUPABASE_ANON_KEY : defaultDummyKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
