'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Save, ArrowLeft, Plus, X, Pencil, Search, Upload, Image as ImageIcon, Video, Clock, HardDrive, Trash2, GripVertical, Play, FileVideo, RefreshCw, Layers } from 'lucide-react';
import { Label } from '@/components/ui/label';
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
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LayoutPreview } from '@/components/layout/LayoutPreview';
import AOS from 'aos';
import 'aos/dist/aos.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type Media = {
  id: string;
  name: string;
  url: string;
  type: 'IMAGE' | 'VIDEO';
  duration?: number;
  fileSize?: number;
};

type OrientationType = 'LANDSCAPE' | 'PORTRAIT';
type ResizeModeType = 'FIT' | 'FILL' | 'STRETCH';
type RotationDeg = 0 | 90 | 180 | 270;

type SectionItem = {
  id: string;
  mediaId: string;
  order: number;
  duration?: number;
  orientation?: OrientationType;
  resizeMode?: ResizeModeType;
  rotation?: RotationDeg;
  media?: Media;
};

const objectFitClass: Record<ResizeModeType, string> = {
  FIT: 'object-contain',
  FILL: 'object-cover',
  STRETCH: 'object-fill',
};

type Section = {
  id: string;
  name: string;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  frequency?: number;
  loopEnabled: boolean;
  items: SectionItem[];
};

type Layout = {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  orientation?: 'LANDSCAPE' | 'PORTRAIT';
  isActive: boolean;
  sections: Section[];
};

