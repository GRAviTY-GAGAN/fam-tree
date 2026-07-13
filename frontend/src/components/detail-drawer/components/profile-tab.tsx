"use client";

import React, { useState, useMemo } from "react";
import { Check, Trash2 } from "lucide-react";

interface ProfileTabProps {
  selectedPerson: any;
  setSelectedPerson: (person: any | null) => void;
  token: string;
  loadTreeContext: () => Promise<void>;
  setToast: (toast: { message: string; type: "success" | "error" } | null) => void;
  onDeleteMember: () => void;
}

export function ProfileTab({
  selectedPerson,
  setSelectedPerson,
  token,
  loadTreeContext,
  setToast,
  onDeleteMember,
}: ProfileTabProps) {
  const [customKey, setCustomKey] = useState("");
  const [customVal, setCustomVal] = useState("");

  const customFields = useMemo(() => {
    if (!selectedPerson) return {};
    try {
      return JSON.parse(selectedPerson.custom_fields || "{}");
    } catch {
      return {};
    }
  }, [selectedPerson]);

  const handleAddCustomAttribute = async () => {
    if (!customKey.trim() || !customVal.trim() || !selectedPerson) return;

    const updatedFields = {
      ...customFields,
      [customKey.trim()]: customVal.trim()
    };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/people/${selectedPerson.person_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          custom_fields: JSON.stringify(updatedFields)
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedPerson(updated);
        setCustomKey("");
        setCustomVal("");
        await loadTreeContext();
        setToast({ message: "Custom attribute added.", type: "success" });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({ message: errData.detail || "Failed to add custom attribute.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (e) {
      console.error(e);
      setToast({ message: "Failed to add custom attribute.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleDeleteCustomAttribute = async (keyToDelete: string) => {
    if (!selectedPerson) return;

    const { [keyToDelete]: _, ...updatedFields } = customFields as any;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/people/${selectedPerson.person_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          custom_fields: JSON.stringify(updatedFields)
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedPerson(updated);
        await loadTreeContext();
        setToast({ message: "Custom attribute deleted.", type: "success" });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({ message: errData.detail || "Failed to delete custom attribute.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (e) {
      console.error(e);
      setToast({ message: "Failed to delete custom attribute.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-4 items-center">
        <div className="h-12 w-12 border border-border rounded bg-muted flex items-center justify-center font-mono font-bold text-lg text-muted-foreground overflow-hidden shrink-0">
          {selectedPerson.photo_url ? (
            <img src={selectedPerson.photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            selectedPerson.name[0]
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-foreground leading-snug">{selectedPerson.name}</h3>
          <div className="text-[10px] text-muted-foreground flex gap-1.5 mt-0.5 uppercase tracking-wider items-center">
            <span className="text-foreground">{selectedPerson.gender}</span>
            <span className="text-border">•</span>
            <span>{selectedPerson.is_alive ? "Living" : "Deceased"}</span>
          </div>
        </div>
      </div>

      {/* Linear-style Properties Table */}
      <div className="border border-border/85 rounded divide-y divide-border/60 overflow-hidden text-xs">
        <div className="flex justify-between items-center p-2 bg-muted/5">
          <span className="uppercase text-[9px] tracking-wider text-muted-foreground">Birth Date</span>
          <span className="font-medium text-foreground">{selectedPerson.birth_date || "Not Provided"}</span>
        </div>
        {!selectedPerson.is_alive && (
          <div className="flex justify-between items-center p-2 bg-muted/5">
            <span className="uppercase text-[9px] tracking-wider text-muted-foreground">Death Date</span>
            <span className="font-medium text-foreground">{selectedPerson.death_date || "Not Provided"}</span>
          </div>
        )}
        <div className="flex justify-between items-center p-2 bg-muted/5">
          <span className="uppercase text-[9px] tracking-wider text-muted-foreground">Native Origin</span>
          <span className="font-medium text-foreground">{selectedPerson.native_place || "Not Provided"}</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-muted/5">
          <span className="uppercase text-[9px] tracking-wider text-muted-foreground">Current City</span>
          <span className="font-medium text-foreground">{selectedPerson.current_place || "Not Provided"}</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-muted/5">
          <span className="uppercase text-[9px] tracking-wider text-muted-foreground">Occupation</span>
          <span className="font-medium text-foreground">{selectedPerson.occupation || "Not Provided"}</span>
        </div>
      </div>

      {/* Dynamic custom attributes */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Custom Attributes</span>
        
        {Object.keys(customFields).length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No custom fields created.</p>
        ) : (
          <div className="space-y-1.5">
            {Object.entries(customFields).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs p-2 bg-muted/40 border border-border/80 rounded-lg">
                <span className="font-semibold text-muted-foreground">{key}:</span>
                <div className="flex items-center gap-2">
                  <span>{String(val)}</span>
                  <button 
                    onClick={() => handleDeleteCustomAttribute(key)}
                    className="p-0.5 text-destructive hover:bg-destructive/10 transition rounded"
                    title="Delete Attribute"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New custom attribute setup */}
        <div className="pt-3 border-t border-border flex gap-2 items-center">
          <input
            type="text"
            placeholder="Label (e.g. Hobby)"
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value)}
            className="flex-1 bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
          />
          <input
            type="text"
            placeholder="Value"
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            className="flex-1 bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
          />
          <button
            onClick={handleAddCustomAttribute}
            className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="pt-6 border-t border-border">
        <button
          onClick={onDeleteMember}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive/10 transition text-sm font-semibold"
        >
          <Trash2 className="h-4 w-4" />
          Delete Member Profile
        </button>
      </div>
    </div>
  );
}
