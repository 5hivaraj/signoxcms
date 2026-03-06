'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, X, Maximize2, Trash2 } from 'lucide-react';
import { LayoutTemplate } from './LayoutTemplateSelector';

type Section = {
  id: string;
  name: string;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Resolution = {
  label: string;
  width: number;
  height: number;
};

const RESOLUTIONS: Resolution[] = [
  { label: 'HD 720p', width: 1280, height: 720 },
  { label: 'HD 1080p', width: 1920, height: 1080 },
  { label: '2K QHD', width: 2560, height: 1440 },
  { label: '4K UHD', width: 3840, height: 2160 },
  { label: 'Custom', width: 1920, height: 1080 },
];

interface AdvancedLayoutEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNext: (template: LayoutTemplate) => void;
  initialTemplate?: LayoutTemplate;
}

export function AdvancedLayoutEditor({
  open,
  onOpenChange,
  onNext,
  initialTemplate,
}: AdvancedLayoutEditorProps) {
  const [resolution, setResolution] = useState<Resolution>(RESOLUTIONS[1]); // Default HD 1080p
  const [orientation, setOrientation] = useState<'LANDSCAPE' | 'PORTRAIT'>('LANDSCAPE');
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [backgroundAudio, setBackgroundAudio] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);

  // Initialize from template or defaults
  useEffect(() => {
    if (initialTemplate) {
      setResolution({
        label: 'Custom',
        width: initialTemplate.width,
        height: initialTemplate.height,
      });
      setOrientation(initialTemplate.orientation);
      setSections(
        initialTemplate.sections.map((s, idx) => ({
          id: `section-${idx}`,
          name: s.name,
          order: s.order,
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
        }))
      );
    } else {
      setSections([]);
    }
  }, [initialTemplate, open]);

  // Update dimensions when orientation changes
  useEffect(() => {
    if (resolution.label !== 'Custom' && open) {
      const baseRes = RESOLUTIONS.find((r) => r.label === resolution.label);
      if (baseRes) {
        const newWidth = orientation === 'LANDSCAPE' ? baseRes.width : baseRes.height;
        const newHeight = orientation === 'LANDSCAPE' ? baseRes.height : baseRes.width;
        setResolution({ ...baseRes, width: newWidth, height: newHeight });
      }
    }
  }, [orientation, open]);

  // Calculate canvas scale to fit container
  useEffect(() => {
    if (canvasRef.current && resolution) {
      const container = canvasRef.current.parentElement;
      if (container) {
        const maxWidth = container.clientWidth - 100;
        const maxHeight = container.clientHeight - 100;
        const scaleX = maxWidth / resolution.width;
        const scaleY = maxHeight / resolution.height;
        setCanvasScale(Math.min(scaleX, scaleY, 1));
      }
    }
  }, [resolution, open]);

  // Calculate canvas dimensions early so they're available for callbacks
  const canvasWidth = useMemo(() => resolution.width * canvasScale, [resolution.width, canvasScale]);
  const canvasHeight = useMemo(() => resolution.height * canvasScale, [resolution.height, canvasScale]);

  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  const addNewSection = () => {
    const newSection: Section = {
      id: `section-${Date.now()}`,
      name: `Section ${sections.length + 1}`,
      order: sections.length,
      x: 10,
      y: 10,
      width: 30,
      height: 30,
    };
    setSections([...sections, newSection]);
    setSelectedSectionId(newSection.id);
  };

  const addOverlay = () => {
    const newSection: Section = {
      id: `overlay-${Date.now()}`,
      name: `Overlay ${sections.filter(s => s.id.startsWith('overlay')).length + 1}`,
      order: sections.length,
      x: 50,
      y: 50,
      width: 40,
      height: 40,
    };
    setSections([...sections, newSection]);
    setSelectedSectionId(newSection.id);
  };

  const removeSelectedSection = () => {
    if (selectedSectionId) {
      setSections(sections.filter((s) => s.id !== selectedSectionId));
      setSelectedSectionId(null);
    }
  };

  const updateSection = (id: string, updates: Partial<Section>) => {
    setSections(
      sections.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const handleSectionClick = (e: React.MouseEvent, section: Section) => {
    e.stopPropagation();
    setSelectedSectionId(section.id);
  };

  const handleCanvasClick = () => {
    setSelectedSectionId(null);
  };

  const handleMouseDown = (e: React.MouseEvent, section: Section) => {
    e.stopPropagation();
    setIsDragging(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const canvasX = (e.clientX - rect.left - (rect.width - canvasWidth) / 2) / canvasScale;
      const canvasY = (e.clientY - rect.top - (rect.height - canvasHeight) / 2) / canvasScale;
      setDragStart({
        x: canvasX - (section.x / 100) * resolution.width,
        y: canvasY - (section.y / 100) * resolution.height,
      });
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !selectedSection || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - (rect.width - canvasWidth) / 2) / canvasScale;
      const canvasY = (e.clientY - rect.top - (rect.height - canvasHeight) / 2) / canvasScale;
      
      const xPercent = ((canvasX - dragStart.x) / resolution.width) * 100;
      const yPercent = ((canvasY - dragStart.y) / resolution.height) * 100;

      updateSection(selectedSection.id, {
        x: Math.max(0, Math.min(100 - selectedSection.width, xPercent)),
        y: Math.max(0, Math.min(100 - selectedSection.height, yPercent)),
      });
    },
    [isDragging, selectedSection, dragStart, canvasScale, resolution, canvasWidth, canvasHeight]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const autoFill = () => {
    if (sections.length === 0) {
      // Create a single full-screen section
      addNewSection();
      updateSection(sections[0]?.id || '', { x: 0, y: 0, width: 100, height: 100 });
    } else {
      // Auto-arrange sections in a grid
      const cols = Math.ceil(Math.sqrt(sections.length));
      const rows = Math.ceil(sections.length / cols);
      const sectionWidth = 100 / cols;
      const sectionHeight = 100 / rows;

      setSections(
        sections.map((section, idx) => ({
          ...section,
          x: (idx % cols) * sectionWidth,
          y: Math.floor(idx / cols) * sectionHeight,
          width: sectionWidth,
          height: sectionHeight,
        }))
      );
    }
  };

  const handleNext = () => {
    if (sections.length === 0) {
      alert('Please add at least one section to the layout');
      return;
    }
    
    const template: LayoutTemplate = {
      id: initialTemplate?.id || 'custom',
      name: initialTemplate?.name || `Custom Layout ${resolution.width}x${resolution.height}`,
      description: initialTemplate?.description || `Custom ${orientation.toLowerCase()} layout with ${sections.length} section(s)`,
      width: resolution.width,
      height: resolution.height,
      orientation,
      sections: sections.map((s) => ({
        name: s.name,
        order: s.order,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
      })),
    };
    onNext(template);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>LAYOUT TEMPLATE SETTING</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Left Panel - Controls */}
          <div className="w-80 space-y-4 overflow-y-auto pr-2">
            {/* Device Resolution */}
            <div className="space-y-2">
              <Label htmlFor="resolution">Device Resolution</Label>
              <select
                id="resolution"
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={resolution.label}
                onChange={(e) => {
                  const selected = RESOLUTIONS.find((r) => r.label === e.target.value);
                  if (selected) {
                    const newWidth = orientation === 'LANDSCAPE' ? selected.width : selected.height;
                    const newHeight = orientation === 'LANDSCAPE' ? selected.height : selected.width;
                    setResolution({ ...selected, width: newWidth, height: newHeight });
                  }
                }}
              >
                {RESOLUTIONS.map((res) => (
                  <option key={res.label} value={res.label}>
                    {res.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Device Orientation */}
            <div className="space-y-2">
              <Label htmlFor="orientation">Device Orientation</Label>
              <select
                id="orientation"
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={orientation}
                onChange={(e) => {
                  const newOrientation = e.target.value as 'LANDSCAPE' | 'PORTRAIT';
                  setOrientation(newOrientation);
                  if (resolution.label !== 'Custom') {
                    const newWidth = newOrientation === 'LANDSCAPE' ? resolution.width : resolution.height;
                    const newHeight = newOrientation === 'LANDSCAPE' ? resolution.height : resolution.width;
                    setResolution({ ...resolution, width: newWidth, height: newHeight });
                  }
                }}
              >
                <option value="LANDSCAPE">Landscape</option>
                <option value="PORTRAIT">Portrait</option>
              </select>
            </div>

            {/* Selected Section Dimensions */}
            {selectedSection && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="sectionSelect">Selected Section Dimensions</Label>
                  <select
                    id="sectionSelect"
                    className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedSection.id}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section Name */}
                <div className="space-y-2">
                  <Label htmlFor="sectionName">Section Name</Label>
                  <Input
                    id="sectionName"
                    value={selectedSection.name}
                    onChange={(e) => updateSection(selectedSection.id, { name: e.target.value })}
                    placeholder="Section name"
                  />
                </div>

                {/* X, Y, WIDTH, HEIGHT */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="x">X</Label>
                    <Input
                      id="x"
                      type="number"
                      value={selectedSection.x.toFixed(2)}
                      onChange={(e) =>
                        updateSection(selectedSection.id, {
                          x: Math.max(0, Math.min(100 - selectedSection.width, parseFloat(e.target.value) || 0)),
                        })
                      }
                      step="0.1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="y">Y</Label>
                    <Input
                      id="y"
                      type="number"
                      value={selectedSection.y.toFixed(2)}
                      onChange={(e) =>
                        updateSection(selectedSection.id, {
                          y: Math.max(0, Math.min(100 - selectedSection.height, parseFloat(e.target.value) || 0)),
                        })
                      }
                      step="0.1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="width">WIDTH</Label>
                    <Input
                      id="width"
                      type="number"
                      value={selectedSection.width.toFixed(2)}
                      onChange={(e) => {
                        const newWidth = Math.max(1, Math.min(100 - selectedSection.x, parseFloat(e.target.value) || 1));
                        updateSection(selectedSection.id, { width: newWidth });
                      }}
                      step="0.1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">HEIGHT</Label>
                    <Input
                      id="height"
                      type="number"
                      value={selectedSection.height.toFixed(2)}
                      onChange={(e) => {
                        const newHeight = Math.max(1, Math.min(100 - selectedSection.y, parseFloat(e.target.value) || 1));
                        updateSection(selectedSection.id, { height: newHeight });
                      }}
                      step="0.1"
                    />
                  </div>
                </div>

                {/* Background Audio */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="backgroundAudio"
                    checked={backgroundAudio}
                    onChange={(e) => setBackgroundAudio(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="backgroundAudio" className="cursor-pointer">
                    BACKGROUND AUDIO
                  </Label>
                </div>

                {/* Remove Selected Section */}
                <Button
                  variant="destructive"
                  onClick={removeSelectedSection}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  REMOVE SELECTED SECTION
                </Button>
              </>
            )}
          </div>

          {/* Right Panel - Canvas */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              ref={canvasRef}
              className="flex-1 relative bg-gray-50 border-2 border-blue-300 rounded-lg overflow-auto flex items-center justify-center p-4"
              onClick={handleCanvasClick}
              style={{ minHeight: '400px' }}
            >
              <div
                className="relative bg-white border-2 border-gray-400 rounded"
                style={{
                  width: `${canvasWidth}px`,
                  height: `${canvasHeight}px`,
                  minWidth: '300px',
                  minHeight: '200px',
                }}
              >
                <div className="absolute top-2 left-2 text-xs font-semibold text-gray-600 z-10">
                  {resolution.width} X {resolution.height}
                </div>

                {sections.map((section) => {
                  const isSelected = section.id === selectedSectionId;
                  const isOverlay = section.id.startsWith('overlay');
                  const sectionLeft = (section.x / 100) * canvasWidth;
                  const sectionTop = (section.y / 100) * canvasHeight;
                  const sectionWidth = (section.width / 100) * canvasWidth;
                  const sectionHeight = (section.height / 100) * canvasHeight;
                  
                  return (
                    <div
                      key={section.id}
                      onClick={(e) => handleSectionClick(e, section)}
                      onMouseDown={(e) => handleMouseDown(e, section)}
                      className={`absolute border-2 rounded cursor-move transition-all ${
                        isOverlay
                          ? isSelected
                            ? 'border-purple-500 bg-purple-50 shadow-lg z-30'
                            : 'border-purple-300 bg-purple-100 hover:border-purple-400 z-20'
                          : isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-lg z-20'
                            : 'border-gray-300 bg-gray-100 hover:border-gray-400 z-10'
                      }`}
                      style={{
                        left: `${sectionLeft}px`,
                        top: `${sectionTop}px`,
                        width: `${sectionWidth}px`,
                        height: `${sectionHeight}px`,
                      }}
                    >
                      <div className="p-2 h-full flex flex-col overflow-hidden">
                        <div className="text-xs font-semibold text-gray-700 truncate">
                          {section.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {section.width.toFixed(1)}% × {section.height.toFixed(1)}%
                        </div>
                        {isSelected && (
                          <>
                            <div className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize rounded-tl" />
                            <div className="absolute top-0 left-0 w-2 h-2 bg-blue-500" />
                            <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500" />
                            <div className="absolute bottom-0 left-0 w-2 h-2 bg-blue-500" />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              <Button onClick={addNewSection} variant="outline" className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                ADD NEW SECTION
              </Button>
              <Button onClick={addOverlay} variant="outline" className="flex-1">
                <Maximize2 className="h-4 w-4 mr-2" />
                ADD OVERLAY
              </Button>
              <Button onClick={autoFill} variant="outline" className="flex-1">
                AUTO FILL
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            CANCEL
          </Button>
          <Button onClick={handleNext} disabled={sections.length === 0}>
            NEXT
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
