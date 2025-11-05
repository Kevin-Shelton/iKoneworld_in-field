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
      replyTo: senderEmail, // Allow recipient to reply directly to sender
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
