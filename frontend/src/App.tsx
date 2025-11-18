import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import VendorsPage from './pages/VendorsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import ChildAccountsPage from './pages/ChildAccountsPage';

// Layout
import Layout from './components/Layout';

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Parent-only Route component
const ParentOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore((state) => state);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (user?.accountType === 'CHILD') {
    return <Navigate to="/analytics" replace />;
  }
  
  return <>{children}</>;
};

// Public Route component (redirect if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore((state) => state);
  
  if (isAuthenticated) {
    // Redirect child accounts to analytics, parent accounts to dashboard
    if (user?.accountType === 'CHILD') {
      return <Navigate to="/analytics" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  const { user } = useAuthStore();

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route 
          index 
          element={
            user?.accountType === 'CHILD' 
              ? <Navigate to="/analytics" replace /> 
              : <Navigate to="/dashboard" replace />
          } 
        />
        {/* Parent-only routes */}
        <Route 
          path="dashboard" 
          element={
            <ParentOnlyRoute>
              <DashboardPage />
            </ParentOnlyRoute>
          } 
        />
        <Route 
          path="projects" 
          element={
            <ParentOnlyRoute>
              <ProjectsPage />
            </ParentOnlyRoute>
          } 
        />
        <Route 
          path="vendors" 
          element={
            <ParentOnlyRoute>
              <VendorsPage />
            </ParentOnlyRoute>
          } 
        />
        <Route 
          path="child-accounts" 
          element={
            <ParentOnlyRoute>
              <ChildAccountsPage />
            </ParentOnlyRoute>
          } 
        />
        {/* Routes accessible to both parent and child accounts */}
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Catch all route */}
      <Route 
        path="*" 
        element={
          user?.accountType === 'CHILD' 
            ? <Navigate to="/analytics" replace /> 
            : <Navigate to="/dashboard" replace />
        } 
      />
    </Routes>
  );
}

export default App;