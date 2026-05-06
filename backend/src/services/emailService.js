const nodemailer = require('nodemailer');
const env = require('../config/env');

// Initialize transporter
let transporter;

const initializeTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn('⚠️ Email credentials not found in .env. EMAIL_USER or EMAIL_PASSWORD missing.');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    console.log('✅ Email transporter initialized successfully');
    console.log(`   Service: ${process.env.EMAIL_SERVICE || 'gmail'}`);
    console.log(`   User: ${process.env.EMAIL_USER}`);
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

    const mailOptions = {
      from: `"Smart City Discovery" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Đặt lại mật khẩu tài khoản Smart City Discovery',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Smart City Discovery</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #333; margin-top: 0;">Đặt lại mật khẩu của bạn</h2>
            
            <p style="color: #555; line-height: 1.6;">
              Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. 
              Nếu đó không phải là bạn, bạn có thể bỏ qua email này.
            </p>
            
            <p style="color: #555; line-height: 1.6;">
              Để đặt lại mật khẩu của bạn, vui lòng nhấp vào liên kết bên dưới:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Đặt lại mật khẩu
              </a>
            </div>
            
            <p style="color: #999; font-size: 12px; line-height: 1.6;">
              Hoặc sao chép và dán URL này vào trình duyệt của bạn:<br/>
              <code style="background: #eee; padding: 5px 10px; border-radius: 3px; color: #333;">
                ${resetLink}
              </code>
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            
            <p style="color: #999; font-size: 12px; line-height: 1.6;">
              Liên kết này sẽ hết hạn trong 1 giờ vì lý do bảo mật.
            </p>
            
            <p style="color: #999; font-size: 12px; line-height: 1.6;">
              Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi.
            </p>
          </div>
          
          <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #999; border-radius: 0 0 8px 8px;">
            <p style="margin: 0;">© 2026 Smart City Discovery. All rights reserved.</p>
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

    const mailOptions = {
      from: `"Smart City Discovery" <${process.env.EMAIL_USER}>`,
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
