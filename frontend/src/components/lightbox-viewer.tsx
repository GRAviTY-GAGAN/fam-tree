"use client";

import React from "react";

interface LightboxPhoto {
  url: string;
  name: string;
}

interface LightboxViewerProps {
  lightboxPhoto: LightboxPhoto | null;
  onClose: () => void;
}

export function LightboxViewer({
  lightboxPhoto,
  onClose,
}: LightboxViewerProps) {
  if (!lightboxPhoto) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative bg-card border border-border/80 p-2.5 rounded-2xl max-w-xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden rounded-xl border border-border max-h-[70vh]">
          <img 
            src={lightboxPhoto.url} 
            alt={lightboxPhoto.name} 
            className="w-full h-full object-contain pointer-events-none select-none max-w-full"
          />
        </div>
        <div className="p-3 text-center">
          <span className="text-sm font-bold text-foreground">{lightboxPhoto.name}</span>
        </div>
      </div>
    </div>
  );
}
