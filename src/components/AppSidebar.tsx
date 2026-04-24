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
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
}

// ─── Rotas ativas no MVP ───────────────────────────────────────────────────
const activeMenuItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Atendimentos", icon: Headphones, path: "/atendimentos" },
  { label: "Respostas Rápidas", icon: Zap, path: "/respostas-rapidas" },
  { label: "Kanban", icon: SquareKanban, path: "/kanban" },
  { label: "Contatos", icon: Users, path: "/contatos" },
  { label: "Tags", icon: Tag, path: "/tags" },
  { label: "Conexões", icon: Plug, path: "/conexoes" },
  { label: "Equipe", icon: Shield, path: "/equipe" },
];

// ─── Itens reservados para v2.0 (não visíveis) ────────────────────────────
// { label: "Relatórios",        icon: BarChart3,    path: "/relatorios" }
// { label: "Painel",            icon: Monitor,      path: "/painel" }
// { label: "Agendamentos",      icon: CalendarClock,path: "/agendamentos" }
// { label: "Chat Interno",      icon: MessageSquare,path: "/chat-interno" }
// { label: "Campanhas",         icon: Megaphone,    path: "/campanhas" }
// { label: "Flowbuilder",       icon: GitBranch,    path: "/flowbuilder" }
// { label: "Informativos",      icon: FileText,     path: "/informativos" }
// { label: "API",               icon: Code,         path: "/api" }
// { label: "Usuários",          icon: UserCog,      path: "/usuarios" }
// { label: "Config. Aniversário",icon: Cake,        path: "/aniversario" }
// { label: "Filas & Chatbot",   icon: ListFilter,   path: "/filas" }
// { label: "Talk.Ai",           icon: Bot,          path: "/talk-ai" }
// { label: "Integrações",       icon: Puzzle,       path: "/integracoes" }
// { label: "Financeiro",        icon: CreditCard,   path: "/financeiro" }
// { label: "Configurações",     icon: SettingsIcon, path: "/configuracoes" }
// { label: "Empresas",          icon: Building2,    path: "/empresas" }
// { label: "Planos",            icon: CreditCard,   path: "/planos" }

const AppSidebar = ({ collapsed }: SidebarProps) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

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
