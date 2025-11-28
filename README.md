# Communication Analytics SaaS Platform

A comprehensive full-stack communication analytics platform that processes webhooks from multiple vendors (MSG91, AiSensy, SendGrid) and provides real-time analytics, child account management, and project-based access control.

## 🚀 Features

- **Multi-Vendor Webhook Processing**: Support for MSG91, AiSensy (WhatsApp), and SendGrid
- **Real-time Analytics**: Success rates, delivery tracking, failure analysis
- **Child Account Management**: Create and manage child accounts with project-specific access
- **Project-based Access Control**: Organize communications by projects
- **Webhook Security**: Signature verification and token-based authentication
- **Responsive Dashboard**: Material-UI with analytics visualization
- **Database Management**: SQLite with Prisma ORM

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: SQLite with Prisma ORM
- **Authentication**: JWT tokens
- **Queue**: Redis (optional, falls back to direct processing)
- **Validation**: Zod schemas
- **Logging**: Winston with custom formatters

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI)
- **State Management**: Zustand
- **Form Handling**: React Hook Form with Zod validation
- **HTTP Client**: Axios
- **Build Tool**: Vite

## 📦 Project Structure

```
webhook-manager/
├── backend/                 # TypeScript backend
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Auth, validation, error handling
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Utility functions
│   │   └── config/          # Database & environment config
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.ts          # Seed data
│   └── package.json
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Route pages
│   │   ├── services/        # API client
│   │   └── types/           # TypeScript interfaces
│   └── package.json
└── README.md
```

## 🚀 Deployment on Render

