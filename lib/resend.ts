import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Email configuration
export const EMAIL_CONFIG = {
  // The "from" address must be verified in your Resend account
  // Format: "Name <email@yourdomain.com>"
  from: process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com',
  
  // Reply-to address for inbound emails
  replyTo: process.env.RESEND_REPLY_TO_EMAIL,
};

/**
 * Send a translated email to a recipient
 */
export async function sendTranslatedEmail({
  to,
  toName,
  subject,
  content,
  senderEmail,
  senderName,
}: {
  to: string;
  toName?: string;
  subject: string;
  content: string;
  senderEmail: string;
  senderName?: string;
}) {
  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: [to],
      subject: subject,
      text: content,
      html: formatEmailHTML(content, senderName || senderEmail),
      replyTo: 'email@ikoneworld.net', // Route all replies through translation system
      headers: {
        'X-Sender-Email': senderEmail,
        'X-Sender-Name': senderName || '',
      },
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error('Error sending email:', err);
    throw err;
  }
}

/**
 * Format email content as HTML
 */
function formatEmailHTML(content: string, senderName: string): string {
  // Convert line breaks to <br> tags
  const formattedContent = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('<br><br>');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .email-container {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 30px;
    }
    .email-content {
      margin: 20px 0;
      font-size: 16px;
    }
    .email-footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
    }
    .sender-info {
      margin-bottom: 20px;
      font-weight: 600;
      color: #1f2937;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="sender-info">From: ${senderName}</div>
    <div class="email-content">
      ${formattedContent}
    </div>
    <div class="email-footer">
      <p><small>This email was automatically translated by iKoneworld Translation Service.</small></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send document translation completion email
 */
export async function sendDocumentCompletionEmail({
  to,
  toName,
  documentName,
  downloadUrl,
  sourceLanguage,
  targetLanguage,
}: {
  to: string;
  toName?: string;
  documentName: string;
  downloadUrl: string;
  sourceLanguage: string;
  targetLanguage: string;
}) {
  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: [to],
      subject: `Document Translation Complete: ${documentName}`,
      html: formatDocumentCompletionHTML({
        documentName,
        downloadUrl,
        sourceLanguage,
        targetLanguage,
        recipientName: toName,
      }),
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error('Error sending document completion email:', err);
    throw err;
  }
}

/**
 * Format document completion email as HTML
 */
function formatDocumentCompletionHTML({
  documentName,
  downloadUrl,
  sourceLanguage,
  targetLanguage,
  recipientName,
}: {
  documentName: string;
  downloadUrl: string;
  sourceLanguage: string;
  targetLanguage: string;
  recipientName?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .email-container {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 30px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #1f2937;
      margin: 0 0 10px;
      font-size: 24px;
    }
    .status-badge {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
    }
    .document-info {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      font-weight: 600;
      color: #6b7280;
    }
    .info-value {
      color: #1f2937;
    }
    .download-button {
      display: inline-block;
      background: #2563eb;
      color: white;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .download-button:hover {
      background: #1d4ed8;
    }
    .button-container {
      text-align: center;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
      text-align: center;
    }
    .note {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px;
      margin: 20px 0;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>🎉 Translation Complete!</h1>
      <span class="status-badge">Ready to Download</span>
    </div>
    
    ${recipientName ? `<p>Hi ${recipientName},</p>` : '<p>Hello,</p>'}
    
    <p>Your document translation has been completed successfully and is ready for download.</p>
    
    <div class="document-info">
      <div class="info-row">
        <span class="info-label">Document:</span>
        <span class="info-value">${documentName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Translated from:</span>
        <span class="info-value">${sourceLanguage}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Translated to:</span>
        <span class="info-value">${targetLanguage}</span>
      </div>
    </div>
    
    <div class="button-container">
      <a href="${downloadUrl}" class="download-button">Download Translated Document</a>
    </div>
    
    <div class="note">
      <strong>Note:</strong> This download link will expire in 24 hours for security purposes.
    </div>
    
    <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
    
    <div class="footer">
      <p><small>This email was sent by iKoneworld Document Translation Service.</small></p>
      <p><small>© ${new Date().getFullYear()} iKoneworld. All rights reserved.</small></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
