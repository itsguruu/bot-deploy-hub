import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ScrollReveal";
import {
  Bot, Zap, Shield, Clock, Server, CreditCard,
  Phone, Mail, ArrowRight, Star, CheckCircle2,
  Terminal, Users, Rocket, Gift, Megaphone
} from "lucide-react";

const features = [
  { icon: Bot, title: "WhatsApp Bot MD", desc: "Deploy multi-device WhatsApp bots with full session management" },
  { icon: Zap, title: "Instant Deploy", desc: "Paste your base64 session ID and go live in under 60 seconds" },
  { icon: Shield, title: "Always Online", desc: "99.8% uptime with automatic restarts and crash recovery" },
  { icon: Clock, title: "24/7 Runtime", desc: "Your bot never sleeps — runs continuously without interruption" },
  { icon: Server, title: "Managed Hosting", desc: "No server setup needed. We handle infrastructure so you don't" },
  { icon: Terminal, title: "Real-time Logs", desc: "Monitor your bot's activity with live console output" },
];

const steps = [
  { num: "01", title: "Sign Up", desc: "Create your free BOTHOST account in seconds" },
  { num: "02", title: "Paste Session", desc: "Enter your base64 WhatsApp session ID" },
  { num: "03", title: "Deploy", desc: "Hit deploy — your bot goes live instantly" },
  { num: "04", title: "Monitor", desc: "Track performance from your dashboard" },
];

