"use client";

import React, { useState } from "react";
import { Panel } from "@xyflow/react";
import { Info, ChevronDown } from "lucide-react";

export function LegendPanel() {
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  return (
    <Panel 
      position="bottom-left" 
      className={`bg-card/95 backdrop-blur-xs border border-border p-2 rounded-lg shadow-md select-none transition-all duration-200 ${isLegendOpen ? "w-[260px] max-w-[280px]" : "w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-muted"}`} 
      onClick={() => { if (!isLegendOpen) setIsLegendOpen(true); }}
    >
      {!isLegendOpen ? (
        <button
          type="button"
          title="Expand Relationship Legend"
          className="p-1 text-muted-foreground hover:text-foreground transition flex items-center justify-center"
        >
          <Info className="h-4 w-4 text-primary" />
        </button>
      ) : (
        <div className="space-y-2 text-[10px]">
          <div className="flex items-center justify-between gap-4 font-bold uppercase tracking-wider text-muted-foreground text-[9px] border-b pb-1">
            <span>Relationship Legend</span>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsLegendOpen(false);
              }}
              title="Collapse Legend"
              className="hover:text-foreground text-muted-foreground transition p-0.5"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-foreground/80 font-medium animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <div className="h-[3px] w-6 bg-[#e11d48] shrink-0" />
              <span>Spouse (Married)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-[2px] w-6 bg-[#94a3b8] shrink-0" />
              <span>Child (Biological)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-[2px] w-6 bg-[#f43f5e] border-t border-dashed shrink-0" style={{ borderTop: "2px dashed #f43f5e" }} />
              <span>Spouse (Divorced)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-[2px] w-6 bg-[#6366f1] border-t border-dashed shrink-0" style={{ borderTop: "2px dashed #6366f1" }} />
              <span>Child (Adopted)</span>
            </div>
            <div className="flex items-center gap-2 flex-nowrap">
              <div className="h-[20px] flex items-center justify-center shrink-0 w-6 font-semibold">
                <div className="h-0 w-full border-t-2 border-dotted border-[#a855f7]" style={{ borderTop: "2px dotted #a855f7" }} />
              </div>
              <span>Child (Step)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-[4px] w-6 bg-[#3b82f6] shrink-0" />
              <span>Selected / Active</span>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
