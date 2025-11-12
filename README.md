# 🧩 Communication Analytics SaaS Platform

A modern, lightweight SaaS application for tracking success and failure analysis of communications sent via Email, WhatsApp, and SMS.

## 🚀 Features

- **Multi-vendor Support**: SendGrid, Karix, AiSensy, Msg91
- **Multi-channel Tracking**: Email, WhatsApp, SMS
- **Real-time Analytics**: Success rates, delivery tracking, failure analysis
- **Webhook Integration**: Unique webhook URLs for each vendor-channel combination
- **Modern Dashboard**: Material Design UI with charts and real-time updates
- **Scalable Architecture**: Redis queue processing, PostgreSQL storage

## 🏗️ Tech Stack

### Backend
- **Language**: TypeScript
- **Framework**: Node.js + Express.js
- **Database**: PostgreSQL (SQLite for development)
- **ORM**: Prisma
- **Cache/Queue**: Redis + BullMQ
- **Authentication**: JWT (Access + Refresh tokens)

### Frontend
- **Framework**: React + Vite
- **UI Library**: Material UI (MUI)
- **Charts**: Recharts
- **State Management**: Zustand
- **Routing**: React Router v7

## 🚦 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (or SQLite for dev)
- Redis

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd webhook
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

4. Setup environment variables
```bash
# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

5. Setup database
```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

6. Start development servers

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

## 📁 Project Structure

```
├── backend/           # Node.js + Express.js backend
│   ├── src/
│   │   ├── config/    # Configuration files
│   │   ├── routes/    # API routes
│   │   ├── controllers/ # Route handlers
│   │   ├── services/  # Business logic
│   │   ├── workers/   # Background job processors
│   │   ├── middleware/ # Custom middleware
│   │   └── utils/     # Utility functions
│   └── prisma/        # Database schema and migrations
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── pages/     # Page components
│   │   ├── components/ # Reusable UI components
│   │   ├── hooks/     # Custom React hooks
│   │   ├── store/     # State management
│   │   ├── api/       # API client functions
│   │   └── theme/     # MUI theme configuration
└── docs/              # Project documentation
```

## 🔧 Development

### API Endpoints

- `POST /auth/signup` - User registration
- `POST /auth/login` - User authentication
- `GET /vendors` - List supported vendors
- `GET /channels` - List supported channels
- `POST /webhook/:userId/:vendor/:channel` - Webhook receiver
- `GET /analytics` - Get analytics data

### Webhook URL Format

```
https://your-app.com/webhook/{userId}/{vendor}/{channel}
```

Example:
```
https://your-app.com/webhook/123/sendgrid/email
https://your-app.com/webhook/123/msg91/sms
```

## 🚀 Deployment

The application is designed to be deployed on modern cloud platforms:

- **Backend**: Render, Railway, or Fly.io
- **Database**: Supabase or Neon.tech
- **Redis**: Upstash or Redis Cloud
- **Frontend**: Vercel or Netlify

## 📊 Analytics Features

- Total messages sent/delivered/read/failed
- Success rate trends (daily/weekly/monthly)
- Vendor and channel performance comparison
- Failure reason breakdown
- Real-time dashboard updates

## 🔒 Security

- JWT-based authentication with refresh tokens
- Input validation and sanitization
- Rate limiting on API endpoints
- Secure webhook payload validation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.