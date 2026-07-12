"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ReactFlow, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState,
  Node,
  Edge,
  Panel,
  ReactFlowProvider
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { toPng } from "html-to-image";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "next-themes";
import { PersonNode } from "@/components/person-node";
import { CustomEdge } from "@/components/custom-edge";
import { 
  ArrowLeft, Plus, Download, Tag, Search, Eye, Share2, 
  Trash2, UserPlus, Info, Check, GitCommit, Heart, Loader2, Sparkles, Network,
  Menu, ChevronLeft, ShieldAlert, Save, ChevronUp, ChevronDown, Link, Unlink
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Register custom React Flow node/edge render mappings
const nodeTypes = {
  person: PersonNode
};

const edgeTypes = {
  custom: CustomEdge
};

// Family Quotes for the cold-start loader
const FAMILY_QUOTES = [
  "“In family life, love is the oil that eases friction, the cement that binds closer together, and the music that brings harmony.” – Eva Burrows",
  "“The bond that links your true family is not one of blood, but of respect and joy in each other's life.” – Richard Bach",
  "“Family is not an important thing. It's everything.” – Michael J. Fox",
  "“What can you do to promote world peace? Go home and love your family.” – Mother Teresa",
  "“Other things may change us, but we start and end with the family.” – Anthony Brandt"
];

// Layout builder using @dagrejs/dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Set horizontal/vertical direction (TB = top-to-bottom, LR = left-to-right)
  dagreGraph.setGraph({ rankdir: "TB", nodesep: 70, ranksep: 100 });

  nodes.forEach((node) => {
    // Standard node dimensions
    dagreGraph.setNode(node.id, { width: 256, height: 80 });
  });

  edges.forEach((edge) => {
    // Spouse nodes are pinned adjacent using weights and minlen rules in dagre
    const isSpouse = edge.sourceHandle === "left" || edge.sourceHandle === "right" || edge.targetHandle === "left" || edge.targetHandle === "right";
    dagreGraph.setEdge(edge.source, edge.target, {
      weight: isSpouse ? 20 : 1,
      minlen: isSpouse ? 1 : 2
    });
  });

  dagre.layout(dagreGraph);

  const newNodes: Node[] = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 128, // Offset by half width to center node
        y: nodeWithPosition.y - 40   // Offset by half height to center node
      }
    };
  });

  // Post-process spouse node alignment to sit side-by-side on exact same vertical level (rank)
  const spouseEdges = edges.filter(edge => 
    edge.sourceHandle === "left" || 
    edge.sourceHandle === "right" || 
    edge.targetHandle === "left" || 
    edge.targetHandle === "right"
  );

  spouseEdges.forEach(edge => {
    const sourceNode = newNodes.find(n => n.id === edge.source);
    const targetNode = newNodes.find(n => n.id === edge.target);
    if (sourceNode && targetNode) {
      targetNode.position.y = sourceNode.position.y;
      
      const gap = 340; // Maintain standard spacing for neat visual link line rendering
      if (Math.abs(targetNode.position.x - sourceNode.position.x) < gap) {
        if (targetNode.position.x > sourceNode.position.x) {
          targetNode.position.x = sourceNode.position.x + gap;
        } else {
          targetNode.position.x = sourceNode.position.x - gap;
        }
      }
    }
  });

  // Post-process sibling node horizontal ordering
  // Group children by parent node
  const parentToChildren = new Map<string, string[]>();
  edges.forEach(edge => {
    // Parent-child edges have sourceHandle = "bottom" / targetHandle = "top"
    const isParentLink = edge.sourceHandle === "bottom" || edge.targetHandle === "top"; 
    if (isParentLink) {
      if (!parentToChildren.has(edge.source)) {
        parentToChildren.set(edge.source, []);
      }
      parentToChildren.get(edge.source)!.push(edge.target);
    }
  });

  parentToChildren.forEach((childIds, parentId) => {
    // Unique children in current newNodes
    const siblingNodes = newNodes.filter(n => childIds.includes(n.id));
    if (siblingNodes.length > 1) {
      // Find the corresponding parent-child edge for each sibling node to read its sort_order
      const siblingWithOrder = siblingNodes.map(node => {
        const edge = edges.find(e => e.source === parentId && e.target === node.id);
        const order = (edge?.data as any)?.sort_order ?? 1;
        const rawData = node.data as any;
        const birth = rawData?.birth_date ? new Date(rawData.birth_date).getTime() : Infinity;
        return { node, order, birth };
      });

      // Sort siblings by sort_order first, then birth date fallback
      siblingWithOrder.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.birth - b.birth;
      });

      // Collect current horizontal x-positions and sort them ascending
      const xCoords = siblingNodes.map(n => n.position.x).sort((a, b) => a - b);

      // Re-assign sorted x-positions back to the nodes in sorted sequence
      siblingWithOrder.forEach((item, idx) => {
        item.node.position.x = xCoords[idx];
      });
    }
  });

  return { nodes: newNodes, edges };
};

