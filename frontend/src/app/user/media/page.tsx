'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StorageIndicator } from '@/components/ui/storage-indicator';
import { cn } from '@/lib/utils';
import { Loader2, Trash2, Upload, Video, Calendar, HardDrive, Maximize2, Monitor, Image as ImageIcon, FileText, Check, Film } from 'lucide-react';
import AOS from 'aos';
import 'aos/dist/aos.css';

type MediaType = 'IMAGE' | 'VIDEO';

type Media = {
  id: string;
  name: string;
  originalName?: string | null;
  filename?: string | null;
  type: MediaType;
  url: string;
  fileSize?: number | null;
  mimeType?: string | null;
  endDate?: string | null;
  createdAt: string;
};

type StorageInfo = {
  limitMB: number;
  usedMB: number;
  availableMB: number;
};

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function MediaLibraryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const publicBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace('/api', '');

  const [media, setMedia] = useState<Media[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'images' | 'videos'>('all');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [endDate, setEndDate] = useState<string>('');
  const [orientation, setOrientation] = useState<'LANDSCAPE' | 'PORTRAIT'>('LANDSCAPE');
  const [displayMode, setDisplayMode] = useState<'fit' | 'fill' | 'stretch'>('fit');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Role access:
  // USER_ADMIN: full access
  // STAFF CONTENT_MANAGER: full access
  // STAFF DISPLAY_MANAGER: no access
  const hasAccess = useMemo(() => {
    if (!user) return false;
    if (user.role === 'USER_ADMIN') return true;
    if (user.role === 'STAFF' && user.staffRole === 'CONTENT_MANAGER') return true;
    // (Optional) allow Broadcast Manager too, since backend requireContentManagement allows it
    if (user.role === 'STAFF' && user.staffRole === 'BROADCAST_MANAGER') return true;
    return false;
  }, [user]);

  const canWrite = useMemo(() => {
    if (!user) return false;
    if (user.role === 'USER_ADMIN') return true;
    if (user.role === 'STAFF' && (user.staffRole === 'CONTENT_MANAGER' || user.staffRole === 'BROADCAST_MANAGER'))
      return true;
    return false;
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
    if (hasAccess) {
      fetchMedia();
    }
  }, [user, hasAccess]);

  async function fetchMedia() {
    try {
      setLoading(true);
      console.log('🔍 [FRONTEND DEBUG] Starting fetchMedia...');
      console.log('🔍 [FRONTEND DEBUG] Current user:', {
        id: user?.id,
        email: user?.email,
        role: user?.role,
        staffRole: user?.staffRole
      });
      
      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const res = await api.get(`/media?_t=${timestamp}`);
      console.log('📊 [FRONTEND DEBUG] Raw API response:', res);
      console.log('📊 [FRONTEND DEBUG] Response status:', res.status);
      console.log('📊 [FRONTEND DEBUG] Response headers:', res.headers);
      console.log('📊 [FRONTEND DEBUG] Response data structure:', {
        hasData: !!res.data,
        dataKeys: res.data ? Object.keys(res.data) : [],
        dataType: typeof res.data
      });
      console.log('📊 [FRONTEND DEBUG] Full response data:', res.data);
      
      // Check if response has the expected structure
      if (res.data) {
        console.log('📁 [FRONTEND DEBUG] Media array details:', {
          hasMediaProperty: 'media' in res.data,
          hasDataProperty: 'data' in res.data,
          mediaValue: res.data.media,
          dataValue: res.data.data,
          mediaType: typeof res.data.media,
          mediaLength: Array.isArray(res.data.media) ? res.data.media.length : 'not array',
          dataType: typeof res.data.data,
          dataLength: Array.isArray(res.data.data) ? res.data.data.length : 'not array'
        });
        
        console.log('💾 [FRONTEND DEBUG] Storage info:', res.data.storageInfo);
      }
      
      // Use the correct property based on pagination service format
      const mediaArray = res.data.data || res.data.media || [];
      console.log('📁 [FRONTEND DEBUG] Final media array:', mediaArray);
      console.log('📁 [FRONTEND DEBUG] Media array length:', mediaArray.length);
      
      if (mediaArray.length > 0) {
        console.log('📁 [FRONTEND DEBUG] First media item:', mediaArray[0]);
        console.log('📁 [FRONTEND DEBUG] Sample media items:', mediaArray.slice(0, 3).map((m: any) => ({     
          id: m.id,
          name: m.name,
          type: m.type,
          url: m.url,
          fileSize: m.fileSize
        })));
      }
      
      setMedia(mediaArray);
      setStorageInfo(res.data.storageInfo || null);
      } catch (e: any) {
     console.error('❌ [FRONTEND DEBUG] Error fetching media:', e);
     console.error('❌ [FRONTEND DEBUG] Error details:', {
       message: e?.message,
        response: e.response?.data,
        status: e.response?.status,
        statusText: e.response?.statusText
      });
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

  async function onPickFile(file: File) {
    if (!canWrite) return;

    // Check if storage info is available and if file would exceed limit
    if (storageInfo) {
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > storageInfo.availableMB) {
        alert(`File size (${fileSizeMB.toFixed(1)}MB) exceeds available storage (${storageInfo.availableMB.toFixed(1)}MB). Please delete some files first or contact your administrator.`);
        return;
      }
    }

    // 600MB individual file limit (server also enforces; supports large videos for HLS)
    const maxFileSizeBytes = 600 * 1024 * 1024;
    if (file.size > maxFileSizeBytes) {
      alert(`File too large. Max size is 600MB.`);
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'video/mp4'];
    if (!allowed.includes(file.type)) {
      alert('Only JPEG/PNG images and MP4 videos are allowed.');
      return;
    }

    setSelectedFile(file);
    setEndDate('');
    setOrientation('LANDSCAPE');
    setDisplayMode('fit');
    setShowUploadDialog(true);
  }

  async function onUpload() {
    if (!selectedFile || !canWrite) return;

    console.log('📤 [UPLOAD DEBUG] Starting upload process...');
    console.log('📤 [UPLOAD DEBUG] Selected file:', {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type
    });
    console.log('📤 [UPLOAD DEBUG] Upload settings:', {
      endDate,
      orientation,
      displayMode
    });

    const form = new FormData();
    form.append('file', selectedFile);
    form.append('name', selectedFile.name);
    
    if (endDate) {
      form.append('endDate', endDate);
    }
    
    // Add orientation and display mode metadata (can be stored as tags or in description)
    form.append('orientation', orientation);
    form.append('displayMode', displayMode);

    console.log('📤 [UPLOAD DEBUG] FormData entries:');
    for (let [key, value] of form.entries()) {
      console.log(`📤 [UPLOAD DEBUG] - ${key}:`, value instanceof File ? `File(${value.name})` : value);
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      console.log('📤 [UPLOAD DEBUG] Sending upload request...');
      const response = await api.post('/media', form, {
        // Increase timeout for media uploads (especially videos with HLS conversion)
        timeout: 300000, // 5 minutes for large video files
        // Don't set Content-Type manually - let axios/browser set it with boundary for FormData
        onUploadProgress: (evt) => {
          const total = evt.total ?? 0;
          if (!total) return;
          const progress = Math.round((evt.loaded / total) * 100);
          console.log(`📤 [UPLOAD DEBUG] Upload progress: ${progress}% (${evt.loaded}/${total})`);
          setUploadProgress(progress);
        },
      });

      console.log('✅ [UPLOAD DEBUG] Upload successful!');
      console.log('✅ [UPLOAD DEBUG] Response:', response.data);

      await fetchMedia();
      setShowUploadDialog(false);
      setSelectedFile(null);
      setEndDate('');
      setOrientation('LANDSCAPE');
      setDisplayMode('fit');
    } catch (e: any) {
      console.error('❌ [UPLOAD DEBUG] Upload failed:', e);
      console.error('❌ [UPLOAD DEBUG] Error response:', e.response?.data);
      console.error('❌ [UPLOAD DEBUG] Error status:', e.response?.status);
      
      const errorMessage = e?.response?.data?.message || 'Upload failed';
      const errorDetails = e?.response?.data?.details;
      
      if (errorDetails) {
        alert(`${errorMessage}\n\n${errorDetails}`);
      } else {
        alert(errorMessage);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function onDelete(id: string) {
    if (!canWrite) return;
    if (deletingIds.has(id)) {
      console.log('🔄 [DELETE DEBUG] Delete already in progress for:', id);
      return;
    }
    if (!confirm('Are you sure you want to delete this media file? This action cannot be undone.')) return;
    
    console.log('🗑️ [DELETE DEBUG] Starting delete process for media ID:', id);
    
    // Mark as deleting to prevent double-clicks
    setDeletingIds(prev => new Set(prev).add(id));
    
    // Optimistically remove from UI immediately
    const originalMedia = media;
    setMedia(prevMedia => prevMedia.filter(item => item.id !== id));
    
    try {
      console.log('🗑️ [DELETE DEBUG] Sending delete request...');
      const response = await api.delete(`/media/${id}`);
      console.log('✅ [DELETE DEBUG] Delete successful!');
      console.log('✅ [DELETE DEBUG] Response:', response.data);
      
      // Update storage info if provided in response
      if (response.data?.storageInfo) {
        console.log('💾 [DELETE DEBUG] Updating storage info:', response.data.storageInfo);
        setStorageInfo(response.data.storageInfo);
      }

      // Refresh the full list to ensure consistency
      console.log('🔄 [DELETE DEBUG] Refreshing media list');
      await fetchMedia();
    } catch (e: any) {
      console.error('❌ [DELETE DEBUG] Delete failed:', e);
      console.error('❌ [DELETE DEBUG] Error response:', e.response?.data);
      console.error('❌ [DELETE DEBUG] Error status:', e.response?.status);
      
      // Don't show error if it's just "not found" (already deleted)
      if (e.response?.status === 404) {
        console.log('ℹ️ [DELETE DEBUG] Item was already deleted, refreshing list');
        await fetchMedia();
      } else {
        // Restore the original media list on error
        console.log('🔄 [DELETE DEBUG] Restoring original media list due to error');
        setMedia(originalMedia);
        
        const errorMessage = e?.response?.data?.message || 'Delete failed';
        alert(errorMessage);
      }
    } finally {
      // Remove from deleting set
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }

  if (!hasAccess) {
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
      <div className="space-y-8 pb-8">
        {/* Header Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-500/10 rounded-3xl blur-3xl"></div>
          <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 border border-gray-800 shadow-2xl">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Film className="h-10 w-10 text-yellow-400" />
                  <h1 className="text-4xl font-black text-white">Media Library</h1>
                </div>
                <p className="text-gray-300 text-lg">Centralized media uploads (images/videos)</p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
                {storageInfo && (
                  <Card className="border-white/20 bg-white/10 backdrop-blur-xl shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <HardDrive className="h-5 w-5 text-yellow-400" />
                        <span className="text-sm font-bold text-white">Storage Usage</span>
                      </div>
                      <StorageIndicator storageInfo={storageInfo} />
                    </CardContent>
                  </Card>
                )}

                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,video/mp4"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onPickFile(f);
                    }}
                  />
                  <Button
                    onClick={() => {
                      console.log('🔄 [DEBUG] Force refreshing media list...');
                      fetchMedia();
                    }}
                    variant="outline"
                    className="h-12 gap-2 border-white/20 text-white hover:bg-white/10 font-semibold"
                  >
                    🔄 Refresh
                  </Button>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canWrite || uploading || (storageInfo?.availableMB ?? 0) <= 0}
                    className="h-12 gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-bold shadow-lg hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105"
                  >
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    Upload Media
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {uploading && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between text-sm mb-4">
              <span className="text-gray-700 font-bold text-lg">Uploading…</span>
              <span className="text-gray-900 font-black text-2xl">{uploadProgress}%</span>
            </div>
            <div className="h-4 w-full rounded-full bg-gray-200 overflow-hidden shadow-inner">
              <div
                className="h-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-300 ease-out shadow-lg"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="bg-gray-100 p-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-black font-semibold">All Media</TabsTrigger>
            <TabsTrigger value="images" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-black font-semibold">Images</TabsTrigger>
            <TabsTrigger value="videos" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-black font-semibold">Videos</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <p className="ml-3 text-gray-600">Loading media…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-600">No media found.</p>
            <p className="mt-2 text-sm text-gray-500">
              Upload JPEG/PNG images or MP4 videos (max 600MB per file).
            </p>
            {storageInfo && (
              <p className="mt-1 text-sm text-gray-500">
                Available storage: {storageInfo.availableMB.toFixed(1)}MB of {storageInfo.limitMB}MB
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((m) => {
              const title = m.originalName || m.name;
              const isImage = m.type === 'IMAGE';
              return (
                <Card key={m.id} className="overflow-hidden hover:shadow-2xl transition-all duration-300 hover:scale-105 border-gray-200 group">
                  <CardContent className="p-0">
                    <div className="relative aspect-video bg-gray-900 group">
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${publicBaseUrl}${m.url}`}
                          alt={title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            console.warn('🖼️ [IMAGE DEBUG] Failed to load image:', `${publicBaseUrl}${m.url}`);
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            // Show a placeholder instead
                            const placeholder = target.parentElement?.querySelector('.image-placeholder');
                            if (placeholder) {
                              (placeholder as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                          <Video className="h-12 w-12 opacity-70" />
                        </div>
                      )}

                      {/* Image placeholder for failed loads */}
                      {isImage && (
                        <div className="image-placeholder absolute inset-0 hidden items-center justify-center bg-gray-100 text-gray-400">
                          <div className="text-center">
                            <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">Image not found</p>
                          </div>
                        </div>
                      )}

                      {canWrite && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDelete(m.id);
                          }}
                          disabled={deletingIds.has(m.id)}
                          className={cn(
                            'absolute right-2 top-2 rounded-md p-2 text-white transition-all shadow-lg z-10',
                            deletingIds.has(m.id) 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                          )}
                          aria-label="Delete media"
                          title={deletingIds.has(m.id) ? "Deleting..." : "Delete media file"}
                        >
                          {deletingIds.has(m.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 p-4 bg-white">
                      <div className="line-clamp-2 text-sm font-medium text-gray-900 min-h-[2.5rem]">
                        {title}
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{m.type} • {formatBytes(m.fileSize)}</span>
                      </div>
                      {m.endDate && (
                        <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                          <Calendar className="h-3 w-3" />
                          <span>Expires: {new Date(m.endDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        if (!uploading) {
          setShowUploadDialog(open);
          if (!open) {
            setSelectedFile(null);
            setEndDate('');
            setOrientation('LANDSCAPE');
            setDisplayMode('fit');
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl font-bold">Upload Media</DialogTitle>
            <p className="text-sm text-gray-500 mt-1">Configure your media settings before uploading</p>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* File Preview Section */}
            {selectedFile && (
              <div className="rounded-lg border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {selectedFile.type.startsWith('image/') ? (
                      <div className="w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-blue-600" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Video className="h-8 w-8 text-purple-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="text-sm font-semibold text-gray-900 break-words">
                        {selectedFile.name}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Type:</span> {selectedFile.type}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Size:</span> {formatBytes(selectedFile.size)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Display Settings */}
            <div className="space-y-4">
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Display Settings
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Orientation */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Orientation</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => !uploading && setOrientation('LANDSCAPE')}
                        disabled={uploading}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all",
                          orientation === 'LANDSCAPE'
                            ? "border-yellow-500 bg-yellow-50 text-yellow-900 font-medium"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        {orientation === 'LANDSCAPE' && <Check className="h-4 w-4" />}
                        <span>Landscape</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => !uploading && setOrientation('PORTRAIT')}
                        disabled={uploading}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all",
                          orientation === 'PORTRAIT'
                            ? "border-yellow-500 bg-yellow-50 text-yellow-900 font-medium"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        {orientation === 'PORTRAIT' && <Check className="h-4 w-4" />}
                        <span>Portrait</span>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Preferred display orientation for this media
                    </p>
                  </div>

                  {/* Display Mode */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Display Mode</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => !uploading && setDisplayMode('fit')}
                        disabled={uploading}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border-2 transition-all",
                          displayMode === 'fit'
                            ? "border-yellow-500 bg-yellow-50 text-yellow-900 font-medium"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        )}
                        title="Fit to Screen - Maintains aspect ratio, fits within screen"
                      >
                        {displayMode === 'fit' && <Check className="h-3 w-3" />}
                        <Maximize2 className="h-4 w-4" />
                        <span className="text-xs">Fit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => !uploading && setDisplayMode('fill')}
                        disabled={uploading}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border-2 transition-all",
                          displayMode === 'fill'
                            ? "border-yellow-500 bg-yellow-50 text-yellow-900 font-medium"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        )}
                        title="Fill Screen - Fills entire screen, may crop edges"
                      >
                        {displayMode === 'fill' && <Check className="h-3 w-3" />}
                        <Monitor className="h-4 w-4" />
                        <span className="text-xs">Fill</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => !uploading && setDisplayMode('stretch')}
                        disabled={uploading}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border-2 transition-all",
                          displayMode === 'stretch'
                            ? "border-yellow-500 bg-yellow-50 text-yellow-900 font-medium"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        )}
                        title="Stretch to Fit - Stretches to fill screen, may distort"
                      >
                        {displayMode === 'stretch' && <Check className="h-3 w-3" />}
                        <Maximize2 className="h-4 w-4" />
                        <span className="text-xs">Stretch</span>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      How the media should be displayed on screen
                    </p>
                  </div>
                </div>
              </div>

              {/* Auto-delete Date */}
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="endDate" className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Auto-delete Date (Optional)
                </Label>
                <div className="relative">
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    placeholder="Select when to automatically delete this media"
                    disabled={uploading}
                    className="pr-10 h-11"
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded border border-blue-100">
                  💡 Leave empty to keep the media indefinitely. The file will be automatically deleted at the specified date and time.
                </p>
              </div>
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-3 rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 font-semibold flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading…
                  </span>
                  <span className="text-gray-700 font-bold">{uploadProgress}%</span>
                </div>
                <div className="h-3 w-full rounded-full bg-green-100 overflow-hidden shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300 ease-out shadow-sm"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4 gap-3">
            <Button
              variant="outline"
              onClick={() => {
                if (!uploading) {
                  setShowUploadDialog(false);
                  setSelectedFile(null);
                  setEndDate('');
                  setOrientation('LANDSCAPE');
                  setDisplayMode('fit');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }
              }}
              disabled={uploading}
              className="min-w-[100px]"
            >
              Cancel
            </Button>
            <Button 
              onClick={onUpload} 
              disabled={!selectedFile || uploading} 
              className="signomart-primary hover:signomart-primary min-w-[120px] font-semibold"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Media
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

