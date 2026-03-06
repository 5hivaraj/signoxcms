'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { BarChart3, Users, Monitor, Activity } from 'lucide-react';

interface AnalyticsData {
  totalClients: number;
  totalDisplays: number;
  onlineDisplays: number;
  offlineDisplays: number;
  systemHealth?: {
    status: string;
    uptime: number;
  };
}

export default function SuperAdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/analytics/summary');
      setAnalytics(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError(err.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with gradient background */}
        <div 
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-black p-8 shadow-2xl"
          data-aos="fade-down"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-500/10"></div>
          <div className="relative flex items-center gap-4">
            <div className="rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 p-3 shadow-lg">
              <BarChart3 className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Global Analytics</h1>
              <p className="mt-2 text-gray-300">
                Platform-wide metrics (clients, displays, active status).
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 p-4 text-red-800 shadow-lg" data-aos="fade-up">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-white p-6 shadow-lg animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : analytics ? (
          <>
            <div className="grid gap-6 md:grid-cols-3">
              <div 
                className="rounded-2xl bg-white p-6 shadow-lg hover:shadow-xl transition-shadow"
                data-aos="fade-up"
                data-aos-delay="100"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Users className="h-6 w-6 text-yellow-500" />
                  <h3 className="text-sm font-medium text-gray-500">Total Clients</h3>
                </div>
                <p className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                  {analytics.totalClients}
                </p>
                <p className="mt-1 text-sm text-gray-500">CLIENT_ADMIN users</p>
              </div>
              <div 
                className="rounded-2xl bg-white p-6 shadow-lg hover:shadow-xl transition-shadow"
                data-aos="fade-up"
                data-aos-delay="200"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Monitor className="h-6 w-6 text-blue-500" />
                  <h3 className="text-sm font-medium text-gray-500">Total Displays</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{analytics.totalDisplays}</p>
                <p className="mt-1 text-sm text-gray-500">Paired displays</p>
              </div>
              <div 
                className="rounded-2xl bg-white p-6 shadow-lg hover:shadow-xl transition-shadow"
                data-aos="fade-up"
                data-aos-delay="300"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Activity className="h-6 w-6 text-green-500" />
                  <h3 className="text-sm font-medium text-gray-500">Online Displays</h3>
                </div>
                <p className="text-3xl font-bold text-green-600">{analytics.onlineDisplays}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {analytics.offlineDisplays} offline
                </p>
              </div>
            </div>

            {analytics.systemHealth && (
              <div 
                className="rounded-2xl bg-white p-6 shadow-lg hover:shadow-xl transition-shadow"
                data-aos="fade-up"
                data-aos-delay="400"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="text-lg font-semibold text-green-600">
                      {analytics.systemHealth.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Uptime</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatUptime(analytics.systemHealth.uptime)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl bg-gray-50 p-6 text-center text-gray-500 shadow-lg" data-aos="fade-up">
            No analytics data available
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

