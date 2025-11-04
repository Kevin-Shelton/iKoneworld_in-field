import { NextRequest, NextResponse } from 'next/server';
import { 
  getEnterpriseSettings, 
  updateEnterpriseSettings,
  isUserAdmin 
} from '@/lib/db/enterprise-settings';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const enterpriseId = searchParams.get('enterpriseId');
    const userId = searchParams.get('userId');

    if (!enterpriseId) {
      return NextResponse.json(
        { error: 'Enterprise ID is required' },
        { status: 400 }
      );
    }

    // Get enterprise settings
    const settings = await getEnterpriseSettings(enterpriseId);
    
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching enterprise settings:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      enterpriseId, 
      userId,
      enable_audio_recording,
      enable_message_audio,
      enable_transcripts,
      save_transcripts_to_db,
      audio_access_roles,
      transcript_access_roles,
      audio_retention_days,
      transcript_retention_days
    } = body;

    if (!enterpriseId || !userId) {
      return NextResponse.json(
        { error: 'Enterprise ID and User ID are required' },
        { status: 400 }
      );
    }

    // Check if user is an admin
    const isAdmin = await isUserAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Only admins can update enterprise settings' },
        { status: 403 }
      );
    }

    // Update settings
    const settings = await updateEnterpriseSettings(enterpriseId, {
      enable_audio_recording,
      enable_message_audio,
      enable_transcripts,
      save_transcripts_to_db,
      audio_access_roles,
      transcript_access_roles,
      audio_retention_days,
      transcript_retention_days,
      updated_by: userId
    });

    return NextResponse.json({ 
      success: true, 
      settings,
      message: 'Enterprise settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating enterprise settings:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
