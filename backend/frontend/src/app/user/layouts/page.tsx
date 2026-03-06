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
import { Loader2, Plus, Trash2, Pencil, Layout, Monitor, Eye, Layers } from 'lucide-react';
import { LayoutTemplateSelector, LayoutTemplate, LAYOUT_TEMPLATES } from '@/components/layout/LayoutTemplateSelector';
import { AdvancedLayoutEditor } from '@/components/layout/AdvancedLayoutEditor';
import { LayoutPreview } from '@/components/layout/LayoutPreview';
import AOS from 'aos';
import 'aos/dist/aos.css';

type Layout = {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  isActive: boolean;
  createdAt: string;
  _count?: {
    widgets: number;
    displays: number;
  };
};

export default function LayoutsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [advancedEditorOpen, setAdvancedEditorOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [error, setError] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLayoutId, setPreviewLayoutId] = useState<string | null>(null);

  const access = useMemo(() => {
    if (!user) return { canRead: false, canWrite: false };
    if (user.role === 'USER_ADMIN') return { canRead: true, canWrite: true };
    if (user.role === 'STAFF' && user.staffRole === 'BROADCAST_MANAGER') return { canRead: true, canWrite: true };
    if (user.role === 'STAFF' && user.staffRole === 'CONTENT_MANAGER') return { canRead: true, canWrite: false };
    return { canRead: false, canWrite: false };
  }, [user]);

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });
    if (!user) return;
    if (access.canRead) fetchLayouts();
  }, [user, access.canRead]);

  async function fetchLayouts() {
    try {
      setLoading(true);
      const res = await api.get('/layouts');
      setLayouts(res.data.layouts ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load layouts');
      setLayouts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleTemplateSelect(template: LayoutTemplate) {
    if (template.id === 'custom') {
      // Open advanced layout editor
      setAdvancedEditorOpen(true);
    } else {
      // Create layout from template
      await createLayoutFromTemplate(template);
    }
  }

  async function handleAdvancedEditorNext(template: LayoutTemplate) {
    setAdvancedEditorOpen(false);
    // Use template name or default
    const layoutName = template.name || 'Custom Layout';
    
    // Create layout from advanced editor template
    await createLayoutFromTemplate({
      ...template,
      name: layoutName,
    });
  }

  async function createLayoutFromTemplate(template: LayoutTemplate) {
    if (!access.canWrite) return;
    setError('');
    try {
      setCreating(true);
      
      // Create sections from template
      const sections = template.sections.map((section) => ({
        name: section.name,
        order: section.order,
        x: section.x,
        y: section.y,
        width: section.width,
        height: section.height,
        items: [], // Empty sections, user will add media later
      }));

      const res = await api.post('/layouts', {
        name: template.name,
        description: template.description,
        width: template.width,
        height: template.height,
        orientation: template.orientation || (template.height > template.width ? 'PORTRAIT' : 'LANDSCAPE'),
        sections: sections,
      });
      
      const layoutId = res.data?.layout?.id;
      await fetchLayouts();
      if (layoutId) router.push(`/user/layouts/${layoutId}`);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create layout');
    } finally {
      setCreating(false);
    }
  }

  async function createLayout() {
    if (!access.canWrite) return;
    if (!name.trim()) {
      setError('Layout name is required');
      return;
    }
    setError('');
    try {
      setCreating(true);
      const res = await api.post('/layouts', {
        name: name.trim(),
        description: description.trim() || undefined,
        width: Number(width) || 1920,
        height: Number(height) || 1080,
      });
      const layoutId = res.data?.layout?.id;
      setCreateOpen(false);
      setName('');
      setDescription('');
      setWidth(1920);
      setHeight(1080);
      await fetchLayouts();
      if (layoutId) router.push(`/user/layouts/${layoutId}`);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create layout');
    } finally {
      setCreating(false);
    }
  }

  async function deleteLayout(id: string) {
    if (!access.canWrite) return;
    if (!confirm('Are you sure you want to delete this layout? This action cannot be undone.')) return;
    try {
      await api.delete(`/layouts/${id}`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await fetchLayouts();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete layout');
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
    if (selectedIds.size === layouts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(layouts.map((l) => l.id)));
    }
  }

  function openPreview(layoutId: string) {
    setPreviewLayoutId(layoutId);
    setPreviewOpen(true);
  }

  async function deleteSelected() {
    if (!access.canWrite || selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected layout(s)? This action cannot be undone.`)) return;
    setError('');
    setDeleting(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) => api.delete(`/layouts/${id}`))
      );
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (failed.length > 0) {
        const messages = failed.map((f) => (f.reason?.response?.data?.message || f.reason?.message || 'Delete failed')).join('; ');
        setError(messages);
      }
      setSelectedIds(new Set());
      await fetchLayouts();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete layouts');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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
        >
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-500/10"></div>
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 p-3 shadow-lg">
                  <Layers className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white">Layouts</h1>
                  <p className="text-gray-300 mt-1">
                    Create and manage display layouts with widgets and zones
                  </p>
                </div>
              </div>
              {access.canWrite && (
                <div className="flex gap-2">
                  {selectedIds.size > 0 && (
                    <Button
                      variant="destructive"
                      onClick={deleteSelected}
                      disabled={deleting}
                      className="h-12"
                    >
                      {deleting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete selected ({selectedIds.size})
                    </Button>
                  )}
                  <Button 
                    onClick={() => setTemplateSelectorOpen(true)}
                    className="h-12 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-semibold"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Layout
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <LayoutTemplateSelector
          open={templateSelectorOpen}
          onOpenChange={setTemplateSelectorOpen}
          onSelectTemplate={handleTemplateSelect}
        />
        
        <AdvancedLayoutEditor
          open={advancedEditorOpen}
          onOpenChange={setAdvancedEditorOpen}
          onNext={handleAdvancedEditorNext}
        />
        
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Layout</DialogTitle>
              <DialogDescription>
                Create a new layout template for your displays
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Layout Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Main Screen Layout"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="width">Width (px)</Label>
                  <Input
                    id="width"
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    min="320"
                    max="7680"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (px)</Label>
                  <Input
                    id="height"
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    min="240"
                    max="4320"
                  />
                </div>
              </div>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createLayout} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {error && (
          <div 
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl shadow-lg"
          >
            {error}
          </div>
        )}

        {layouts.length === 0 ? (
          <div 
            className="text-center py-12 bg-white rounded-2xl shadow-lg"
          >
            <Layout className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No layouts yet</h3>
            <p className="text-gray-600 mb-4">
              {access.canWrite
                ? 'Create your first layout to get started'
                : 'No layouts have been created yet'}
            </p>
            {access.canWrite && (
              <Button onClick={() => setTemplateSelectorOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Layout
              </Button>
            )}
            <LayoutTemplateSelector
              open={templateSelectorOpen}
              onOpenChange={setTemplateSelectorOpen}
              onSelectTemplate={handleTemplateSelect}
            />
            <AdvancedLayoutEditor
              open={advancedEditorOpen}
              onOpenChange={setAdvancedEditorOpen}
              onNext={handleAdvancedEditorNext}
            />
          </div>
        ) : (
          <div 
            className="bg-white rounded-2xl border border-gray-200 shadow-lg"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  {access.canWrite && (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={layouts.length > 0 && selectedIds.size === layouts.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300"
                        aria-label="Select all layouts"
                      />
                    </TableHead>
                  )}
                  <TableHead>Name</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Widgets</TableHead>
                  <TableHead>Displays</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {layouts.map((layout) => (
                  <TableRow key={layout.id}>
                    {access.canWrite && (
                      <TableCell className="w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(layout.id)}
                          onChange={() => toggleSelect(layout.id)}
                          className="h-4 w-4 rounded border-gray-300"
                          aria-label={`Select ${layout.name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Layout className="h-4 w-4 text-gray-400" />
                        {layout.name}
                      </div>
                      {layout.description && (
                        <div className="text-sm text-gray-500 mt-1">
                          {layout.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {layout.width} × {layout.height}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {layout._count?.widgets || 0} widgets
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <Monitor className="h-3 w-3 mr-1" />
                        {layout._count?.displays || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={layout.isActive ? 'default' : 'secondary'}>
                        {layout.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(layout.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPreview(layout.id)}
                          title="Preview Layout"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/user/layouts/${layout.id}`)}
                          title="Edit Layout"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {access.canWrite && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteLayout(layout.id)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete Layout"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Layout Preview Dialog */}
      <LayoutPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        layoutId={previewLayoutId}
        publicBaseUrl={process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}
      />
    </DashboardLayout>
  );
}
