import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Shield, Info } from 'lucide-react';

export const LoginPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (isRegister) {
      await auth?.register();
    } else {
      await auth?.login();
    }
    navigate('/feed');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-body">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link to="/" className="inline-flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">IP</div>
          <span className="font-display font-bold text-3xl tracking-tight text-slate-900">Infra_Pulse</span>
        </Link>
        <h2 className="text-2xl font-display font-bold text-slate-900">
          {isRegister ? 'Join the community' : 'Sign in to your account'}
        </h2>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-2xl border border-slate-200 sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700">College Email address</label>
              <div className="mt-1">
                <input required type="email" className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500" placeholder="student@college.edu" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <div className="mt-1">
                <input required type="password" className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-brand-500 focus:border-brand-500" />
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-slate-300 focus:outline-none focus:ring-brand-500 focus:border-brand-500 rounded-lg">
                  <option>Student</option>
                  <option>Faculty</option>
                </select>
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full justify-center" disabled={isLoading}>
              {isLoading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">
                  {isRegister ? 'Already have an account?' : 'New to Infra_Pulse?'}
                </span>
              </div>
            </div>
            <div className="mt-6 text-center">
              <button onClick={() => setIsRegister(!isRegister)} className="text-brand-600 hover:text-brand-500 font-medium">
                {isRegister ? 'Sign in instead' : 'Create an account'}
              </button>
            </div>
          </div>
        </div>
        
        {isRegister && (
          <div className="mt-8 bg-brand-50 border border-brand-200 rounded-xl p-4 flex gap-3 text-sm text-brand-800">
            <Shield className="shrink-0 text-brand-600" size={20} />
            <p>Your real identity stays completely private. A unique anonymous handle (e.g., <span className="font-mono font-bold">SilentOwl#4821</span>) will be automatically generated for you.</p>
          </div>
        )}
      </div>
    </div>
  );
};