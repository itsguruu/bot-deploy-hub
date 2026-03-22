import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot, Users, CreditCard, Search, CheckCircle2, XCircle,
  DollarSign, Ban, Server, Activity, Clock, AlertTriangle,
  Plus, LogOut, Key, Terminal, Eye, RefreshCw
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Payment = Tables<"payments">;
type Deployment = Tables<"deployments">;

type Tab = "overview" | "users" | "payments" | "deployments" | "heroku";

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allDeployments, setAllDeployments] = useState<Deployment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [globalHerokuKey, setGlobalHerokuKey] = useState("");
  const [globalKeyType, setGlobalKeyType] = useState("personal");
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [profilesRes, paymentsRes, deploymentsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("deployments").select("*").order("created_at", { ascending: false }),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (paymentsRes.data) setPayments(paymentsRes.data);
    if (deploymentsRes.data) setAllDeployments(deploymentsRes.data);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredProfiles = profiles.filter(p =>
    (p.display_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingPayments = payments.filter(p => p.status === "pending");
  const totalRevenue = payments.filter(p => p.status === "approved").reduce((s, p) => s + Number(p.amount), 0);

  const approvePayment = async (payment: Payment) => {
    setLoading(true);
    await supabase.from("payments").update({ status: "approved" as const }).eq("id", payment.id);
    // Add funds to user
    const userProfile = profiles.find(p => p.user_id === payment.user_id);
    if (userProfile) {
      await supabase.from("profiles").update({ balance: Number(userProfile.balance) + Number(payment.amount) }).eq("user_id", payment.user_id);
    }
    toast.success("Payment approved and funds added!");
    fetchData();
    setLoading(false);
  };

  const rejectPayment = async (paymentId: string) => {
    await supabase.from("payments").update({ status: "rejected" as const }).eq("id", paymentId);
    toast.success("Payment rejected");
    fetchData();
  };

  const addFunds = async (userId: string, amount: number) => {
    const userProfile = profiles.find(p => p.user_id === userId);
    if (!userProfile) return;
    await supabase.from("profiles").update({ balance: Number(userProfile.balance) + amount }).eq("user_id", userId);
    toast.success(`Added KES ${amount} to ${userProfile.email}`);
    setFundAmount("");
    setSelectedUser(null);
    fetchData();
  };

  const toggleRestrict = async (profile: Profile) => {
    await supabase.from("profiles").update({ restricted: !profile.restricted }).eq("user_id", profile.user_id);
    toast.success(profile.restricted ? "User unrestricted" : "User restricted");
    fetchData();
  };

  const saveGlobalHerokuKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("heroku_keys").insert({
      api_key: globalHerokuKey,
      team_or_personal: globalKeyType,
      is_global: true,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Global Heroku key saved!");
      setGlobalHerokuKey("");
    }
    setLoading(false);
  };

  const statusBadge = (restricted: boolean) =>
    restricted ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success";

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "users", label: "Users", icon: Users },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "deployments", label: "Deployments", icon: Server },
    { id: "heroku", label: "Heroku Keys", icon: Key },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold">BOTHOST</span>
            </Link>
            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">ADMIN</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.id === "payments" && pendingPayments.length > 0 && (
                <span className="ml-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">{pendingPayments.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === "overview" && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Users", value: profiles.length, icon: Users },
                { label: "Total Deploys", value: allDeployments.length, icon: Server },
                { label: "Revenue", value: `KES ${totalRevenue.toLocaleString()}`, icon: DollarSign },
                { label: "Pending", value: pendingPayments.length, icon: Clock },
              ].map(s => (
                <div key={s.label} className="surface rounded-xl p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><s.icon className="w-3.5 h-3.5" /> {s.label}</div>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="surface rounded-xl p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Bot Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Running</span><span className="font-bold text-success">{allDeployments.filter(d => d.status === "running").length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Stopped</span><span className="font-bold">{allDeployments.filter(d => d.status === "stopped").length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pending</span><span className="font-bold text-warning">{allDeployments.filter(d => d.status === "pending").length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Failed</span><span className="font-bold text-destructive">{allDeployments.filter(d => d.status === "failed").length}</span></div>
                </div>
              </div>
              <div className="surface rounded-xl p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Pending Payments</h3>
                {pendingPayments.length > 0 ? pendingPayments.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{p.email}</p>
                      <p className="text-xs text-muted-foreground">KES {p.amount}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => rejectPayment(p.id)}><XCircle className="w-3.5 h-3.5 text-destructive" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => approvePayment(p)}><CheckCircle2 className="w-3.5 h-3.5 text-success" /></Button>
                    </div>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No pending payments</p>}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search users by name or email..." className="pl-10 bg-secondary" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <div className="space-y-3">
              {filteredProfiles.map(p => (
                <div key={p.id} className="surface rounded-xl p-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
                        {(p.display_name || p.email).substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{p.display_name || p.email}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusBadge(p.restricted)}`}>
                            {p.restricted ? "RESTRICTED" : "ACTIVE"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{p.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-muted-foreground text-xs">Balance</p>
                        <p className="font-mono font-bold">KES {p.balance}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground text-xs">Deploys</p>
                        <p className="font-bold">{allDeployments.filter(d => d.user_id === p.user_id).length}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedUser(p); setFundAmount(""); }} title="Add Funds">
                          <Plus className="w-4 h-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleRestrict(p)} title={p.restricted ? "Unrestrict" : "Restrict"}>
                          <Ban className={`w-4 h-4 ${p.restricted ? "text-warning" : ""}`} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredProfiles.length === 0 && (
                <div className="surface rounded-xl p-12 text-center">
                  <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No users found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <div>
            <h3 className="text-lg font-bold mb-4">All Payments</h3>
            <div className="space-y-3">
              {payments.map(p => (
                <div key={p.id} className="surface rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="font-semibold">{p.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()} • Status: <span className={p.status === "approved" ? "text-success" : p.status === "rejected" ? "text-destructive" : "text-warning"}>{p.status}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-mono font-bold">KES {p.amount}</p>
                    {p.status === "pending" && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => rejectPayment(p.id)}><XCircle className="w-4 h-4 text-destructive" /></Button>
                        <Button variant="hero" size="sm" onClick={() => approvePayment(p)}><CheckCircle2 className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <div className="surface rounded-xl p-12 text-center text-muted-foreground">No payments yet</div>
              )}
            </div>
          </div>
        )}

        {/* Deployments Tab */}
        {activeTab === "deployments" && (
          <div>
            <h3 className="text-lg font-bold mb-4">All Deployments ({allDeployments.length})</h3>
            <div className="space-y-3">
              {allDeployments.map(d => {
                const owner = profiles.find(p => p.user_id === d.user_id);
                return (
                  <div key={d.id} className="surface rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{owner?.email || "Unknown"}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${d.status === "running" ? "bg-green-500/10 text-green-500" : d.status === "failed" ? "bg-destructive/10 text-destructive" : d.status === "deploying" ? "bg-blue-500/10 text-blue-500" : d.status === "pending" ? "bg-yellow-500/10 text-yellow-500" : "bg-muted text-muted-foreground"}`}>
                      {d.status.toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Heroku Keys Tab */}
        {activeTab === "heroku" && (
          <div>
            <h3 className="text-lg font-bold mb-4">Global Heroku API Key</h3>
            <p className="text-sm text-muted-foreground mb-4">Set a global Heroku API key used as default for all deployments. Users can also provide their own key.</p>
            <form onSubmit={saveGlobalHerokuKey} className="surface rounded-xl p-6 space-y-4 max-w-lg">
              <div className="space-y-2">
                <label className="text-sm font-medium">API Key</label>
                <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="bg-secondary font-mono text-xs" value={globalHerokuKey} onChange={e => setGlobalHerokuKey(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Key Type</label>
                <div className="flex gap-3">
                  {["personal", "team"].map(t => (
                    <button key={t} type="button" onClick={() => setGlobalKeyType(t)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${globalKeyType === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" variant="hero" disabled={loading}>{loading ? "Saving..." : "Save Global Key"}</Button>
            </form>
          </div>
        )}

        {/* Add Funds Modal */}
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="surface rounded-xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold mb-2">Add Funds</h3>
              <p className="text-sm text-muted-foreground mb-4">Add funds manually to <span className="text-foreground font-medium">{selectedUser.display_name || selectedUser.email}</span></p>
              <p className="text-sm mb-4">Current balance: <span className="font-mono font-bold">KES {selectedUser.balance}</span></p>
              <div className="flex gap-2 mb-4">
                <Input type="number" placeholder="Amount in KES" className="bg-secondary" value={fundAmount} onChange={e => setFundAmount(e.target.value)} />
                <Button variant="hero" onClick={() => fundAmount && addFunds(selectedUser.user_id, Number(fundAmount))} disabled={!fundAmount || Number(fundAmount) <= 0}>Add</Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setSelectedUser(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
