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

    if (event === "MESSAGES_UPSERT") {
      const message = data.message;
      const key = message.key;
      const fromMe = key.fromMe;
      const pushName = message.pushName;
      const remoteJid = key.remoteJid;
      const phoneNumber = remoteJid.split("@")[0];
      const messageContent = message.message?.conversation || message.message?.extendedTextMessage?.text || "";

      if (!messageContent) return new Response("Empty message, skipping", { status: 200 });

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

      const companyId = channel.company_id;

      // 2. Encontrar ou criar o contato
      let { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select("*")
        .eq("company_id", companyId)
        .eq("phone", phoneNumber)
        .maybeSingle();

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

      // 3. Encontrar ou criar ticket aberto
      let { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("*")
        .eq("company_id", companyId)
        .eq("contact_id", contact.id)
        .eq("channel_id", channel.id)
        .in("status", ["waiting", "attending"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ticket) {
        // Criar novo ticket se não houver um aberto
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

      // 4. Inserir a mensagem
      const { error: insertMsgError } = await supabase
        .from("messages")
        .insert({
          ticket_id: ticket.id,
          company_id: companyId,
          sender_type: fromMe ? "agent" : "client",
          content: messageContent,
          type: "text",
          status: "received",
          external_id: key.id
        });

      if (insertMsgError) throw insertMsgError;

      // 5. Atualizar meta do ticket
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

    return new Response("Event ignored", { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
