import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface SSOLoginPageProps {
  searchParams: Promise<{ token?: string; redirect?: string }>;
}

interface JWTPayload {
  email: string;
  name?: string;
  exp?: number;
}

export default async function SSOLoginPage({ searchParams }: SSOLoginPageProps) {
  const params = await searchParams;
  const token = params.token;
  const redirectPath = params.redirect || '/dashboard';

  console.log('[SSO] SSO login page accessed');
  console.log('[SSO] Token present:', !!token);
  console.log('[SSO] Redirect path:', redirectPath);

  // If no token provided, redirect to login
  if (!token) {
    console.error('[SSO] No token provided');
    redirect('/login?error=missing_token');
  }

  try {
    // Verify JWT token
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('[SSO] JWT_SECRET not configured');
      redirect('/login?error=server_config');
    }

    // Decode and verify the JWT
    const jwt = require('jsonwebtoken');
    let decoded: JWTPayload;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      console.log('[SSO] JWT verified successfully for email:', decoded.email);
    } catch (error) {
      console.error('[SSO] JWT verification failed:', error);
      redirect('/login?error=invalid_token');
    }

    // Check if user exists using admin client
    const { data: existingUser, error: getUserError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', decoded.email)
      .single();

    if (getUserError && getUserError.code !== 'PGRST116') {
      console.error('[SSO] Error checking user:', getUserError);
    }

    // Create user if doesn't exist
    if (!existingUser) {
      console.log('[SSO] Creating new user for:', decoded.email);
      
      const { data: authData, error: signUpError } = await supabaseAdmin.auth.signUp({
        email: decoded.email,
        password: Math.random().toString(36).slice(-16),
        options: {
          data: {
            name: decoded.name || decoded.email.split('@')[0],
          },
        },
      });

      if (signUpError) {
        console.error('[SSO] Error creating user:', signUpError);
        redirect('/login?error=user_creation_failed');
      }

      console.log('[SSO] User created successfully:', authData.user?.id);
    } else {
      console.log('[SSO] User already exists:', existingUser.id);
    }

    // Generate magic link using admin client
    const { data: adminAuthData, error: adminError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: decoded.email,
    });

    if (adminError || !adminAuthData) {
      console.error('[SSO] Error generating magic link:', adminError);
      redirect('/login?error=auth_failed');
    }

    console.log('[SSO] Magic link generated successfully');

    const hashedToken = adminAuthData.properties?.hashed_token;
    
    if (!hashedToken) {
      console.error('[SSO] No hashed token in magic link response');
      redirect('/login?error=auth_failed');
    }

    // Create a server client with cookie support for setting the session
    const cookieStore = await cookies();
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
              console.error('[SSO] Error setting cookie:', error);
            }
          },
          remove: (name: string, options: CookieOptions) => {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              console.error('[SSO] Error removing cookie:', error);
            }
          },
        },
      }
    );

    // Verify the OTP to establish the session with cookies
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: 'email',
      token_hash: hashedToken,
    });

    if (verifyError) {
      console.error('[SSO] Error verifying OTP:', verifyError);
      redirect('/login?error=session_failed');
    }

    console.log('[SSO] Session established successfully with cookies');
    console.log('[SSO] Redirecting to:', redirectPath);

    // Redirect to the intended page
    redirect(redirectPath);

  } catch (error) {
    console.error('[SSO] Unexpected error:', error);
    redirect('/login?error=unexpected_error');
  }
}
