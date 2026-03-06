'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Save, 
  X, 
  Image as ImageIcon, 
  Video, 
  Loader2, 
  Search,
  Clock,
  GripVertical,
  FileVideo,
  FileImage,
  RefreshCw,
  ListMusic,
  ArrowLeft,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import api from '@/lib/api';
import AOS from 'aos';
import 'aos/dist/aos.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface Media {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO';
  url: string;
  duration?: number;
  fileSize?: number;
}

type OrientationType = 'LANDSCAPE' | 'PORTRAIT';
type ResizeModeType = 'FIT' | 'FILL' | 'STRETCH';
type RotationDeg = 0 | 90 | 180 | 270;

interface PlaylistItem {
  mediaId: string;
  duration?: number;
  order: number;
  loopVideo?: boolean;
  orientation?: OrientationType;
  resizeMode?: ResizeModeType;
  rotation?: RotationDeg;
  media?: Media;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  items: PlaylistItem[];
}

const objectFitClass: Record<ResizeModeType, string> = {
  FIT: 'object-contain',
  FILL: 'object-cover',
  STRETCH: 'object-fill',
};

function SortableItem({
  item,
  media,
  onDurationChange,
  onLoopChange,
  onOrientationChange,
  onResizeModeChange,
  onRotationChange,
  onRemove,
  canEdit,
}: {
  item: PlaylistItem;
  media: Media | undefined;
  onDurationChange: (mediaId: string, duration: number) => void;
  onLoopChange: (mediaId: string, loopVideo: boolean) => void;
  onOrientationChange: (mediaId: string, orientation: OrientationType) => void;
  onResizeModeChange: (mediaId: string, resizeMode: ResizeModeType) => void;
  onRotationChange: (mediaId: string, rotation: RotationDeg) => void;
  onRemove: (mediaId: string) => void;
  canEdit: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.mediaId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!media) return null;

  const thumbnailUrl = `${API_URL.replace('/api', '')}${media.url}`;
  const isImage = media.type === 'IMAGE';
  const currentDuration = item.duration ?? (isImage ? 10 : media.duration || 30);
  const orientation = item.orientation ?? 'LANDSCAPE';
  const resizeMode = item.resizeMode ?? 'FIT';
  const rotation = (item.rotation ?? 0) as RotationDeg;
  const fitClass = objectFitClass[resizeMode];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm transition-all ${
        isDragging ? 'shadow-lg' : 'hover:shadow-md'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-5 w-5" />
      </div>

      {/* Thumbnail with resize + rotation preview */}
      <div
        className={`h-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center ${(orientation === 'PORTRAIT' || rotation === 90 || rotation === 270) ? 'w-11 aspect-[9/16]' : 'w-20'}`}
        title={`${orientation} • ${resizeMode} • ${rotation}°`}
      >
        {isImage ? (
          <img
            src={thumbnailUrl}
            alt={media.name}
            className={`h-full w-full bg-black ${fitClass}`}
            style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gray-800">
            <FileVideo className="h-8 w-8 text-white" />
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isImage ? (
            <FileImage className="h-4 w-4 text-blue-500 flex-shrink-0" />
          ) : (
            <FileVideo className="h-4 w-4 text-purple-500 flex-shrink-0" />
          )}
          <p className="font-semibold text-gray-900 truncate">{media.name}</p>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {isImage ? 'Image' : 'Video'} • {media.fileSize ? `${(media.fileSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
        </p>
      </div>

      {/* Orientation & Resize */}
      {canEdit && (
        <div className="flex flex-col gap-1 shrink-0">
          <Label className="text-xs text-gray-600">Orientation</Label>
          <select
            value={orientation}
            onChange={(e) => onOrientationChange(item.mediaId, e.target.value as OrientationType)}
            className="h-9 w-[110px] rounded-md border border-gray-300 px-2 text-sm"
          >
            <option value="LANDSCAPE">Landscape</option>
            <option value="PORTRAIT">Portrait</option>
          </select>
        </div>
      )}
      {canEdit && (
        <div className="flex flex-col gap-1 shrink-0">
          <Label className="text-xs text-gray-600">Resize</Label>
          <select
            value={resizeMode}
            onChange={(e) => onResizeModeChange(item.mediaId, e.target.value as ResizeModeType)}
            className="h-9 w-[100px] rounded-md border border-gray-300 px-2 text-sm"
          >
            <option value="FIT">Fit</option>
            <option value="FILL">Fill</option>
            <option value="STRETCH">Stretch</option>
          </select>
        </div>
      )}
      {canEdit && (
        <div className="flex flex-col gap-1 shrink-0">
          <Label className="text-xs text-gray-600">Rotation</Label>
          <select
            value={rotation}
            onChange={(e) => onRotationChange(item.mediaId, Number(e.target.value) as RotationDeg)}
            className="h-9 w-[90px] rounded-md border border-gray-300 px-2 text-sm"
          >
            <option value={0}>0°</option>
            <option value={90}>90°</option>
            <option value={180}>180°</option>
            <option value={270}>270°</option>
          </select>
        </div>
      )}

      {/* Duration Input + Loop (videos only) */}
      <div className="flex items-center gap-2">
        <div className="w-24">
          <Label htmlFor={`duration-${item.mediaId}`} className="text-xs text-gray-600 mb-1 block">
            Duration (s)
          </Label>
          <Input
            id={`duration-${item.mediaId}`}
            type="number"
            min="1"
            value={currentDuration}
            onChange={(e) => {
              const duration = parseInt(e.target.value) || (isImage ? 10 : 30);
              onDurationChange(item.mediaId, duration);
            }}
            disabled={!canEdit}
            className="h-9 text-sm"
          />
        </div>

        {!isImage && canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="checkbox"
              id={`loop-${item.mediaId}`}
              checked={!!item.loopVideo}
              onChange={(e) => onLoopChange(item.mediaId, e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor={`loop-${item.mediaId}`} className="text-xs text-gray-600 whitespace-nowrap cursor-pointer">
              Loop video
            </Label>
          </div>
        )}

        {canEdit && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => onRemove(item.mediaId)}
            className="h-9 w-9 text-red-600 hover:bg-red-50 hover:text-red-700"
            title="Remove"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function AddToPlaylistDialog({
  media,
  open,
  onOpenChange,
  onConfirm,
}: {
  media: Media | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (orientation: OrientationType, resizeMode: ResizeModeType, rotation: RotationDeg) => void;
}) {
  const [orientation, setOrientation] = useState<OrientationType>('LANDSCAPE');
  const [resizeMode, setResizeMode] = useState<ResizeModeType>('FIT');
  const [rotation, setRotation] = useState<RotationDeg>(0);

  useEffect(() => {
    if (open) {
      setOrientation('LANDSCAPE');
      setResizeMode('FIT');
      setRotation(0);
    }
  }, [open]);

  if (!media) return null;

  const thumbnailUrl = `${API_URL.replace('/api', '')}${media.url}`;
  const isImage = media.type === 'IMAGE';
  const fitClass = objectFitClass[resizeMode];
  const isPortrait = orientation === 'PORTRAIT';
  // When image is rotated 90 or 270, its effective aspect is swapped — use portrait frame so rotated image fits
  const usePortraitFrame = isPortrait || rotation === 90 || rotation === 270;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to playlist</DialogTitle>
          <DialogDescription>
            Set orientation, rotation, and resize for &quot;{media.name}&quot;
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Orientation</Label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as OrientationType)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="LANDSCAPE">Landscape</option>
                <option value="PORTRAIT">Portrait</option>
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium">Rotation</Label>
              <select
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value) as RotationDeg)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value={0}>0°</option>
                <option value={90}>90° CW</option>
                <option value={180}>180°</option>
                <option value={270}>270° (90° CCW)</option>
              </select>
              <p className="text-xs text-gray-500 mt-0.5">Turn the image</p>
            </div>
            <div className="col-span-2">
              <Label className="text-sm font-medium">Resize</Label>
              <select
                value={resizeMode}
                onChange={(e) => setResizeMode(e.target.value as ResizeModeType)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="FIT">Fit (contain)</option>
                <option value="FILL">Fill (cover)</option>
                <option value="STRETCH">Stretch</option>
              </select>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Preview</Label>
            <div
              className={`mx-auto overflow-hidden rounded-lg border-2 border-gray-200 bg-black flex items-center justify-center relative ${
                usePortraitFrame ? 'w-32 aspect-[9/16]' : 'w-full max-w-xs aspect-video'
              }`}
            >
              {isImage ? (
                (rotation === 90 || rotation === 270) ? (
                  <div
                    className="absolute flex items-center justify-center"
                    style={{
                      width: usePortraitFrame ? '177.78%' : '56.25%',
                      height: usePortraitFrame ? '56.25%' : '177.78%',
                      left: '50%',
                      top: '50%',
                      transform: `translate(-50%, -50%) rotate(${rotation === 90 ? -90 : 90}deg)`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <img
                      src={thumbnailUrl}
                      alt={media.name}
                      className={`${fitClass} w-full h-full`}
                    />
                  </div>
                ) : (
                  <img
                    src={thumbnailUrl}
                    alt={media.name}
                    className={`${fitClass} w-full h-full`}
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transformOrigin: 'center center',
                    }}
                  />
                )
              ) : (
                <div className="flex h-full items-center justify-center">
                  <FileVideo className="h-12 w-12 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(orientation, resizeMode, rotation)}>
            Add to playlist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MediaCard({ media, isInPlaylist, onAdd, canEdit }: { 
  media: Media; 
  isInPlaylist: boolean;
  onAdd: () => void;
  canEdit: boolean;
}) {
  const thumbnailUrl = `${API_URL.replace('/api', '')}${media.url}`;
  const isImage = media.type === 'IMAGE';

  return (
    <Card
      className={`cursor-pointer overflow-hidden transition-all hover:shadow-lg ${
        isInPlaylist ? 'opacity-50 ring-2 ring-blue-300' : 'hover:ring-2 hover:ring-blue-200'
      } ${canEdit ? '' : 'cursor-not-allowed'}`}
      onClick={() => !isInPlaylist && canEdit && onAdd()}
    >
      <div className="aspect-square overflow-hidden bg-gray-100 relative">
        {isImage ? (
          <img
            src={thumbnailUrl}
            alt={media.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gray-800">
            <FileVideo className="h-12 w-12 text-white" />
          </div>
        )}
        {isInPlaylist && (
          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
            <div className="bg-blue-500 text-white text-xs font-semibold px-2 py-1 rounded">
              Added
            </div>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          {isImage ? (
            <FileImage className="h-3 w-3 text-blue-500" />
          ) : (
            <FileVideo className="h-3 w-3 text-purple-500" />
          )}
          <p className="truncate text-xs font-medium text-gray-900">{media.name}</p>
        </div>
        <p className="text-xs text-gray-500">{isImage ? 'Image' : 'Video'}</p>
      </div>
    </Card>
  );
}

export default function PlaylistEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const playlistId = (params?.id as string) || '';

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [playlistName, setPlaylistName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addDialogMedia, setAddDialogMedia] = useState<Media | null>(null);
  const [refreshingMedia, setRefreshingMedia] = useState(false);

  const canEdit = user?.role === 'USER_ADMIN' || user?.staffRole === 'BROADCAST_MANAGER';
  const canView = canEdit || user?.staffRole === 'CONTENT_MANAGER';

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter media by search query
  const filteredMedia = useMemo(() => {
    if (!searchQuery.trim()) return media;
    const query = searchQuery.toLowerCase();
    return media.filter((m) => m.name.toLowerCase().includes(query));
  }, [media, searchQuery]);

  // Calculate total duration
  const totalDuration = useMemo(() => {
    return items.reduce((sum, item) => {
      const mediaItem = item.media || media.find((m) => m.id === item.mediaId);
      const duration = item.duration ?? (mediaItem?.type === 'IMAGE' ? 10 : mediaItem?.duration || 30);
      return sum + duration;
    }, 0);
  }, [items, media]);

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });
    if (!canView) {
      router.push('/user/dashboard');
      return;
    }

    if (!playlistId) return;

    fetchPlaylist();
    fetchMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId, canView]);

  // Refresh media when window regains focus (user returns from media upload page)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 [PLAYLIST] Window focused, refreshing media...');
      fetchMedia();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchPlaylist = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/playlists/${playlistId}`);
      const playlistData = response.data.playlist;
      if (!playlistData) {
        setPlaylist(null);
        setError('Playlist not found');
        return;
      }

      setPlaylist(playlistData);
      setPlaylistName(playlistData.name);

      const transformedItems: PlaylistItem[] = (playlistData.items || []).map((item: any) => ({
        mediaId: item.mediaId,
        duration: item.duration,
        order: item.order,
        loopVideo: item.loopVideo === true,
        orientation: item.orientation === 'PORTRAIT' ? 'PORTRAIT' : 'LANDSCAPE',
        resizeMode: item.resizeMode === 'FILL' || item.resizeMode === 'STRETCH' ? item.resizeMode : 'FIT',
        rotation: [0, 90, 180, 270].includes(Number(item.rotation)) ? Number(item.rotation) as RotationDeg : 0,
        media: item.media,
      }));
      setItems(transformedItems);
    } catch (err: any) {
      console.error('Failed to fetch playlist:', err);
      setError('Failed to load playlist');
    } finally {
      setLoading(false);
    }
  };

  const fetchMedia = async () => {
    try {
      setRefreshingMedia(true);
      console.log('🔍 [PLAYLIST DEBUG] Fetching media for playlist editor...');
      const timestamp = Date.now(); // Add cache-busting timestamp
      const response = await api.get(`/media?_t=${timestamp}`);
      console.log('📊 [PLAYLIST DEBUG] Media API response:', response.data);
      console.log('📁 [PLAYLIST DEBUG] Media data property:', response.data.data);
      console.log('📁 [PLAYLIST DEBUG] Media media property:', response.data.media);
      
      // Use the correct property based on pagination service format
      const mediaArray = response.data.data || response.data.media || [];
      console.log('📁 [PLAYLIST DEBUG] Final media array:', mediaArray);
      console.log('📁 [PLAYLIST DEBUG] Media count:', mediaArray.length);
      
      setMedia(mediaArray);
    } catch (err) {
      console.error('❌ [PLAYLIST DEBUG] Failed to fetch media:', err);
      setMedia([]);
    } finally {
      setRefreshingMedia(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canEdit) return;

    const { active, over } = event;
    setActiveId(null);
    
    if (!over || active.id === over.id) return;

    setItems((items) => {
      const oldIndex = items.findIndex((item) => item.mediaId === active.id);
      const newIndex = items.findIndex((item) => item.mediaId === over.id);

      if (oldIndex === -1 || newIndex === -1) return items;

      const newItems = arrayMove(items, oldIndex, newIndex);
      return newItems.map((item, index) => ({ ...item, order: index }));
    });
  };

  const handleAddMedia = (mediaItem: Media, orientation: OrientationType = 'LANDSCAPE', resizeMode: ResizeModeType = 'FIT', rotation: RotationDeg = 0) => {
    if (!canEdit) return;

    const newItem: PlaylistItem = {
      mediaId: mediaItem.id,
      duration: mediaItem.type === 'IMAGE' ? 10 : mediaItem.duration || 30,
      order: items.length,
      loopVideo: false,
      orientation,
      resizeMode,
      rotation,
      media: mediaItem,
    };
    setItems([...items, newItem]);
  };

  const handleAddConfirm = (orientation: OrientationType, resizeMode: ResizeModeType, rotation: RotationDeg) => {
    if (addDialogMedia) {
      handleAddMedia(addDialogMedia, orientation, resizeMode, rotation);
      setAddDialogMedia(null);
    }
  };

  const handleRemoveItem = (mediaId: string) => {
    if (!canEdit) return;
    setItems(items.filter((item) => item.mediaId !== mediaId).map((item, index) => ({ ...item, order: index })));
  };

  const handleDurationChange = (mediaId: string, duration: number) => {
    if (!canEdit) return;
    setItems(items.map((item) => (item.mediaId === mediaId ? { ...item, duration } : item)));
  };

  const handleLoopChange = (mediaId: string, loopVideo: boolean) => {
    if (!canEdit) return;
    setItems(items.map((item) => (item.mediaId === mediaId ? { ...item, loopVideo } : item)));
  };

  const handleOrientationChange = (mediaId: string, orientation: OrientationType) => {
    if (!canEdit) return;
    setItems(items.map((item) => (item.mediaId === mediaId ? { ...item, orientation } : item)));
  };

  const handleResizeModeChange = (mediaId: string, resizeMode: ResizeModeType) => {
    if (!canEdit) return;
    setItems(items.map((item) => (item.mediaId === mediaId ? { ...item, resizeMode } : item)));
  };

  const handleRotationChange = (mediaId: string, rotation: RotationDeg) => {
    if (!canEdit) return;
    setItems(items.map((item) => (item.mediaId === mediaId ? { ...item, rotation } : item)));
  };

  const handleSave = async () => {
    if (!canEdit) return;

    try {
      setSaving(true);
      setError('');

      const payload = {
        name: playlistName,
        items: items.map((item, index) => ({
          mediaId: item.mediaId,
          duration: item.duration,
          order: index,
          loopVideo: item.loopVideo === true,
          orientation: item.orientation || 'LANDSCAPE',
          resizeMode: item.resizeMode || 'FIT',
          rotation: item.rotation ?? 0,
        })),
      };

      await api.put(`/playlists/${playlistId}`, payload);
      router.push('/user/playlists');
    } catch (err: any) {
      console.error('Failed to save playlist:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to save playlist');
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return null;
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          <p className="ml-3 text-gray-600 font-medium">Loading playlist...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!playlist) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-lg">
          <p className="font-semibold">Playlist not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const activeItem = activeId ? items.find((item) => item.mediaId === activeId) : null;
  const activeMedia = activeItem ? (activeItem.media || media.find((m) => m.id === activeItem.mediaId)) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with gradient background */}
        <div 
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-black p-6 shadow-2xl"
          data-aos="fade-down"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-500/10"></div>
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => router.push('/user/playlists')}
                    className="text-gray-300 hover:text-white hover:bg-white/10"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <div className="rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 p-2 shadow-lg">
                    <ListMusic className="h-8 w-8 text-white" />
                  </div>
                  <Input
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    disabled={!canEdit}
                    className="text-3xl font-bold border-0 bg-transparent text-white p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 max-w-md placeholder:text-gray-500"
                    placeholder="Playlist Name"
                  />
                </div>
                <div className="flex items-center gap-6 ml-14">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Clock className="h-4 w-4 text-yellow-400" />
                    <span className="font-semibold">Total Duration:</span>
                    <span className="text-white">{Math.floor(totalDuration / 60)}m {totalDuration % 60}s</span>
                  </div>
                  <div className="text-sm text-gray-300">
                    <span className="font-semibold text-white">{items.length}</span> {items.length === 1 ? 'item' : 'items'}
                  </div>
                </div>
              </div>
              {canEdit && (
                <Button 
                  onClick={handleSave} 
                  disabled={saving} 
                  size="lg" 
                  className="gap-2 h-12 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-semibold shadow-lg"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div 
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-lg"
            data-aos="fade-up"
          >
            {error}
          </div>
        )}

        {/* Split Pane Body */}
        <div className="grid grid-cols-[30%_70%] gap-6 h-[calc(100vh-280px)]">
          {/* Left Panel: Media Library */}
          <div 
            className="flex flex-col border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-lg"
            data-aos="fade-right"
            data-aos-delay="100"
          >
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Media Library</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchMedia}
                  disabled={refreshingMedia}
                  className="h-8 w-8 p-0"
                  title="Refresh media list"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshingMedia ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {filteredMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <FileImage className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">No media found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredMedia.map((mediaItem) => {
                    const isInPlaylist = items.some((item) => item.mediaId === mediaItem.id);
                    return (
                      <MediaCard
                        key={mediaItem.id}
                        media={mediaItem}
                        isInPlaylist={isInPlaylist}
                        onAdd={() => setAddDialogMedia(mediaItem)}
                        canEdit={canEdit}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Playlist Sequence */}
          <div 
            className="flex flex-col border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-lg"
            data-aos="fade-left"
            data-aos-delay="200"
          >
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-lg font-semibold text-gray-900">Playlist Sequence</h2>
              <p className="text-sm text-gray-600 mt-1">Drag to reorder • Click media to add</p>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex-1 overflow-y-auto p-4">
                {items.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                    <div className="text-center">
                      <FileVideo className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-gray-600 font-medium">
                        {canEdit ? 'Drag media here to build your playlist' : 'Playlist is empty'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {canEdit ? 'Or click on media from the library to add' : ''}
                      </p>
                    </div>
                  </div>
                ) : (
                  <SortableContext items={items.map((item) => item.mediaId)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <SortableItem
                          key={item.mediaId}
                          item={item}
                          media={item.media || media.find((m) => m.id === item.mediaId)}
                          onDurationChange={handleDurationChange}
                          onLoopChange={handleLoopChange}
                          onOrientationChange={handleOrientationChange}
                          onResizeModeChange={handleResizeModeChange}
                          onRotationChange={handleRotationChange}
                          onRemove={handleRemoveItem}
                          canEdit={canEdit}
                        />
                      ))}
                    </div>
                  </SortableContext>
                )}
              </div>
              <DragOverlay>
                {activeItem && activeMedia ? (
                  <div className="flex items-center gap-4 rounded-lg border bg-white p-4 shadow-lg opacity-90">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-gray-100">
                      {activeMedia.type === 'IMAGE' ? (
                        <img
                          src={`${API_URL.replace('/api', '')}${activeMedia.url}`}
                          alt={activeMedia.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gray-800">
                          <FileVideo className="h-8 w-8 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{activeMedia.name}</p>
                      <p className="text-sm text-gray-500">{activeMedia.type === 'IMAGE' ? 'Image' : 'Video'}</p>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>

        <AddToPlaylistDialog
          media={addDialogMedia}
          open={!!addDialogMedia}
          onOpenChange={(open) => !open && setAddDialogMedia(null)}
          onConfirm={handleAddConfirm}
        />
      </div>
    </DashboardLayout>
  );
}
