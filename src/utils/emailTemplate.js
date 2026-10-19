/**
 * Formats verification emails exactly like Spotify's clean, minimalist structure.
 * Triggers Gmail's native AI "Code Requested" + "Copy code" summary card.
 * Supports: 'LOGIN', 'FORGOT_PASSWORD', 'GOOGLE_SIGNUP'
 */
export const generateOtpEmail = ({ type = 'LOGIN', name = '', code }) => {
  const cleanCode = String(code).trim();
  const displayName = name && name !== 'there' ? ` ${name}` : '';

  let subject = `${cleanCode} - Your KaroDeal login code`;
  let instruction = 'Enter this code to continue logging in:';
  let ignoreNotice = "If you didn't attempt to log in, you can safely ignore this email.";

  if (type === 'FORGOT_PASSWORD') {
    subject = `${cleanCode} - Your KaroDeal password reset code`;
    instruction = 'Enter this code to reset your password and secure your account:';
    ignoreNotice = "If you didn't attempt to reset your password, you can safely ignore this email.";
  } else if (type === 'GOOGLE_SIGNUP') {
    subject = `${cleanCode} - Your KaroDeal signup code`;
    instruction = 'Enter this code to complete your KaroDeal registration:';
    ignoreNotice = "If you didn't attempt to sign up, you can safely ignore this email.";
  }

  const emailText = `Hi${displayName},

${instruction}

${cleanCode}

This code is valid for 10 minutes and can only be used once.

${ignoreNotice}

Best regards,
KaroDeal`;

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 500px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff;">
      <!-- Logo Header -->
      <div style="text-align: left; margin-bottom: 24px;">
        <span style="font-size: 26px; font-weight: 900; color: #111827; letter-spacing: -0.5px;">
          Karo<span style="color: #f96b02;">Deal</span>
        </span>
      </div>

      <p style="margin: 0 0 16px; font-size: 15px; color: #111827;">
        Hi${displayName},
      </p>

      <p style="margin: 0 0 18px; font-size: 15px; color: #111827; line-height: 1.5;">
        ${instruction}
      </p>

      <!-- Prominent Clean Code (Spotify style) -->
      <div style="margin: 24px 0 28px; font-size: 34px; font-weight: 800; letter-spacing: 2px; color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; user-select: all; -webkit-user-select: all; cursor: pointer;">
        ${cleanCode}
      </div>

      <p style="margin: 0 0 14px; font-size: 14px; color: #374151; line-height: 1.6;">
        This code is valid for 10 minutes and can only be used once.
      </p>

      <p style="margin: 0 0 24px; font-size: 14px; color: #374151; line-height: 1.6;">
        ${ignoreNotice}
      </p>

      <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">
        Best regards,<br>
        <strong style="color: #111827;">KaroDeal</strong>
      </p>
    </div>
  `;

  return { subject, emailHtml, emailText };
};
