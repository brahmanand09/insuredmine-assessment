# InsuredMine Technical Assessment Solution (Node.js & MongoDB)

A robust, production-ready Node.js backend application built with Express and MongoDB to handle high-performance policy data ingestion, user policy search and aggregations, real-time server CPU utilization monitoring with automatic restart, and a scheduled message posting service.

---

## 🚀 Features & Completed Tasks

### Task 1: Policy Data Management & Ingestion
1. **Worker Threads Data Ingestion API (`POST /api/policies/upload`)**:
   - Parses attached `.xlsx` / `.csv` data asynchronously using Node.js `worker_threads`.
   - Avoids main event-loop blocking during large file processing.
2. **Policy Search API (`GET /api/policies/search?username=...`)**:
   - Finds policy info by searching username / firstname.
   - Returns user details along with populated collection references.
3. **Aggregated Policy by User API (`GET /api/policies/aggregated`)**:
   - Uses MongoDB Aggregation Framework to group policies per user, computing total policy count, total premium written, category count, and carrier breakdown.
4. **6 Separate MongoDB Collections Architecture**:
   - **Agent**: Agent Name
   - **User**: firstname, DOB, address, phone, state, zip, email, gender, userType
   - **UserAccount**: account_name, userId
   - **PolicyCategory (LOB)**: category_name
   - **PolicyCarrier**: company_name
   - **Policy**: policy_number, policy_start_date, policy_end_date, category_id, company_id, user_id, account_id, agent_id, premium_amount

### Task 2: Server Monitor & Scheduled Post Service
1. **Real-time Server CPU Monitoring & Auto-Restart (`GET /api/system/cpu`)**:
   - Continuously tracks CPU utilization % of the Node.js server.
   - Automatically logs an alert and triggers a server restart when CPU usage hits or exceeds **70%**.
   - Includes a simulation API (`POST /api/system/simulate-cpu-spike`) for easy testing.
2. **Scheduled Message Post Service (`POST /api/messages/schedule`)**:
   - Accepts `message`, `day`, and `time` parameters in the body.
   - Schedules DB insertion of the message into MongoDB at that exact specified day & time using `node-schedule`.
   - Automatically restores pending scheduled jobs across server restarts.

---

## 🛠️ Technology Stack
- **Language**: JavaScript (Node.js v24+)
- **Framework**: Express.js
- **Database**: MongoDB & Mongoose
- **Concurrency**: Node.js `worker_threads`
- **Scheduler**: `node-schedule`
- **CPU Tracking**: `pidusage`
- **File Parsing**: `xlsx`, `multer`

---

## 📥 Setup & Installation Instructions

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) (running locally at `mongodb://localhost:27017` or MongoDB Atlas URI)

### 2. Installation
```bash
# Clone the repository
git clone <YOUR_GITHUB_REPO_URL>
cd InsuredMine

# Install dependencies
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (already included):
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/insuredmine_db
```

### 4. Run the Server
```bash
# Start server
npm start
```
The server will run at: `http://localhost:3000`
Web Dashboard will be accessible at: `http://localhost:3000`

---

## 🧪 Running Automated Tests

An automated test script is provided to verify all APIs and database collections end-to-end:

```bash
# Run server in one terminal:
npm start

# Run end-to-end test in another terminal:
npm test
```

---

## 📑 API Reference Documentation

### Task 1 APIs

#### 1. Ingest Data File (Worker Threads)
- **Endpoint**: `POST /api/policies/upload`
- **Body**: `multipart/form-data` with field `file` (Upload `.xlsx` or `.csv`).

#### 2. Search Policy by Username
- **Endpoint**: `GET /api/policies/search?username=Lura Lucca`
- **Response**: User object and list of policies populated with Category, Carrier, Agent, and Account references.

#### 3. Get Aggregated Policies by User
- **Endpoint**: `GET /api/policies/aggregated`
- **Response**: Array of users with `totalPolicies`, `totalPremiumAmount`, policy numbers list, and LOB counts.

---

### Task 2 APIs

#### 1. Real-time Server CPU Metrics
- **Endpoint**: `GET /api/system/cpu`
- **Response**: `{ currentCpuPercentage, thresholdPercentage: 70, status: "NORMAL" | "EXCEEDED_THRESHOLD" }`

#### 2. Simulate CPU Spike (>70% Auto-Restart Test)
- **Endpoint**: `POST /api/system/simulate-cpu-spike`
- **Body**: `{ "durationMs": 6000 }`

#### 3. Schedule Message Post
- **Endpoint**: `POST /api/messages/schedule`
- **Body**:
```json
{
  "message": "Policy Renewal Reminder",
  "day": "tomorrow",
  "time": "14:30"
}
```

---

## 💻 Interactive Admin Web Dashboard

Open `http://localhost:3000` in your web browser to test all features visually via a modern glassmorphic interface!

---

## 📤 Instructions for Uploading to GitHub & Sharing Access

1. Create a new repository on GitHub (e.g. `insuredmine-technical-assessment`).
2. Initialize git and commit files:
   ```bash
   git init
   git add .
   git commit -m "Complete InsuredMine technical assessment submission"
   ```
3. Push to your GitHub repository:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<your-username>/insuredmine-technical-assessment.git
   git push -u origin main
   ```
4. Share access:
   - Go to your GitHub repository -> **Settings** -> **Collaborators**.
   - Click **Add people** and enter the InsuredMine reviewer GitHub usernames or emails provided.
