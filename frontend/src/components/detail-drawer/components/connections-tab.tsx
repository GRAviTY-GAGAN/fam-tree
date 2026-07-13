"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Check, Trash2, Loader2, Save } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface ConnectionsTabProps {
  selectedPerson: any;
  setSelectedPerson: (person: any | null) => void;
  dbPeople: any[];
  dbRelations: any[];
  treeId: string;
  token: string;
  loadTreeContext: () => Promise<void>;
  setToast: (toast: { message: string; type: "success" | "error" } | null) => void;
  onDeleteRelation: (relationshipId: string) => void;
  pendingSortOrders: Record<string, number>;
  setPendingSortOrders: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  isSavingSortOrders: boolean;
  handleSaveSortOrders: () => Promise<void>;
}

export function ConnectionsTab({
  selectedPerson,
  setSelectedPerson,
  dbPeople,
  dbRelations,
  treeId,
  token,
  loadTreeContext,
  setToast,
  onDeleteRelation,
  pendingSortOrders,
  setPendingSortOrders,
  isSavingSortOrders,
  handleSaveSortOrders,
}: ConnectionsTabProps) {
  // Relation builder states
  const [relActionType, setRelActionType] = useState<"parent" | "spouse" | "child" | null>(null);
  const [relLinkMode, setRelLinkMode] = useState<"existing" | "new">("existing");
  const [existingTargetId, setExistingTargetId] = useState<string>("");
  const [targetSearchQuery, setTargetSearchQuery] = useState("");
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  
  const [newTargetName, setNewTargetName] = useState("");
  const [newTargetGender, setNewTargetGender] = useState("Male");
  const [newTargetRelSubtype, setNewTargetRelSubtype] = useState("biological");
  const [newTargetSortOrder, setNewTargetSortOrder] = useState<number>(1);
  const [relationSubmitting, setRelationSubmitting] = useState(false);

  // Default subtype based on connection type
  useEffect(() => {
    if (relActionType === "spouse") {
      setNewTargetRelSubtype("married");
    } else {
      setNewTargetRelSubtype("biological");
    }
  }, [relActionType]);

  // Compute Spouses list
  const spouses = useMemo(() => {
    if (!selectedPerson) return [];
    return dbRelations
      .filter(r => r.relation_type === "spouse" && (r.person_id === selectedPerson.person_id || r.related_person_id === selectedPerson.person_id))
      .map(rel => {
        const partnerId = rel.person_id === selectedPerson.person_id ? rel.related_person_id : rel.person_id;
        const spouse = dbPeople.find(p => p.person_id === partnerId);
        return { rel, spouse };
      })
      .filter(item => item.spouse !== undefined)
      .sort((a, b) => {
        const aOrder = pendingSortOrders[a.rel.relationship_id] ?? a.rel.sort_order ?? 1;
        const bOrder = pendingSortOrders[b.rel.relationship_id] ?? b.rel.sort_order ?? 1;
        return aOrder - bOrder;
      }) as { rel: any; spouse: any }[];
  }, [selectedPerson, dbRelations, dbPeople, pendingSortOrders]);

  // Compute Parents list
  const parents = useMemo(() => {
    if (!selectedPerson) return [];
    return dbRelations
      .filter(r => r.relation_type === "parent" && r.related_person_id === selectedPerson.person_id)
      .map(rel => {
        const parent = dbPeople.find(p => p.person_id === rel.person_id);
        return { rel, parent };
      })
      .filter(item => item.parent !== undefined) as { rel: any; parent: any }[];
  }, [selectedPerson, dbRelations, dbPeople]);

  // Compute Children list
  const childrenRels = useMemo(() => {
    if (!selectedPerson) return [];
    return dbRelations
      .filter(r => r.relation_type === "parent" && r.person_id === selectedPerson.person_id)
      .map(rel => {
        const child = dbPeople.find(p => p.person_id === rel.related_person_id);
        return { rel, child };
      })
      .filter(item => item.child !== undefined)
      .sort((a, b) => {
        const aOrder = pendingSortOrders[a.rel.relationship_id] ?? a.rel.sort_order ?? 1;
        const bOrder = pendingSortOrders[b.rel.relationship_id] ?? b.rel.sort_order ?? 1;
        return aOrder - bOrder;
      }) as { rel: any; child: any }[];
  }, [selectedPerson, dbRelations, dbPeople, pendingSortOrders]);

  const hasPendingChanges = useMemo(() => {
    return Object.entries(pendingSortOrders).some(([relId, order]) => {
      const rel = dbRelations.find(r => r.relationship_id === relId);
      return rel && (rel.sort_order ?? 1) !== order;
    });
  }, [pendingSortOrders, dbRelations]);

  const availableBondsBypersons = useMemo(() => {
    if (!selectedPerson) return [];
    return dbPeople.filter(p => p.person_id !== selectedPerson.person_id);
  }, [dbPeople, selectedPerson]);

  const filteredTargetCandidates = useMemo(() => {
    if (!targetSearchQuery.trim()) return availableBondsBypersons;
    const q = targetSearchQuery.toLowerCase();
    return availableBondsBypersons.filter(p => p.name.toLowerCase().includes(q));
  }, [availableBondsBypersons, targetSearchQuery]);

  const existingTargetName = useMemo(() => {
    const found = dbPeople.find(p => p.person_id === existingTargetId);
    return found ? `${found.name} (${found.gender})` : "";
  }, [existingTargetId, dbPeople]);

  const handleAddNewRelation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson || !token || !relActionType) return;

    setRelationSubmitting(true);
    try {
      let targetId: string | null = null;

      if (relLinkMode === "existing") {
        if (!existingTargetId) {
          alert("Please select a name.");
          setRelationSubmitting(false);
          return;
        }
        targetId = existingTargetId;
      } else {
        // Create new person first
        if (!newTargetName.trim()) {
          alert("Please input family member's name.");
          setRelationSubmitting(false);
          return;
        }

        const createRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/people`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            tree_id: treeId,
            name: newTargetName,
            gender: newTargetGender
          })
        });

        if (createRes.ok) {
          const newPerson = await createRes.json();
          targetId = newPerson.person_id;
          setNewTargetName("");
        } else {
          const errData = await createRes.json().catch(() => ({}));
          throw new Error(errData.detail || "Failed to create new family member.");
        }
      }

      if (!targetId) return;

      // Determine parent/child source/target mappings
      let sourceId = selectedPerson.person_id;
      let targetPersonId = targetId;
      let rType = "parent";

      if (relActionType === "parent") {
        sourceId = targetId;
        targetPersonId = selectedPerson.person_id;
        rType = "parent";
      } else if (relActionType === "child") {
        sourceId = selectedPerson.person_id;
        targetPersonId = targetId;
        rType = "parent";
      } else if (relActionType === "spouse") {
        sourceId = selectedPerson.person_id;
        targetPersonId = targetId;
        rType = "spouse";
      }

      const relRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/relationships`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tree_id: treeId,
          person_id: sourceId,
          related_person_id: targetPersonId,
          relation_type: rType,
          relation_subtype: newTargetRelSubtype,
          sort_order: newTargetSortOrder
        })
      });

      if (relRes.ok) {
        setRelActionType(null);
        setExistingTargetId("");
        setNewTargetSortOrder(1);
        await loadTreeContext();
        
        // Refresh selectedPerson reference
        const fresh = dbPeople.find(p => p.person_id === selectedPerson.person_id);
        if (fresh) setSelectedPerson(fresh);
        setToast({ message: "Relationship connected successfully.", type: "success" });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await relRes.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to connect family relationship.");
      }
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || "Failed to connect family relationship.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setRelationSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-h-[75vh] overflow-y-auto pb-4 pr-1">
      {/* Current Active Connections list */}
      <div className="space-y-4 border-b border-border pb-5 select-none">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
          Current Connections
        </span>
        
        {/* Spouses */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
            Spouses / Partners
          </div>
          {spouses.length === 0 ? (
            <p className="text-xs text-muted-foreground/40 italic pl-1 py-1">No spouse connections yet</p>
          ) : (
            <div className="space-y-1.5">
              {spouses.map(({ rel, spouse }) => {
                const currentVal = pendingSortOrders[rel.relationship_id] ?? rel.sort_order ?? 1;
                return (
                  <div key={rel.relationship_id} className="flex items-center justify-between bg-muted/30 border border-border/80 rounded-lg p-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-foreground truncate">{spouse.name}</span>
                      <span className="text-[9px] text-muted-foreground/80 capitalize bg-background px-1.5 py-0.5 rounded border leading-none shrink-0">
                        {rel.relation_subtype || "spouse"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Select
                        value={String(currentVal)}
                        onValueChange={(val) => {
                          const order = parseInt(val || "1", 10);
                          setPendingSortOrders(prev => ({
                            ...prev,
                            [rel.relationship_id]: order
                          }));
                        }}
                      >
                        <SelectTrigger className="h-[24px] px-1.5 py-0 text-[10px] bg-background border border-border rounded-md font-semibold select-none [&_svg]:size-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border rounded-lg p-1 text-[10px] text-foreground shadow-md w-28">
                          {[1, 2, 3, 4, 5].map(o => (
                            <SelectItem key={o} value={String(o)}>Spouse {o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onDeleteRelation(rel.relationship_id)}
                        title="Disconnect Spouse"
                        className="text-destructive border border-transparent hover:border-destructive hover:bg-destructive/15"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Parents */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
            Parents
          </div>
          {parents.length === 0 ? (
            <p className="text-xs text-muted-foreground/40 italic pl-1 py-1">No parent connections yet</p>
          ) : (
            <div className="space-y-1.5">
              {parents.map(({ rel, parent }) => (
                <div key={rel.relationship_id} className="flex items-center justify-between bg-muted/30 border border-border/80 rounded-lg p-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-foreground truncate">{parent.name}</span>
                    <span className="text-[9px] text-muted-foreground/80 capitalize bg-background px-1.5 py-0.5 rounded border leading-none shrink-0">
                      {rel.relation_subtype || "parent"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onDeleteRelation(rel.relationship_id)}
                    title="Disconnect Parent"
                    className="text-destructive border border-transparent hover:border-destructive hover:bg-destructive/15 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Children */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
            Children
          </div>
          {childrenRels.length === 0 ? (
            <p className="text-xs text-muted-foreground/40 italic pl-1 py-1">No children connections yet</p>
          ) : (
            <div className="space-y-1.5">
              {childrenRels.map(({ rel, child }) => {
                const currentVal = pendingSortOrders[rel.relationship_id] ?? rel.sort_order ?? 1;
                return (
                  <div key={rel.relationship_id} className="flex items-center justify-between bg-muted/30 border border-border/80 rounded-lg p-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-foreground truncate">{child.name}</span>
                      <span className="text-[9px] text-muted-foreground/80 capitalize bg-background px-1.5 py-0.5 rounded border leading-none shrink-0 text-center">
                        {rel.relation_subtype || "child"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Select
                        value={String(currentVal)}
                        onValueChange={(val) => {
                          const order = parseInt(val || "1", 10);
                          setPendingSortOrders(prev => ({
                            ...prev,
                            [rel.relationship_id]: order
                          }));
                        }}
                      >
                        <SelectTrigger className="h-[24px] px-1.5 py-0 text-[10px] bg-background border border-border rounded-md font-semibold select-none [&_svg]:size-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border rounded-lg p-1 text-[10px] text-foreground shadow-md w-28">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(o => (
                            <SelectItem key={o} value={String(o)}>Child {o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onDeleteRelation(rel.relationship_id)}
                        title="Disconnect Child"
                        className="text-destructive border border-transparent hover:border-destructive hover:bg-destructive/15"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Batch Save Button */}
        {hasPendingChanges && (
          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSaveSortOrders}
              disabled={isSavingSortOrders}
              className="flex-1 font-bold shadow-sm"
            >
              {isSavingSortOrders ? (
                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              ) : (
                <Save className="h-3 w-3 shrink-0" />
              )}
              <span>Save changes</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPendingSortOrders({})}
              disabled={isSavingSortOrders}
              className="flex-1 font-semibold"
            >
              Discard changes
            </Button>
          </div>
        )}
      </div>

      {/* Select actions trigger */}
      {!relActionType ? (
        <div className="space-y-3">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-2">Build New Connection</span>
          <button
            onClick={() => setRelActionType("parent")}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 border hover:border-primary/45 rounded-xl transition duration-150 font-semibold text-sm"
          >
            <span>Add Parent Connection</span>
            <span className="text-xs text-muted-foreground">Attach Father / Mother</span>
          </button>
          <button
            onClick={() => setRelActionType("spouse")}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 border hover:border-primary/45 rounded-xl transition duration-150 font-semibold text-sm"
          >
            <span>Add Spouse Connection</span>
            <span className="text-xs text-muted-foreground">Attach Married / Partner partner</span>
          </button>
          <button
            onClick={() => setRelActionType("child")}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 border hover:border-primary/45 rounded-xl transition duration-150 font-semibold text-sm"
          >
            <span>Add Child Connection</span>
            <span className="text-xs text-muted-foreground">Attach Daughter / Son</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleAddNewRelation} className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-sm font-bold text-primary uppercase tracking-wide">
              Add {relActionType.toUpperCase()}
            </span>
            <button
              type="button"
              onClick={() => setRelActionType(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>

          {/* Select target type */}
          <div className="flex border border-border p-1 rounded-lg text-xs font-semibold bg-muted select-none">
            <button
              type="button"
              onClick={() => setRelLinkMode("existing")}
              className={`flex-1 text-center py-1.5 rounded transition ${relLinkMode === "existing" ? "bg-background shadow-xs text-primary" : "text-muted-foreground"}`}
            >
              Connect Existing
            </button>
            <button
              type="button"
              onClick={() => setRelLinkMode("new")}
              className={`flex-1 text-center py-1.5 rounded transition ${relLinkMode === "new" ? "bg-background shadow-xs text-primary" : "text-muted-foreground"}`}
            >
              Create New Member
            </button>
          </div>

          {/* Connect mode dropdown */}
          {relLinkMode === "existing" ? (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                Choose Target Member
              </label>
              {availableBondsBypersons.length === 0 ? (
                <p className="text-xs text-muted-foreground italic col-span-2">No other candidates inside target project database.</p>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder={existingTargetName ? existingTargetName : "-- Search name to choose --"}
                    value={targetSearchQuery}
                    onChange={(e) => {
                      setTargetSearchQuery(e.target.value);
                      setIsTargetDropdownOpen(true);
                    }}
                    onFocus={() => setIsTargetDropdownOpen(true)}
                    className="w-full h-10 px-3 bg-muted border border-border rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary placeholder-foreground/80"
                  />
                  {isTargetDropdownOpen && (
                    <>
                      {/* Close Click Backdrop overlay */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => {
                          setIsTargetDropdownOpen(false);
                          setTargetSearchQuery("");
                        }} 
                      />
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-popover border border-border rounded-lg p-1 text-xs text-foreground shadow-md z-50">
                        {filteredTargetCandidates.length === 0 ? (
                          <div className="text-center text-xs text-muted-foreground/60 py-3">
                            No members matched
                          </div>
                        ) : (
                          filteredTargetCandidates.map(p => (
                            <button
                              key={p.person_id}
                              type="button"
                              onClick={() => {
                                setExistingTargetId(p.person_id);
                                setTargetSearchQuery("");
                                setIsTargetDropdownOpen(false);
                              }}
                              className={`w-full text-left p-2 rounded hover:bg-muted font-semibold flex justify-between items-center transition duration-75 ${existingTargetId === p.person_id ? "bg-muted text-primary" : "text-foreground"}`}
                            >
                              <span>{p.name} ({p.gender})</span>
                              {existingTargetId === p.person_id && (
                                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                  New Person Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Benjamin Smith"
                  value={newTargetName}
                  onChange={(e) => setNewTargetName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1 font-bold">
                  Gender Identity
                </label>
                <div className="flex gap-4 text-xs font-semibold mt-1">
                  {["Male", "Female", "Other"].map(g => (
                    <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="target-gender"
                        checked={newTargetGender === g}
                        onChange={() => setNewTargetGender(g)}
                        className="text-primary focus:ring-0"
                      />
                      <span>{g}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Relationship Subtype Selection rules */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
              Relationship Subtype
            </label>
            {relActionType === "spouse" ? (
              <Select
                value={newTargetRelSubtype}
                onValueChange={(val) => setNewTargetRelSubtype(val || "")}
              >
                <SelectTrigger className="w-full h-10 px-3 text-sm bg-muted border border-border rounded-lg focus-visible:ring-0 [&_svg]:size-4">
                  <SelectValue placeholder="Select Subtype" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border rounded-lg p-1 text-xs text-foreground shadow-md w-[var(--anchor-width)]">
                  <SelectItem value="married">Married (Solid Bold Line)</SelectItem>
                  <SelectItem value="partner">Partner (Solid Rose Line)</SelectItem>
                  <SelectItem value="divorced">Divorced (Dashed Slashed Line)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={newTargetRelSubtype}
                onValueChange={(val) => setNewTargetRelSubtype(val || "")}
              >
                <SelectTrigger className="w-full h-10 px-3 text-sm bg-muted border border-border rounded-lg focus-visible:ring-0 [&_svg]:size-4">
                  <SelectValue placeholder="Select Subtype" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border rounded-lg p-1 text-xs text-foreground shadow-md w-[var(--anchor-width)]">
                  <SelectItem value="biological">Biological (Solid Slate Line)</SelectItem>
                  <SelectItem value="adopted">Adopted (Dashed Blue Line)</SelectItem>
                  <SelectItem value="step">Step-Parent (Dotted Violet Line)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Sequence sorting order selector */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
              Sequence Order / Sort Position
            </label>
            <Select
              value={String(newTargetSortOrder)}
              onValueChange={(val) => setNewTargetSortOrder(parseInt(val || "1", 10))}
            >
              <SelectTrigger className="w-full h-10 px-3 text-sm bg-muted border border-border rounded-lg focus-visible:ring-0 [&_svg]:size-4">
                <SelectValue placeholder="Select Order" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border rounded-lg p-1 text-xs text-foreground shadow-md w-[var(--anchor-width)]">
                {relActionType === "spouse" ? (
                  [1, 2, 3, 4, 5].map(o => (
                    <SelectItem key={o} value={String(o)}>Spouse / Partner {o}</SelectItem>
                  ))
                ) : (
                  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(o => (
                    <SelectItem key={o} value={String(o)}>Child / Sibling {o}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 flex justify-end gap-3 font-semibold">
            <button
              type="button"
              onClick={() => setRelActionType(null)}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={relationSubmitting}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground text-sm transition animate-in fade-in"
            >
              {relationSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Relationship
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
