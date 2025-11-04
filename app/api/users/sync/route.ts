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
      .select('*')
      .eq('openId', userId)
      .single();

    if (existingUser) {
      // User already exists, update their email and lastSignedIn
      // DO NOT update name here - it should only be updated via profile page
      const updateData: any = {
        lastSignedIn: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      if (email) {
        updateData.email = email;
      }
      // Name is intentionally not updated for existing users
      
      const { data: updatedUser } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('openId', userId)
        .select('*')
        .single();
      
      return NextResponse.json({
        success: true,
        user: updatedUser || existingUser,
        userId: (updatedUser || existingUser)?.id,
        userName: (updatedUser || existingUser)?.name,
        message: 'User synced successfully',
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
      .select('*')
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
      user: newUser,
      userId: newUser?.id,
      userName: newUser?.name,
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
