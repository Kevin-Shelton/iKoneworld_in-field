import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Helper to check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('openId', userId)
    .single();
  
  return !error && data?.role === 'admin';
}

export async function GET(request: NextRequest) {
  try {
    // Get current user from session
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // List all users from Supabase Auth
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      console.error('Error listing users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get user details from our users table
    const { data: userDetails } = await supabaseAdmin
      .from('users')
      .select('*');

    // Merge auth users with our user details
    const enrichedUsers = users.map((authUser: any) => {
      const details = userDetails?.find((u: any) => u.openId === authUser.id);
      return {
        id: authUser.id,
        email: authUser.email,
        name: details?.name || authUser.user_metadata?.name,
        role: details?.role || 'user',
        createdAt: authUser.created_at,
        lastSignedIn: authUser.last_sign_in_at,
        disabled: (authUser as any).banned_at !== null,
        mustResetPassword: authUser.user_metadata?.must_reset_password === true,
      };
    });

    return NextResponse.json({ users: enrichedUsers });
  } catch (error) {
    console.error('Admin users API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const { email, password, name, role } = body;
        
        if (!email || !password) {
          return NextResponse.json(
            { error: 'Email and password are required' },
            { status: 400 }
          );
        }

        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name,
            must_reset_password: true, // Force password reset on first login
          },
        });

        if (authError) {
          console.error('Error creating auth user:', authError);
          return NextResponse.json(
            { error: authError.message },
            { status: 400 }
          );
        }

        // Create user in our users table
        const { error: dbError } = await supabaseAdmin
          .from('users')
          .insert({
            openId: authData.user.id,
            email,
            name,
            role: role || 'user',
            loginMethod: 'email',
          });

        if (dbError) {
          console.error('Error creating user in database:', dbError);
          // Rollback: delete auth user
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          return NextResponse.json(
            { error: 'Failed to create user record' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          user: {
            id: authData.user.id,
            email,
            name,
            role: role || 'user',
          },
        });
      }

      case 'disable': {
        const { userId } = body;
        
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required' },
            { status: 400 }
          );
        }

        // Ban user in Supabase Auth
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: '876000h', // 100 years (effectively permanent)
        });

        if (error) {
          console.error('Error disabling user:', error);
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      }

      case 'enable': {
        const { userId } = body;
        
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required' },
            { status: 400 }
          );
        }

        // Unban user in Supabase Auth
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: 'none',
        });

        if (error) {
          console.error('Error enabling user:', error);
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      }

      case 'resetPassword': {
        const { userId, newPassword } = body;
        
        if (!userId || !newPassword) {
          return NextResponse.json(
            { error: 'User ID and new password are required' },
            { status: 400 }
          );
        }

        // Update user password and force reset on next login
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: newPassword,
          user_metadata: {
            must_reset_password: true,
          },
        });

        if (error) {
          console.error('Error resetting password:', error);
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Admin users API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
