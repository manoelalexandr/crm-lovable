import { Bell, HelpCircle, Settings, User, Menu, LogOut, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopBarProps {
  onToggleSidebar: () => void;
}

const TopBar = ({ onToggleSidebar }: TopBarProps) => {
  const { signOut, user, companyUser, company } = useAuth();

  const displayName = companyUser?.display_name || user?.email?.split('@')[0] || "Administrador";
  const companyName = company?.name || "CRM TRIP.ia";

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
        {[Bell, HelpCircle, Settings].map((Icon, i) => (
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
