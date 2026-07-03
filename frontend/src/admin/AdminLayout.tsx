import { NavLink, Outlet, useLocation } from "react-router-dom";

const NAV = [
  { to: "/admin/dashboard", icon: "dashboard", label: "Dashboard" },
  { to: "/admin/tenants", icon: "corporate_fare", label: "Tenants" },
  { to: "/admin/leads", icon: "leaderboard", label: "Leads" },
];

export default function AdminLayout() {
  const loc = useLocation();
  return (
    <div className="min-h-[100dvh]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-[240px] bg-surface-container-lowest border-r border-outline-variant flex flex-col py-lg gap-sm z-50">
        <div className="px-md mb-xl">
          <h2 className="text-h2 font-bold text-primary">TQ Chatbot</h2>
          <p className="font-label-mono text-label-mono text-on-surface-variant opacity-60">
            v1.0 Admin
          </p>
        </div>
        <nav className="flex flex-col gap-xs flex-1">
          {NAV.map((n) => {
            const active =
              loc.pathname === n.to ||
              (n.to !== "/admin/dashboard" && loc.pathname.startsWith(n.to));
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={`flex items-center gap-md px-md py-sm transition-colors duration-200 ${
                  active
                    ? "text-primary border-l-4 border-primary bg-surface-container"
                    : "text-on-surface-variant hover:bg-surface-container-high border-l-4 border-transparent"
                }`}
              >
                <span
                  className={`material-symbols-outlined ${active ? "icon-fill" : ""}`}
                >
                  {n.icon}
                </span>
                <span className="font-label-mono text-label-mono">{n.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="px-md mt-auto pt-md border-t border-outline-variant/30">
          <div className="flex items-center gap-sm">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs">
              TQ
            </div>
            <div>
              <p className="font-label-mono text-[10px] leading-tight text-on-surface">
                Admin Session
              </p>
              <p className="font-label-mono text-[10px] text-on-surface-variant">
                tech-admin@hq.com
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-[240px] min-h-screen flex flex-col">
        <Outlet />
      </main>

      {/* Ambient gradients */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] bg-secondary/5 rounded-full blur-[120px]" />
      </div>
    </div>
  );
}

export function TopBar({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 w-full bg-surface border-b border-outline-variant px-lg py-md flex items-center justify-between">
      <h1 className="text-h2 font-black text-on-surface">{title}</h1>
      <div className="flex items-center gap-md">{children}</div>
    </header>
  );
}
