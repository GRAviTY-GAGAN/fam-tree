"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { toPng } from "html-to-image";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "next-themes";
import { 
  Plus, Download, Info, Loader2, Sparkles, Network,
  Menu, ShieldAlert, ChevronDown
} from "lucide-react";
import { DetailDrawer } from "@/components/detail-drawer";
import { Sidebar } from "@/components/sidebar";
import { Viewport } from "@/components/viewport";
import { LightboxViewer } from "@/components/lightbox-viewer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";



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

  // Deletion confirm modal states
  const [deleteConfirmPerson, setDeleteConfirmPerson] = useState<any | null>(null);
  const [deleteConfirmRelationId, setDeleteConfirmRelationId] = useState<string | null>(null);
  // Responsive sidebar collapse controls
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

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
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        router={router}
        treeInfo={treeInfo}
        subgraphData={subgraphData}
        activeComponentIndex={activeComponentIndex}
        setActiveComponentIndex={setActiveComponentIndex}
        dbPeople={dbPeople}
        handleAddFloatingPerson={handleAddFloatingPerson}
        isAddingFloating={isAddingFloating}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredSearchPeople={filteredSearchPeople}
        handleNodeInspect={handleNodeInspect}
      />

      {/* 2. MAIN GRAPH INTERACTIVE VIEWPORT */}
      <Viewport
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        handleAddFloatingPerson={handleAddFloatingPerson}
        isAddingFloating={isAddingFloating}
        showEdgeLabels={showEdgeLabels}
        setShowEdgeLabels={setShowEdgeLabels}
        handleExportCanvasImage={handleExportCanvasImage}
      />

      {/* 3. DETAIL DRAWER SIDE PANEL CONTROL SHEET */}
      {selectedPerson && (
        <DetailDrawer
          selectedPerson={selectedPerson}
          setSelectedPerson={setSelectedPerson}
          dbPeople={dbPeople}
          dbRelations={dbRelations}
          treeId={treeId}
          token={token}
          loadTreeContext={loadTreeContext}
          setToast={setToast}
          onDeleteMember={handleDeleteMember}
          onDeleteRelation={handleDeleteRelation}
          pendingSortOrders={pendingSortOrders}
          setPendingSortOrders={setPendingSortOrders}
          isSavingSortOrders={isSavingSortOrders}
          handleSaveSortOrders={handleSaveSortOrders}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-16 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded border shadow-2xl text-xs font-semibold animate-in slide-in-from-top-4 duration-200 opacity-100 ${toast.type === "error" ? "bg-red-600 text-white border-red-700" : "bg-zinc-900 text-zinc-100 dark:bg-zinc-950 dark:text-zinc-50 border-zinc-700 dark:border-zinc-800"}`}>
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {toast.message}
        </div>
      )}

      {/* 4. GRAVE GLASSPHORMIC LIGHTBOX VIEWER */}
      <LightboxViewer
        lightboxPhoto={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
      />

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
