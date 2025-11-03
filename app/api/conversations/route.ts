import { NextRequest, NextResponse } from 'next/server';
import { createConversation, saveMessage, endConversation } from '@/lib/db/conversations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const { userId, enterpriseId, storeId, departmentId, userLanguage, guestLanguage } = body;
      
      const conversation = await createConversation({
        userId,
        enterpriseId,
        storeId,
        departmentId,
        userLanguage,
        guestLanguage,
      });

      return NextResponse.json({ success: true, conversation });
    }

    if (action === 'saveMessage') {
      const {
        conversationId,
        enterpriseId,
        userId,
        speaker,
        originalText,
        translatedText,
        sourceLanguage,
        targetLanguage,
        audioUrl,
        audioDurationSeconds,
        confidenceScore,
      } = body;

      const message = await saveMessage({
        conversationId,
        enterpriseId,
        userId,
        speaker,
        originalText,
        translatedText,
        sourceLanguage,
        targetLanguage,
        audioUrl,
        audioDurationSeconds,
        confidenceScore,
      });

      return NextResponse.json({ success: true, message });
    }

    if (action === 'end') {
      const { conversationId } = body;
      
      const conversation = await endConversation(conversationId);

      return NextResponse.json({ success: true, conversation });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in conversations API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
