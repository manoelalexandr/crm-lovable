// Camada de API para o Dashboard.
// Chama a função SQL `get_dashboard_metrics` do Supabase que agrega as métricas em tempo real.
// Para alterar os dados, edite a stored procedure no banco — o frontend não precisa mudar.

import { supabase } from '@/lib/supabase';

export interface MetricItem {
  icon: string;
  value: string;
  label: string;
  iconColor: string;
}

export interface NpsItem {
  label: string;
  value: number;
  color: string;
}

export interface AttendantItem {
  name: string;
  score: number;
  evaluated: number;
  total: number;
  waitTime: string;
  serviceTime: string;
  online: boolean;
}

export interface DashboardData {
  metrics: MetricItem[];
  nps: NpsItem[];
  attendants: AttendantItem[];
}

export async function getDashboardData(companyId?: string): Promise<DashboardData> {
  if (!companyId) return getEmptyDashboard();

  // 2. Chama a stored procedure que agrega todas as métricas em uma única query
  const { data: metrics, error } = await supabase
    .rpc('get_dashboard_metrics', { p_company_id: companyId });

  if (error || !metrics) {
    console.error('Erro ao buscar métricas do dashboard:', error);
    return getEmptyDashboard();
  }

  const m = metrics as Record<string, number>;

  // 3. Busca atendentes da empresa
  const { data: agents } = await supabase
    .from('company_users')
    .select('display_name, status, user_id')
    .eq('company_id', companyId)
    .eq('is_active', true);

  const attendants: AttendantItem[] = (agents ?? []).map(a => ({
    name: a.display_name ?? 'Atendente',
    score: 0,
    evaluated: 0,
    total: 0,
    waitTime: '00h 00m',
    serviceTime: '00h 00m',
    online: a.status === 'online',
  }));

  const npsScore = m.nps_score ?? 0;
  const totalRatings = (m.promoters ?? 0) + (m.neutrals ?? 0) + (m.detractors ?? 0);

  return {
    metrics: [
      { icon: 'Phone',         value: String(m.attending ?? 0),                                                      label: 'Em Atendimento',       iconColor: 'text-info' },
      { icon: 'Users',         value: String(m.waiting ?? 0),                                                        label: 'Aguardando',           iconColor: 'text-warning' },
      { icon: 'CheckCircle',   value: String(m.resolved_today ?? 0),                                                 label: 'Finalizados hoje',     iconColor: 'text-success' },
      { icon: 'UsersRound',    value: '0',                                                                            label: 'Grupos',               iconColor: 'text-primary' },
      { icon: 'UserPlus',      value: `${m.active_agents ?? 0}/${m.total_agents ?? 0}`,                              label: 'Atendentes Ativos',    iconColor: 'text-primary' },
      { icon: 'Users',         value: String(m.new_contacts_today ?? 0),                                             label: 'Novos Contatos hoje',  iconColor: 'text-success' },
      { icon: 'Mail',          value: String(m.messages_received_today ?? 0),                                        label: 'Mensagens Recebidas',  iconColor: 'text-foreground' },
      { icon: 'MessageSquare', value: String(m.messages_sent_today ?? 0),                                            label: 'Mensagens Enviadas',   iconColor: 'text-success' },
      { icon: 'Clock',         value: '00h 00m',                                                                      label: 'T.M. de Atendimento', iconColor: 'text-primary' },
      { icon: 'Timer',         value: '00h 00m',                                                                      label: 'T.M. de Espera',      iconColor: 'text-destructive' },
      { icon: 'ArrowDown',     value: String((m.attending ?? 0) + (m.waiting ?? 0)),                                 label: 'Tickets Ativos',       iconColor: 'text-warning' },
      { icon: 'ArrowUp',       value: String(m.resolved_today ?? 0),                                                 label: 'Tickets Finalizados',  iconColor: 'text-success' },
    ],
    nps: [
      { label: 'Score',      value: Math.round(npsScore * 10),                                                                        color: 'bg-foreground' },
      { label: 'Promotores', value: totalRatings > 0 ? Math.round(((m.promoters ?? 0) / totalRatings) * 100) : 0,                    color: 'bg-success' },
      { label: 'Neutros',    value: totalRatings > 0 ? Math.round(((m.neutrals ?? 0) / totalRatings) * 100) : 0,                     color: 'bg-warning' },
      { label: 'Detratores', value: totalRatings > 0 ? Math.round(((m.detractors ?? 0) / totalRatings) * 100) : 0,                   color: 'bg-destructive' },
    ],
    attendants,
  };
}

function getEmptyDashboard(): DashboardData {
  return {
    metrics: [
      { icon: 'Phone',         value: '0',        label: 'Em Atendimento',       iconColor: 'text-info' },
      { icon: 'Users',         value: '0',        label: 'Aguardando',           iconColor: 'text-warning' },
      { icon: 'CheckCircle',   value: '0',        label: 'Finalizados',          iconColor: 'text-success' },
      { icon: 'UsersRound',    value: '0',        label: 'Grupos',               iconColor: 'text-primary' },
      { icon: 'UserPlus',      value: '0/0',      label: 'Atendentes Ativos',    iconColor: 'text-primary' },
      { icon: 'Users',         value: '0',        label: 'Novos Contatos',       iconColor: 'text-success' },
      { icon: 'Mail',          value: '0',        label: 'Mensagens Recebidas',  iconColor: 'text-foreground' },
      { icon: 'MessageSquare', value: '0',        label: 'Mensagens Enviadas',   iconColor: 'text-success' },
      { icon: 'Clock',         value: '00h 00m',  label: 'T.M. de Atendimento', iconColor: 'text-primary' },
      { icon: 'Timer',         value: '00h 00m',  label: 'T.M. de Espera',      iconColor: 'text-destructive' },
      { icon: 'ArrowDown',     value: '0',        label: 'Tickets Ativos',       iconColor: 'text-warning' },
      { icon: 'ArrowUp',       value: '0',        label: 'Tickets Passivos',     iconColor: 'text-success' },
    ],
    nps: [
      { label: 'Score',      value: 0, color: 'bg-foreground' },
      { label: 'Promotores', value: 0, color: 'bg-success' },
      { label: 'Neutros',    value: 0, color: 'bg-warning' },
      { label: 'Detratores', value: 0, color: 'bg-destructive' },
    ],
    attendants: [],
  };
}
