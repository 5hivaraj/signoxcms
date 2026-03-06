'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Monitor, Zap, Shield, Cloud, ArrowRight, Users, BarChart3, Calendar, Layout, PlayCircle, Settings, CheckCircle2 } from 'lucide-react';
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: true,
      easing: 'ease-out-cubic',
    });
    
    // Ensure page starts at top
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Monitor,
      title: 'Multi-Display Management',
      description: 'Control unlimited displays from a single dashboard. Monitor status, schedule content, and manage everything remotely in real-time.',
      color: 'from-yellow-400 to-orange-500'
    },
    {
      icon: Zap,
      title: 'Real-Time Content Updates',
      description: 'Push content updates instantly to all your displays. Changes reflect immediately without any delays or manual intervention.',
      color: 'from-orange-400 to-red-500'
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Bank-level security with role-based access control, encrypted data transmission, and comprehensive audit logs.',
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      icon: Cloud,
      title: 'Cloud-Based Platform',
      description: 'Access your signage system from anywhere, anytime. No hardware installation, no maintenance, just pure convenience.',
      color: 'from-blue-400 to-blue-600'
    }
  ];

  const capabilities = [
    { icon: Layout, title: 'Layout Designer', desc: 'Create multi-zone layouts with drag-and-drop' },
    { icon: PlayCircle, title: 'Playlist Management', desc: 'Build dynamic playlists with scheduling' },
    { icon: Calendar, title: 'Smart Scheduling', desc: 'Time-based and date-based content control' },
    { icon: BarChart3, title: 'Analytics & Reports', desc: 'Proof of play and performance metrics' },
    { icon: Users, title: 'User Management', desc: 'Multi-level access with role permissions' },
    { icon: Settings, title: 'Remote Control', desc: 'Manage displays from anywhere' },
  ];

  const benefits = [
    'Reduce operational costs by up to 60%',
    'Update content across all locations instantly',
    'Increase customer engagement by 40%',
    'Save time with automated scheduling',
    'Scale effortlessly as your business grows',
    'Get 24/7 support from our expert team'
  ];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-x-hidden">
      {/* Left Side - SignoX Information */}
      <div className="w-full lg:w-[70%] relative overflow-y-auto scrollbar-hide">
        {/* Animated Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-20 w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-yellow-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative z-10 w-full p-6 sm:p-10 lg:p-16 space-y-8 sm:space-y-12 lg:space-y-16">
          {/* Logo and Branding */}
          <div data-aos="fade-down">
            <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
              <img 
                src="/signomart-full-logo.png" 
                alt="Signomart" 
                className="h-16 w-16 sm:h-24 sm:w-24 lg:h-32 lg:w-32 object-contain flex-shrink-0"
              />
              <div className="flex flex-col gap-1 sm:gap-2 min-w-0">
                <div className="flex items-center gap-0">
                  <span className="text-3xl sm:text-5xl lg:text-7xl font-black text-white tracking-tight break-words">SIGNOX</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="h-1 sm:h-1.5 w-16 sm:w-24 lg:w-32 bg-white"></div>
                  <p className="text-white font-bold text-sm sm:text-lg lg:text-2xl whitespace-nowrap">Digital Signage Management</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Description */}
          <div data-aos="fade-up" className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 border border-white/20">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white mb-4 sm:mb-6 break-words">
              Transform Your Digital Signage Experience
            </h2>
            <p className="text-gray-200 text-base sm:text-lg lg:text-xl leading-relaxed">
              SignoX is a comprehensive cloud-based digital signage management system that empowers businesses to create, manage, and display dynamic content across multiple screens with ease. Built for scalability, reliability, and performance.
            </p>
          </div>

          {/* Key Features */}
          <div className="space-y-4 sm:space-y-6">
            <h3 data-aos="fade-right" className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-6 sm:mb-8">Powerful Features</h3>
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  data-aos="fade-right"
                  data-aos-delay={i * 100}
                  className="bg-white/10 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 group"
                >
                  <div className="flex items-start gap-3 sm:gap-4 lg:gap-6">
                    <div className={`bg-gradient-to-br ${feature.color} p-2 sm:p-3 lg:p-4 rounded-xl sm:rounded-2xl group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
                      <Icon className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 sm:mb-3 break-words">{feature.title}</h3>
                      <p className="text-gray-300 text-sm sm:text-base lg:text-lg leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Capabilities Grid */}
          <div>
            <h3 data-aos="fade-right" className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-6 sm:mb-8">Complete Solution</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {capabilities.map((cap, i) => {
                const Icon = cap.icon;
                return (
                  <div
                    key={i}
                    data-aos="zoom-in"
                    data-aos-delay={i * 100}
                    className="bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-yellow-400/30 hover:scale-105 hover:border-yellow-400/50 transition-all duration-300"
                  >
                    <Icon className="h-8 w-8 sm:h-10 sm:w-10 text-yellow-400 mb-3 sm:mb-4" />
                    <h4 className="text-white font-bold text-base sm:text-lg mb-2 break-words">{cap.title}</h4>
                    <p className="text-gray-300 text-xs sm:text-sm">{cap.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Advanced Features */}
          <div className="pb-8">
            <h3 data-aos="fade-right" className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-6 sm:mb-8">Advanced Features</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {[
                { title: 'Multi-Zone Layouts', desc: 'Create complex layouts with multiple content zones and independent playlists' },
                { title: 'Device Pairing', desc: 'Secure 6-digit pairing code system for quick display setup' },
                { title: 'Heartbeat Monitoring', desc: 'Real-time display status tracking with automatic offline detection' },
                { title: 'Role-Based Access', desc: 'Super Admin, Client Admin, User Admin, and Staff role hierarchy' },
                { title: 'License Management', desc: 'Automated license expiry checking and enforcement system' },
                { title: 'Media Library', desc: 'Organized storage with tags, metadata, and search capabilities' },
                { title: 'Responsive Player', desc: 'Adaptive display player that works on any screen size or orientation' },
                { title: 'Schedule Override', desc: 'Priority-based scheduling with date and time range support' },
              ].map((feature, i) => (
                <div
                  key={i}
                  data-aos="fade-up"
                  data-aos-delay={i * 50}
                  className="bg-white/10 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/20 hover:bg-white/15 transition-all duration-300"
                >
                  <h4 className="text-white font-bold text-base sm:text-xl mb-2 break-words">{feature.title}</h4>
                  <p className="text-gray-300 text-sm sm:text-base">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-[30%] lg:fixed lg:right-0 lg:top-0 lg:h-screen flex items-center justify-center p-6 sm:p-8 relative bg-gradient-to-br from-gray-800/50 to-black/50 lg:backdrop-blur-sm">
        {/* Background Effect - Desktop only */}
        <div className="hidden lg:block absolute inset-0 bg-gradient-to-br from-gray-800/50 to-black/50 backdrop-blur-sm"></div>

        <div className="w-full max-w-md relative z-10">
          <div data-aos="fade-left" className="bg-white/10 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 border border-white/20 shadow-2xl">
            {/* Logo in Card - Desktop only */}
            <div className="hidden lg:block text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-4">
                <img 
                  src="/signomart-full-logo.png" 
                  alt="Signomart" 
                  className="h-16 w-16 object-contain"
                />
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-0">
                    <span className="text-5xl font-black text-white">SIGNOX</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-20 bg-white"></div>
                    <span className="text-xs text-gray-300 italic">Digital Signage</span>
                  </div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
              <p className="text-gray-400">Sign in to your account</p>
            </div>

            {/* Mobile Header */}
            <div className="lg:hidden text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Welcome Back</h2>
              <p className="text-gray-400 text-sm sm:text-base">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white font-semibold text-sm sm:text-base">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 sm:h-14 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 rounded-xl text-base sm:text-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white font-semibold text-sm sm:text-base">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 sm:h-14 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400 rounded-xl text-base sm:text-lg"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/20 p-3 sm:p-4 text-sm text-red-200 border border-red-500/30">
                  <p className="font-semibold mb-1">Login Failed</p>
                  <p className="text-xs">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 sm:h-14 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-bold text-base sm:text-lg rounded-xl shadow-lg hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105"
                disabled={loading || !email || !password}
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-5 w-5 sm:h-6 sm:w-6 animate-spin" />Signing in...</>
                ) : (
                  <>Sign In<ArrowRight className="ml-2 h-5 w-5 sm:h-6 sm:w-6" /></>
                )}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs sm:text-sm text-gray-500 mt-4 sm:mt-6">© 2026 SignoX. All rights reserved.</p>
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        html { scroll-behavior: smooth; }
        body { overflow-x: hidden; }
      `}</style>
    </div>
  );
}
