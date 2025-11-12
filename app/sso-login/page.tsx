import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import jwt from 'jsonwebtoken';

interface SSOLoginPageProps {
  searchParams: Promise<{ token?: string; redirect?: string }>;
}

export default async function SSOLoginPage({ searchParams }: SSOLoginPageProps) {
  console.log('[SSO Login] Starting SSO login process');
  
  // Await searchParams in Next.js 15+
  const params = await searchParams;
  console.log('[SSO Login] Search params:', params);
  
  const token = params.token;
  const redirectPath = params.redirect || '/dashboard';

  // If no token provided, redirect to login
  if (!token) {
    console.error('[SSO Login] No token provided in query params');
    redirect('/login?error=missing_token');
  }

  try {
    // Verify the JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[SSO Login] JWT_SECRET is not configured');
      redirect('/login?error=server_config');
    }

    console.log('[SSO Login] Verifying JWT token...');
    const decoded = jwt.verify(token, jwtSecret) as {
      email: string;
      name: string;
      portalUserId: string;
    };
    console.log('[SSO Login] JWT verified successfully for email:', decoded.email);

    // Create Supabase admin client for user management
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

    console.log('[SSO Login] Checking if user exists in Supabase...');
    // Check if user exists in Supabase
    const { data: existingUser, error: fetchError } = await adminClient.auth.admin.listUsers();
    
    if (fetchError) {
      console.error('[SSO Login] Error fetching users:', fetchError);
    }
    
    const userExists = existingUser?.users.find(u => u.email === decoded.email);

    let userId: string;

    if (!userExists) {
      console.log('[SSO Login] User does not exist, creating new user...');
      // Create new user in Supabase
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: decoded.email,
        email_confirm: true,
        user_metadata: {
          name: decoded.name,
          portal_user_id: decoded.portalUserId,
        },
      });

      if (createError || !newUser.user) {
        console.error('[SSO Login] Error creating user:', createError);
        redirect('/login?error=user_creation_failed');
      }

      userId = newUser.user.id;
      console.log('[SSO Login] User created successfully with ID:', userId);
    } else {
      userId = userExists.id;
      console.log('[SSO Login] User already exists with ID:', userId);
    }

    console.log('[SSO Login] Generating magic link...');
    // Generate a magic link to get the hashed token
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: decoded.email,
    });

    if (linkError || !linkData) {
      console.error('[SSO Login] Error generating magic link:', linkError);
      redirect('/login?error=session_creation_failed');
    }

    console.log('[SSO Login] Magic link generated successfully');
    
    // Extract hashed_token from the generated link properties
    const { properties } = linkData;
    
    if (!properties?.hashed_token) {
      console.error('[SSO Login] No hashed_token in magic link response. Properties:', properties);
      redirect('/login?error=no_token');
    }

    console.log('[SSO Login] Hashed token extracted, creating regular client...');
    
    // Create a regular Supabase client (not admin) to verify OTP and set the session
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
              console.log('[SSO Login] Cookie set:', name);
            } catch (err) {
              console.error('[SSO Login] Error setting cookie:', name, err);
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
              console.log('[SSO Login] Cookie removed:', name);
            } catch (err) {
              console.error('[SSO Login] Error removing cookie:', name, err);
            }
          },
        },
      }
    );

    console.log('[SSO Login] Verifying OTP with hashed token...');
    // Verify the OTP using the hashed token to establish the session
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      type: 'email',
      token_hash: properties.hashed_token,
    });

    if (verifyError) {
      console.error('[SSO Login] Error verifying OTP:', verifyError);
      redirect('/login?error=session_verification_failed');
    }

    console.log('[SSO Login] OTP verified successfully. Session data:', verifyData?.session ? 'Present' : 'Missing');
    console.log('[SSO Login] User data:', verifyData?.user ? `ID: ${verifyData.user.id}` : 'Missing');
    
    // Redirect to the intended page
    console.log('[SSO Login] Redirecting to:', redirectPath);
    redirect(redirectPath);
  } catch (error) {
    console.error('[SSO Login] SSO login error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      console.error('[SSO Login] JWT verification failed:', error.message);
      redirect('/login?error=invalid_token');
    } else if (error instanceof jwt.TokenExpiredError) {
      console.error('[SSO Login] JWT token expired:', error.message);
      redirect('/login?error=token_expired');
    }
    
    console.error('[SSO Login] Unknown error type:', error);
    redirect('/login?error=sso_failed');
  }
}
