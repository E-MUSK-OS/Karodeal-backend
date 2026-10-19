/**
 * Generates clean, professional verification emails with a 1-tap/double-click
 * selectable OTP code card that works reliably in all email clients without external redirects.
 * Supports: 'LOGIN', 'FORGOT_PASSWORD', 'GOOGLE_SIGNUP'
 */
export const generateOtpEmail = ({ type = 'LOGIN', name = 'there', code }) => {
  const cleanCode = String(code).trim();

  let title = 'Account Verification Code';
  let subject = `Your KaroDeal verification code is ${cleanCode}`;
  let message = 'We received a request to log in or verify your KaroDeal account. Please use the verification code below:';
  let extraNote = '';

  if (type === 'FORGOT_PASSWORD') {
    title = 'Password Reset Request';
    subject = `Your KaroDeal password reset code is ${cleanCode}`;
    message = 'We received a request to reset the password for your KaroDeal account. Use the verification code below to set up a new password:';
    extraNote = '<p style="margin: 10px 0 0; font-size: 11px; color: #991b1b; line-height: 1.4;">If you did not request a password reset, you can safely ignore this email. Your account remains secure.</p>';
  } else if (type === 'GOOGLE_SIGNUP') {
    title = 'Google Signup Verification';
    subject = `Your KaroDeal Google Signup verification code is ${cleanCode}`;
    message = 'We received a request to create your KaroDeal account using Google. Please use the verification code below to complete your registration:';
  } else {
    // LOGIN / REGISTRATION
    title = 'Login Verification Code';
    subject = `Your KaroDeal login verification code is ${cleanCode}`;
    message = 'We received a request to log in to your KaroDeal account. Please use the verification code below to proceed:';
  }

  const emailText = `Hi ${name},

${message}

Your verification code is:
${cleanCode}

This code is valid for 10 minutes. For your security, do not share this code with anyone.

Best regards,
The KaroDeal Team`;

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 480px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <!-- Logo Header -->
      <div style="text-align: center; margin-bottom: 22px;">
        <span style="font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">
          Karo<span style="color: #f96b02;">Deal</span>
        </span>
      </div>

      <!-- Title & Greeting -->
      <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 10px;">
        ${title}
      </h3>

      <p style="margin: 0 0 8px; font-size: 14px; color: #475569;">
        Hi ${name},
      </p>

      <p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.5;">
        ${message}
      </p>

      <!-- 1-Tap Selectable Code Card (No external redirects) -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 18px 0; text-align: center;">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
          Verification Code
        </div>

        <div style="display: inline-block; background-color: #ffffff; border: 2px dashed #f96b02; border-radius: 10px; padding: 10px 24px; margin: 4px 0;">
          <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #0f172a; user-select: all; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all; cursor: pointer;">
            ${cleanCode}
          </span>
        </div>

        <div style="font-size: 12px; color: #64748b; margin-top: 10px;">
          (Double-tap or tap & hold the code to copy)
        </div>
      </div>

      <!-- Security Notice -->
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 10px 14px; margin-top: 16px;">
        <p style="margin: 0; font-size: 12px; color: #92400e; font-weight: 500;">
          ⏱️ <strong>Valid for 10 minutes.</strong> Never share this code with anyone.
        </p>
        ${extraNote}
      </div>

      <br>
      <p style="font-size: 13px; color: #64748b; margin: 0; line-height: 1.5;">
        Best regards,<br>
        <strong style="color: #0f172a;">The KaroDeal Team</strong>
      </p>
    </div>
  `;

  return { subject, emailHtml, emailText };
};
