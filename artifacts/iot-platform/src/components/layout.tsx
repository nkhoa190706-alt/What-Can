import { Link, useLocation } from "wouter";
import { useTheme } from "./theme-provider";
import { Moon, Sun, Monitor, Activity, Radio, AlertTriangle, Database } from "lucide-react";
import { Button } from "./ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  const navigation = [
    { name: "Dashboard", href: "/", icon: Activity },
    { name: "Devices", href: "/devices", icon: Monitor },
    { name: "Alerts", href: "/alerts", icon: AlertTriangle },
    { name: "Telemetry", href: "/telemetry", icon: Database },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 flex flex-col border-r border-border bg-card">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary">
            <Radio className="h-6 w-6" />
            <span className="font-bold text-lg tracking-tight">IoT Platform</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md cursor-pointer transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  data-testid={`nav-${item.name.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Theme</span>
          <div className="flex gap-1 bg-muted rounded-md p-1">
            <button
              onClick={() => setTheme("light")}
              className={`p-1.5 rounded-sm ${theme === "light" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              data-testid="btn-theme-light"
            >
              <Sun className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`p-1.5 rounded-sm ${theme === "dark" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              data-testid="btn-theme-dark"
            >
              <Moon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
