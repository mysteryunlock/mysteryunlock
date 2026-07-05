import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
} from "recharts";
import {
  BarChart3,
  Bell,
  Gift,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Palette,
  Send,
  Settings as SettingsIcon,
  ShieldCheck,
  UserCircle2,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { FoundationCard } from "@/components/foundation/cards/Card";
import { StatCard } from "@/components/foundation/cards/StatCard";
import { SectionContainer } from "@/components/foundation/layout/SectionContainer";
import { FoundationBadge } from "@/components/foundation/feedback/Badge";
import { PrimaryButton } from "@/components/foundation/buttons/PrimaryButton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type TabId = "dashboard" | "campaigns" | "customers" | "analytics" | "messages" | "settings";

const NAV_ITEMS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "customers", label: "Customers", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

const DASHBOARD_STATS = [
  { label: "Total Customers", value: "2,480", trend: "+12% this month", trendDirection: "up" as const, icon: <Users className="size-4" /> },
  { label: "Campaigns", value: "6 Active", trend: "2 launching soon", trendDirection: "neutral" as const, icon: <Megaphone className="size-4" /> },
  { label: "Rewards Claimed", value: "1,204", trend: "+8% this month", trendDirection: "up" as const, icon: <Gift className="size-4" /> },
  { label: "Revenue Growth", value: "+18%", trend: "vs last quarter", trendDirection: "up" as const, icon: <BarChart3 className="size-4" /> },
];

const REWARD_DISTRIBUTION = [
  { label: "10% Off Voucher", pct: 42 },
  { label: "Free Add-on", pct: 27 },
  { label: "Rs.500 Cashback", pct: 18 },
  { label: "Mystery Gift", pct: 13 },
];

const CUSTOMERS_SAMPLE = [
  { name: "Anisha Rai", membership: "Gold", visits: 24, rewards: 8 },
  { name: "Bikash Shrestha", membership: "Silver", visits: 12, rewards: 4 },
  { name: "Priya Karki", membership: "Gold", visits: 31, rewards: 11 },
  { name: "Suresh Thapa", membership: "Bronze", visits: 6, rewards: 2 },
  { name: "Maya Gurung", membership: "Silver", visits: 15, rewards: 5 },
];

const MEMBERSHIP_VARIANT: Record<string, "gold" | "subtle" | "outline"> = {
  Gold: "gold",
  Silver: "subtle",
  Bronze: "outline",
};

const REVENUE_TREND = [
  { month: "Jan", revenue: 42 },
  { month: "Feb", revenue: 51 },
  { month: "Mar", revenue: 47 },
  { month: "Apr", revenue: 63 },
  { month: "May", revenue: 70 },
  { month: "Jun", revenue: 82 },
];

const CUSTOMER_GROWTH = [
  { month: "Jan", customers: 180 },
  { month: "Feb", customers: 240 },
  { month: "Mar", customers: 300 },
  { month: "Apr", customers: 410 },
  { month: "May", customers: 520 },
  { month: "Jun", customers: 640 },
];

const REWARD_CLAIMS = [
  { month: "Jan", claims: 90 },
  { month: "Feb", claims: 120 },
  { month: "Mar", claims: 140 },
  { month: "Apr", claims: 175 },
  { month: "May", claims: 210 },
  { month: "Jun", claims: 260 },
];

const REVENUE_CHART_CONFIG = { revenue: { label: "Revenue", color: "var(--primary)" } } satisfies ChartConfig;
const CUSTOMERS_CHART_CONFIG = { customers: { label: "Customers", color: "var(--primary)" } } satisfies ChartConfig;
const CLAIMS_CHART_CONFIG = { claims: { label: "Reward Claims", color: "var(--accent)" } } satisfies ChartConfig;

const AUDIENCES = ["All Customers", "Gold Members", "New Customers", "Inactive"];

const SETTINGS_ROWS = [
  { icon: UserCircle2, label: "Business Profile", description: "Name, logo, and shop details.", control: "chevron" as const },
  { icon: Bell, label: "Notifications", description: "Email and SMS alerts for new winners.", control: "switch" as const },
  { icon: Palette, label: "Branding", description: "Wheel colors, fonts, and slug.", control: "chevron" as const },
  { icon: ShieldCheck, label: "Security", description: "Password, 2FA, and access logs.", control: "chevron" as const },
];

function DashboardTab() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {DASHBOARD_STATS.map((s) => (
        <StatCard
          key={s.label}
          icon={s.icon}
          value={s.value}
          label={s.label}
          trend={s.trend}
          trendDirection={s.trendDirection}
        />
      ))}
    </div>
  );
}

