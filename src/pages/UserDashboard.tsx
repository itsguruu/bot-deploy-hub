import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot, Plus, Server, Activity, Clock, Power, PowerOff,
  Upload, Mail, Image, AlertCircle, CheckCircle2, LogOut,
  Key, Terminal, RefreshCw
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Deployment = Tables<"deployments">;

export default function UserDashboard() {
  const { user, profile, signOut, refreshProfile } = useAuth();
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

  useEffect(() => {
    fetchDeployments();
    const interval = setInterval(fetchDeployments, 10000);
    return () => clearInterval(interval);
  }, [fetchDeployments]);

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
    const { error } = await supabase.from("deployments").insert({
      user_id: user.id,
      name: botName,
      session_id: sessionId,
      status: "pending",
    });

    if (error) {
      toast.error("Failed to deploy: " + error.message);
    } else {
      // Increment free_deploys_used if this is the free one
      if (!freeUsed) {
        await supabase
          .from("profiles")
          .update({ free_deploys_used: (profile?.free_deploys_used ?? 0) + 1 })
          .eq("user_id", user.id);
      }
      toast.success("Bot deployment submitted!");
      setBotName("");
      setSessionId("");
      setShowDeploy(false);
      fetchDeployments();
      refreshProfile();
    }
    setLoading(false);
  };

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

  const toggleBot = async (id: string, newStatus: "running" | "stopped") => {
    const { error } = await supabase
      .from("deployments")
      .update({ status: newStatus, uptime_start: newStatus === "running" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) toast.error(error.message);
    else fetchDeployments();
  };

  const statusColor = (s: string) => {
    if (s === "running") return "text-success";
    if (s === "stopped" || s === "failed") return "text-destructive";
    return "text-warning";
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
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
                    <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                    <span>You've used your free deployment. Balance: KES {profile?.balance ?? 0}</span>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setShowDeploy(false)}>Cancel</Button>
                  <Button type="submit" variant="hero" disabled={loading}>{loading ? "Deploying..." : "Deploy"}</Button>
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
              <p className="text-muted-foreground text-sm mb-4">Provide your own Heroku API key for bot deployments. We'll auto-detect if it's a team or personal key.</p>
              <form onSubmit={handleSaveHerokuKey} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="bg-secondary font-mono text-xs" value={herokuKey} onChange={e => setHerokuKey(e.target.value)} required />
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
                <h3 className="text-lg font-bold flex items-center gap-2"><Terminal className="w-5 h-5 text-primary" /> Live Logs</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowLogs(null)}>Close</Button>
              </div>
              <div className="flex-1 overflow-y-auto bg-background rounded-lg p-4 font-mono text-xs space-y-1">
                {deployments.find(d => d.id === showLogs)?.logs?.length ? (
                  deployments.find(d => d.id === showLogs)!.logs!.map((log, i) => (
                    <p key={i} className="text-muted-foreground"><span className="text-primary">›</span> {log}</p>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Terminal className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p>No logs yet. Logs will appear once the bot starts running.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Deployments List */}
        <div className="space-y-3">
          {deployments.map(d => (
            <div key={d.id} className="surface rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{d.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">Session: {d.session_id.substring(0, 20)}...</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={`text-sm font-medium flex items-center gap-1 ${statusColor(d.status)}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">Uptime: {getUptime(d)}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="View Logs" onClick={() => setShowLogs(d.id)}>
                    <Terminal className="w-4 h-4" />
                  </Button>
                  {d.status === "running" ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Stop" onClick={() => toggleBot(d.id, "stopped")}>
                      <PowerOff className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Start" onClick={() => toggleBot(d.id, "running")}>
                      <Power className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Restart" onClick={() => { toggleBot(d.id, "stopped"); setTimeout(() => toggleBot(d.id, "running"), 1000); }}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
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
