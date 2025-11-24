import db from '../database/db.js';
import nodemailer from 'nodemailer';

// Email configuration (optional - only sends if configured)
const getEmailTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

// Create notification for user (in-app + optional email)
export const createNotification = async (userId, type, title, message, relatedRequestId = null) => {
  try {
    // Store in-app notification
    await db.run(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, type, title, message, relatedRequestId]
    );

    // Try to send email notification
    try {
      const user = await db.get('SELECT email, name FROM users WHERE id = ?', [userId]);
      if (user && user.email) {
        const transporter = getEmailTransporter();
        
        if (transporter) {
          // Send real email to actual recipient
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@partners-vastgoed.com',
            to: user.email,
            subject: `[Vastgoed & Partners] ${title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #343a40; color: white; padding: 20px; text-align: center;">
                  <h1 style="margin: 0;">Vastgoed & Partners</h1>
                </div>
                <div style="padding: 20px; background: #f8f9fa;">
                  <h2 style="color: #333;">${title}</h2>
                  <p style="color: #666; font-size: 16px; line-height: 1.6;">${message}</p>
                  ${relatedRequestId ? `
                    <div style="margin: 30px 0;">
                      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/requests/${relatedRequestId}" 
                         style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        View Request in System
                      </a>
                    </div>
                  ` : ''}
                </div>
                <div style="background: #e9ecef; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                  <p style="margin: 0;">
                    This is an automated notification from the Vastgoed & Partners property management system.
                    <br />
                    Please do not reply to this email.
                  </p>
                </div>
              </div>
            `,
          });
          console.log(`✅ Email notification sent to ${user.email} (${user.name})`);
        } else {
          // If no SMTP configured, log it
          console.log(`📧 Email notification would be sent to ${user.email} (${user.name})`);
          console.log(`   Subject: [Vastgoed & Partners] ${title}`);
          console.log(`   Message: ${message}`);
          console.log(`   ⚠️  SMTP not configured - add SMTP settings to .env to enable real email delivery`);
        }
      }
    } catch (emailError) {
      // Email is optional, don't fail if it doesn't work
      console.error('❌ Email notification error:', emailError.message);
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// Log workflow step for audit trail
export const logWorkflowStep = async (requestId, step, actorId, details) => {
  try {
    await db.run(
      `INSERT INTO workflow_logs (maintenance_request_id, step, actor_id, details)
       VALUES (?, ?, ?, ?)`,
      [requestId, step, actorId, details]
    );
  } catch (error) {
    console.error('Error logging workflow step:', error);
  }
};

