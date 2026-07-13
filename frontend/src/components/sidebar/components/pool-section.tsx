"use client";

import React from "react";
import { UserPlus, Loader2, Search, Unlink, Link } from "lucide-react";

interface PoolSectionProps {
  subgraphData: {
    partialSubtrees: any[][];
    floatingPool: any[];
  };
  handleAddFloatingPerson: () => Promise<void>;
  isAddingFloating: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredSearchPeople: any[];
  handleNodeInspect: (nodeData: any) => void;
}

export function PoolSection({
  subgraphData,
  handleAddFloatingPerson,
  isAddingFloating,
  searchQuery,
  setSearchQuery,
  filteredSearchPeople,
  handleNodeInspect,
}: PoolSectionProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest truncate max-w-[200px]" title={searchQuery.trim() ? "Search Results" : "Unconnected Pool"}>
          {searchQuery.trim() 
            ? `Search Results (${filteredSearchPeople.length})` 
            : `Unconnected Pool (${subgraphData.floatingPool.length})`
          }
        </span>
        
        <button
          onClick={handleAddFloatingPerson}
          disabled={isAddingFloating}
          title="Create Floating Isolation Node"
          className="p-1 rounded border border-border hover:bg-muted hover:text-primary transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isAddingFloating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserPlus className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Search lineage member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded px-2.5 py-1 pl-8 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-border"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 bg-muted/5">
        {!searchQuery.trim() ? (
          subgraphData.floatingPool.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground/40 py-6">
              Pool is empty
            </div>
          ) : (
            subgraphData.floatingPool.map((fp) => (
              <div
                key={fp.person_id}
                onClick={() => handleNodeInspect({ id: fp.person_id })}
                className="flex items-center justify-between p-2 bg-card border border-border/80 hover:border-border/100 hover:bg-muted/10 rounded transition duration-100 cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-6 w-6 rounded-sm bg-muted border flex items-center justify-center font-mono font-bold text-[10px] text-muted-foreground shrink-0 overflow-hidden">
                    {fp.photo_url ? (
                      <img src={fp.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      fp.name ? fp.name[0] : "?"
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-foreground truncate">{fp.name}</span>
                </div>
                <div className="shrink-0 p-1.5 hover:bg-muted rounded transition" title="Unconnected Pool Member">
                  <Unlink className="h-3.5 w-3.5 text-muted-foreground/60" />
                </div>
              </div>
            ))
          )
        ) : (
          filteredSearchPeople.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground/40 py-6">
              No members found
            </div>
          ) : (
            filteredSearchPeople.map((fp) => {
              const isFloating = subgraphData.floatingPool.some(node => node.person_id === fp.person_id);
              return (
                <div
                  key={fp.person_id}
                  onClick={() => handleNodeInspect({ id: fp.person_id })}
                  className="flex items-center justify-between p-2 bg-card border border-border/80 hover:border-border/100 hover:bg-muted/10 rounded transition duration-100 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-6 w-6 rounded-sm bg-muted border flex items-center justify-center font-mono font-bold text-[10px] text-muted-foreground shrink-0 overflow-hidden">
                      {fp.photo_url ? (
                        <img src={fp.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        fp.name ? fp.name[0] : "?"
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-foreground truncate">{fp.name}</span>
                  </div>
                  <div className="shrink-0 p-1.5 hover:bg-muted rounded transition" title={isFloating ? "Unconnected Pool Member" : "Connected Lineage Member"}>
                    {isFloating ? (
                      <Unlink className="h-3.5 w-3.5 text-muted-foreground/60" />
                    ) : (
                      <Link className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
