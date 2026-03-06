'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, Pause, RotateCcw } from 'lucide-react';
import Hls from 'hls.js';

/* -------------------- Types -------------------- */
type MediaType = 'IMAGE' | 'VIDEO';

type PreviewMedia = {
  id: string;
  name: string;
  type: MediaType;
  url: string;
  duration?: number | null;
};

type PreviewSectionItem = {
  id: string;
  order: number;
  duration?: number | null;
  resizeMode?: 'FIT' | 'FILL' | 'STRETCH';
  rotation?: number;
  media: PreviewMedia;
};

type PreviewSection = {
  id: string;
  name: string;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  items: PreviewSectionItem[];
};

type PreviewLayout = {
  id: string;
  name: string;
  width: number;
  height: number;
  sections: PreviewSection[];
};

interface LayoutPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layoutId: string | null;
  publicBaseUrl?: string;
}

/* -------------------- Helpers -------------------- */
const objectFitFromResizeMode = (mode?: string) =>
  mode === 'FILL' ? 'cover' : mode === 'STRETCH' ? 'fill' : 'contain';

/* -------------------- Component -------------------- */
export function LayoutPreview({
  open,
  onOpenChange,
  layoutId,
  publicBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ||
    'http://localhost:5000',
}: LayoutPreviewProps) {
  const [layout, setLayout] = useState<PreviewLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [sectionStates, setSectionStates] = useState<Record<string, number>>({});

  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});
  const hlsRefs = useRef<Record<string, Hls>>({});
  const imageTimers = useRef<Record<string, number>>({});

  /* -------------------- Fetch Layout -------------------- */
  const fetchLayout = useCallback(async () => {
    if (!layoutId) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');

      const res = await fetch(`${publicBaseUrl}/api/layouts/${layoutId}/preview`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Failed to load preview (${res.status})`);

      const data = await res.json();
      setLayout(data);

      const init: Record<string, number> = {};
      data.sections.forEach((s: PreviewSection) => (init[s.id] = 0));
      setSectionStates(init);
    } catch (e: any) {
      setError(e.message || 'Failed to load layout');
    } finally {
      setLoading(false);
    }
  }, [layoutId, publicBaseUrl]);

  useEffect(() => {
    if (open && layoutId) fetchLayout();
  }, [open, layoutId, fetchLayout]);

  /* -------------------- Cleanup -------------------- */
  useEffect(() => {
    return () => {
      Object.values(hlsRefs.current).forEach(hls => {
        try {
          hls.destroy();
        } catch {}
      });
      hlsRefs.current = {};
      videoRefs.current = {};
      Object.values(imageTimers.current).forEach(clearTimeout);
      imageTimers.current = {};
    };
  }, []);

  /* -------------------- Image Timers -------------------- */
  useEffect(() => {
    if (!layout || !isPlaying) return;

    Object.values(imageTimers.current).forEach(clearTimeout);
    imageTimers.current = {};

    layout.sections.forEach(section => {
      const idx = sectionStates[section.id];
      const item = section.items[idx];

      if (item?.media.type === 'IMAGE' && section.items.length > 1) {
        const duration = item.duration || item.media.duration || 10;
        imageTimers.current[section.id] = window.setTimeout(() => {
          setSectionStates(s => ({
            ...s,
            [section.id]: (s[section.id] + 1) % section.items.length,
          }));
        }, duration * 1000);
      }
    });
  }, [layout, sectionStates, isPlaying]);

  /* -------------------- HLS Setup -------------------- */
  const setupHlsVideo = useCallback(
    (video: HTMLVideoElement, src: string, key: string) => {
      const fullUrl = `${publicBaseUrl}${src}`;
      const isHls = src.endsWith('.m3u8');

      if (hlsRefs.current[key]) {
        hlsRefs.current[key].destroy();
        delete hlsRefs.current[key];
      }

      video.pause();
      video.removeAttribute('src');
      video.load();

      // Native Safari HLS
      if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = fullUrl;
        if (isPlaying) video.play().catch(() => {});
        return;
      }

      // HLS.js
      if (isHls && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: false,
          debug: false,
          xhrSetup: xhr => {
            xhr.timeout = 20000;
            xhr.withCredentials = false;
          },
        });

        hlsRefs.current[key] = hls;

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data || Object.keys(data).length === 0) {
            console.warn('⚠️ Empty HLS error (CORS / blocked segment)');
            return;
          }

          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              hls.destroy();
            }
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isPlaying) video.play().catch(() => {});
        });

        hls.attachMedia(video);
        hls.loadSource(fullUrl);
        return;
      }

      // Normal MP4
      video.src = fullUrl;
      if (isPlaying) video.play().catch(() => {});
    },
    [publicBaseUrl, isPlaying]
  );

  /* -------------------- Controls -------------------- */
  const togglePlayback = () => {
    setIsPlaying(p => {
      Object.values(videoRefs.current).forEach(v =>
        p ? v.pause() : v.play().catch(() => {})
      );
      return !p;
    });
  };

  const resetPreview = () => {
    if (!layout) return;

    const reset: Record<string, number> = {};
    layout.sections.forEach(s => (reset[s.id] = 0));
    setSectionStates(reset);

    Object.values(videoRefs.current).forEach(v => {
      v.pause();
      v.currentTime = 0;
      if (isPlaying) v.play().catch(() => {});
    });
  };

  /* -------------------- Render -------------------- */
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0">
        <DialogHeader className="p-4 border-b">
          <div className="flex justify-between items-center">
            <DialogTitle>
              Layout Preview {layout && `- ${layout.name}`}
            </DialogTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={togglePlayback}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button size="sm" variant="outline" onClick={resetPreview}>
                <RotateCcw size={16} />
                Reset
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-black p-4">
          {loading && <div className="text-white text-center">Loading…</div>}
          {error && <div className="text-red-400 text-center">{error}</div>}

          {layout && (
            <div
              className="relative mx-auto bg-black overflow-hidden"
              style={{ aspectRatio: `${layout.width}/${layout.height}` }}
            >
              {layout.sections.map(section => {
                const idx = sectionStates[section.id] ?? 0;
                const item = section.items[idx];
                if (!item) return null;

                return (
                  <div
                    key={section.id}
                    className="absolute overflow-hidden"
                    style={{
                      left: `${section.x}%`,
                      top: `${section.y}%`,
                      width: `${section.width}%`,
                      height: `${section.height}%`,
                    }}
                  >
                    {item.media.type === 'IMAGE' ? (
                      <img
                        src={`${publicBaseUrl}${item.media.url}`}
                        className="w-full h-full"
                        style={{ objectFit: objectFitFromResizeMode(item.resizeMode) }}
                      />
                    ) : (
                      <video
                        muted
                        playsInline
                        crossOrigin="anonymous"
                        className="w-full h-full"
                        style={{ objectFit: objectFitFromResizeMode(item.resizeMode) }}
                        ref={el => {
                          if (!el) return;
                          const key = `${section.id}-${item.id}`;
                          if (videoRefs.current[key] !== el) {
                            videoRefs.current[key] = el;
                            setupHlsVideo(el, item.media.url, key);
                          }
                        }}
                        onEnded={() =>
                          setSectionStates(s => ({
                            ...s,
                            [section.id]: (idx + 1) % section.items.length,
                          }))
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
