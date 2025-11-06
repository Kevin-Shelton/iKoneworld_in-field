import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET - Fetch all drafts for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 }
      );
    }

    const { data: drafts, error } = await supabaseAdmin
      .from('email_drafts')
      .select('*')
      .eq('user_email', userEmail)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ drafts: drafts || [] });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500 }
    );
  }
}

// POST - Create or update a draft
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, userEmail, subject, content, recipients, senderLanguage } = body;

    if (!userEmail || !content) {
      return NextResponse.json(
        { error: 'User email and content are required' },
        { status: 400 }
      );
    }

    if (id) {
      // Update existing draft
      const { data: draft, error } = await supabaseAdmin
        .from('email_drafts')
        .update({
          subject,
          content,
          recipients,
          sender_language: senderLanguage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_email', userEmail)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ draft });
    } else {
      // Create new draft
      const { data: draft, error } = await supabaseAdmin
        .from('email_drafts')
        .insert({
          user_email: userEmail,
          subject,
          content,
          recipients,
          sender_language: senderLanguage,
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ draft });
    }
  } catch (error) {
    console.error('Error saving draft:', error);
    return NextResponse.json(
      { error: 'Failed to save draft' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a draft
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userEmail = searchParams.get('userEmail');

    if (!id || !userEmail) {
      return NextResponse.json(
        { error: 'Draft ID and user email are required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('email_drafts')
      .delete()
      .eq('id', id)
      .eq('user_email', userEmail);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting draft:', error);
    return NextResponse.json(
      { error: 'Failed to delete draft' },
      { status: 500 }
    );
  }
}
