import { supabase } from '@/lib/supabase';

export interface KanbanColumnData {
  id: string;
  title: string;
  color: string;
  position: number;
  company_id: string;
}

export interface KanbanTicket {
  id: string;
  ticket_number: number;
  last_message: string | null;
  kanban_value: number;
  contact_name: string;
  created_at: string;
  kanban_column_id: string | null;
}

export async function getKanbanBoard(companyId: string) {
  // 1. Busca Colunas
  const { data: cols, error: colsError } = await supabase
    .from('kanban_columns')
    .select('*')
    .eq('company_id', companyId)
    .order('position', { ascending: true });

  if (colsError) throw colsError;

  // 2. Busca Tickets (Cards)
  // Join com contatos para pegar o nome
  const { data: ticketsData, error: ticketsError } = await supabase
    .from('tickets')
    .select(`
      id,
      ticket_number,
      last_message,
      kanban_value,
      created_at,
      kanban_column_id,
      contacts (
        name,
        phone
      )
    `)
    .eq('company_id', companyId)
    .not('kanban_column_id', 'is', null);

  if (ticketsError) throw ticketsError;

  // Formata os tickets para a interface do Kanban
  const tickets: KanbanTicket[] = (ticketsData || []).map(t => ({
    id: t.id,
    ticket_number: t.ticket_number,
    last_message: t.last_message,
    kanban_value: Number(t.kanban_value || 0),
    contact_name: (t.contacts as any)?.name || (t.contacts as any)?.phone || 'Desconhecido',
    created_at: t.created_at,
    kanban_column_id: t.kanban_column_id,
  }));

  return {
    columns: cols as KanbanColumnData[],
    tickets
  };
}

export async function updateTicketColumn(ticketId: string, columnId: string) {
  const { error } = await supabase
    .from('tickets')
    .update({ 
      kanban_column_id: columnId,
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId);

  if (error) throw error;
  return true;
}

export async function createKanbanColumn(companyId: string, title: string, color: string = 'open') {
  // Busca a última posição para definir a próxima
  const { data: lastCol, error: posError } = await supabase
    .from('kanban_columns')
    .select('position')
    .eq('company_id', companyId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (posError) throw posError;

  const nextPosition = (lastCol?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from('kanban_columns')
    .insert({
      company_id: companyId,
      title,
      color,
      position: nextPosition
    })
    .select()
    .single();

  if (error) throw error;
  return data as KanbanColumnData;
}

export async function updateColumnsPositions(columns: KanbanColumnData[]) {
  const { error } = await supabase
    .from('kanban_columns')
    .upsert(columns);

  if (error) throw error;
  return true;
}

export async function updateKanbanColumn(columnId: string, updates: Partial<KanbanColumnData>) {
  const { data, error } = await supabase
    .from('kanban_columns')
    .update(updates)
    .eq('id', columnId)
    .select()
    .single();

  if (error) throw error;
  return data as KanbanColumnData;
}

export async function deleteKanbanColumn(columnId: string) {
  const { error } = await supabase
    .from('kanban_columns')
    .delete()
    .eq('id', columnId);

  if (error) throw error;
  return true;
}
