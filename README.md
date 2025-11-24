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
- `POST /api/maintenance` - Create new request (renter) - **Requires available times, auto-notifies owner**
- `GET /api/maintenance/:id` - Get request details (includes renter, property, schedule info)
- `POST /api/maintenance/:id/notify-owner` - Notify owner (broker)
- `GET /api/maintenance/select-contractor/:token` - Get contractor selection page (public, token-based)
- `POST /api/maintenance/select-contractor/:token` - Select contractor (public, token-based) - **Notifies all parties**
- `GET /api/maintenance/schedule-appointment/:token` - Get appointment scheduling page (public, token-based)
- `POST /api/maintenance/schedule-appointment/:token` - Schedule appointment (public, token-based) - **Notifies all parties with calendar links**

### Notifications
- `GET /api/notifications` - Get all notifications for current user
- `GET /api/notifications/unread-count` - Get unread notification count
- `PATCH /api/notifications/:id/read` - Mark notification as read
- `PATCH /api/notifications/read-all` - Mark all notifications as read

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
- **Email**: Nodemailer (SMTP) - Supports Mailgun, SendGrid, Gmail, etc.

## 📝 Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run init-db` - Initialize database schema
- `npm run create-demo-data` - Create demo data for testing

## 📧 Email Notifications

The system supports real email delivery via SMTP. Configure in `.env`:

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com
FRONTEND_URL=http://localhost:3000
```

See `MAILGUN_SETUP.md` or `EMAIL_SETUP_GUIDE.md` for detailed setup instructions.

## 🚀 Workflow Features

The system includes **token-based workflow** for secure, email-driven actions:
- ✅ Auto-notify owner when request is created (with selection link)
- ✅ Owner selects contractor via secure token link (no login required)
- ✅ Contractor schedules appointment via secure token link (no login required)
- ✅ Renter can specify flexible availability (specific times, weekdays, weekends)
- ✅ Real-time email notifications to all parties (renter, owner, broker, contractor)
- ✅ Calendar integration (Google Calendar & Outlook) in appointment confirmation emails
- ✅ In-app notification system with badge counts
- ✅ Workflow history tracking for audit trail

## 📄 License

ISC

