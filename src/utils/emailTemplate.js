/**
 * Generates distinct, custom verification emails with a clickable "Copy Code" button
 * Supports: 'LOGIN', 'FORGOT_PASSWORD', 'GOOGLE_SIGNUP'
 */
export const generateOtpEmail = ({ type = 'LOGIN', name = 'there', code }) => {
  const frontendUrl = (process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_API_URL || 'https://karodeal.in').replace(/\/$/, '');
  const copyUrl = `${frontendUrl}/auth/copy?code=${encodeURIComponent(code)}`;

  let title = 'Account Verification Code';
  let subject = `Your KaroDeal verification code is ${code}`;
  let message = 'We received a request to log in or verify your KaroDeal account.';
  let extraNote = '';

  if (type === 'FORGOT_PASSWORD') {
    title = 'Password Reset Request';
    subject = `Your KaroDeal password reset code is ${code}`;
    message = 'We received a request to reset the password for your KaroDeal account. Use the verification code below to create a new password:';
    extraNote = '<p style="margin: 12px 0 0; font-size: 11px; color: #991b1b;">If you did not request a password reset, you can safely ignore this email. Your account remains secure.</p>';
  } else if (type === 'GOOGLE_SIGNUP') {
    title = 'Google Signup Verification';
    subject = `Your KaroDeal Google Signup verification code is ${code}`;
    message = 'We received a request to create your KaroDeal account using Google. Please use the verification code below to complete your registration:';
  } else {
    // LOGIN / REGISTRATION
    title = 'Login Verification Code';
    subject = `Your KaroDeal login verification code is ${code}`;
    message = 'We received a request to log in to your KaroDeal account. Please use the verification code below to proceed securely:';
  }

  const emailText = `Hi ${name},

${message}

Your One-Time Password (OTP) is:
${code}

Click here to copy your code:
${copyUrl}

This code is valid for 10 minutes. For your security, do not share this code with anyone.

Best regards,
The KaroDeal Team`;

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 24px 20px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 24px; font-weight: 900; color: #111827;">
          Karo<span style="color: #f96b02;">Deal</span>
        </span>
      </div>

      <h3 style="font-size: 18px; font-weight: bold; color: #111827; margin: 0 0 12px;">
        ${title}
      </h3>

      <p style="margin: 0 0 8px; font-size: 14px; color: #4b5563;">
        Hi ${name},
      </p>

      <p style="margin: 0 0 18px; font-size: 14px; color: #4b5563;">
        ${message}
      </p>

      <!-- Code Box with 1-Tap Select -->
      <div style="background-color: #f9fafb; border: 1px dashed #f96b02; border-radius: 12px; padding: 18px; text-align: center; margin: 18px 0 14px;">
        <div style="font-size: 11px; font-weight: bold; color: #f96b02; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
          One-Time Password (OTP)
        </div>
        <div style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #111827; font-family: 'SF Mono', Consolas, 'Courier New', monospace; user-select: all; -webkit-user-select: all; cursor: pointer;">
          ${code}
        </div>
        <div style="font-size: 11px; color: #6b7280; margin-top: 6px;">
          (Tap code to select, or click below to copy)
        </div>
      </div>

      <!-- Copy Code Button -->
      <div style="text-align: center; margin: 16px 0 20px;">
        <a href="${copyUrl}" target="_blank" style="display: inline-block; background-color: #f96b02; color: #ffffff; font-weight: bold; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px; box-shadow: 0 2px 6px rgba(249, 107, 2, 0.3);">
          📋 Copy Code
        </a>
      </div>

      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 10px 12px; margin-top: 16px;">
        <p style="margin: 0; font-size: 11px; color: #92400e; font-weight: 500;">
          ⏱️ <strong>Valid for 10 minutes.</strong> Never share this code with anyone.
        </p>
        ${extraNote}
      </div>

      <br>
      <p style="font-size: 13px; color: #6b7280; margin: 0;">
        Best regards,<br>
        <strong style="color: #111827;">The KaroDeal Team</strong>
      </p>
    </div>
  `;

  return { subject, emailHtml, emailText, copyUrl };
};
