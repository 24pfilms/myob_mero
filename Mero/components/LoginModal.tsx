import React, { useState, useEffect, useRef } from 'react';
import { api, ApiUser } from '../services/api';
import logoImage from '../Images/orcapop_2.png';

// Constellation Network Background Component
const ConstellationBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    // Particle class
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 2 + 1;
      }
      
      update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // Bounce off edges
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
      }
      
      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(147, 197, 253, 0.8)';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
        ctx.fill();
      }
    }
    
    // Create particles
    const particles: Particle[] = [];
    const particleCount = 80;
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
    
    // Draw connections
    const drawConnections = () => {
      const maxDistance = 150;
      
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < maxDistance) {
            const opacity = (1 - distance / maxDistance) * 0.4;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    };
    
    // Animation loop
    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw connections first
      ctx.shadowBlur = 0;
      drawConnections();
      
      // Update and draw particles
      particles.forEach(particle => {
        particle.update();
        particle.draw();
      });
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0"
      style={{ background: 'transparent' }}
    />
  );
};

/*
 * TODO: Future API Integrations to add to settings/login flow:
 * - OpenRouter API Key (for AI model access - GPT-4, Claude, etc.)
 * - OpenAI API Key (direct GPT access)
 * - Anthropic API Key (direct Claude access)
 * - Fal.ai API Key (image generation/editing)
 * - Google Gemini API Key (already partially implemented)
 * - Stability AI API Key (Stable Diffusion)
 * - ElevenLabs API Key (voice synthesis)
 * - Replicate API Key (various AI models)
 * 
 * Consider adding a "Settings" or "API Keys" section after login
 * where users can configure their own API keys.
 */

interface LoginModalProps {
  onLogin: (user: ApiUser) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  
  // Logo positioning - finalized values
  const logoWidth = 221;
  const logoOffsetY = -25;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) return;

    setIsLoading(true);
    try {
      const trimmedUsername = username.trim();
      if (mode === 'register') {
        const res = await api.register(trimmedUsername, password, email.trim() || undefined);
        onLogin(res.user);
      } else {
        const res = await api.login(trimmedUsername, password);
        onLogin(res.user);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-slate-950" />
      
      {/* Constellation Network Animation */}
      <ConstellationBackground />
      
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent" />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4">
        {/* Electric glow */}
        <div className="absolute -inset-2 bg-blue-500/20 rounded-3xl blur-xl animate-pulse" />
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-2xl opacity-60" />
        
        {/* Glass card */}
        <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl overflow-hidden">
          {/* Animated top bar */}
          <div className="h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 animate-pulse" />
          
          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center">
            {/* Logo */}
            <div className="flex justify-center mb-4" style={{ marginTop: logoOffsetY }}>
              <img 
                src={logoImage} 
                alt="OrcaPal Logo" 
                style={{ width: logoWidth, height: 'auto' }}
                className="drop-shadow-lg"
              />
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-2">OrcaPal</h1>
            <p className="text-blue-400 text-sm">Sign in to your workspace</p>
          </div>
        
          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 border-t border-blue-500/20">
            <div className="space-y-4 pt-4">
              {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800/50 border border-blue-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all hover:border-blue-400/70 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:bg-slate-800/70"
                  placeholder="Enter your username"
                  autoFocus
                />
              </div>

              {mode === 'register' && (
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Email (optional)
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800/50 border border-blue-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all hover:border-blue-400/70 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:bg-slate-800/70"
                    placeholder="you@example.com"
                  />
                </div>
              )}
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800/50 border border-blue-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all hover:border-blue-400/70 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:bg-slate-800/70"
                  placeholder="Enter your password"
                />
              </div>

            </div>
            
            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password}
              className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-cyan-300" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                mode === 'register' ? 'Create Account' : 'Sign In'
              )}
            </button>
            
            <div className="mt-4 pt-4 border-t border-blue-500/20 text-center">
              {mode === 'login' ? (
                <p className="text-sm text-gray-400">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                  >
                    Sign up
                  </button>
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
