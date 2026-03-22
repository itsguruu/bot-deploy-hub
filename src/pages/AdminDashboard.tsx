import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot, Users, CreditCard, Search, CheckCircle2, XCircle,
  DollarSign, Ban, Eye, ArrowLeft, Server, Activity,
  Clock, AlertTriangle, Plus, Minus, LogOut
} from "lucide-react";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  balance: number;
  deployments: number;
  freeUsed: boolean;
  status: "active" | "restricted" | "pending";
  pendingPayment?: { amount: number; screenshot: string; submittedAt: string };
}

const mockUsers: UserRecord[] = [
  { id: "1", name: "Amina Hassan", email: "amina@gmail.com", balance: 500, deployments: 3, freeUsed: true, status: "active" },
  { id: "2", name: "Brian Ochieng", email: "brian.o@yahoo.com", balance: 0, deployments: 1, freeUsed: true, status: "pending", pendingPayment: { amount: 300, screenshot: "mpesa_confirm.jpg", submittedAt: "2026-03-21 14:30" } },
  { id: "3", name: "Cynthia Wanjiku", email: "cynthia.w@outlook.com", balance: 200, deployments: 2, freeUsed: true, status: "active" },
  { id: "4", name: "David Mwangi", email: "david.m@gmail.com", balance: 0, deployments: 1, freeUsed: false, status: "restricted" },
  { id: "5", name: "Fatima Ali", email: "fatima.a@gmail.com", balance: 1000, deployments: 5, freeUsed: true, status: "active" },
];

type Tab = "overview" | "users" | "payments" | "deployments";

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserRecord[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [fundAmount, setFundAmount] = useState("");

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingPayments = users.filter(u => u.pendingPayment);
  const totalRevenue = users.reduce((s, u) => s + u.balance, 0);
  const totalDeploys = users.reduce((s, u) => s + u.deployments, 0);

  const approvePayment = (userId: string) => {
    setUsers(prev => prev.map(u =>
      u.id === userId
        ? { ...u, status: "active" as const, balance: u.balance + (u.pendingPayment?.amount || 0), pendingPayment: undefined }
        : u
    ));
  };

  const rejectPayment = (userId: string) => {
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, pendingPayment: undefined } : u
    ));
  };

  const addFunds = (userId: string, amount: number) => {
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, balance: u.balance + amount } : u
    ));
    setFundAmount("");
    setSelectedUser(null);
  };

  const toggleRestrict = (userId: string) => {
    setUsers(prev => prev.map(u =>
      u.id === userId
        ? { ...u, status: (u.status === "restricted" ? "active" : "restricted") as "active" | "restricted" }
        : u
    ));
  };

  const removeUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  const statusBadge = (s: string) => {
    const styles = {
      active: "bg-success/10 text-success",
      restricted: "bg-destructive/10 text-destructive",
      pending: "bg-warning/10 text-warning",
    };
    return styles[s as keyof typeof styles] || "";
  };

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "users", label: "Users", icon: Users },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "deployments", label: "Deployments", icon: Server },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm"><LogOut className="w-4 h-4" /></Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.id === "payments" && pendingPayments.length > 0 && (
                <span className="ml-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                  {pendingPayments.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === "overview" && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Users", value: users.length, icon: Users },
                { label: "Total Deploys", value: totalDeploys, icon: Server },
                { label: "Total Revenue", value: `KES ${totalRevenue.toLocaleString()}`, icon: DollarSign },
                { label: "Pending Payments", value: pendingPayments.length, icon: Clock },
              ].map(s => (
                <div key={s.label} className="surface rounded-xl p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                    <s.icon className="w-3.5 h-3.5" /> {s.label}
                  </div>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              ))}
            </div>

            {pendingPayments.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" /> Pending Approvals
                </h3>
                <div className="space-y-3">
                  {pendingPayments.map(u => (
                    <div key={u.id} className="surface rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <p className="font-semibold">{u.name}</p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Amount: <span className="text-foreground font-mono">KES {u.pendingPayment?.amount}</span> • {u.pendingPayment?.submittedAt}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => rejectPayment(u.id)}>
                          <XCircle className="w-4 h-4 mr-1 text-destructive" /> Reject
                        </Button>
                        <Button variant="hero" size="sm" onClick={() => approvePayment(u.id)}>
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or email..."
                  className="pl-10 bg-secondary"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredUsers.map(u => (
                <div key={u.id} className="surface rounded-xl p-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
                        {u.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{u.name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusBadge(u.status)}`}>
                            {u.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-muted-foreground text-xs">Balance</p>
                        <p className="font-mono font-bold">KES {u.balance}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground text-xs">Deploys</p>
                        <p className="font-bold">{u.deployments}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => { setSelectedUser(u); setFundAmount(""); }}
                          title="Add Funds"
                        >
                          <Plus className="w-4 h-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => toggleRestrict(u.id)}
                          title={u.status === "restricted" ? "Unrestrict" : "Restrict"}
                        >
                          <Ban className={`w-4 h-4 ${u.status === "restricted" ? "text-warning" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => removeUser(u.id)}
                          title="Remove"
                        >
                          <XCircle className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredUsers.length === 0 && (
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
            <h3 className="text-lg font-bold mb-4">Payment History & Pending</h3>
            <div className="space-y-3">
              {users.filter(u => u.pendingPayment || u.balance > 0).map(u => (
                <div key={u.id} className="surface rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono font-bold">KES {u.balance}</p>
                      {u.pendingPayment && (
                        <p className="text-xs text-warning">+KES {u.pendingPayment.amount} pending</p>
                      )}
                    </div>
                    {u.pendingPayment && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => rejectPayment(u.id)}>
                          <XCircle className="w-4 h-4 text-destructive" />
                        </Button>
                        <Button variant="hero" size="sm" onClick={() => approvePayment(u.id)}>
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deployments Tab */}
        {activeTab === "deployments" && (
          <div>
            <h3 className="text-lg font-bold mb-4">All Deployments</h3>
            <div className="space-y-3">
              {users.filter(u => u.deployments > 0).map(u => (
                <div key={u.id} className="surface rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{u.name}</p>
                      <p className="text-sm text-muted-foreground">{u.deployments} bot(s) deployed</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusBadge(u.status)}`}>
                    {u.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Funds Modal */}
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="surface rounded-xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold mb-2">Add Funds</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add funds manually to <span className="text-foreground font-medium">{selectedUser.name}</span>'s account.
              </p>
              <p className="text-sm mb-4">Current balance: <span className="font-mono font-bold">KES {selectedUser.balance}</span></p>
              <div className="flex gap-2 mb-4">
                <Input
                  type="number"
                  placeholder="Amount in KES"
                  className="bg-secondary"
                  value={fundAmount}
                  onChange={e => setFundAmount(e.target.value)}
                />
                <Button
                  variant="hero"
                  onClick={() => fundAmount && addFunds(selectedUser.id, Number(fundAmount))}
                  disabled={!fundAmount || Number(fundAmount) <= 0}
                >
                  Add
                </Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setSelectedUser(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
