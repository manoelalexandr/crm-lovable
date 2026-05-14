import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log("Webhook received:", JSON.stringify(payload, null, 2));

    const event = payload.event;
    const instanceName = payload.instance;
    const data = payload.data;

    if (event === "MESSAGES_UPSERT" || event === "messages.upsert") {
      // 1. TRAVAS DE SEGURANÇA ULTRA ROBUSTAS
      let actualData = data;
      if (Array.isArray(data)) {
        actualData = data[0];
      } else if (data?.messages && Array.isArray(data.messages)) {
        actualData = data.messages[0];
      }

      const messageObj = actualData?.message;
      const key = actualData?.key || messageObj?.key;
      const pushName = actualData?.pushName || messageObj?.pushName || "";

      if (!key) {
        return new Response("No key object", { status: 200 });
      }

      const remoteJid = key?.remoteJid;
      if (!remoteJid || remoteJid === "status@broadcast") {
        return new Response("Ignored broadcast", { status: 200 });
      }

      const fromMe = key?.fromMe;

      // --- MAGIA DOS GRUPOS AQUI ---
      const isGroup = remoteJid.includes('@g.us');
      // Se for grupo, guarda com o @g.us! Se for pessoa, limpa o arroba.
      const phoneNumber = isGroup ? remoteJid : remoteJid.split("@")[0];
      const participant = key?.participant; // ID de quem falou no grupo
      // ------------------------------

      const messageType = actualData?.messageType || Object.keys(messageObj || {}).find(k =>
        ['conversation', 'extendedTextMessage', 'imageMessage', 'audioMessage', 'videoMessage', 'documentMessage'].includes(k)
      );

      let messageContent = messageObj?.conversation || messageObj?.extendedTextMessage?.text || "";
      let mediaUrl = null;
      let mediaType = "text";

      if (!messageContent && !messageType) {
        return new Response("Empty content", { status: 200 });
      }

      const { data: channel, error: channelError } = await supabase
        .from("channels")
        .select("*")
        .eq("evolution_instance_name", instanceName)
        .single();

      if (channelError || !channel) {
        return new Response("Channel not found", { status: 404 });
      }

      // Processar Mídia
      if (['imageMessage', 'audioMessage', 'videoMessage', 'documentMessage'].includes(messageType || '')) {
        mediaType = messageType!.replace('Message', '');

        try {
          const fetchMediaUrl = `${channel.evolution_api_url.replace(/\/$/, '')}/chat/getBase64FromMediaMessage/${instanceName}`;
          const response = await fetch(fetchMediaUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': channel.evolution_api_key
            },
            body: JSON.stringify({ message: messageObj })
          });

          if (response.ok) {
            const mediaData = await response.json();
            const base64Data = mediaData.base64 || mediaData.media;

            if (base64Data) {
              const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              const fileName = `${Date.now()}-${key.id}.${mediaType === 'audio' ? 'ogg' : mediaType === 'image' ? 'jpg' : 'bin'}`;
              const filePath = `${channel.company_id}/${fileName}`;

              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('chat_media')
                .upload(filePath, buffer, {
                  contentType: mediaType === 'audio' ? 'audio/ogg' : mediaType === 'image' ? 'image/jpeg' : 'application/octet-stream',
                  upsert: true
                });

              if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath);
                mediaUrl = publicUrl;
              }
            }
          }
        } catch (mediaErr) {
          console.error("[Media] Erro ao baixar/salvar mídia:", mediaErr);
        }
      }

      // --- INJEÇÃO DE QUEM FALOU NO GRUPO ---
      if (isGroup && !fromMe) {
        const senderName = pushName || "Membro do Grupo";
        if (messageContent) {
          messageContent = `*[${senderName}]*\n${messageContent}`;
        } else if (mediaUrl) {
          messageContent = `*[${senderName}] enviou um arquivo*`;
        }
      } else if (!messageContent && mediaUrl) {
        messageContent = `[Arquivo de ${mediaType}]`;
      }
      // --------------------------------------

      if (!messageContent && !mediaUrl) return new Response("Empty message, skipping", { status: 200 });

      const companyId = channel.company_id;

      // --- NOME E DADOS DO CONTATO / GRUPO ---
      let contactName = pushName || phoneNumber;

      const { data: existingContact, error: contactError } = await supabase
        .from("contacts")
        .select("*")
        .eq("company_id", companyId)
        .eq("phone", phoneNumber)
        .maybeSingle();

      let contact = existingContact;

      // Se o contato/grupo não existe, vamos criar
      if (!contact) {
        let avatarUrl = null;

        if (isGroup) {
          const groupLastDigits = phoneNumber.split('@')[0].slice(-4);
          contactName = `Grupo (${groupLastDigits})`; // Nome provisório

          // Vai à Evolution API perguntar o nome real e a foto do grupo!
          try {
            const groupMetaUrl = `${channel.evolution_api_url.replace(/\/$/, '')}/group/findGroupMetadata/${instanceName}?groupJid=${remoteJid}`;
            const metaRes = await fetch(groupMetaUrl, {
              method: 'GET',
              headers: { 'apikey': channel.evolution_api_key }
            });
            if (metaRes.ok) {
              const meta = await metaRes.json();
              if (meta && meta.subject) contactName = meta.subject; // Nome real do grupo
            }

            // Busca a foto do grupo
            const picUrl = `${channel.evolution_api_url.replace(/\/$/, '')}/chat/fetchProfilePictureUrl/${instanceName}`;
            const picRes = await fetch(picUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': channel.evolution_api_key },
              body: JSON.stringify({ number: remoteJid })
            });
            if (picRes.ok) {
              const picData = await picRes.json();
              if (picData && picData.profilePictureUrl) avatarUrl = picData.profilePictureUrl;
            }
          } catch (e) {
            console.error("[Webhook] Erro ao buscar dados do grupo", e);
          }
        }

        const { data: newContact, error: createContactError } = await supabase
          .from("contacts")
          .insert({
            company_id: companyId,
            name: contactName,
            phone: phoneNumber,
            avatar_url: avatarUrl // Já salva com a foto!
          })
          .select()
          .single();

        if (createContactError) throw createContactError;
        contact = newContact;
      }

      const { data: activeTicket } = await supabase
        .from("tickets")
        .select("*")
        .eq("company_id", companyId)
        .eq("contact_id", contact.id)
        .eq("channel_id", channel.id)
        .in("status", ["waiting", "attending"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let ticket = activeTicket;

      if (!ticket) {
        const { data: newTicket, error: createTicketError } = await supabase
          .from("tickets")
          .insert({
            company_id: companyId,
            contact_id: contact.id,
            channel_id: channel.id,
            status: "waiting",
            source: channel.type || "whatsapp",
            unread_count: 0,
          })
          .select()
          .single();

        if (createTicketError) throw createTicketError;
        ticket = newTicket;
      }

      const { error: insertMsgError } = await supabase
        .from("messages")
        .insert({
          ticket_id: ticket.id,
          company_id: companyId,
          sender_type: fromMe ? "agent" : "client",
          content: messageContent,
          type: mediaUrl ? mediaType : "text",
          media_url: mediaUrl,
          external_id: key.id
        });

      if (insertMsgError) throw insertMsgError;

      await supabase
        .from("tickets")
        .update({
          last_message: messageContent,
          last_message_at: new Date().toISOString(),
          unread_count: fromMe ? ticket.unread_count : (ticket.unread_count + 1),
          updated_at: new Date().toISOString()
        })
        .eq("id", ticket.id);

      return new Response("Message processed", { status: 200 });
    }

    if (event === "CONNECTION_UPDATE") {
      const state = data.state;
      let dbStatus = 'disconnected';
      if (state === 'open') dbStatus = 'connected';
      else if (state === 'connecting') dbStatus = 'connecting';

      const { error: updateError } = await supabase
        .from("channels")
        .update({
          status: dbStatus,
          updated_at: new Date().toISOString()
        })
        .eq("evolution_instance_name", instanceName);

      return new Response("Status updated", { status: 200 });
    }

    return new Response("Event ignored", { status: 200 });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return new Response(`Error: ${error?.message || String(error)}`, { status: 500 });
  }
});