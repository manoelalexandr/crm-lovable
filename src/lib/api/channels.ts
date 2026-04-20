import { supabase } from '../supabase';

export interface ChannelData {
  id: string;
  company_id: string;
  name: string;
  type: 'whatsapp' | 'instagram' | 'facebook';
  status: 'connected' | 'disconnected' | 'qrcode' | 'connecting';
  evolution_instance_name?: string;
  evolution_api_url?: string;
  evolution_api_key?: string;
  phone_number?: string;
  avatar_url?: string;
  settings?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getChannels(companyId: string) {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ChannelData[];
}

export async function createChannel(channel: Omit<ChannelData, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('channels')
    .insert([channel])
    .select()
    .single();

  if (error) throw error;
  return data as ChannelData;
}

export async function updateChannel(id: string, updates: Partial<ChannelData>) {
  const { data, error } = await supabase
    .from('channels')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ChannelData;
}

export async function deleteChannel(id: string) {
  const { error } = await supabase
    .from('channels')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Lógica Real da Evolution API V2 para buscar QR Code.
export const generateEvolutionQR = async (apiUrl: string, apiKey: string, instanceName: string) => {
  try {
    let formattedUrl = apiUrl.trim();
    if (!formattedUrl.startsWith('http')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    if (formattedUrl.endsWith('/')) {
      formattedUrl = formattedUrl.slice(0, -1);
    }
    const cleanApiKey = apiKey.trim();
    
    // 1. Tenta criar a instância primeiro
    console.log(`[Evolution] Tentando criar instância: ${instanceName} em ${formattedUrl}`);
    const createRes = await fetch(`${formattedUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cleanApiKey
      },
      body: JSON.stringify({
        instanceName: instanceName,
        token: instanceName, // A V2 costuma usar o nome da instância como token por padrão
        qrcode: true,
        integration: "WHATSAPP-BAILEYS" // Parâmetro exigido na V2
      })
    });
    
    if (!createRes.ok) {
      const errText = await createRes.text();
      const isAlreadyExistsError = errText.includes("already exists") || errText.includes("already in use");
      
      if (!isAlreadyExistsError) {
        throw new Error(`Falha ao CRIAR instância (${createRes.status}): ${errText}`);
      }
      console.log(`[Evolution] Instância ${instanceName} já existia.`);
    } else {
      console.log(`[Evolution] Instância ${instanceName} criada com sucesso.`);
    }

    // 1.5. Configura o Webhook para garantir o recebimento de mensagens
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook`;
        console.log(`[Evolution] Configurando webhook para: ${webhookUrl}`);
        
        await fetch(`${formattedUrl}/webhook/set/${instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': cleanApiKey
          },
          body: JSON.stringify({
            webhook: {
              url: webhookUrl,
              byEvents: false,
              base64: false,
              events: [
                "MESSAGES_UPSERT",
                "CONNECTION_UPDATE",
                "SEND_MESSAGE"
              ]
            }
          })
        });
      }
    } catch (webhookErr) {
      console.error("[Evolution] Falha ao configurar webhook, mas prosseguindo...", webhookErr);
    }

    // 2. Busca o QR Code / Conexão
    console.log(`[Evolution] Solicitando QR Code para: ${instanceName}`);
    const connectUrl = `${formattedUrl}/instance/connect/${instanceName}`;
    
    const response = await fetch(connectUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cleanApiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao conectar na Evolution API (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    // Na V2 o retorno costuma ter { code, base64 }
    if (data.base64) {
      return {
        instance: instanceName,
        base64: data.base64
      };
    }

    throw new Error("QR Code não retornado pela API. Verifique se a instância já está conectada.");
  } catch (error) {
    console.error("Erro ao gerar QR Code:", error);
    throw error;
  }
};

/**
 * Verifica o status da conexão diretamente na Evolution API
 */
export async function checkConnectionState(apiUrl: string, apiKey: string, instanceName: string) {
  try {
    let formattedUrl = apiUrl.trim();
    if (!formattedUrl.startsWith('http')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    if (formattedUrl.endsWith('/')) {
      formattedUrl = formattedUrl.slice(0, -1);
    }
    const connectUrl = `${formattedUrl}/instance/connectionState/${instanceName}`;
    
    const response = await fetch(connectUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey.trim()
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    // A V2 costuma retornar { instance: { state: "open" } }
    return data?.instance?.state || data?.state;
  } catch (error) {
    console.error("Erro ao verificar status:", error);
    return null;
  }
}

/**
 * Envia uma mensagem de texto real via Evolution API
 */
export async function sendEvolutionMessage(
  apiUrl: string, 
  apiKey: string, 
  instanceName: string, 
  remoteJid: string, 
  text: string
) {
  try {
    let formattedUrl = apiUrl.trim();
    if (!formattedUrl.startsWith('http')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    if (formattedUrl.endsWith('/')) {
      formattedUrl = formattedUrl.slice(0, -1);
    }
    const sendUrl = `${formattedUrl}/message/sendText/${instanceName}`;
    
    // Remote JID costuma ser o número com @s.whatsapp.net
    // Se vier apenas o número, formatamos
    const number = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;

    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: number,
        text: text,
        linkPreview: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao enviar via Evolution API (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Falha no envio Evolution API:", error);
    throw error;
  }
}

/**
 * Envia mídia (imagem, áudio, etc) via Evolution API
 */
export async function sendEvolutionMedia(
  apiUrl: string, 
  apiKey: string, 
  instanceName: string, 
  remoteJid: string, 
  mediaUrl: string,
  mediaType: 'image' | 'audio' | 'video' | 'document',
  caption?: string
) {
  try {
    let formattedUrl = apiUrl.trim();
    if (!formattedUrl.startsWith('http')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    if (formattedUrl.endsWith('/')) {
      formattedUrl = formattedUrl.slice(0, -1);
    }
    const sendUrl = `${formattedUrl}/message/sendMedia/${instanceName}`;
    const number = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;

    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: number,
        media: mediaUrl,
        mediatype: mediaType,
        caption: caption || ''
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao enviar mídia via Evolution API (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Falha no envio de mídia Evolution API:", error);
    throw error;
  }
}
