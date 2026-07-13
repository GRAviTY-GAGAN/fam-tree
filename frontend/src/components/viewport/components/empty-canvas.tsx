"use client";

import React from "react";
import { Info, Loader2, Plus } from "lucide-react";

interface EmptyCanvasProps {
  handleAddFloatingPerson: () => Promise<void>;
  isAddingFloating: boolean;
}

export function EmptyCanvas({
  handleAddFloatingPerson,
  isAddingFloating,
}: EmptyCanvasProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-muted/20">
      <Info className="h-12 w-12 text-muted-foreground/50 mb-3 animate-pulse" />
      <h3 className="text-lg font-bold mb-1">Canvas View Empty</h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        Create independent family members in the left sidebar and link their relations inside details drawers to start auto layouts.
      </p>
      <button
        onClick={handleAddFloatingPerson}
        disabled={isAddingFloating}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isAddingFloating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        <span>Add First Member</span>
      </button>
    </div>
  );
}
