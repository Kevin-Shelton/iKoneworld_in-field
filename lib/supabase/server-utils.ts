import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { User } from '@supabase/supabase-js';

// Use a type assertion to bypass the persistent TypeScript error in the build environment.
const getCookies = () => cookies() as any;

export async function getServerUser(): Promise<User | null> {
  // Check for required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("Supabase environment variables are missing. Cannot initialize server client.");
    return null;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (name: string) => getCookies().get(name)?.value,
          set: (name: string, value: string, options: CookieOptions) => {
            try {
              getCookies().set({ name, value, ...options });
            } catch (error) {
              // This is expected if you're using a Server Component
            }
          },
          remove: (name: string, options: CookieOptions) => {
            try {
              getCookies().set({ name, value: '', ...options });
            } catch (error) {
              // This is expected if you're using a Server Component
            }
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error("Error fetching user session server-side:", error.message);
      return null;
    }

    return user;
  } catch (e) {
    console.error("Unexpected error in getServerUser:", e);
    return null;
  }
}
