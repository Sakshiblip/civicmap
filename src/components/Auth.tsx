import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { MapPin, ArrowRight, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
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
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message === 'Email not confirmed') {
            setErrorMsg('Please check your inbox and confirm your email before signing in, or contact admin if you did not receive the email.');
            setShowResend(true);
            return;
          }
          throw error;
        }

        // Determine user role
        const { data: adminData } = await supabase
          .from('admin_emails')
          .select('*')
          .eq('email', email)
          .single();

        const role = adminData ? 'admin' : 'user';

        // Log the login event
        await supabase.from('login_logs').insert({
          user_id: signInData.user?.id,
          email,
          role,
          logged_in_at: new Date().toISOString()
        });

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Abstract Map Background Simulation */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 20% 40%, rgba(0, 212, 170, 0.4) 0%, transparent 40%), radial-gradient(circle at 80% 60%, rgba(16, 185, 129, 0.4) 0%, transparent 40%)' }} />

      <div className="glass-card w-full max-w-md p-6 sm:p-8 relative z-10 animate-drop mx-auto">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-8 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-accent/20 flex flex-center items-center justify-center border border-accent/50 shadow-lg shadow-accent/10">
            <MapPin className="text-accent w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black font-heading text-white tracking-tighter">NagarSeva</h1>
            <p className="text-white/60 text-xs sm:text-sm font-body uppercase tracking-wider">Citizen Reporting Portal</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] sm:text-xs font-bold text-white/40 uppercase tracking-[0.2em] ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 sm:h-14 bg-surface border border-white/10 rounded-xl px-4 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono text-base"
              placeholder="user@example.com"
              required
            />
          </div>

          {!isForgotPassword && (
            <div className="space-y-2">
              <label className="text-[10px] sm:text-xs font-bold text-white/40 uppercase tracking-[0.2em] ml-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 sm:h-14 bg-surface border border-white/10 rounded-xl px-4 pr-12 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono text-base"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-lg transition-colors text-white/50 hover:text-white"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {isLogin && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setErrorMsg(''); setSuccessMsg(''); setShowResend(false); }}
                    className="text-xs text-accent hover:underline py-2 sm:py-1 px-2"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
              {isLogin && errorMsg && (errorMsg.toLowerCase().includes('invalid') || errorMsg.toLowerCase().includes('credentials')) && (
                <p className="text-red-500 text-xs mt-2 ml-1 animate-in fade-in slide-in-from-top-1">
                  Invalid email or password. Please try again.
                </p>
              )}
            </div>
          )}

          {errorMsg && !((errorMsg.toLowerCase().includes('invalid') || errorMsg.toLowerCase().includes('credentials')) && isLogin) && (
            <div className={`text-sm font-mono p-3 rounded border ${showResend || errorMsg.toLowerCase().includes('already exists') ? 'text-red-400 bg-red-400/10 border-red-400/20' : 'text-accent bg-accent/10 border-accent/20'}`}>
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
            className="w-full h-14 bg-gradient-to-r from-accent to-emerald-400 hover:to-accent text-background font-black rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 text-lg shadow-xl shadow-accent/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin w-5 h-5" />
                {isForgotPassword ? 'Sending...' : (isLogin ? 'Signing in…' : 'Signing Up...')}
              </>
            ) : (
              <>
                {isForgotPassword ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Sign Up')}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
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
              className="min-h-[44px] hover:text-accent font-bold transition-colors"
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

