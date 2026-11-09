import React, { useState } from 'react';
import {
  User as UserIcon,
  Lock,
  Mail,
  Shield,
  CheckCircle2,
  AlertCircle,
  X,
  LogIn,
  UserPlus,
  KeyRound
} from 'lucide-react';
import { api } from '../../api/client';
import { User } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserChange: (user: User | null) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot' | 'profile'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'engineer' | 'operator'>('engineer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);
      const res = await api.login(params);
      localStorage.setItem('chargeguard_token', res.access_token);
      onUserChange(res.user);
      setSuccess(`Signed in successfully as ${res.user.full_name}`);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('username', demoEmail);
      params.append('password', demoPass);
      const res = await api.login(params);
      localStorage.setItem('chargeguard_token', res.access_token);
      onUserChange(res.user);
      setSuccess(`Signed in as ${res.user.full_name} (${res.user.role})`);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Demo sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.register({
        email,
        password,
        full_name: fullName,
        role,
      });
      setSuccess('Account created successfully! Signing you in...');
      // Auto login
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);
      const res = await api.login(params);
      localStorage.setItem('chargeguard_token', res.access_token);
      onUserChange(res.user);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.forgotPassword(email);
      setSuccess(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to submit reset request');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('chargeguard_token');
    onUserChange(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                {currentUser ? 'User Profile & Security' : 'ChargeGuard AI Pro Authentication'}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {currentUser ? currentUser.email : 'Enterprise Telemetry Access'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current User Logged In View */}
        {currentUser ? (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">{currentUser.full_name}</div>
                <div className="text-xs text-slate-400 font-mono">{currentUser.email}</div>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-950 text-cyan-300 border border-cyan-800">
                  <Shield className="w-3 h-3" />
                  <span>{currentUser.role}</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg">
                {currentUser.full_name.charAt(0)}
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Account Status</span>
                <span className="text-emerald-400 font-medium">Active & Authorized</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Member Since</span>
                <span className="font-mono text-slate-300">
                  {new Date(currentUser.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Telemetry Permission</span>
                <span className="text-cyan-400 font-medium">Full R/W Calibration</span>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={handleLogout}
                className="flex-1 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
              >
                Sign Out
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Tabs */}
            <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => { setTab('login'); setError(null); setSuccess(null); }}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  tab === 'login' ? 'bg-cyan-500/20 text-cyan-300 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setTab('register'); setError(null); setSuccess(null); }}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  tab === 'register' ? 'bg-cyan-500/20 text-cyan-300 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Register
              </button>
              <button
                onClick={() => { setTab('forgot'); setError(null); setSuccess(null); }}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  tab === 'forgot' ? 'bg-cyan-500/20 text-cyan-300 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Reset
              </button>
            </div>

            {/* Notifications */}
            {error && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{success}</span>
              </div>
            )}

            {/* Quick Demo Logins */}
            {tab === 'login' && (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Quick Demo Access:
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('admin@chargeguard.io', 'Admin@ChargeGuard123')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-800/60 text-cyan-300 text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Shield className="w-3 h-3 text-cyan-400" />
                    <span>Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('engineer@chargeguard.io', 'Engineer@ChargeGuard123')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-800/60 text-indigo-300 text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <UserIcon className="w-3 h-3 text-indigo-400" />
                    <span>Engineer</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sign In Form */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="engineer@chargeguard.io"
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-950 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
                </button>
              </form>
            )}

            {/* Registration Form */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e: any) => setRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="engineer">Hardware Engineer</option>
                    <option value="operator">QA Test Operator</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-950 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{loading ? 'Creating Account...' : 'Register Account'}</span>
                </button>
              </form>
            )}

            {/* Forgot Password */}
            {tab === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Registered Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@chargeguard.io"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4 text-cyan-400" />
                  <span>{loading ? 'Requesting Reset...' : 'Send Password Reset'}</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
