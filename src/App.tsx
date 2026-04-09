import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ResetPassword from './components/ResetPassword';
import PublicIssueView from './components/PublicIssueView';

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
  const navigate = useNavigate();

  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-accent">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace /> : <Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/dashboard" element={<ProtectedRoute reqRole="user"><UserDashboard /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute reqRole="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/issue/:id" element={<PublicIssueView />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
