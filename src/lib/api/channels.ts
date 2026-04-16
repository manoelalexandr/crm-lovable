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

// Lógica simulada da Evolution API para buscar QR Code. 
// Em produção, isso seria uma chamada fetch() para a API real via Edge Function ou backend.
export const generateEvolutionQR = async (apiUrl: string, apiKey: string, instanceName: string) => {
  try {
    // Isso é um Mock. No mundo real você faria:
    // const res = await fetch(`${apiUrl}/instance/connect/${instanceName}`, { 
    //   headers: { "apikey": apiKey } 
    // });
    // return await res.json();
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Payload falso copiando o retorno da Evolution API
    return {
      instance: { instanceName },
      base64: "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=MockedEvolutionApiQRCode" // Placeholder de QR
    };
  } catch (error) {
    console.error("Erro ao gerar QR Code", error);
    throw error;
  }
};
