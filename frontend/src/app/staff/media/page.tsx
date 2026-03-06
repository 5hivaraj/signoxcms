'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Image as ImageIcon, Video, HardDrive, FolderOpen } from 'lucide-react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { StorageIndicator } from '@/components/ui/storage-indicator';
import AOS from 'aos';
import 'aos/dist/aos.css';

type Media = {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO';
  url: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  endDate?: string | null;
  tags?: string[];
};

type StorageInfo = {
  totalMB: number;
  usedMB: number;
  availableMB: number;
  limitMB: number; // ← REQUIRED

};

export default function StaffMediaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const publicBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace('/api', '');

  const [media, setMedia] = useState<Media[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'images' | 'videos'>('all');

  const isCMSViewer = user?.role === 'STAFF' && user?.staffRole === 'CMS_VIEWER';

  useEffect(() => {
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
    fetchMedia();
  }, [user, isCMSViewer, router]);

  async function fetchMedia() {
    try {
      setLoading(true);
      console.log('🔍 [STAFF DEBUG] Starting fetchMedia...');
      console.log('🔍 [STAFF DEBUG] Current user:', {
        id: user?.id,
        email: user?.email,
        role: user?.role,
        staffRole: user?.staffRole
      });
      
      const res = await api.get('/media');
      console.log('📊 [STAFF DEBUG] Raw API response:', res);
      console.log('📊 [STAFF DEBUG] Response data:', res.data);
      console.log('📁 [STAFF DEBUG] Media property:', res.data.media);
      console.log('📁 [STAFF DEBUG] Data property:', res.data.data);
      console.log('💾 [STAFF DEBUG] Storage info:', res.data.storageInfo);
      
      // Use the correct property based on pagination service format
      const mediaArray = res.data.data || res.data.media || [];
      console.log('📁 [STAFF DEBUG] Final media array:', mediaArray);
      console.log('📁 [STAFF DEBUG] Media count:', mediaArray.length);
      
      setMedia(mediaArray);
      setStorageInfo(res.data.storageInfo || null);
    } catch (e: any) {
      console.error('❌ [STAFF DEBUG] Failed to fetch media:', e);
      console.error('❌ [STAFF DEBUG] Error response:', e.response?.data);
      setMedia([]);
      setStorageInfo(null);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (tab === 'images') return media.filter((m) => m.type === 'IMAGE');
    if (tab === 'videos') return media.filter((m) => m.type === 'VIDEO');
    return media;
  }, [media, tab]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!isCMSViewer) {
    return (
      <DashboardLayout>
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          You do not have access to the Media Library.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with gradient background */}
        <div 
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-black p-8 shadow-2xl"
          data-aos="fade-down"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-500/10"></div>
          <div className="relative">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 p-3 shadow-lg">
                  <FolderOpen className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white">View Media Library</h1>
                  <p className="mt-2 text-gray-300">Browse media files in your organization (read-only)</p>
                </div>
              </div>

              {storageInfo && (
                <Card className="w-full sm:w-80 bg-white/10 backdrop-blur-sm border-white/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <HardDrive className="h-4 w-4 text-gray-300" />
                      <span className="text-sm font-medium text-gray-200">Storage Usage</span>
                    </div>
                    <StorageIndicator storageInfo={storageInfo} />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All ({media.length})</TabsTrigger>
            <TabsTrigger value="images">
              Images ({media.filter((m) => m.type === 'IMAGE').length})
            </TabsTrigger>
            <TabsTrigger value="videos">
              Videos ({media.filter((m) => m.type === 'VIDEO').length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <p className="ml-3 text-gray-600">Loading media…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div 
            className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-lg"
            data-aos="fade-up"
          >
            <p className="text-gray-500">No media files found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((item, index) => (
              <Card 
                key={item.id} 
                className="overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
                data-aos="fade-up"
                data-aos-delay={Math.min(index * 50, 500)}
              >
                <CardContent className="p-0">
                  <div className="relative aspect-video bg-gray-100">
                    {item.type === 'IMAGE' ? (
                      <img
                        src={`${publicBaseUrl}${item.url}`}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle" dy=".3em"%3EFailed to load%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gray-900">
                        <Video className="h-12 w-12 text-white opacity-50" />
                      </div>
                    )}
                    {item.endDate && new Date(item.endDate) < new Date() && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                        <Badge variant="destructive">Expired</Badge>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                      <span>{formatFileSize(item.fileSize)}</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                    {item.endDate && (
                      <div className="mt-1 text-xs text-orange-600">
                        Expires: {formatDate(item.endDate)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
