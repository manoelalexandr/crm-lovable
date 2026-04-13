import { Bell, HelpCircle, Settings, User, Menu } from "lucide-react";

interface TopBarProps {
  onToggleSidebar: () => void;
  userName?: string;
  companyName?: string;
}

const TopBar = ({ onToggleSidebar, userName = "Administrador", companyName = "Empresa Principal" }: TopBarProps) => {
  return (
    <header className="h-12 bg-topbar flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="text-topbar-foreground hover:opacity-80 transition-opacity">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-topbar-foreground text-sm font-medium hidden sm:block">
          Olá {userName}, seja bem-vindo à {companyName}!
        </span>
      </div>
      <div className="flex items-center gap-2">
        {[Bell, HelpCircle, Settings].map((Icon, i) => (
          <button key={i} className="text-topbar-foreground hover:opacity-80 transition-opacity p-1.5 rounded-md">
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <div className="h-7 w-7 rounded-full bg-topbar-foreground/20 flex items-center justify-center ml-1">
          <User className="h-4 w-4 text-topbar-foreground" />
        </div>
      </div>
    </header>
  );
};

export default TopBar;
