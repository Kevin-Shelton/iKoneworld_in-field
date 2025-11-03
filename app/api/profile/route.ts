import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { supabase } from '@/lib/supabase/client';

/**
 * Get user profile
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, openId, name, email, role, default_language, createdAt, lastSignedIn')
      .eq('openId', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Update user profile
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, defaultLanguage } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) {
      updateData.name = name;
    }

    if (defaultLanguage !== undefined) {
      updateData.default_language = defaultLanguage;
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('openId', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      profile: data,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Profile update API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
