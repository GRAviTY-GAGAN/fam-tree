"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { Network, Camera, Settings, Sun, Moon, Laptop, ShieldAlert } from "lucide-react";
import { useTheme } from "next-themes";
import Script from "next/script";

export default function Home() {
  const { user, loginWithGoogle, loginBypass, isLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [isLocal, setIsLocal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [backendHealth, setBackendHealth] = useState<{
    status: string;
    google_auth_configured: boolean;
    cloudinary_configured: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsLocal(
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      );
    }
  }, []);

  const [googleInitialized, setGoogleInitialized] = useState(false);

  // If user is authenticated, redirect to /dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  // Fetch backend configurations on startup to see check status
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/healthinfo`);
        if (res.ok) {
          const data = await res.json();
          setBackendHealth(data);
        }
      } catch (err) {
        console.error("Backend health check failed:", err);
      }
    }
    checkHealth();
  }, []);

  // Initialize Google Identity Services Client
  useEffect(() => {
    if (backendHealth?.google_auth_configured && typeof window !== "undefined") {
      const checkGoogle = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(checkGoogle);
          try {
            (window as any).google.accounts.id.initialize({
              client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
              callback: async (res: any) => {
                if (res.credential) {
                  try {
                    await loginWithGoogle(res.credential);
                  } catch (e) {
                    setToast({ message: "Google authentication failed.", type: "error" });
                    setTimeout(() => setToast(null), 4000);
                  }
                }
              }
            });
            setGoogleInitialized(true);
          } catch (e) {
            console.error("Failed to initialize Google Accounts library:", e);
          }
        }
      }, 300);
      return () => clearInterval(checkGoogle);
    }
  }, [backendHealth, loginWithGoogle]);

  const renderGoogleButton = () => {
    if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
      const btnEl = document.getElementById("google-signin-btn");
      if (btnEl) {
        (window as any).google.accounts.id.renderButton(btnEl, {
          theme: "outline",
          size: "large",
          width: 240,
        });
      }
    }
  };

  useEffect(() => {
    if (googleInitialized) {
      const t = setTimeout(() => {
        renderGoogleButton();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [googleInitialized]);

  if (isLoading || (user && !isLoading)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border border-border border-t-foreground animate-spin rounded-full" />
          <p className="text-xs text-muted-foreground animate-pulse">authorizing_session...</p>
        </div>
      </div>
    );
  }

  // Developer Bypass Login handler
  const handleBypassLogin = async () => {
    try {
      await loginBypass();
    } catch (err) {
      setToast({ message: "Authentication failed. Please verify credentials.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none">
      {/* Linear-like Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs tracking-wider font-bold">
            <Network className="h-4 w-4 text-foreground animate-pulse" />
            <span>FamilyFlow</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme switcher */}
            <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded border border-border">
              <button
                onClick={() => setTheme("light")}
                className={`p-1 rounded transition text-xs ${theme === "light" ? "bg-card border border-border text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                title="Light Mode"
              >
                <Sun className="h-3 w-3" />
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`p-1 rounded transition text-xs ${theme === "dark" ? "bg-card border border-border text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                title="Dark Mode"
              >
                <Moon className="h-3 w-3" />
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`p-1 rounded transition text-xs ${theme === "system" ? "bg-card border border-border text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                title="System Link"
              >
                <Laptop className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-4xl mx-auto w-full">
        <div className="text-center space-y-6">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground max-w-2xl mx-auto leading-tight uppercase animate-in fade-in slide-in-from-top-4 duration-500">
            Interactive Family Relation Catalog
          </h1>

          <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Build, organize, and visualize your family lineages. Trace relation paths, customize biographical traits, and upload photo memories to preserve your heritage.
          </p>

          {/* Authentication Actions */}
          <div className="pt-4 flex flex-col items-center justify-center gap-4">
            {backendHealth?.google_auth_configured ? (
              <div className="relative inline-block">
                {/* Our beautiful custom button */}
                <button className="flex items-center gap-2 px-4 py-2 border border-border rounded bg-card hover:bg-muted text-xs text-foreground font-semibold shadow-xs transition duration-150">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="currentColor"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
                  </svg>
                  Authenticate with Google
                </button>
                {/* Google Native Button Container overlayed on top and made invisible */}
                <div 
                  id="google-signin-btn" 
                  className="absolute inset-0 opacity-[0.01] hover:cursor-pointer overflow-hidden z-10 [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:scale-150"
                />
                <Script
                  src="https://accounts.google.com/gsi/client"
                  strategy="afterInteractive"
                  onLoad={renderGoogleButton}
                />
              </div>
            ) : isLocal ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-amber-500 text-[11px] bg-amber-500/5 border border-amber-500/10 px-3 py-1.5 rounded max-w-sm">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Google Client ID not configured. Running in demonstration mode.</span>
                </div>
                <button
                  onClick={handleBypassLogin}
                  className="flex items-center gap-1.5 px-4 py-2 border border-emerald-800 bg-emerald-950/20 hover:bg-emerald-950/30 text-emerald-400 rounded text-xs transition duration-150"
                >
                  🚀 Proceed to Dashboard
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-destructive text-[11px] bg-destructive/5 border border-destructive/10 px-3 py-1.5 rounded max-w-sm animate-in fade-in-50 duration-200">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Google Authentication is not configured on this server. Please contact administrator.</span>
              </div>
            )}
          </div>
        </div>

        {/* Features lists grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl text-left select-none">
          <div className="flex flex-col p-5 bg-card border border-border rounded-md hover:border-foreground/20 transition duration-150">
            <div className="h-8 w-8 rounded border border-border bg-muted/40 flex items-center justify-center text-foreground mb-3">
              <Network className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-foreground">Dynamic Layouts</h3>
            <p className="text-muted-foreground text-[11px] leading-normal font-sans">
              Organize multi-generational hierarchies cleanly. High-fidelity layouts handle complex spouse nodes and branches dynamically.
            </p>
          </div>

          <div className="flex flex-col p-5 bg-card border border-border rounded-md hover:border-foreground/20 transition duration-150">
            <div className="h-8 w-8 rounded border border-border bg-muted/40 flex items-center justify-center text-foreground mb-3">
              <Camera className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-foreground">Media Hosting</h3>
            <p className="text-muted-foreground text-[11px] leading-normal font-sans">
              Secure Cloud storage for family photographs. Access high-fidelity uploads across all screens smoothly.
            </p>
          </div>

          <div className="flex flex-col p-5 bg-card border border-border rounded-md hover:border-foreground/20 transition duration-150">
            <div className="h-8 w-8 rounded border border-border bg-muted/40 flex items-center justify-center text-foreground mb-3">
              <Settings className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-foreground">Custom Traits</h3>
            <p className="text-muted-foreground text-[11px] leading-normal font-sans">
              Inject custom attributes dynamically. Keep track of career steps, hobbies, and historical records on any profile node.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/20 py-4 text-center text-[10px] text-muted-foreground/60">
        © 2026 FamilyFlow Workspace.
      </footer>

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

