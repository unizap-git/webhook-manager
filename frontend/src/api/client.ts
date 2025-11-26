import axios, { AxiosResponse } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Create axios instance with default timeout
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create analytics API client with longer timeout for heavy queries
export const analyticsApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds for analytics endpoints
  headers: {
    'Content-Type': 'application/json',
  },
});

// Setup interceptors for both clients
const setupInterceptors = (client: typeof api) => {
  // Request interceptor to add auth token
  client.interceptors.request.use(
    (config) => {
      const token = useAuthStore.getState().token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor to handle auth errors
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        // Token is invalid or expired, logout user
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );
};

// Apply interceptors to both clients
setupInterceptors(api);
setupInterceptors(analyticsApi);

// Wrapper function for making API calls
export const apiCall = async <T>(
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  data?: any
): Promise<T> => {
  try {
    // Use analyticsApi for analytics endpoints (longer timeout), otherwise use default api
    const client = url.includes('/analytics/') ? analyticsApi : api;
    const response: AxiosResponse<T> = await client[method](url, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};