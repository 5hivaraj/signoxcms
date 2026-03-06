'use client';

import { useEffect, useState } from 'react';
import { Building2, User, UserCog, Briefcase, Shield, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import AOS from 'aos';
import 'aos/dist/aos.css';

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

export default function StaffDashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hierarchy, setHierarchy] = useState<HierarchyInfo | null>(null);

  useEffect(() => {
    // Initialize AOS
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });

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
                  <Briefcase className="h-10 w-10 text-yellow-400" />
                  <h1 className="text-4xl font-black text-white">Staff Dashboard</h1>
                  {profile && (
                    <Badge className="bg-yellow-400 text-black font-bold px-4 py-1">
                      {getRoleDisplayName(profile.role, profile.staffRole)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <p className="text-gray-300 text-lg">Your workspace</p>
                  {hierarchy?.companyName && (
                    <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/20">
                      <Building2 className="h-4 w-4 text-yellow-400" />
                      <span className="text-white font-semibold">{hierarchy.companyName}</span>
                    </div>
                  )}
                </div>
              </div>
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
                Staff Information
              </CardTitle>
              <CardDescription className="text-base">Your account and organization hierarchy</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Email</p>
                  <p className="text-lg font-bold text-gray-900">{profile?.email || 'Loading...'}</p>
                </div>
                {hierarchy?.userAdmin && (
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">User Administrator</p>
                    <div className="flex items-start gap-3">
                      <div className="bg-green-500 p-2 rounded-lg">
                        <UserCog className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900">{hierarchy.userAdmin.email}</p>
                        <p className="text-xs text-gray-600 mt-1">Your direct supervisor</p>
                      </div>
                    </div>
                  </div>
                )}
                {hierarchy?.clientAdmin && (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Client Administrator</p>
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-500 p-2 rounded-lg">
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900">{hierarchy.clientAdmin.name}</p>
                        <p className="text-xs text-gray-600 mt-1">{hierarchy.clientAdmin.email}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Welcome Card */}
        <Card className="border-gray-200 shadow-lg" data-aos="fade-up" data-aos-delay="200">
          <CardHeader className="bg-gradient-to-r from-yellow-50 to-orange-50">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-3 rounded-xl">
                <Shield className="h-6 w-6 text-white" />
              </div>
              Welcome to Your Workspace
            </CardTitle>
            <CardDescription className="text-base">Access your assigned areas and manage your tasks</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-gray-50 to-white p-6 rounded-xl border border-gray-200">
                <div className="flex items-start gap-4">
                  <div className="bg-yellow-400 p-3 rounded-xl">
                    <Users className="h-6 w-6 text-black" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Navigation Guide</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Use the sidebar to navigate to your assigned areas. Your permissions are configured by your User Administrator 
                      based on your staff role. If you need access to additional features, please contact your supervisor.
                    </p>
                  </div>
                </div>
              </div>

              {profile?.staffRole && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-xl border border-yellow-200">
                  <div className="flex items-start gap-4">
                    <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-3 rounded-xl">
                      <Briefcase className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Your Role</h3>
                      <p className="text-gray-700 leading-relaxed">
                        You are assigned as <span className="font-bold text-yellow-700">{getRoleDisplayName(profile.role, profile.staffRole)}</span>. 
                        This role determines which features and data you can access within the system.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
