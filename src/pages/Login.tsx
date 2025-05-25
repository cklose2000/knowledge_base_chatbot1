import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Sparkles, TrendingUp, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/chat');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        navigate('/chat');
      } else {
        setError('Please enter both username and password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 lg:grid lg:grid-cols-[1fr_2fr]">
      {/* Left side - Branding and features */}
      <div className="hidden lg:flex flex-col justify-center px-8 overflow-hidden">
        <div className="max-w-lg">
          {/* Logo and title */}
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-r from-sky-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">AI Analyst</h1>
              <p className="text-zinc-400 text-sm">Investment Intelligence Platform</p>
            </div>
          </div>

          {/* Value proposition */}
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Transform your investment research with
            <span className="bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent"> AI-powered insights</span>
          </h2>
          
          <p className="text-xl text-zinc-300 mb-12 leading-relaxed">
            Access real-time market analysis, portfolio optimization, and predictive modeling 
            through intelligent conversations with your AI research assistant.
          </p>

          {/* Feature highlights */}
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-sky-500/20 rounded-lg flex items-center justify-center mt-1">
                <TrendingUp className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Real-time Market Analysis</h3>
                <p className="text-zinc-400 text-sm">Get instant insights on market trends, sector performance, and individual stock analysis.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center mt-1">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Portfolio Optimization</h3>
                <p className="text-zinc-400 text-sm">Optimize risk-adjusted returns with AI-driven portfolio recommendations and rebalancing strategies.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex items-center justify-center p-8">
        <div className="max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-sky-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">AI Analyst</h1>
            </div>
          </div>

          {/* Login card */}
          <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
              <p className="text-zinc-400">Sign in to continue to your dashboard</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                icon={<User size={18} />}
                required
              />
              
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                icon={<Lock size={18} />}
                required
              />
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}
              
              <Button
                type="submit"
                loading={isLoading}
                className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold"
                size="lg"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
            
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-amber-300 text-sm text-center">
                <span className="font-medium">Demo Mode:</span> Use any username and password to explore the platform
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 