import db from '../database/db.js';
import bcrypt from 'bcryptjs';

const createDemoData = async () => {
  try {
    console.log('Creating comprehensive demo data...');
    console.log('Clearing existing demo data...');

    // Clear existing data (but keep structure)
    await db.run('DELETE FROM notifications');
    await db.run('DELETE FROM workflow_logs');
    await db.run('DELETE FROM schedules');
    await db.run('DELETE FROM maintenance_requests');
    await db.run('DELETE FROM properties');
    await db.run('DELETE FROM contractors');
    await db.run('DELETE FROM users WHERE email LIKE ?', ['%@demo.com']);

    const passwordHash = await bcrypt.hash('demo123', 10);

    // ===== CREATE USERS =====
    console.log('Creating users...');

    // Brokers
    const broker1 = await getOrCreateUser('broker1@demo.com', passwordHash, 'John Broker', 'broker', '+31612345678');
    const broker2 = await getOrCreateUser('broker2@demo.com', passwordHash, 'Sarah Broker', 'broker', '+31612345679');

    // Owners
    const owner1 = await getOrCreateUser('owner1@demo.com', passwordHash, 'Peter Owner', 'owner', '+31612345680');
    const owner2 = await getOrCreateUser('owner2@demo.com', passwordHash, 'Maria Owner', 'owner', '+31612345681');
    const owner3 = await getOrCreateUser('owner3@demo.com', passwordHash, 'David Owner', 'owner', '+31612345682');

    // Renters
    const renter1 = await getOrCreateUser('renter1@demo.com', passwordHash, 'Alice Renter', 'renter', '+31612345683');
    const renter2 = await getOrCreateUser('renter2@demo.com', passwordHash, 'Bob Renter', 'renter', '+31612345684');
    const renter3 = await getOrCreateUser('renter3@demo.com', passwordHash, 'Charlie Renter', 'renter', '+31612345685');
    const renter4 = await getOrCreateUser('renter4@demo.com', passwordHash, 'Diana Renter', 'renter', '+31612345686');

    // Contractors
    const contractor1 = await getOrCreateUser('contractor1@demo.com', passwordHash, 'Mike Plumber', 'contractor', '+31612345687');
    const contractor2 = await getOrCreateUser('contractor2@demo.com', passwordHash, 'Lisa Electrician', 'contractor', '+31612345688');
    const contractor3 = await getOrCreateUser('contractor3@demo.com', passwordHash, 'Tom Handyman', 'contractor', '+31612345689');

    // Create contractor profiles
    await createContractorIfNotExists(contractor1.id, 'Amsterdam Plumbing Services', ['plumbing', 'heating', 'water']);
    await createContractorIfNotExists(contractor2.id, 'QuickFix Electrical', ['electrical', 'lighting', 'wiring']);
    await createContractorIfNotExists(contractor3.id, 'All-Round Handyman', ['plumbing', 'electrical', 'structural', 'appliances']);

    // ===== CREATE PROPERTIES =====
    console.log('Creating properties...');

    const property1 = await createPropertyIfNotExists('123 Keizersgracht, Amsterdam', owner1.id, renter1.id, broker1.id);
    const property2 = await createPropertyIfNotExists('456 Prinsengracht, Amsterdam', owner1.id, renter2.id, broker1.id);
    const property3 = await createPropertyIfNotExists('789 Herengracht, Amsterdam', owner2.id, renter3.id, broker1.id);
    const property4 = await createPropertyIfNotExists('321 Singel, Amsterdam', owner2.id, renter4.id, broker2.id);
    const property5 = await createPropertyIfNotExists('654 Leidsegracht, Amsterdam', owner3.id, null, broker2.id);

    // ===== CREATE MAINTENANCE REQUESTS =====
    console.log('Creating maintenance requests...');

    // Request 1: Pending (just created)
    const request1 = await createMaintenanceRequest(
      property1.id,
      renter1.id,
      broker1.id,
      owner1.id,
      'Leaking faucet in kitchen',
      'The kitchen faucet has been leaking for 2 days. Water is dripping constantly.',
      'plumbing',
      'medium',
      'pending'
    );
    if (request1) {
      await logWorkflowStep(request1, 'request_created', renter1.id, 'Renter created maintenance request');
    }

    // Request 2: Owner notified, waiting for contractor selection
    const request2 = await createMaintenanceRequest(
      property2.id,
      renter2.id,
      broker1.id,
      owner1.id,
      'Broken heating system',
      'The heating stopped working yesterday. It\'s getting cold in the apartment.',
      'heating',
      'high',
      'notified_owner'
    );
    if (request2) {
      await logWorkflowStep(request2, 'request_created', renter2.id, 'Renter created maintenance request');
      await logWorkflowStep(request2, 'broker_notified', broker1.id, 'Broker notified of new request');
      await logWorkflowStep(request2, 'owner_notified', owner1.id, 'Owner notified of maintenance request');
    }

    // Request 3: Contractor selected, waiting for scheduling
    const request3 = await createMaintenanceRequest(
      property3.id,
      renter3.id,
      broker1.id,
      owner2.id,
      'Electrical outlet not working',
      'The outlet in the living room stopped working. No power.',
      'electrical',
      'medium',
      'contractor_selected',
      contractor2.id
    );
    if (request3) {
      await logWorkflowStep(request3, 'request_created', renter3.id, 'Renter created maintenance request');
      await logWorkflowStep(request3, 'broker_notified', broker1.id, 'Broker notified of new request');
      await logWorkflowStep(request3, 'owner_notified', owner2.id, 'Owner notified of maintenance request');
      await logWorkflowStep(request3, 'contractor_selected', owner2.id, `Owner selected contractor ${contractor2.id}`);
    }

    // Request 4: Scheduled appointment
    const request4 = await createMaintenanceRequest(
      property4.id,
      renter4.id,
      broker2.id,
      owner2.id,
      'Washing machine broken',
      'The washing machine makes loud noises and doesn\'t spin properly.',
      'appliances',
      'medium',
      'scheduled',
      contractor3.id
    );
    if (request4) {
      await logWorkflowStep(request4, 'request_created', renter4.id, 'Renter created maintenance request');
      await logWorkflowStep(request4, 'broker_notified', broker2.id, 'Broker notified of new request');
      await logWorkflowStep(request4, 'owner_notified', owner2.id, 'Owner notified of maintenance request');
      await logWorkflowStep(request4, 'contractor_selected', owner2.id, `Owner selected contractor ${contractor3.id}`);
      await logWorkflowStep(request4, 'appointment_scheduled', broker2.id, 'Appointment scheduled for 2025-11-25 14:00');

      // Create schedule for request4
      const scheduleDate = new Date('2025-11-25T14:00:00');
      await db.run(
        `INSERT INTO schedules (maintenance_request_id, contractor_id, renter_id, scheduled_date, notes, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [request4, contractor3.id, renter4.id, scheduleDate.toISOString(), 'Please bring replacement parts']
      );
    }

    // Request 5: In progress
    const request5 = await createMaintenanceRequest(
      property1.id,
      renter1.id,
      broker1.id,
      owner1.id,
      'Bathroom tiles coming loose',
      'Several tiles in the shower are loose and one fell off.',
      'structural',
      'low',
      'in_progress',
      contractor3.id
    );
    if (request5) {
      await logWorkflowStep(request5, 'request_created', renter1.id, 'Renter created maintenance request');
      await logWorkflowStep(request5, 'broker_notified', broker1.id, 'Broker notified of new request');
      await logWorkflowStep(request5, 'owner_notified', owner1.id, 'Owner notified of maintenance request');
      await logWorkflowStep(request5, 'contractor_selected', owner1.id, `Owner selected contractor ${contractor3.id}`);
      await logWorkflowStep(request5, 'appointment_scheduled', broker1.id, 'Appointment scheduled');
      await logWorkflowStep(request5, 'work_started', contractor3.id, 'Contractor started work');
    }

    // Request 6: Completed
    const request6 = await createMaintenanceRequest(
      property2.id,
      renter2.id,
      broker1.id,
      owner1.id,
      'Door lock broken',
      'Front door lock is stuck and key won\'t turn.',
      'structural',
      'high',
      'completed',
      contractor3.id
    );
    if (request6) {
      await logWorkflowStep(request6, 'request_created', renter2.id, 'Renter created maintenance request');
      await logWorkflowStep(request6, 'broker_notified', broker1.id, 'Broker notified of new request');
      await logWorkflowStep(request6, 'owner_notified', owner1.id, 'Owner notified of maintenance request');
      await logWorkflowStep(request6, 'contractor_selected', owner1.id, `Owner selected contractor ${contractor3.id}`);
      await logWorkflowStep(request6, 'appointment_scheduled', broker1.id, 'Appointment scheduled');
      await logWorkflowStep(request6, 'work_started', contractor3.id, 'Contractor started work');
      await logWorkflowStep(request6, 'work_completed', contractor3.id, 'Work completed successfully');
    }

    // ===== CREATE NOTIFICATIONS =====
    console.log('Creating notifications...');

    // Notifications for broker1
    if (request1) await createNotification(broker1.id, 'new_maintenance_request', 'New Request', 'New plumbing request from Alice Renter', request1);
    if (request3) await createNotification(broker1.id, 'contractor_selected', 'Contractor Selected', 'Owner selected contractor for: Electrical outlet not working', request3);

    // Notifications for owner1
    if (request2) await createNotification(owner1.id, 'new_maintenance_request', 'New Request', 'New heating request from Bob Renter', request2);

    // Notifications for owner2
    if (request3) await createNotification(owner2.id, 'new_maintenance_request', 'New Request', 'New electrical request from Charlie Renter', request3);

    // Notifications for contractor2
    if (request3) await createNotification(contractor2.id, 'contractor_assigned', 'New Assignment', 'You have been assigned to: Electrical outlet not working', request3);

    // Notifications for contractor3
    if (request4) {
      await createNotification(contractor3.id, 'contractor_assigned', 'New Assignment', 'You have been assigned to: Washing machine broken', request4);
      await createNotification(contractor3.id, 'appointment_scheduled', 'Appointment Scheduled', 'Appointment scheduled for: 2025-11-25 14:00', request4);
    }

    // Notifications for renter4
    if (request4) await createNotification(renter4.id, 'appointment_scheduled', 'Appointment Scheduled', 'Your maintenance request has been scheduled for: 2025-11-25 14:00', request4);

    console.log('\n✅ Demo data created successfully!');
    console.log('\n📋 Demo Accounts (password: demo123):');
    console.log('\n👔 Brokers:');
    console.log('  - broker1@demo.com (John Broker)');
    console.log('  - broker2@demo.com (Sarah Broker)');
    console.log('\n🏠 Owners:');
    console.log('  - owner1@demo.com (Peter Owner)');
    console.log('  - owner2@demo.com (Maria Owner)');
    console.log('  - owner3@demo.com (David Owner)');
    console.log('\n👤 Renters:');
    console.log('  - renter1@demo.com (Alice Renter) - Has 2 properties');
    console.log('  - renter2@demo.com (Bob Renter) - Has 2 properties');
    console.log('  - renter3@demo.com (Charlie Renter) - Has 1 property');
    console.log('  - renter4@demo.com (Diana Renter) - Has 1 property');
    console.log('\n🔧 Contractors:');
    console.log('  - contractor1@demo.com (Mike Plumber) - Plumbing specialist');
    console.log('  - contractor2@demo.com (Lisa Electrician) - Electrical specialist');
    console.log('  - contractor3@demo.com (Tom Handyman) - General handyman');
    console.log('\n📦 Properties:');
    console.log('  - 123 Keizersgracht, Amsterdam (Owner: Peter, Renter: Alice)');
    console.log('  - 456 Prinsengracht, Amsterdam (Owner: Peter, Renter: Bob)');
    console.log('  - 789 Herengracht, Amsterdam (Owner: Maria, Renter: Charlie)');
    console.log('  - 321 Singel, Amsterdam (Owner: Maria, Renter: Diana)');
    console.log('  - 654 Leidsegracht, Amsterdam (Owner: David, No renter)');
    console.log('\n🔨 Maintenance Requests:');
    console.log('  - Request 1: Pending (Leaking faucet)');
    console.log('  - Request 2: Owner Notified (Broken heating)');
    console.log('  - Request 3: Contractor Selected (Electrical outlet)');
    console.log('  - Request 4: Scheduled (Washing machine)');
    console.log('  - Request 5: In Progress (Bathroom tiles)');
    console.log('  - Request 6: Completed (Door lock)');
    console.log('\n✨ You can now test the full workflow!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating demo data:', error);
    process.exit(1);
  }
};

// Helper functions
async function getOrCreateUser(email, passwordHash, name, role, phone) {
  let user = await db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (!user) {
    const result = await db.run(
      'INSERT INTO users (email, password_hash, name, role, phone) VALUES (?, ?, ?, ?, ?)',
      [email, passwordHash, name, role, phone]
    );
    user = { id: result.lastID };
  }
  return user;
}

async function createContractorIfNotExists(userId, companyName, specialties) {
  const existing = await db.get('SELECT id FROM contractors WHERE user_id = ?', [userId]);
  if (!existing) {
    await db.run(
      'INSERT INTO contractors (user_id, company_name, specialties, rating) VALUES (?, ?, ?, ?)',
      [userId, companyName, JSON.stringify(specialties), Math.random() * 2 + 3] // Rating between 3-5
    );
  }
}

async function createPropertyIfNotExists(address, ownerId, renterId, brokerId) {
  let property = await db.get('SELECT id FROM properties WHERE address = ?', [address]);
  if (!property) {
    const result = await db.run(
      'INSERT INTO properties (address, owner_id, renter_id, broker_id) VALUES (?, ?, ?, ?)',
      [address, ownerId, renterId, brokerId]
    );
    property = { id: result.lastID };
  }
  return property;
}

async function createMaintenanceRequest(propertyId, renterId, brokerId, ownerId, title, description, category, priority, status, contractorId = null) {
  const result = await db.run(
    `INSERT INTO maintenance_requests 
     (property_id, renter_id, broker_id, owner_id, contractor_id, title, description, category, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [propertyId, renterId, brokerId, ownerId, contractorId || null, title, description, category, priority, status]
  );

  if (!result || !result.lastID) {
    throw new Error(`Failed to create maintenance request: ${title}. Result: ${JSON.stringify(result)}`);
  }

  return result.lastID;
}

async function logWorkflowStep(requestId, step, actorId, details) {
  if (!requestId) {
    console.warn(`Skipping workflow log: requestId is null/undefined for step: ${step}`);
    return;
  }
  await db.run(
    'INSERT INTO workflow_logs (maintenance_request_id, step, actor_id, details) VALUES (?, ?, ?, ?)',
    [requestId, step, actorId || null, details]
  );
}

async function createNotification(userId, type, title, message, relatedRequestId = null) {
  await db.run(
    'INSERT INTO notifications (user_id, type, title, message, related_request_id) VALUES (?, ?, ?, ?, ?)',
    [userId, type, title, message, relatedRequestId]
  );
}

createDemoData();

