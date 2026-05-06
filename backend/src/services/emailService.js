const nodemailer = require('nodemailer');
const env = require('../config/env');

// Initialize transporter
let transporter;

const getMailerConfig = () => {
  const emailUser = process.env.EMAIL_USER || process.env.FEEDBACK_GMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD || process.env.FEEDBACK_GMAIL_APP_PASSWORD;
  const fromName = process.env.FEEDBACK_REPLY_FROM_NAME || 'Smart City Discovery Support';
  const fromEmail = process.env.FEEDBACK_REPLY_FROM_EMAIL || emailUser;

  return {
    emailUser,
    emailPassword,
    fromName,
    fromEmail
  };
};

const initializeTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const { emailUser, emailPassword } = getMailerConfig();

  if (!emailUser || !emailPassword) {
    console.warn('⚠️ Email credentials not found in .env. EMAIL_USER/EMAIL_PASSWORD or FEEDBACK_GMAIL_USER/FEEDBACK_GMAIL_APP_PASSWORD missing.');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });
    console.log('✅ Email transporter initialized successfully');
    console.log(`   Service: ${process.env.EMAIL_SERVICE || 'gmail'}`);
    console.log(`   User: ${emailUser}`);
    return transporter;
  } catch (error) {
    console.error('❌ Error initializing email transporter:', error.message);
    return null;
  }
};

const ensureTransporter = () => {
  return transporter || initializeTransporter();
};

// Initialize on module load
console.log('📧 Loading email service...');
initializeTransporter();

const sendPasswordResetEmail = async (email, resetToken, resetLink) => {
  try {
    const activeTransporter = ensureTransporter();

    if (!activeTransporter) {
      console.warn('Email service not configured. Skipping email send.');
      return { success: false, message: 'Email service not configured' };
    }

    const { fromName, fromEmail } = getMailerConfig();

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: 'Reset your Smart City Discovery password',
      html: `
        <div style="background: #f6f8fb; padding: 24px 0;">
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 28px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Smart City Discovery</h1>
              <p style="color: rgba(255, 255, 255, 0.85); margin: 8px 0 0; font-size: 13px;">Password reset request</p>
            </div>

            <div style="background: #ffffff; padding: 28px; border-radius: 0 0 12px 12px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);">
              <h2 style="color: #111827; margin: 0 0 12px; font-size: 20px;">Reset your password</h2>

              <p style="color: #4b5563; line-height: 1.7; margin: 0 0 16px;">
                We received a request to reset the password for your Smart City Discovery account.
                If you did not request this, you can safely ignore this email.
              </p>

              <div style="text-align: center; margin: 24px 0;">
                <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 14px;">
                  Reset password
                </a>
              </div>

              <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 0 0 10px;">
                Or copy and paste this URL into your browser:
              </p>
              <p style="background: #f3f4f6; padding: 10px 12px; border-radius: 8px; font-size: 12px; color: #374151; word-break: break-all; margin: 0 0 18px;">
                ${resetLink}
              </p>

              <div style="border-top: 1px solid #e5e7eb; margin: 20px 0;"></div>

              <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 0;">
                This link expires in 1 hour for security reasons.
              </p>
              <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 8px 0 0;">
                If you have any questions, please contact our support team.
              </p>
            </div>

            <div style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 16px;">
              © 2026 Smart City Discovery. All rights reserved.
            </div>
          </div>
        </div>
      `,
    };

    console.log(`📤 Attempting to send password reset email to: ${email}`);
    const info = await activeTransporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent successfully!');
    console.log(`   Response: ${info.response}`);
    console.log(`   Message ID: ${info.messageId}`);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('❌ Error sending password reset email:');
    console.error(`   Error: ${error.message}`);
    console.error(`   To: ${email}`);
    console.error(`   Full error:`, error);
    return { success: false, message: error.message };
  }
};

const sendVerificationEmail = async (email, verificationLink) => {
  try {
    const activeTransporter = ensureTransporter();

    if (!activeTransporter) {
      console.warn('Email service not configured. Skipping email send.');
      return { success: false, message: 'Email service not configured' };
    }

    const { fromName, fromEmail } = getMailerConfig();

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: 'Xác minh email của bạn - Smart City Discovery',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Smart City Discovery</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #333; margin-top: 0;">Xác minh email của bạn</h2>
            
            <p style="color: #555; line-height: 1.6;">
              Cảm ơn bạn đã đăng ký! Để hoàn tất việc đăng ký, vui lòng xác minh email của bạn.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Xác minh email
              </a>
            </div>
          </div>
        </div>
      `,
    };

    const info = await activeTransporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.response);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, message: error.message };
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail,
  initializeTransporter,
};
