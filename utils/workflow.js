import db from '../database/db.js';
import nodemailer from 'nodemailer';

// Generate calendar links for appointment
const generateCalendarLinks = (title, description, startDate, location = '') => {
  // Format date for calendar links (YYYYMMDDTHHmmss)
  const formatDate = (dateStr) => {
    // Handle date strings with or without timezone
    let date;
    if (dateStr.includes('Z') || dateStr.includes('+') || dateStr.includes('-', 10)) {
      date = new Date(dateStr);
    } else {
      date = new Date(dateStr.replace('T', ' '));
    }
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const start = formatDate(startDate);
  const endDate = new Date(startDate.includes('Z') || startDate.includes('+') || startDate.includes('-', 10) 
    ? new Date(startDate) 
    : new Date(startDate.replace('T', ' ')));
  endDate.setHours(endDate.getHours() + 1); // 1 hour duration
  const end = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // Google Calendar link
  const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;

  // Outlook Calendar link (ISO 8601 format)
  const outlookStart = new Date(startDate.includes('Z') || startDate.includes('+') || startDate.includes('-', 10) 
    ? new Date(startDate) 
    : new Date(startDate.replace('T', ' '))).toISOString();
  const outlookEnd = endDate.toISOString();
  const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${encodeURIComponent(outlookStart)}&enddt=${encodeURIComponent(outlookEnd)}&body=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;

  return { googleLink, outlookLink };
};

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
        
        // Get request data if relatedRequestId exists to determine action link
        let actionLink = '';
        let actionText = '';
        let calendarLinks = null;
        
        if (relatedRequestId) {
          const request = await db.get('SELECT * FROM maintenance_requests WHERE id = ?', [relatedRequestId]);
          if (request) {
            // Only show "Select Contractor" button to owners (userId matches owner_id)
            if (type === 'new_maintenance_request' && request.status === 'notified_owner' && userId === request.owner_id) {
              // Owner needs to select contractor
              actionLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/select-contractor/${request.selection_token}`;
              actionText = 'Select Contractor';
            } else if (type === 'contractor_assigned' && request.status === 'contractor_selected') {
              // Contractor needs to schedule
              actionLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/schedule-appointment/${request.selection_token}`;
              actionText = 'Schedule Appointment';
            } else {
              // Regular view link (for brokers and others)
              actionLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/requests/${relatedRequestId}`;
              actionText = 'View Request in System';
            }

            // Generate calendar links for appointment scheduled notifications
            if (type === 'appointment_scheduled') {
              const schedule = await db.get(
                'SELECT * FROM schedules WHERE maintenance_request_id = ? ORDER BY created_at DESC LIMIT 1',
                [relatedRequestId]
              );
              
              if (schedule && schedule.scheduled_date) {
                // Get property address for location
                const property = await db.get('SELECT address FROM properties WHERE id = ?', [request.property_id]);
                const location = property ? property.address : '';
                
                const calendarTitle = `Maintenance: ${request.title}`;
                const calendarDescription = `${request.description}\n\nCategory: ${request.category}\nPriority: ${request.priority}`;
                
                calendarLinks = generateCalendarLinks(calendarTitle, calendarDescription, schedule.scheduled_date, location);
              }
            }
          }
        }
        
        if (transporter) {
          // For showcase: Send all emails to demo address, but show actual recipient in email
          const showcaseEmail = 'michaelvh89@hotmail.com';
          const actualRecipient = user.email;
          const actualRecipientName = user.name;
          
          // Build action button HTML
          const actionButtonHtml = actionLink ? `
            <div style="margin: 30px 0;">
              <a href="${actionLink}" 
                 style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                ${actionText}
              </a>
            </div>
          ` : '';

          // Build calendar buttons HTML
          const calendarButtonsHtml = calendarLinks ? `
            <div style="margin: 30px 0; padding: 20px; background: #fff; border: 2px solid #28a745; border-radius: 5px;">
              <p style="margin: 0 0 15px 0; font-weight: bold; color: #333;">📅 Add to Calendar:</p>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <a href="${calendarLinks.googleLink}" 
                   target="_blank"
                   style="display: inline-block; background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">
                  📅 Google Calendar
                </a>
                <a href="${calendarLinks.outlookLink}" 
                   target="_blank"
                   style="display: inline-block; background: #0078d4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  📅 Outlook Calendar
                </a>
              </div>
            </div>
          ` : '';
          
          // Send real email to showcase address (for demo purposes)
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@partners-vastgoed.com',
            to: showcaseEmail,
            subject: `[Vastgoed & Partners] ${title} (for: ${actualRecipientName})`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #343a40; color: white; padding: 20px; text-align: center;">
                  <h1 style="margin: 0;">Vastgoed & Partners</h1>
                </div>
                <div style="padding: 20px; background: #f8f9fa;">
                  <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin-bottom: 15px; border-radius: 4px;">
                    <strong>📧 Showcase Mode:</strong> This email would normally be sent to <strong>${actualRecipientName}</strong> (${actualRecipient})
                  </div>
                  <h2 style="color: #333;">${title}</h2>
                  <p style="color: #666; font-size: 16px; line-height: 1.6;">${message}</p>
                  ${actionButtonHtml}
                  ${calendarButtonsHtml}
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
          console.log(`✅ Email notification sent to ${showcaseEmail} (showcase mode - actual recipient: ${actualRecipientName} <${actualRecipient}>)`);
        } else {
          // If no SMTP configured, log it
          console.log(`📧 Email notification would be sent to michaelvh89@hotmail.com (showcase mode)`);
          console.log(`   Actual recipient: ${user.name} <${user.email}>`);
          console.log(`   Subject: [Vastgoed & Partners] ${title}`);
          console.log(`   Message: ${message}`);
          if (actionLink) {
            console.log(`   Action Link: ${actionLink}`);
          }
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

