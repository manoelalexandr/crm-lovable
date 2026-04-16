import {
  Phone, Users, CheckCircle, UsersRound, UserPlus, Mail,
  MessageSquare, Clock, Timer, ArrowDown, ArrowUp, LucideIcon
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/lib/api/dashboard";

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

const NpsSkeleton = () => (
  <div className="flex items-center gap-3">
    <Skeleton className="h-4 w-24 shrink-0" />
    <Skeleton className="flex-1 h-2" />
    <Skeleton className="h-4 w-8" />
  </div>
);

import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();
  const companyId = user?.app_metadata?.company_id;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", companyId],
    queryFn: () => getDashboardData(companyId),
    enabled: !!companyId,
    staleTime: 60_000, // Cache por 1 minuto antes de revalidar
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

      {/* Pesquisa de satisfação (NPS) */}
      <div>
        <h2 className="text-lg font-bold text-primary mb-4">Pesquisa de satisfação</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <NpsSkeleton key={i} />)
            : isError
            ? <p className="text-sm text-destructive col-span-full">Erro ao carregar dados de NPS.</p>
            : data?.nps.map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-24 shrink-0">{item.label}</span>
                  <Progress value={item.value} className="flex-1 h-2" />
                  <span className="text-sm font-medium w-10 text-right">{item.value}%</span>
                </div>
              ))}
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

      {/* Índice de avaliação */}
      <div>
        <h2 className="text-lg font-bold text-primary mb-4">Índice de avaliação</h2>
        {isLoading
          ? <Skeleton className="h-7 w-12" />
          : <span className="inline-block bg-primary text-primary-foreground text-sm font-bold rounded px-3 py-1">0%</span>
        }
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
