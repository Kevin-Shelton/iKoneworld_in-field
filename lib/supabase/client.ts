import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// During build time, create a dummy client that will be replaced at runtime
const createSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a proxy that throws only if actually used
    return new Proxy({} as any, {
      get() {
        throw new Error('Supabase client not initialized - missing environment variables');
      }
    });
  }
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      // Cookie sharing across demo-portal.ikoneworld.net, demo-infield.ikoneworld.net, demo-chat.ikoneworld.net
      storageKey: 'ikoneworld-auth',
    }
  });
};

export const supabase = createSupabaseClient();
