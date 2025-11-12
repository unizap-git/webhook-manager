export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  slug: string;
}

export interface Channel {
  id: string;
  type: string;
  name: string;
}

export interface UserVendorChannel {
  id: string;
  userId: string;
  vendorId: string;
  channelId: string;
  webhookUrl: string;
  isActive: boolean;
  createdAt: string;
  vendor: Vendor;
  channel: Channel;
}

export interface Message {
  id: string;
  recipient: string;
  messageId: string;
  vendor: string;
  channel: string;
  status: string;
  reason?: string;
  createdAt: string;
  lastEventAt?: string;
}

export interface DashboardStats {
  summary: {
    totalMessages: number;
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    totalFailed: number;
    deliveryRate: number;
    readRate: number;
    failureRate: number;
  };
  dailyStats: Array<{
    date: string;
    totalMessages: number;
    successRate: number;
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    totalFailed: number;
  }>;
  vendorStats: Array<{
    vendorId: string;
    vendorName: string;
    totalMessages: number;
    successRate: number;
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    totalFailed: number;
  }>;
  period: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface ApiError {
  error: string;
  details?: any[];
}