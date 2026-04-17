import { supabase } from '../supabase';
import { sendEvolutionMessage } from './channels';

export interface Contact {
  id: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
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
}

export interface Message {
  id: string;
  ticket_id: string;
  sender_type: 'client' | 'agent' | 'bot' | 'system';
  sender_id: string | null;
  content: string;
  type: string;
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
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar mensagens do ticket:', error);
    throw error;
  }

  return (data || []) as Message[];
}

export async function sendMessage(ticketId: string, content: string, companyId: string, agentId: string): Promise<Message> {
  // 1. Busca detalhes do ticket, canal e contato para o envio externo
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select(`
      *,
      contacts!inner (phone),
      channels!inner (type, evolution_instance_name, evolution_api_url, evolution_api_key)
    `)
    .eq('id', ticketId)
    .single();

  if (ticketError) {
    console.error('Erro ao buscar dados para envio:', ticketError);
    throw ticketError;
  }

  const contactPhone = (ticket.contacts as any)?.phone;
  const channel = (ticket.channels as any);

  // 2. Insere a mensagem no banco primeiro (como "pendente" ou "enviando" se quiséssemos, mas aqui seguimos o padrão)
  const { data: msgData, error: msgError } = await supabase
    .from('messages')
    .insert([
      {
        ticket_id: ticketId,
        company_id: companyId,
        sender_type: 'agent',
        sender_id: agentId,
        content: content,
        type: 'text',
        status: 'sent'
      }
    ])
    .select()
    .single();

  if (msgError) {
    console.error('Erro ao salvar mensagem no banco:', msgError);
    throw msgError;
  }

  // 3. Tenta o envio externo via Evolution API se for WhatsApp
  if (channel?.type === 'whatsapp' && channel.evolution_instance_name && contactPhone) {
    try {
      await sendEvolutionMessage(
        channel.evolution_api_url,
        channel.evolution_api_key,
        channel.evolution_instance_name,
        contactPhone,
        content
      );
    } catch (apiError) {
      console.error('Erro no envio via Evolution API, mas mensagem foi salva no banco:', apiError);
      // Opcional: Marcar a mensagem como erro no banco
      await supabase.from('messages').update({ status: 'error' }).eq('id', msgData.id);
    }
  }

  // 4. Atualiza o status do ticket para "atendendo" se estiver "waiting"
  if (ticket.status === 'waiting') {
    await supabase
      .from('tickets')
      .update({ status: 'attending', updated_at: new Date().toISOString() })
      .eq('id', ticketId);
  }

  // 5. Atualiza o last_message do ticket
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
