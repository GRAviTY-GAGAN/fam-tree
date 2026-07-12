"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { 
  Network, Plus, Trash2, Calendar, FolderHeart, 
  LogOut, Sun, Moon, Laptop, Loader2, ShieldAlert
} from "lucide-react";
import { useTheme } from "next-themes";

interface Tree {
  id: number;
  tree_id: string;
  name: string;
  description: string | null;
  owner_id: number;
}

export default function Dashboard() {
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [trees, setTrees] = useState<Tree[]>([]);
  const [treesLoading, setTreesLoading] = useState(true);
  
  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  
  // Modals / forms state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTreeName, setNewTreeName] = useState("");
  const [newTreeDesc, setNewTreeDesc] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Deletion guard state
  const [treeToDelete, setTreeToDelete] = useState<Tree | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Redirect check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Fetch trees list
  const fetchTrees = async () => {
    if (!token) return;
    setTreesLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/trees`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTrees(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({ message: errData.detail || "Failed to fetch trees list.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      console.error("Error fetching trees:", err);
      setToast({ message: "Failed to connect to the server.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setTreesLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTrees();
    }
  }, [token]);

  // Create tree submit
  const handleCreateTree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTreeName.trim() || !token) return;

    setCreateSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/trees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newTreeName,
          description: newTreeDesc || null,
        }),
      });

      if (res.ok) {
        setNewTreeName("");
        setNewTreeDesc("");
        setIsCreateOpen(false);
        await fetchTrees();
        setToast({ message: "Family tree created successfully.", type: "success" });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({ message: errData.detail || "Failed to create family tree.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      console.error("Error creating tree:", err);
      setToast({ message: "Failed to create family tree.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Delete tree check
  const handleDeleteTree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treeToDelete || !token) return;

    if (deleteConfirmText !== treeToDelete.name) {
      setToast({ message: "Name confirmation mismatch.", type: "error" });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setDeleteSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/trees/${treeToDelete.tree_id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setTreeToDelete(null);
        setDeleteConfirmText("");
        await fetchTrees();
        setToast({ message: "Family tree deleted successfully.", type: "success" });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setToast({ message: errData.detail || "Failed to delete tree.", type: "error" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      console.error("Error deleting tree:", err);
      setToast({ message: "Failed to delete tree.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border border-border border-t-foreground animate-spin rounded-full" />
          <p className="text-xs text-muted-foreground">redirecting_session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none">
      {/* Dashboard Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs tracking-wider font-bold cursor-pointer" onClick={() => router.push("/dashboard")}>
            <Network className="h-4 w-4 text-foreground" />
            <span>FamilyFlow</span>
          </div>

          <div className="flex items-center gap-4">
            {/* User Profile */}
            <div className="flex items-center gap-2.5">
              {user.picture_url ? (
                <img 
                  src={user.picture_url} 
                  alt={user.name} 
                  className="h-6 w-6 rounded border border-border"
                />
              ) : (
                <div className="h-6 w-6 rounded bg-muted border flex items-center justify-center font-bold text-[10px] text-muted-foreground">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="hidden sm:inline text-xs text-muted-foreground">{user.name.toLowerCase()}</span>
            </div>

            {/* Theme switcher */}
            <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded border border-border">
              <button
                onClick={() => setTheme("light")}
                className={`p-1 rounded transition ${theme === "light" ? "bg-card text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Sun className="h-3 w-3" />
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`p-1 rounded transition ${theme === "dark" ? "bg-card text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Moon className="h-3 w-3" />
              </button>
            </div>

            {/* Logout button */}
            <button
              onClick={logout}
              className="flex items-center gap-1 p-1 px-2.5 rounded border border-border hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition"
            >
              <LogOut className="h-3 w-3" />
              <span className="hidden xs:inline">sign_out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Panel */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-wider text-foreground uppercase">Family Trees</h1>
            <p className="text-muted-foreground text-[11px] sm:text-xs mt-0.5">Manage, build, and explore your family lineage catalogs.</p>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-border bg-card hover:bg-muted text-foreground transition text-xs whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            New Tree
          </button>
        </div>

        {/* Tree Cards */}
        {treesLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">fetching_metadata...</p>
          </div>
        ) : trees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-md bg-card/25 select-none text-center">
            <FolderHeart className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-xs font-bold tracking-wider mb-1">No family trees created yet</h3>
            <p className="text-muted-foreground text-[11px] max-w-xs mb-6">
              Create your very first family relationship tree to get started.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded border border-border bg-card hover:bg-muted transition text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Create First Tree
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {trees.map((tree) => (
              <div 
                key={tree.tree_id} 
                className="group relative flex flex-col justify-between p-5 bg-card border border-border hover:border-foreground/30 rounded-md transition duration-150 cursor-pointer"
                onClick={() => router.push(`/tree/${tree.tree_id}`)}
              >
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide group-hover:text-foreground transition duration-150 truncate">
                    {tree.name}
                  </h3>
                  <p className="text-muted-foreground text-[11px] mt-2 line-clamp-2 leading-relaxed">
                    {tree.description || "No project description provided."}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-border/80 flex items-center justify-between text-[10px] text-muted-foreground/60 select-none">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    tree_id:&nbsp;
                    <span
                      title={tree.tree_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(tree.tree_id);
                      }}
                      className="cursor-copy hover:text-foreground transition font-mono underline underline-offset-2 decoration-dashed"
                    >
                      …{tree.tree_id.slice(-4)}
                    </span>
                  </span>
                  
                  {/* Delete button (Stop event propagation to avoid link click) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTreeToDelete(tree);
                    }}
                    className="p-1 rounded border border-transparent hover:border-border hover:bg-muted text-muted-foreground/60 hover:text-destructive transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CREATE TREE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-md p-5 shadow-lg animate-in fade-in-50 zoom-in-98 duration-100 font-sans">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground mb-1">Create Family Tree</h2>
            <p className="text-[10px] text-muted-foreground mb-4">Start building your family lineage catalog.</p>
            
            <form onSubmit={handleCreateTree} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  tree_name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Smith Dynasty"
                  value={newTreeName}
                  onChange={(e) => setNewTreeName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-border"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  description
                </label>
                <textarea
                  placeholder="Tell a brief story of this tree project..."
                  value={newTreeDesc}
                  onChange={(e) => setNewTreeDesc(e.target.value)}
                  rows={3}
                  className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-border resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setNewTreeName("");
                    setNewTreeDesc("");
                  }}
                  className="px-3 py-1.5 rounded border border-border text-xs hover:bg-muted text-muted-foreground hover:text-foreground transition"
                >
                  cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-card hover:bg-muted text-xs transition disabled:opacity-50"
                >
                  {createSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Create Tree
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DANGEROUS DELETION GUARD MODAL */}
      {treeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-card border border-destructive/20 rounded-md p-5 shadow-lg font-sans">
            <h2 className="text-xs font-bold uppercase tracking-wider text-destructive mb-1">Delete Family Tree</h2>
            
            <div className="bg-destructive/5 border border-destructive/20 rounded p-3 mb-4 text-[10px] text-destructive leading-relaxed font-sans">
              <strong>⚠️ ATTENTION:</strong> This action cannot be undone. The selected family tree, all its members, relationships, and custom metadata will be permanently deleted.
            </div>

            <p className="text-[11px] mb-4 text-muted-foreground">
              To verify deletion, type: <strong className="select-all bg-muted border border-border px-1.5 py-0.5 rounded text-foreground">{treeToDelete.name}</strong>
            </p>

            <form onSubmit={handleDeleteTree} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Type tree name here"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-destructive focus:border-destructive"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTreeToDelete(null);
                    setDeleteConfirmText("");
                  }}
                  className="px-3 py-1.5 rounded border border-border text-xs hover:bg-muted text-muted-foreground hover:text-foreground transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteSubmitting || deleteConfirmText !== treeToDelete.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 text-xs transition disabled:opacity-40"
                >
                  {deleteSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Delete Tree
                </button>
              </div>
            </form>
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
    </div>
  );
}
