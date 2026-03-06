'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

export type LayoutTemplate = {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  orientation: 'LANDSCAPE' | 'PORTRAIT';
  sections: {
    name: string;
    order: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
};

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'custom',
    name: 'Make Custom Layout',
    description: 'Start from scratch with a blank canvas',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [],
  },
  {
    id: 'single-pane',
    name: 'Single Pane',
    description: 'Full screen single zone layout',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 100, height: 100 },
    ],
  },
  {
    id: 'three-panes-horizontal',
    name: 'Three Panes',
    description: 'Top horizontal, bottom two vertical',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 100, height: 50 },
      { name: 'Section 2', order: 1, x: 0, y: 50, width: 50, height: 50 },
      { name: 'Section 3', order: 2, x: 50, y: 50, width: 50, height: 50 },
    ],
  },
  {
    id: 'two-panes-vertical',
    name: 'Two Panes (Vertical)',
    description: 'Split screen vertically',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 50, height: 100 },
      { name: 'Section 2', order: 1, x: 50, y: 0, width: 50, height: 100 },
    ],
  },
  {
    id: 'two-panes-horizontal',
    name: 'Two Panes (Horizontal)',
    description: 'Split screen horizontally',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 100, height: 50 },
      { name: 'Section 2', order: 1, x: 0, y: 50, width: 100, height: 50 },
    ],
  },
  {
    id: 'four-quadrants',
    name: 'Four Quadrants',
    description: 'Four equal sections in a grid',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 50, height: 50 },
      { name: 'Section 2', order: 1, x: 50, y: 0, width: 50, height: 50 },
      { name: 'Section 3', order: 2, x: 0, y: 50, width: 50, height: 50 },
      { name: 'Section 4', order: 3, x: 50, y: 50, width: 50, height: 50 },
    ],
  },
  {
    id: 'single-pane-portrait',
    name: 'Single Pane (Portrait)',
    description: 'Full screen portrait layout',
    width: 1080,
    height: 1920,
    orientation: 'PORTRAIT',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 100, height: 100 },
    ],
  },
  {
    id: 'portrait-with-bar',
    name: 'Portrait with Bottom Bar',
    description: 'Portrait layout with footer zone',
    width: 1080,
    height: 1920,
    orientation: 'PORTRAIT',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 100, height: 90 },
      { name: 'Section 2', order: 1, x: 0, y: 90, width: 100, height: 10 },
    ],
  },
  {
    id: 'two-panes-portrait-vertical',
    name: 'Two Panes (Portrait Vertical)',
    description: 'Portrait split vertically',
    width: 1080,
    height: 1920,
    orientation: 'PORTRAIT',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 50, height: 100 },
      { name: 'Section 2', order: 1, x: 50, y: 0, width: 50, height: 100 },
    ],
  },
  {
    id: 'portrait-three-sections',
    name: 'Portrait Three Sections',
    description: 'Portrait with top, middle, and bottom sections',
    width: 1080,
    height: 1920,
    orientation: 'PORTRAIT',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 100, height: 33.33 },
      { name: 'Section 2', order: 1, x: 0, y: 33.33, width: 100, height: 33.33 },
      { name: 'Section 3', order: 2, x: 0, y: 66.66, width: 100, height: 33.34 },
    ],
  },
  {
    id: 'l-shape-right',
    name: 'L-Shape (Right)',
    description: 'L-shaped layout with main area and right sidebar',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 70, height: 100 },
      { name: 'Section 2', order: 1, x: 70, y: 0, width: 30, height: 50 },
      { name: 'Section 3', order: 2, x: 70, y: 50, width: 30, height: 50 },
    ],
  },
  {
    id: 'l-shape-left',
    name: 'L-Shape (Left)',
    description: 'L-shaped layout with main area and left sidebar',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 30, y: 0, width: 70, height: 100 },
      { name: 'Section 2', order: 1, x: 0, y: 0, width: 30, height: 50 },
      { name: 'Section 3', order: 2, x: 0, y: 50, width: 30, height: 50 },
    ],
  },
  {
    id: 'split-2-horiz',
    name: 'Split 2 Horizontal',
    description: 'Two equal horizontal sections',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 50, height: 100 },
      { name: 'Section 2', order: 1, x: 50, y: 0, width: 50, height: 100 },
    ],
  },
  {
    id: 'split-3-horiz',
    name: 'Split 3 Horizontal',
    description: 'Three equal horizontal sections',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 33.33, height: 100 },
      { name: 'Section 2', order: 1, x: 33.33, y: 0, width: 33.33, height: 100 },
      { name: 'Section 3', order: 2, x: 66.66, y: 0, width: 33.34, height: 100 },
    ],
  },
  {
    id: 'split-2-vert',
    name: 'Split 2 Vertical',
    description: 'Two equal vertical sections',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 100, height: 50 },
      { name: 'Section 2', order: 1, x: 0, y: 50, width: 100, height: 50 },
    ],
  },
  {
    id: 'split-3-vert',
    name: 'Split 3 Vertical',
    description: 'Three equal vertical sections',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 100, height: 33.33 },
      { name: 'Section 2', order: 1, x: 0, y: 33.33, width: 100, height: 33.33 },
      { name: 'Section 3', order: 2, x: 0, y: 66.66, width: 100, height: 33.34 },
    ],
  },
  {
    id: 'main-sidebar',
    name: 'Main + Sidebar',
    description: 'Large main area with sidebar',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 75, height: 100 },
      { name: 'Section 2', order: 1, x: 75, y: 0, width: 25, height: 100 },
    ],
  },
  {
    id: 'top-bar-main',
    name: 'Top Bar + Main',
    description: 'Top banner with main content area',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 100, height: 20 },
      { name: 'Section 2', order: 1, x: 0, y: 20, width: 100, height: 80 },
    ],
  },
  {
    id: 'six-grid',
    name: 'Six Grid',
    description: 'Six equal sections in 3x2 grid',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 33.33, height: 50 },
      { name: 'Section 2', order: 1, x: 33.33, y: 0, width: 33.33, height: 50 },
      { name: 'Section 3', order: 2, x: 66.66, y: 0, width: 33.34, height: 50 },
      { name: 'Section 4', order: 3, x: 0, y: 50, width: 33.33, height: 50 },
      { name: 'Section 5', order: 4, x: 33.33, y: 50, width: 33.33, height: 50 },
      { name: 'Section 6', order: 5, x: 66.66, y: 50, width: 33.34, height: 50 },
    ],
  },
  {
    id: 'nine-grid',
    name: 'Nine Grid',
    description: 'Nine equal sections in 3x3 grid',
    width: 1920,
    height: 1080,
    orientation: 'LANDSCAPE',
    sections: [
      { name: 'Section 1', order: 0, x: 0, y: 0, width: 33.33, height: 33.33 },
      { name: 'Section 2', order: 1, x: 33.33, y: 0, width: 33.33, height: 33.33 },
      { name: 'Section 3', order: 2, x: 66.66, y: 0, width: 33.34, height: 33.33 },
      { name: 'Section 4', order: 3, x: 0, y: 33.33, width: 33.33, height: 33.33 },
      { name: 'Section 5', order: 4, x: 33.33, y: 33.33, width: 33.33, height: 33.33 },
      { name: 'Section 6', order: 5, x: 66.66, y: 33.33, width: 33.34, height: 33.33 },
      { name: 'Section 7', order: 6, x: 0, y: 66.66, width: 33.33, height: 33.34 },
      { name: 'Section 8', order: 7, x: 33.33, y: 66.66, width: 33.33, height: 33.34 },
      { name: 'Section 9', order: 8, x: 66.66, y: 66.66, width: 33.34, height: 33.34 },
    ],
  },
];

