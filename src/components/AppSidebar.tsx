import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BarChart3, Monitor, Headphones, Zap, SquareKanban,
  Users, CalendarClock, Tag, MessageSquare, Megaphone, GitBranch,
  FileText, Code, UserCog, Cake, ListFilter, Bot, Puzzle, Plug,
  Settings as SettingsIcon, Building2, CreditCard, ChevronDown, ChevronRight,
  Globe
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
}

interface MenuItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  children?: MenuItem[];
}

const menuStructure: MenuItem[] = [
  {
    label: "Gerência", icon: LayoutDashboard, children: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { label: "Relatórios", icon: BarChart3, path: "/relatorios" },
      { label: "Painel", icon: Monitor, path: "/painel" },
    ]
  },
  { label: "Atendimentos", icon: Headphones, path: "/atendimentos" },
  { label: "Respostas rápidas", icon: Zap, path: "/respostas-rapidas" },
  { label: "Kanban", icon: SquareKanban, path: "/kanban" },
  { label: "Contatos", icon: Users, path: "/contatos" },
  { label: "Agendamentos", icon: CalendarClock, path: "/agendamentos" },
  { label: "Tags", icon: Tag, path: "/tags" },
  { label: "Chat Interno", icon: MessageSquare, path: "/chat-interno" },
  { label: "Campanhas", icon: Megaphone, path: "/campanhas" },
  { label: "Flowbuilder", icon: GitBranch, path: "/flowbuilder" },
  {
    label: "Administração", icon: SettingsIcon, children: [
      { label: "Informativos", icon: FileText, path: "/informativos" },
      { label: "API", icon: Code, path: "/api" },
      { label: "Usuários", icon: UserCog, path: "/usuarios" },
      { label: "Config. Aniversário", icon: Cake, path: "/aniversario" },
      { label: "Filas & Chatbot", icon: ListFilter, path: "/filas" },
      { label: "Talk.Ai", icon: Bot, path: "/talk-ai" },
      { label: "Integrações", icon: Puzzle, path: "/integracoes" },
      { label: "Conexões", icon: Plug, path: "/conexoes" },
      { label: "Gerenciar conexões", icon: Globe, path: "/gerenciar-conexoes" },
      { label: "Financeiro", icon: CreditCard, path: "/financeiro" },
    ]
  },
  {
    label: "SaaS Admin", icon: Building2, children: [
      { label: "Configurações", icon: SettingsIcon, path: "/configuracoes" },
      { label: "Empresas", icon: Building2, path: "/empresas" },
      { label: "Planos", icon: CreditCard, path: "/planos" },
    ]
  },
];

const AppSidebar = ({ collapsed }: SidebarProps) => {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<string[]>(["Gerência"]);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev =>
      prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]
    );
  };

  const isActive = (path?: string) => path && location.pathname === path;

  const renderItem = (item: MenuItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openGroups.includes(item.label);
    const Icon = item.icon;

    if (hasChildren) {
      return (
        <div key={item.label}>
          <button
            onClick={() => toggleGroup(item.label)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors
              text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
              ${depth > 0 ? "pl-8" : ""}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left truncate">{item.label}</span>
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </>
            )}
          </button>
          {!collapsed && isOpen && (
            <div className="mt-0.5 space-y-0.5">
              {item.children!.map(child => renderItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.label}
        to={item.path || "/"}
        className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors
          ${isActive(item.path)
            ? "bg-sidebar-accent text-sidebar-primary font-medium"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}
          ${depth > 0 ? "pl-8" : ""}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <aside className={`bg-sidebar border-r border-sidebar-border h-full overflow-y-auto scrollbar-thin transition-all duration-200 shrink-0
      ${collapsed ? "w-14" : "w-56"}`}>
      <div className="p-3 border-b border-sidebar-border flex items-center justify-center">
        {collapsed ? (
          <span className="text-sidebar-primary font-bold text-lg">T</span>
        ) : (
          <span className="text-sidebar-primary font-bold text-xl tracking-tight">TRIP.ia</span>
        )}
      </div>
      <nav className="p-2 space-y-0.5">
        {menuStructure.map(item => renderItem(item))}
      </nav>
      {!collapsed && (
        <div className="p-3 border-t border-sidebar-border mt-2">
          <span className="text-xs text-muted-foreground">v5.0</span>
        </div>
      )}
    </aside>
  );
};

export default AppSidebar;
