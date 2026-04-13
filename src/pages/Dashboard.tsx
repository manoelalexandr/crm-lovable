import { Phone, Users, CheckCircle, UsersRound, UserPlus, Mail, MessageSquare, Clock, Timer, ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface MetricCard {
  icon: React.ElementType;
  value: string;
  label: string;
  iconColor: string;
}

const metrics: MetricCard[] = [
  { icon: Phone, value: "2", label: "Em Atendimento", iconColor: "text-info" },
  { icon: Users, value: "2", label: "Aguardando", iconColor: "text-warning" },
  { icon: CheckCircle, value: "0", label: "Finalizados", iconColor: "text-success" },
  { icon: UsersRound, value: "0", label: "Grupos", iconColor: "text-primary" },
  { icon: UserPlus, value: "1/2", label: "Atendentes Ativos", iconColor: "text-primary" },
  { icon: Users, value: "1260", label: "Novos Contatos", iconColor: "text-success" },
  { icon: Mail, value: "0/23", label: "Mensagens Recebidas", iconColor: "text-foreground" },
  { icon: MessageSquare, value: "0/13", label: "Mensagens Enviadas", iconColor: "text-success" },
  { icon: Clock, value: "00h 00m", label: "T.M. de Atendimento", iconColor: "text-primary" },
  { icon: Timer, value: "00h 00m", label: "T.M. de Espera", iconColor: "text-destructive" },
  { icon: ArrowDown, value: "0", label: "Tickets Ativos", iconColor: "text-warning" },
  { icon: ArrowUp, value: "2", label: "Tickets Passivos", iconColor: "text-success" },
];

const npsData = [
  { label: "Score", value: 0, color: "bg-foreground" },
  { label: "Promotores", value: 0, color: "bg-success" },
  { label: "Neutros", value: 0, color: "bg-warning" },
  { label: "Detratores", value: 0, color: "bg-destructive" },
];

const attendants = [
  { name: "AtendChat Admin", score: 0, evaluated: 0, total: 0, waitTime: "00h 00m", serviceTime: "00h 00m", online: true },
];

const Dashboard = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Indicadores */}
      <div>
        <h2 className="text-lg font-bold text-primary mb-4">Indicadores</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {metrics.map((m, i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <m.icon className={`h-5 w-5 ${m.iconColor} shrink-0`} />
                <div>
                  <p className="text-lg font-bold">{m.value}</p>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* NPS */}
      <div>
        <h2 className="text-lg font-bold text-primary mb-4">Pesquisa de satisfação</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {npsData.map(item => (
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
          {[
            { icon: Phone, value: "2", label: "Total de Atendimentos" },
            { icon: Users, value: "0", label: "Atendimentos aguardando avaliação" },
            { icon: Users, value: "0", label: "Atendimentos sem avaliação" },
            { icon: Users, value: "0", label: "Atendimentos avaliados" },
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
        <span className="inline-block bg-primary text-primary-foreground text-sm font-bold rounded px-3 py-1">0%</span>
      </div>

      {/* Atendentes */}
      <div>
        <h2 className="text-lg font-bold text-primary mb-4">Atendentes</h2>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Nome", "Pontuação", "Atendimentos avaliados", "Total de Atendimentos", "T.M. de Espera", "T.M. de Atendimento", "Status (Atual)"].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attendants.map((a, i) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
