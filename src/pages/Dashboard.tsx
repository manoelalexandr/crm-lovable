import {
  Phone, Users, CheckCircle, UsersRound, UserPlus, Mail,
  MessageSquare, Clock, Timer, ArrowDown, ArrowUp, LucideIcon
} from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboardData } from "@/lib/api/dashboard";
import { useAuth } from "@/contexts/AuthContext";


// Mapeamento de strings para componentes de ícone do Lucide
const iconMap: Record<string, LucideIcon> = {
  Phone, Users, CheckCircle, UsersRound, UserPlus, Mail,
  MessageSquare, Clock, Timer, ArrowDown, ArrowUp,
};

// --- Skeletons de carregamento ---
const MetricSkeleton = () => (
  <Card className="shadow-sm">
    <CardContent className="p-4 flex items-center gap-3">
      <Skeleton className="h-5 w-5 rounded-md" />
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-10" />
        <Skeleton className="h-3 w-24" />
      </div>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const { user } = useAuth();
  const companyId = user?.app_metadata?.company_id;
  const queryClient = useQueryClient(); // <-- Instancia o cliente

  // --- NOVO BLOCO: OUVINTE REALTIME INSTANTÂNEO ---
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('dashboard_realtime')
      // Fica ouvindo mudanças de Status Online/Offline dos atendentes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'company_users', filter: `company_id=eq.${companyId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard", companyId] });
        }
      )
      // Opcional, mas incrível: Ouve mudanças em tickets para atualizar as métricas na hora!
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets', filter: `company_id=eq.${companyId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard", companyId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);


  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", companyId],
    queryFn: () => getDashboardData(companyId),
    enabled: !!companyId,
  });

  return (
    <div className="p-6 space-y-6">
      {/* Indicadores */}
      <div>
        <h2 className="text-lg font-bold text-primary mb-4">Indicadores</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {isLoading
            ? Array.from({ length: 12 }).map((_, i) => <MetricSkeleton key={i} />)
            : isError
              ? <p className="text-sm text-destructive col-span-full">Erro ao carregar indicadores.</p>
              : data?.metrics.map((m, i) => {
                const Icon = iconMap[m.icon];
                return (
                  <Card key={i} className="shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                      {Icon && <Icon className={`h-5 w-5 ${m.iconColor} shrink-0`} />}
                      <div>
                        <p className="text-lg font-bold">{m.value}</p>
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </div>

      {/* Atendimentos */}
      <div>
        <h2 className="text-lg font-bold text-primary mb-4">Atendimentos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
            : [
              { icon: Phone, value: data?.metrics[0]?.value ?? "0", label: "Total de Atendimentos" },
              { icon: Users, value: "0", label: "Aguardando avaliação" },
              { icon: Users, value: "0", label: "Sem avaliação" },
              { icon: Users, value: "0", label: "Avaliados" },
            ].map((m, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <m.icon className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-lg font-bold">{m.value}</p>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      {/* Atendentes */}
      <div>
        <h2 className="text-lg font-bold text-primary mb-4">Atendentes</h2>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Nome", "Pontuação", "Avaliados", "Total", "T.M. Espera", "T.M. Atendimento", "Status"].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <td key={i} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                  ))}
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="py-3 px-4 text-sm text-destructive">
                    Erro ao carregar atendentes.
                  </td>
                </tr>
              ) : (
                data?.attendants.map((a, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-3 px-4 font-medium">{a.name}</td>
                    <td className="py-3 px-4">{a.score}</td>
                    <td className="py-3 px-4">{a.evaluated}</td>
                    <td className="py-3 px-4">{a.total}</td>
                    <td className="py-3 px-4">{a.waitTime}</td>
                    <td className="py-3 px-4">{a.serviceTime}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block h-3 w-3 rounded-full ${a.online ? "bg-success" : "bg-muted"}`} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;