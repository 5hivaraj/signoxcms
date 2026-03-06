/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Power, Search, Edit, Trash2, Users, Building2 } from 'lucide-react';
import AOS from 'aos';
import 'aos/dist/aos.css';

type ClientProfile = {
  clientId?: string;
  maxDisplays: number;
  maxUsers: number;
  maxStorageMB?: number;
  licenseExpiry?: string | null;
  companyName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

type ClientAdmin = {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  clientProfile?: ClientProfile | null;
  displaysUsed?: number;
  licenseStatus?: 'active' | 'expired' | 'suspended' | 'expiring_soon';
  daysUntilExpiry?: number | null;
  isExpired?: boolean;
};

function fmtDate(d?: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString();
}

export default function SuperAdminClientsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientAdmin[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string>('');

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientAdmin | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    maxDisplays: '10',
    maxUsers: '5',
    maxStorageMB: '25',
    maxMonthlyUsageMB: '150',
    licenseExpiry: '',
  });

  const [editForm, setEditForm] = useState({
    companyName: '',
    maxDisplays: '10',
    maxUsers: '5',
    maxStorageMB: '25',
    maxMonthlyUsageMB: '150',
    licenseExpiry: '',
    contactEmail: '',
    contactPhone: '',
  });

  const isSuperAdmin = useMemo(() => user?.role === 'SUPER_ADMIN', [user?.role]);

  // Filter clients based on search term
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    
    const term = searchTerm.toLowerCase().trim();
    return clients.filter((client) => {
      const clientId = client.clientProfile?.clientId?.toLowerCase() || '';
      const companyName = client.clientProfile?.companyName?.toLowerCase() || '';
      const email = client.email.toLowerCase();
      
      return (
        clientId.includes(term) ||
        companyName.includes(term) ||
        email.includes(term)
      );
    });
  }, [clients, searchTerm]);

  useEffect(() => {
    // Initialize AOS
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });

    if (!user) return;
    if (!isSuperAdmin) {
      router.replace('/login');
      return;
    }
    fetchClients();
  }, [user, isSuperAdmin]);

  async function fetchClients() {
    try {
      setLoading(true);
      setError('');
      console.log('📋 Fetching client admins list...');
      
      const res = await api.get('/users/client-admins');
      console.log('✅ Fetched clients:', res.data.clientAdmins?.length || 0);
      
      setClients(res.data.clientAdmins ?? []);
    } catch (e: any) {
      console.error('❌ Fetch clients error:', {
        status: e?.response?.status,
        message: e?.response?.data?.message
      });
      
      setError(e?.response?.data?.message || 'Failed to load client admins');
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  async function createClient() {
    try {
      setSaving(true);
      setError('');

      if (!form.email || !form.password || !form.companyName) {
        setError('Email, Password, and Company Name are required.');
        return;
      }

      await api.post('/users/client-admin', {
        name: form.name || undefined,
        email: form.email,
        password: form.password,
        companyName: form.companyName,
        maxDisplays: Number(form.maxDisplays || 10),
        maxUsers: Number(form.maxUsers || 5),
        maxStorageMB: Number(form.maxStorageMB || 25),
        maxMonthlyUsageMB: Number(form.maxMonthlyUsageMB || 150),
        licenseExpiry: form.licenseExpiry || null,
      });

      setOpen(false);
      setForm({
        name: '',
        email: '',
        password: '',
        companyName: '',
        maxDisplays: '10',
        maxUsers: '5',
        maxStorageMB: '25',
        maxMonthlyUsageMB: '150',
        licenseExpiry: '',
      });

      await fetchClients();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create client admin');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(id: string) {
    try {
      setSaving(true);
      setError('');
      console.log('🔄 Attempting to toggle status for client:', id);
      console.log('🔑 Current user:', user);
      
      const response = await api.patch(`/users/client-admins/${id}/status`);
      console.log('✅ Toggle status response:', response.data);
      
      await fetchClients();
    } catch (e: any) {
      console.error('❌ Toggle status error:', {
        status: e?.response?.status,
        statusText: e?.response?.statusText,
        data: e?.response?.data,
        message: e?.message
      });
      
      const errorMsg = e?.response?.data?.message || 'Failed to update status';
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  }

  function openEditDialog(client: ClientAdmin) {
    setSelectedClient(client);
    setEditForm({
      companyName: client.clientProfile?.companyName || '',
      maxDisplays: client.clientProfile?.maxDisplays?.toString() || '10',
      maxUsers: client.clientProfile?.maxUsers?.toString() || '5',
      maxStorageMB: client.clientProfile?.maxStorageMB?.toString() || '25',
      maxMonthlyUsageMB: (client.clientProfile as any)?.maxMonthlyUsageMB?.toString() || '150',
      licenseExpiry: client.clientProfile?.licenseExpiry ? 
        new Date(client.clientProfile.licenseExpiry).toISOString().split('T')[0] : '',
      contactEmail: client.clientProfile?.contactEmail || '',
      contactPhone: client.clientProfile?.contactPhone || '',
    });
    setEditOpen(true);
    setError('');
  }

  async function updateClient() {
    if (!selectedClient) return;

    try {
      setSaving(true);
      setError('');

      if (!editForm.companyName) {
        setError('Company Name is required.');
        return;
      }

      await api.put(`/users/client-admins/${selectedClient.id}`, {
        companyName: editForm.companyName,
        maxDisplays: Number(editForm.maxDisplays || 10),
        maxUsers: Number(editForm.maxUsers || 5),
        maxStorageMB: Number(editForm.maxStorageMB || 25),
        maxMonthlyUsageMB: Number(editForm.maxMonthlyUsageMB || 150),
        licenseExpiry: editForm.licenseExpiry || null,
        contactEmail: editForm.contactEmail || null,
        contactPhone: editForm.contactPhone || null,
      });

      setEditOpen(false);
      setSelectedClient(null);
      setEditForm({
        companyName: '',
        maxDisplays: '10',
        maxUsers: '5',
        maxStorageMB: '25',
        maxMonthlyUsageMB: '150',
        licenseExpiry: '',
        contactEmail: '',
        contactPhone: '',
      });

      await fetchClients();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update client');
    } finally {
      setSaving(false);
    }
  }

  function openDeleteDialog(client: ClientAdmin) {
    setSelectedClient(client);
    setDeleteOpen(true);
  }

  async function deleteClient() {
    if (!selectedClient) return;

    try {
      setSaving(true);
      
      await api.delete(`/users/client-admins/${selectedClient.id}`);
      
      setDeleteOpen(false);
      setSelectedClient(null);
      await fetchClients();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to delete client');
    } finally {
      setSaving(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8">
        {/* Header Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-500/10 rounded-3xl blur-3xl"></div>
          <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 border border-gray-800 shadow-2xl">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-10 w-10 text-yellow-400" />
                  <h1 className="text-4xl font-black text-white">Manage Clients</h1>
                </div>
                <p className="text-gray-300 text-lg">
                  Create, manage, and suspend tenant (Client Admin) accounts. Define commercial constraints.
                </p>
              </div>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="h-12 gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-bold shadow-lg hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105">
                    <Plus className="h-5 w-5" />
                    Add New Tenant
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] bg-white border border-gray-200 shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-gray-900">Add New Tenant (Client Admin)</DialogTitle>
                <DialogDescription className="text-gray-600">
                  Create a Client Admin user and define limits (max displays/users and license expiry).
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={form.companyName}
                      onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Max Displays</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.maxDisplays}
                      onChange={(e) => setForm({ ...form, maxDisplays: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Users</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.maxUsers}
                      onChange={(e) => setForm({ ...form, maxUsers: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Storage Limit (MB)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.maxStorageMB}
                      onChange={(e) => setForm({ ...form, maxStorageMB: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">Maximum disk space for stored files</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Usage Limit (MB)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.maxMonthlyUsageMB}
                      onChange={(e) => setForm({ ...form, maxMonthlyUsageMB: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">Maximum uploads per month (resets monthly)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>License Expiry</Label>
                    <Input
                      type="date"
                      value={form.licenseExpiry}
                      onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })}
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={createClient} disabled={saving} className="signomart-primary hover:signomart-primary">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    'Create Tenant'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by Client ID, Company Name, or Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 border-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
            />
          </div>
          {searchTerm && (
            <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-xl border border-yellow-200">
              <Building2 className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-semibold text-yellow-900">
                {filteredClients.length} of {clients.length} clients
              </span>
            </div>
          )}
        </div>

        {error && !loading && (
          <div className="rounded-md bg-red-50 p-4 border border-red-200">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError('')}
                  className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <p className="ml-3 text-gray-600">Loading client admins…</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Admin Email</TableHead>
                  <TableHead className="w-[160px]">Displays (Used / Max)</TableHead>
                  <TableHead className="w-[130px]">Max Users</TableHead>
                  <TableHead className="w-[140px]">Storage Limit</TableHead>
                  <TableHead className="w-[180px]">License</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[140px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((c) => {
                  const maxDisplays = c.clientProfile?.maxDisplays ?? 0;
                  const displaysUsed = c.displaysUsed ?? 0;
                  const maxStorageMB = c.clientProfile?.maxStorageMB ?? 25;
                  
                  // Determine license status badge
                  let licenseBadge = null;
                  if (c.licenseStatus === 'expired' || c.isExpired) {
                    licenseBadge = <Badge variant="destructive" className="ml-2">Expired</Badge>;
                  } else if (c.licenseStatus === 'suspended') {
                    licenseBadge = <Badge variant="destructive" className="ml-2">Suspended</Badge>;
                  } else if (c.licenseStatus === 'expiring_soon' && c.daysUntilExpiry !== null) {
                    licenseBadge = <Badge className="ml-2 bg-orange-500 hover:bg-orange-600">Expires in {c.daysUntilExpiry}d</Badge>;
                  }

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm font-medium">
                        {c.clientProfile?.clientId || '—'}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{c.clientProfile?.companyName || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>
                        {displaysUsed}/{maxDisplays || '—'}
                      </TableCell>
                      <TableCell>{c.clientProfile?.maxUsers ?? '—'}</TableCell>
                      <TableCell>{maxStorageMB}MB</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {fmtDate(c.clientProfile?.licenseExpiry)}
                          {licenseBadge}
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.isActive && c.licenseStatus !== 'expired' && c.licenseStatus !== 'suspended' ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="destructive">
                            {c.licenseStatus === 'expired' ? 'Expired' : 'Suspended'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => openEditDialog(c)}
                            disabled={saving}
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => toggleStatus(c.id)}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                            {c.isActive ? 'Suspend' : 'Activate'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-red-600 hover:text-red-700"
                            onClick={() => openDeleteDialog(c)}
                            disabled={saving}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredClients.length === 0 && clients.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500">
                      No clients found matching "{searchTerm}".
                    </TableCell>
                  </TableRow>
                )}
                {clients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500">
                      No Client Admins found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit Client Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => !saving && setEditOpen(v)}>
        <DialogContent className="sm:max-w-[560px] bg-white border border-gray-200 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Edit Client</DialogTitle>
            <DialogDescription className="text-gray-600">
              Update client limits and settings. Changes will be reflected immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  value={editForm.companyName}
                  onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={editForm.contactEmail}
                  onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input
                  value={editForm.contactPhone}
                  onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>License Expiry</Label>
                <Input
                  type="date"
                  value={editForm.licenseExpiry}
                  onChange={(e) => setEditForm({ ...editForm, licenseExpiry: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Max Displays</Label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.maxDisplays}
                  onChange={(e) => setEditForm({ ...editForm, maxDisplays: e.target.value })}
                />
                <p className="text-xs text-gray-500">
                  Current: {selectedClient?.displaysUsed || 0} displays
                </p>
              </div>
              <div className="space-y-2">
                <Label>Max Users</Label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.maxUsers}
                  onChange={(e) => setEditForm({ ...editForm, maxUsers: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Storage Limit (MB)</Label>
                <Input
                  type="number"
                  min="1"
                  value={editForm.maxStorageMB}
                  onChange={(e) => setEditForm({ ...editForm, maxStorageMB: e.target.value })}
                />
                <p className="text-xs text-gray-500">Maximum disk space</p>
              </div>
              <div className="space-y-2">
                <Label>Monthly Usage Limit (MB)</Label>
                <Input
                  type="number"
                  min="1"
                  value={editForm.maxMonthlyUsageMB}
                  onChange={(e) => setEditForm({ ...editForm, maxMonthlyUsageMB: e.target.value })}
                />
                <p className="text-xs text-gray-500">Monthly upload quota</p>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={updateClient} disabled={saving} className="signomart-primary hover:signomart-primary">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                'Update Client'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Client Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(v) => !saving && setDeleteOpen(v)}>
        <DialogContent className="sm:max-w-[420px] bg-white border border-gray-200 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Delete Client</DialogTitle>
            <DialogDescription className="text-gray-600">
              This action cannot be undone. This will permanently delete the client and all associated data.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="rounded-md bg-red-50 p-4 border border-red-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Warning: This will delete all data for:
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>{selectedClient?.clientProfile?.companyName}</strong></li>
                      <li>Client ID: {selectedClient?.clientProfile?.clientId}</li>
                      <li>All user accounts under this client</li>
                      <li>All displays, media, and playlists</li>
                      <li>All associated data and settings</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={deleteClient} 
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete Client'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

