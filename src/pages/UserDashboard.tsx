import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot, Plus, Server, Activity, Clock, Power, PowerOff,
  Upload, Mail, Image, AlertCircle, LogOut,
  Key, Terminal, RefreshCw, Loader2, Trash2,
  TrendingUp, Wallet, Globe, Heart, BarChart3,
  Shield, Wifi, WifiOff, Zap
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Deployment = Tables<"deployments">;

const CURRENCY_RATES: Record<string, { symbol: string; rate: number }> = {
  KES: { symbol: "KSh", rate: 1.5 },
  USD: { symbol: "$", rate: 0.0077 },
  EUR: { symbol: "€", rate: 0.0071 },
  GBP: { symbol: "£", rate: 0.0061 },
  NGN: { symbol: "₦", rate: 11.9 },
  TZS: { symbol: "TSh", rate: 19.4 },
  UGX: { symbol: "USh", rate: 28.5 },
  ZAR: { symbol: "R", rate: 0.14 },
  INR: { symbol: "₹", rate: 0.64 },
};

function getLocalCurrency(): { code: string; symbol: string; rate: number } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Nairobi")) return { code: "KES", ...CURRENCY_RATES.KES };
    if (tz.includes("Lagos")) return { code: "NGN", ...CURRENCY_RATES.NGN };
    if (tz.includes("Dar")) return { code: "TZS", ...CURRENCY_RATES.TZS };
    if (tz.includes("Kampala")) return { code: "UGX", ...CURRENCY_RATES.UGX };
    if (tz.includes("Johannesburg")) return { code: "ZAR", ...CURRENCY_RATES.ZAR };
    if (tz.includes("London")) return { code: "GBP", ...CURRENCY_RATES.GBP };
    if (tz.includes("Kolkata")) return { code: "INR", ...CURRENCY_RATES.INR };
    if (tz.includes("Europe")) return { code: "EUR", ...CURRENCY_RATES.EUR };
  } catch {}
  return { code: "USD", ...CURRENCY_RATES.USD };
}

