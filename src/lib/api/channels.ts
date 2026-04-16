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
    const connectUrl = `${formattedUrl}/instance/connect/${instanceName}`;
    
    const response = await fetch(connectUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
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
