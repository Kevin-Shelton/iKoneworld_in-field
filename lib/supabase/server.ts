import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// During build time, create a dummy client that will be replaced at runtime
const createSupabaseAdmin = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    // Return a proxy that throws only if actually used
    return new Proxy({} as any, {
      get() {
        throw new Error('Supabase client not initialized - missing environment variables');
      }
    });
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// Server-side client with service role key (bypasses RLS)
export const supabaseAdmin = createSupabaseAdmin();
