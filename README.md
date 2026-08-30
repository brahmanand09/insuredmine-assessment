# Insurance Policy Management API (Node.js & MongoDB)

A Node.js backend application built with Express and MongoDB for importing XLSX/CSV data via Worker Threads, managing normalized policy collections, searching policy data, aggregating user policies, tracking real-time CPU utilization with auto-restart, and scheduling persistent messages.

---

## 🚀 Features & Architectural Overview

- **Worker Threads Data Import (`POST /api/import`)**:
  - Asynchronously parses `.xlsx` and `.csv` files off the main event loop using Node.js `worker_threads`.
  - Uses MongoDB `bulkWrite()` with `upsert: true` for bulk ingestion and entity deduplication.
  - Implements strict validation: rows missing required business fields (`email`, `policy_number`, `firstname`, `agent`, `account_name`, `category_name`, `company_name`) are safely skipped and reported in the API response `errors` array. Zero manufactured/fake business data.
  - Automatic cleanup of uploaded temporary files post-ingestion.

- **Policy Search API (`GET /api/policies/search?username=...`)**:
  - Searches policy information by username / firstname.
  - Returns user details along with populated collection references (`Lob`, `Carrier`, `Agent`, `Account`).

- **User Policy Aggregation API (`GET /api/policies/aggregate/users`)**:
  - Leverages MongoDB Aggregation Framework (`$group`, `$lookup`, `$project`, `$sort`) to calculate policy counts and total premium amounts per user.

- **MongoDB Normalized Collection Schemas**:
  - `agents`: Unique `name` index.
  - `users`: Unique `email` index.
  - `accounts`: Unique compound `(name, userId)` index.
  - `lobs`: Unique `name` index (Policy Categories).
  - `carriers`: Unique `name` index (Policy Carriers).
  - `policies`: Unique `policyNumber` index referencing User, Agent, Account, LOB, and Carrier.
  - `scheduled_messages`: Persistent scheduled job log.
  - `messages`: Collection for executed scheduled messages.

- **Real-Time CPU Monitoring & PM2 Auto-Restart**:
  - Continuously monitors server CPU utilization via `pidusage`.
  - Configurable via `CPU_THRESHOLD=70` and `CPU_CHECK_INTERVAL=5000`.
  - Triggers graceful shutdown (`process.exit(1)`) so PM2 (or process restarter) automatically restarts the server upon sustained >70% CPU usage.

- **Atomic Message Scheduler (`POST /api/messages/schedule`)**:
  - Accepts `message`, `day`, and `time` parameters in the body.
  - Validates date & time strictly (e.g. `HH:MM`, `HH:MM AM/PM`). Returns `400 Bad Request` on invalid time formats.
  - Persists scheduled jobs in MongoDB (`scheduled_messages`).
  - Uses atomic job claiming (`findOneAndUpdate` with `status: 'pending' -> 'processing'`) to prevent duplicate execution across multiple app instances.

---

## 📂 Project Directory Structure

```
insuredmine-assessment/
├── src/
│   ├── app.js                    # Express app configuration & middleware
│   ├── server.js                 # Server entry point & DB initialization
│   ├── config/
│   │   └── db.js                 # Mongoose database connection
│   ├── models/
│   │   ├── Agent.js              # agents collection schema
│   │   ├── User.js               # users collection schema
│   │   ├── Account.js            # accounts collection schema
│   │   ├── Lob.js                # lobs collection schema
│   │   ├── Carrier.js            # carriers collection schema
│   │   ├── Policy.js             # policies collection schema
│   │   ├── ScheduledMessage.js   # scheduled_messages collection schema
│   │   └── Message.js            # messages collection schema
│   ├── controllers/
│   │   ├── importController.js   # Handles file upload & worker ingestion
│   │   ├── policyController.js   # Search, Aggregation & Health APIs
│   │   └── messageController.js  # Scheduled post API
│   ├── routes/
│   │   ├── importRoutes.js       # Import Express routes
│   │   ├── policyRoutes.js       # Policy Express routes
│   │   └── messageRoutes.js      # Scheduler Express routes
│   ├── services/
│   │   ├── importService.js      # Ingestion service & worker bridge
│   │   ├── policyService.js      # Policy query & aggregation logic
│   │   ├── schedulerService.js   # Message scheduling & atomic execution
│   │   └── cpuMonitorService.js  # CPU tracking & restart logic
│   ├── workers/
│   │   └── excelWorker.js        # Worker thread with validation & bulkWrite
│   ├── middleware/
│   │   ├── upload.js             # Multer upload middleware with 10MB limit
│   │   └── errorHandler.js       # Centralized Express error handler
│   └── utils/
│       ├── cpuUsage.js           # CPU utilization helper
│       └── logger.js             # Logging utility
├── public/                       # Glassmorphic Admin Web Dashboard
│   ├── index.html
│   └── app.js
├── tests/
│   └── api.test.js               # Isolated test suite (uses .env.test)
├── uploads/                      # Temporary file upload folder (.gitkeep)
├── ecosystem.config.js           # PM2 configuration file
├── .env.example                  # Environment configuration template
├── .gitignore                    # Security-hardened gitignore
├── package.json
├── README.md
└── server.js
```

---

## ⚙️ Installation & Setup Guide

### 1. Prerequisites
- **Node.js** (v18+)
- **MongoDB** (running locally at `mongodb://localhost:27017` or MongoDB Atlas URI)

### 2. Install Dependencies
```bash
git clone https://github.com/brahmanand09/insuredmine-assessment.git
cd insuredmine-assessment
npm install
```

### 3. Environment Variables
Create `.env` file from `.env.example`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/insurance_policy_db
CPU_THRESHOLD=70
CPU_CHECK_INTERVAL=5000
```

### 4. Running the Application

#### Standard Mode:
```bash
npm start
```
Server runs on: `http://localhost:5000`

#### PM2 Mode (Production Recommended):
```bash
# Install PM2 globally if needed
npm install -g pm2

# Start process via PM2
pm2 start ecosystem.config.js

# Monitor PM2 logs
pm2 logs insurance-policy-api
```

---

## 🧪 Running Automated Tests

The test suite runs against an isolated test database (`insurance_policy_test` configured in `.env.test`) to prevent modifying or deleting development/production data:

```bash
npm test
```

---

## 📑 API Endpoint Documentation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/import` | Upload `.xlsx`/`.csv` file for Worker Thread `bulkWrite()` ingestion |
| `GET` | `/api/policies/search?username=Lura` | Search policy info by username |
| `GET` | `/api/policies/aggregate/users` | Aggregate policies by user |
| `POST` | `/api/messages/schedule` | Schedule a message for DB insertion |
| `GET` | `/api/health` | Check server health, uptime & CPU metrics |

---

## 🖥️ Web Admin Dashboard

Open `http://localhost:5000` in your web browser to visually test file imports, search policies, view user aggregations, inspect real-time CPU gauge, and schedule messages!

---

## 📤 Postman API Collection

Import [`InsuredMine_API_Collection.json`](file:///d:/Old%20System/Projects/InsuredMine/InsuredMine_API_Collection.json) into Postman to test all endpoints.
