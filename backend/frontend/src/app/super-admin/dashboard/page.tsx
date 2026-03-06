/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';
import { Activity, Monitor, Users, User, Shield, TrendingUp, Zap } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import AOS from 'aos';
import 'aos/dist/aos.css';

interface SuperAdminSummary {
  totalClients: number;
  totalDisplays: number;
  onlineDisplays: number;
}

type UserProfile = {
  id: string;
  email: string;
  role: string;
  staffRole?: string;
  isActive: boolean;
  createdAt: string;
};

export default function SuperAdminDashboard() {
  const [summary, setSummary] = useState<SuperAdminSummary | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Initialize AOS
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });

    // Fetch analytics summary
    api
      .get('/analytics/summary')
      .then((res) => {
        if (res.data.role === 'SUPER_ADMIN') {
          setSummary(res.data);
        }
      })
      .catch(() => {
        setSummary(null);
      });

    // Fetch user profile
    api
      .get('/users/profile')
      .then((res) => {
        setProfile(res.data.user);
      })
      .catch(() => {
        setProfile(null);
      });
  }, []);

  const getRoleDisplayName = (role: string, staffRole?: string) => {
    const roleNames = {
      SUPER_ADMIN: 'Super Administrator',
      CLIENT_ADMIN: 'Client Administrator',
      USER_ADMIN: 'User Administrator',
      STAFF: 'Staff Member'
    };

    const staffRoleNames = {
      DISPLAY_MANAGER: 'Display Manager',
      BROADCAST_MANAGER: 'Broadcast Manager',
      CONTENT_MANAGER: 'Content Manager',
      CMS_VIEWER: 'CMS Viewer',
      POP_MANAGER: 'Proof of Play Manager'
    };

    let displayName = roleNames[role as keyof typeof roleNames] || role;
    if (role === 'STAFF' && staffRole) {
      displayName += ` - ${staffRoleNames[staffRole as keyof typeof staffRoleNames] || staffRole}`;
    }
    return displayName;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8">
        {/* Header Section */}
        <div className="relative" data-aos="fade-down">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-500/10 rounded-3xl blur-3xl"></div>
          <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 border border-gray-800 shadow-2xl">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="h-10 w-10 text-yellow-400" />
                  <h1 className="text-4xl font-black text-white">Super Admin Dashboard</h1>
                  {profile && (
                    <Badge className="bg-yellow-400 text-black font-bold px-4 py-1">
                      {getRoleDisplayName(profile.role, profile.staffRole)}
                    </Badge>
                  )}
                </div>
                <p className="text-gray-300 text-lg">Platform-wide control and analytics</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-green-500/20 px-4 py-2 rounded-xl border border-green-500/30">
                  <p className="text-green-400 font-semibold text-sm">System Online</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Information Card */}
        {profile && (
          <Card className="border-gray-200 shadow-lg" data-aos="fade-up">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-white">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-3 rounded-xl">
                  <User className="h-6 w-6 text-white" />
                </div>
                Administrator Information
              </CardTitle>
              <CardDescription className="text-base">Your super administrator account details</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Email</p>
                  <p className="text-lg font-bold text-gray-900">{profile.email}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Access Level</p>
                  <p className="text-lg font-bold text-gray-900">Full Platform Access</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          <StatCard
            title="Total Clients"
            value={summary?.totalClients ?? '—'}
            icon={<Users className="h-8 w-8" />}
            gradient="from-blue-400 to-blue-600"
          />
          <StatCard
            title="Total Displays"
            value={summary?.totalDisplays ?? '—'}
            icon={<Monitor className="h-8 w-8" />}
            gradient="from-yellow-400 to-orange-500"
          />
          <StatCard
            title="Online Displays"
            value={summary?.onlineDisplays ?? '—'}
            subtitle={
              summary
                ? `${summary.onlineDisplays} of ${summary.totalDisplays} displays reporting online`
                : undefined
            }
            icon={<Activity className="h-8 w-8" />}
            gradient="from-green-400 to-green-600"
          />
        </div>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-2" data-aos="fade-up" data-aos-delay="200">
          <Card className="border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="bg-gradient-to-r from-yellow-50 to-orange-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-3 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                Platform Health
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Display Uptime</span>
                  <span className="text-2xl font-black text-green-600">
                    {summary && summary.totalDisplays > 0
                      ? `${Math.round((summary.onlineDisplays / summary.totalDisplays) * 100)}%`
                      : '—'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: summary && summary.totalDisplays > 0
                        ? `${(summary.onlineDisplays / summary.totalDisplays) * 100}%`
                        : '0%'
                    }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="bg-gradient-to-br from-blue-400 to-purple-500 p-3 rounded-xl">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                  <span className="text-gray-700 font-medium">API Services</span>
                  <Badge className="bg-green-500 text-white">Operational</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                  <span className="text-gray-700 font-medium">Database</span>
                  <Badge className="bg-green-500 text-white">Connected</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
