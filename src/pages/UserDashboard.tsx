import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot, Plus, Server, Activity, Clock, Power, PowerOff,
  Upload, Mail, Image, AlertCircle, LogOut,
  Key, Terminal, RefreshCw, Loader2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Deployment = Tables<"deployments">;

export default function UserDashboard() {
  const { user, profile, signOut, refreshProfile, isAdmin } = useAuth();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [showDeploy, setShowDeploy] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [showHerokuKey, setShowHerokuKey] = useState(false);
  const [botName, setBotName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [paymentEmail, setPaymentEmail] = useState(profile?.email || "");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [herokuKey, setHerokuKey] = useState("");
  const [herokuType, setHerokuType] = useState("personal");
  const [loading, setLoading] = useState(false);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const freeUsed = (profile?.free_deploys_used ?? 0) >= 1;

  const fetchDeployments = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("deployments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setDeployments(data);
  }, [user]);

  // Initial fetch + Realtime subscription
  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("user-deployments")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deployments",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setDeployments((prev) => [payload.new as Deployment, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setDeployments((prev) =>
              prev.map((d) =>
                d.id === (payload.new as Deployment).id
                  ? (payload.new as Deployment)
                  : d
              )
            );
          } else if (payload.eventType === "DELETE") {
            setDeployments((prev) =>
              prev.filter((d) => d.id !== (payload.old as any).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (freeUsed && (profile?.balance ?? 0) <= 0) {
      setShowPayment(true);
      setShowDeploy(false);
      toast.error("Insufficient balance. Please submit a payment first.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("deployments")
      .insert({
        user_id: user.id,
        name: botName,
        session_id: sessionId,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to deploy: " + error.message);
      setLoading(false);
      return;
    }

    // Increment free_deploys_used if this is the free one
    if (!freeUsed) {
      await supabase
        .from("profiles")
        .update({ free_deploys_used: (profile?.free_deploys_used ?? 0) + 1 })
        .eq("user_id", user.id);
    }

    toast.success("Bot deployment started!");
    setBotName("");
    setSessionId("");
    setShowDeploy(false);
    refreshProfile();

    // Call deploy edge function
    if (data) {
      setDeployingId(data.id);
      const { data: session } = await supabase.auth.getSession();
      supabase.functions.invoke("deploy-bot", {
        body: { deployment_id: data.id },
      }).then(() => {
        setDeployingId(null);
      }).catch(() => {
        setDeployingId(null);
      });
    }
    setLoading(false);
  };

  const handleBotAction = async (deploymentId: string, action: "start" | "stop" | "restart") => {
    setActionLoading(deploymentId);
    try {
      const { error } = await supabase.functions.invoke("heroku-action", {
        body: { deployment_id: deploymentId, action },
      });
      if (error) toast.error("Action failed: " + error.message);
      else toast.success(`Bot ${action} successful`);
    } catch (err: any) {
      toast.error("Action failed");
    }
    setActionLoading(null);
  };

  const handleFetchLogs = async (deploymentId: string) => {
    setShowLogs(deploymentId);
    try {
      await supabase.functions.invoke("heroku-logs", {
        body: { deployment_id: deploymentId },
      });
    } catch {
      // Logs will be updated via realtime
    }
  };

  // Auto-refresh logs every 5 seconds when modal is open
  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showLogs) return;
    const interval = setInterval(() => {
      supabase.functions.invoke("heroku-logs", {
        body: { deployment_id: showLogs },
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [showLogs]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showLogs, deployments]);

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    let screenshotUrl = "";
    if (screenshotFile) {
      const filePath = `${user.id}/${Date.now()}_${screenshotFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-screenshots")
        .upload(filePath, screenshotFile);
      if (uploadError) {
        toast.error("Failed to upload screenshot: " + uploadError.message);
        setLoading(false);
        return;
      }
      screenshotUrl = filePath;
    }

    const { error } = await supabase.from("payments").insert({
      user_id: user.id,
      email: paymentEmail,
      amount: Number(paymentAmount) || 0,
      screenshot_url: screenshotUrl,
    });

    if (error) {
      toast.error("Failed to submit payment: " + error.message);
    } else {
      toast.success("Payment proof submitted! Wait for admin approval.");
      setShowPayment(false);
      setPaymentEmail(profile?.email || "");
      setPaymentAmount("");
      setScreenshotFile(null);
    }
    setLoading(false);
  };

  const handleSaveHerokuKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("heroku_keys").insert({
      user_id: user.id,
      api_key: herokuKey,
      team_or_personal: herokuType,
      is_global: false,
    });
    if (error) {
      toast.error("Failed to save key: " + error.message);
    } else {
      toast.success("Heroku API key saved!");
      setShowHerokuKey(false);
      setHerokuKey("");
    }
    setLoading(false);
  };

  const statusColor = (s: string) => {
    if (s === "running") return "text-green-500";
    if (s === "deploying") return "text-blue-500";
    if (s === "stopped" || s === "failed") return "text-destructive";
    return "text-yellow-500";
  };

  const statusBg = (s: string) => {
    if (s === "running") return "bg-green-500/10 text-green-500";
    if (s === "deploying") return "bg-blue-500/10 text-blue-500";
    if (s === "stopped") return "bg-muted text-muted-foreground";
    if (s === "failed") return "bg-destructive/10 text-destructive";
    return "bg-yellow-500/10 text-yellow-500";
  };

  const getUptime = (d: Deployment) => {
    if (!d.uptime_start || d.status !== "running") return "—";
    const ms = Date.now() - new Date(d.uptime_start).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold">BOTHOST</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{profile?.email}</span>
            {isAdmin && (
              <Link to="/admin">
                <Button variant="outline" size="sm" className="text-xs">Admin</Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Bots", value: deployments.length, icon: Server },
            { label: "Running", value: deployments.filter(d => d.status === "running").length, icon: Activity },
            { label: "Free Deploys Left", value: freeUsed ? 0 : 1, icon: Clock },
            { label: "Balance", value: `KES ${profile?.balance ?? 0}`, icon: AlertCircle },
          ].map(s => (
            <div key={s.label} className="surface rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                <s.icon className="w-3.5 h-3.5" /> {s.label}
              </div>
              <p className="text-xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <h2 className="text-xl font-bold">My Deployments</h2>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowHerokuKey(true)}>
              <Key className="w-4 h-4 mr-1" /> Heroku Key
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowPayment(true)}>
              <Upload className="w-4 h-4 mr-1" /> Submit Payment
            </Button>
            <Button variant="hero" size="sm" onClick={() => setShowDeploy(true)}>
              <Plus className="w-4 h-4 mr-1" /> Deploy Bot
            </Button>
          </div>
        </div>

        {/* Deploy Modal */}
        {showDeploy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="surface rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Deploy New Bot</h3>
              <form onSubmit={handleDeploy} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bot Name</label>
                  <Input placeholder="My WhatsApp Bot" className="bg-secondary" value={botName} onChange={e => setBotName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Base64 Session ID</label>
                  <Textarea placeholder="Paste your base64 session ID here..." className="bg-secondary font-mono text-xs min-h-[100px]" value={sessionId} onChange={e => setSessionId(e.target.value)} required />
                </div>
                {freeUsed && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
                    <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>You've used your free deployment. Balance: KES {profile?.balance ?? 0}</span>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setShowDeploy(false)}>Cancel</Button>
                  <Button type="submit" variant="hero" disabled={loading}>
                    {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Deploying...</> : "Deploy"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="surface rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-2">Submit Payment Proof</h3>
              <p className="text-muted-foreground text-sm mb-4">Send money first, then upload your confirmation screenshot.</p>
              <div className="space-y-2 mb-4 p-3 rounded-lg bg-secondary/50 text-sm">
                <p><span className="text-muted-foreground">Safaricom:</span> <span className="font-mono font-bold text-primary">0116284050</span></p>
                <p><span className="text-muted-foreground">Airtel:</span> <span className="font-mono font-bold text-primary">0105521300</span></p>
                <p><span className="text-muted-foreground">Name:</span> <span className="font-semibold">AKIDA RAJAB</span></p>
              </div>
              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Your Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="you@example.com" className="pl-10 bg-secondary" value={paymentEmail} onChange={e => setPaymentEmail(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount (KES)</label>
                  <Input type="number" placeholder="300" className="bg-secondary" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required min="1" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Screenshot</label>
                  <label className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors block">
                    <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{screenshotFile ? screenshotFile.name : "Click to upload screenshot"}</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
                    <input type="file" accept="image/*" className="hidden" onChange={e => setScreenshotFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setShowPayment(false)}>Cancel</Button>
                  <Button type="submit" variant="hero" disabled={loading}>{loading ? "Submitting..." : "Submit for Approval"}</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Heroku Key Modal */}
        {showHerokuKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="surface rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-2">Add Heroku API Key</h3>
              <p className="text-muted-foreground text-sm mb-4">Provide your own Heroku API key. We'll auto-detect if it's team or personal.</p>
              <form onSubmit={handleSaveHerokuKey} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input placeholder="HRKU-xxxxx or xxxxxxxx-xxxx..." className="bg-secondary font-mono text-xs" value={herokuKey} onChange={e => setHerokuKey(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Key Type</label>
                  <div className="flex gap-3">
                    {["personal", "team"].map(t => (
                      <button key={t} type="button" onClick={() => setHerokuType(t)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${herokuType === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setShowHerokuKey(false)}>Cancel</Button>
                  <Button type="submit" variant="hero" disabled={loading}>{loading ? "Saving..." : "Save Key"}</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Logs Modal */}
        {showLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="surface rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" /> Live Logs
                  <span className="text-xs text-muted-foreground font-normal ml-2 animate-pulse">● Auto-refreshing</span>
                </h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleFetchLogs(showLogs)}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowLogs(null)}>Close</Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto bg-background rounded-lg p-4 font-mono text-xs space-y-1 max-h-[60vh]">
                {deployments.find(d => d.id === showLogs)?.logs?.length ? (
                  deployments.find(d => d.id === showLogs)!.logs!.map((log, i) => (
                    <p key={i} className={`${log.includes("❌") || log.includes("error") ? "text-destructive" : log.includes("✅") ? "text-green-500" : log.includes("⚠️") ? "text-yellow-500" : "text-muted-foreground"}`}>
                      <span className="text-primary">›</span> {log}
                    </p>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Terminal className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p>No logs yet. Logs will appear once the bot starts deploying.</p>
                  </div>
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* Deployments List */}
        <div className="space-y-3">
          {deployments.map(d => (
            <div key={d.id} className="surface rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center relative">
                  <Bot className="w-5 h-5 text-primary" />
                  {d.status === "deploying" && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                  )}
                  {d.status === "running" && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">{d.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                    Session: {d.session_id ? d.session_id.substring(0, 20) : "N/A"}...
                  </p>
                  {d.heroku_app_name && (
                    <p className="text-xs text-muted-foreground">
                      App: {d.heroku_app_name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusBg(d.status)}`}>
                    {d.status === "deploying" && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
                    {d.status.toUpperCase()}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">Uptime: {getUptime(d)}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="View Logs"
                    onClick={() => handleFetchLogs(d.id)}
                  >
                    <Terminal className="w-4 h-4" />
                  </Button>
                  {d.status === "running" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Stop"
                      disabled={actionLoading === d.id}
                      onClick={() => handleBotAction(d.id, "stop")}
                    >
                      {actionLoading === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
                    </Button>
                  ) : d.status !== "deploying" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary"
                      title="Start"
                      disabled={actionLoading === d.id}
                      onClick={() => handleBotAction(d.id, "start")}
                    >
                      {actionLoading === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                    </Button>
                  ) : null}
                  {d.status !== "deploying" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Restart"
                      disabled={actionLoading === d.id}
                      onClick={() => handleBotAction(d.id, "restart")}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {deployments.length === 0 && (
            <div className="surface rounded-xl p-12 text-center">
              <Server className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No deployments yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Deploy your first WhatsApp bot for free!</p>
              <Button variant="hero" size="sm" onClick={() => setShowDeploy(true)}>
                <Plus className="w-4 h-4 mr-1" /> Deploy Your First Bot
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
