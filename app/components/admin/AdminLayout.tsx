import { useLocation } from "react-router";
import {
  LayoutDashboard,
  Wand2,
  Package,
  Sparkles,
  BookOpen,
  LifeBuoy,
  MessageSquare,
  Eye,
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

  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%" }}>
      {/* Left Sidebar Navigation */}
      <nav
        style={{
          width: "240px",
          borderRight: "1px solid #e5e7eb",
          padding: "1.5rem 0",
          overflowY: "auto",
          backgroundColor: "#f9fafb",
        }}
      >
        {/* Logo/Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 1rem 1.5rem" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              backgroundColor: "#008060",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bot size={18} color="white" />
          </div>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>ShopMate AI</span>
        </div>

        {/* Navigation Links */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "0 0.75rem" }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = item.path;
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: 500,
                  textDecoration: "none",
                  color: isActive ? "#008060" : "#6b7280",
                  backgroundColor: isActive ? "#f0fdf4" : "transparent",
                  transition: "all 0.15s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "#f3f4f6";
                    e.currentTarget.style.color = "#111827";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#6b7280";
                  }
                }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
        {children}
      </main>
    </div>
  );
}