### Prerequisites
1. **GitHub Account**: Code must be in a GitHub repository
2. **Render Account**: Sign up at [render.com](https://render.com)

### Step 1: Deploy Backend

1. **Create New Web Service**
   - Go to Render Dashboard → "New" → "Web Service"
   - Connect your GitHub repository: `https://github.com/unizap-git/webhook-manager.git`

2. **Backend Configuration**
   ```
   Name: webhook-analytics-backend
   Environment: Node
   Region: Choose your preferred region
   Branch: main
   Root Directory: backend
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

3. **Environment Variables**
   Add these environment variables in Render:
   ```
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=file:./prod.db
   JWT_SECRET=your-super-secure-jwt-secret-change-this-in-production
   REDIS_URL=redis://localhost:6379
   CORS_ORIGIN=https://your-frontend-url.onrender.com
   WEBHOOK_BASE_URL=https://your-backend-url.onrender.com
   ```

4. **Advanced Settings**
   ```
   Auto-Deploy: Yes
   Health Check Path: /health
   ```

### Step 2: Deploy Frontend

1. **Create New Static Site**
   - Go to Render Dashboard → "New" → "Static Site"
   - Connect the same GitHub repository

2. **Frontend Configuration**
   ```
   Name: webhook-analytics-frontend
   Branch: main
   Root Directory: frontend
   Build Command: npm install && npm run build
   Publish Directory: dist
   ```

3. **Environment Variables**
   Add this environment variable:
   ```
   VITE_API_BASE_URL=https://your-backend-url.onrender.com/api
   ```

**Note**: If you encounter TypeScript compilation errors during deployment, they have been fixed in the latest codebase. Ensure you're deploying from the latest commit.

### Step 3: Update CORS Configuration

After both deployments are complete:

1. **Get your frontend URL** from Render (e.g., `https://webhook-analytics-frontend.onrender.com`)
2. **Update backend environment variables**:
   ```
   CORS_ORIGIN=https://your-frontend-url.onrender.com
   ```

### Step 4: Database Setup

The application will automatically:
1. Create SQLite database file
2. Run Prisma migrations
3. Seed initial data (vendors and channels)

### Step 5: Redis Configuration (Optional)

For background job processing:

1. **Create Redis Service**
   - Go to Render Dashboard → "New" → "Redis"
   - Note the Redis URL

2. **Update Backend Environment**
   ```
   REDIS_URL=your-redis-internal-url-from-render
   ```

If Redis is not configured, the application falls back to direct webhook processing.

## 🔧 Local Development

### Prerequisites
- Node.js 18+ and npm
- Git

### Backend Setup

```bash
# Clone repository
git clone https://github.com/unizap-git/webhook-manager.git
cd webhook-manager/backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Setup database
npx prisma generate
npx prisma db push
npx prisma db seed

# Start development server
npm run dev
```

### Frontend Setup

```bash
# In a new terminal
cd webhook-manager/frontend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with backend URL

# Start development server
npm run dev
```

### Access Application
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000
- **API Health**: http://localhost:3000/health

## 📡 Webhook Configuration

### Supported Vendors

#### 1. MSG91 (SMS)
- **Webhook URL**: `https://your-backend-url.onrender.com/api/webhook/{project}/{vendor}/sms?token={token}`
- **Method**: POST
- **Vendor**: msg91

#### 2. AiSensy (WhatsApp)
- **Webhook URL**: `https://your-backend-url.onrender.com/api/webhook/{project}/{vendor}/whatsapp?token={token}`
- **Method**: POST
- **Vendor**: aisensy
- **Security**: Supports HMAC-SHA256 signature verification
- **Header**: `X-AiSensy-Signature`

#### 3. SendGrid (Email)
- **Webhook URL**: `https://your-backend-url.onrender.com/api/webhook/{project}/{vendor}/email?token={token}`
- **Method**: POST
- **Vendor**: sendgrid

### Webhook URL Format
```
https://your-backend-url.onrender.com/api/webhook/{project-name}/{vendor-slug}/{channel-type}?token={webhook-token}
```

Where:
- `{project-name}`: Your project name (e.g., "My Project")
- `{vendor-slug}`: Vendor identifier (msg91, aisensy, sendgrid)
- `{channel-type}`: Communication channel (sms, whatsapp, email)
- `{webhook-token}`: Security token generated by the application

## 📤 Outbound Message Logging

Track the complete lifecycle of messages by logging outbound messages sent via vendor APIs. This enables matching webhook delivery events with the original messages you sent.

### Why Use Outbound Logging?

1. **Complete Message Lifecycle**: Track messages from send to delivery/read
2. **Vendor Reference Matching**: Match webhook events using `vendorRefId` (requestId, sg_message_id, etc.)
3. **Analytics Integration**: Get accurate delivery rates and timing metrics
4. **Debugging**: Trace message issues end-to-end

### API Endpoints

All endpoints require Bearer token authentication.

#### 1. Log Single Outbound Message

```http
POST /api/outbound
Content-Type: application/json
Authorization: Bearer {your-jwt-token}

{
  "projectId": "clx1234567890",
  "vendorId": "clx0987654321",
  "channelId": "clxabcdef123",
  "vendorRefId": "347424e75077306b3673",
  "recipient": "+919876543210",
  "content": "Your OTP is 5678",
  "sentAt": "2024-01-15T10:30:00Z"  // optional, defaults to now
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Outbound message logged successfully",
  "data": {
    "id": "clx...",
    "vendorRefId": "347424e75077306b3673",
    "recipient": "+919876543210",
    "project": { "name": "My Project" },
    "vendor": { "name": "MSG91", "slug": "msg91" },
    "channel": { "name": "SMS", "type": "sms" }
  }
}
```

#### 2. Batch Log Multiple Messages

```http
POST /api/outbound/batch
Content-Type: application/json
Authorization: Bearer {your-jwt-token}

{
  "messages": [
    {
      "projectId": "clx123",
      "vendorId": "clx456",
      "channelId": "clx789",
      "vendorRefId": "req-001",
      "recipient": "+919876543210",
      "content": "Message 1"
    },
    {
      "projectId": "clx123",
      "vendorId": "clx456",
      "channelId": "clx789",
      "vendorRefId": "req-002",
      "recipient": "+919876543211",
      "content": "Message 2"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Batch processing complete",
  "results": {
    "success": 2,
    "failed": 0,
    "errors": []
  }
}
```

**Note:** Maximum 100 messages per batch.

#### 3. Get Outbound Messages

```http
GET /api/outbound?projectId=clx123&page=1&limit=20
Authorization: Bearer {your-jwt-token}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | string | Filter by project |
| vendorId | string | Filter by vendor |
| channelId | string | Filter by channel |
| startDate | ISO date | Filter from date |
| endDate | ISO date | Filter to date |
| page | integer | Page number (default: 1) |
| limit | integer | Items per page (default: 20, max: 100) |

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### 4. Get Message Lifecycle

Track complete message journey from send to delivery:

```http
GET /api/outbound/{vendorRefId}/lifecycle
Authorization: Bearer {your-jwt-token}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "vendorRefId": "347424e75077306b3673",
    "outboundMessage": {
      "id": "clx...",
      "recipient": "+919876543210",
      "content": "Your OTP is 5678",
      "sentAt": "2024-01-15T10:30:00Z"
    },
    "webhookEvents": [
      {
        "status": "sent",
        "timestamp": "2024-01-15T10:30:01Z"
      },
      {
        "status": "delivered",
        "timestamp": "2024-01-15T10:30:05Z"
      }
    ],
    "timeline": [
      { "type": "outbound", "status": "logged", "timestamp": "2024-01-15T10:30:00Z" },
      { "type": "webhook", "status": "sent", "timestamp": "2024-01-15T10:30:01Z" },
      { "type": "webhook", "status": "delivered", "timestamp": "2024-01-15T10:30:05Z" }
    ],
    "currentStatus": "delivered",
    "totalEvents": 2
  }
}
```

#### 5. Delete Outbound Message

```http
DELETE /api/outbound/{id}
Authorization: Bearer {your-jwt-token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Outbound message deleted"
}
```

### Integration Example

After sending a message via vendor API, log it to WebHook Hub:

```javascript
// 1. Send message via MSG91
const msg91Response = await axios.post('https://api.msg91.com/api/v5/flow/', {
  flow_id: 'your_flow_id',
  mobiles: '919876543210',
  // ... other params
});