function CampaignsTab() {
  return (
    <div className="flex flex-col gap-6">
      <FoundationCard padding="md" elevation="flat" className="bg-muted/40">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Active Campaign</p>
            <h3 className="font-display font-semibold text-lg text-foreground mt-1">Summer Spin Bonanza</h3>
          </div>
          <FoundationBadge variant="success">Live</FoundationBadge>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold text-foreground">68%</span>
          </div>
          <Progress value={68} />
        </div>
      </FoundationCard>

      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Reward Distribution</p>
        <div className="flex flex-col gap-3">
          {REWARD_DISTRIBUTION.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-semibold text-foreground">{r.pct}%</span>
              </div>
              <Progress value={r.pct} className="h-1.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomersTab() {
  return (
    <FoundationCard padding="none" elevation="flat" className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Membership</TableHead>
            <TableHead className="text-right">Total Visits</TableHead>
            <TableHead className="text-right">Rewards</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {CUSTOMERS_SAMPLE.map((c) => (
            <TableRow key={c.name}>
              <TableCell className="font-medium text-foreground">{c.name}</TableCell>
              <TableCell>
                <FoundationBadge variant={MEMBERSHIP_VARIANT[c.membership]}>{c.membership}</FoundationBadge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{c.visits}</TableCell>
              <TableCell className="text-right tabular-nums">{c.rewards}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </FoundationCard>
  );
}

function AnalyticsTab() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <FoundationCard padding="md" elevation="flat">
        <p className="text-sm font-semibold text-foreground mb-3">Revenue Trend</p>
        <ChartContainer config={REVENUE_CHART_CONFIG} className="aspect-auto h-40 w-full">
          <LineChart data={REVENUE_TREND} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ChartContainer>
      </FoundationCard>

      <FoundationCard padding="md" elevation="flat">
        <p className="text-sm font-semibold text-foreground mb-3">Customer Growth</p>
        <ChartContainer config={CUSTOMERS_CHART_CONFIG} className="aspect-auto h-40 w-full">
          <LineChart data={CUSTOMER_GROWTH} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="customers" stroke="var(--color-customers)" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ChartContainer>
      </FoundationCard>

      <FoundationCard padding="md" elevation="flat" className="md:col-span-2">
        <p className="text-sm font-semibold text-foreground mb-3">Reward Claims</p>
        <ChartContainer config={CLAIMS_CHART_CONFIG} className="aspect-auto h-40 w-full">
          <BarChart data={REWARD_CLAIMS} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="claims" fill="var(--color-claims)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </FoundationCard>
    </div>
  );
}

function MessagesTab() {
  const [audience, setAudience] = useState(AUDIENCES[0]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-foreground mb-2">Audience</p>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAudience(a)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                audience === a
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-2">Message</p>
        <Textarea
          readOnly
          value="🎉 New rewards just dropped! Spin the wheel on your next visit for a chance to win double points."
          className="min-h-24 resize-none bg-muted/30"
        />
      </div>

      <PrimaryButton type="button" className="self-start gap-2">
        <Send className="size-4" />
        Send Broadcast
      </PrimaryButton>
    </div>
  );
}

function SettingsTab() {
  const [notificationsOn, setNotificationsOn] = useState(true);

  return (
    <div className="flex flex-col divide-y divide-border">
      {SETTINGS_ROWS.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="flex items-center justify-center size-10 rounded-xl bg-muted text-foreground shrink-0">
              <row.icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground">{row.label}</p>
              <p className="text-xs text-muted-foreground truncate">{row.description}</p>
            </div>
          </div>
          {row.control === "switch" ? (
            <Switch checked={notificationsOn} onCheckedChange={setNotificationsOn} />
          ) : (
            <span className="text-muted-foreground text-lg leading-none shrink-0">›</span>
          )}
        </div>
      ))}
    </div>
  );
}

const TAB_CONTENT: Record<TabId, React.ComponentType> = {
  dashboard: DashboardTab,
  campaigns: CampaignsTab,
  customers: CustomersTab,
  analytics: AnalyticsTab,
  messages: MessagesTab,
  settings: SettingsTab,
};

/**
 * Landing Page 2.0 — "Manage Everything From One Beautiful Dashboard" section.
 * A fully static, interactive showcase (React state only, no routing/backend/API
 * calls) that visually resembles the real Mystery Unlock dashboard.
 */
export function DashboardPreview() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const ActiveContent = TAB_CONTENT[activeTab];

  return (
    <SectionContainer
      as="section"
      id="dashboard-preview"
      maxWidth="xl"
      spacing="none"
      className="py-20 lg:py-28"
      aria-labelledby="dashboard-preview-heading"
    >
      <div className="max-w-2xl mx-auto text-center mb-14">
        <h2
          id="dashboard-preview-heading"
          className="font-display text-3xl md:text-4xl font-bold leading-tight text-foreground"
        >
          Manage Everything From One Beautiful Dashboard
        </h2>
        <p className="mt-4 text-base md:text-lg text-muted-foreground">
          Track campaigns, customers, rewards, and business growth from a single,
          intuitive dashboard.
        </p>
      </div>

      <FoundationCard padding="none" elevation="lg" className="overflow-hidden animate-fade-in">
        <div className="flex flex-col lg:flex-row">
          <nav
            aria-label="Dashboard preview sections"
            className="lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-muted/30 p-3 lg:p-4"
          >
            <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={activeTab === item.id ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-200",
                    activeTab === item.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-w-0 p-5 lg:p-8">
            <div key={activeTab} className="animate-fade-in">
              <ActiveContent />
            </div>
          </div>
        </div>
      </FoundationCard>
    </SectionContainer>
  );
}
