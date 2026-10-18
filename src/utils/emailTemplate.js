/**
 * Modern, responsive HTML email template for verification codes with 1-tap select and copy button
 */
export const generateVerificationEmail = ({
  title = 'Verification Code',
  name = 'there',
  message = 'We received a request for your KaroDeal account.',
  code,
  actionText = 'Copy Verification Code'
}) => {
  const frontendUrl = (process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_API_URL || 'https://karodeal.in').replace(/\/$/, '');
  const copyUrl = `${frontendUrl}/auth/copy?code=${encodeURIComponent(code)}`;

  const emailText = `Hi ${name},

${message}

Your One-Time Password (OTP) is:
${code}

Copy Code Link:
${copyUrl}

This code is valid for the next 10 minutes. For your security, please do not share this code with anyone, including KaroDeal staff.

Best regards,
The KaroDeal Team`;

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e5e7eb;">
          
          <!-- Header Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); padding: 28px 32px; text-align: center;">
              <span style="font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; text-decoration: none;">
                Karo<span style="color: #f96b02;">Deal</span>
              </span>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px 28px;">
              <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 900; color: #111827; letter-spacing: -0.3px;">
                ${title}
              </h2>
              
              <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.5; color: #374151; font-weight: 600;">
                Hi ${name},
              </p>
              
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #4b5563;">
                ${message}
              </p>

              <!-- Code Highlight Box with 1-Tap Select -->
              <div style="background-color: #f8fafc; border: 2px dashed #f96b02; border-radius: 16px; padding: 22px 20px; text-align: center; margin: 24px 0 20px;">
                <div style="font-size: 11px; font-weight: 800; color: #f96b02; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">
                  Your Verification Code
                </div>
                
                <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #111827; font-family: 'SF Mono', Consolas, 'Courier New', monospace; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all; user-select: all; cursor: pointer; display: inline-block; padding: 4px 12px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
                  ${code}
                </div>

                <div style="font-size: 11px; color: #6b7280; margin-top: 10px; font-weight: 500;">
                  💡 Tap or click the code to select, or click the button below:
                </div>
              </div>

              <!-- Prominent Copy Code Button -->
              <div style="text-align: center; margin: 24px 0 28px;">
                <a href="${copyUrl}" target="_blank" style="display: inline-block; background-color: #f96b02; color: #ffffff; font-weight: 800; font-size: 14px; text-decoration: none; padding: 14px 34px; border-radius: 12px; box-shadow: 0 4px 12px rgba(249, 107, 2, 0.35); text-align: center;">
                  📋 ${actionText}
                </a>
              </div>

              <!-- Expiry & Security Warning Box -->
              <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 14px 16px; margin-top: 20px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #92400e; font-weight: 600;">
                  ⏱️ Valid for 10 minutes only.
                </p>
                <p style="margin: 4px 0 0; font-size: 11px; line-height: 1.4; color: #b45309;">
                  Never share this code with anyone. KaroDeal will never ask for your verification code.
                </p>
              </div>

              <p style="margin: 24px 0 0; font-size: 12px; line-height: 1.5; color: #9ca3af;">
                If you didn't request this code, you can safely ignore this email or contact support.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; font-weight: 500;">
                &copy; ${new Date().getFullYear()} KaroDeal. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return { emailHtml, emailText, copyUrl };
};
