/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';
import { Activity, Monitor, Users, Building2, User, Crown, Calendar, TrendingUp, HardDrive } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StorageIndicator } from '@/components/ui/storage-indicator';
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

interface StorageInfo {
  limitMB: number;
  usedMB: number;
  availableMB: number;
  maxMonthlyUsageMB?: number;
  monthlyUploadedMB?: number;
  monthlyQuotaRemainingMB?: number;
  quotaResetDate?: Date | string;
}

type HierarchyInfo = {
  clientAdmin: {
    id: string;
    email: string;
    name: string;
  } | null;
  userAdmin: {
    id: string;
    email: string;
  } | null;
  companyName: string | null;
};

type UserProfile = {
  id: string;
  email: string;
  role: string;
  staffRole?: string;
  isActive: boolean;
  createdAt: string;
};

export default function ClientDashboard() {
  const [summary, setSummary] = useState<ClientSummary | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hierarchy, setHierarchy] = useState<HierarchyInfo | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

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
        if (res.data.role === 'CLIENT_ADMIN') {
          setSummary(res.data);
        }
      })
      .catch(() => setSummary(null));

    // Fetch user profile and hierarchy
    api
      .get('/users/profile')
      .then((res) => {
        setProfile(res.data.user);
        setHierarchy(res.data.hierarchy);
      })
      .catch(() => {
        setProfile(null);
        setHierarchy(null);
      });

    // Fetch storage info
    api
      .get('/media/storage-info')
      .then((res) => {
        setStorageInfo(res.data.storageInfo);
      })
      .catch(() => setStorageInfo(null));
  }, []);

  const licenseLabel =
    summary && summary.license.expiry
      ? `${summary.license.status} · Expires ${new Date(
          summary.license.expiry
        ).toLocaleDateString()}`
      : summary
      ? summary.license.status
      : undefined;

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

  const getLicenseStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return 'bg-green-500';
      case 'EXPIRED':
        return 'bg-red-500';
      case 'SUSPENDED':
        return 'bg-orange-500';
      case 'EXPIRING_SOON':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
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
                  <Crown className="h-10 w-10 text-yellow-400" />
                  <h1 className="text-4xl font-black text-white">Client Dashboard</h1>
                  {profile && (
                    <Badge className="bg-yellow-400 text-black font-bold px-4 py-1">
                      {getRoleDisplayName(profile.role, profile.staffRole)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <p className="text-gray-300 text-lg">Tenant analytics and quick actions</p>
                  {hierarchy?.companyName && (
                    <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/20">
                      <Building2 className="h-4 w-4 text-yellow-400" />
                      <span className="text-white font-semibold">{hierarchy.companyName}</span>
                    </div>
                  )}
                </div>
              </div>
              {summary?.license && (
                <div className={`${getLicenseStatusColor(summary.license.status)} px-6 py-3 rounded-xl shadow-lg`}>
                  <p className="text-white font-bold text-sm">License: {summary.license.status}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User Information Card */}
        {(profile || hierarchy) && (
          <Card className="border-gray-200 shadow-lg" data-aos="fade-up">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-white">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-3 rounded-xl">
                  <User className="h-6 w-6 text-white" />
                </div>
                Administrator Information
              </CardTitle>
              <CardDescription className="text-base">Your account and organization details</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Email</p>
                  <p className="text-lg font-bold text-gray-900">{profile?.email || 'Loading...'}</p>
                </div>
                {hierarchy?.companyName && (
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Company</p>
                    <p className="text-lg font-bold text-gray-900">{hierarchy.companyName}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          <StatCard
            title="User Admins"
            value={summary?.userAdmins ?? '—'}
            icon={<Users className="h-8 w-8" />}
            gradient="from-blue-400 to-blue-600"
          />
          <StatCard
            title="Displays"
            value={summary ? `${summary.totalDisplays}/${summary.displayLimit}` : '—'}
            subtitle="Current displays vs license limit"
            icon={<Monitor className="h-8 w-8" />}
            gradient="from-yellow-400 to-orange-500"
          />
          <StatCard
            title="License Status"
            value={summary?.license.status ?? '—'}
            subtitle={licenseLabel}
            icon={<Activity className="h-8 w-8" />}
            gradient="from-green-400 to-green-600"
          />
        </div>

        {/* License and Usage Details */}
        <div className="grid gap-6 md:grid-cols-2" data-aos="fade-up" data-aos-delay="200">
          <Card className="border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="bg-gradient-to-r from-yellow-50 to-orange-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-3 rounded-xl">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                License Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-700 font-medium">Status</span>
                  <Badge className={`${getLicenseStatusColor(summary?.license.status || '')} text-white font-bold`}>
                    {summary?.license.status || 'Unknown'}
                  </Badge>
                </div>
                {summary?.license.expiry && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-700 font-medium">Expires On</span>
                    <span className="text-gray-900 font-bold">
                      {new Date(summary.license.expiry).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="bg-gradient-to-br from-blue-400 to-purple-500 p-3 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                Display Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Capacity</span>
                  <span className="text-2xl font-black text-gray-900">
                    {summary ? `${Math.round((summary.totalDisplays / summary.displayLimit) * 100)}%` : '—'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-yellow-400 to-orange-500 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: summary
                        ? `${Math.min((summary.totalDisplays / summary.displayLimit) * 100, 100)}%`
                        : '0%'
                    }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    <span className="font-bold text-gray-900">{summary?.totalDisplays ?? 0}</span> used
                  </span>
                  <span className="text-gray-500">
                    <span className="font-bold text-gray-900">{summary?.displayLimit ?? 0}</span> total
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Storage & Usage */}
        <Card className="border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300" data-aos="fade-up" data-aos-delay="300">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="bg-gradient-to-br from-green-400 to-green-600 p-3 rounded-xl">
                <HardDrive className="h-6 w-6 text-white" />
              </div>
              Storage & Monthly Usage
            </CardTitle>
            <CardDescription>Organization-wide storage and upload quota</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {storageInfo ? (
              <StorageIndicator storageInfo={storageInfo} />
            ) : (
              <div className="text-center text-gray-500 py-4">Loading storage info...</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
