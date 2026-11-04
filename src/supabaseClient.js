import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 'https://ycgygaskqntjjvopxymm.supabase.co';

// Paste your publishable key here as a direct fallback
const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pg_xXM7jjaAjdn3oEdpo7A_PBRploxn';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);