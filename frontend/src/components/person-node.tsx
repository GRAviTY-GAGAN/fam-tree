"use client";

import React from "react";
import { Handle, Position } from "@xyflow/react";
import { Skull, Briefcase, MapPin } from "lucide-react";
import { clsx } from "clsx";

export interface PersonNodeData {
  id: number;
  name: string;
  gender: string;
  birth_date: string | null;
  death_date: string | null;
  is_alive: boolean;
  native_place: string | null;
  current_place: string | null;
  occupation: string | null;
  photo_url: string | null;
  custom_fields: string;
  onAvatarClick: (e: React.MouseEvent, photoUrl: string, name: string) => void;
  onNodeClick: (nodeData: any) => void;
}

export function PersonNode({ data }: { data: PersonNodeData }) {
  const getYear = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).getFullYear();
    } catch {
      return null;
    }
  };

  const birthYear = getYear(data.birth_date);
  const deathYear = getYear(data.death_date);

  // Linear-style clean left side border accent based on gender/living status
  const accentBorderColor = !data.is_alive
    ? "border-l-slate-400"
    : {
        male: "border-l-blue-500",
        female: "border-l-pink-500",
        other: "border-l-amber-500",
      }[data.gender.toLowerCase()] || "border-l-border";

  return (
    <div 
      onClick={() => data.onNodeClick(data)}
      className={clsx(
        "relative w-64 p-3 bg-card border border-border border-l-3 hover:border-border/100 hover:shadow-xs transition duration-150 cursor-pointer backdrop-blur-md rounded-md select-none",
        accentBorderColor,
        !data.is_alive && "opacity-75 grayscale-30"
      )}
    >
      {/* Handles for Hierarchical layout */}
      <Handle type="target" position={Position.Top} id="top" className="!w-1.5 !h-1.5 !bg-border hover:!bg-primary" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-1.5 !h-1.5 !bg-border hover:!bg-primary" />
      <Handle type="target" position={Position.Left} id="left" className="!w-1.5 !h-1.5 !bg-border hover:!bg-primary" />
      <Handle type="source" position={Position.Right} id="right" className="!w-1.5 !h-1.5 !bg-border hover:!bg-primary" />

      {/* Tiny Status Indicator Badge */}
      {!data.is_alive && (
        <span className="absolute top-2 right-2 text-[9px] font-mono uppercase tracking-wider text-red-500 flex items-center gap-1 bg-red-500/15 dark:bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
          <Skull className="h-2.5 w-2.5 shrink-0" />
          Deceased
        </span>
      )}

      <div className="flex gap-3 items-center">
        {/* Avatar with sharp 4px corners */}
        <div 
          className="relative h-10 w-10 rounded overflow-hidden border border-border shrink-0 hover:scale-103 transition cursor-zoom-in"
          onClick={(e) => {
            e.stopPropagation();
            if (data.photo_url) {
              data.onAvatarClick(e, data.photo_url, data.name);
            }
          }}
        >
          {data.photo_url ? (
            <img 
              src={data.photo_url} 
              alt={data.name} 
              className="h-full w-full object-cover" 
            />
          ) : (
            <div className="h-full w-full bg-muted flex items-center justify-center font-mono font-bold text-xs text-muted-foreground">
              {data.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold truncate leading-tight tracking-tight text-foreground pr-10">
            {data.name}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1 flex items-center gap-1.5">
            <span>
              {birthYear || "?"} – {data.is_alive ? "Present" : (deathYear || "RIP")}
            </span>
            {data.occupation && (
              <>
                <span className="text-border">•</span>
                <span className="truncate max-w-[80px]" title={data.occupation}>{data.occupation}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
