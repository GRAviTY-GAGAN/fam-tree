"use client";

import React from "react";

interface BranchesSectionProps {
  subgraphData: {
    partialSubtrees: any[][];
    floatingPool: any[];
  };
  activeComponentIndex: number | "main";
  setActiveComponentIndex: (index: number | "main") => void;
  dbPeople: any[];
}

export function BranchesSection({
  subgraphData,
  activeComponentIndex,
  setActiveComponentIndex,
  dbPeople,
}: BranchesSectionProps) {
  return (
    <div className="p-3 bg-muted/20 border-b border-border space-y-2">
      <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest px-1">
        <span>Branches</span>
        <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded border border-border font-semibold">
          {subgraphData.partialSubtrees.length + 1}
        </span>
      </div>
      
      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
        <button
          onClick={() => setActiveComponentIndex("main")}
          className={`w-full text-left text-[11px] px-2 py-1.5 rounded flex items-center justify-between transition border ${activeComponentIndex === "main" ? "bg-muted border-border font-bold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}
        >
          <span>Main Tree</span>
          <span className={`text-[9px] px-1 rounded ${activeComponentIndex === "main" ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
            {dbPeople.length - subgraphData.floatingPool.length - subgraphData.partialSubtrees.reduce((acc, c) => acc + c.length, 0)}n
          </span>
        </button>

        {subgraphData.partialSubtrees.map((comp, idx) => (
          <button
            key={idx}
            onClick={() => setActiveComponentIndex(idx)}
            className={`w-full text-left text-[11px] px-2 py-1.5 rounded flex items-center justify-between transition border ${activeComponentIndex === idx ? "bg-muted border-border font-bold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}
          >
            <span>branch_{idx + 1}</span>
            <span className={`text-[9px] px-1 rounded ${activeComponentIndex === idx ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
              {comp.length}n
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
