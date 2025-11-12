import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import jwt from 'jsonwebtoken';

interface SSOLoginPageProps {
  searchParams: Promise<{ token?: string; redirect?: string }>;
}

export default async function SSOLoginPage({ searchParams }: SSOLoginPageProps) {
  // Await searchParams in Next.js 15+
  const params = await searchParams;
  
  console.log('=== SSO LOGIN PAGE ACCESSED ===');
  console.log('Search params:', params);
  console.log('Token present:', !!params.token);
  console.log('Redirect path:', params.redirect);
  
  const token = params.token;
  const redirectPath = params.redirect || '/dashboard';

  // If no token provided, redirect to login
  if (!token) {
    console.error('[SSO] No token provided');
    redirect('/login?error=missing_token');
  }

  try {
    // Verify the JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[SSO] JWT_SECRET not configured');
      redirect('/login?error=server_config');
    }

    console.log('[SSO] Verifying JWT token...');
    const decoded = jwt.verify(token, jwtSecret) as {
      email: string;
      name: string;
      portalUserId: string;
    };
    console.log('[SSO] JWT verified for email:', decoded.email);

    // Create Supabase admin client
    const cookieStore = await cookies();
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    console.log('[SSO] Checking if user exists...');
    const { data: existingUser, error: fetchError } = await adminClient.auth.admin.listUsers();
    
    if (fetchError) {
      console.error('[SSO] Error fetching users:', fetchError);
    }
    
    const userExists = existingUser?.users.find(u => u.email === decoded.email);

    let userId: string;

    if (!userExists) {
      console.log('[SSO] Creating new user...');
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: decoded.email,
        email_confirm: true,
        user_metadata: {
          name: decoded.name,
          portal_user_id: decoded.portalUserId,
        },
      });

      if (createError || !newUser.user) {
        console.error('[SSO] User creation failed:', createError);
        redirect('/login?error=user_creation_failed');
      }

      userId = newUser.user.id;
      console.log('[SSO] User created:', userId);
    } else {
      userId = userExists.id;
      console.log('[SSO] User exists:', userId);
    }

    console.log('[SSO] Generating magic link...');
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: decoded.email,
    });

    if (linkError || !linkData) {
      console.error('[SSO] Magic link generation failed:', linkError);
      redirect('/login?error=session_creation_failed');
    }

    console.log('[SSO] Magic link generated');
    
    const { properties } = linkData;
    
    if (!properties?.hashed_token) {
      console.error('[SSO] No hashed_token in response');
      redirect('/login?error=no_token');
    }

    console.log('[SSO] Creating regular Supabase client...');
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options });
              console.log('[SSO] Cookie set:', name);
            } catch (err) {
              console.error('[SSO] Cookie set error:', err);
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
              console.log('[SSO] Cookie removed:', name);
            } catch (err) {
              console.error('[SSO] Cookie remove error:', err);
            }
          },
        },
      }
    );

    console.log('[SSO] Verifying OTP...');
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      type: 'email',
      token_hash: properties.hashed_token,
    });

    if (verifyError) {
      console.error('[SSO] OTP verification failed:', verifyError);
      redirect('/login?error=session_verification_failed');
    }

    console.log('[SSO] OTP verified. Session:', !!verifyData?.session);
    console.log('[SSO] User:', verifyData?.user?.id);
    console.log('[SSO] Redirecting to:', redirectPath);
    
    redirect(redirectPath);
  } catch (error) {
    console.error('[SSO] Error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      console.error('[SSO] Invalid JWT:', error.message);
      redirect('/login?error=invalid_token');
    } else if (error instanceof jwt.TokenExpiredError) {
      console.error('[SSO] JWT expired:', error.message);
      redirect('/login?error=token_expired');
    }
    
    redirect('/login?error=sso_failed');
  }
}
