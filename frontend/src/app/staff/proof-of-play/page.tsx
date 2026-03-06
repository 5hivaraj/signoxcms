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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Monitor, Play, Clock, FileText, Activity } from 'lucide-react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import AOS from 'aos';
import 'aos/dist/aos.css';

interface MediaItem {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO';
  url: string;
  order: number;
  duration?: number | null;
  section?: string;
}

interface Content {
  type: 'playlist' | 'layout' | null;
  name: string | null;
  mediaItems: MediaItem[];
}

interface Display {
  id: string;
  name: string;
  location: string | null;
  status: 'ONLINE' | 'OFFLINE';
  lastHeartbeat: string | null;
  lastSeenAt: string | null;
  pairedAt: string | null;
  createdAt: string;
}

interface ProofOfPlayItem {
  display: Display;
  content: Content;
  managedBy: {
    id: string;
    email: string;
  } | null;
}

export default function ProofOfPlayPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [proofOfPlay, setProofOfPlay] = useState<ProofOfPlayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDisplay, setSelectedDisplay] = useState<ProofOfPlayItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const isPOPManager = user?.role === 'STAFF' && user?.staffRole === 'POP_MANAGER';

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });
    if (!user) return;
    if (!isPOPManager) {
      router.replace('/staff/dashboard');
      return;
    }
    fetchProofOfPlay();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchProofOfPlay();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [user, isPOPManager, router]);

  async function fetchProofOfPlay() {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/proof-of-play');
      setProofOfPlay(res.data.proofOfPlay || []);
    } catch (e: any) {
      console.error('Failed to fetch proof of play:', e);
      setError(e?.response?.data?.message || 'Failed to load proof of play data');
      setProofOfPlay([]);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '—';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const handleViewDetails = (item: ProofOfPlayItem) => {
    setSelectedDisplay(item);
    setShowDetails(true);
  };

  if (!isPOPManager) {
    return (
      <DashboardLayout>
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <p>You do not have access to this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  const onlineCount = proofOfPlay.filter(item => item.display.status === 'ONLINE').length;
  const offlineCount = proofOfPlay.filter(item => item.display.status === 'OFFLINE').length;
  const totalMediaItems = proofOfPlay.reduce((sum, item) => sum + item.content.mediaItems.length, 0);

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
              <Activity className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Proof of Play</h1>
              <p className="mt-2 text-gray-300">Track display activity and content playback</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="rounded-2xl shadow-lg" data-aos="fade-up" data-aos-delay="100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Displays</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{proofOfPlay.length}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-lg" data-aos="fade-up" data-aos-delay="200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Online</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{onlineCount}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-lg" data-aos="fade-up" data-aos-delay="300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Offline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{offlineCount}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-lg" data-aos="fade-up" data-aos-delay="400">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Media Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalMediaItems}</div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div 
            className="rounded-2xl bg-red-50 p-4 text-red-800 shadow-lg"
            data-aos="fade-up"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <p className="ml-3 text-gray-600">Loading proof of play data…</p>
          </div>
        ) : (
          <div 
            className="rounded-2xl border border-gray-200 bg-white shadow-lg"
            data-aos="fade-up"
            data-aos-delay="500"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Display</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Media Items</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proofOfPlay.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No displays found.
                    </TableCell>
                  </TableRow>
                ) : (
                  proofOfPlay.map((item) => (
                    <TableRow key={item.display.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-gray-400" />
                          {item.display.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              item.display.status === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'
                            }`}
                          />
                          <span className="text-sm">
                            {item.display.status === 'ONLINE' ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{item.display.location || '—'}</TableCell>
                      <TableCell>
                        {item.content.type ? (
                          <Badge variant="secondary">
                            {item.content.type === 'playlist' ? (
                              <Play className="h-3 w-3 mr-1" />
                            ) : (
                              <FileText className="h-3 w-3 mr-1" />
                            )}
                            {item.content.name || 'Unnamed'}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">No content</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {item.content.mediaItems.length} items
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(item.display.lastHeartbeat)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => handleViewDetails(item)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-blue-600 hover:bg-blue-50"
                          title="View Details"
                        >
                          <Clock className="h-4 w-4" />
                          Details
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Details Dialog */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
            {selectedDisplay && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedDisplay.display.name} - Details</DialogTitle>
                  <DialogDescription>View detailed proof of play information</DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Display Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Display Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Status</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                selectedDisplay.display.status === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'
                              }`}
                            />
                            <span className="text-sm">{selectedDisplay.display.status}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Location</p>
                          <p className="text-sm text-gray-900">{selectedDisplay.display.location || '—'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Last Heartbeat</p>
                          <p className="text-sm text-gray-900">{formatDate(selectedDisplay.display.lastHeartbeat)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Paired At</p>
                          <p className="text-sm text-gray-900">{formatDate(selectedDisplay.display.pairedAt)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Content Information */}
                  {selectedDisplay.content.type && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          {selectedDisplay.content.type === 'playlist' ? 'Playlist' : 'Layout'}: {selectedDisplay.content.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedDisplay.content.mediaItems.length === 0 ? (
                          <p className="text-gray-500">No media items in this content.</p>
                        ) : (
                          <div className="space-y-2">
                            {selectedDisplay.content.mediaItems.map((media, index) => (
                              <div
                                key={media.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-medium text-gray-500 w-8">
                                    #{index + 1}
                                  </span>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{media.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-xs">
                                        {media.type}
                                      </Badge>
                                      {media.section && (
                                        <Badge variant="secondary" className="text-xs">
                                          {media.section}
                                        </Badge>
                                      )}
                                      {media.duration && (
                                        <span className="text-xs text-gray-500">
                                          {formatDuration(media.duration)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