// BFS Connected Subgraphs Splitter
function partitionGraph(nodes: any[], edges: any[]) {
  const adjacencyList = new Map<string, string[]>();
  nodes.forEach(n => adjacencyList.set(n.person_id, []));
  
  edges.forEach(e => {
    const s = e.source;
    const t = e.target;
    if (adjacencyList.has(s) && adjacencyList.has(t)) {
      adjacencyList.get(s)!.push(t);
      adjacencyList.get(t)!.push(s);
    }
  });

  const visited = new Set<string>();
  const subgraphs: string[][] = [];

  nodes.forEach(node => {
    if (!visited.has(node.person_id)) {
      const component: string[] = [];
      const queue = [node.person_id];
      visited.add(node.person_id);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        component.push(curr);
        
        const neighbors = adjacencyList.get(curr) || [];
        neighbors.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
      subgraphs.push(component);
    }
  });

  // Sort subgraphs by node count descending
  subgraphs.sort((a, b) => b.length - a.length);

  const mainSubIds = new Set(subgraphs[0] || []);
  const partialSubtrees: any[][] = [];
  const floatingPool: any[] = [];

  subgraphs.slice(1).forEach(comp => {
    if (comp.length > 1) {
      partialSubtrees.push(nodes.filter(n => comp.includes(n.person_id)));
    } else if (comp.length === 1) {
      floatingPool.push(nodes.find(n => n.person_id === comp[0]));
    }
  });

  const mainNodes = nodes.filter(n => mainSubIds.has(n.person_id));
  const mainEdges = edges.filter(e => mainSubIds.has(e.source) && mainSubIds.has(e.target));

  return {
    mainNodes,
    mainEdges,
    partialSubtrees,
    floatingPool
  };
}

