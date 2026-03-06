'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Eye, Monitor, Activity } from 'lucide-react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import AOS from 'aos';
import 'aos/dist/aos.css';

interface Playlist {
  id: string;
  name: string;
}

interface Layout {
  id: string;
  name: string;
}

interface Display {
  id: string;
  name: string | null;
  pairingCode: string | null;
  location: string | null;
  playlistId?: string | null;
  playlist?: Playlist | null;
  layoutId?: string | null;
  layout?: Layout | null;
  status: 'ONLINE' | 'OFFLINE' | 'PAIRING' | 'ERROR';
  lastHeartbeat: string | null;
  isPaired: boolean;
  createdAt: string;
}

export default function StaffDisplaysPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [displays, setDisplays] = useState<Display[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedDisplay, setSelectedDisplay] = useState<Display | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const isCMSViewer = user?.role === 'STAFF' && user?.staffRole === 'CMS_VIEWER';

  useEffect(() => {
    // Initialize AOS
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });

    if (!user) return;
    if (!isCMSViewer) {
      router.replace('/staff/dashboard');
      return;
    }
    fetchDisplays(false);
    
    // Set up polling every 10 seconds for status updates
    const interval = setInterval(() => {
      fetchDisplays(true);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [user, isCMSViewer, router]);

  async function fetchDisplays(isRefresh: boolean) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      
      const res = await api.get('/displays');
      // Backend returns { displays: [...] }
      setDisplays(res.data?.displays || res.data || []);
    } catch (e: any) {
      console.error('Failed to fetch displays:', e);
      setError(e?.response?.data?.error || e?.response?.data?.message || 'Failed to load displays');
      setDisplays([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const getStatusColor = (display: Display) => {
    if (display.status === 'ONLINE') return 'bg-green-500';
    if (display.status === 'OFFLINE') return 'bg-red-500';
    if (display.status === 'PAIRING') return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getStatusText = (display: Display) => {
    if (display.status === 'ONLINE') return 'Online';
    if (display.status === 'OFFLINE') return 'Offline';
    if (display.status === 'PAIRING') return 'Pairing';
    return 'Error';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const handleViewDisplay = async (displayId: string) => {
    try {
      const res = await api.get(`/displays/${displayId}`);
      setSelectedDisplay(res.data);
      setDetailDialogOpen(true);
    } catch (e: any) {
      console.error('Failed to fetch display details:', e);
      alert('Failed to load display details');
    }
  };

  if (!isCMSViewer) {
    return (
      <DashboardLayout>
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <p>You do not have access to this page.</p>
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
            <div className="flex items-center gap-4 flex-wrap">
              <Monitor className="h-10 w-10 text-yellow-400" />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-4xl font-black text-white">View Displays</h1>
                  {refreshing && (
                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-xl border border-white/20">
                      <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                      <span className="text-sm text-gray-300">Updating...</span>
                    </div>
                  )}
                </div>
                <p className="text-gray-300 text-lg">View displays in your organization (read-only)</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-red-800 border border-red-200" data-aos="fade-up">
            <p className="font-semibold mb-1">Error</p>
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12" data-aos="fade-up">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <p className="ml-3 text-gray-600">Loading displays…</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden" data-aos="fade-up" data-aos-delay="100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Last Heartbeat</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displays.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      No displays found.
                    </TableCell>
                  </TableRow>
                ) : (
                  displays.map((display) => (
                    <TableRow key={display.id}>
                      <TableCell className="font-medium">
                        {display.name || 'Unnamed Display'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${getStatusColor(display)}`}
                          />
                          <span className="text-sm">{getStatusText(display)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{display.location || '—'}</TableCell>
                      <TableCell>
                        {display.playlist ? (
                          <Badge variant="secondary">Playlist: {display.playlist.name}</Badge>
                        ) : display.layout ? (
                          <Badge variant="secondary">Layout: {display.layout.name}</Badge>
                        ) : (
                          <span className="text-gray-400">No content</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(display.lastHeartbeat)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => handleViewDisplay(display.id)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-blue-600 hover:bg-blue-50"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Display Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-2xl bg-white">
            <DialogHeader>
              <DialogTitle>Display Details</DialogTitle>
              <DialogDescription>View information about this display</DialogDescription>
            </DialogHeader>
            {selectedDisplay && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Name</p>
                    <p className="text-sm text-gray-900">{selectedDisplay.name || 'Unnamed Display'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Status</p>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${getStatusColor(selectedDisplay)}`} />
                      <span className="text-sm">{getStatusText(selectedDisplay)}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Location</p>
                    <p className="text-sm text-gray-900">{selectedDisplay.location || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Pairing Code</p>
                    <p className="text-sm font-mono text-gray-900">{selectedDisplay.pairingCode || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Last Heartbeat</p>
                    <p className="text-sm text-gray-900">{formatDate(selectedDisplay.lastHeartbeat)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Created</p>
                    <p className="text-sm text-gray-900">{formatDate(selectedDisplay.createdAt)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Assigned Content</p>
                  {selectedDisplay.playlist ? (
                    <Badge variant="secondary">Playlist: {selectedDisplay.playlist.name}</Badge>
                  ) : selectedDisplay.layout ? (
                    <Badge variant="secondary">Layout: {selectedDisplay.layout.name}</Badge>
                  ) : (
                    <span className="text-sm text-gray-400">No content assigned</span>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
