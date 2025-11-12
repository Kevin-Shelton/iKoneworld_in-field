import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import jwt from 'jsonwebtoken';

interface SSOLoginPageProps {
  searchParams: { token?: string; redirect?: string };
}

export default async function SSOLoginPage({ searchParams }: SSOLoginPageProps) {
  const token = searchParams.token;
  const redirectPath = searchParams.redirect || '/dashboard';

  // If no token provided, redirect to login
  if (!token) {
    redirect('/login?error=missing_token');
  }

  try {
    // Verify the JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not configured');
      redirect('/login?error=server_config');
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      email: string;
      name: string;
      portalUserId: string;
    };

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

    // Check if user exists in Supabase
    const { data: existingUser, error: fetchError } = await adminClient.auth.admin.listUsers();
    
    const userExists = existingUser?.users.find(u => u.email === decoded.email);

    let userId: string;

    if (!userExists) {
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
        console.error('Error creating user:', createError);
        redirect('/login?error=user_creation_failed');
      }

      userId = newUser.user.id;
    } else {
      userId = userExists.id;
    }

    // Generate a magic link to get access and refresh tokens
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: decoded.email,
    });

    if (linkError || !linkData) {
      console.error('Error generating magic link:', linkError);
      redirect('/login?error=session_creation_failed');
    }

    // Extract tokens from the generated link
    // The linkData contains properties that we can use to set the session
    const { properties } = linkData;
    
    if (!properties?.access_token || !properties?.refresh_token) {
      console.error('No tokens in magic link response');
      redirect('/login?error=no_tokens');
    }

    // Create a regular Supabase client (not admin) to set the session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    // Set the session using the tokens
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: properties.access_token,
      refresh_token: properties.refresh_token,
    });

    if (sessionError) {
      console.error('Error setting session:', sessionError);
      redirect('/login?error=session_set_failed');
    }

    // Redirect to the intended page
    redirect(redirectPath);
  } catch (error) {
    console.error('SSO login error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      redirect('/login?error=invalid_token');
    } else if (error instanceof jwt.TokenExpiredError) {
      redirect('/login?error=token_expired');
    }
    
    redirect('/login?error=sso_failed');
  }
}
