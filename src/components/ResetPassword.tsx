import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Lock, KeyRound } from 'lucide-react';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return;
    
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    
    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      
    } catch (error: any) {
      setErrorMsg(error.message || 'Invalid or expired reset link. Please request a new one.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle at 20% 40%, rgba(0, 212, 170, 0.4) 0%, transparent 40%), radial-gradient(circle at 80% 60%, rgba(16, 185, 129, 0.4) 0%, transparent 40%)' }} />
             
        <div className="glass-card w-full max-w-md p-8 relative z-10 animate-drop text-center space-y-4">
          <div className="w-16 h-16 bg-accent/20 text-accent rounded-full flex items-center justify-center mx-auto mb-4 border border-accent/30">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold font-heading text-white">Password Updated!</h2>
          <p className="text-white/60 font-body pb-4">Your password has been changed successfully. Redirecting you to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 20% 40%, rgba(0, 212, 170, 0.4) 0%, transparent 40%), radial-gradient(circle at 80% 60%, rgba(16, 185, 129, 0.4) 0%, transparent 40%)' }} />
      
      <div className="glass-card w-full max-w-md p-8 relative z-10 animate-drop">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/20 flex flex-center items-center justify-center border border-accent/50">
            <KeyRound className="text-accent w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-white">Reset Password</h1>
            <p className="text-white/60 text-sm font-body">Create a new, strong password</p>
          </div>
        </div>

        <form onSubmit={handleReset} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80 uppercase tracking-widest text-xs">New Password</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors font-mono"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80 uppercase tracking-widest text-xs">Confirm New Password</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors font-mono"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {errorMsg && (
            <div className="text-sm font-mono p-3 rounded border text-red-400 bg-red-400/10 border-red-400/20">
              <p>{errorMsg}</p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-accent hover:bg-accent/80 text-background font-bold py-3 px-4 rounded-lg flex flex-center items-center justify-center gap-2 transition-all disabled:opacity-50 mt-4"
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
            <Lock size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