// 2. Log to WebHook Hub for lifecycle tracking
await axios.post('https://your-backend-url.onrender.com/api/outbound', {
  projectId: 'your-project-id',
  vendorId: 'msg91-vendor-id',
  channelId: 'sms-channel-id',
  vendorRefId: msg91Response.data.requestId,  // MSG91 returns requestId
  recipient: '+919876543210',
  content: 'Your OTP message'
}, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// 3. Later, check message lifecycle
const lifecycle = await axios.get(
  `https://your-backend-url.onrender.com/api/outbound/${msg91Response.data.requestId}/lifecycle`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);
console.log('Current status:', lifecycle.data.data.currentStatus);
```

### Vendor Reference ID Mapping

| Vendor | Channel | Reference Field |
|--------|---------|-----------------|
| MSG91 | SMS/WhatsApp | `requestId` |
| SendGrid | Email | `sg_message_id` |
| AiSensy | WhatsApp | `messageId` |
| Karix | SMS/WhatsApp | `uid` |

## 👥 User Management

### Account Types

1. **Parent Account**
   - Full platform access
   - Can create child accounts
   - Manages projects and configurations
   - Access to all analytics

2. **Child Account**
   - Analytics-only access
   - Project-specific permissions
   - Cannot manage configurations
   - View parent's data within assigned projects

### Creating Child Accounts

1. Login as parent account
2. Go to "Child Accounts" page
3. Click "Create Child Account"
4. Enter email, name (optional)
5. Select projects for access
6. Optionally add webhook secret (for AiSensy)
7. Account created with auto-generated password

## 📊 Analytics Features

### Dashboard Overview
- Total messages, delivery rates, read rates
- Vendor performance comparison
- Recent activity trends

### Vendor-Channel Matrix
- Performance breakdown by vendor and channel
- Success rates, delivery rates
- Message volume statistics
- Sent, delivered, read, failed metrics

### Channel Analysis
- Channel-specific performance
- Vendor comparison within channels
- Failure reason analysis
- Daily trends

### Failure Analysis
- Comprehensive failure tracking
- Vendor-channel failure matrix
- Raw webhook payload debugging
- Failure reason categorization

## 🔐 Security Features

- **JWT Authentication**: Secure API access
- **Webhook Signature Verification**: For AiSensy webhooks
- **Token-based Webhook Security**: Prevents unauthorized webhook calls
- **CORS Configuration**: Restricts frontend origins
- **Rate Limiting**: Prevents API abuse
- **Input Validation**: Zod schema validation
- **SQL Injection Protection**: Prisma ORM with prepared statements

## 🐛 Troubleshooting

### Common Issues

#### Backend Issues
1. **Database Connection**: Check if SQLite file is created and accessible
2. **Environment Variables**: Verify all required env vars are set
3. **CORS Errors**: Ensure frontend URL is in CORS_ORIGIN
4. **Webhook Failures**: Check webhook URL format and token

#### Frontend Issues
1. **API Connection**: Verify VITE_API_BASE_URL points to backend
2. **Build Errors**: Ensure all dependencies are installed
3. **Authentication**: Clear localStorage and re-login

### Logs and Monitoring

**Backend Logs** (Render):
- Go to your backend service → "Logs"
- Look for startup messages and error logs

**Health Check**:
- Visit: `https://your-backend-url.onrender.com/health`
- Should return service status and uptime

### Database Management

**View Database** (Local):
```bash
cd backend
npx prisma studio
```

**Reset Database**:
```bash
cd backend
rm dev.db  # or prod.db for production
npx prisma db push
npx prisma db seed
```

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Render logs for error details
3. Ensure all environment variables are correctly set
4. Verify webhook URLs and tokens

## 📄 License

This project is licensed under the MIT License.

---

## 🎉 Deployment Checklist

- [ ] Backend deployed on Render
- [ ] Frontend deployed on Render
- [ ] Environment variables configured
- [ ] CORS origin updated with frontend URL
- [ ] Database initialized and seeded
- [ ] Health check endpoint accessible
- [ ] Webhook URLs tested with vendors
- [ ] User registration and login working
- [ ] Analytics dashboard displaying data

**🚀 Your Communication Analytics Platform is ready!**