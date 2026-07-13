"use client";

import React from "react";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { BranchesSection } from "./components/branches-section";
import { PoolSection } from "./components/pool-section";

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  router: any;
  treeInfo: any;
  subgraphData: {
    partialSubtrees: any[][];
    floatingPool: any[];
  };
  activeComponentIndex: number | "main";
  setActiveComponentIndex: (index: number | "main") => void;
  dbPeople: any[];
  handleAddFloatingPerson: () => Promise<void>;
  isAddingFloating: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredSearchPeople: any[];
  handleNodeInspect: (nodeData: any) => void;
}

export function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  router,
  treeInfo,
  subgraphData,
  activeComponentIndex,
  setActiveComponentIndex,
  dbPeople,
  handleAddFloatingPerson,
  isAddingFloating,
  searchQuery,
  setSearchQuery,
  filteredSearchPeople,
  handleNodeInspect,
}: SidebarProps) {
  return (
    <aside className={`${isSidebarOpen ? "flex" : "hidden"} w-full sm:w-80 border-b sm:border-b-0 sm:border-r border-border bg-card flex flex-col shrink-0 select-none absolute sm:relative inset-y-0 left-0 z-30 sm:z-10`}>
      <div className="p-4 border-b border-border space-y-3.5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-1 px-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="h-3 w-3" />
            dashboard
          </button>
          <div className="flex items-center gap-2">
            <span
              title={treeInfo?.tree_id}
              onClick={() => treeInfo?.tree_id && navigator.clipboard.writeText(treeInfo.tree_id)}
              className="text-[10px] font-mono text-muted-foreground/60 cursor-copy hover:text-muted-foreground transition"
            >
              tree_id: …{treeInfo?.tree_id?.slice(-4)}
            </span>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-sm font-bold tracking-tight text-foreground">{treeInfo?.name}</h1>
          <p className="text-[11px] text-muted-foreground leading-normal mt-0.5 line-clamp-2">
            {treeInfo?.description || "Visualizing lineage chart."}
          </p>
        </div>
      </div>

      {/* Branches navigation section */}
      <BranchesSection
        subgraphData={subgraphData}
        activeComponentIndex={activeComponentIndex}
        setActiveComponentIndex={setActiveComponentIndex}
        dbPeople={dbPeople}
      />

      {/* Floating Pool Cards Deck & Search */}
      <PoolSection
        subgraphData={subgraphData}
        handleAddFloatingPerson={handleAddFloatingPerson}
        isAddingFloating={isAddingFloating}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredSearchPeople={filteredSearchPeople}
        handleNodeInspect={handleNodeInspect}
      />
    </aside>
  );
}
