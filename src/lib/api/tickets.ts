import { supabase } from '../supabase';
import { sendEvolutionMessage, sendEvolutionMedia } from './channels';

export interface Contact {
  id: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  notes: string | null;
}

export interface Ticket {
  id: string;
  contact_id: string;
  assigned_to: string | null;
  status: string;
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
  source: string | null;
  contacts: Contact | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  ticket_id: string;
  sender_type: 'client' | 'agent' | 'bot' | 'system';
  sender_id: string | null;
  content: string;
  type: string;
  media_url?: string | null;
  created_at: string;
  status: string | null;
}

export async function getTickets(companyId: string, status: 'aguardando' | 'atendendo' | 'resolvido'): Promise<Ticket[]> {
  const dbStatusMap = {
    'aguardando': 'waiting',
    'atendendo': 'attending',
    'resolvido': 'resolved'
  };

  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      contacts (
        id,
        name,
        phone,
        avatar_url
      )
    `)
    .eq('company_id', companyId)
    .eq('status', dbStatusMap[status])
    .order('last_message_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar tickets:', error);
    throw error;
  }

  // O Supabase retorna contacts como array se for 1:N, mas na modelagem de tickets um ticket tem 1 contact (N:1)
  // Então o join devolve um objeto simples se configurado corretamente, vamos fazer o cast seguro
  return (data || []) as unknown as Ticket[];
}

export async function getTicketMessages(ticketId: string): Promise<Message[]> {
  // 1. Primeiro, descobrimos quem é o cliente (contact_id) dono deste ticket
  const { data: currentTicket, error: ticketErr } = await supabase
    .from('tickets')
    .select('contact_id')
    .eq('id', ticketId)
    .single();

  if (ticketErr || !currentTicket) {
    console.error('Erro ao buscar contato do ticket:', ticketErr);
    return [];
  }

  // 2. Buscamos TODOS os tickets que esse cliente já abriu na vida
  const { data: contactTickets, error: contactErr } = await supabase
    .from('tickets')
    .select('id')
    .eq('contact_id', currentTicket.contact_id);

  if (contactErr || !contactTickets) return [];

  const ticketIds = contactTickets.map(t => t.id);

  // 3. Puxamos todas as mensagens agrupadas e ordenadas por data
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .in('ticket_id', ticketIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar histórico unificado:', error);
    throw error;
  }

  return (data || []) as Message[];
}

export async function sendMessage(ticketId: string, content: string, companyId: string, agentId: string): Promise<Message> {
  // 1. Busca detalhes do ticket, canal e contato
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select(`
      *,
      contacts!inner (phone),
      channels!inner (type, evolution_instance_name, evolution_api_url, evolution_api_key)
    `)
    .eq('id', ticketId)
    .single();

  if (ticketError) throw ticketError;

  const contactPhone = (ticket.contacts as any)?.phone;
  const channel = (ticket.channels as any);

  // 2. Insere a mensagem no banco
  const { data: msgData, error: msgError } = await supabase
    .from('messages')
    .insert([{
      ticket_id: ticketId,
      company_id: companyId,
      sender_type: 'agent',
      sender_id: agentId,
      content: content,
      type: 'text',
      status: 'sent'
    }])
    .select()
    .single();

  if (msgError) throw msgError;

  // 3. Envio externo via Evolution API
  if (channel?.type === 'whatsapp' && channel.evolution_instance_name && contactPhone) {
    try {
      await sendEvolutionMessage(channel.evolution_api_url, channel.evolution_api_key, channel.evolution_instance_name, contactPhone, content);
    } catch (apiError) {
      console.error('Erro no envio via Evolution API:', apiError);
      await supabase.from('messages').update({ status: 'error' }).eq('id', msgData.id);
    }
  }

  // 4. ATUALIZAÇÃO DO STATUS E DO KANBAN PARA "EM ATENDIMENTO"
  if (ticket.status === 'waiting' || ticket.status === 'resolved') {
    // Busca o ID da coluna "Em Atendimento" (cor: attending)
    const { data: attendingCol } = await supabase
      .from('kanban_columns')
      .select('id')
      .eq('company_id', companyId)
      .eq('color', 'attending')
      .maybeSingle();

    const updatePayload: any = {
      status: 'attending',
      updated_at: new Date().toISOString()
    };

    if (attendingCol) updatePayload.kanban_column_id = attendingCol.id;

    await supabase.from('tickets').update(updatePayload).eq('id', ticketId);
  }

  // 5. Atualiza o last_message
  await supabase
    .from('tickets')
    .update({
      last_message: content,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId);

  return msgData as Message;
}

export async function sendMediaMessage(
  ticketId: string, mediaUrl: string, mediaType: 'image' | 'audio' | 'video' | 'document', companyId: string, agentId: string, caption?: string
): Promise<Message> {
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select(`*, contacts!inner (phone), channels!inner (type, evolution_instance_name, evolution_api_url, evolution_api_key)`)
    .eq('id', ticketId)
    .single();

  if (ticketError) throw ticketError;

  const contactPhone = (ticket.contacts as any)?.phone;
  const channel = (ticket.channels as any);

  const { data: msgData, error: msgError } = await supabase
    .from('messages')
    .insert([{
      ticket_id: ticketId, company_id: companyId, sender_type: 'agent', sender_id: agentId,
      content: caption || `[Arquivo de ${mediaType}]`, type: mediaType, media_url: mediaUrl, status: 'sent'
    }])
    .select()
    .single();

  if (msgError) throw msgError;

  if (channel?.type === 'whatsapp' && channel.evolution_instance_name && contactPhone) {
    try {
      await sendEvolutionMedia(channel.evolution_api_url, channel.evolution_api_key, channel.evolution_instance_name, contactPhone, mediaUrl, mediaType, caption);
    } catch (apiError) {
      await supabase.from('messages').update({ status: 'error' }).eq('id', msgData.id);
    }
  }

  // ATUALIZAÇÃO DO STATUS E DO KANBAN PARA "EM ATENDIMENTO" (Mídia)
  if (ticket.status === 'waiting' || ticket.status === 'resolved') {
    const { data: attendingCol } = await supabase.from('kanban_columns').select('id').eq('company_id', companyId).eq('color', 'attending').maybeSingle();
    const updatePayload: any = { status: 'attending', updated_at: new Date().toISOString() };
    if (attendingCol) updatePayload.kanban_column_id = attendingCol.id;
    await supabase.from('tickets').update(updatePayload).eq('id', ticketId);
  }

  await supabase
    .from('tickets')
    .update({
      last_message: caption || `[Arquivo de ${mediaType}]`,
      last_message_at: new Date().toISOString(), updated_at: new Date().toISOString()
    })
    .eq('id', ticketId);

  return msgData as Message;
}

/**
 * Resolve (finaliza) um ticket, movendo-o para o status 'resolved' e para a coluna 'done' no Kanban.
 * Modificamos para receber também o companyId
 */
export async function resolveTicket(ticketId: string, companyId: string): Promise<void> {
  // Busca o ID da coluna "Finalizado" (cor: done)
  const { data: doneCol } = await supabase
    .from('kanban_columns')
    .select('id')
    .eq('company_id', companyId)
    .eq('color', 'done')
    .maybeSingle();

  const updatePayload: any = {
    status: 'resolved',
    updated_at: new Date().toISOString(),
  };

  // Se a coluna existir, movemos o card para lá
  if (doneCol) {
    updatePayload.kanban_column_id = doneCol.id;
  }

  const { error } = await supabase
    .from('tickets')
    .update(updatePayload)
    .eq('id', ticketId);

  if (error) throw error;
}

export async function findOrCreateTicket(contactId: string, companyId: string): Promise<Ticket> {
  // 1. Busca QUALQUER ticket desse contato (pegando o mais recente), independente do status!
  const { data: existingTicket, error: searchError } = await supabase
    .from('tickets')
    .select('*')
    .eq('contact_id', contactId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (searchError) throw searchError;

  if (existingTicket) {
    // Se o ticket estava resolvido/finalizado, nós o "reabrimos" para aguardando
    if (existingTicket.status === 'resolved') {
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          status: 'waiting',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingTicket.id);

      if (updateError) throw updateError;
      existingTicket.status = 'waiting';
    }

    return existingTicket as unknown as Ticket;
  }

  // 2. Se realmente não existe NENHUM ticket na história desse contato, cria o primeiro
  const { data: channels, error: channelError } = await supabase
    .from('channels')
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'connected')
    .limit(1);

  if (channelError) throw channelError;

  if (!channels || channels.length === 0) {
    const { data: anyChannels } = await supabase
      .from('channels')
      .select('id')
      .eq('company_id', companyId)
      .limit(1);

    if (!anyChannels || anyChannels.length === 0) {
      throw new Error('Nenhum canal encontrado. Cadastre um canal primeiro.');
    }
    channels.push(anyChannels[0]);
  }

  const defaultChannelId = channels[0].id;

  const newTicket = {
    company_id: companyId,
    contact_id: contactId,
    channel_id: defaultChannelId,
    status: 'waiting',
    unread_count: 0,
  };

  const { data: createdTicket, error: createError } = await supabase
    .from('tickets')
    .insert([newTicket])
    .select('*')
    .single();

  if (createError) throw createError;

  return createdTicket as unknown as Ticket;
}