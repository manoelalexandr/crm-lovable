import { useState } from "react";
import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import AppSidebar from "./AppSidebar";

const AppLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar collapsed={sidebarCollapsed} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="flex-1 overflow-auto bg-secondary/30">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
