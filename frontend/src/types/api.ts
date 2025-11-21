export interface User {
  id: string;
  name: string;
  email: string;
  accountType: 'PARENT' | 'CHILD';
  parentId?: string;
  parent?: {
    id: string;
    email: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChildAccount {
  id: string;
  email: string;
  name: string;
  accountType: 'CHILD';
  createdAt: string;
  password?: string; // Only included when creating new child account
  projectAccess?: Array<{
    projectId: string;
    accessType: string;
    project: {
      id: string;
      name: string;
    };
  }>;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

export interface CreateChildAccountResponse {
  success: boolean;
  message: string;
  childAccount: ChildAccount;
}

export interface GetChildAccountsResponse {
  success: boolean;
  childAccounts: ChildAccount[];
}

export interface Vendor {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  type: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    userVendorChannels: number;
    messages: number;
    projectAccess: number;
  };
  projectAccess?: Array<{
    userId: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
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
  project?: {
    id: string;
    name: string;
  };
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

export interface ProfileResponse {
  user: {
    id: string;
    name: string;
    email: string;
    accountType: 'PARENT' | 'CHILD';
    createdAt: string;
    updatedAt: string;
    parent?: {
      id: string;
      email: string;
      name: string;
    };
  };
  stats: {
    totalMessages: number;
    activeConfigurations: number;
    projectsCount: number;
    childAccountsCount: number;
    successRate: number;
    avgDailyMessages: number;
  };
  usageTrends: Array<{
    date: string;
    count: number;
  }>;
  recentActivity: Array<{
    id: string;
    recipient: string;
    vendor: string;
    channel: string;
    status: string;
    timestamp: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    _count: {
      userVendorChannels: number;
      messages: number;
    };
  }>;
  topVendors: Array<{
    vendorId: string;
    vendorName: string;
    messageCount: number;
  }>;
  childAccounts?: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
    updatedAt: string;
    _count: {
      projectAccess: number;
    };
  }>;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}