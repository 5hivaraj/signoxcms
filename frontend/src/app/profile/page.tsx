'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Building2, UserCog, Shield, Lock, Key } from 'lucide-react';
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

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hierarchy, setHierarchy] = useState<HierarchyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    // Initialize AOS
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });
    
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/profile');
      setProfile(response.data.user);
      setHierarchy(response.data.hierarchy);
    } catch (error: any) {
      setError('Failed to load profile information');
      console.error('Profile fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    try {
      setUpdating(true);
      await api.put('/users/profile/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setSuccess('Password updated successfully');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update password');
    } finally {
      setUpdating(false);
    }
  };

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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-purple-100 text-purple-800';
      case 'CLIENT_ADMIN': return 'bg-blue-100 text-blue-800';
      case 'USER_ADMIN': return 'bg-green-100 text-green-800';
      case 'STAFF': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="ml-3 text-gray-600">Loading profile...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8">
        {/* Header Section */}
        <div className="relative" data-aos="fade-down">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-500/10 rounded-3xl blur-3xl"></div>
          <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 border border-gray-800 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-4 rounded-2xl">
                <User className="h-10 w-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-black text-white">Profile Settings</h1>
                <p className="text-gray-300 text-lg mt-1">Manage your account settings and password</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Information */}
          <Card className="border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300" data-aos="fade-up">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-white">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="bg-gradient-to-br from-blue-400 to-blue-600 p-3 rounded-xl">
                  <User className="h-6 w-6 text-white" />
                </div>
                Profile Information
              </CardTitle>
              <CardDescription className="text-base">
                Your account details and role information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="bg-gray-50 p-4 rounded-xl">
                <Label className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Email</Label>
                <p className="text-lg font-bold text-gray-900">{profile?.email}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl">
                <Label className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Role</Label>
                <div className="mt-2">
                  <Badge className={`${getRoleBadgeColor(profile?.role || '')} text-base px-4 py-1`}>
                    {getRoleDisplayName(profile?.role || '', profile?.staffRole)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <Label className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Account Status</Label>
                  <div className="mt-2">
                    <Badge variant={profile?.isActive ? "default" : "destructive"} className="text-sm px-3 py-1">
                      {profile?.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl">
                  <Label className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Member Since</Label>
                  <p className="text-sm font-bold text-gray-900 mt-2">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hierarchy Information */}
          <Card className="border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300" data-aos="fade-up" data-aos-delay="100">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-white">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="bg-gradient-to-br from-purple-400 to-purple-600 p-3 rounded-xl">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                Organization Hierarchy
              </CardTitle>
              <CardDescription className="text-base">
                Your position within the organization structure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {hierarchy?.companyName && (
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-xl border border-yellow-200">
                  <Label className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Company</Label>
                  <p className="text-lg font-bold text-gray-900">{hierarchy.companyName}</p>
                </div>
              )}

              {hierarchy?.clientAdmin && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                  <Label className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Client Administrator</Label>
                  <div className="flex items-start gap-3 mt-2">
                    <div className="bg-blue-500 p-2 rounded-lg">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-gray-900">{hierarchy.clientAdmin.name}</p>
                      <p className="text-sm text-gray-600 mt-1">{hierarchy.clientAdmin.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {hierarchy?.userAdmin && profile?.role === 'STAFF' && (
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                  <Label className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">User Administrator</Label>
                  <div className="flex items-start gap-3 mt-2">
                    <div className="bg-green-500 p-2 rounded-lg">
                      <UserCog className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-gray-900">{hierarchy.userAdmin.email}</p>
                      <p className="text-sm text-gray-600 mt-1">Your direct supervisor</p>
                    </div>
                  </div>
                </div>
              )}

              {!hierarchy?.clientAdmin && !hierarchy?.userAdmin && (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No hierarchy information available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Password Change */}
        <Card className="border-gray-200 shadow-lg" data-aos="fade-up" data-aos-delay="200">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-white">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-3 rounded-xl">
                <Lock className="h-6 w-6 text-white" />
              </div>
              Change Password
            </CardTitle>
            <CardDescription className="text-base">
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handlePasswordUpdate} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Current Password
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    required
                    disabled={updating}
                    className="h-12 border-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    New Password
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    required
                    disabled={updating}
                    minLength={6}
                    className="h-12 border-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                  <p className="text-xs text-gray-500">Minimum 6 characters</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    required
                    disabled={updating}
                    minLength={6}
                    className="h-12 border-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-200">
                  <p className="font-semibold mb-1">Error</p>
                  <p>{error}</p>
                </div>
              )}

              {success && (
                <div className="rounded-xl bg-green-50 p-4 text-sm text-green-800 border border-green-200">
                  <p className="font-semibold mb-1">Success</p>
                  <p>{success}</p>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={updating} 
                className="h-12 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-bold text-base shadow-lg hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105"
              >
                {updating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-5 w-5" />
                    Update Password
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}