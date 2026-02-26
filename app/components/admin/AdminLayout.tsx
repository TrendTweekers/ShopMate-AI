import { useState } from "react";
import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Wand2,
  Package,
  Sparkles,
  BookOpen,
  LifeBuoy,
  MessageSquare,
  Eye,
  Menu,
  X,
  Bot,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", path: "/app", icon: LayoutDashboard },
  { label: "Setup Wizard", path: "/app/setup", icon: Wand2 },
  { label: "Order Tracking", path: "/app/order-tracking", icon: Package },
  { label: "Recommendations", path: "/app/recommendations", icon: Sparkles },
  { label: "Knowledge Base", path: "/app/knowledge", icon: BookOpen },
  { label: "Escalation", path: "/app/escalation", icon: LifeBuoy },
  { label: "Conversations", path: "/app/conversations", icon: MessageSquare },
  { label: "Widget Preview", path: "/app/widget-preview", icon: Eye },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-60" : "w-0 lg:w-16"
        } bg-card border-r border-border transition-all duration-200 flex-shrink-0 overflow-hidden`}
      >
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          {sidebarOpen && (
            <span className="font-semibold text-sm text-foreground whitespace-nowrap">
              ShopMate AI
            </span>
          )}
        </div>

        <nav className="p-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-surface-selected text-accent-foreground"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-surface-hover text-muted-foreground transition-colors"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <h1 className="text-sm font-semibold text-foreground truncate">
            {navItems.find((n) => n.path === location.pathname)?.label ?? "ShopMate AI"}
          </h1>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
