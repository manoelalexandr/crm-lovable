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

// No arquivo kanban.ts
export async function getKanbanBoard(companyId: string) {
  // 1. Busca Colunas
  const { data: cols, error: colsError } = await supabase
    .from('kanban_columns')
    .select('*')
    .eq('company_id', companyId)
    .order('position', { ascending: true });

  if (colsError) throw colsError;

  const columns = cols as KanbanColumnData[];
  const defaultColumnId = columns.length > 0 ? columns[0].id : null;
  // Busca a coluna que tem a cor 'done' para tickets finalizados
  const doneColumnId = columns.find(c => c.color === 'done')?.id || defaultColumnId;
  // Busca a coluna que tem a cor 'attending' para tickets em atendimento
  const attendingColumnId = columns.find(c => c.color === 'attending')?.id || defaultColumnId;

  // 2. Busca Tickets
  const { data: ticketsData, error: ticketsError } = await supabase
    .from('tickets')
    .select(`
      id, ticket_number, last_message, kanban_value, created_at, 
      status, kanban_column_id,
      contacts (name, phone)
    `)
    .eq('company_id', companyId)
    // REMOVEMOS o filtro de status para que o 'finalizado' também apareça no Kanban
    .order('updated_at', { ascending: false });

  if (ticketsError) throw ticketsError;

  const tickets: KanbanTicket[] = (ticketsData || []).map(t => {
    let targetColumnId = t.kanban_column_id;

    // AUTOMAÇÃO DE COLUNA BASEADA NO STATUS:
    // Se o ticket estiver finalizado, força ele para a coluna 'done'
    if (t.status === 'resolved' || t.status === 'finished') {
      targetColumnId = doneColumnId;
    }
    // Se estiver em atendimento e não tiver coluna, ou se quisermos forçar a mudança:
    else if (t.status === 'attending' && (!t.kanban_column_id || t.kanban_column_id === defaultColumnId)) {
      targetColumnId = attendingColumnId;
    }
    // Se for novo e não tiver coluna
    else if (!targetColumnId) {
      targetColumnId = defaultColumnId;
    }

    return {
      id: t.id,
      ticket_number: t.ticket_number,
      last_message: t.last_message,
      kanban_value: Number(t.kanban_value || 0),
      contact_name: (t.contacts as any)?.name || (t.contacts as any)?.phone || 'Desconhecido',
      created_at: t.created_at,
      kanban_column_id: targetColumnId,
    };
  });

  return { columns, tickets };
}

export async function updateTicketColumn(ticketId: string, columnId: string) {
  // 1. Busca a categoria (cor) da coluna de destino no banco
  const { data: column } = await supabase
    .from('kanban_columns')
    .select('color')
    .eq('id', columnId)
    .single();

  // 2. Define o novo status do ticket com base na cor da coluna
  let newStatus = undefined;
  if (column) {
    if (column.color === 'open' || column.color === 'pending') {
      newStatus = 'waiting';
    } else if (column.color === 'attending') {
      newStatus = 'attending';
    } else if (column.color === 'done') {
      newStatus = 'resolved';
    }
  }

  // 3. Prepara a atualização
  const updatePayload: any = {
    kanban_column_id: columnId,
    updated_at: new Date().toISOString()
  };

  // Se identificamos um novo status, adicionamos ao envio
  if (newStatus) {
    updatePayload.status = newStatus;
  }

  // 4. Salva as alterações no Supabase
  const { error } = await supabase
    .from('tickets')
    .update(updatePayload)
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