const offers = [
  { icon: Gift, title: "First Deploy FREE", desc: "Every new user gets 1 free deployment — no card needed", tag: "LIMITED" },
  { icon: Star, title: "Refer & Earn", desc: "Invite friends and earn free hosting days on your account", tag: "POPULAR" },
  { icon: Rocket, title: "Weekend Flash Sales", desc: "Up to 40% off on select weekends — follow us for alerts", tag: "SAVE" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">BOTHOST</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#offers" className="hover:text-foreground transition-colors">Offers</a>
            <a href="#payment" className="hover:text-foreground transition-colors">Payment</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/register">
              <Button variant="hero" size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        </div>
        <div className="container mx-auto max-w-4xl text-center relative">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-8">
              <Zap className="w-3.5 h-3.5" /> 1 Free Deployment for New Users
            </div>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[0.95] mb-6">
              Host Your WhatsApp
              <br />
              <span className="text-primary">Bot in Seconds</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              BOTHOST is the easiest way to deploy and manage WhatsApp MD bots.
              Paste your base64 session ID, hit deploy, and you're live.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={300}>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link to="/register">
                <Button variant="hero" size="lg" className="text-base px-8">
                  Deploy for Free <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="hero-outline" size="lg" className="text-base px-8">
                  See Features
                </Button>
              </a>
            </div>
          </ScrollReveal>

          {/* Terminal preview */}
          <ScrollReveal delay={400}>
            <div className="mt-16 surface rounded-xl overflow-hidden max-w-2xl mx-auto glow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-warning/60" />
                <div className="w-3 h-3 rounded-full bg-success/60" />
                <span className="text-xs text-muted-foreground ml-2 font-mono">bothost-terminal</span>
              </div>
              <div className="p-5 font-mono text-sm text-left space-y-2">
                <p><span className="text-primary">$</span> bothost deploy --session <span className="text-muted-foreground">eyJub2lz...</span></p>
                <p className="text-muted-foreground">⠋ Validating session ID...</p>
                <p className="text-muted-foreground">⠋ Provisioning container...</p>
                <p className="text-success">✓ Bot deployed successfully!</p>
                <p className="text-muted-foreground">  Status: <span className="text-success">● Running</span></p>
                <p className="text-muted-foreground">  Uptime: 0m 3s</p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Host Bots</h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">Built specifically for WhatsApp MD bot deployment with tools that actually matter.</p>
            </div>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 80}>
                <div className="surface rounded-xl p-6 surface-hover group h-full">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Deploy in 4 Steps</h2>
              <p className="text-muted-foreground text-lg">From signup to live bot in under 2 minutes.</p>
            </div>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-6">
            {steps.map((s, i) => (
              <ScrollReveal key={s.num} delay={i * 100} direction={i % 2 === 0 ? "left" : "right"}>
                <div className="flex gap-4 surface rounded-xl p-6">
                  <span className="text-3xl font-bold text-primary/30 font-mono">{s.num}</span>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{s.title}</h3>
                    <p className="text-muted-foreground text-sm">{s.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple Pricing</h2>
              <p className="text-muted-foreground text-lg">Start free, pay only when you need more.</p>
            </div>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <ScrollReveal direction="left">
              <div className="surface rounded-xl p-8 h-full">
                <div className="text-sm text-muted-foreground font-medium mb-2">STARTER</div>
                <div className="text-4xl font-bold mb-1">Free</div>
                <p className="text-muted-foreground text-sm mb-6">1 deployment included</p>
                <ul className="space-y-3 mb-8">
                  {["1 Bot Deployment", "Base64 Session Support", "Basic Dashboard", "Community Support"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register">
                  <Button variant="outline" className="w-full">Get Started</Button>
                </Link>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="right">
              <div className="surface rounded-xl p-8 border-primary/30 glow-sm relative h-full">
                <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  RECOMMENDED
                </div>
                <div className="text-sm text-primary font-medium mb-2">PRO</div>
                <div className="text-4xl font-bold mb-1">Pay as you go</div>
                <p className="text-muted-foreground text-sm mb-6">Via M-Pesa / Airtel Money</p>
                <ul className="space-y-3 mb-8">
                  {["Unlimited Deployments", "Priority Support", "Auto-Restart on Crash", "Real-time Logs", "Custom Bot Config"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register">
                  <Button variant="hero" className="w-full">Start Deploying</Button>
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Offers */}
      <section id="offers" className="py-24 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-5xl">
          <ScrollReveal>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-warning/30 bg-warning/5 text-warning text-sm font-medium mb-4">
                <Megaphone className="w-3.5 h-3.5" /> Hot Offers
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Deals & Promotions</h2>
              <p className="text-muted-foreground text-lg">Save more when you host with BOTHOST.</p>
            </div>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-5">
            {offers.map((o, i) => (
              <ScrollReveal key={o.title} delay={i * 100}>
                <div className="surface rounded-xl p-6 surface-hover relative overflow-hidden h-full">
                  <div className="absolute top-4 right-4 px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                    {o.tag}
                  </div>
                  <o.icon className="w-8 h-8 text-primary mb-4" />
                  <h3 className="font-semibold text-lg mb-2">{o.title}</h3>
                  <p className="text-muted-foreground text-sm">{o.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Payment */}
      <section id="payment" className="py-24 px-4">
        <div className="container mx-auto max-w-3xl">
          <ScrollReveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How to Pay</h2>
              <p className="text-muted-foreground text-lg">Send payment via M-Pesa or Airtel Money, then submit your details for approval.</p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <div className="surface rounded-xl p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/50">
                  <Phone className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Safaricom (M-Pesa)</p>
                    <p className="text-2xl font-mono font-bold text-primary">0116284050</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/50">
                  <Phone className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Airtel Money</p>
                    <p className="text-2xl font-mono font-bold text-primary">0105521300</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <CreditCard className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Account Name</p>
                  <p className="text-lg font-semibold text-primary">AKIDA RAJAB</p>
                </div>
              </div>
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold mb-3">After Payment:</h3>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><span className="text-primary font-bold">1.</span> Take a screenshot of your M-Pesa/Airtel confirmation</li>
                  <li className="flex items-start gap-2"><span className="text-primary font-bold">2.</span> Go to your dashboard and submit payment proof</li>
                  <li className="flex items-start gap-2"><span className="text-primary font-bold">3.</span> Enter your email and upload the screenshot</li>
                  <li className="flex items-start gap-2"><span className="text-primary font-bold">4.</span> Wait for admin approval (usually within 1-2 hours)</li>
                </ol>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Advert Banner */}
      <section className="py-16 px-4 bg-primary/5">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <div className="text-center">
              <Megaphone className="w-8 h-8 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Want to Advertise on BOTHOST?</h3>
              <p className="text-muted-foreground mb-4">Reach thousands of WhatsApp bot developers. Contact us for ad placement.</p>
              <a href="mailto:contact@bothost.com">
                <Button variant="outline" size="sm">
                  <Mail className="w-4 h-4 mr-1" /> Contact for Ads
                </Button>
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold">BOTHOST</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <a href="#payment" className="hover:text-foreground transition-colors">Payment</a>
              <Link to="/login" className="hover:text-foreground transition-colors">Login</Link>
            </div>
            <p className="text-xs text-muted-foreground">© 2026 BOTHOST. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
