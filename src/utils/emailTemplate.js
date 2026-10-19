/**
 * Generates distinct, custom verification emails with a clickable "Copy Code" button
 * Supports: 'LOGIN', 'FORGOT_PASSWORD', 'GOOGLE_SIGNUP'
 */
export const generateOtpEmail = ({ type = 'LOGIN', name = 'there', code }) => {
  const frontendUrl = (process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_API_URL || 'https://karodeal.in').replace(/\/$/, '');
  const copyUrl = `${frontendUrl}/auth/copy?code=${encodeURIComponent(code)}`;
  const digits = String(code).trim().split('');

  let title = 'Account Verification Code';
  let subject = `Your KaroDeal verification code is ${code}`;
  let message = 'We received a request to log in or verify your KaroDeal account. Please use the verification code below to proceed securely:';
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

Code requested:
${code}

Your verification code is: ${code}

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

      <p style="margin: 0 0 16px; font-size: 14px; color: #4b5563;">
        ${message}
      </p>

      <!-- Code requested Card with 6-Digit Individual Boxes (1-Tap Copy in Mail) -->
      <div style="background-color: #f0f4f9; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin: 18px 0; text-align: left;">
        <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 12px; letter-spacing: -0.2px;">
          Code requested
        </div>

        <table border="0" cellpadding="0" cellspacing="6" style="margin: 0 0 10px 0; border-collapse: separate;">
          <tr>
            ${digits.map(d => `
              <td style="width: 40px; height: 48px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center; vertical-align: middle; font-size: 24px; font-weight: 800; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; box-shadow: 0 1px 2px rgba(0,0,0,0.06); user-select: all; -webkit-user-select: all;">
                ${d}
              </td>
            `).join('')}
          </tr>
        </table>

        <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
          (Click or double-tap code to copy directly)
        </div>
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
