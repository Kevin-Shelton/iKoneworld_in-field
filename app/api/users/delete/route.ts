import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[User Delete API] Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export async function POST(req: NextRequest) {
  try {
    // Verify API key
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = process.env.CHAT_API_KEY || process.env.JWT_SECRET;

    if (!apiKey || apiKey !== expectedKey) {
      console.error('[User Delete API] Unauthorized: Invalid or missing API key');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { userId, email } = body;

    // Validate input - require either userId or email
    if (!userId && !email) {
      return NextResponse.json(
        { error: 'User ID or email is required' },
        { status: 400 }
      );
    }

    console.log('[User Delete API] Deleting user:', { userId, email });

    // Find the user first to get their details
    let query = supabase.from('app_users').select('*');
    
    if (userId) {
      query = query.eq('id', userId);
    } else if (email) {
      query = query.eq('email', email);
    }

    const { data: users, error: fetchError } = await query.limit(1);

    if (fetchError) {
      console.error('[User Delete API] Error fetching user:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      console.warn('[User Delete API] User not found:', { userId, email });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = users[0];
    console.log('[User Delete API] Found user to delete:', {
      id: user.id,
      email: user.email,
      name: user.name
    });

    // Delete the user from chat database
    const { error: deleteError } = await supabase
      .from('app_users')
      .delete()
      .eq('id', user.id);

    if (deleteError) {
      console.error('[User Delete API] Error deleting user:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete user from chat database' },
        { status: 500 }
      );
    }

    console.log('[User Delete API] User deleted successfully:', {
      id: user.id,
      email: user.email
    });

    return NextResponse.json({
      success: true,
      message: `User ${user.email} deleted successfully from chat database`,
      deletedUser: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });

  } catch (error) {
    console.error('[User Delete API] Error in delete user endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
