import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: LucideIcon;
}

export default function KpiCard({ title, value, change, trend, icon: Icon }: KpiCardProps) {
  return (
    <div className="polaris-card animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-semibold text-card-foreground mt-1">{value}</p>
          <div className="flex items-center gap-1 mt-2">
            {trend === "up" ? (
              <TrendingUp className="w-3.5 h-3.5 text-success" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-destructive" />
            )}
            {change ? (
              <>
                <span
                  className={`text-xs font-medium ${
                    trend === "up" ? "text-success" : "text-destructive"
                  }`}
                >
                  {change}
                </span>
                <span className="text-xs text-muted-foreground">vs last week</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
          <Icon className="w-5 h-5 text-accent-foreground" />
        </div>
      </div>
    </div>
  );
}
