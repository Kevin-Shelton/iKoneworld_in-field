import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const conversationId = formData.get('conversationId') as string;
    const enterpriseId = formData.get('enterpriseId') as string;
    const speaker = formData.get('speaker') as string;
    const timestamp = formData.get('timestamp') as string;

    if (!audioFile || !conversationId || !enterpriseId || !speaker) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExtension = audioFile.name.split('.').pop() || 'webm';
    const fileName = `${speaker}_${timestamp || Date.now()}.${fileExtension}`;
    const filePath = `${enterpriseId}/${conversationId}/${fileName}`;

    // Convert File to ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('audio-recordings')
      .upload(filePath, buffer, {
        contentType: audioFile.type || 'audio/webm',
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return NextResponse.json(
        { error: 'Failed to upload audio', details: error.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('audio-recordings')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      audioUrl: urlData.publicUrl,
      filePath,
      fileName,
    });
  } catch (error) {
    console.error('Audio upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
