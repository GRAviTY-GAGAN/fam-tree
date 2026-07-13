"use client";

import React, { useState, useEffect } from "react";
import { ProfileTab } from "./components/profile-tab";
import { EditTab } from "./components/edit-tab";
import { ConnectionsTab } from "./components/connections-tab";

interface DetailDrawerProps {
  selectedPerson: any;
  setSelectedPerson: (person: any | null) => void;
  dbPeople: any[];
  dbRelations: any[];
  treeId: string;
  token: string;
  loadTreeContext: () => Promise<void>;
  setToast: (toast: { message: string; type: "success" | "error" } | null) => void;
  onDeleteMember: () => void;
  onDeleteRelation: (relationshipId: string) => void;
  pendingSortOrders: Record<string, number>;
  setPendingSortOrders: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  isSavingSortOrders: boolean;
  handleSaveSortOrders: () => Promise<void>;
}

export function DetailDrawer({
  selectedPerson,
  setSelectedPerson,
  dbPeople,
  dbRelations,
  treeId,
  token,
  loadTreeContext,
  setToast,
  onDeleteMember,
  onDeleteRelation,
  pendingSortOrders,
  setPendingSortOrders,
  isSavingSortOrders,
  handleSaveSortOrders,
}: DetailDrawerProps) {
  const [drawerTab, setDrawerTab] = useState<"profile" | "edit" | "relations">("profile");

  // Reset tab to profile when selectedPerson changes
  useEffect(() => {
    setDrawerTab("profile");
  }, [selectedPerson]);

  if (!selectedPerson) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs flex justify-end">
      {/* Close click triggers backdrop dismissal */}
      <div className="flex-1" onClick={() => setSelectedPerson(null)} />
      
      <div className="w-full max-w-md bg-card border-l border-border h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header info */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-foreground uppercase tracking-wider">Properties</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">View and edit {selectedPerson.name}'s profile</p>
          </div>
          <button
            onClick={() => setSelectedPerson(null)}
            className="p-1 px-2.5 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition text-[11px] font-semibold"
          >
            close
          </button>
        </div>

        {/* Tab Swappers */}
        <div className="flex border-b border-border text-xs select-none bg-muted/30">
          <button
            onClick={() => setDrawerTab("profile")}
            className={`flex-1 text-center py-2.5 transition ${drawerTab === "profile" ? "border-b-2 border-foreground text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Properties
          </button>
          <button
            onClick={() => setDrawerTab("edit")}
            className={`flex-1 text-center py-2.5 transition ${drawerTab === "edit" ? "border-b-2 border-foreground text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Edit Form
          </button>
          <button
            onClick={() => setDrawerTab("relations")}
            className={`flex-1 text-center py-2.5 transition ${drawerTab === "relations" ? "border-b-2 border-foreground text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Connections
          </button>
        </div>

        {/* Content areas */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: PROFILE VIEW */}
          {drawerTab === "profile" && (
            <ProfileTab
              selectedPerson={selectedPerson}
              setSelectedPerson={setSelectedPerson}
              token={token}
              loadTreeContext={loadTreeContext}
              setToast={setToast}
              onDeleteMember={onDeleteMember}
            />
          )}

          {/* TAB 2: UPDATE FORM */}
          {drawerTab === "edit" && (
            <EditTab
              selectedPerson={selectedPerson}
              setSelectedPerson={setSelectedPerson}
              token={token}
              loadTreeContext={loadTreeContext}
              setToast={setToast}
              setDrawerTab={setDrawerTab}
            />
          )}

          {/* TAB 3: RELATION LINKS BUILDER */}
          {drawerTab === "relations" && (
            <ConnectionsTab
              selectedPerson={selectedPerson}
              setSelectedPerson={setSelectedPerson}
              dbPeople={dbPeople}
              dbRelations={dbRelations}
              treeId={treeId}
              token={token}
              loadTreeContext={loadTreeContext}
              setToast={setToast}
              onDeleteRelation={onDeleteRelation}
              pendingSortOrders={pendingSortOrders}
              setPendingSortOrders={setPendingSortOrders}
              isSavingSortOrders={isSavingSortOrders}
              handleSaveSortOrders={handleSaveSortOrders}
            />
          )}
        </div>
      </div>
    </div>
  );
}