interface LayoutTemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: LayoutTemplate) => void;
}

export function LayoutTemplateSelector({
  open,
  onOpenChange,
  onSelectTemplate,
}: LayoutTemplateSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">SELECT LAYOUT TEMPLATE</DialogTitle>
          <DialogDescription className="text-base text-gray-600 mt-2">
            Choose a template to start with, or create a custom layout from scratch
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 py-4">
          {LAYOUT_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                onSelectTemplate(template);
                onOpenChange(false);
              }}
              className="group relative flex flex-col items-center justify-center p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer bg-white min-h-[140px]"
            >
              {template.id === 'custom' ? (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3 group-hover:bg-blue-50 transition-colors">
                    <Plus className="h-8 w-8 text-gray-600 group-hover:text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold text-center text-gray-900 group-hover:text-blue-700">
                    {template.name}
                  </span>
                </div>
              ) : (
                <div className="w-full space-y-3">
                  <div
                    className="relative mx-auto border-2 border-gray-300 rounded bg-gray-50"
                    style={{
                      width: template.width > template.height ? '120px' : '60px',
                      height: template.width > template.height ? '68px' : '120px',
                      backgroundColor: '#f9fafb',
                    }}
                  >
                    {template.sections.map((section, idx) => {
                      const sectionWidth = (section.width / 100) * (template.width > template.height ? 120 : 60);
                      const sectionHeight = (section.height / 100) * (template.width > template.height ? 68 : 120);
                      const sectionX = (section.x / 100) * (template.width > template.height ? 120 : 60);
                      const sectionY = (section.y / 100) * (template.width > template.height ? 68 : 120);
                      
                      return (
                        <div
                          key={idx}
                          className="absolute border-2 border-blue-500 bg-blue-100 rounded-sm"
                          style={{
                            left: `${sectionX}px`,
                            top: `${sectionY}px`,
                            width: `${sectionWidth}px`,
                            height: `${sectionHeight}px`,
                          }}
                        />
                      );
                    })}
                  </div>
                  <div className="text-center px-2 min-h-[40px] flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-900 group-hover:text-blue-700 leading-tight break-words">
                      {template.name}
                    </span>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="font-semibold text-gray-900 border-gray-300 hover:bg-gray-50"
          >
            CANCEL
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
