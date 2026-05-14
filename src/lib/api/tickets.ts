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

export const getTickets = async (
  companyId: string,
  status: "aguardando" | "atendendo" | "resolvido" | "grupos", // Aceita o status 'grupos'
  userId?: string,
  userRole?: string
) => {
  // 1. Inicia a busca (Usando o inner join para podermos filtrar pelo telefone)
  let query = supabase
    .from('tickets')
    .select(`*, contacts!inner(*)`)
    .eq('company_id', companyId);

  // 2. Filtro de Status e Separação de Grupos
  if (status === 'grupos') {
    // Se estiver na aba grupos, puxa APENAS os contatos que têm "g.us" no telefone
    query = query.like('contacts.phone', '%g.us%');
  } else {
    // Se não for a aba grupos, ESCONDE os grupos para não poluir o atendimento normal
    query = query.not('contacts.phone', 'like', '%g.us%');

    if (status === 'aguardando') {
      query = query.in('status', ['waiting', 'pending']);
    } else if (status === 'atendendo') {
      query = query.eq('status', 'attending');
    } else if (status === 'resolvido') {
      query = query.eq('status', 'resolved');
    }
  }

  // 3. A "CERCA": Filtro de Carteirização
  if (userRole === 'agent' && userId) {
    query = query.or(`assigned_to.eq.${userId},assigned_to.is.null`);
  }

  // 4. Ordenação
  query = query.order('updated_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar tickets:', error);
    throw error;
  }

  return data;
};

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

export async function importChatHistory(ticketId: string, companyId: string, agentId: string) {
  // 1. Busca os dados do ticket, canal e contato
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select(`
      *,
      contacts!inner (phone),
      channels!inner (type, evolution_instance_name, evolution_api_url, evolution_api_key)
    `)
    .eq('id', ticketId)
    .single();

  if (ticketError) throw new Error('Ticket não encontrado.');

  const contactPhone = (ticket.contacts as any)?.phone;
  const channel = (ticket.channels as any);

  if (channel?.type !== 'whatsapp' || !channel.evolution_instance_name || !contactPhone) {
    throw new Error('Canal não configurado ou contato sem telefone válido.');
  }

  // 2. Prepara os dados para a Evolution API
  const isGroup = contactPhone.includes('g.us');
  const remoteJid = isGroup
    ? contactPhone
    : `${contactPhone.replace(/\D/g, '')}@s.whatsapp.net`;

  try {
    // 3. Faz a requisição para a Evolution API puxar o histórico
    const response = await fetch(`${channel.evolution_api_url}/chat/findMessages/${channel.evolution_instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': channel.evolution_api_key
      },
      body: JSON.stringify({
        where: {
          key: { remoteJid: remoteJid }
        },
        limit: 100
      })
    });

    // --- ESTA É A PARTE NOVA E ROBUSTA QUE ADICIONAMOS ---
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("Erro HTTP da Evolution:", errData);
      throw new Error(errData.response?.message || errData.message || 'Falha ao conectar com a Evolution API');
    }

    const data = await response.json();
    console.log("🕵️ Resposta da Evolution API:", data);

    let messagesToImport = [];

    if (Array.isArray(data)) {
      messagesToImport = data;
    } else if (data.messages && Array.isArray(data.messages)) {
      messagesToImport = data.messages;
    } else if (data.messages?.records && Array.isArray(data.messages.records)) {
      messagesToImport = data.messages.records;
    } else if (data.records && Array.isArray(data.records)) {
      messagesToImport = data.records;
    } else {
      throw new Error(data.error || data.message || "A API não retornou uma lista de mensagens válida.");
    }
    // --- FIM DA PARTE NOVA ---

    if (messagesToImport.length === 0) {
      return 0; // Nenhuma mensagem nova para importar
    }

    // 4. Mapeia as mensagens
    const formattedMessages = messagesToImport.map((msg: any) => {
      const isFromMe = msg.key.fromMe;

      let content = '';
      if (msg.message?.conversation) content = msg.message.conversation;
      else if (msg.message?.extendedTextMessage?.text) content = msg.message.extendedTextMessage.text;
      else if (msg.message?.imageMessage?.caption) content = msg.message.imageMessage.caption;
      else content = '[Mensagem de Mídia/Sistema]';

      // Tratamento extra de segurança para o timestamp
      let messageDate = new Date();
      if (msg.messageTimestamp) {
        // Se for string ou numero em segundos
        const ts = typeof msg.messageTimestamp === 'string' ? parseInt(msg.messageTimestamp) : msg.messageTimestamp;
        // Evolution costuma mandar em segundos, multiplicamos por 1000 para ms
        messageDate = new Date(ts > 1000000000000 ? ts : ts * 1000);
      }

      return {
        ticket_id: ticketId,
        company_id: companyId,
        sender_type: isFromMe ? 'agent' : 'client',
        sender_id: isFromMe ? agentId : null,
        content: content,
        type: msg.message?.imageMessage ? 'image' : msg.message?.audioMessage ? 'audio' : 'text',
        status: 'sent',
        created_at: messageDate.toISOString()
      };
    });

    // 5. Salva no Supabase
    const { error: insertError } = await supabase
      .from('messages')
      .insert(formattedMessages.reverse());

    if (insertError) throw insertError;

    return formattedMessages.length;

  } catch (error: any) {
    console.error('Erro na importação:', error);
    throw new Error(error.message || 'Não foi possível importar as mensagens do aparelho.');
  }
}

// Adicione o parâmetro forceUpdate = false
export async function syncContactAvatar(ticketId: string, contactId: string, forceUpdate: boolean = false) {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(`
      contacts!inner (phone, avatar_url),
      channels!inner (type, evolution_instance_name, evolution_api_url, evolution_api_key)
    `)
    .eq('id', ticketId)
    .single();

  if (error || !ticket) return;

  const contactData = ticket.contacts as any;
  const channelData = ticket.channels as any;

  // AGORA: Só encerra se já tiver foto E não for uma atualização forçada
  if ((contactData.avatar_url && !forceUpdate) || !channelData.evolution_instance_name || !contactData.phone) {
    return;
  }

  try {
    const response = await fetch(`${channelData.evolution_api_url}/chat/fetchProfilePictureUrl/${channelData.evolution_instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': channelData.evolution_api_key
      },
      body: JSON.stringify({
        number: contactData.phone.replace(/\D/g, '')
      })
    });

    const data = await response.json();

    if (data && data.profilePictureUrl) {
      await supabase
        .from('contacts')
        .update({ avatar_url: data.profilePictureUrl })
        .eq('id', contactId);
    } else if (forceUpdate) {
      // Se forçamos a busca e a Evolution disse que ele não tem foto, removemos o link quebrado
      await supabase.from('contacts').update({ avatar_url: null }).eq('id', contactId);
    }
  } catch (error) {
    console.error('Erro ao buscar foto de perfil na Evolution:', error);
  }
}