function Canvas({
  treeId,
  token,
  user,
  router
}: {
  treeId: string;
  token: string;
  user: any;
  router: any;
}) {
  const { theme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  // Custom interactive states
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [pendingSortOrders, setPendingSortOrders] = useState<Record<string, number>>({});
  const [isSavingSortOrders, setIsSavingSortOrders] = useState(false);
  const [isAddingFloating, setIsAddingFloating] = useState(false);
  
  // RAW Database state
  const [dbPeople, setDbPeople] = useState<any[]>([]);
  const [dbRelations, setDbRelations] = useState<any[]>([]);
  const [treeInfo, setTreeInfo] = useState<any>(null);
  
  // UI Loading controls
  const [canvasLoading, setCanvasLoading] = useState(true);
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const [targetSearchQuery, setTargetSearchQuery] = useState("");
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);

  // Subgraphs partitions split states
  const [activeComponentIndex, setActiveComponentIndex] = useState<number | "main">("main");
  const [subgraphData, setSubgraphData] = useState<{
    partialSubtrees: any[][];
    floatingPool: any[];
  }>({ partialSubtrees: [], floatingPool: [] });

  // Floating lightbox popups
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; name: string } | null>(null);

  // Sidebar detail drawer targets
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [drawerTab, setDrawerTab] = useState<"profile" | "edit" | "relations">("profile");

  // Computed connection collections for details drawer Tab 3
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

  // Dynamic custom attributes
  const [customKey, setCustomKey] = useState("");
  const [customVal, setCustomVal] = useState("");

  // Relation builder setups
  const [relActionType, setRelActionType] = useState<"parent" | "spouse" | "child" | null>(null);
  const [newTargetSortOrder, setNewTargetSortOrder] = useState<number>(1);
  
  // Deletion confirm modal states
  const [deleteConfirmPerson, setDeleteConfirmPerson] = useState<any | null>(null);
  const [deleteConfirmRelationId, setDeleteConfirmRelationId] = useState<string | null>(null);
  // Responsive sidebar collapse controls
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [relLinkMode, setRelLinkMode] = useState<"existing" | "new">("existing");
  const [existingTargetId, setExistingTargetId] = useState<string>("");
  const [newTargetName, setNewTargetName] = useState("");
  const [newTargetGender, setNewTargetGender] = useState("male");
  const [newTargetRelSubtype, setNewTargetRelSubtype] = useState("biological");
  const [relationSubmitting, setRelationSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  // Editing forms state
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editBirth, setEditBirth] = useState("");
  const [editDeath, setEditDeath] = useState("");
  const [editAlive, setEditAlive] = useState(true);
  const [editNative, setEditNative] = useState("");
  const [editCurrent, setEditCurrent] = useState("");
  const [editJob, setEditJob] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Cycle loader quotes during wait
  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % FAMILY_QUOTES.length);
    }, 4500);
    return () => clearInterval(quoteInterval);
  }, []);

  // Fetch complete tree context
  const loadTreeContext = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/trees/${treeId}/data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTreeInfo(data.tree);
        setDbPeople(data.people);
        setDbRelations(data.relationships);
      } else {
        setToast({ message: "Failed to load family tree data.", type: "error" });
        setTimeout(() => setToast(null), 4000);
        router.push("/dashboard");
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to connect to the server.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setCanvasLoading(false);
    }
  }, [treeId, token, router]);

  useEffect(() => {
    if (token && treeId) {
      loadTreeContext();
    }
  }, [token, treeId, loadTreeContext]);

  // Click handlers inside nodes
  const handleAvatarLightbox = useCallback((e: React.MouseEvent, url: string, name: string) => {
    e.stopPropagation();
    setLightboxPhoto({ url, name });
  }, []);

  const handleNodeInspect = useCallback((nodeData: any) => {
    // nodeData.id contains the person_id UUID
    const rawPerson = dbPeople.find(p => p.person_id === nodeData.id);
    if (!rawPerson) return;
    
    setSelectedPerson(rawPerson);
    setDrawerTab("profile");
    
    // Set edit variables
    setEditName(rawPerson.name);
    setEditGender(rawPerson.gender);
    setEditBirth(rawPerson.birth_date || "");
    setEditDeath(rawPerson.death_date || "");
    setEditAlive(rawPerson.is_alive);
    setEditNative(rawPerson.native_place || "");
    setEditCurrent(rawPerson.current_place || "");
    setEditJob(rawPerson.occupation || "");
    setEditPhotoUrl(rawPerson.photo_url || "");
    setRelActionType(null);
  }, [dbPeople]);

  // Re-calculate Graph components partition and layout
  const processCanvasGraph = useCallback(() => {
    if (dbPeople.length === 0) {
      setNodes([]);
      setEdges([]);
      setSubgraphData({ partialSubtrees: [], floatingPool: [] });
      return;
    }

    // Convert API DB relationships into React Flow edges
    const rawEdges: Edge[] = dbRelations.map((rel) => {
      const isSpouse = rel.relation_type === "spouse";
      return {
        id: `e-${rel.relationship_id}`,
        source: rel.person_id,
        target: rel.related_person_id,
        sourceHandle: isSpouse ? "right" : "bottom",
        targetHandle: isSpouse ? "left" : "top",
        type: "custom",
        data: {
          id: rel.relationship_id,
          relation_type: rel.relation_type,
          relation_subtype: rel.relation_subtype,
          sort_order: pendingSortOrders[rel.relationship_id] ?? rel.sort_order ?? 1,
          showLabel: showEdgeLabels, // Pass global edge labels view state
          onDeleteRelation: (relId: string) => {
            setDeleteConfirmRelationId(relId);
          }
        }
      };
    });

    // Run BFS splits
    const { mainNodes, mainEdges, partialSubtrees, floatingPool } = partitionGraph(dbPeople, rawEdges);
    setSubgraphData({ partialSubtrees, floatingPool });

    // Choose which component to show on canvas
    let nodesToDisplay = mainNodes;
    let edgesToDisplay = mainEdges;

    if (activeComponentIndex !== "main") {
      const idx = activeComponentIndex;
      if (partialSubtrees[idx]) {
        nodesToDisplay = partialSubtrees[idx];
        const subIds = new Set(nodesToDisplay.map(n => n.person_id));
        edgesToDisplay = rawEdges.filter(e => subIds.has(e.source) && subIds.has(e.target));
      }
    }

    // Sort nodes to establish sibling and spouse sequence orders
    const sortedNodesToDisplay = [...nodesToDisplay].sort((a, b) => {
      // 1. Sibling sort order check (parent-child relationship)
      const aParentRel = dbRelations.find(r => r.relation_type === "parent" && r.related_person_id === a.person_id);
      const bParentRel = dbRelations.find(r => r.relation_type === "parent" && r.related_person_id === b.person_id);
      if (aParentRel && bParentRel && aParentRel.person_id === bParentRel.person_id) {
        // They share the same parent node: resolve sort order (with pending state fallback, then DB, then birth date)
        const aOrder = pendingSortOrders[aParentRel.relationship_id] ?? aParentRel.sort_order ?? 1;
        const bOrder = pendingSortOrders[bParentRel.relationship_id] ?? bParentRel.sort_order ?? 1;
        if (aOrder !== bOrder) return aOrder - bOrder;
      }
      
      // 2. Spouse sort order check (multiple marriages of same spouse)
      const aSpouseRel = dbRelations.find(r => r.relation_type === "spouse" && (r.person_id === a.person_id || r.related_person_id === a.person_id));
      const bSpouseRel = dbRelations.find(r => r.relation_type === "spouse" && (r.person_id === b.person_id || r.related_person_id === b.person_id));
      if (aSpouseRel && bSpouseRel) {
        const aPartner = aSpouseRel.person_id === a.person_id ? aSpouseRel.related_person_id : aSpouseRel.person_id;
        const bPartner = bSpouseRel.person_id === b.person_id ? bSpouseRel.related_person_id : bSpouseRel.person_id;
        if (aPartner === bPartner) {
          const aOrder = pendingSortOrders[aSpouseRel.relationship_id] ?? aSpouseRel.sort_order ?? 1;
          const bOrder = pendingSortOrders[bSpouseRel.relationship_id] ?? bSpouseRel.sort_order ?? 1;
          if (aOrder !== bOrder) return aOrder - bOrder;
        }
      }
      
      // 3. Fallback: birth date
      const aBirth = a.birth_date ? new Date(a.birth_date).getTime() : Infinity;
      const bBirth = b.birth_date ? new Date(b.birth_date).getTime() : Infinity;
      if (aBirth !== bBirth) return aBirth - bBirth;
      
      return a.name.localeCompare(b.name);
    });

    // Wrap nodes for React Flow custom cards
    const mappedNodes: Node[] = sortedNodesToDisplay.map((p) => {
      return {
        id: p.person_id,
        type: "person",
        position: { x: 0, y: 0 },
        data: {
          ...p,
          id: p.person_id,
          onAvatarClick: handleAvatarLightbox,
          onNodeClick: handleNodeInspect
        }
      };
    });

    // Run Dagre Layout
    const layout = getLayoutedElements(mappedNodes, edgesToDisplay);
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [
    dbPeople,
    dbRelations,
    activeComponentIndex,
    handleAvatarLightbox,
    handleNodeInspect,
    token,
    loadTreeContext,
    setNodes,
    setEdges,
    showEdgeLabels,
    pendingSortOrders
  ]);

  useEffect(() => {
    processCanvasGraph();
  }, [dbPeople, dbRelations, activeComponentIndex, processCanvasGraph]);

  // Create isolated floating person
  const handleAddFloatingPerson = async () => {
    if (isAddingFloating) return;
    setIsAddingFloating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/people`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tree_id: treeId,
          name: "New Person Node",
          gender: "Male"
        })
      });
      if (res.ok) {
        const np = await res.json();
        await loadTreeContext();
        handleNodeInspect({ id: np.person_id });
        setToast({ message: "New floating person added.", type: "success" });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({ message: errData.detail || "Failed to add new person.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (e) {
      console.error(e);
      setToast({ message: "Failed to add new person.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsAddingFloating(false);
    }
  };

  // Profile edit submit handler
  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson || !token) return;
    
    setEditSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/people/${selectedPerson.person_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName,
          gender: editGender,
          birth_date: editBirth || null,
          death_date: editAlive ? null : (editDeath || null),
          is_alive: editAlive,
          native_place: editNative || null,
          current_place: editCurrent || null,
          occupation: editJob || null,
          photo_url: editPhotoUrl || null
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedPerson(updated);
        await loadTreeContext();
        setDrawerTab("profile");
        setToast({ message: "Profile updated successfully.", type: "success" });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({ message: errData.detail || "Failed to update profile.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to update profile.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteRelation = (relId: string) => {
    setDeleteConfirmRelationId(relId);
  };

  const handleDeleteRelationConfirm = async () => {
    if (!deleteConfirmRelationId) return;
    const relId = deleteConfirmRelationId;
    setDeleteConfirmRelationId(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/relationships/${relId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        // Clear any pending sort order for this relation if it exists
        setPendingSortOrders(prev => {
          const copy = { ...prev };
          delete copy[relId];
          return copy;
        });
        await loadTreeContext();
        setToast({ message: "Relationship connection deleted successfully.", type: "success" });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({ message: errData.detail || "Failed to delete relationship connection.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (e) {
      console.error(e);
      setToast({ message: "Failed to delete relationship connection.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleSaveSortOrders = async () => {
    if (Object.keys(pendingSortOrders).length === 0) return;
    setIsSavingSortOrders(true);
    try {
      const updatesList = Object.entries(pendingSortOrders).map(([id, val]) => ({
        relationship_id: id,
        sort_order: val
      }));
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/relationships/batch`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ updates: updatesList })
      });
      
      if (res.ok) {
        setPendingSortOrders({});
        await loadTreeContext();
        setToast({ message: "Relationship ordering saved successfully.", type: "success" });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({ message: errData.detail || "Failed to save relationship ordering.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (e) {
      console.error(e);
      setToast({ message: "Failed to save relationship ordering.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsSavingSortOrders(false);
    }
  };

  // Delete individual member node
  const handleDeleteMember = () => {
    if (!selectedPerson) return;
    setDeleteConfirmPerson(selectedPerson);
  };

  const handleDeleteMemberConfirm = async () => {
    if (!deleteConfirmPerson || !token) return;
    const pId = deleteConfirmPerson.person_id;
    setDeleteConfirmPerson(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/people/${pId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedPerson(null);
        await loadTreeContext();
        setToast({ message: "Member deleted successfully.", type: "success" });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({ message: errData.detail || "Failed to delete member.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to delete member.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    }
  };

  // Direct Cloudinary / local fallback photo uploader
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log("handlePhotoUpload - File picked:", file);
    console.log("handlePhotoUpload - Token value:", token);
    if (!file) {
      console.log("handlePhotoUpload - Aborting because no file was selected.");
      return;
    }
    if (!token) {
      console.log("handlePhotoUpload - Aborting because token is falsy.");
      return;
    }
    console.log("handlePhotoUpload - Proceeding to upload to", `${process.env.NEXT_PUBLIC_API_URL}/api/v1/media/upload`);

    const formData = new FormData();
    formData.append("file", file);

    setPhotoUploading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/media/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setEditPhotoUrl(data.url);
        setToast({ message: "Avatar uploaded successfully.", type: "success" });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({ message: errData.detail || "Image upload failed.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Image upload failed.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  // Custom Fields Attribute Actions
  const handleAddCustomAttribute = async () => {
    if (!customKey.trim() || !customVal.trim() || !selectedPerson) return;
    
    let currentFields = {};
    try {
      currentFields = JSON.parse(selectedPerson.custom_fields || "{}");
    } catch {
      currentFields = {};
    }

    const updatedFields = {
      ...currentFields,
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
        // Reload list to keep memory in sync
        setDbPeople(prev => prev.map(p => p.person_id === updated.person_id ? updated : p));
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
    
    let currentFields = {};
    try {
      currentFields = JSON.parse(selectedPerson.custom_fields || "{}");
    } catch {
      currentFields = {};
    }

    const { [keyToDelete]: _, ...updatedFields } = currentFields as any;

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
        setDbPeople(prev => prev.map(p => p.person_id === updated.person_id ? updated : p));
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

  // Relationship Connector write submit
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
      // In Relationship schema: person_id = source (Parent / Spouse A), related_person_id = target (Child / Spouse B)
      let sourceId = selectedPerson.person_id;
      let targetPersonId = targetId;
      let rType = "parent";

      if (relActionType === "parent") {
        // Selected person is the child, target is the parent
        sourceId = targetId;
        targetPersonId = selectedPerson.person_id;
        rType = "parent";
      } else if (relActionType === "child") {
        // Selected person is the parent, target is the child
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
        // Update selected person reference to stay fresh
        const fresh = dbPeople.find(p => p.person_id === selectedPerson.person_id);
        if (fresh) setSelectedPerson(fresh);
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

  // Screenshot capture using html-to-image downloader
  const handleExportCanvasImage = () => {
    const rfViewport = document.querySelector(".react-flow__viewport") as HTMLElement;
    if (!rfViewport) return;

    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm";
    overlay.innerHTML = '<div class="bg-card p-4 rounded-xl flex items-center gap-3 border shadow-lg text-sm font-semibold"><div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>Capturing canvas snapshot...</div>';
    document.body.appendChild(overlay);

    toPng(rfViewport, {
      backgroundColor: theme === "dark" ? "#070a13" : "#f8fafc",
      width: rfViewport.offsetWidth * 1.5,
      height: rfViewport.offsetHeight * 1.5,
      style: {
        transform: "scale(1.5)",
        transformOrigin: "top left",
      }
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `${treeInfo?.name || "family-tree"}-linage.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error("Snapshot capture error:", err);
      })
      .finally(() => {
        document.body.removeChild(overlay);
      });
  };

  // Filtered unconnected/member list for search input
  const filteredSearchPeople = useMemo(() => {
    if (!searchQuery.trim()) return dbPeople;
    const q = searchQuery.toLowerCase();
    return dbPeople.filter(p => p.name.toLowerCase().includes(q));
  }, [dbPeople, searchQuery]);

  // Options list for relation drop-downs (excludes current person)
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

  const selectedPersonCustomFields = useMemo(() => {
    if (!selectedPerson) return {};
    try {
      return JSON.parse(selectedPerson.custom_fields || "{}");
    } catch {
      return {};
    }
  }, [selectedPerson]);

  if (canvasLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background/95 backdrop-blur-md p-6">
        <div className="max-w-md text-center space-y-8 animate-in fade-in zoom-in duration-300">
          <div className="flex justify-center">
            <div className="relative flex items-center justify-center">
              <Network className="h-16 w-16 text-primary animate-pulse" />
              <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-violet-500 animate-bounce" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight">Accessing Tree Databases</h2>
            <p className="text-xs text-muted-foreground">If database is sleeping on a cold tier, initial startup API response may require 10–20 seconds. Please hold tight...</p>
          </div>

          <div className="relative h-1 w-48 bg-muted rounded-full overflow-hidden mx-auto">
            <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-primary rounded-full animate-infinite-slide" />
          </div>

          <div className="p-4 bg-muted/40 border border-border/80 rounded-xl max-w-sm mx-auto shadow-sm">
            <p className="text-xs italic text-muted-foreground/90 transition-all duration-300">
              {FAMILY_QUOTES[quoteIndex]}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden font-sans relative">
      {/* 1. SIDEBAR MANAGEMENT SYSTEM */}
      <aside className={`${isSidebarOpen ? "flex" : "hidden"} w-full sm:w-80 border-b sm:border-b-0 sm:border-r border-border bg-card flex flex-col shrink-0 select-none absolute sm:relative inset-y-0 left-0 z-30 sm:z-10`}>
        <div className="p-4 border-b border-border space-y-3.5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-1 px-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 text-xs"
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

        {/* Component partitioning selections */}
        <div className="p-3 bg-muted/20 border-b border-border space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest px-1">
            <span>Branches</span>
            <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded border border-border">
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

        {/* Floating Pool Cards Deck */}
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
      </aside>

      {/* 2. MAIN GRAPH INTERACTIVE VIEWPORT */}
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
              <Panel position="top-right" className="flex items-center gap-3 bg-card border border-border p-1 px-2 rounded-md shadow-sm select-none">
                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground transition py-0.5 px-1 rounded">
                  <input
                    type="checkbox"
                    checked={showEdgeLabels}
                    onChange={(e) => setShowEdgeLabels(e.target.checked)}
                    className="accent-primary h-3 w-3 rounded border-border cursor-pointer"
                  />
                  <span>Show Labels</span>
                </label>
                <div className="h-3.5 w-[1px] bg-border/60" />
                <button
                  onClick={handleExportCanvasImage}
                  title="Export High-Res Canvas Snapshot"
                  className="p-1 px-2.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5 text-primary" />
                  <span>export.png</span>
                </button>
              </Panel>

              {/* Floating Legend Key */}
              <Panel position="bottom-left" className={`bg-card/95 backdrop-blur-xs border border-border p-2 rounded-lg shadow-md select-none transition-all duration-200 ${isLegendOpen ? "w-[260px] max-w-[280px]" : "w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-muted"}`} onClick={() => { if (!isLegendOpen) setIsLegendOpen(true); }}>
                {!isLegendOpen ? (
                  <button
                    type="button"
                    title="Expand Relationship Legend"
                    className="p-1 text-muted-foreground hover:text-foreground transition flex items-center justify-center"
                  >
                    <Info className="h-4 w-4 text-primary" />
                  </button>
                ) : (
                  <div className="space-y-2 text-[10px]">
                    <div className="flex items-center justify-between gap-4 font-bold uppercase tracking-wider text-muted-foreground text-[9px] border-b pb-1">
                      <span>Relationship Legend</span>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsLegendOpen(false);
                        }}
                        title="Collapse Legend"
                        className="hover:text-foreground text-muted-foreground transition p-0.5"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-foreground/80 font-medium animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        <div className="h-[3px] w-6 bg-[#e11d48] shrink-0" />
                        <span>Spouse (Married)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-[2px] w-6 bg-[#94a3b8] shrink-0" />
                        <span>Child (Biological)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-[2px] w-6 bg-[#f43f5e] border-t border-dashed shrink-0" style={{ borderTop: "2px dashed #f43f5e" }} />
                        <span>Spouse (Divorced)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-[2px] w-6 bg-[#6366f1] border-t border-dashed shrink-0" style={{ borderTop: "2px dashed #6366f1" }} />
                        <span>Child (Adopted)</span>
                      </div>
                      <div className="flex items-center gap-2 flex-nowrap">
                        <div className="h-[20px] flex items-center justify-center shrink-0 w-6 font-semibold">
                          <div className="h-0 w-full border-t-2 border-dotted border-[#a855f7]" style={{ borderTop: "2px dotted #a855f7" }} />
                        </div>
                        <span>Child (Step)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-[4px] w-6 bg-[#3b82f6] shrink-0" />
                        <span>Selected / Active</span>
                      </div>
                    </div>
                  </div>
                )}
              </Panel>
            </ReactFlow>
          </div>
        )}
      </main>

      {/* 3. DETAIL DRAWER SIDE PANEL CONTROL SHEET */}
      {selectedPerson && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs flex justify-end">
          {/* Close click triggers backdrop dismissal */}
          <div className="flex-1" onClick={() => setSelectedPerson(null)} />
          
          <div className="w-full max-w-md bg-card border-l border-border h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header info */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold tracking-tight text-foreground uppercase tracking-wider">Properties</h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">View and edit this family member's profile</p>
              </div>
              <button
                onClick={() => setSelectedPerson(null)}
                className="p-1 px-2.5 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition text-[11px]"
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
                    
                    {Object.keys(selectedPersonCustomFields).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No custom fields created.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {Object.entries(selectedPersonCustomFields).map(([key, val]) => (
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
                      onClick={handleDeleteMember}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive/10 transition text-sm font-semibold"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Member Profile
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: UPDATE FORM */}
              {drawerTab === "edit" && (
                <form onSubmit={handleEditProfile} className="space-y-4">
                  {/* Photo Uploader */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                      Avatar Image
                    </label>
                    <div className="flex gap-4 items-center">
                      <div className="h-14 w-14 rounded-lg bg-muted border flex items-center justify-center font-bold overflow-hidden shrink-0">
                        {editPhotoUrl ? (
                          <img src={editPhotoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          "?"
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                          id="avatar-photo-file"
                        />
                        <label
                          htmlFor="avatar-photo-file"
                          className="inline-flex cursor-pointer items-center justify-center px-4 py-2 border rounded-lg hover:bg-muted text-xs font-semibold transition"
                        >
                          {photoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 text-primary" /> : null}
                          Change Photo
                        </label>
                        <p className="text-[10px] text-muted-foreground mt-1">Direct upload to Cloudinary CDN</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Input Member Name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                        Gender
                      </label>
                      <select
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="flex items-center pt-5 gap-2">
                      <input
                        type="checkbox"
                        id="alive-swapper"
                        checked={editAlive}
                        onChange={(e) => setEditAlive(e.target.checked)}
                        className="h-4 w-4 text-primary focus:ring-0 rounded"
                      />
                      <label htmlFor="alive-swapper" className="text-xs font-semibold select-none cursor-pointer">
                        Is Alive?
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                        Birth Date
                      </label>
                      <input
                        type="date"
                        value={editBirth}
                        onChange={(e) => setEditBirth(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>

                    {!editAlive && (
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                          Death Date
                        </label>
                        <input
                          type="date"
                          value={editDeath}
                          onChange={(e) => setEditDeath(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                      Birthplace (Native Origin)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Berlin, Germany"
                      value={editNative}
                      onChange={(e) => setEditNative(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                      Current Residence
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. New York, USA"
                      value={editCurrent}
                      onChange={(e) => setEditCurrent(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                      Occupation
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Software Architect"
                      value={editJob}
                      onChange={(e) => setEditJob(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none"
                    />
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setDrawerTab("profile")}
                      className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-muted transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editSubmitting}
                      className="flex items-center gap-1 py-2 px-4 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground text-sm font-semibold transition"
                    >
                      {editSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Save Updates
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: RELATION LINKS BUILDER */}
              {drawerTab === "relations" && (
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
                                  <span className="text-[9px] text-muted-foreground/80 capitalize bg-background px-1.5 py-0.5 rounded border leading-none shrink-0 animate-pulse-once">
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
                                    onClick={() => handleDeleteRelation(rel.relationship_id)}
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
                                onClick={() => handleDeleteRelation(rel.relationship_id)}
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
                                    onClick={() => handleDeleteRelation(rel.relationship_id)}
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
                              className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none"
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

                      <div className="pt-2 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setRelActionType(null)}
                          className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-muted transition"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={relationSubmitting}
                          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground text-sm font-semibold transition"
                        >
                          {relationSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                          Create Relationship
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-16 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded border shadow-2xl text-xs font-semibold animate-in slide-in-from-top-4 duration-200 opacity-100 ${toast.type === "error" ? "bg-red-600 text-white border-red-700" : "bg-zinc-900 text-zinc-100 dark:bg-zinc-950 dark:text-zinc-50 border-zinc-700 dark:border-zinc-800"}`}>
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {toast.message}
        </div>
      )}

      {/* 4. GRAVE GLASSPHORMIC LIGHTBOX VIEWER */}
      {lightboxPhoto && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxPhoto(null)}
        >
          <div 
            className="relative bg-card border border-border/80 p-2.5 rounded-2xl max-w-xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden rounded-xl border border-border max-h-[70vh]">
              <img 
                src={lightboxPhoto.url} 
                alt={lightboxPhoto.name} 
                className="w-full h-full object-contain pointer-events-none select-none max-w-full"
              />
            </div>
            <div className="p-3 text-center">
              <span className="text-sm font-bold text-foreground">{lightboxPhoto.name}</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. MEMBER PROFILE DELETE CONFIRMATION MODAL */}
      <Dialog 
        open={!!deleteConfirmPerson} 
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmPerson(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Family Member?</DialogTitle>
            <DialogDescription>
              {deleteConfirmPerson && (
                (() => {
                  const relCount = dbRelations.filter(r => 
                    r.person_id === deleteConfirmPerson.person_id || 
                    r.related_person_id === deleteConfirmPerson.person_id
                  ).length;

                  if (relCount === 0) {
                    return (
                      <span>
                        Are you sure you want to delete <strong className="text-foreground">{deleteConfirmPerson.name}</strong>? This will permanently remove this person from the family tree.
                      </span>
                    );
                  }
                  
                  return (
                    <span>
                      Are you sure you want to delete <strong className="text-foreground">{deleteConfirmPerson.name}</strong>? This will permanently remove this person from the tree, along with all of their {relCount} relationship connection {relCount > 1 ? "lines" : "line"}. Other family members themselves will not be deleted.
                    </span>
                  );
                })()
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmPerson(null)}
              type="button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMemberConfirm}
              type="button"
            >
              Delete Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. RELATIONSHIP LINK DELETE CONFIRMATION MODAL */}
      <Dialog 
        open={!!deleteConfirmRelationId} 
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmRelationId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Connection Link?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this relationship link line? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmRelationId(null)}
              type="button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRelationConfirm}
              type="button"
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FamilyTreePage() {
  const { id } = useParams() as { id: string };
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading Tree Viewport...</p>
        </div>
      </div>
    );
  }

  // ReactFlowProvider is required for useReactFlow hook in CustomEdge
  return (
    <ReactFlowProvider>
      <Canvas treeId={id} token={token!} user={user} router={router} />
    </ReactFlowProvider>
  );
}
