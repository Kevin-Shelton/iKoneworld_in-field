import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { User } from '@supabase/supabase-js';

export async function getServerUser(): Promise<User | null> {
  const cookieStore: any = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This is expected if you're using a Server Component with
            // middleware that modifies the response headers.
            // Do nothing here.
          }
        },
        remove: (name: string, options: CookieOptions) => {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // The `remove` method was called from a Server Component.
            // This is expected if you're using a Server Component with
            // middleware that modifies the response headers.
            // Do nothing here.
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
