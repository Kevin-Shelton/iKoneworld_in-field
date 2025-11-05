import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Update user theme preference
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, theme } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!theme || !['light', 'dark'].includes(theme)) {
      return NextResponse.json(
        { error: 'Valid theme (light or dark) is required' },
        { status: 400 }
      );
    }

    // Update user theme preference
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        theme,
        updatedAt: new Date().toISOString(),
      })
      .eq('openId', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating theme:', error);
      return NextResponse.json(
        { error: 'Failed to update theme preference' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      theme: data.theme,
    });
  } catch (error) {
    console.error('Theme API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
