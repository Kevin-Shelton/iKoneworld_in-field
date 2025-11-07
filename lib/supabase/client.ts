import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// During build time, create a dummy client that will be replaced at runtime
const createSupabaseClient = () => {
  // Check if we're in a build environment without real credentials
  const isBuildTime = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (isBuildTime && typeof window === 'undefined') {
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
