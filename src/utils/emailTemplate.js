/**
 * Compact email template with 1-tap select and copy styling
 */
export const getOtpEmailHtml = ({ greeting = 'Hi there,', message, code }) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 500px; padding: 20px;">
    <p>${greeting}</p>
    <p>${message}</p>
    <p style="margin-bottom: 6px;">Your One-Time Password (OTP) is:</p>
    <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; user-select: all; -webkit-user-select: all; background: #f3f4f6; padding: 10px 18px; border-radius: 8px; display: inline-block; border: 1px dashed #f96b02; cursor: pointer; color: #111;">
      ${code}
    </div>
    <p style="font-size: 11px; color: #777; margin-top: 6px;">(Tap code to select and copy)</p>
    <p style="font-size: 12px; color: #555; margin-top: 15px;">Valid for 10 minutes. Please do not share this code with anyone.</p>
    <br>
    <p>Best regards,<br><strong>The KaroDeal Team</strong></p>
  </div>
`;

export const getOtpEmailText = ({ greeting = 'Hi there,', message, code }) =>
  `${greeting}\n\n${message}\n\nYour One-Time Password (OTP) is: ${code}\n\nValid for 10 minutes. Please do not share this code with anyone.\n\nBest regards,\nThe KaroDeal Team`;
