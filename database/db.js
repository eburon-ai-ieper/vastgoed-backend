import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, 'vastgoed.db');

// Ensure database directory exists
const dbDir = dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// Save original run method before overriding
const originalRun = db.run.bind(db);

// Promisify database methods
db.get = promisify(db.get.bind(db));
db.all = promisify(db.all.bind(db));

// Custom run method that returns lastID
db.run = function(sql, params = []) {
  return new Promise((resolve, reject) => {
    originalRun(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

// Initialize database schema
export const initDatabase = async () => {
  try {
    // Users table (Renters, Brokers, Home Owners, Contractors)
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('renter', 'broker', 'owner', 'contractor')),
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Properties table
    await db.run(`
      CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL,
        owner_id INTEGER NOT NULL,
        renter_id INTEGER,
        broker_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id),
        FOREIGN KEY (renter_id) REFERENCES users(id),
        FOREIGN KEY (broker_id) REFERENCES users(id)
      )
    `);

    // Maintenance requests table
    await db.run(`
      CREATE TABLE IF NOT EXISTS maintenance_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL,
        renter_id INTEGER NOT NULL,
        broker_id INTEGER NOT NULL,
        owner_id INTEGER NOT NULL,
        contractor_id INTEGER,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'notified_owner', 'contractor_selected', 'scheduled', 'in_progress', 'completed', 'cancelled')),
        priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties(id),
        FOREIGN KEY (renter_id) REFERENCES users(id),
        FOREIGN KEY (broker_id) REFERENCES users(id),
        FOREIGN KEY (owner_id) REFERENCES users(id),
        FOREIGN KEY (contractor_id) REFERENCES users(id)
      )
    `);

    // Contractors (partners) table
    await db.run(`
      CREATE TABLE IF NOT EXISTS contractors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        company_name TEXT,
        specialties TEXT, -- JSON array of specialties
        rating REAL DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Schedule/Appointments table
    await db.run(`
      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        maintenance_request_id INTEGER NOT NULL,
        contractor_id INTEGER NOT NULL,
        renter_id INTEGER NOT NULL,
        scheduled_date DATETIME NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled')),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
        FOREIGN KEY (contractor_id) REFERENCES users(id),
        FOREIGN KEY (renter_id) REFERENCES users(id)
      )
    `);

    // Notifications table
    await db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        related_request_id INTEGER,
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (related_request_id) REFERENCES maintenance_requests(id)
      )
    `);

    // Workflow log (for tracking automation steps)
    await db.run(`
      CREATE TABLE IF NOT EXISTS workflow_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        maintenance_request_id INTEGER NOT NULL,
        step TEXT NOT NULL,
        actor_id INTEGER,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id),
        FOREIGN KEY (actor_id) REFERENCES users(id)
      )
    `);

    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};

export default db;

