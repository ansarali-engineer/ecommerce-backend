import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.isMock = !process.env.SMTP_USER || process.env.SMTP_USER === 'mock_user' || process.env.SMTP_USER === 'your_smtp_user';
    
    this.transporter = !this.isMock
      ? nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '2525'),
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        })
      : null;
  }

  async sendMail({ to, subject, html, text }) {
    const from = process.env.EMAIL_FROM || 'noreply@ecommerce.com';
    if (this.isMock) {
      console.log('================= MOCK EMAIL SENT =================');
      console.log(`FROM: ${from}`);
      console.log(`TO: ${to}`);
      console.log(`SUBJECT: ${subject}`);
      console.log(`TEXT: ${text}`);
      console.log('==================================================');
      return { messageId: 'mock-id-' + Date.now() };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
        html
      });
      return info;
    } catch (error) {
      console.error('[EmailService] Error sending email:', error.message);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  async sendVerificationEmail(email, token, name) {
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
    await this.sendMail({
      to: email,
      subject: 'Verify your eCommerce account email',
      text: `Hello ${name},\n\nPlease verify your account by clicking the link: ${verifyUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Welcome to our eCommerce Store, ${name}!</h2>
          <p>Thank you for registering. Please click the button below to verify your email address and activate your account:</p>
          <a href="${verifyUrl}" style="display: inline-block; background-color: #f1c40f; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0;">Verify Email</a>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p>${verifyUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #777;">If you did not request this email, you can safely ignore it.</p>
        </div>
      `
    });
  }

  async sendResetPasswordEmail(email, token, name) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    await this.sendMail({
      to: email,
      subject: 'Reset your eCommerce account password',
      text: `Hello ${name},\n\nYou requested a password reset. Reset password here: ${resetUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Password Reset Request</h2>
          <p>Hello ${name},</p>
          <p>You are receiving this email because you (or someone else) requested a password reset for your account. Please click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #f1c40f; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0;">Reset Password</a>
          <p>The link will expire in 1 hour.</p>
          <p>If you did not request this reset, please ignore this email and your password will remain unchanged.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #777;">eCommerce Platform Security Team</p>
        </div>
      `
    });
  }
}

export default new EmailService();
