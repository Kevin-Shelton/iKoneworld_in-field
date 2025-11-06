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

    // Try to fetch with default_language, but handle if column doesn't exist
    let data, error;
    try {
      const result = await supabaseAdmin
        .from('users')
        .select('id, openId, name, email, role, default_language, createdAt, lastSignedIn')
        .eq('openId', userId)
        .single();
      data = result.data;
      error = result.error;
    } catch (e: any) {
      // If default_language column doesn't exist, fetch without it
      if (e.message?.includes('default_language') || e.code === '42703') {
        const result = await supabaseAdmin
          .from('users')
          .select('id, openId, name, email, role, createdAt, lastSignedIn')
          .eq('openId', userId)
          .single();
        data = result.data;
        error = result.error;
        // Add default_language as null if column doesn't exist
        if (data) {
          (data as any).default_language = null;
        }
      } else {
        throw e;
      }
    }

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

    const updateData: any = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (defaultLanguage !== undefined) {
      updateData.default_language = defaultLanguage;
    }

    let data, error;
    try {
      const result = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('openId', userId)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } catch (e: any) {
      // If default_language column doesn't exist, update without it
      if ((e.message?.includes('default_language') || e.code === '42703') && defaultLanguage !== undefined) {
        // Remove default_language from update if column doesn't exist
        const { default_language, ...updateWithoutLang } = updateData;
        const result = await supabaseAdmin
          .from('users')
          .update(updateWithoutLang)
          .eq('openId', userId)
          .select()
          .single();
        data = result.data;
        error = result.error;
        console.warn('default_language column does not exist in database. Please run migration.');
      } else {
        throw e;
      }
    }

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
