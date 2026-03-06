/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';
import { Activity, Monitor, Users, CalendarClock, BarChart3 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import api from '@/lib/api';
import AOS from 'aos';
import 'aos/dist/aos.css';

interface ClientSummary {
  userAdmins: number;
  totalDisplays: number;
  displayLimit: number;
  license: {
    status: string;
    expiry: string | null;
  };
}

export default function ClientAnalyticsPage() {
  const [summary, setSummary] = useState<ClientSummary | null>(null);

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });
    api
      .get('/analytics/summary')
      .then((res) => {
        if (res.data.role === 'CLIENT_ADMIN') {
          setSummary(res.data);
        }
      })
      .catch(() => setSummary(null));
  }, []);

  const licenseStatus =
    summary?.license.status ?? '—';

  const licenseExpiry =
    summary && summary.license.expiry
      ? new Date(summary.license.expiry).toLocaleDateString()
      : '—';

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
              <h1 className="text-4xl font-bold text-white">Tenant Analytics</h1>
              <p className="mt-2 text-gray-300">
                Overview of User Admins, displays, and license status for this tenant.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <div data-aos="fade-up" data-aos-delay="100">
            <StatCard
              title="User Admins"
              value={summary?.userAdmins ?? '—'}
              icon={<Users className="h-8 w-8" />}
            />
          </div>
          <div data-aos="fade-up" data-aos-delay="200">
            <StatCard
              title="Displays"
              value={
                summary
                  ? `${summary.totalDisplays}/${summary.displayLimit}`
                  : '—'
              }
              subtitle="Current displays vs license limit"
              icon={<Monitor className="h-8 w-8" />}
            />
          </div>
          <div data-aos="fade-up" data-aos-delay="300">
            <StatCard
              title="License Status"
              value={licenseStatus}
              icon={<Activity className="h-8 w-8" />}
            />
          </div>
          <div data-aos="fade-up" data-aos-delay="400">
            <StatCard
              title="License Expiry"
              value={licenseExpiry}
              icon={<CalendarClock className="h-8 w-8" />}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

