"use client";

import React from "react";
import { ReactFlow, Background, Controls, Node, Edge } from "@xyflow/react";
import { Menu } from "lucide-react";
import { PersonNode } from "@/components/person-node";
import { CustomEdge } from "@/components/custom-edge";
import { EmptyCanvas } from "./components/empty-canvas";
import { LegendPanel } from "./components/legend-panel";
import { ControllersPanel } from "./components/controllers-panel";

// ReactFlow custom types definitions
const nodeTypes = {
  person: PersonNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

interface ViewportProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  handleAddFloatingPerson: () => Promise<void>;
  isAddingFloating: boolean;
  showEdgeLabels: boolean;
  setShowEdgeLabels: (show: boolean) => void;
  handleExportCanvasImage: () => void;
}

export function Viewport({
  isSidebarOpen,
  setIsSidebarOpen,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  handleAddFloatingPerson,
  isAddingFloating,
  showEdgeLabels,
  setShowEdgeLabels,
  handleExportCanvasImage,
}: ViewportProps) {
  return (
    <main className="flex-1 relative flex flex-col min-w-0">
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute top-3 left-3 z-20 p-2 bg-card border border-border rounded hover:bg-muted text-foreground transition shadow-xs"
          title="Expand Sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}
      {nodes.length === 0 ? (
        <EmptyCanvas
          handleAddFloatingPerson={handleAddFloatingPerson}
          isAddingFloating={isAddingFloating}
        />
      ) : (
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            minZoom={0.1}
            maxZoom={2}
          >
            <Background gap={16} size={1} />
            <Controls showInteractive={false} position="bottom-right" className="!bg-card !border-border" />
            
            {/* Overlay operations controllers */}
            <ControllersPanel
              showEdgeLabels={showEdgeLabels}
              setShowEdgeLabels={setShowEdgeLabels}
              handleExportCanvasImage={handleExportCanvasImage}
            />

            {/* Floating Legend Key */}
            <LegendPanel />
          </ReactFlow>
        </div>
      )}
    </main>
  );
}
export default Viewport;
