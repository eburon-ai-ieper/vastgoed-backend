import db from '../database/db.js';
import bcrypt from 'bcryptjs';

const createTestData = async () => {
  try {
    console.log('Creating test data...');

    // Create test users
    const passwordHash = await bcrypt.hash('test123', 10);

    // Create Broker
    let broker = await db.get('SELECT id FROM users WHERE email = ?', ['broker@test.com']);
    if (!broker) {
      const brokerResult = await db.run(
        'INSERT INTO users (email, password_hash, name, role, phone) VALUES (?, ?, ?, ?, ?)',
        ['broker@test.com', passwordHash, 'Test Broker', 'broker', '+1234567890']
      );
      broker = { id: brokerResult.lastID };
    }
    const brokerId = broker.id;

    // Create Owner
    let owner = await db.get('SELECT id FROM users WHERE email = ?', ['owner@test.com']);
    if (!owner) {
      const ownerResult = await db.run(
        'INSERT INTO users (email, password_hash, name, role, phone) VALUES (?, ?, ?, ?, ?)',
        ['owner@test.com', passwordHash, 'Test Owner', 'owner', '+1234567891']
      );
      owner = { id: ownerResult.lastID };
    }
    const ownerId = owner.id;

    // Create Renter
    let renter = await db.get('SELECT id FROM users WHERE email = ?', ['renter@test.com']);
    if (!renter) {
      const renterResult = await db.run(
        'INSERT INTO users (email, password_hash, name, role, phone) VALUES (?, ?, ?, ?, ?)',
        ['renter@test.com', passwordHash, 'Test Renter', 'renter', '+1234567892']
      );
      renter = { id: renterResult.lastID };
    }
    const renterId = renter.id;

    // Create Contractor
    let contractor = await db.get('SELECT id FROM users WHERE email = ?', ['contractor@test.com']);
    if (!contractor) {
      const contractorResult = await db.run(
        'INSERT INTO users (email, password_hash, name, role, phone) VALUES (?, ?, ?, ?, ?)',
        ['contractor@test.com', passwordHash, 'Test Contractor', 'contractor', '+1234567893']
      );
      contractor = { id: contractorResult.lastID };
    }
    const contractorUserId = contractor.id;

    // Create contractor entry
    const existingContractor = await db.get('SELECT id FROM contractors WHERE user_id = ?', [contractorUserId]);
    if (!existingContractor) {
      await db.run(
        'INSERT INTO contractors (user_id, company_name, specialties) VALUES (?, ?, ?)',
        [contractorUserId, 'Test Plumbing Co', JSON.stringify(['plumbing', 'heating'])]
      );
    }

    // Create Property
    const existingProperty = await db.get('SELECT id FROM properties WHERE address = ?', ['123 Main Street, Amsterdam']);
    if (!existingProperty) {
      await db.run(
        'INSERT INTO properties (address, owner_id, renter_id, broker_id) VALUES (?, ?, ?, ?)',
        ['123 Main Street, Amsterdam', ownerId, renterId, brokerId]
      );
    }

    console.log('✅ Test data created successfully!');
    console.log('\nTest accounts (password: test123):');
    console.log(`- Broker: broker@test.com`);
    console.log(`- Owner: owner@test.com`);
    console.log(`- Renter: renter@test.com`);
    console.log(`- Contractor: contractor@test.com`);
    console.log(`\nProperty created: 123 Main Street, Amsterdam`);
    console.log(`  - Owner: owner@test.com`);
    console.log(`  - Renter: renter@test.com`);
    console.log(`  - Broker: broker@test.com`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    process.exit(1);
  }
};

createTestData();

