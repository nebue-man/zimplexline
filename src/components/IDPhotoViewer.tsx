import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, X } from 'lucide-react';

interface IDPhotoViewerProps {
  id?: string;
  photoUrl: string | undefined;
  altText?: string;
  isThumbnail?: boolean;
}

export const IDPhotoViewer: React.FC<IDPhotoViewerProps> = ({
  id,
  photoUrl,
  altText = 'ID Document Verification',
  isThumbnail = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // If there's no photo, show an elegant placeholder
  const placeholder = (
    <div className="flex h-32 w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400">
      <span className="text-xs font-medium">No ID Photo Provided</span>
    </div>
  );

  if (!photoUrl) return placeholder;

  if (isThumbnail) {
    return (
      <div id={id} className="group relative h-16 w-24 overflow-hidden rounded-md border border-slate-200 bg-slate-100 cursor-zoom-in transition hover:border-blue-300">
        <img
          src={photoUrl}
          referrerPolicy="no-referrer"
          alt={altText}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
          onClick={() => {
            setZoomLevel(1);
            setRotation(0);
            setIsOpen(true);
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition duration-200" onClick={() => setIsOpen(true)}>
          <ZoomIn className="h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
        </div>

        {/* Modal Lightbox */}
        {isOpen && (
          <Lightbox
            photoUrl={photoUrl}
            altText={altText}
            zoomLevel={zoomLevel}
            setZoomLevel={setZoomLevel}
            rotation={rotation}
            setRotation={setRotation}
            onClose={() => setIsOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div id={id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div className="relative flex min-h-[220px] w-full items-center justify-center p-2">
        <img
          src={photoUrl}
          referrerPolicy="no-referrer"
          alt={altText}
          style={{ transform: `scale(${zoomLevel}) rotate(${rotation}deg)` }}
          className="max-h-[320px] max-w-full rounded-lg object-contain transition-transform duration-300 shadow-md cursor-zoom-in"
          onClick={() => setIsOpen(true)}
        />
        
        {/* Simple Controls in Page Card */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-white/90 p-1.5 shadow-sm backdrop-blur-xs">
          <button
            type="button"
            onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.2))}
            className="rounded-md p-1 hover:bg-slate-100 text-slate-600 transition"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.2))}
            className="rounded-md p-1 hover:bg-slate-100 text-slate-600 transition"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setRotation(prev => (prev + 90) % 360)}
            className="rounded-md p-1 hover:bg-slate-100 text-slate-600 transition"
            title="Rotate"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isOpen && (
        <Lightbox
          photoUrl={photoUrl}
          altText={altText}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          rotation={rotation}
          setRotation={setRotation}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

// Lightbox sub-renderer
interface LightboxProps {
  photoUrl: string;
  altText: string;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  rotation: number;
  setRotation: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({
  photoUrl,
  altText,
  zoomLevel,
  setZoomLevel,
  rotation,
  setRotation,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 p-4 sm:p-6">
      {/* Lightbox Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 text-white">
        <h4 className="text-sm font-semibold tracking-wide uppercase">{altText}</h4>
        
        <button
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Lightbox Center */}
      <div className="relative flex-1 flex items-center justify-center overflow-auto p-4">
        <img
          src={photoUrl}
          referrerPolicy="no-referrer"
          alt={altText}
          style={{ transform: `scale(${zoomLevel}) rotate(${rotation}deg)` }}
          className="max-h-[75vh] max-w-full rounded-lg object-contain transition-transform duration-200 shadow-2xl"
        />
      </div>

      {/* Lightbox controls */}
      <div className="flex items-center justify-center gap-4 bg-white/5 py-4 rounded-xl border border-white/10 text-white max-w-sm mx-auto w-full mb-4">
        <button
          onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 transition"
        >
          <ZoomOut className="h-4 w-4" /> Zoom Out
        </button>
        <span className="text-xs font-mono font-medium">{Math.round(zoomLevel * 100)}%</span>
        <button
          onClick={() => setZoomLevel(prev => Math.min(5, prev + 0.25))}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 transition"
        >
          <ZoomIn className="h-4 w-4" /> Zoom In
        </button>
        <button
          onClick={() => setRotation(prev => (prev + 90) % 360)}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 transition"
        >
          <RotateCw className="h-4 w-4" /> Rotate
        </button>
      </div>
    </div>
  );
};
