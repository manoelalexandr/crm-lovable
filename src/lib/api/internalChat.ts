import { supabase } from '../supabase';

export interface InternalChat {
    id: string;
    company_id: string;
    name: string | null;
    type: string;
    created_by: string;
    created_at: string;
    // Campos virtuais que traremos com os joins
    other_user?: { id: string; name: string; avatar_url: string | null };
    last_message?: string;
    unread_count?: number;
}

export interface InternalMessage {
    id: string;
    chat_id: string;
    company_id: string;
    user_id: string;
    content: string;
    type: string;
    media_url: string | null;
    read_by: string[];
    created_at: string;
    sender_name?: string;
}

// 1. Busca todos os colegas da empresa (para iniciar um novo chat)
export async function getCompanyColleagues(companyId: string, currentUserId: string) {
    const { data, error } = await supabase
        .from('company_users')
        .select('user_id, display_name, status')
        .eq('company_id', companyId)
        .neq('user_id', currentUserId)
        .eq('is_active', true);

    if (error) throw error;
    return data;
}

// 2. Busca os chats que o usuário participa
export async function getMyChats(companyId: string, userId: string) {
    // Busca os IDs dos chats que o usuário faz parte
    const { data: myMemberships, error: memberError } = await supabase
        .from('internal_chat_members')
        .select('chat_id')
        .eq('user_id', userId)
        .eq('company_id', companyId);

    if (memberError) throw memberError;

    if (!myMemberships || myMemberships.length === 0) return [];

    const chatIds = myMemberships.map(m => m.chat_id);

    // Busca os detalhes desses chats
    const { data: chats, error: chatsError } = await supabase
        .from('internal_chats')
        .select('*')
        .in('id', chatIds)
        .order('created_at', { ascending: false });

    if (chatsError) throw chatsError;
    return chats as InternalChat[];
}

// 3. Busca as mensagens de um chat específico
export async function getChatMessages(chatId: string) {
    const { data, error } = await supabase
        .from('internal_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

    if (error) throw error;

    return data as InternalMessage[];
}

// 4. Envia uma nova mensagem
export async function sendInternalMessage(
    chatId: string,
    companyId: string,
    userId: string,
    content: string,
    type: string = 'text',
    mediaUrl: string | null = null
) {
    const { data, error } = await supabase
        .from('internal_messages')
        .insert({
            chat_id: chatId,
            company_id: companyId,
            user_id: userId,
            content,
            type,
            media_url: mediaUrl,
            read_by: [userId] // Já marca como lida por quem enviou
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// 5. Abre um chat existente ou inicia um novo chat direto com um colega
export async function createDirectChat(companyId: string, currentUserId: string, targetUserId: string) {
    // 1. Busca os IDs dos chats que o usuário atual faz parte
    const { data: myMemberships, error: err1 } = await supabase
        .from('internal_chat_members')
        .select('chat_id')
        .eq('user_id', currentUserId);

    if (err1) throw err1;

    if (myMemberships && myMemberships.length > 0) {
        const myChatIds = myMemberships.map(m => m.chat_id);

        // 2. Busca se o usuário alvo (colega) está em algum desses mesmos chats
        const { data: targetMemberships, error: err2 } = await supabase
            .from('internal_chat_members')
            .select('chat_id')
            .eq('user_id', targetUserId)
            .in('chat_id', myChatIds);

        if (err2) throw err2;

        if (targetMemberships && targetMemberships.length > 0) {
            const commonChatIds = targetMemberships.map(m => m.chat_id);

            // 3. Verifica qual desses chats em comum é do tipo 'direct'
            const { data: existingChats, error: err3 } = await supabase
                .from('internal_chats')
                .select('*')
                .in('id', commonChatIds)
                .eq('type', 'direct');

            // Se achou um chat direto já existente, retorna ele! (Traz o histórico de volta)
            if (existingChats && existingChats.length > 0) {
                return existingChats[0] as InternalChat;
            }
        }
    }

    // 4. Se chegou até aqui, é porque NÃO EXISTE chat. Então vamos criar um novo!
    const { data: newChat, error: chatError } = await supabase
        .from('internal_chats')
        .insert({
            company_id: companyId,
            type: 'direct',
            created_by: currentUserId
        })
        .select()
        .single();

    if (chatError) throw chatError;

    // Adiciona os dois membros na sala recém-criada
    const { error: membersError } = await supabase
        .from('internal_chat_members')
        .insert([
            { chat_id: newChat.id, user_id: currentUserId, company_id: companyId },
            { chat_id: newChat.id, user_id: targetUserId, company_id: companyId }
        ]);

    if (membersError) throw membersError;

    return newChat as InternalChat;
}