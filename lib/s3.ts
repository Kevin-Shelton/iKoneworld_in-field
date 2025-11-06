import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'ikoneworld-documents';

/**
 * Upload a document to S3
 */
export async function uploadDocumentToS3({
  fileBuffer,
  fileName,
  contentType,
  enterpriseId,
  userId,
  conversationId,
  isTranslated = false,
}: {
  fileBuffer: Buffer;
  fileName: string;
  contentType: string;
  enterpriseId: string;
  userId: number;
  conversationId: number;
  isTranslated?: boolean;
}): Promise<string> {
  const folder = isTranslated ? 'translated' : 'originals';
  const key = `documents/${enterpriseId}/${userId}/${folder}/${conversationId}_${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Return the S3 URL
  return `s3://${BUCKET_NAME}/${key}`;
}

/**
 * Get a signed URL for downloading a document
 */
export async function getDocumentDownloadUrl(s3Url: string, expiresIn: number = 86400): Promise<string> {
  // Parse S3 URL: s3://bucket/key
  const match = s3Url.match(/^s3:\/\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid S3 URL format');
  }

  const [, bucket, key] = match;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  // Generate signed URL that expires in 24 hours (default)
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return signedUrl;
}

/**
 * Download a document from S3
 */
export async function downloadDocumentFromS3(s3Url: string): Promise<Buffer> {
  // Parse S3 URL
  const match = s3Url.match(/^s3:\/\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid S3 URL format');
  }

  const [, bucket, key] = match;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await s3Client.send(command);
  
  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  if (response.Body) {
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
  }
  
  return Buffer.concat(chunks);
}

/**
 * Delete a document from S3
 */
export async function deleteDocumentFromS3(s3Url: string): Promise<void> {
  // Parse S3 URL
  const match = s3Url.match(/^s3:\/\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid S3 URL format');
  }

  const [, bucket, key] = match;

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Calculate total storage used by a user or enterprise
 */
export async function calculateStorageUsed(conversations: any[]): Promise<number> {
  let totalBytes = 0;
  
  for (const conv of conversations) {
    if (conv.metadata?.document_translation?.file_size_bytes) {
      totalBytes += conv.metadata.document_translation.file_size_bytes;
    }
  }
  
  return totalBytes;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
