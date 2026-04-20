// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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
      const message = data.message;
      const key = message.key;
      const fromMe = key.fromMe;
      const pushName = message.pushName;
      const remoteJid = key.remoteJid;
      const phoneNumber = remoteJid.split("@")[0];
      
      // Identificar o tipo de mensagem e conteúdo
      const messageType = Object.keys(message.message || {}).find(k => 
        ['conversation', 'extendedTextMessage', 'imageMessage', 'audioMessage', 'videoMessage', 'documentMessage'].includes(k)
      );
      
      let messageContent = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
      let mediaUrl = null;
      let mediaType = "text";

      // 1. Encontrar o canal pela instância
      const { data: channel, error: channelError } = await supabase
        .from("channels")
        .select("*")
        .eq("evolution_instance_name", instanceName)
        .single();

      if (channelError || !channel) {
        console.error("Channel not found for instance:", instanceName);
        return new Response("Channel not found", { status: 404 });
      }

      // 2. Processar Mídia se necessário
      if (['imageMessage', 'audioMessage', 'videoMessage', 'documentMessage'].includes(messageType)) {
        mediaType = messageType.replace('Message', '');
        console.log(`[Webhook] Processando mídia do tipo: ${mediaType}`);
        
        try {
          const fetchMediaUrl = `${channel.evolution_api_url.replace(/\/$/, '')}/chat/fetchMedia`;
          const response = await fetch(fetchMediaUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': channel.evolution_api_key
            },
            body: JSON.stringify({ message: message })
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
                if (!messageContent) messageContent = `[Arquivo de ${mediaType}]`;
              } else {
                console.error("[Storage] Erro no upload:", uploadError);
              }
            }
          }
        } catch (mediaErr) {
          console.error("[Media] Erro ao baixar/salvar mídia:", mediaErr);
        }
      }

      if (!messageContent && !mediaUrl) return new Response("Empty message, skipping", { status: 200 });

      const companyId = channel.company_id;

      // 3. Encontrar ou criar o contato
      const { data: existingContact, error: contactError } = await supabase
        .from("contacts")
        .select("*")
        .eq("company_id", companyId)
        .eq("phone", phoneNumber)
        .maybeSingle();

      let contact = existingContact;

      if (!contact) {
        const { data: newContact, error: createContactError } = await supabase
          .from("contacts")
          .insert({
            company_id: companyId,
            name: pushName || phoneNumber,
            phone: phoneNumber,
          })
          .select()
          .single();
        
        if (createContactError) throw createContactError;
        contact = newContact;
      }

      // 4. Encontrar ou criar ticket aberto
      const { data: existingTicket, error: ticketError } = await supabase
        .from("tickets")
        .select("*")
        .eq("company_id", companyId)
        .eq("contact_id", contact.id)
        .eq("channel_id", channel.id)
        .in("status", ["waiting", "attending"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let ticket = existingTicket;

      if (!ticket) {
        const { data: newTicket, error: createTicketError } = await supabase
          .from("tickets")
          .insert({
            company_id: companyId,
            contact_id: contact.id,
            channel_id: channel.id,
            status: "waiting",
            source: "whatsapp",
            unread_count: 0
          })
          .select()
          .single();

        if (createTicketError) throw createTicketError;
        ticket = newTicket;
      }

      // 5. Inserir a mensagem
      const { error: insertMsgError } = await supabase
        .from("messages")
        .insert({
          ticket_id: ticket.id,
          company_id: companyId,
          sender_type: fromMe ? "agent" : "client",
          content: messageContent,
          type: mediaUrl ? mediaType : "text",
          media_url: mediaUrl,
          status: "received",
          external_id: key.id
        });

      if (insertMsgError) throw insertMsgError;

      // 6. Atualizar meta do ticket
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
      console.log("Connection update received:", data);
      const state = data.state; // 'open', 'connecting', 'close', etc.
      
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

      if (updateError) {
        console.error("Error updating channel status:", updateError);
        return new Response("Error updating status", { status: 500 });
      }

      return new Response("Status updated", { status: 200 });
    }

    return new Response("Event ignored", { status: 200 });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return new Response(`Error: ${error?.message || String(error)}`, { status: 500 });
  }
});
