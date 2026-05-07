import { supabase } from '../supabase';

export interface ContactData {
  id: string;
  company_id: string;
  name: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  birthday?: string;
  notes?: string;
  extra_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ContactWithTags extends ContactData {
  contact_tags?: { tags: any }[];
}

export const getContacts = async (
  companyId: string,
  userId?: string,     // <-- Novo argumento
  userRole?: string    // <-- Novo argumento
) => {
  // 1. Inicia a busca base dos contactos e das suas respetivas tags
  let query = supabase
    .from('contacts')
    .select(`
      *,
      contact_tags (
        tags (*)
      )
    `)
    .eq('company_id', companyId);

  // 2. A "CERCA": Filtro de Carteirização na lista de contactos
  // Se o utilizador for um atendente (agent), só vê os seus clientes ou os que não têm dono
  if (userRole === 'agent' && userId) {
    query = query.or(`assigned_to.eq.${userId},assigned_to.is.null`);
  }

  // 3. Ordenação
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar contactos:', error);
    throw error;
  }

  return data;
};

export async function createContact(contact: Omit<ContactData, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('contacts')
    .insert([contact])
    .select()
    .single();

  if (error) throw error;
  return data as ContactData;
}

export async function updateContact(id: string, updates: Partial<ContactData>) {
  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ContactData;
}

export async function deleteContact(id: string) {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}
