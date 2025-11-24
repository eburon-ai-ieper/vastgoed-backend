# Vastgoed & Partners - Backend API

Property Management System Backend - Automates maintenance request workflow between renters, brokers, owners, and contractors.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- SQLite3 (included with Node.js)

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production
DB_PATH=./database/vastgoed.db
NODE_ENV=development
```

### Initialize Database

```bash
npm run init-db
```

### Create Demo Data (Optional)

```bash
npm run create-demo-data
```

### Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will run on http://localhost:3001

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### Maintenance Requests
- `GET /api/maintenance` - Get all requests (filtered by role)
- `POST /api/maintenance` - Create new request (renter)
- `GET /api/maintenance/:id` - Get request details
- `POST /api/maintenance/:id/notify-owner` - Notify owner (broker)
- `POST /api/maintenance/:id/select-contractor` - Select contractor (owner)
- `POST /api/maintenance/:id/schedule` - Schedule appointment (broker)

### Contractors
- `GET /api/contractors` - Get all active contractors
- `GET /api/contractors/:id` - Get contractor details

### Properties
- `GET /api/properties` - Get properties (filtered by role)
- `POST /api/properties` - Create property

## 🗄️ Database Schema

- `users` - All users (renters, brokers, owners, contractors)
- `properties` - Property listings
- `maintenance_requests` - Maintenance requests with status tracking
- `contractors` - Contractor profiles and specialties
- `schedules` - Appointment scheduling
- `notifications` - User notifications
- `workflow_logs` - Audit trail of workflow steps

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite3
- **Authentication**: JWT
- **Password Hashing**: bcryptjs

## 📝 Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run init-db` - Initialize database schema
- `npm run create-demo-data` - Create demo data for testing

## 📄 License

ISC

