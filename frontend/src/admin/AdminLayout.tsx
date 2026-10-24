import { NavLink, Outlet, useLocation } from "react-router-dom";

export function AdminHeader() {
  const { pathname } = useLocation();
  return <header className="app-header">
    <NavLink to="/admin/tenants" className="brand"><span>TQ</span> TQ Chatbot</NavLink>
    <nav className="pill" aria-label="Main navigation">
      {[["dashboard", "Overview"], ["tenants", "Chatbots"], ["leads", "Leads"]].map(([route, label]) =>
        <NavLink key={route} to={`/admin/${route}`} aria-current={pathname.startsWith(`/admin/${route}`) ? "page" : undefined}>{label}</NavLink>)}
    </nav>
    <span className="workspace-name">YOUR WORKSPACE</span>
  </header>;
}
export default function AdminLayout() {
  return <div className="tq-admin"><a className="skip" href="#main">Skip to content</a><AdminHeader />
    <main id="main" className="workspace" tabIndex={-1}><Outlet />
      <footer className="admin-footer"><span>TQ Chatbot</span><span>Conversations that move business forward.</span></footer>
    </main></div>;
}
export function TopBar({title, children}: {title: string; children?: React.ReactNode}) {
  const descriptions: Record<string,string> = {
    Chatbots: "Set up your assistant, then test a conversation.",
    Overview: "A clear view of your chatbots and leads.",
    Leads: "Find a lead and read the conversation.",
  };
  return <header className="page-heading"><div><h1>{title}</h1><p>{descriptions[title]}</p></div>
    {children && <div className="heading-actions">{children}</div>}</header>;
}
