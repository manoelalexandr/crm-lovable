import { Bell, HelpCircle, Settings, User, Menu, LogOut, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface TopBarProps {
  onToggleSidebar: () => void;
}

const TopBar = ({ onToggleSidebar }: TopBarProps) => {
  const { signOut, user, companyUser, company } = useAuth();
  const navigate = useNavigate();
  const displayName = companyUser?.display_name || user?.email?.split('@')[0] || "Administrador";
  const companyName = company?.name || "CRM TRIP.ia";

  const { data: unreadTotal = 0 } = useQuery({
    queryKey: ["unread_notifications", company?.id, user?.id],
    queryFn: async () => {
      if (!company?.id || !user?.id) return 0;

      // 1. Descobre se quem está logado é Admin ou Atendente
      const { data: userData } = await supabase
        .from('company_users')
        .select('role')
        .eq('company_id', company.id)
        .eq('user_id', user.id)
        .single();

      const role = userData?.role || 'agent';

      // 2. Prepara a busca pelas notificações
      let query = supabase
        .from('tickets')
        .select('unread_count')
        .eq('company_id', company.id)
        .gt('unread_count', 0); // Só pega quem tem mensagem não lida

      // 3. A "CERCA" DAS NOTIFICAÇÕES
      if (role === 'agent') {
        // Se for atendente: avisa dos clientes DELE e dos clientes NOVOS (sem dono)
        query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null`);
      }
      // Se for admin, a query não leva o filtro acima, então ele vê o total da empresa!

      const { data, error } = await query;
      if (error) return 0;

      // Soma todas as mensagens pendentes
      return data.reduce((acc, curr) => acc + (curr.unread_count || 0), 0);
    },
    enabled: !!company?.id && !!user?.id,
    refetchInterval: 5000 // Mantém a verificação a cada 5 segundos
  });

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Erro ao deslogar:", error);
    }
  };

  return (
    <header className="h-12 bg-topbar flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="text-topbar-foreground hover:opacity-80 transition-opacity">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-topbar-foreground text-sm font-medium hidden sm:block">
          Olá <strong>{displayName}</strong>, seja bem-vindo à {companyName}!
        </span>
      </div>
      <div className="flex items-center gap-2">
        {/* Sininho Isolado e MUITO Visível no fundo laranja */}
        <button
          className="relative text-topbar-foreground hover:opacity-80 transition-opacity p-1.5 rounded-md"
          title={`Notificações: ${unreadTotal > 0 ? unreadTotal + ' pendentes' : 'Nenhuma'}`}
          onClick={() => navigate('/atendimentos')}
        >
          <Bell className="h-4 w-4" />
          {unreadTotal > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 flex items-center justify-center 
                         bg-white text-destructive text-[10px] font-bold rounded-full 
                         min-w-[16px] min-h-[16px] px-1 animate-pulse border-2 border-topbar shadow-lg"
            >
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </span>
          )}
        </button>

        {/* Restantes Botões de Suporte/Configuração */}
        {[HelpCircle, Settings].map((Icon, i) => (
          <button key={i} className="text-topbar-foreground hover:opacity-80 transition-opacity p-1.5 rounded-md">
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-7 w-7 rounded-full bg-topbar-foreground/20 flex items-center justify-center ml-1 outline-none hover:bg-topbar-foreground/30 transition-colors">
              <User className="h-4 w-4 text-topbar-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3" />
                {companyName}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair do painel</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default TopBar;