function getHealthStatus(d: Deployment): { label: string; color: string; percent: number } {
  if (d.status === "running") return { label: "Healthy", color: "text-success", percent: 100 };
  if (d.status === "deploying") return { label: "Starting", color: "text-[hsl(var(--info))]", percent: 60 };
  if (d.status === "pending") return { label: "Pending", color: "text-warning", percent: 30 };
  if (d.status === "failed") return { label: "Unhealthy", color: "text-destructive", percent: 10 };
  return { label: "Offline", color: "text-muted-foreground", percent: 0 };
}

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

  const localCurrency = getLocalCurrency();
  const freeUsed = (profile?.free_deploys_used ?? 0) >= 1;
  const balance = profile?.balance ?? 0;
  const localBalance = (balance * localCurrency.rate).toFixed(2);

  // Calculate spending
  const totalDeployed = deployments.length;
  const freeDeploysUsed = Math.min(profile?.free_deploys_used ?? 0, 1);
  const paidDeploys = Math.max(0, totalDeployed - freeDeploysUsed);
  const totalSpent = paidDeploys * 50;

  const fetchDeployments = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("deployments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setDeployments(data);
  }, [user]);

  useEffect(() => { fetchDeployments(); }, [fetchDeployments]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("user-deployments")
      .on("postgres_changes", { event: "*", schema: "public", table: "deployments", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setDeployments((prev) => [payload.new as Deployment, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setDeployments((prev) => prev.map((d) => d.id === (payload.new as Deployment).id ? (payload.new as Deployment) : d));
          } else if (payload.eventType === "DELETE") {
            setDeployments((prev) => prev.filter((d) => d.id !== (payload.old as any).id));
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cost = 50;
    if (freeUsed && balance < cost) {
      setShowPayment(true); setShowDeploy(false);
      toast.error("Insufficient balance. You need at least 50 GRD to deploy.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("deployments").insert({ user_id: user.id, name: botName, session_id: sessionId, status: "pending" }).select().single();
    if (error) { toast.error("Failed to deploy: " + error.message); setLoading(false); return; }
    if (!freeUsed) {
      await supabase.from("profiles").update({ free_deploys_used: (profile?.free_deploys_used ?? 0) + 1 }).eq("user_id", user.id);
    } else {
      await supabase.from("profiles").update({ balance: balance - cost }).eq("user_id", user.id);
    }
    toast.success("Bot deployment started!");
    setBotName(""); setSessionId(""); setShowDeploy(false); refreshProfile();
    if (data) {
      setDeployingId(data.id);
      supabase.functions.invoke("deploy-bot", { body: { deployment_id: data.id } }).finally(() => setDeployingId(null));
    }
    setLoading(false);
  };

  const handleBotAction = async (deploymentId: string, action: "start" | "stop" | "restart") => {
    setActionLoading(deploymentId);
    try {
      const { error } = await supabase.functions.invoke("heroku-action", { body: { deployment_id: deploymentId, action } });
      if (error) toast.error("Action failed: " + error.message);
      else toast.success(`Bot ${action} successful`);
    } catch { toast.error("Action failed"); }
    setActionLoading(null);
  };

  const handleDeleteBot = async (deploymentId: string, botName: string) => {
    if (!confirm(`Are you sure you want to delete "${botName}"? This will also delete the Heroku app.`)) return;
    setActionLoading(deploymentId);
    try {
      const { error } = await supabase.functions.invoke("delete-bot", { body: { deployment_id: deploymentId } });
      if (error) toast.error("Delete failed: " + error.message);
      else { toast.success("Bot deleted successfully"); setDeployments(prev => prev.filter(d => d.id !== deploymentId)); }
    } catch { toast.error("Delete failed"); }
    setActionLoading(null);
  };

  const handleFetchLogs = async (deploymentId: string) => {
    setShowLogs(deploymentId);
    const dep = deployments.find(d => d.id === deploymentId);
    if (!dep?.heroku_app_name) return;
    try { await supabase.functions.invoke("heroku-logs", { body: { deployment_id: deploymentId } }); } catch {}
  };

  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showLogs) return;
    const dep = deployments.find(d => d.id === showLogs);
    if (!dep?.heroku_app_name) return;
    const interval = setInterval(() => {
      supabase.functions.invoke("heroku-logs", { body: { deployment_id: showLogs } }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [showLogs, deployments]);

  useEffect(() => {
    if (showLogs && logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [showLogs, deployments]);

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    let screenshotUrl = "";
    if (screenshotFile) {
      const filePath = `${user.id}/${Date.now()}_${screenshotFile.name}`;
      const { error: uploadError } = await supabase.storage.from("payment-screenshots").upload(filePath, screenshotFile);
      if (uploadError) { toast.error("Failed to upload screenshot: " + uploadError.message); setLoading(false); return; }
      screenshotUrl = filePath;
    }
    const { error } = await supabase.from("payments").insert({ user_id: user.id, email: paymentEmail, amount: Number(paymentAmount) || 0, screenshot_url: screenshotUrl });
    if (error) toast.error("Failed to submit payment: " + error.message);
    else { toast.success("Payment proof submitted! Wait for admin approval."); setShowPayment(false); setPaymentEmail(profile?.email || ""); setPaymentAmount(""); setScreenshotFile(null); }
    setLoading(false);
  };

  const handleSaveHerokuKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("heroku_keys").insert({ user_id: user.id, api_key: herokuKey, team_or_personal: herokuType, is_global: false });
    if (error) toast.error("Failed to save key: " + error.message);
    else { toast.success("Heroku API key saved!"); setShowHerokuKey(false); setHerokuKey(""); }
    setLoading(false);
  };

  const statusBg = (s: string) => {
    if (s === "running") return "bg-success/10 text-success";
    if (s === "deploying") return "bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]";
    if (s === "stopped") return "bg-muted text-muted-foreground";
    if (s === "failed") return "bg-destructive/10 text-destructive";
    return "bg-warning/10 text-warning";
  };

  const getUptime = (d: Deployment) => {
    if (!d.uptime_start || d.status !== "running") return "—";
    const ms = Date.now() - new Date(d.uptime_start).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/3 blur-[200px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[hsl(var(--info))]/3 blur-[200px]" />
      </div>

      <header className="glass sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold hidden sm:inline">BOTHOST</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm text-muted-foreground hidden md:block">{profile?.email}</span>
            {isAdmin && <Link to="/admin"><Button variant="outline" size="sm" className="text-xs">Admin</Button></Link>}
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-8 relative">
        {/* Stats Grid - responsive */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="glass-card rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Server className="w-3.5 h-3.5" /> Total Bots</div>
            <p className="text-xl sm:text-2xl font-bold">{deployments.length}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Activity className="w-3.5 h-3.5" /> Running</div>
            <p className="text-xl sm:text-2xl font-bold text-success">{deployments.filter(d => d.status === "running").length}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Clock className="w-3.5 h-3.5" /> Free Left</div>
            <p className="text-xl sm:text-2xl font-bold">{freeUsed ? 0 : 1}</p>
          </div>
          {/* Balance card */}
          <div className="glass-card-premium rounded-2xl p-4 sm:p-5 glow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Wallet className="w-3.5 h-3.5" /> Balance</div>
            <p className="text-xl sm:text-2xl font-bold text-primary">{balance} GRD</p>
            <div className="flex items-center gap-1 mt-1">
              <Globe className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">≈ {localCurrency.symbol}{localBalance} {localCurrency.code}</span>
            </div>
            <div className="flex items-end gap-0.5 mt-3 h-6">
              {[40, 65, 30, 80, 55, 90, balance > 0 ? Math.min((balance / 500) * 100, 100) : 5].map((h, i) => (
                <div key={i} className={`flex-1 rounded-sm ${i === 6 ? "bg-primary" : "bg-primary/20"}`} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          {/* Spending card */}
          <div className="glass-card rounded-2xl p-4 sm:p-5 col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><BarChart3 className="w-3.5 h-3.5" /> Spent</div>
            <p className="text-xl sm:text-2xl font-bold text-warning">{totalSpent} GRD</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{paidDeploys} paid deploy{paidDeploys !== 1 ? "s" : ""}</span>
            </div>
            {/* Spending bar */}
            <div className="w-full bg-muted rounded-full h-1.5 mt-3">
              <div className="bg-warning rounded-full h-1.5 transition-all" style={{ width: `${Math.min((totalSpent / Math.max(totalSpent + balance, 1)) * 100, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Actions - responsive */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-2">
          <h2 className="text-lg sm:text-xl font-bold">My Deployments</h2>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => setShowHerokuKey(true)}>
              <Key className="w-3.5 h-3.5 mr-1" /> <span className="hidden sm:inline">Heroku</span> Key
            </Button>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => setShowPayment(true)}>
              <Upload className="w-3.5 h-3.5 mr-1" /> <span className="hidden sm:inline">Submit</span> Payment
            </Button>
            <Button variant="hero" size="sm" className="text-xs sm:text-sm" onClick={() => setShowDeploy(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Deploy Bot
            </Button>
          </div>
        </div>

        {/* Deploy Modal */}
        {showDeploy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md p-4">
            <div className="glass-modal rounded-2xl p-5 sm:p-6 w-full max-w-md animate-fade-up max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">Deploy New Bot</h3>
              <form onSubmit={handleDeploy} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bot Name</label>
                  <Input placeholder="My WhatsApp Bot" className="bg-secondary/50 border-[hsl(0_0%_100%/0.08)]" value={botName} onChange={e => setBotName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Base64 Session ID</label>
                  <Textarea placeholder="Paste your base64 session ID here..." className="bg-secondary/50 border-[hsl(0_0%_100%/0.08)] font-mono text-xs min-h-[100px]" value={sessionId} onChange={e => setSessionId(e.target.value)} required />
                </div>
                {freeUsed && (
                  <div className="flex items-start gap-2 p-3 rounded-xl glass text-sm">
                    <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                    <span>You've used your free deployment. Balance: {balance} GRD (50 GRD per deploy)</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md p-4">
            <div className="glass-modal rounded-2xl p-5 sm:p-6 w-full max-w-md animate-fade-up max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-2">Submit Payment Proof</h3>
              <p className="text-muted-foreground text-sm mb-4">Send money first, then upload your confirmation screenshot.</p>
              <div className="space-y-2 mb-4 p-3 rounded-xl glass text-sm">
                <p><span className="text-muted-foreground">Safaricom:</span> <span className="font-mono font-bold text-primary">0116284050</span></p>
                <p><span className="text-muted-foreground">Airtel:</span> <span className="font-mono font-bold text-primary">0105521300</span></p>
                <p><span className="text-muted-foreground">Name:</span> <span className="font-semibold">AKIDA RAJAB</span></p>
              </div>
              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Your Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="you@example.com" className="pl-10 bg-secondary/50 border-[hsl(0_0%_100%/0.08)]" value={paymentEmail} onChange={e => setPaymentEmail(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount (GRD)</label>
                  <Input type="number" placeholder="300" className="bg-secondary/50 border-[hsl(0_0%_100%/0.08)]" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required min="1" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Screenshot</label>
                  <label className="border-2 border-dashed border-[hsl(0_0%_100%/0.08)] rounded-xl p-6 text-center cursor-pointer hover:border-primary/30 transition-colors block glass">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md p-4">
            <div className="glass-modal rounded-2xl p-5 sm:p-6 w-full max-w-md animate-fade-up">
              <h3 className="text-lg font-bold mb-2">Add Heroku API Key</h3>
              <p className="text-muted-foreground text-sm mb-4">Provide your own Heroku API key. We'll auto-detect if it's team or personal.</p>
              <form onSubmit={handleSaveHerokuKey} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input placeholder="HRKU-xxxxx or xxxxxxxx-xxxx..." className="bg-secondary/50 border-[hsl(0_0%_100%/0.08)] font-mono text-xs" value={herokuKey} onChange={e => setHerokuKey(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Key Type</label>
                  <div className="flex gap-3">
                    {["personal", "team"].map(t => (
                      <button key={t} type="button" onClick={() => setHerokuType(t)} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${herokuType === t ? "border-primary bg-primary/10 text-primary shadow-lg shadow-primary/10" : "border-[hsl(0_0%_100%/0.08)] text-muted-foreground hover:text-foreground"}`}>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md p-3 sm:p-4">
            <div className="glass-modal rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-up">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" /> Live Logs
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse mr-1" />
                    Auto-refresh
                  </span>
                </h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleFetchLogs(showLogs)}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowLogs(null)}>Close</Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto rounded-xl bg-background/80 p-3 sm:p-4 font-mono text-[10px] sm:text-xs space-y-0.5 max-h-[65vh] border border-[hsl(0_0%_100%/0.04)]">
                {(() => {
                  const rawLogs = deployments.find(d => d.id === showLogs)?.logs || [];
                  const seen = new Set<string>();
                  const uniqueLogs = rawLogs.filter(log => {
                    const trimmed = log.trim();
                    if (!trimmed || seen.has(trimmed)) return false;
                    seen.add(trimmed);
                    return true;
                  });
                  return uniqueLogs.length > 0 ? uniqueLogs.map((log, i) => {
                    const lower = log.toLowerCase();
                    let lineClass = "text-muted-foreground";
                    if (log.includes("🟢") || lower.includes("connected") || lower.includes("bot is ready") || lower.includes("linked") || lower.includes("session restored") || lower.includes("state changed to up")) {
                      lineClass = "text-success font-medium";
                    } else if (log.includes("🔴") || lower.includes("error") || lower.includes("fatal") || lower.includes("crashed") || lower.includes("logged out") || lower.includes("session closed")) {
                      lineClass = "text-destructive";
                    } else if (log.includes("⏳") || lower.includes("qr code") || lower.includes("scan qr") || lower.includes("waiting")) {
                      lineClass = "text-warning";
                    } else if (log.includes("🟡") || lower.includes("starting") || lower.includes("build")) {
                      lineClass = "text-[hsl(var(--info))]";
                    } else if (log.includes("-----> ") || log.includes("==>")) {
                      lineClass = "text-primary font-semibold";
                    } else if (log.includes("✅") || lower.includes("deployed") || lower.includes("build succeeded")) {
                      lineClass = "text-success";
                    }
                    return (
                      <p key={i} className={lineClass}>
                        <span className="text-muted-foreground/40 mr-2 sm:mr-3 select-none inline-block w-5 sm:w-7 text-right">{i + 1}</span>{log}
                      </p>
                    );
                  }) : null;
                })() || (
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
          {deployments.map(d => {
            const health = getHealthStatus(d);
            return (
              <div key={d.id} className="glass-card rounded-2xl p-4 sm:p-5 glass-hover">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative border border-primary/10 flex-shrink-0">
                      <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      {d.status === "deploying" && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[hsl(var(--info))] animate-pulse shadow-lg shadow-[hsl(var(--info))]/30" />}
                      {d.status === "running" && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-success shadow-lg shadow-success/30" />}
                      {d.status === "stopped" && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-muted-foreground" />}
                      {d.status === "failed" && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-destructive shadow-lg shadow-destructive/30" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base truncate">{d.name}</h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-mono truncate max-w-[140px] sm:max-w-[200px]">
                        Session: {d.session_id ? d.session_id.substring(0, 16) : "N/A"}...
                      </p>
                      {d.heroku_app_name && <p className="text-[10px] sm:text-xs text-muted-foreground truncate">App: {d.heroku_app_name}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    {/* Health bar */}
                    <div className="hidden sm:flex flex-col items-center gap-1 min-w-[60px]">
                      <div className="flex items-center gap-1">
                        {d.status === "running" ? <Wifi className="w-3 h-3 text-success" /> : <WifiOff className="w-3 h-3 text-muted-foreground" />}
                        <span className={`text-[10px] font-medium ${health.color}`}>{health.label}</span>
                      </div>
                      <div className="w-14 bg-muted rounded-full h-1.5">
                        <div className={`rounded-full h-1.5 transition-all ${health.percent > 60 ? "bg-success" : health.percent > 30 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${health.percent}%` }} />
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-full font-semibold ${statusBg(d.status)}`}>
                        {d.status === "deploying" && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
                        {d.status.toUpperCase()}
                      </span>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Uptime: {getUptime(d)}</p>
                    </div>

                    <div className="flex gap-0.5 sm:gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title="View Logs" onClick={() => handleFetchLogs(d.id)}>
                        <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </Button>
                      {d.status === "running" ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title="Stop" disabled={actionLoading === d.id} onClick={() => handleBotAction(d.id, "stop")}>
                          {actionLoading === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PowerOff className="w-3.5 h-3.5" />}
                        </Button>
                      ) : d.status !== "deploying" ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-primary" title="Start" disabled={actionLoading === d.id} onClick={() => handleBotAction(d.id, "start")}>
                          {actionLoading === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                        </Button>
                      ) : null}
                      {d.status !== "deploying" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title="Restart" disabled={actionLoading === d.id} onClick={() => handleBotAction(d.id, "restart")}>
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive" title="Delete Bot" disabled={actionLoading === d.id} onClick={() => handleDeleteBot(d.id, d.name)}>
                        {actionLoading === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {deployments.length === 0 && (
            <div className="glass-card-premium rounded-2xl p-8 sm:p-12 text-center">
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
