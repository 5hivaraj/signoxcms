/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Monitor, Activity, Loader2 } from 'lucide-react';
import AOS from 'aos';
import 'aos/dist/aos.css';

type DisplayStatus = 'ONLINE' | 'OFFLINE' | 'PAIRING' | 'ERROR';

interface Display {
  id: string;
  name: string | null;
  location: string | null;
  status: DisplayStatus;
  pairingCode: string | null;
  managedByUser?: {
    email: string;
  } | null;
}

function getStatusColor(status: DisplayStatus) {
  if (status === 'ONLINE') return 'bg-green-500';
  if (status === 'OFFLINE') return 'bg-red-500';
  if (status === 'PAIRING') return 'bg-yellow-500';
  return 'bg-gray-400';
}

function getStatusText(status: DisplayStatus) {
  if (status === 'ONLINE') return 'Online';
  if (status === 'OFFLINE') return 'Offline';
  if (status === 'PAIRING') return 'Pairing';
  return 'Error';
}

export default function ClientDisplaysPage() {
  const { user } = useAuth();
  const [displays, setDisplays] = useState<Display[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const isClientAdmin = user?.role === 'CLIENT_ADMIN';

  useEffect(() => {
    if (!isClientAdmin) return;
    
    // Initial fetch
    // Initialize AOS
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });

    fetchDisplays(false);
    
    // Set up polling every 10 seconds for status updates
    const interval = setInterval(() => {
      fetchDisplays(true); // Pass true to indicate this is a refresh
    }, 10000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [isClientAdmin]);

  async function fetchDisplays(isRefresh = false) {
    try {
      if (!isRefresh) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError('');
      const res = await api.get('/displays');
      // Backend returns { displays: [...] }
      setDisplays(res.data?.displays || res.data || []);
    } catch (e: any) {
      console.error('Failed to fetch displays:', e);
      if (!isRefresh) {
        setError('Failed to load displays. Please try again.');
        setDisplays([]);
      }
    } finally {
      if (!isRefresh) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }

  if (!isClientAdmin) {
    return (
      <DashboardLayout>
        <div className="p-6 text-red-600">You do not have access to this page.</div>
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
            <div className="flex items-center gap-4 flex-wrap">
              <Monitor className="h-10 w-10 text-yellow-400" />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-4xl font-black text-white">Tenant Displays</h1>
                  {refreshing && (
                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-xl border border-white/20">
                      <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                      <span className="text-sm text-gray-300">Updating...</span>
                    </div>
                  )}
                </div>
                <p className="text-gray-300 text-lg">
                  Read-only view of all displays across your User Admins.
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-200">
            <p className="font-semibold mb-1">Error</p>
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <p className="ml-3 text-gray-600">Loading displays…</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Assigned User</TableHead>
                  <TableHead>Pairing Code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displays.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${getStatusColor(d.status)}`}
                        />
                        <span className="text-sm text-gray-700">{getStatusText(d.status)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {d.name || 'Unnamed Display'}
                    </TableCell>
                    <TableCell>{d.location || '—'}</TableCell>
                    <TableCell>{d.managedByUser?.email || '—'}</TableCell>
                    <TableCell>
                      <code className="rounded bg-gray-100 px-2 py-1 text-sm">
                        {d.pairingCode || 'N/A'}
                      </code>
                    </TableCell>
                  </TableRow>
                ))}
                {displays.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                      No displays found for this tenant.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

