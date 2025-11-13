import { NextRequest, NextResponse } from 'next/server';
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

    // Try to get existing user from auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    const existingAuthUser = users?.find((u: any) => u.email === decoded.email);
    
    let authUserId: string;
    
    if (existingAuthUser) {
      console.log('[SSO] Auth user already exists:', existingAuthUser.id);
      authUserId = existingAuthUser.id;
    } else {
      // Create new auth user
      console.log('[SSO] Creating new auth user for:', decoded.email);
      
      const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: decoded.email,
        password: Math.random().toString(36).slice(-16),
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          name: decoded.name || decoded.email.split('@')[0],
        },
      });

      if (signUpError) {
        console.error('[SSO] Error creating auth user:', signUpError);
        
        // If user already exists (race condition), try to find them
        if (signUpError.message?.includes('already been registered')) {
          console.log('[SSO] Auth user was created by another request, fetching...');
          const { data: { users: retryUsers } } = await supabaseAdmin.auth.admin.listUsers();
          const retryUser = retryUsers?.find((u: any) => u.email === decoded.email);
          if (retryUser) {
            authUserId = retryUser.id;
          } else {
            return NextResponse.redirect(new URL('/login?error=user_creation_failed', request.url));
          }
        } else {
          return NextResponse.redirect(new URL('/login?error=user_creation_failed', request.url));
        }
      } else {
        console.log('[SSO] Auth user created successfully:', authData.user?.id);
        authUserId = authData.user!.id;
      }
    }

    // Check if user exists in users table
    const { data: existingDbUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('openId', authUserId)
      .single();

    if (existingDbUser) {
      console.log('[SSO] Users table record already exists:', existingDbUser.id);
      
      // Update lastSignedIn
      await supabaseAdmin
        .from('users')
        .update({
          lastSignedIn: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .eq('openId', authUserId);
    } else {
      // Create new user in users table
      console.log('[SSO] Creating users table record for:', decoded.email);
      
      const { data: newDbUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          openId: authUserId,
          email: decoded.email,
          name: decoded.name || decoded.email.split('@')[0],
          role: 'user',
          loginMethod: 'sso',
          default_language: 'en-US', // Set default language for SSO users
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastSignedIn: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('[SSO] Error creating users table record:', insertError);
        
        // If record already exists (race condition), continue anyway
        if (insertError.code === '23505') { // Unique constraint violation
          console.log('[SSO] Users table record was created by another request, continuing...');
        } else {
          return NextResponse.redirect(new URL('/login?error=db_user_creation_failed', request.url));
        }
      } else {
        console.log('[SSO] Users table record created successfully:', newDbUser?.id);
      }
    }

    // Generate magic link using admin client to get session tokens
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

    // Use the admin client to verify OTP and get session
    const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      type: 'email',
      token_hash: hashedToken,
    });

    if (verifyError || !sessionData.session) {
      console.error('[SSO] Error verifying OTP:', verifyError);
      return NextResponse.redirect(new URL('/login?error=session_failed', request.url));
    }

    console.log('[SSO] Session created successfully');

    // Get Supabase config for client-side initialization
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Return HTML page that uses Supabase client to set session properly
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Signing in...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      text-align: center;
      color: white;
    }
    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top: 4px solid white;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2>Signing you in...</h2>
    <p>Please wait while we complete your authentication.</p>
  </div>
  <script>
    (async function() {
      try {
        // Initialize Supabase client with same config as the app
        const { createClient } = supabase;
        const supabaseClient = createClient(
          '${supabaseUrl}',
          '${supabaseAnonKey}',
          {
            auth: {
              flowType: 'pkce',
              autoRefreshToken: true,
              detectSessionInUrl: true,
              persistSession: true,
              storage: window.localStorage,
              storageKey: 'ikoneworld-auth',
            }
          }
        );
        
        // Set the session using Supabase's official method
        const session = ${JSON.stringify(sessionData.session)};
        
        const { data, error } = await supabaseClient.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token
        });
        
        if (error) {
          console.error('[SSO] Error setting session:', error);
          window.location.href = '/login?error=session_set_failed';
          return;
        }
        
        console.log('[SSO] Session set successfully via Supabase client');
        console.log('[SSO] User:', data.user?.email);
        
        // Redirect to the intended page
        window.location.href = '${redirectPath}';
      } catch (error) {
        console.error('[SSO] Error in SSO flow:', error);
        window.location.href = '/login?error=sso_failed';
      }
    })();
  </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    console.error('[SSO] Unexpected error:', error);
    return NextResponse.redirect(new URL('/login?error=unexpected_error', request.url));
  }
}
