import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { MapPin, ArrowRight, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showResend, setShowResend] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!isForgotPassword && !password) return;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    setShowResend(false);
    
    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'http://https://nagarseva-mumbai.vercel.app/reset-password',
        });
        if (error) throw error;
        setSuccessMsg('Password reset link sent — check your inbox');
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message === 'Email not confirmed') {
            setErrorMsg('Please check your inbox and confirm your email before signing in, or contact admin if you did not receive the email.');
            setShowResend(true);
            return;
          }
          throw error;
        }
        
        // Immediately query admin_emails fresh after session confirmation
        const { data: adminData } = await supabase
          .from('admin_emails')
          .select('*')
          .eq('email', email)
          .single();
          
        if (adminData) {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data?.user?.identities && data.user.identities.length === 0) {
          setErrorMsg('An account with this email already exists. Please sign in.');
          return;
        }
        
        setErrorMsg('If account created, you might be logged in. If you have email confirmations enabled, please check your email.');
      }
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      setErrorMsg('Confirmation email resent. Please check your inbox.');
      setShowResend(false);
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Abstract Map Background Simulation */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 20% 40%, rgba(0, 212, 170, 0.4) 0%, transparent 40%), radial-gradient(circle at 80% 60%, rgba(16, 185, 129, 0.4) 0%, transparent 40%)' }} />
      
      <div className="glass-card w-full max-w-md p-8 relative z-10 animate-drop">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/20 flex flex-center items-center justify-center border border-accent/50">
            <MapPin className="text-accent w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-heading text-white">NagarSeva</h1>
            <p className="text-white/60 text-sm font-body">Citizen Issue Reporting Portal</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80 uppercase tracking-widest text-xs">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors font-mono"
              placeholder="user@example.com"
              required
            />
          </div>
          
          {!isForgotPassword && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80 uppercase tracking-widest text-xs">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors font-mono"
                placeholder="••••••••"
                required
                minLength={6}
              />
              {isLogin && (
                <div className="text-right">
                  <button 
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setErrorMsg(''); setSuccessMsg(''); setShowResend(false); }}
                    className="text-xs text-accent hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className={`text-sm font-mono p-3 rounded border ${showResend || errorMsg.toLowerCase().includes('already exists') || errorMsg.includes('Invalid') ? 'text-red-400 bg-red-400/10 border-red-400/20' : 'text-accent bg-accent/10 border-accent/20'}`}>
              <p>{errorMsg}</p>
              {showResend && (
                <button 
                  type="button" 
                  onClick={handleResend}
                  disabled={isSubmitting}
                  className="mt-3 w-full bg-red-400/20 hover:bg-red-400/30 text-white py-2 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Mail size={16} /> Resend Confirmation Email
                </button>
              )}
            </div>
          )}

          {successMsg && (
            <div className="text-sm font-mono p-3 rounded border text-accent bg-accent/10 border-accent/20">
              <p>{successMsg}</p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-accent hover:bg-accent/80 text-background font-bold py-3 px-4 rounded-lg flex flex-center items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : (
              isForgotPassword ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Sign Up')
            )}
            {!isSubmitting && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/10 pt-6 text-sm text-white/60 flex flex-col gap-2">
          {isForgotPassword ? (
            <button 
              type="button" 
              onClick={() => { setIsForgotPassword(false); setErrorMsg(''); setSuccessMsg(''); }}
              className="hover:text-accent font-bold transition-colors"
            >
              Back to Sign In
            </button>
          ) : (
            <button 
              type="button" 
              onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); setSuccessMsg(''); setShowResend(false); }}
              className="hover:text-accent font-bold transition-colors"
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

