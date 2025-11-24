import db from '../database/db.js';

// Create notification for user
export const createNotification = async (userId, type, title, message, relatedRequestId = null) => {
  try {
    await db.run(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, type, title, message, relatedRequestId]
    );
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

