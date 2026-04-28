import { BarChart3, ListTodo, MessageCircle, Newspaper, User } from "lucide-react";
import { NavLink } from "react-router-dom";

type Tab = {
  to: string;
  label: string;
  icon: typeof MessageCircle;
};

const TABS: Tab[] = [
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/", label: "Chat", icon: MessageCircle },
  { to: "/discover", label: "Discover", icon: Newspaper },
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) => `bottom-nav-tab ${isActive ? "active" : ""}`}
        >
          <Icon size={22} strokeWidth={2} />
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
