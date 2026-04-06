import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot, Plus, Server, Activity, Clock, Power, PowerOff,
  Upload, Mail, Image, AlertCircle, LogOut,
  Key, Terminal, RefreshCw, Loader2, Trash2,
  TrendingUp, Wallet, Globe, BarChart3,
  Wifi, WifiOff, Cpu, LayoutDashboard, Settings, CreditCard
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Deployment = Tables<"deployments">;
type DashTab = "bots" | "wallet" | "settings";

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
  const [activeTab, setActiveTab] = useState<DashTab>("bots");
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
          if (payload.eventType === "INSERT") setDeployments((prev) => [payload.new as Deployment, ...prev]);
          else if (payload.eventType === "UPDATE") setDeployments((prev) => prev.map((d) => d.id === (payload.new as Deployment).id ? (payload.new as Deployment) : d));
          else if (payload.eventType === "DELETE") setDeployments((prev) => prev.filter((d) => d.id !== (payload.old as any).id));
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (freeUsed && balance < 50) { setShowPayment(true); setShowDeploy(false); toast.error("Insufficient balance. Need 50 GRD."); return; }
    setLoading(true);
    const { data, error } = await supabase.from("deployments").insert({ user_id: user.id, name: botName, session_id: sessionId, status: "pending" }).select().single();
    if (error) { toast.error("Failed: " + error.message); setLoading(false); return; }
    if (!freeUsed) await supabase.from("profiles").update({ free_deploys_used: (profile?.free_deploys_used ?? 0) + 1 }).eq("user_id", user.id);
    else await supabase.from("profiles").update({ balance: balance - 50 }).eq("user_id", user.id);
    toast.success("Bot deployment started!"); setBotName(""); setSessionId(""); setShowDeploy(false); refreshProfile();
    if (data) { setDeployingId(data.id); supabase.functions.invoke("deploy-bot", { body: { deployment_id: data.id } }).finally(() => setDeployingId(null)); }
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

  const handleDeleteBot = async (deploymentId: string, name: string) => {
    if (!confirm(`Delete "${name}"? This removes the Heroku app too.`)) return;
    setActionLoading(deploymentId);
    try {
      const { error } = await supabase.functions.invoke("delete-bot", { body: { deployment_id: deploymentId } });
      if (error) toast.error("Delete failed"); else { toast.success("Bot deleted"); setDeployments(prev => prev.filter(d => d.id !== deploymentId)); }
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
    const interval = setInterval(() => { supabase.functions.invoke("heroku-logs", { body: { deployment_id: showLogs } }).catch(() => {}); }, 5000);
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
      if (uploadError) { toast.error("Upload failed"); setLoading(false); return; }
      screenshotUrl = filePath;
    }
    const { error } = await supabase.from("payments").insert({ user_id: user.id, email: paymentEmail, amount: Number(paymentAmount) || 0, screenshot_url: screenshotUrl });
    if (error) toast.error("Failed"); else { toast.success("Payment submitted!"); setShowPayment(false); setPaymentEmail(profile?.email || ""); setPaymentAmount(""); setScreenshotFile(null); }
    setLoading(false);
  };

  const handleSaveHerokuKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("heroku_keys").insert({ user_id: user.id, api_key: herokuKey, team_or_personal: herokuType, is_global: false });
    if (error) toast.error("Failed"); else { toast.success("Key saved!"); setShowHerokuKey(false); setHerokuKey(""); }
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

  const runningCount = deployments.filter(d => d.status === "running").length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Ambient BG */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[180px]" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-[hsl(var(--info))]/3 blur-[180px]" />
      </div>

      {/* Compact Header */}
      <header className="glass sticky top-0 z-40">
        <div className="flex items-center justify-between h-12 px-3 sm:px-4 max-w-6xl mx-auto">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">BOTHOST</span>
          </Link>
          <div className="flex items-center gap-2">
            {/* Inline balance pill */}
            <div className="glass-card rounded-full px-2.5 py-1 flex items-center gap-1.5 text-xs">
              <Wallet className="w-3 h-3 text-primary" />
              <span className="font-bold text-primary">{balance}</span>
              <span className="text-muted-foreground text-[10px]">GRD</span>
            </div>
            {isAdmin && <Link to="/admin"><Button variant="outline" size="sm" className="text-[10px] h-7 px-2">Admin</Button></Link>}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={signOut}><LogOut className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </header>

      {/* Quick Stats Bar */}
      <div className="glass border-b border-border/50 px-3 sm:px-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3 sm:gap-6 h-10 overflow-x-auto text-[10px] sm:text-xs">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Server className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Bots:</span>
            <span className="font-bold">{deployments.length}</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Activity className="w-3 h-3 text-success" />
            <span className="text-muted-foreground">Running:</span>
            <span className="font-bold text-success">{runningCount}</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <BarChart3 className="w-3 h-3 text-warning" />
            <span className="text-muted-foreground">Spent:</span>
            <span className="font-bold text-warning">{totalSpent} GRD</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Globe className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">≈ {localCurrency.symbol}{localBalance}</span>
          </div>
          {/* Mini health dots */}
          <div className="flex items-center gap-0.5 ml-auto">
            {deployments.slice(0, 10).map(d => (
              <div key={d.id} className={`w-2 h-2 rounded-full ${d.status === "running" ? "bg-success" : d.status === "deploying" ? "bg-[hsl(var(--info))]" : d.status === "failed" ? "bg-destructive" : "bg-muted-foreground/30"}`} title={`${d.name}: ${d.status}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation - sticky below header */}
      <div className="sticky top-12 z-30 glass border-b border-border/30">
        <div className="max-w-6xl mx-auto flex px-3 sm:px-4">
          {([
            { id: "bots" as DashTab, icon: Bot, label: "My Bots" },
            { id: "wallet" as DashTab, icon: CreditCard, label: "Wallet" },
            { id: "settings" as DashTab, icon: Settings, label: "Settings" },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-4 py-3 sm:py-4 relative">

        {/* === BOTS TAB === */}
        {activeTab === "bots" && (
          <div className="space-y-3">
            {/* Actions row */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold">Deployments</h2>
              <Button variant="hero" size="sm" className="text-xs h-8" onClick={() => setShowDeploy(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Deploy
              </Button>
            </div>

            {/* Health overview bar */}
            {deployments.length > 0 && (
              <div className="glass-card rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] sm:text-xs font-medium">Fleet Health</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{runningCount}/{deployments.length} online</span>
                </div>
                <div className="flex items-end gap-0.5 h-10">
                  {deployments.map(d => {
                    const h = getHealthStatus(d);
                    const barColor = h.percent > 60 ? "bg-success" : h.percent > 30 ? "bg-warning" : h.percent > 0 ? "bg-destructive" : "bg-muted-foreground/20";
                    return (
                      <div key={d.id} className="flex-1 flex flex-col items-center gap-0.5 min-w-0" title={`${d.name}: ${h.label}`}>
                        <div className={`w-full max-w-[24px] rounded-t-sm ${barColor} transition-all`} style={{ height: `${Math.max(h.percent, 8)}%` }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bot list - compact cards */}
            {deployments.map(d => {
              const health = getHealthStatus(d);
              return (
                <div key={d.id} className="glass-card rounded-xl p-3 glass-hover">
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative border border-primary/10 flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                      <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${
                        d.status === "running" ? "bg-success shadow-success/40" :
                        d.status === "deploying" ? "bg-[hsl(var(--info))] animate-pulse" :
                        d.status === "failed" ? "bg-destructive" : "bg-muted-foreground/40"
                      } shadow-lg`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-xs sm:text-sm truncate">{d.name}</h3>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${statusBg(d.status)}`}>
                          {d.status === "deploying" && <Loader2 className="w-2.5 h-2.5 inline mr-0.5 animate-spin" />}
                          {d.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-muted-foreground font-mono truncate max-w-[100px] sm:max-w-[160px]">
                          {d.session_id ? d.session_id.substring(0, 12) : "N/A"}...
                        </span>
                        <span className="text-[9px] text-muted-foreground">⏱ {getUptime(d)}</span>
                        {d.status === "running" ? <Wifi className="w-2.5 h-2.5 text-success" /> : <WifiOff className="w-2.5 h-2.5 text-muted-foreground/40" />}
                        {/* Mini health bar */}
                        <div className="hidden sm:block w-10 bg-muted rounded-full h-1">
                          <div className={`rounded-full h-1 ${health.percent > 60 ? "bg-success" : health.percent > 30 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${health.percent}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Logs" onClick={() => handleFetchLogs(d.id)}>
                        <Terminal className="w-3.5 h-3.5" />
                      </Button>
                      {d.status === "running" ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Stop" disabled={actionLoading === d.id} onClick={() => handleBotAction(d.id, "stop")}>
                          {actionLoading === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <PowerOff className="w-3.5 h-3.5" />}
                        </Button>
                      ) : d.status !== "deploying" ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Start" disabled={actionLoading === d.id} onClick={() => handleBotAction(d.id, "start")}>
                          {actionLoading === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                        </Button>
                      ) : null}
                      {d.status !== "deploying" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Restart" disabled={actionLoading === d.id} onClick={() => handleBotAction(d.id, "restart")}>
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete" disabled={actionLoading === d.id} onClick={() => handleDeleteBot(d.id, d.name)}>
                        {actionLoading === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {deployments.length === 0 && (
              <div className="glass-card-premium rounded-xl p-8 text-center">
                <Server className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <h3 className="font-semibold text-sm mb-1">No deployments yet</h3>
                <p className="text-muted-foreground text-xs mb-3">Deploy your first WhatsApp bot for free!</p>
                <Button variant="hero" size="sm" onClick={() => setShowDeploy(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Deploy First Bot
                </Button>
              </div>
            )}
          </div>
        )}

        {/* === WALLET TAB === */}
        {activeTab === "wallet" && (
          <div className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold">Wallet & Billing</h2>
            
            {/* Balance card */}
            <div className="glass-card-premium rounded-xl p-4 glow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
                  <p className="text-2xl sm:text-3xl font-bold text-primary">{balance} <span className="text-sm text-muted-foreground">GRD</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">≈ {localCurrency.symbol}{localBalance} {localCurrency.code}</p>
                </div>
                <Button variant="hero" size="sm" className="text-xs" onClick={() => setShowPayment(true)}>
                  <Upload className="w-3 h-3 mr-1" /> Top Up
                </Button>
              </div>
              {/* Mini bar chart */}
              <div className="flex items-end gap-0.5 h-8 mt-2">
                {[40, 65, 30, 80, 55, 90, balance > 0 ? Math.min((balance / 500) * 100, 100) : 5].map((h, i) => (
                  <div key={i} className={`flex-1 rounded-sm ${i === 6 ? "bg-primary" : "bg-primary/15"}`} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>

            {/* Spending summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="glass-card rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Total Spent</p>
                <p className="text-lg font-bold text-warning">{totalSpent} GRD</p>
                <div className="w-full bg-muted rounded-full h-1 mt-2">
                  <div className="bg-warning rounded-full h-1" style={{ width: `${Math.min((totalSpent / Math.max(totalSpent + balance, 1)) * 100, 100)}%` }} />
                </div>
              </div>
              <div className="glass-card rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Deployments</p>
                <p className="text-lg font-bold">{totalDeployed}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{paidDeploys} paid · {freeUsed ? 0 : 1} free left</p>
              </div>
            </div>

            <div className="glass-card rounded-xl p-3">
              <p className="text-xs font-medium mb-2">Pricing</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>First deployment</span><span className="font-bold text-success">FREE</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
                <span>Each additional bot</span><span className="font-bold">50 GRD</span>
              </div>
            </div>
          </div>
        )}

        {/* === SETTINGS TAB === */}
        {activeTab === "settings" && (
          <div className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold">Settings</h2>
            
            {/* Account info */}
            <div className="glass-card rounded-xl p-3">
              <p className="text-xs font-medium mb-2">Account</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Email</span>
                <span className="font-mono text-[10px]">{profile?.email}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1.5">
                <span className="text-muted-foreground">Display Name</span>
                <span>{profile?.display_name || "—"}</span>
              </div>
            </div>

            {/* Heroku Key */}
            <div className="glass-card rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium">Heroku API Key</p>
                <Button variant="outline" size="sm" className="text-[10px] h-6 px-2" onClick={() => setShowHerokuKey(true)}>
                  <Key className="w-3 h-3 mr-1" /> Add Key
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Add your own Heroku API key for private deployments. Keys are auto-detected and rotated.</p>
            </div>
          </div>
        )}
      </div>

      {/* === MODALS === */}

      {/* Deploy Modal */}
      {showDeploy && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/60 backdrop-blur-md">
          <div className="glass-modal rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 w-full max-w-md animate-fade-up max-h-[85vh] overflow-y-auto">
            <h3 className="text-base font-bold mb-3">Deploy New Bot</h3>
            <form onSubmit={handleDeploy} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Bot Name</label>
                <Input placeholder="My WhatsApp Bot" className="bg-secondary/50 border-[hsl(0_0%_100%/0.08)] h-9 text-sm" value={botName} onChange={e => setBotName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Base64 Session ID</label>
                <Textarea placeholder="Paste your base64 session ID..." className="bg-secondary/50 border-[hsl(0_0%_100%/0.08)] font-mono text-[10px] min-h-[80px]" value={sessionId} onChange={e => setSessionId(e.target.value)} required />
              </div>
              {freeUsed && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg glass text-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
                  <span>Balance: {balance} GRD (50 GRD per deploy)</span>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowDeploy(false)}>Cancel</Button>
                <Button type="submit" variant="hero" size="sm" disabled={loading}>
                  {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Deploying...</> : "Deploy"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/60 backdrop-blur-md">
          <div className="glass-modal rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 w-full max-w-md animate-fade-up max-h-[85vh] overflow-y-auto">
            <h3 className="text-base font-bold mb-1">Top Up Balance</h3>
            <p className="text-muted-foreground text-xs mb-3">Send money, then upload confirmation.</p>
            <div className="space-y-1.5 mb-3 p-2.5 rounded-lg glass text-xs">
              <p><span className="text-muted-foreground">Safaricom:</span> <span className="font-mono font-bold text-primary">0116284050</span></p>
              <p><span className="text-muted-foreground">Airtel:</span> <span className="font-mono font-bold text-primary">0105521300</span></p>
              <p><span className="text-muted-foreground">Name:</span> <span className="font-semibold">AKIDA RAJAB</span></p>
            </div>
            <form onSubmit={handlePaymentSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input type="email" placeholder="you@example.com" className="pl-9 bg-secondary/50 border-[hsl(0_0%_100%/0.08)] h-9 text-sm" value={paymentEmail} onChange={e => setPaymentEmail(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Amount (GRD)</label>
                <Input type="number" placeholder="300" className="bg-secondary/50 border-[hsl(0_0%_100%/0.08)] h-9 text-sm" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required min="1" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Screenshot</label>
                <label className="border border-dashed border-[hsl(0_0%_100%/0.08)] rounded-lg p-4 text-center cursor-pointer hover:border-primary/30 transition-colors block glass">
                  <Image className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">{screenshotFile ? screenshotFile.name : "Tap to upload"}</p>
                  <input type="file" accept="image/*" className="hidden" onChange={e => setScreenshotFile(e.target.files?.[0] || null)} />
                </label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowPayment(false)}>Cancel</Button>
                <Button type="submit" variant="hero" size="sm" disabled={loading}>{loading ? "Submitting..." : "Submit"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Heroku Key Modal */}
      {showHerokuKey && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/60 backdrop-blur-md">
          <div className="glass-modal rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 w-full max-w-md animate-fade-up">
            <h3 className="text-base font-bold mb-1">Add Heroku API Key</h3>
            <p className="text-muted-foreground text-xs mb-3">We auto-detect key type and rotate across all your keys.</p>
            <form onSubmit={handleSaveHerokuKey} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">API Key</label>
                <Input placeholder="HRKU-xxxxx..." className="bg-secondary/50 border-[hsl(0_0%_100%/0.08)] font-mono text-[10px] h-9" value={herokuKey} onChange={e => setHerokuKey(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Type</label>
                <div className="flex gap-2">
                  {["personal", "team"].map(t => (
                    <button key={t} type="button" onClick={() => setHerokuType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${herokuType === t ? "border-primary bg-primary/10 text-primary" : "border-[hsl(0_0%_100%/0.08)] text-muted-foreground hover:text-foreground"}`}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowHerokuKey(false)}>Cancel</Button>
                <Button type="submit" variant="hero" size="sm" disabled={loading}>{loading ? "Saving..." : "Save Key"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logs Modal - full screen on mobile */}
      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-md">
          <div className="glass-modal rounded-t-2xl sm:rounded-2xl p-3 sm:p-5 w-full sm:max-w-2xl h-[80vh] sm:max-h-[80vh] flex flex-col animate-fade-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" /> Live Logs
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              </h3>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => handleFetchLogs(showLogs)}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setShowLogs(null)}>Close</Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto rounded-lg bg-background/80 p-2 sm:p-3 font-mono text-[9px] sm:text-[11px] space-y-0.5 border border-[hsl(0_0%_100%/0.04)]">
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
                  if (log.includes("🟢") || lower.includes("connected") || lower.includes("bot is ready") || lower.includes("linked") || lower.includes("session restored") || lower.includes("state changed to up")) lineClass = "text-success font-medium";
                  else if (log.includes("🔴") || lower.includes("error") || lower.includes("fatal") || lower.includes("crashed") || lower.includes("logged out") || lower.includes("session closed")) lineClass = "text-destructive";
                  else if (log.includes("⏳") || lower.includes("qr code") || lower.includes("scan qr") || lower.includes("waiting")) lineClass = "text-warning";
                  else if (log.includes("🟡") || lower.includes("starting") || lower.includes("build")) lineClass = "text-[hsl(var(--info))]";
                  else if (log.includes("-----> ") || log.includes("==>")) lineClass = "text-primary font-semibold";
                  else if (log.includes("✅") || lower.includes("deployed") || lower.includes("build succeeded")) lineClass = "text-success";
                  return (
                    <p key={i} className={lineClass}>
                      <span className="text-muted-foreground/30 mr-2 select-none inline-block w-5 text-right text-[8px]">{i + 1}</span>{log}
                    </p>
                  );
                }) : null;
              })() || (
                <div className="text-center text-muted-foreground py-6">
                  <Terminal className="w-5 h-5 mx-auto mb-1.5 opacity-50" />
                  <p className="text-xs">Logs will appear once the bot starts.</p>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
