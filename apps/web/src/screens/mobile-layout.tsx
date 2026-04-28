import { Outlet } from "react-router-dom";
import { BottomNav } from "../components/chat/bottom-nav";

export function MobileLayout() {
  return (
    <div className="mobile-shell">
      <div className="mobile-content">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
