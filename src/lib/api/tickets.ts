import { supabase } from '@/lib/supabase';

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
  const { data, error } = await supabase
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

  if (error) {
    console.error('Erro ao enviar mensagem:', error);
    throw error;
  }

  return data as Message;
}
