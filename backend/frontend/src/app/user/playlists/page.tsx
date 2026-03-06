'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Pencil, Music, Clock, ListMusic } from 'lucide-react';
import AOS from 'aos';
import 'aos/dist/aos.css';

type Playlist = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  _count?: { 
    items: number;
    displays: number;
  };
};

export default function PlaylistsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const access = useMemo(() => {
    if (!user) return { canRead: false, canWrite: false };
    if (user.role === 'USER_ADMIN') return { canRead: true, canWrite: true };
    if (user.role === 'STAFF' && user.staffRole === 'BROADCAST_MANAGER') return { canRead: true, canWrite: true };
    if (user.role === 'STAFF' && user.staffRole === 'CONTENT_MANAGER') return { canRead: true, canWrite: false };
    if (user.role === 'STAFF' && user.staffRole === 'DISPLAY_MANAGER') return { canRead: false, canWrite: false };
    return { canRead: false, canWrite: false };
  }, [user]);

  useEffect(() => {
    // Initialize AOS
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });

    if (!user) return;
    if (user.role === 'STAFF' && user.staffRole === 'DISPLAY_MANAGER') {
      router.replace('/user/dashboard');
      return;
    }
    if (access.canRead) fetchPlaylists();
  }, [user, access.canRead, router]);

  async function fetchPlaylists() {
    try {
      setLoading(true);
      const res = await api.get('/playlists');
      setPlaylists(res.data.playlists ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load playlists');
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  }

  async function createPlaylist() {
    if (!access.canWrite) return;
    if (!name.trim()) {
      setError('Playlist name is required');
      return;
    }
    setError('');
    try {
      setCreating(true);
      const res = await api.post('/playlists', { name: name.trim() });
      const playlistId = res.data?.playlist?.id;
      setCreateOpen(false);
      setName('');
      await fetchPlaylists();
      if (playlistId) router.push(`/user/playlists/${playlistId}`);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create playlist');
    } finally {
      setCreating(false);
    }
  }

  async function deletePlaylist(id: string) {
    if (!access.canWrite) return;
    if (!confirm('Delete this playlist? This action cannot be undone.')) return;
    try {
      await api.delete(`/playlists/${id}`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await fetchPlaylists();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete playlist');
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === playlists.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(playlists.map((p) => p.id)));
    }
  }

  async function deleteSelected() {
    if (!access.canWrite || selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected playlist(s)? This action cannot be undone.`)) return;
    setError('');
    setDeleting(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) => api.delete(`/playlists/${id}`))
      );
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (failed.length > 0) {
        const messages = failed.map((f) => (f.reason?.response?.data?.message || f.reason?.message || 'Delete failed')).join('; ');
        setError(messages);
      }
      setSelectedIds(new Set());
      await fetchPlaylists();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete playlists');
    } finally {
      setDeleting(false);
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!access.canRead) {
    return (
      <DashboardLayout>
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          You do not have access to Playlists.
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
                  <ListMusic className="h-10 w-10 text-yellow-400" />
                  <h1 className="text-4xl font-black text-white">Playlists</h1>
                </div>
                <p className="text-gray-300 text-lg">Create and manage your content playlists</p>
              </div>

              <div className="flex items-center gap-3">
                {access.canWrite && selectedIds.size > 0 && (
                  <Button
                    variant="destructive"
                    onClick={deleteSelected}
                    disabled={deleting}
                    className="h-12 gap-2 bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg"
                  >
                    {deleting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Trash2 className="h-5 w-5" />
                    )}
                    Delete ({selectedIds.size})
                  </Button>
                )}
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button disabled={!access.canWrite} className="h-12 gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-bold shadow-lg hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105">
                  <Plus className="h-5 w-5" />
                  Create Playlist
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[420px] bg-white">
                <DialogHeader>
                  <DialogTitle className="text-2xl">Create New Playlist</DialogTitle>
                  <DialogDescription className="text-base">Enter a name for your new playlist.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="playlistName" className="text-sm font-semibold">Playlist Name</Label>
                  <Input
                    id="playlistName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Morning Loop"
                    disabled={creating}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !creating) {
                        createPlaylist();
                      }
                    }}
                  />
                </div>
                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                    {error}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button onClick={createPlaylist} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    'Create'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <p className="ml-3 text-gray-600">Loading playlists…</p>
          </div>
        ) : playlists.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-16 text-center">
            <Music className="mx-auto h-16 w-16 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No playlists yet</h3>
            <p className="mt-2 text-sm text-gray-600">Create your first playlist to start building content sequences</p>
            {access.canWrite && (
              <Button
                className="mt-6 gap-2"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Create Playlist
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  {access.canWrite && (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={playlists.length > 0 && selectedIds.size === playlists.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300"
                        aria-label="Select all playlists"
                      />
                    </TableHead>
                  )}
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="w-[140px]">Items</TableHead>
                  <TableHead className="w-[180px]">Last Updated</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[140px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playlists.map((p) => {
                  const itemCount = p._count?.items ?? 0;
                  const isActive = (p._count?.displays ?? 0) > 0;
                  
                  return (
                    <TableRow key={p.id} className="hover:bg-gray-50">
                      {access.canWrite && (
                        <TableCell className="w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            className="h-4 w-4 rounded border-gray-300"
                            aria-label={`Select ${p.name}`}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="font-semibold text-gray-900">{p.name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <Music className="h-3 w-3" />
                          {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {formatDate(p.updatedAt || p.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              isActive ? 'bg-green-500' : 'bg-gray-400'
                            }`}
                          />
                          <span className="text-sm font-medium">
                            {isActive ? 'Active' : 'Idle'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => router.push(`/user/playlists/${p.id}`)}
                            title={access.canWrite ? 'Edit' : 'View'}
                            className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {access.canWrite && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => deletePlaylist(p.id)}
                              title="Delete"
                              className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
