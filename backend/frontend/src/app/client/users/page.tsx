'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ShieldAlert, Key, Loader2, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function ClientUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form State
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });

  // Password Reset State
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetUserEmail, setResetUserEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // 1. Fetch Users on Mount
  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Calls the endpoint we made: GET /api/users
      const res = await api.get('/users');

      // Backend returns { role, users: [...] } for CLIENT_ADMIN
      const usersArray = Array.isArray(res.data)
        ? res.data
        : res.data.users || [];

      setUsers(usersArray);
      setError('');
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load User Admins.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initialize AOS
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });

    if (!authLoading) {
      if (user?.role !== 'CLIENT_ADMIN') {
        router.push('/login'); // Kick out if not Client Admin
      } else {
        fetchUsers();
      }
    }
  }, [user, authLoading, router]);

  // 2. Handle Create User
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Calls POST /api/users (Backend handles linking logic)
      await api.post('/users', formData);
      
      setIsOpen(false);
      setFormData({ email: '', password: '' });
      fetchUsers(); // Refresh list
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create user');
    }
  };

  // 3. Handle Delete (Soft Delete/Suspend)
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to permanently delete this User Admin? This cannot be undone.')) {
      try {
        await api.delete(`/users/${id}`);
        fetchUsers();
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Failed to delete user';
        alert(msg);
      }
    }
  };

  // 4. Handle Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    try {
      setResetting(true);
      await api.put(`/users/${resetUserId}/reset-password`, {
        newPassword: newPassword
      });
      
      setResetDialogOpen(false);
      setResetUserId('');
      setResetUserEmail('');
      setNewPassword('');
      alert('Password reset successfully');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const openResetDialog = (userId: string, userEmail: string) => {
    setResetUserId(userId);
    setResetUserEmail(userEmail);
    setNewPassword('');
    setResetDialogOpen(true);
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="ml-3 text-gray-600">Loading users...</p>
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
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-10 w-10 text-yellow-400" />
                  <h1 className="text-4xl font-black text-white">User Admins</h1>
                </div>
                <p className="text-gray-300 text-lg">
                  Manage the operational managers for your organization.
                </p>
              </div>
              
              {/* CREATE USER MODAL */}
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button className="h-12 gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-bold shadow-lg hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105">
                    <Plus className="h-5 w-5" /> Add User Admin
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader>
                    <DialogTitle className="text-2xl">Create New User Admin</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Email Address</Label>
                      <Input 
                        required 
                        type="email" 
                        placeholder="manager@branch.com"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Password</Label>
                      <Input 
                    required 
                    type="password" 
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
                <Button type="submit" className="w-full signomart-primary hover:signomart-primary">Create User</Button>
              </form>
            </DialogContent>
          </Dialog>
            </div>
          </div>
        </div>

        {/* PASSWORD RESET MODAL */}
        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label>User Email</Label>
                <Input 
                  value={resetUserEmail}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input 
                  required 
                  type="password" 
                  placeholder="Enter new password (min 6 characters)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={6}
                  disabled={resetting}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setResetDialogOpen(false)}
                  disabled={resetting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={resetting} className="flex-1">
                  {resetting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-center">
            <ShieldAlert className="mr-2 h-5 w-5" />
            {error}
          </div>
        )}

        {/* USERS TABLE */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User (Email)</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No users found. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell><Badge variant="outline">User Admin</Badge></TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <Badge className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="destructive">Suspended</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-500 hover:text-blue-700"
                            onClick={() => openResetDialog(u.id, u.email)}
                            title="Reset Password"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(u.id)}
                            title="Delete User Admin"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