function DroppableSection({
  section,
  isActive,
  onDrop,
  children,
}: {
  section: Section;
  isActive: boolean;
  onDrop: (mediaId: string) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${section.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative border-2 rounded-lg transition-all ${
        isActive
          ? isOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white'
          : 'border-gray-200 bg-gray-50 opacity-60'
      }`}
      style={{
        position: 'absolute',
        left: `${section.x}%`,
        top: `${section.y}%`,
        width: `${section.width}%`,
        height: `${section.height}%`,
      }}
    >
      {children}
      {isOver && (
        <div className="absolute inset-0 bg-blue-200 bg-opacity-50 flex items-center justify-center rounded">
          <p className="text-blue-700 font-semibold">Drop media here</p>
        </div>
      )}
    </div>
  );
}

function SortableMediaItem({
  item,
  media,
  onOrientationChange,
  onResizeModeChange,
  onRotationChange,
  onRemove,
}: {
  item: SectionItem;
  media: Media | undefined;
  onOrientationChange?: (itemId: string, orientation: OrientationType) => void;
  onResizeModeChange?: (itemId: string, resizeMode: ResizeModeType) => void;
  onRotationChange?: (itemId: string, rotation: RotationDeg) => void;
  onRemove: (itemId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!media) return null;

  const thumbnailUrl = `${API_URL.replace('/api', '')}${media.url}`;
  const isImage = media.type === 'IMAGE';
  const orientation = item.orientation ?? 'LANDSCAPE';
  const resizeMode = item.resizeMode ?? 'FIT';
  const rotation = (item.rotation ?? 0) as RotationDeg;
  const fitClass = objectFitClass[resizeMode];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 group flex-wrap"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="w-10 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
        {isImage ? (
          <img
            src={thumbnailUrl}
            alt={media.name}
            className={`w-full h-full bg-black ${fitClass}`}
            style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <Video className="h-3 w-3 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-900 truncate">{media.name}</p>
        <p className="text-xs text-gray-500">{isImage ? 'Image' : 'Video'}</p>
      </div>
      {onOrientationChange && (
        <select
          value={orientation}
          onChange={(e) => onOrientationChange(item.id, e.target.value as OrientationType)}
          className="h-7 w-[95px] rounded border border-gray-300 px-1 text-xs"
          title="Orientation"
        >
          <option value="LANDSCAPE">Landscape</option>
          <option value="PORTRAIT">Portrait</option>
        </select>
      )}
      {onResizeModeChange && (
        <select
          value={resizeMode}
          onChange={(e) => onResizeModeChange(item.id, e.target.value as ResizeModeType)}
          className="h-7 w-[72px] rounded border border-gray-300 px-1 text-xs"
          title="Resize"
        >
          <option value="FIT">Fit</option>
          <option value="FILL">Fill</option>
          <option value="STRETCH">Stretch</option>
        </select>
      )}
      {onRotationChange && (
        <select
          value={rotation}
          onChange={(e) => onRotationChange(item.id, Number(e.target.value) as RotationDeg)}
          className="h-7 w-[70px] rounded border border-gray-300 px-1 text-xs"
          title="Rotation"
        >
          <option value={0}>0°</option>
          <option value={90}>90°</option>
          <option value={180}>180°</option>
          <option value={270}>270°</option>
        </select>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
        onClick={() => onRemove(item.id)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

function AddToSectionDialog({
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
  const usePortraitFrame = orientation === 'PORTRAIT' || rotation === 90 || rotation === 270;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to section</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 mb-4">
          Set orientation, rotation, and resize for &quot;{media.name}&quot;
        </p>
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
                <option value={270}>270°</option>
              </select>
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
                    <img src={thumbnailUrl} alt={media.name} className={`${fitClass} w-full h-full`} />
                  </div>
                ) : (
                  <img
                    src={thumbnailUrl}
                    alt={media.name}
                    className={`${fitClass} w-full h-full`}
                    style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }}
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
        <DialogFooter className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onConfirm(orientation, resizeMode, rotation)}>Add to section</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DraggableMediaItem({
  media,
  onAdd,
}: {
  media: Media;
  onAdd: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: media.id,
    data: {
      type: 'media',
      media,
    },
  });

  const style: React.CSSProperties = {
    ...(transform && {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    }),
    opacity: isDragging ? 0.5 : 1,
  };

  const thumbnailUrl = `${API_URL.replace('/api', '')}${media.url}`;
  const isImage = media.type === 'IMAGE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer group"
      onClick={onAdd}
    >
      <div
        {...attributes}
        {...listeners}
        className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex-shrink-0 cursor-grab active:cursor-grabbing"
      >
        {isImage ? (
          <img src={thumbnailUrl} alt={media.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <Video className="h-4 w-4 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{media.name}</p>
        <p className="text-xs text-gray-500">{media.type}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 rounded-full bg-blue-500 text-white hover:bg-blue-600 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default function LayoutBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const layoutId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<Media[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState<'ALL' | 'VIDEO' | 'IMAGE'>('ALL');
  const [editingName, setEditingName] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [error, setError] = useState<string>('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [addDialogMedia, setAddDialogMedia] = useState<Media | null>(null);
  const [addDialogSectionId, setAddDialogSectionId] = useState<string | null>(null);
  const [livePreviewOpen, setLivePreviewOpen] = useState(false);
  const [refreshingMedia, setRefreshingMedia] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });
    if (layoutId) {
      fetchLayout();
      fetchMedia();
    }
  }, [layoutId]);

  // Refresh media when window regains focus (user returns from media upload page)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 [LAYOUT] Window focused, refreshing media...');
      fetchMedia();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    if (layout && layout.sections.length > 0 && !activeSection) {
      setActiveSection(layout.sections[0].id);
    }
  }, [layout]);

  useEffect(() => {
    let filtered = mediaList;
    
    if (searchQuery) {
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (mediaFilter !== 'ALL') {
      filtered = filtered.filter(m => m.type === mediaFilter);
    }
    
    setFilteredMedia(filtered);
  }, [mediaList, searchQuery, mediaFilter]);

  async function fetchLayout() {
    try {
      setLoading(true);
      const res = await api.get(`/layouts/${layoutId}`);
      setLayout(res.data.layout);
      setLayoutName(res.data.layout.name);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load layout');
    } finally {
      setLoading(false);
    }
  }

  async function fetchMedia() {
    try {
      setRefreshingMedia(true);
      console.log('🔍 [LAYOUT DEBUG] Fetching media for layout editor...');
      // Add timestamp to bypass cache
      const res = await api.get(`/media?_t=${Date.now()}`);
      console.log('📊 [LAYOUT DEBUG] Media API response:', res.data);
      console.log('📁 [LAYOUT DEBUG] Media data property:', res.data.data);
      console.log('📁 [LAYOUT DEBUG] Media media property:', res.data.media);
      
      // Use the correct property based on pagination service format
      const mediaArray = res.data.data || res.data.media || [];
      console.log('📁 [LAYOUT DEBUG] Final media array:', mediaArray);
      console.log('📁 [LAYOUT DEBUG] Media count:', mediaArray.length);
      
      setMediaList(mediaArray);
    } catch (e: any) {
      console.error('❌ [LAYOUT DEBUG] Failed to load media:', e);
      setMediaList([]);
    } finally {
      setRefreshingMedia(false);
    }
  }
  async function saveLayout() {
    if (!layout) return;
  
    try {
      setSaving(true);
      setError('');
  
      await api.put(`/layouts/${layoutId}`, {
        name: layoutName,
        description: layout.description,
        width: layout.width,
        height: layout.height,
        isActive: layout.isActive,
      });
  
      for (const section of layout.sections) {
        await api.put(`/layouts/${layoutId}/sections/${section.id}`, {
          name: section.name,
          items: section.items.map((item, index) => ({
            mediaId: item.mediaId,
            order: index,
            duration: item.duration,
            orientation: item.orientation || 'LANDSCAPE',
            resizeMode: item.resizeMode || 'FIT',
            rotation: item.rotation ?? 0,
          })),
          frequency: section.frequency,
          loopEnabled: section.loopEnabled,
        });
      }
  
      await fetchLayout();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save layout');
    } finally {
      setSaving(false);
    }
  }

  async function saveAndLivePreview() {
    if (!layout) return;
  
    try {
      setSaving(true);
      setError('');
  
      await api.put(`/layouts/${layoutId}`, {
        name: layoutName,
        description: layout.description,
        width: layout.width,
        height: layout.height,
        isActive: layout.isActive,
      });
  
      for (const section of layout.sections) {
        await api.put(`/layouts/${layoutId}/sections/${section.id}`, {
          name: section.name,
          items: section.items.map((item, index) => ({
            mediaId: item.mediaId,
            order: index,
            duration: item.duration,
            orientation: item.orientation || 'LANDSCAPE',
            resizeMode: item.resizeMode || 'FIT',
            rotation: item.rotation ?? 0,
          })),
          frequency: section.frequency,
          loopEnabled: section.loopEnabled,
        });
      }
  
      await fetchLayout();
      setLivePreviewOpen(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save layout');
    } finally {
      setSaving(false);
    }
  }

  async function updateSection(sectionId: string, items: SectionItem[]) {
    if (!layout) return;
    try {
      const section = layout.sections.find(s => s.id === sectionId);
      if (!section) return;

      await api.put(`/layouts/${layoutId}/sections/${sectionId}`, {
        name: section.name,
        items: items.map((item, index) => ({
          mediaId: item.mediaId,
          order: index,
          duration: item.duration,
          orientation: item.orientation || 'LANDSCAPE',
          resizeMode: item.resizeMode || 'FIT',
          rotation: item.rotation ?? 0,
        })),
        frequency: section.frequency,
        loopEnabled: section.loopEnabled,
      });

      await fetchLayout();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update section');
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over || !layout || !activeSection) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const section = layout.sections.find(s => s.id === activeSection);
    if (!section) return;

    // Dragging from media library to section -> open add dialog
    const activeData = active.data.current;
    if (activeData?.type === 'media' && overId === `section-${activeSection}`) {
      const draggedMedia = activeData.media as Media;
      setAddDialogMedia(draggedMedia);
      setAddDialogSectionId(activeSection);
      return;
    }

    // Reorder items within section
    const oldIndex = section.items.findIndex(item => item.id === activeId);
    const newIndex = section.items.findIndex(item => item.id === overId);

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      const newItems = arrayMove(section.items, oldIndex, newIndex);
      updateSection(activeSection, newItems);
    }
  };

  function removeItemFromSection(sectionId: string, itemId: string) {
    if (!layout) return;
    const section = layout.sections.find(s => s.id === sectionId);
    if (!section) return;
    const updatedItems = section.items.filter(item => item.id !== itemId);
    updateSection(sectionId, updatedItems);
  }

  function addMediaToSection(media: Media, sectionId?: string) {
    if (!layout) return;
    const targetSectionId = sectionId || activeSection;
    if (!targetSectionId) {
      setAddDialogMedia(media);
      setAddDialogSectionId(null);
      return;
    }
    const section = layout.sections.find(s => s.id === targetSectionId);
    if (!section) return;

    const newItem: SectionItem = {
      id: `temp-${Date.now()}`,
      mediaId: media.id,
      order: section.items.length,
      media: media,
      orientation: 'LANDSCAPE',
      resizeMode: 'FIT',
      rotation: 0,
    };
    const updatedItems = [...section.items, newItem];
    updateSection(targetSectionId, updatedItems);
  }

  function handleAddToSectionConfirm(orientation: OrientationType, resizeMode: ResizeModeType, rotation: RotationDeg) {
    if (!addDialogMedia || !layout) return;
    const targetSectionId = addDialogSectionId || activeSection;
    if (!targetSectionId) {
      setAddDialogMedia(null);
      setAddDialogSectionId(null);
      return;
    }
    const section = layout.sections.find(s => s.id === targetSectionId);
    if (!section) {
      setAddDialogMedia(null);
      setAddDialogSectionId(null);
      return;
    }
    const newItem: SectionItem = {
      id: `temp-${Date.now()}`,
      mediaId: addDialogMedia.id,
      order: section.items.length,
      media: addDialogMedia,
      orientation,
      resizeMode,
      rotation,
    };
    const updatedItems = [...section.items, newItem];
    updateSection(targetSectionId, updatedItems);
    setAddDialogMedia(null);
    setAddDialogSectionId(null);
  }

  function updateSectionItemField(sectionId: string, itemId: string, field: 'orientation' | 'resizeMode' | 'rotation', value: OrientationType | ResizeModeType | RotationDeg) {
    if (!layout) return;
    const section = layout.sections.find(s => s.id === sectionId);
    if (!section) return;
    const updatedItems = section.items.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    );
    setLayout({
      ...layout,
      sections: layout.sections.map(s =>
        s.id === sectionId ? { ...s, items: updatedItems } : s
      ),
    });
    updateSection(sectionId, updatedItems);
  }

  function getSectionStats(section: Section) {
    const totalMedia = section.items.length;
    const totalDuration = section.items.reduce((sum, item) => {
      const duration = item.duration || item.media?.duration || (item.media?.type === 'IMAGE' ? 10 : 30);
      return sum + duration;
    }, 0);
    const totalSize = section.items.reduce((sum, item) => sum + (item.media?.fileSize || 0), 0);
    const frequency = section.frequency || 0;

    return { totalMedia, totalDuration, totalSize, frequency };
  }

  // Calculate preview scale to fit within a reasonable size while maintaining aspect ratio
  const maxPreviewWidth = 800;
  const maxPreviewHeight = 600;
  const scale = layout ? Math.min(
    maxPreviewWidth / layout.width,
    maxPreviewHeight / layout.height,
    1
  ) : 1;
  const previewWidth = layout ? Math.min(layout.width * scale, maxPreviewWidth) : 600;
  const previewHeight = layout ? Math.min(layout.height * scale, maxPreviewHeight) : 400;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          <p className="ml-3 text-gray-600 font-medium">Loading layout...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!layout) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-600 font-semibold mb-4">Layout not found</p>
          <Button 
            onClick={() => router.push('/user/layouts')} 
            className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-semibold"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Layouts
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const currentSection = layout.sections.find(s => s.id === activeSection);
  const sectionStats = currentSection ? getSectionStats(currentSection) : null;
  const draggedMedia = activeId ? mediaList.find(m => m.id === activeId) : null;
  
  // Wrap the entire page in DndContext
  const pageContent = (
    <div className="flex h-[calc(100vh-12rem)] -m-6 -mx-6">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Header with gradient background */}
        <div 
          className="relative overflow-hidden bg-gradient-to-br from-gray-900 to-black p-6 shadow-2xl"
          data-aos="fade-down"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-500/10"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => router.push('/user/layouts')}
                  className="text-gray-300 hover:text-white hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 p-2 shadow-lg">
                  <Layers className="h-8 w-8 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  {editingName ? (
                    <Input
                      value={layoutName}
                      onChange={(e) => setLayoutName(e.target.value)}
                      onBlur={() => {
                        setEditingName(false);
                        saveLayout();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setEditingName(false);
                          saveLayout();
                        }
                        if (e.key === 'Escape') {
                          setEditingName(false);
                          setLayoutName(layout.name);
                        }
                      }}
                      className="text-2xl font-bold border-0 bg-white/10 text-white focus:bg-white/20 focus:border-yellow-400"
                      autoFocus
                    />
                  ) : (
                    <>
                      <h1 className="text-3xl font-bold text-white">{layoutName}</h1>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingName(true)}
                        className="h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-white/10"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={saveAndLivePreview}
                  disabled={saving}
                  className="h-12 bg-white/10 text-white border-white/20 hover:bg-white/20"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Live Preview
                </Button>
                <Button 
                  onClick={saveLayout} 
                  disabled={saving}
                  className="h-12 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-semibold shadow-lg"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      SAVE
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Section Tabs */}
            <Tabs value={activeSection || ''} onValueChange={setActiveSection}>
              <div className="overflow-x-auto overflow-y-hidden custom-scrollbar-horizontal -mx-4 px-4 pb-1">
                <TabsList className="inline-flex w-max min-w-full bg-white/10 border-white/20">
                  {layout.sections.map((section) => (
                    <TabsTrigger 
                      key={section.id} 
                      value={section.id} 
                      className="whitespace-nowrap flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-gray-900"
                    >
                      {section.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>

            {error && (
              <div className="mt-4 rounded-xl bg-red-500/20 border border-red-500/30 p-3 text-sm text-red-200 shadow-lg">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Section Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 bg-gray-50 custom-scrollbar">
          {currentSection && (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Section Statistics */}
              {sectionStats && (
                <div 
                  className="grid grid-cols-4 gap-4"
                  data-aos="fade-up"
                  data-aos-delay="100"
                >
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
                    <p className="text-xs text-gray-600 uppercase mb-1 font-semibold">TOTAL MEDIA</p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">{sectionStats.totalMedia}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
                    <p className="text-xs text-gray-600 uppercase mb-1 font-semibold">DURATION</p>
                    <p className="text-2xl font-bold text-gray-900">{sectionStats.totalDuration} sec</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
                    <p className="text-xs text-gray-600 uppercase mb-1 font-semibold">TOTAL SIZE</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {sectionStats.totalSize > 0 
                        ? `${(sectionStats.totalSize / 1024 / 1024).toFixed(2)} MB`
                        : '0 Bytes'}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
                    <p className="text-xs text-gray-600 uppercase mb-1 font-semibold">FREQUENCY</p>
                    <p className="text-2xl font-bold text-gray-900">{sectionStats.frequency} times / Hour</p>
                  </div>
                </div>
              )}

              {/* Layout Preview */}
              <div 
                className="bg-white p-6 rounded-2xl border border-gray-200 shadow-lg"
                data-aos="fade-up"
                data-aos-delay="200"
              >
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Layout Preview</h3>
                <div className="flex justify-center">
                  <div className="relative bg-gray-100 border-2 border-gray-300 rounded overflow-hidden" style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}>
                    {layout.sections.map((section) => (
                      <DroppableSection
                        key={section.id}
                        section={section}
                        isActive={section.id === activeSection}
                        onDrop={(mediaId) => {
                          const media = mediaList.find(m => m.id === mediaId);
                          if (media) {
                            setAddDialogMedia(media);
                            setAddDialogSectionId(section.id);
                          }
                        }}
                      >
                        <div className="absolute inset-0 p-1 flex flex-col overflow-hidden">
                          <div className="text-xs font-semibold text-gray-600 mb-0.5 truncate">{section.name}</div>
                          {section.items.length > 0 && (
                            <div className="text-xs text-gray-500">
                              {section.items.length} item{section.items.length !== 1 ? 's' : ''}
                            </div>
                          )}
                          {section.id === activeSection && section.items.length === 0 && (
                            <div className="text-xs text-gray-400 text-center mt-auto mb-auto">
                              Drop Media
                            </div>
                          )}
                        </div>
                      </DroppableSection>
                    ))}
                  </div>
                </div>
              </div>

              {/* Media Drop Zone */}
              <div 
                className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-6 min-h-[300px] max-h-[500px] overflow-y-auto overflow-x-hidden custom-scrollbar shadow-lg"
                data-aos="fade-up"
                data-aos-delay="300"
              >
                {currentSection.items.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 min-h-[200px]">
                    <div className="text-center">
                      <p className="text-lg font-medium mb-2">[ Drag & Drop Media Here ]</p>
                      <p className="text-sm">Or click the + button on media items to add them</p>
                    </div>
                  </div>
                ) : (
                  <SortableContext
                    items={currentSection.items.map(item => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {currentSection.items.map((item) => (
                        <SortableMediaItem
                          key={item.id}
                          item={item}
                          media={item.media}
                          onOrientationChange={(itemId, orientation) => updateSectionItemField(currentSection!.id, itemId, 'orientation', orientation)}
                          onResizeModeChange={(itemId, resizeMode) => updateSectionItemField(currentSection!.id, itemId, 'resizeMode', resizeMode)}
                          onRotationChange={(itemId, rotation) => updateSectionItemField(currentSection!.id, itemId, 'rotation', rotation)}
                          onRemove={(itemId) => removeItemFromSection(currentSection!.id, itemId)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Media Library Sidebar */}
      <div className="w-80 border-l bg-gradient-to-b from-gray-50 to-white flex flex-col shadow-xl">
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-lg">MEDIA LIBRARY</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchMedia}
              disabled={refreshingMedia}
              className="h-8 w-8 p-0"
              title="Refresh media list"
            >
              <RefreshCw className={`h-4 w-4 ${refreshingMedia ? 'animate-spin text-yellow-500' : 'text-gray-600'}`} />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search By Text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Upload Button */}
          <Button 
            className="w-full mb-3 h-11 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-semibold shadow-lg"
            onClick={() => router.push('/user/media')}
          >
            <Upload className="h-4 w-4 mr-2" />
            + UPLOAD MEDIA
          </Button>

          {/* Filters */}
          <div className="flex gap-2">
            {(['ALL', 'VIDEO', 'IMAGE'] as const).map((filter) => (
              <Button
                key={filter}
                variant={mediaFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMediaFilter(filter)}
                className="flex-1"
              >
                {filter}
              </Button>
            ))}
          </div>
        </div>

        {/* Media List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 custom-scrollbar">
          <div className="space-y-2">
            {filteredMedia.map((media) => (
              <DraggableMediaItem
                key={media.id}
                media={media}
                onAdd={() => {
                  setAddDialogMedia(media);
                  setAddDialogSectionId(activeSection);
                }}
              />
            ))}
          </div>
          {filteredMedia.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No media found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {pageContent}
        <DragOverlay>
          {draggedMedia && (
            <div className="flex items-center gap-3 p-3 bg-white border-2 border-blue-500 rounded-lg shadow-lg">
              <div className="w-12 h-12 rounded overflow-hidden bg-gray-100">
                {draggedMedia.type === 'IMAGE' ? (
                  <img src={`${API_URL.replace('/api', '')}${draggedMedia.url}`} alt={draggedMedia.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800">
                    <Video className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{draggedMedia.name}</p>
                <p className="text-xs text-gray-500">{draggedMedia.type}</p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <AddToSectionDialog
        media={addDialogMedia}
        open={!!addDialogMedia}
        onOpenChange={(open) => { if (!open) { setAddDialogMedia(null); setAddDialogSectionId(null); } }}
        onConfirm={handleAddToSectionConfirm}
      />

      {/* Live Layout Preview */}
      <LayoutPreview
        open={livePreviewOpen}
        onOpenChange={setLivePreviewOpen}
        layoutId={layoutId}
        publicBaseUrl={process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}
      />
    </DashboardLayout>
  );
}
