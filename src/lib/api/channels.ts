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
    const formattedUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const cleanApiKey = apiKey.trim();
    
    // 1. Tenta criar a instância primeiro (caso não exista)
    try {
      console.log(`[Evolution] Tentando criar instância: ${instanceName} em ${formattedUrl}`);
      const createRes = await fetch(`${formattedUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': cleanApiKey
        },
        body: JSON.stringify({
          instanceName: instanceName,
          qrcode: true
        })
      });
      
      if (!createRes.ok) {
        const err = await createRes.text();
        console.warn(`[Evolution] Aviso na criação (status ${createRes.status}):`, err);
      } else {
        console.log(`[Evolution] Instância ${instanceName} criada ou já existente.`);
      }
    } catch (e) {
      console.error("[Evolution] Erro fatal na tentativa de criação:", e);
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
      throw new Error(`Erro na Evolution API (${response.status}): ${errorText}`);
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
    const formattedUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
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
