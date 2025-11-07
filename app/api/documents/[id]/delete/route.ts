import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * DELETE /api/documents/[id]/delete
 * 
 * Delete a document translation and its associated files
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = parseInt(params.id);

    if (isNaN(conversationId)) {
      return NextResponse.json(
        { error: 'Invalid conversation ID' },
        { status: 400 }
      );
    }

    console.log(`[Delete Document] Starting deletion for conversation ${conversationId}`);

    // 1. Get conversation details to find file paths
    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select('audio_url, metadata')
      .eq('id', conversationId)
      .single();

    if (fetchError) {
      console.error('[Delete Document] Error fetching conversation:', fetchError);
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // 2. Delete files from storage
    const filesToDelete: string[] = [];

    // Add translated file path
    if (conversation.audio_url) {
      filesToDelete.push(conversation.audio_url);
    }

    // Add original file path from metadata
    if (conversation.metadata?.document_translation?.original_storage_path) {
      filesToDelete.push(conversation.metadata.document_translation.original_storage_path);
    }

    // Delete files from Supabase storage
    if (filesToDelete.length > 0) {
      console.log(`[Delete Document] Deleting ${filesToDelete.length} files from storage`);
      
      const { error: storageError } = await supabase
        .storage
        .from('documents')
        .remove(filesToDelete);

      if (storageError) {
        console.error('[Delete Document] Error deleting files:', storageError);
        // Continue with database deletion even if storage deletion fails
      } else {
        console.log('[Delete Document] Files deleted successfully');
      }
    }

    // 3. Delete conversation messages (chunks)
    const { error: messagesError } = await supabase
      .from('conversation_messages')
      .delete()
      .eq('conversationId', conversationId);

    if (messagesError) {
      console.error('[Delete Document] Error deleting messages:', messagesError);
      // Continue with conversation deletion
    }

    // 4. Delete conversation record
    const { error: deleteError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (deleteError) {
      console.error('[Delete Document] Error deleting conversation:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete conversation' },
        { status: 500 }
      );
    }

    console.log(`[Delete Document] Successfully deleted conversation ${conversationId}`);

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });

  } catch (error) {
    console.error('[Delete Document] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
