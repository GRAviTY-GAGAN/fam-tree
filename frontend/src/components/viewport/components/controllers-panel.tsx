"use client";

import React from "react";
import { Panel } from "@xyflow/react";
import { Download } from "lucide-react";

interface ControllersPanelProps {
  showEdgeLabels: boolean;
  setShowEdgeLabels: (show: boolean) => void;
  handleExportCanvasImage: () => void;
}

export function ControllersPanel({
  showEdgeLabels,
  setShowEdgeLabels,
  handleExportCanvasImage,
}: ControllersPanelProps) {
  return (
    <Panel 
      position="top-right" 
      className="flex items-center gap-3 bg-card border border-border p-1 px-2 rounded-md shadow-sm select-none"
    >
      <label className="flex items-center gap-1.5 cursor-pointer text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground transition py-0.5 px-1 rounded">
        <input
          type="checkbox"
          checked={showEdgeLabels}
          onChange={(e) => setShowEdgeLabels(e.target.checked)}
          className="accent-primary h-3 w-3 rounded border-border cursor-pointer"
        />
        <span>Show Labels</span>
      </label>
      <div className="h-3.5 w-[1px] bg-border/60" />
      <button
        onClick={handleExportCanvasImage}
        title="Export High-Res Canvas Snapshot"
        className="p-1 px-2.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 text-xs font-semibold"
      >
        <Download className="h-3.5 w-3.5 text-primary" />
        <span>export.png</span>
      </button>
    </Panel>
  );
}
