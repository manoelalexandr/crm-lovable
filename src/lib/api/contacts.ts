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
  contact_tags?: any[]; // Allow for joined data
}

export async function getContacts(companyId: string) {
  const { data, error } = await supabase
    .from('contacts')
    .select(`
      *,
      contact_tags (
        tags (*)
      )
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ContactData[];
}

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
