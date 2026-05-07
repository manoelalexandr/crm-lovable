import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Headphones,
  SquareKanban,
  Users,
  Tag,
  Plug,
  Zap,
  Shield,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface SidebarProps {
  collapsed: boolean;
}

const activeMenuItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", adminOnly: true },
  { label: "Atendimentos", icon: Headphones, path: "/atendimentos" },
  //{ label: "Chat Interno", icon: MessageSquare, path: "/chat-interno" },
  { label: "Respostas Rápidas", icon: Zap, path: "/respostas-rapidas" },
  { label: "Kanban", icon: SquareKanban, path: "/kanban" },
  { label: "Contatos", icon: Users, path: "/contatos" },
  { label: "Tags", icon: Tag, path: "/tags" },
  { label: "Conexões", icon: Plug, path: "/conexoes", adminOnly: true },
  { label: "Equipe", icon: Shield, path: "/equipe", adminOnly: true },
];

const AppSidebar = ({ collapsed }: SidebarProps) => {
  const location = useLocation();
  const { company, user } = useAuth();
  const companyId = company?.id;

  const isActive = (path: string) => location.pathname === path;

  // Descobre o cargo (role) do utilizador logado
  const { data: currentUserRole } = useQuery({
    queryKey: ["userRole", companyId, user?.id],
    queryFn: async () => {
      if (!companyId || !user?.id) return 'agent';
      const { data } = await supabase
        .from('company_users')
        .select('role')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .single();
      return data?.role || 'agent';
    },
    enabled: !!companyId && !!user?.id
  });

  return (
    <aside
      className={`bg-sidebar border-r border-sidebar-border h-full flex flex-col overflow-hidden transition-all duration-200 shrink-0
        ${collapsed ? "w-14" : "w-56"}`}
    >
      {/* Logo */}
      <div className="p-3 border-b border-sidebar-border flex items-center justify-center shrink-0">
        {collapsed ? (
          <span className="text-sidebar-primary font-bold text-lg">T</span>
        ) : (
          <span className="text-sidebar-primary font-bold text-xl tracking-tight">
            TRIP.ia
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
        {activeMenuItems.map((item) => {
          // A "CERCA" DO MENU: Se o item for apenas para admin e o utilizador for atendente, esconde o botão
          if (item.adminOnly && currentUserRole === 'agent') return null;

          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors
                ${active
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-sidebar-border shrink-0">
          <span className="text-xs text-muted-foreground">v1.0 — MVP</span>
        </div>
      )}
    </aside>
  );
};

export default AppSidebar;