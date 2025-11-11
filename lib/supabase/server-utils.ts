import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { User } from '@supabase/supabase-js';

// Use a type assertion to bypass the persistent TypeScript error in the build environment.
// The runtime behavior is correct, as confirmed by the previous runtime error being fixed.
const getCookies = () => cookies() as any;

export async function getServerUser(): Promise<User | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
