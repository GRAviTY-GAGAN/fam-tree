"use client";

import React from "react";
import { 
  BaseEdge, 
  EdgeLabelRenderer, 
  getSmoothStepPath, 
  EdgeProps,
  useReactFlow
} from "@xyflow/react";
import { X } from "lucide-react";

export interface CustomEdgeData {
  id: number;
  relation_type: string;
  relation_subtype: string | null;
  onDeleteRelation: (id: number) => void;
}

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const edgeData = data as unknown as CustomEdgeData | undefined;

  // Use SmoothStep path for clean, tree-like right-angle pipelines
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8
  });

  // Calculate design style based on relation type/subtype
  let edgeStyle: React.CSSProperties = { ...style };
  
  if (selected) {
    // Selection state highlight style (blue outline)
    edgeStyle.stroke = "#3b82f6";
    edgeStyle.strokeWidth = 4;
  } else if (edgeData) {
    const { relation_type, relation_subtype } = edgeData;
    
    if (relation_type === "spouse") {
      // Spouse colors (rose / pink scale)
      if (relation_subtype === "divorced") {
        edgeStyle.stroke = "#f43f5e";      // Rose
        edgeStyle.strokeDasharray = "5,5"; // Divorced dashed
        edgeStyle.strokeWidth = 2;
      } else {
        edgeStyle.stroke = "#e11d48";      // Rose-600
        edgeStyle.strokeWidth = 3.5;       // Married is thick
      }
    } else {
      // Parent -> Child colors (slate/indigo/purple scale)
      if (relation_subtype === "adopted") {
        edgeStyle.stroke = "#6366f1";      // Indigo
        edgeStyle.strokeDasharray = "6,4"; // Adopted dashed
        edgeStyle.strokeWidth = 2;
      } else if (relation_subtype === "step") {
        edgeStyle.stroke = "#a855f7";      // Purple
        edgeStyle.strokeDasharray = "2,4"; // Step dotted
        edgeStyle.strokeWidth = 2;
      } else {
        edgeStyle.stroke = "#94a3b8";      // Neutral slate
        edgeStyle.strokeWidth = 2.5;       // Biological solid
      }
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (edgeData && edgeData.onDeleteRelation) {
      edgeData.onDeleteRelation(edgeData.id);
    }
  };

  const showLabel = selected || (edgeData as any)?.showLabel;
  const labelText = edgeData?.relation_subtype
    ? edgeData.relation_subtype.charAt(0).toUpperCase() + edgeData.relation_subtype.slice(1)
    : (edgeData?.relation_type === "spouse" ? "Spouse" : "Parent");

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      
      {/* interactive floating delete button and labels */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan group z-20"
        >
          <button
            onClick={handleDelete}
            title="Delete Relationship Link"
            className="flex items-center justify-center h-5 w-5 rounded-full bg-card border border-destructive/20 text-muted-foreground hover:text-destructive hover:border-destructive shadow-sm hover:scale-115 transition duration-150 cursor-pointer"
          >
            <X className="h-3 w-3 shrink-0" />
          </button>
        </div>

        {showLabel && edgeData && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 18}px)`,
              pointerEvents: "none",
            }}
            className="nodrag nopan select-none bg-zinc-900 dark:bg-zinc-100 border border-zinc-700 dark:border-zinc-300 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm text-zinc-100 dark:text-zinc-900 uppercase tracking-widest leading-none z-10 animate-in fade-in zoom-in-95 duration-100"
          >
            {labelText}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
