import { NextRequest, NextResponse } from 'next/server';
import { getFileSizeCategory, estimateProcessingTime } from '@/lib/skeletonDocumentProcessor';

/**
 * POST /api/documents/upload-smart
 * 
 * Smart routing upload handler
 * 
 * This endpoint analyzes the uploaded file and routes it to the appropriate
 * translation method:
 * - Small/Medium DOCX files (< 5MB) → Skeleton method (sync)
 * - Large files or non-DOCX → Chunking method (async)
 * 
 * Returns routing decision and processing instructions
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceLanguage = formData.get('sourceLanguage') as string;
    const targetLanguage = formData.get('targetLanguage') as string;
    const userId = formData.get('userId') as string;
    const enterpriseId = formData.get('enterpriseId') as string | null;
    
    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    if (!sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        { error: 'Source and target languages are required' },
        { status: 400 }
      );
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Analyze file
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const sizeCategory = getFileSizeCategory(file.size);
    const estimatedTime = estimateProcessingTime(file.size);
    
    // Routing decision
    const useSkeletonMethod = 
      fileExtension === 'docx' && 
      (sizeCategory === 'small' || sizeCategory === 'medium');
    
    console.log('[Upload Smart] File analysis:', {
      name: file.name,
      size: file.size,
      sizeCategory,
      extension: fileExtension,
      method: useSkeletonMethod ? 'skeleton' : 'chunking',
      estimatedTime: `${estimatedTime}s`,
    });
    
    if (useSkeletonMethod) {
      // Route to skeleton method (synchronous)
      console.log('[Upload Smart] Routing to skeleton method');
      
      // Forward to skeleton translation endpoint
      const skeletonFormData = new FormData();
      skeletonFormData.append('file', file);
      skeletonFormData.append('sourceLanguage', sourceLanguage);
      skeletonFormData.append('targetLanguage', targetLanguage);
      
      const skeletonResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/documents/translate-sync`,
        {
          method: 'POST',
          body: skeletonFormData,
        }
      );
      
      if (!skeletonResponse.ok) {
        const error = await skeletonResponse.json();
        throw new Error(error.message || 'Skeleton translation failed');
      }
      
      // Get the translated file buffer
      const translatedBuffer = await skeletonResponse.arrayBuffer();
      const filename = skeletonResponse.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'translated.docx';
      const processingTime = skeletonResponse.headers.get('X-Processing-Time');
      
      console.log(`[Upload Smart] Skeleton translation completed in ${processingTime}ms`);
      
      // Return the file directly for download
      return new NextResponse(Buffer.from(translatedBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Translation-Method': 'skeleton',
          'X-Processing-Time': processingTime || '0',
        },
      });
      
    } else {
      // Route to chunking method (asynchronous)
      console.log('[Upload Smart] Routing to chunking method');
      
      // Forward to existing upload endpoint
      const chunkingFormData = new FormData();
      chunkingFormData.append('file', file);
      chunkingFormData.append('userId', userId);
      if (enterpriseId) {
        chunkingFormData.append('enterpriseId', enterpriseId);
      }
      chunkingFormData.append('sourceLanguage', sourceLanguage);
      chunkingFormData.append('targetLanguage', targetLanguage);
      
      const chunkingResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/documents/upload`,
        {
          method: 'POST',
          body: chunkingFormData,
        }
      );
      
      if (!chunkingResponse.ok) {
        const error = await chunkingResponse.json();
        throw new Error(error.message || 'Chunking upload failed');
      }
      
      const result = await chunkingResponse.json();
      
      console.log('[Upload Smart] Chunking upload initiated:', result.conversationId);
      
      // Return async processing response
      return NextResponse.json({
        success: true,
        method: 'chunking',
        conversationId: result.conversationId,
        message: 'Document uploaded. Translation will begin shortly.',
        estimatedTime: `${estimatedTime} seconds`,
        status: 'queued',
      });
    }
    
  } catch (error) {
    console.error('[Upload Smart] Error:', error);
    
    return NextResponse.json(
      {
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
