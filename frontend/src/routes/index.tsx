import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Code2,
  Command,
  Copy,
  Database,
  ExternalLink,
  FileCode2,
  Flag,
  Gauge,
  GitBranch,
  Globe2,
  Layers3,
  Menu,
  Plus,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Terminal,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  featureFlagsApi,
  isValidRolloutPercentage,
  regionEndpoints,
  type Environment,
  type EvaluationResponse,
  type FeatureFlag,
} from "@/lib/feature-flags-api";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Overview · Flagship Control" },
      {
        name: "description",
        content: "Manage distributed feature flags, evaluate rollouts, and monitor service health.",
      },
      { property: "og:title", content: "Overview · Flagship Control" },
      {
        property: "og:description",
        content: "Manage distributed feature flags, evaluate rollouts, and monitor service health.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Section = "Overview" | "Feature Flags" | "Evaluation Playground" | "Regions" | "Monitoring" | "API Documentation";
type Health = { status: "idle" | "checking" | "healthy" | "unavailable" | "not-configured"; label?: string };

const navItems: { label: Section; icon: typeof Activity }[] = [
  { label: "Overview", icon: Layers3 },
  { label: "Feature Flags", icon: Flag },
  { label: "Evaluation Playground", icon: Terminal },
  { label: "Regions", icon: Globe2 },
  { label: "Monitoring", icon: Gauge },
  { label: "API Documentation", icon: BookOpen },
];

const demoFlags: FeatureFlag[] = [
  {
    key: "checkout.v2",
    name: "New checkout flow",
    description: "Redesigned checkout experience",
    enabled: true,
    percentage: 75,
    environment: "production",
    targetingRules: [],
    updatedAt: "2 min ago",
  },
  {
    key: "search.semantic",
    name: "Semantic search",
    description: "Vector-powered product discovery",
    enabled: true,
    percentage: 20,
    environment: "production",
    targetingRules: [],
    updatedAt: "18 min ago",
  },
  {
    key: "profile.refresh",
    name: "Profile refresh",
    description: "Updated profile and preferences UI",
    enabled: false,
    percentage: 0,
    environment: "staging",
    targetingRules: [],
    updatedAt: "1 hour ago",
  },
  {
    key: "billing.portal",
    name: "Billing portal",
    description: "Self-service billing management",
    enabled: true,
    percentage: 100,
    environment: "development",
    targetingRules: [],
    updatedAt: "3 hours ago",
  },
  {
    key: "onboarding.checklist",
    name: "Onboarding checklist",
    description: "Guided first-run experience",
    enabled: false,
    percentage: 0,
    environment: "staging",
    targetingRules: [],
    updatedAt: "Yesterday",
  },
];

const chartData = [
  { time: "00:00", requests: 18 },
  { time: "02:00", requests: 26 },
  { time: "04:00", requests: 19 },
  { time: "06:00", requests: 35 },
  { time: "08:00", requests: 47 },
  { time: "10:00", requests: 39 },
  { time: "12:00", requests: 63 },
  { time: "14:00", requests: 52 },
  { time: "16:00", requests: 75 },
  { time: "18:00", requests: 67 },
  { time: "20:00", requests: 91 },
  { time: "22:00", requests: 74 },
];

const apiEndpoints = [
  { method: "GET", path: "/health", description: "Check service health and connectivity.", example: "curl http://localhost:8080/health" },
  { method: "POST", path: "/api/v1/feature-flags", description: "Create a feature flag configuration.", example: 'curl -X POST http://localhost:8080/api/v1/feature-flags -H "Content-Type: application/json" -d \'{"key":"checkout.v2","enabled":true}\'' },
  { method: "GET", path: "/api/v1/feature-flags/{flag_key}", description: "Fetch one flag by its unique key.", example: "curl http://localhost:8080/api/v1/feature-flags/checkout.v2" },
  { method: "PATCH", path: "/api/v1/feature-flags/{flag_key}", description: "Update supported properties on a flag.", example: 'curl -X PATCH http://localhost:8080/api/v1/feature-flags/checkout.v2 -H "Content-Type: application/json" -d \'{"enabled":false}\'' },
  { method: "POST", path: "/api/v1/evaluate", description: "Evaluate a flag for an environment and optional user.", example: 'curl -X POST http://localhost:8080/api/v1/evaluate -H "Content-Type: application/json" -d \'{"flag_key":"checkout.v2","user_id":"user_123","environment":"production"}\'' },
];

function Dashboard() {
  const [section, setSection] = useState<Section>("Overview");
  const [environment, setEnvironment] = useState<Environment>("production");
  const [flags, setFlags] = useState(demoFlags);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [flagDialog, setFlagDialog] = useState(false);
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeatureFlag | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [health, setHealth] = useState<Health>({ status: "idle" });
  const [regionHealth, setRegionHealth] = useState<Record<string, Health>>({
    "Region A": { status: "idle" },
    "Region B": { status: "idle" },
  });
  const [apiError, setApiError] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [evaluationError, setEvaluationError] = useState("");
  const [evaluationBusy, setEvaluationBusy] = useState(false);
  const [flagKey, setFlagKey] = useState("checkout.v2");
  const [userId, setUserId] = useState("user_123");
  const [copyState, setCopyState] = useState("");

  useEffect(() => {
    let cancelled = false;
    featureFlagsApi
      .health()
      .then((result) => {
        if (!cancelled) setHealth({ status: "healthy", label: String(result["status"] ?? "healthy") });
      })
      .catch(() => {
        if (!cancelled) setHealth({ status: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredFlags = useMemo(
    () =>
      flags.filter((flag) => {
        const matchesSearch = `${flag.key} ${flag.name} ${flag.description}`
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesFilter = filter === "all" || (filter === "enabled" ? flag.enabled : !flag.enabled);
        const matchesEnvironment = flag.environment === environment || section !== "Feature Flags";
        return matchesSearch && matchesFilter && matchesEnvironment;
      }),
    [environment, filter, flags, search, section],
  );
  const enabledCount = flags.filter((flag) => flag.enabled).length;
  const disabledCount = flags.length - enabledCount;

  const checkRegion = async (name: string) => {
    const endpoint = name === "Region A" ? regionEndpoints.regionA : regionEndpoints.regionB;
    if (!endpoint) {
      setRegionHealth((current) => ({ ...current, [name]: { status: "not-configured" } }));
      return;
    }
    setRegionHealth((current) => ({ ...current, [name]: { status: "checking" } }));
    try {
      const result = await featureFlagsApi.health(endpoint);
      setRegionHealth((current) => ({
        ...current,
        [name]: { status: "healthy", label: String(result["status"] ?? "reachable") },
      }));
    } catch {
      setRegionHealth((current) => ({ ...current, [name]: { status: "unavailable" } }));
    }
  };

  const submitEvaluation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEvaluationBusy(true);
    setEvaluation(null);
    setEvaluationError("");
    try {
      const result = await featureFlagsApi.evaluate({
        flag_key: flagKey,
        ...(userId.trim() ? { user_id: userId.trim() } : {}),
        environment,
      });
      setEvaluation(result);
    } catch (error) {
      setEvaluationError(error instanceof Error ? error.message : "Evaluation request failed.");
    } finally {
      setEvaluationBusy(false);
    }
  };

  const saveFlag = async (flag: Omit<FeatureFlag, "updatedAt">, previousKey?: string) => {
    setApiError("");
    if (previousKey) {
      setFlags((current) =>
        current.map((item) =>
          item.key === previousKey ? { ...flag, updatedAt: "Just now" } : item,
        ),
      );
      try {
        await featureFlagsApi.update(previousKey, flag);
      } catch {
        setApiError("Saved in this preview only. The API could not be reached.");
      }
      return;
    }
    const nextFlag = { ...flag, updatedAt: "Just now" };
    setFlags((current) => [nextFlag, ...current]);
    try {
      const response = await featureFlagsApi.create(flag);
      setFlags((current) => current.map((item) => (item.key === flag.key ? { ...response, updatedAt: "Just now" } : item)));
    } catch {
      setApiError("Flag added to this preview only. The API could not be reached.");
    }
  };

  const toggleFlag = async (flag: FeatureFlag, enabled: boolean) => {
    setFlags((current) => current.map((item) => (item.key === flag.key ? { ...item, enabled, updatedAt: "Just now" } : item)));
    try {
      await featureFlagsApi.update(flag.key, { enabled });
    } catch {
      setApiError("Change shown in this preview only. The API could not be reached.");
    }
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState(key);
      window.setTimeout(() => setCopyState(""), 1600);
    } catch {
      setCopyState("");
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFlagDialog(true);
  };

  const openEdit = (flag: FeatureFlag) => {
    setEditing(flag);
    setFlagDialog(true);
  };

  const pageTitle: Record<Section, { title: string; description: string }> = {
    Overview: { title: "Overview", description: "A real-time view of your distributed feature flag service." },
    "Feature Flags": { title: "Feature flags", description: "Create, target, and roll out features across environments." },
    "Evaluation Playground": { title: "Evaluation playground", description: "Test flag evaluation for a user and environment." },
    Regions: { title: "Regions", description: "Inspect regional service connectivity and cache availability." },
    Monitoring: { title: "Monitoring", description: "Service signals and operational visibility." },
    "API Documentation": { title: "API reference", description: "Endpoints currently available in the connected service contract." },
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[68px] items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"><Command className="size-[17px]" /></div>
          <div className="min-w-0"><p className="text-[14px] font-semibold leading-5">Flagship</p><p className="text-[10px] tracking-[0.12em] text-sidebar-foreground/55">CONTROL PLANE</p></div>
          <Button aria-label="Close navigation" variant="ghost" size="icon" className="ml-auto text-sidebar-foreground lg:hidden" onClick={() => setMobileNav(false)}><X /></Button>
        </div>
        <div className="px-3 pt-6">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">Workspace</p>
          <div className="mb-5 flex items-center gap-2 rounded-md border border-sidebar-border px-2.5 py-2">
            <div className="flex size-6 items-center justify-center rounded bg-sidebar-accent text-sidebar-foreground"><Layers3 className="size-3.5" /></div>
            <span className="flex-1 text-xs font-medium">Acme workspace</span><ChevronDown className="size-3.5 text-sidebar-foreground/45" />
          </div>
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">Platform</p>
          <nav aria-label="Main navigation" className="space-y-1">
            {navItems.map(({ label, icon: Icon }) => (
              <button key={label} onClick={() => { setSection(label); setMobileNav(false); }} className={`flex h-9 w-full items-center gap-3 rounded px-2.5 text-left text-[13px] transition-colors ${section === label ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"}`}>
                <Icon className={`size-4 ${section === label ? "text-sidebar-primary" : "text-sidebar-foreground/55"}`} />
                <span className="flex-1">{label}</span>
                {label === "Feature Flags" && <span className="rounded bg-sidebar-border px-1.5 py-0.5 text-[10px] text-sidebar-foreground/75">{flags.length}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto border-t border-sidebar-border p-3">
          <div className="mb-3 rounded-md border border-sidebar-border p-3">
            <div className="flex items-center justify-between"><span className="text-[11px] font-medium">API connection</span><HealthDot health={health} /></div>
            <p className="mt-1 truncate font-mono text-[10px] text-sidebar-foreground/50">{featureFlagsApi.baseUrl}</p>
            <p className="mt-1 text-[10px] text-sidebar-foreground/45">{health.status === "healthy" ? "Service reachable" : "Local service"}</p>
          </div>
          <button onClick={() => setSection("API Documentation")} className="flex w-full items-center gap-2 rounded px-2 py-2 text-[12px] text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"><CircleHelp className="size-4" /> Help & documentation <ExternalLink className="ml-auto size-3" /></button>
          <div className="mt-2 flex items-center gap-2 border-t border-sidebar-border px-2 pt-3">
            <div className="flex size-7 items-center justify-center rounded-full bg-sidebar-accent text-[10px] font-semibold">KG</div><div><p className="text-[11px] font-medium">Kshitij Giri</p><p className="text-[10px] text-sidebar-foreground/45">Developer</p></div><Settings2 className="ml-auto size-4 text-sidebar-foreground/45" />
          </div>
        </div>
      </aside>
      {mobileNav && <button aria-label="Close navigation overlay" className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setMobileNav(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-7">
          <div className="flex items-center gap-3"><Button aria-label="Open navigation" variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)}><Menu /></Button><div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span>Acme workspace</span><span>/</span><span className="text-foreground">{section}</span></div></div>
          <div className="flex items-center gap-2 sm:gap-3"><div className="hidden items-center gap-2 rounded border border-border px-2.5 py-1.5 text-xs text-muted-foreground md:flex"><span className="size-1.5 rounded-full bg-emerald-500" />{health.status === "healthy" ? "API connected" : "API not connected"}</div><Select value={environment} onValueChange={(value) => setEnvironment(value as Environment)}><SelectTrigger className="h-8 w-[136px] bg-background text-xs"><span className="mr-1 size-1.5 rounded-full bg-primary" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="development">Development</SelectItem><SelectItem value="staging">Staging</SelectItem><SelectItem value="production">Production</SelectItem></SelectContent></Select><Button variant="outline" size="icon" aria-label="Help"><CircleHelp className="size-4" /></Button></div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-7 sm:px-7 sm:py-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5"><GitBranch className="size-3" /> {environment}</span><span>·</span><span>Last synced just now</span></div><h1 className="text-[25px] font-semibold leading-tight tracking-[-0.02em]">{pageTitle[section].title}</h1><p className="mt-1.5 text-[13px] text-muted-foreground">{pageTitle[section].description}</p></div>
            {(section === "Overview" || section === "Feature Flags") && <Button onClick={openCreate} className="h-9 rounded-md px-3 text-xs"><Plus className="size-4" /> New flag</Button>}
          </div>
          {apiError && <div role="status" className="mb-5 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700"><CircleHelp className="size-4 shrink-0" />{apiError}<Button onClick={() => setApiError("")} variant="ghost" size="icon" className="ml-auto size-7"><X className="size-3.5" /></Button></div>}
          {section === "Overview" && <Overview environment={environment} flags={flags} enabledCount={enabledCount} disabledCount={disabledCount} health={health} regionHealth={regionHealth} onRegionCheck={checkRegion} onNavigate={setSection} onCreate={openCreate} />}
          {section === "Feature Flags" && <FeatureFlags flags={filteredFlags} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} environment={environment} onToggle={toggleFlag} onEdit={openEdit} onDelete={setDeleteTarget} />}
          {section === "Evaluation Playground" && <EvaluationPlayground environment={environment} setEnvironment={setEnvironment} flagKey={flagKey} setFlagKey={setFlagKey} userId={userId} setUserId={setUserId} evaluation={evaluation} error={evaluationError} busy={evaluationBusy} onSubmit={submitEvaluation} />}
          {section === "Regions" && <Regions health={health} regionHealth={regionHealth} onCheck={checkRegion} />}
          {section === "Monitoring" && <Monitoring health={health} />}
          {section === "API Documentation" && <ApiDocumentation copyText={copyText} copyState={copyState} />}
          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-[10px] text-muted-foreground"><span>Flagship Control · Distributed Feature Flag Management System</span><span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-500" /> Service status <span className="text-border">|</span> v1.0.0</span></footer>
        </main>
      </div>
      <FlagDialog open={flagDialog} onOpenChange={setFlagDialog} flag={editing} onSave={saveFlag} />
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Remove this flag?</DialogTitle><DialogDescription>{deleteTarget?.key} will be hidden from this preview. A delete endpoint is not configured, so this change will not be sent to the API.</DialogDescription></DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2"><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" onClick={() => { if (deleteTarget) setFlags((current) => current.filter((item) => item.key !== deleteTarget.key)); setDeleteTarget(null); }}>Remove from preview</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HealthDot({ health }: { health: Health }) {
  const color = health.status === "healthy" ? "bg-emerald-500" : health.status === "checking" ? "bg-amber-500 animate-pulse" : health.status === "unavailable" ? "bg-destructive" : "bg-muted-foreground/40";
  return <span aria-label={`Health ${health.status}`} className={`inline-block size-2 rounded-full ${color}`} />;
}

function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-[14px] font-semibold">{title}</h2>{action}</div>;
}

function Overview({ environment, flags, enabledCount, disabledCount, health, regionHealth, onRegionCheck, onNavigate, onCreate }: {
  environment: Environment; flags: FeatureFlag[]; enabledCount: number; disabledCount: number; health: Health;
  regionHealth: Record<string, Health>; onRegionCheck: (region: string) => void; onNavigate: (section: Section) => void; onCreate: () => void;
}) {
  const metricCards = [
    { label: "Total flags", value: String(flags.length), detail: "In this preview", icon: Flag, color: "text-primary", change: "—" },
    { label: "Enabled", value: String(enabledCount), detail: "Across environments", icon: Zap, color: "text-emerald-600", change: `${flags.length ? Math.round((enabledCount / flags.length) * 100) : 0}%` },
    { label: "Disabled", value: String(disabledCount), detail: "Across environments", icon: ShieldCheck, color: "text-muted-foreground", change: "—" },
  ];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3"><div className="flex items-center gap-3"><div className="flex size-8 items-center justify-center rounded bg-primary/10 text-primary"><Layers3 className="size-4" /></div><div><p className="text-xs font-medium">Current environment</p><p className="text-[11px] text-muted-foreground">Active configuration scope</p></div></div><div className="flex items-center gap-2 rounded border border-border px-2.5 py-1.5 text-xs font-medium capitalize"><span className="size-1.5 rounded-full bg-primary" />{environment}</div></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{metricCards.map(({ label, value, detail, icon: Icon, color, change }) => <div key={label} className="rounded-md border border-border bg-card p-4"><div className="flex items-center justify-between"><span className="text-[12px] text-muted-foreground">{label}</span><Icon className={`size-4 ${color}`} /></div><div className="mt-4 flex items-end justify-between"><div><span className="text-[26px] font-semibold leading-none">{value}</span><p className="mt-2 text-[10px] text-muted-foreground">{detail}</p></div><span className="text-[11px] text-muted-foreground">{change}</span></div></div>)}</div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(290px,1fr)]">
      <section className="min-w-0 rounded-md border border-border bg-card p-4 sm:p-5"><SectionHeading title="Request activity" action={<Badge variant="outline" className="rounded px-2 text-[10px] font-normal">Demo visualization</Badge>} /><div className="mb-4 flex items-center gap-2 text-[11px] text-muted-foreground"><span className="size-2 rounded-sm bg-primary" /> Illustrative requests · not live service data</div><div className="h-[220px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 6, left: -14, bottom: 0 }}><defs><linearGradient id="requestFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} /><stop offset="95%" stopColor="var(--primary)" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" /><XAxis dataKey="time" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} /><YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${value}k`} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--popover-foreground)", fontSize: 11 }} formatter={(value) => [`${value}k requests`, "Volume"]} /><Area type="monotone" dataKey="requests" stroke="var(--primary)" strokeWidth={2} fill="url(#requestFill)" /></AreaChart></ResponsiveContainer></div><div className="mt-2 flex justify-between border-t border-border pt-3 text-[10px] text-muted-foreground"><span>24-hour sample window</span><span>Connect API metrics for live data</span></div></section>
      <section className="rounded-md border border-border bg-card p-4 sm:p-5"><SectionHeading title="Regional health" action={<Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onNavigate("Regions")}>View regions <ArrowUpRight className="size-3" /></Button>} /><p className="mb-4 text-[11px] text-muted-foreground">Backend availability and cache status are reported separately.</p><div className="space-y-3">{["Region A", "Region B"].map((region, index) => <div key={region} className="rounded border border-border p-3"><div className="flex items-center gap-2"><div className="flex size-7 items-center justify-center rounded bg-muted text-muted-foreground"><Globe2 className="size-3.5" /></div><div className="flex-1"><p className="text-[12px] font-medium">{region}</p><p className="text-[10px] text-muted-foreground">{index === 0 ? "us-east-1 · Virginia" : "eu-west-1 · Ireland"}</p></div><StatusBadge health={regionHealth[region] ?? { status: "idle" }} /></div><div className="mt-3 grid grid-cols-2 border-t border-border pt-2.5"><p className="text-[10px] text-muted-foreground">Backend <span className="ml-1 text-foreground">{health.status === "healthy" ? "Connected" : health.status === "unavailable" ? "Unreachable" : "Not verified"}</span></p><p className="text-right text-[10px] text-muted-foreground">Redis <span className="ml-1">Not reported</span></p></div></div>)}</div><Button variant="outline" className="mt-3 h-8 w-full text-[11px]" onClick={() => { onRegionCheck("Region A"); onRegionCheck("Region B"); }}>Test both connections <Activity className="size-3.5" /></Button></section>
    </div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(290px,1fr)]">
      <section className="rounded-md border border-border bg-card p-4 sm:p-5"><SectionHeading title="Recent activity" action={<span className="text-[10px] text-muted-foreground">Preview activity</span>} /><div className="divide-y divide-border">{[
        { title: "checkout.v2 rollout increased", detail: "Production · 50% → 75%", time: "2 min ago", icon: ArrowUpRight },
        { title: "search.semantic enabled", detail: "Production · Flag activated", time: "18 min ago", icon: Zap },
        { title: "profile.refresh updated", detail: "Staging · Targeting rules changed", time: "1 hour ago", icon: Settings2 },
      ].map(({ title, detail, time, icon: Icon }) => <div key={title} className="flex items-center gap-3 py-3"><div className="flex size-8 items-center justify-center rounded bg-muted text-muted-foreground"><Icon className="size-3.5" /></div><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">{title}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{detail}</p></div><span className="shrink-0 text-[10px] text-muted-foreground">{time}</span></div>)}</div></section>
      <section className="rounded-md border border-border bg-card p-4 sm:p-5"><SectionHeading title="Quick actions" /><div className="space-y-2"><button onClick={onCreate} className="group flex w-full items-center gap-3 rounded border border-border p-3 text-left transition-colors hover:bg-muted/50"><div className="flex size-8 items-center justify-center rounded bg-primary/10 text-primary"><Plus className="size-4" /></div><span className="flex-1"><span className="block text-[12px] font-medium">Create a feature flag</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Ship a controlled change</span></span><ArrowUpRight className="size-3.5 text-muted-foreground" /></button><button onClick={() => onNavigate("Evaluation Playground")} className="group flex w-full items-center gap-3 rounded border border-border p-3 text-left transition-colors hover:bg-muted/50"><div className="flex size-8 items-center justify-center rounded bg-muted text-muted-foreground"><Terminal className="size-4" /></div><span className="flex-1"><span className="block text-[12px] font-medium">Evaluate a flag</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Test user targeting</span></span><ArrowUpRight className="size-3.5 text-muted-foreground" /></button></div><div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[10px] text-muted-foreground"><Clock3 className="size-3.5" /> Updated just now · {flags.length} preview flags</div></section>
    </div>
  </div>;
}

function StatusBadge({ health }: { health: Health }) {
  const label = health.status === "healthy" ? "Connected" : health.status === "unavailable" ? "Unavailable" : health.status === "checking" ? "Checking" : health.status === "not-configured" ? "Not configured" : "Not tested";
  const styles = health.status === "healthy" ? "border-emerald-600/20 bg-emerald-500/10 text-emerald-700" : health.status === "unavailable" ? "border-destructive/20 bg-destructive/5 text-destructive" : health.status === "checking" ? "border-amber-500/20 bg-amber-500/10 text-amber-700" : "border-border bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] ${styles}`}><HealthDot health={health} />{label}</span>;
}

function FeatureFlags({ flags, search, setSearch, filter, setFilter, environment, onToggle, onEdit, onDelete }: {
  flags: FeatureFlag[]; search: string; setSearch: (value: string) => void; filter: string; setFilter: (value: string) => void; environment: Environment;
  onToggle: (flag: FeatureFlag, enabled: boolean) => void; onEdit: (flag: FeatureFlag) => void; onDelete: (flag: FeatureFlag) => void;
}) {
  return <section className="overflow-hidden rounded-md border border-border bg-card">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div><h2 className="text-[14px] font-semibold">All feature flags</h2><p className="mt-1 text-[11px] text-muted-foreground">Preview rows only · lists will connect when a backend endpoint is available.</p></div><Badge variant="outline" className="rounded text-[10px] font-normal">{flags.length} flags</Badge></div>
    <div className="flex flex-wrap items-center gap-2 border-b border-border p-3"><div className="relative min-w-[190px] flex-1 sm:max-w-[320px]"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search flags" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or key..." className="h-8 pl-8 text-xs" /></div><Select value={filter} onValueChange={setFilter}><SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="enabled">Enabled</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent></Select><span className="hidden h-5 border-l border-border sm:block" /><span className="text-[11px] text-muted-foreground">Environment: <span className="font-medium capitalize text-foreground">{environment}</span></span></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead><tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground"><th className="px-4 py-3 font-medium">Flag</th><th className="px-3 py-3 font-medium">Environment</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Rollout</th><th className="px-3 py-3 font-medium">Last updated</th><th className="px-3 py-3 text-right font-medium">Actions</th></tr></thead><tbody className="divide-y divide-border">{flags.map((flag) => <tr key={flag.key} className="transition-colors hover:bg-muted/30"><td className="px-4 py-3"><button className="text-left" onClick={() => onEdit(flag)}><span className="block text-[12px] font-medium">{flag.name}</span><span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{flag.key}</span></button></td><td className="px-3 py-3"><span className="rounded bg-muted px-2 py-1 text-[10px] capitalize text-muted-foreground">{flag.environment}</span></td><td className="px-3 py-3"><div className="flex items-center gap-2"><Switch aria-label={`${flag.enabled ? "Disable" : "Enable"} ${flag.name}`} checked={flag.enabled} onCheckedChange={(checked) => onToggle(flag, checked)} /><span className={`text-[11px] ${flag.enabled ? "text-emerald-700" : "text-muted-foreground"}`}>{flag.enabled ? "Enabled" : "Disabled"}</span></div></td><td className="px-3 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-[72px] overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${flag.percentage}%` }} /></div><span className="text-[11px] tabular-nums">{flag.percentage}%</span></div></td><td className="px-3 py-3 text-[11px] text-muted-foreground">{flag.updatedAt}</td><td className="px-3 py-3"><div className="flex justify-end gap-1"><Button aria-label={`Edit ${flag.name}`} title="Edit flag" onClick={() => onEdit(flag)} variant="ghost" size="icon" className="size-7"><Settings2 className="size-3.5" /></Button><Button aria-label={`Delete ${flag.name}`} title="Delete flag" onClick={() => onDelete(flag)} variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></Button></div></td></tr>)}</tbody></table></div>
    {flags.length === 0 && <div className="px-4 py-14 text-center"><div className="mx-auto flex size-10 items-center justify-center rounded bg-muted text-muted-foreground"><Search className="size-4" /></div><p className="mt-3 text-xs font-medium">No flags found</p><p className="mt-1 text-[11px] text-muted-foreground">Try another search or status filter.</p></div>}
    <div className="flex flex-wrap justify-between gap-2 border-t border-border px-4 py-3 text-[10px] text-muted-foreground"><span>Showing {flags.length} preview flags</span><span>GET list and DELETE routes not configured</span></div>
  </section>;
}

function FlagDialog({ open, onOpenChange, flag, onSave }: {
  open: boolean; onOpenChange: (open: boolean) => void; flag: FeatureFlag | null; onSave: (flag: Omit<FeatureFlag, "updatedAt">, previousKey?: string) => Promise<void> | void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [percentage, setPercentage] = useState("0");
  const [environment, setEnvironment] = useState<Environment>("development");
  const [rulesText, setRulesText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setKey(flag?.key ?? "");
    setName(flag?.name ?? "");
    setDescription(flag?.description ?? "");
    setEnabled(flag?.enabled ?? false);
    setPercentage(String(flag?.percentage ?? 0));
    setEnvironment(flag?.environment ?? "development");
    setRulesText(flag?.targetingRules.map((rule) => `${rule.attribute} ${rule.operator} ${rule.value}`).join("\n") ?? "");
    setError("");
  }, [flag, open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedPercentage = Number(percentage);
    if (!isValidRolloutPercentage(parsedPercentage)) {
      setError("Rollout must be a whole number from 0 to 100.");
      return;
    }
    const targetingRules = rulesText.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [attribute = "", operator = "equals", ...rest] = line.split(" ");
      const normalizedOperator = ["equals", "contains", "starts_with"].includes(operator) ? operator as "equals" | "contains" | "starts_with" : "equals";
      return { attribute, operator: normalizedOperator, value: rest.join(" ") };
    }).filter((rule) => rule.attribute && rule.value);
    await onSave({ key: key.trim(), name: name.trim(), description: description.trim(), enabled, percentage: parsedPercentage, environment, targetingRules }, flag?.key);
    onOpenChange(false);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]"><form onSubmit={submit} className="space-y-5"><DialogHeader><DialogTitle>{flag ? "Edit feature flag" : "Create feature flag"}</DialogTitle><DialogDescription>Configure the flag properties and rollout behavior.</DialogDescription></DialogHeader>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="flag-key">Flag key</Label><Input id="flag-key" required disabled={Boolean(flag)} value={key} onChange={(event) => setKey(event.target.value)} placeholder="checkout.new-flow" className="font-mono text-xs" /></div><div className="space-y-2"><Label htmlFor="flag-name">Name</Label><Input id="flag-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="New checkout flow" /></div></div>
    <div className="space-y-2"><Label htmlFor="flag-description">Description</Label><Textarea id="flag-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What does this flag control?" className="min-h-[72px] resize-y text-sm" /></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Environment</Label><Select value={environment} onValueChange={(value) => setEnvironment(value as Environment)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="development">Development</SelectItem><SelectItem value="staging">Staging</SelectItem><SelectItem value="production">Production</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="flag-percentage">Rollout percentage</Label><div className="relative"><Input id="flag-percentage" type="number" min="0" max="100" step="1" required value={percentage} onChange={(event) => setPercentage(event.target.value)} className="pr-8" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span></div></div></div>
    <div className="flex items-center justify-between rounded border border-border p-3"><div><Label htmlFor="flag-enabled" className="cursor-pointer text-xs">Flag enabled</Label><p className="mt-1 text-[10px] text-muted-foreground">Allow eligible users to receive this feature.</p></div><Switch id="flag-enabled" checked={enabled} onCheckedChange={setEnabled} /></div>
    <div className="space-y-2"><Label htmlFor="targeting-rules">Targeting rules</Label><Textarea id="targeting-rules" value={rulesText} onChange={(event) => setRulesText(event.target.value)} placeholder={'plan equals enterprise\nregion equals us-east'} className="min-h-[78px] resize-y font-mono text-xs" /><p className="text-[10px] text-muted-foreground">One rule per line: attribute operator value. Supported operators: equals, contains, starts_with.</p></div>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <DialogFooter className="gap-2 sm:gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">{flag ? "Save changes" : "Create flag"}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}

function EvaluationPlayground({ environment, setEnvironment, flagKey, setFlagKey, userId, setUserId, evaluation, error, busy, onSubmit }: {
  environment: Environment; setEnvironment: (value: Environment) => void; flagKey: string; setFlagKey: (value: string) => void; userId: string; setUserId: (value: string) => void;
  evaluation: EvaluationResponse | null; error: string; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"><section className="rounded-md border border-border bg-card p-4 sm:p-5"><SectionHeading title="Evaluate a feature flag" /><p className="mb-5 text-[11px] text-muted-foreground">Run the same evaluation request your application would send.</p><form onSubmit={onSubmit} className="space-y-4"><div className="space-y-2"><Label htmlFor="eval-flag-key">Feature flag key</Label><Input id="eval-flag-key" required value={flagKey} onChange={(event) => setFlagKey(event.target.value)} placeholder="checkout.v2" className="font-mono text-xs" /></div><div className="space-y-2"><Label htmlFor="eval-user-id">User identifier <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="eval-user-id" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="user_123" className="font-mono text-xs" /></div><div className="space-y-2"><Label>Environment</Label><Select value={environment} onValueChange={(value) => setEnvironment(value as Environment)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="development">Development</SelectItem><SelectItem value="staging">Staging</SelectItem><SelectItem value="production">Production</SelectItem></SelectContent></Select></div><Button type="submit" disabled={busy} className="w-full sm:w-auto"><Zap className="size-4" />{busy ? "Evaluating..." : "Evaluate flag"}</Button></form></section><section className="rounded-md border border-border bg-card p-4 sm:p-5"><SectionHeading title="Evaluation result" action={<Badge variant="outline" className="rounded text-[10px] font-normal">Live API</Badge>} />{evaluation ? <div className="space-y-4"><div className={`flex items-center gap-3 rounded-md border p-4 ${evaluation.enabled ? "border-emerald-600/25 bg-emerald-500/5" : "border-border bg-muted/40"}`}><div className={`flex size-9 items-center justify-center rounded ${evaluation.enabled ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{evaluation.enabled ? <Check className="size-5" /> : <X className="size-5" />}</div><div><p className={`text-[14px] font-semibold ${evaluation.enabled ? "text-emerald-700" : "text-foreground"}`}>{evaluation.enabled ? "ENABLED" : "DISABLED"}</p><p className="mt-0.5 text-[10px] text-muted-foreground">Flag evaluation completed</p></div></div><div className="space-y-2 rounded border border-border p-3"><ResultLine label="Reason" value={String(evaluation.reason ?? "Not returned by API")} /><ResultLine label="Region" value={String(evaluation.region ?? "Not returned by API")} /><ResultLine label="Flag key" value={flagKey} /></div><details className="rounded border border-border"><summary className="cursor-pointer px-3 py-2 text-[11px] text-muted-foreground">Raw response</summary><pre className="overflow-auto border-t border-border p-3 text-[10px]">{JSON.stringify(evaluation, null, 2)}</pre></details></div> : error ? <div role="alert" className="rounded border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive"><p className="font-medium">Could not evaluate</p><p className="mt-1 break-words text-[11px]">{error}</p></div> : <div className="flex min-h-[260px] flex-col items-center justify-center rounded border border-dashed border-border px-5 text-center"><div className="flex size-10 items-center justify-center rounded bg-muted text-muted-foreground"><Terminal className="size-4" /></div><p className="mt-3 text-xs font-medium">Ready to evaluate</p><p className="mt-1 max-w-[250px] text-[11px] text-muted-foreground">Results will include the backend reason and region when the API returns them.</p></div>}</section><section className="xl:col-span-2 rounded-md border border-border bg-card p-4 sm:p-5"><SectionHeading title="Request preview" /><pre className="overflow-auto rounded bg-muted/60 p-3 text-[11px] leading-5 text-muted-foreground">{JSON.stringify({ flag_key: flagKey || "<flag_key>", ...(userId.trim() ? { user_id: userId.trim() } : {}), environment }, null, 2)}</pre></section></div>;
}

function ResultLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 text-[11px]"><span className="text-muted-foreground">{label}</span><span className="max-w-[65%] truncate font-medium">{value}</span></div>;
}

function Regions({ health, regionHealth, onCheck }: { health: Health; regionHealth: Record<string, Health>; onCheck: (region: string) => void }) {
  return <div className="space-y-5"><div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-4"><div className="flex size-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary"><Server className="size-4" /></div><div><p className="text-xs font-medium">Backend and cache signals are separate</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">The health endpoint verifies backend reachability. Redis health is not included in the known API response and remains unavailable until the service reports it.</p></div></div><div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{[
    { name: "Region A", location: "us-east-1", city: "Virginia, United States", endpoint: regionEndpoints.regionA },
    { name: "Region B", location: "eu-west-1", city: "Ireland, Europe", endpoint: regionEndpoints.regionB || "Not configured" },
  ].map((region) => { const regionStatus = regionHealth[region.name] ?? { status: "idle" as const }; return <section key={region.name} className="rounded-md border border-border bg-card p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded bg-muted text-muted-foreground"><Globe2 className="size-4" /></div><div><h2 className="text-[14px] font-semibold">{region.name}</h2><p className="mt-0.5 text-[11px] text-muted-foreground">{region.location} · {region.city}</p></div></div><StatusBadge health={regionStatus} /></div><div className="mt-5 space-y-3 border-t border-border pt-4"><div><p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Region endpoint</p><p className="break-all rounded bg-muted/50 px-2.5 py-2 font-mono text-[11px]">{region.endpoint}</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded border border-border p-3"><div className="flex items-center gap-2"><Server className="size-3.5 text-muted-foreground" /><span className="text-[11px] font-medium">Backend health</span></div><p className="mt-2 text-[11px] text-muted-foreground">{region.name === "Region B" && !regionEndpoints.regionB ? "Endpoint not configured" : regionStatus.status === "healthy" ? `Healthy · ${regionStatus.label ?? "reachable"}` : regionStatus.status === "unavailable" ? "Unreachable" : "Not verified"}</p></div><div className="rounded border border-border p-3"><div className="flex items-center gap-2"><Database className="size-3.5 text-muted-foreground" /><span className="text-[11px] font-medium">Redis health</span></div><p className="mt-2 text-[11px] text-muted-foreground">Not reported by API</p></div></div><Button variant="outline" className="w-full" disabled={regionStatus.status === "checking" || (region.name === "Region B" && !regionEndpoints.regionB)} onClick={() => onCheck(region.name)}><Activity className="size-4" />{regionStatus.status === "checking" ? "Testing connection..." : region.name === "Region B" && !regionEndpoints.regionB ? "Endpoint not configured" : "Test connection"}</Button></div></section>; })}</div></div>;
}

function Monitoring({ health }: { health: Health }) {
  type MetricPoint = {
    time: string;
    requests: number;
  };

  type PrometheusResult = {
    metric?: Record<string, string>;
    value?: [number, string];
    values?: [number, string][];
  };

  type PrometheusResponse = {
    status: string;
    data?: {
      resultType: string;
      result: PrometheusResult[];
    };
    error?: string;
  };

  type MetricsData = {
    requests: number;
    latency: number | null;
    errors: number;
    errorRate: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    chart: MetricPoint[];
    updatedAt: string;
  };

  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsError, setMetricsError] = useState("");

  const queryPrometheus = async (
    query: string,
    range = false,
  ): Promise<PrometheusResult[]> => {
    const endpoint = range
      ? "/prometheus/api/v1/query_range"
      : "/prometheus/api/v1/query";

    const params = new URLSearchParams({
      query,
    });

    if (range) {
      const end = Math.floor(Date.now() / 1000);
      const start = end - 60 * 60;

      params.set("start", String(start));
      params.set("end", String(end));
      params.set("step", "300");
    }

    const response = await fetch(`${endpoint}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Prometheus returned HTTP ${response.status}`);
    }

    const result =
      (await response.json()) as PrometheusResponse;

    if (result.status !== "success") {
      throw new Error(result.error || "Prometheus query failed");
    }

    return result.data?.result ?? [];
  };

  const getMetricValue = (
    result: PrometheusResult[],
  ): number => {
    if (!result.length || !result[0].value) {
      return 0;
    }

    return Number(result[0].value[1]) || 0;
  };

  const refreshMetrics = async () => {
    try {
      setMetricsError("");

      const [
        requestResult,
        latencyResult,
        errorResult,
        cacheHitResult,
        cacheMissResult,
        chartResult,
      ] = await Promise.all([
        queryPrometheus(
          "sum(rate(feature_flag_http_requests_total[5m]))",
        ),
        queryPrometheus(
          "histogram_quantile(0.95, sum by (le) (rate(feature_flag_request_latency_seconds_bucket[5m])))",
        ),
        queryPrometheus(
          "sum(rate(feature_flag_http_errors_total[5m]))",
        ),
        queryPrometheus(
          "sum(feature_flag_redis_cache_hits_total)",
        ),
        queryPrometheus(
          "sum(feature_flag_redis_cache_misses_total)",
        ),
        queryPrometheus(
          "sum(rate(feature_flag_http_requests_total[5m]))",
          true,
        ),
      ]);

      const requests = getMetricValue(requestResult);
      const latencyValue =
        latencyResult.length && latencyResult[0].value
          ? Number(latencyResult[0].value[1])
          : null;

      const errors = getMetricValue(errorResult);
      const cacheHits = getMetricValue(cacheHitResult);
      const cacheMisses = getMetricValue(cacheMissResult);

      const errorRate =
        requests > 0 ? (errors / requests) * 100 : 0;

      const totalCacheRequests = cacheHits + cacheMisses;

      const cacheHitRate =
        totalCacheRequests > 0
          ? (cacheHits / totalCacheRequests) * 100
          : 0;

      const chart: MetricPoint[] = (
        chartResult[0]?.values ?? []
      ).map(([timestamp, value]) => ({
        time: new Date(timestamp * 1000).toLocaleTimeString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit",
          },
        ),
        requests: Number(value) || 0,
      }));

      setMetrics({
        requests,
        latency:
          latencyValue !== null && Number.isFinite(latencyValue)
            ? latencyValue * 1000
            : null,
        errors,
        errorRate,
        cacheHits,
        cacheMisses,
        cacheHitRate,
        chart,
        updatedAt: new Date().toLocaleTimeString(),
      });
    } catch (error) {
      setMetricsError(
        error instanceof Error
          ? error.message
          : "Unable to fetch Prometheus metrics.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMetrics();

    const interval = window.setInterval(() => {
      refreshMetrics();
    }, 15000);

    return () => window.clearInterval(interval);
  }, []);

  const metricCards = [
    {
      name: "Request volume",
      value: metrics
        ? `${metrics.requests.toFixed(2)}/s`
        : "Loading...",
      description: "Requests per second · Last 5 minutes",
      icon: Activity,
    },
    {
      name: "Response latency",
      value:
        metrics?.latency !== null && metrics?.latency !== undefined
          ? `${metrics.latency.toFixed(2)} ms`
          : metrics
            ? "No data"
            : "Loading...",
      description: "95th percentile response time",
      icon: Gauge,
    },
    {
      name: "Error rate",
      value: metrics
        ? `${metrics.errorRate.toFixed(2)}%`
        : "Loading...",
      description: "Percentage of failed requests",
      icon: ArrowDownRight,
    },
    {
      name: "Cache activity",
      value: metrics
        ? `${metrics.cacheHitRate.toFixed(1)}%`
        : "Loading...",
      description: "Redis cache hit rate",
      icon: Database,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium">
            Live Prometheus monitoring
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Automatically refreshes every 15 seconds.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            refreshMetrics();
          }}
        >
          <Activity className="size-3.5" />
          {loading ? "Refreshing..." : "Refresh metrics"}
        </Button>
      </div>

      {metricsError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
        >
          Could not load monitoring data: {metricsError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(
          ({ name, value, description, icon: Icon }) => (
            <div
              key={name}
              className="rounded-md border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium">
                  {name}
                </span>
                <Icon className="size-4 text-muted-foreground" />
              </div>

              <div className="mt-5 text-[22px] font-semibold tabular-nums">
                {value}
              </div>

              <p className="mt-1 text-[10px] text-muted-foreground">
                {description}
              </p>
            </div>
          ),
        )}
      </div>

      <section className="rounded-md border border-border bg-card p-4 sm:p-5">
        <SectionHeading
          title="Service health"
          action={<StatusBadge health={health} />}
        />

        <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Backend
            </p>
            <p className="mt-1 text-xs font-medium">
              {health.status === "healthy"
                ? "Reachable"
                : health.status === "unavailable"
                  ? "Unavailable"
                  : "Not verified"}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Redis cache
            </p>
            <p className="mt-1 text-xs font-medium">
              {metrics
                ? `${metrics.cacheHits.toLocaleString()} hits · ${metrics.cacheMisses.toLocaleString()} misses`
                : "Waiting for metrics"}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Metrics source
            </p>
            <p className="mt-1 text-xs font-medium text-emerald-700">
              Prometheus
            </p>
          </div>
        </div>

        {metrics && (
          <p className="mt-4 border-t border-border pt-3 text-[10px] text-muted-foreground">
            Last updated: {metrics.updatedAt}
          </p>
        )}
      </section>

      <section className="rounded-md border border-border bg-card p-4 sm:p-5">
        <SectionHeading
          title="Request activity"
          action={
            <Badge
              variant="outline"
              className="rounded text-[10px] font-normal"
            >
              Live data · 1 hour
            </Badge>
          }
        />

        <p className="mb-4 text-[11px] text-muted-foreground">
          Actual request rate collected from both backend regions
          through Prometheus.
        </p>

        <div className="h-[260px] w-full">
          {metrics?.chart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={metrics.chart}
                margin={{
                  top: 8,
                  right: 8,
                  left: -14,
                  bottom: 0,
                }}
              >
                <defs>
                  <linearGradient
                    id="monitorLiveFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--primary)"
                      stopOpacity={0.16}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--primary)"
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeDasharray="3 5"
                />

                <XAxis
                  dataKey="time"
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                  }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />

                <YAxis
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) =>
                    value.toFixed(2)
                  }
                />

                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--popover-foreground)",
                    fontSize: 11,
                  }}
                  formatter={(value) => [
                    `${Number(value).toFixed(3)} requests/sec`,
                    "Request rate",
                  ]}
                />

                <Area
                  type="monotone"
                  dataKey="requests"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#monitorLiveFill)"
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded border border-dashed border-border text-center">
              <Activity className="size-6 text-muted-foreground" />

              <p className="mt-3 text-xs font-medium">
                {loading
                  ? "Loading request activity..."
                  : "No request activity available"}
              </p>

              <p className="mt-1 max-w-[280px] text-[11px] text-muted-foreground">
                Generate some API requests and wait for Prometheus
                to collect the metrics.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ApiDocumentation({ copyText, copyState }: { copyText: (text: string, key: string) => void; copyState: string }) {
  return <div className="space-y-5"><div className="flex items-start gap-3 rounded-md border border-border bg-card p-4"><div className="flex size-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary"><Code2 className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-medium">Base URL</p><div className="mt-1 flex flex-wrap items-center gap-2"><code className="break-all text-[11px] text-muted-foreground">{featureFlagsApi.baseUrl}</code><Button variant="ghost" size="icon" className="size-6" aria-label="Copy API base URL" onClick={() => copyText(featureFlagsApi.baseUrl, "base")}><Copy className="size-3" /></Button>{copyState === "base" && <span className="text-[10px] text-emerald-700">Copied</span>}</div></div><Badge variant="outline" className="rounded text-[10px] font-normal">FastAPI</Badge></div><div className="space-y-3">{apiEndpoints.map((endpoint) => <section key={`${endpoint.method}${endpoint.path}`} className="rounded-md border border-border bg-card"><div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3"><span className={`min-w-[48px] rounded px-1.5 py-1 text-center font-mono text-[9px] font-semibold ${endpoint.method === "GET" ? "bg-emerald-500/10 text-emerald-700" : endpoint.method === "POST" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-700"}`}>{endpoint.method}</span><code className="break-all font-mono text-[11px] font-medium">{endpoint.path}</code><Button aria-label={`Copy ${endpoint.method} ${endpoint.path} example`} variant="ghost" size="icon" className="ml-auto size-7 shrink-0" onClick={() => copyText(endpoint.example, endpoint.path)}>{copyState === endpoint.path ? <Check className="size-3.5 text-emerald-700" /> : <Copy className="size-3.5" />}</Button></div><div className="px-4 py-3"><p className="text-[11px] text-muted-foreground">{endpoint.description}</p><div className="mt-3 overflow-x-auto rounded bg-muted/50 p-3"><div className="mb-1 flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-muted-foreground"><FileCode2 className="size-3" /> Example request</div><pre className="min-w-max font-mono text-[10px] leading-5 text-foreground/80">{endpoint.example}</pre></div></div></section>)}</div><div className="flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] text-amber-800"><CircleHelp className="mt-0.5 size-3.5 shrink-0" /><span>Flag listing and deletion are intentionally not included. Connect these actions only after the corresponding service routes are verified.</span></div></div>;
}