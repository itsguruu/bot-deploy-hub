import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot, Plus, Server, Activity, Clock, Power, PowerOff,
  Upload, Mail, Image, AlertCircle, CheckCircle2, LogOut
} from "lucide-react";

interface Deployment {
  id: string;
  name: string;
  sessionId: string;
  status: "running" | "stopped" | "pending";
  createdAt: string;
  uptime: string;
}

const mockDeployments: Deployment[] = [
  {
    id: "1",
    name: "My WhatsApp Bot",
    sessionId: "eyJub2lz...K9fQ==",
    status: "running",
    createdAt: "2026-03-20",
    uptime: "2d 4h 12m",
  },
];

export default function UserDashboard() {
  const [deployments] = useState<Deployment[]>(mockDeployments);
  const [showDeploy, setShowDeploy] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [botName, setBotName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [paymentEmail, setPaymentEmail] = useState("");
  const freeUsed = true; // Mock: user already used free deploy

  const handleDeploy = (e: React.FormEvent) => {
    e.preventDefault();
    if (freeUsed) {
      setShowPayment(true);
      setShowDeploy(false);
    } else {
      console.log("Deploy:", botName, sessionId);
    }
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Payment submitted");
    setShowPayment(false);
  };

  const statusColor = (s: string) => {
    if (s === "running") return "text-success";
    if (s === "stopped") return "text-destructive";
    return "text-warning";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold">BOTHOST</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">user@example.com</span>
            <Link to="/login">
              <Button variant="ghost" size="sm"><LogOut className="w-4 h-4" /></Button>
            </Link>
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
            { label: "Balance", value: "KES 0", icon: AlertCircle },
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">My Deployments</h2>
          <div className="flex gap-2">
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
                    <span>You've used your free deployment. Payment is required to deploy more bots.</span>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setShowDeploy(false)}>Cancel</Button>
                  <Button type="submit" variant="hero">{freeUsed ? "Proceed to Payment" : "Deploy"}</Button>
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
              <p className="text-muted-foreground text-sm mb-4">
                Send money first, then upload your confirmation screenshot.
              </p>
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
                  <label className="text-sm font-medium">Payment Screenshot</label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors">
                    <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload screenshot</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setShowPayment(false)}>Cancel</Button>
                  <Button type="submit" variant="hero">Submit for Approval</Button>
                </div>
              </form>
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
                  <p className="text-xs text-muted-foreground font-mono">Session: {d.sessionId}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className={`text-sm font-medium flex items-center gap-1 ${statusColor(d.status)}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">Uptime: {d.uptime}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Stop">
                    <PowerOff className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Restart">
                    <Power className="w-4 h-4" />
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
