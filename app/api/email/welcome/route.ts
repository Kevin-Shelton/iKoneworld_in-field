import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface WelcomeEmailRequest {
  email: string;
  name?: string;
  portalUrl?: string;
  language?: string;
  resetToken?: string;
  isResend?: boolean;
}

/**
 * Send welcome email to newly created portal users
 * 
 * POST /api/email/welcome
 * 
 * Headers:
 *   x-api-key: Internal API key for authentication
 * 
 * Body:
 *   email: User's email address (required)
 *   name: User's name (optional, defaults to email prefix)
 *   portalUrl: Portal URL (optional, defaults to demo-portal.ikoneworld.net)
 *   language: User's preferred language (optional, defaults to 'en')
 */
export async function POST(request: NextRequest) {
  try {
    // Verify API key for security
    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = process.env.INTERNAL_API_KEY || process.env.JWT_SECRET;
    
    if (!apiKey || apiKey !== expectedApiKey) {
      console.error('[Welcome Email] Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json() as WelcomeEmailRequest;
    const { email, name, portalUrl, language, resetToken, isResend } = body;

    // Validate required fields
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      );
    }

    // Set defaults
    const userName = name || email.split('@')[0];
    const portal = portalUrl || 'https://demo-portal.ikoneworld.net';
    const chatUrl = 'https://demo-chat.ikoneworld.net';
    const userLanguage = language || 'en';

    console.log('[Welcome Email] Sending to:', { email, name: userName, language: userLanguage });

    // Send welcome email via Resend
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@ikoneworld.net',
      to: [email],
      subject: 'Welcome to iKoneworld Portal - Your Account is Ready',
      html: formatWelcomeEmail({
        name: userName,
        email,
        portalUrl: portal,
        chatUrl,
        resetToken,
        isResend: isResend || false,
      }),
      replyTo: process.env.RESEND_REPLY_TO_EMAIL || 'support@ikoneworld.net',
    });

    if (error) {
      console.error('[Welcome Email] Resend error:', error);
      return NextResponse.json(
        { error: `Failed to send email: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('[Welcome Email] Successfully sent:', { email, messageId: data?.id });

    return NextResponse.json({
      success: true,
      messageId: data?.id,
      recipient: email,
    });

  } catch (error) {
    console.error('[Welcome Email] Internal error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Format welcome email as professional HTML
 */
function formatWelcomeEmail({
  name,
  email,
  portalUrl,
  chatUrl,
  resetToken,
  isResend,
}: {
  name: string;
  email: string;
  portalUrl: string;
  chatUrl: string;
  resetToken?: string;
  isResend?: boolean;
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
      background-color: #f5f5f5;
    }
    .email-container {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #2563eb;
    }
    .header h1 {
      color: #1f2937;
      margin: 0 0 10px;
      font-size: 28px;
      font-weight: 700;
    }
    .welcome-badge {
      display: inline-block;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: white;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-top: 10px;
    }
    .greeting {
      font-size: 18px;
      color: #1f2937;
      margin: 20px 0;
      font-weight: 600;
    }
    .content {
      color: #4b5563;
      font-size: 16px;
      line-height: 1.8;
      margin: 20px 0;
    }
    .account-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-left: 4px solid #2563eb;
      border-radius: 8px;
      padding: 20px;
      margin: 25px 0;
    }
    .account-box h3 {
      margin: 0 0 15px;
      color: #1f2937;
      font-size: 16px;
      font-weight: 600;
    }
    .account-detail {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .account-detail:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: 600;
      color: #6b7280;
      min-width: 80px;
    }
    .detail-value {
      color: #1f2937;
      word-break: break-all;
    }
    .steps-section {
      margin: 30px 0;
    }
    .steps-section h3 {
      color: #1f2937;
      font-size: 18px;
      margin-bottom: 15px;
      font-weight: 600;
    }
    .step {
      display: flex;
      align-items: start;
      margin: 15px 0;
      padding: 15px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .step-number {
      background: #2563eb;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
      margin-right: 15px;
    }
    .step-content {
      flex: 1;
      color: #4b5563;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: white !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 10px;
      box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(37, 99, 235, 0.3);
    }
    .button-secondary {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      box-shadow: 0 4px 6px rgba(99, 102, 241, 0.2);
    }
    .features-section {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 20px;
      margin: 25px 0;
      border-radius: 8px;
    }
    .features-section h3 {
      color: #92400e;
      margin: 0 0 15px;
      font-size: 16px;
      font-weight: 600;
    }
    .features-section ul {
      margin: 0;
      padding-left: 20px;
      color: #78350f;
    }
    .features-section li {
      margin: 8px 0;
    }
    .support-section {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 20px;
      margin: 25px 0;
      text-align: center;
    }
    .support-section h3 {
      color: #1e40af;
      margin: 0 0 10px;
      font-size: 16px;
      font-weight: 600;
    }
    .support-section p {
      color: #1e40af;
      margin: 5px 0;
    }
    .support-section a {
      color: #2563eb;
      text-decoration: none;
      font-weight: 600;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
      text-align: center;
    }
    .footer p {
      margin: 5px 0;
    }
    .footer a {
      color: #2563eb;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>🎉 Welcome to iKoneworld!</h1>
      <span class="welcome-badge">Your Account is Ready</span>
    </div>
    
    <p class="greeting">Hi ${name},</p>
    
    <div class="content">
      ${resetToken ? `
        <p>${isResend ? 'Your activation link has been resent!' : 'Welcome to iKoneworld! We\'re excited to have you on board.'} Your account has been successfully created.</p>
        <p><strong>To complete your account setup, please set your password by clicking the button below:</strong></p>
      ` : `
        <p>Welcome to iKoneworld! We're excited to have you on board. Your account has been successfully created and you're ready to explore our multilingual customer experience platform.</p>
      `}
    </div>
    
    <div class="account-box">
      <h3>📋 Your Account Details</h3>
      <div class="account-detail">
        <span class="detail-label">Email:</span>
        <span class="detail-value">${email}</span>
      </div>
      <div class="account-detail">
        <span class="detail-label">Portal:</span>
        <span class="detail-value">${portalUrl}</span>
      </div>
    </div>
    
    <div class="steps-section">
      <h3>🚀 Getting Started</h3>
      
      ${resetToken ? `
      <div class="step">
        <div class="step-number">1</div>
        <div class="step-content">
          <strong>Set Your Password</strong><br>
          Click the "Set Password" button below to create your secure password.
        </div>
      </div>
      ` : `
      <div class="step">
        <div class="step-number">1</div>
        <div class="step-content">
          <strong>Log in to the Portal</strong><br>
          Use your email and the password provided by your administrator to access the portal.
        </div>
      </div>
      `}
      
      <div class="step">
        <div class="step-number">2</div>
        <div class="step-content">
          <strong>Explore Customer Personas</strong><br>
          Discover how different customer segments experience your multilingual services.
        </div>
      </div>
      
      <div class="step">
        <div class="step-number">3</div>
        <div class="step-content">
          <strong>Access the Chat System</strong><br>
          Experience seamless multilingual communication with automatic translation and SSO authentication.
        </div>
      </div>
    </div>
    
    ${resetToken ? `
    <div class="button-container">
      <a href="${portalUrl}/set-password?token=${resetToken}" class="button">Set Your Password</a>
    </div>
    <div style="text-align: center; margin: 20px 0;">
      <p style="color: #dc2626; font-size: 14px; font-weight: 600;">⏰ This link expires in 24 hours</p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 5px;">If you didn't request this, please contact your administrator.</p>
    </div>
    ` : `
    <div class="button-container">
      <a href="${portalUrl}" class="button">Access Portal</a>
      <a href="${chatUrl}" class="button button-secondary">View Chat System</a>
    </div>
    `}
    
    <div class="features-section">
      <h3>✨ What You Can Do</h3>
      <ul>
        <li><strong>Website - Instant Global Presence:</strong> Provides full-site translation via a simple language icon, instantly transforming all website content into the user's chosen language for a truly localized experience.</li>
        <li><strong>In-Field - Audible, Two-Way Clarity:</strong> Enables voice-integrated, real-time, two-way translation for face-to-face conversations. The employee's spoken words are translated, displayed as text, and repeated audibly in the customer's language.</li>
        <li><strong>Chat - Instant Multilingual Support:</strong> Integrates seamlessly with existing chat platforms to offer immediate, translated customer support, reducing response times and increasing customer satisfaction.</li>
        <li><strong>Email - Professional International Correspondence:</strong> Translates inbound and outbound customer emails, ensuring professional, context-aware communication without the need for multilingual staff.</li>
        <li><strong>Documents - Accurate Content Localization:</strong> Handles complex document translation (PDF, DOCX, PPTX) while preserving the original formatting and structure, ensuring legal and technical accuracy.</li>
        <li><strong>Voice - Full-Featured Contact Center Solution:</strong> Powered by iKunnect, this experience provides a complete Contact Center as a Service (CCAAS) solution, featuring real-time voice translation and transcription capabilities for all spoken interactions.</li>
      </ul>
    </div>
    
    <div class="support-section">
      <h3>💬 Need Help?</h3>
      <p>Our support team is here to assist you.</p>
      <p>Email us at <a href="mailto:support@ikoneworld.net">support@ikoneworld.net</a></p>
    </div>
    
    <div class="footer">
      <p><small>This email was sent by iKoneworld Customer Experience Platform.</small></p>
      <p><small>© ${new Date().getFullYear()} iKoneworld. All rights reserved.</small></p>
      <p><small>Powered by <a href="https://ikoneworld.net">iKoneworld.net</a></small></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Support GET for endpoint verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Welcome email API endpoint',
    version: '1.0',
  });
}
