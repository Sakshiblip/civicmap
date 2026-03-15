import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Auth from './components/Auth';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';
import ResetPassword from './components/ResetPassword';

function ProtectedRoute({ children, reqRole }: { children: React.ReactNode, reqRole?: 'admin' | 'user' }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center text-accent">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (reqRole && user.role !== reqRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }
  return <>{children}</>;
}

function AppRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-accent">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace /> : <Auth />} />
        <Route path="/reset-password" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace /> : <ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute reqRole="user"><UserDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute reqRole="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;
