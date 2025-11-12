import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface JWTPayload {
  email: string;
  name?: string;
  exp?: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const redirectPath = searchParams.get('redirect') || '/dashboard';

  console.log('[SSO] SSO login route accessed');
  console.log('[SSO] Token present:', !!token);
  console.log('[SSO] Redirect path:', redirectPath);

  // If no token provided, redirect to login
  if (!token) {
    console.error('[SSO] No token provided');
    return NextResponse.redirect(new URL('/login?error=missing_token', request.url));
  }

  try {
    // Verify JWT token
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('[SSO] JWT_SECRET not configured');
      return NextResponse.redirect(new URL('/login?error=server_config', request.url));
    }

    // Decode and verify the JWT
    const jwt = require('jsonwebtoken');
    let decoded: JWTPayload;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      console.log('[SSO] JWT verified successfully for email:', decoded.email);
    } catch (error) {
      console.error('[SSO] JWT verification failed:', error);
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
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
        return NextResponse.redirect(new URL('/login?error=user_creation_failed', request.url));
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
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }

    console.log('[SSO] Magic link generated successfully');

    const hashedToken = adminAuthData.properties?.hashed_token;
    
    if (!hashedToken) {
      console.error('[SSO] No hashed token in magic link response');
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }

    // Create a server client with cookie support for setting the session
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => {
            const cookie = cookieStore.get(name);
            console.log('[SSO] Getting cookie:', name, '=', cookie?.value ? 'present' : 'missing');
            return cookie?.value;
          },
          set: (name: string, value: string, options: CookieOptions) => {
            try {
              console.log('[SSO] Setting cookie:', name, 'with options:', JSON.stringify(options));
              cookieStore.set({ 
                name, 
                value, 
                ...options,
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'lax'
              });
            } catch (error) {
              console.error('[SSO] Error setting cookie:', error);
            }
          },
          remove: (name: string, options: CookieOptions) => {
            try {
              console.log('[SSO] Removing cookie:', name);
              cookieStore.set({ name, value: '', ...options, maxAge: 0 });
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
      return NextResponse.redirect(new URL('/login?error=session_failed', request.url));
    }

    console.log('[SSO] Session established successfully with cookies');
    console.log('[SSO] Redirecting to:', redirectPath);

    // Redirect to the intended page
    return NextResponse.redirect(new URL(redirectPath, request.url));

  } catch (error) {
    console.error('[SSO] Unexpected error:', error);
    return NextResponse.redirect(new URL('/login?error=unexpected_error', request.url));
  }
}
