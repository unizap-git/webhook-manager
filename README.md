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