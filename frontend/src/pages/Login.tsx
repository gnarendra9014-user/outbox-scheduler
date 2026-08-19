import { useState } from 'react';
import { Mail, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/api/auth/google`;
  };

  const handleDemoLogin = async () => {
    setIsDemoLoading(true);
    try {
      const response = await api.post('/auth/demo');
      login(response.data.token);
      toast.success('Logged in as Demo User!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error('Failed to log in with demo account');
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-dark-950">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-3xl" />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="glass-card p-8 shadow-2xl shadow-dark-950/50">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-xl shadow-primary-500/30 mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Welcome to <span className="gradient-text">Outbox</span>
            </h1>
            <p className="text-dark-400 text-sm mt-2 text-center">
              Schedule and manage your email campaigns with precision
            </p>
          </div>

          <div className="space-y-3">
            {/* Google Sign In */}
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 px-5 py-3 bg-white rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-lg"
            >
              {/* Google Icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>

            {/* Quick Demo Login */}
            <button
              onClick={handleDemoLogin}
              disabled={isDemoLoading}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-dark-700/80 hover:bg-dark-600/80 border border-dark-600/50 text-dark-200 hover:text-white rounded-lg font-medium transition-all duration-200"
            >
              <Sparkles className="w-4 h-4 text-primary-400" />
              {isDemoLoading ? 'Signing in...' : 'Quick Demo Login (Instant Access)'}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-dark-700/50" />
            <span className="text-xs text-dark-500">powered by</span>
            <div className="flex-1 h-px bg-dark-700/50" />
          </div>

          {/* Features */}
          <div className="space-y-3">
            {[
              'Schedule emails for specific times',
              'Upload CSV files with leads',
              'Smart rate limiting & throttling',
              'Track sent & scheduled emails',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-dark-400">
                <ArrowRight className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                {feature}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-dark-500 mt-4">
          By signing in, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
