import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Sync authenticated user from Supabase Auth to users table
 * This ensures every authenticated user has a record in the database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, name } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('openId', userId)
      .single();

    if (existingUser) {
      // User already exists, return their database ID
      return NextResponse.json({
        success: true,
        userId: existingUser.id,
        message: 'User already exists',
      });
    }

    // Create new user in database
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        openId: userId,
        email: email || null,
        name: name || null,
        role: 'user', // Default role
        loginMethod: 'email',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSignedIn: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating user in database:', insertError);
      return NextResponse.json(
        { error: 'Failed to create user record', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      userId: newUser.id,
      message: 'User created successfully',
    });
  } catch (error) {
    console.error('User sync API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
