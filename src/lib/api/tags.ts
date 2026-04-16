import { supabase } from '../supabase';

export interface TagData {
  id: string;
  company_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ContactTagData {
  contact_id: string;
  tag_id: string;
  created_at: string;
}

export async function getTags(companyId: string) {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data as TagData[];
}

export async function createTag(companyId: string, name: string, color: string) {
  const { data, error } = await supabase
    .from('tags')
    .insert([{ company_id: companyId, name, color }])
    .select()
    .single();

  if (error) throw error;
  return data as TagData;
}

export async function updateTag(id: string, updates: Partial<TagData>) {
  const { data, error } = await supabase
    .from('tags')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as TagData;
}

export async function deleteTag(id: string) {
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Relacionamentos Contato <-> Tag

export async function getContactTags(contactId: string) {
  const { data, error } = await supabase
    .from('contact_tags')
    .select('*, tags(*)')
    .eq('contact_id', contactId);

  if (error) throw error;
  // Retornamos os dados expandidos da view/join implícito do Supabase
  return data as (ContactTagData & { tags: TagData })[];
}

export async function assignTagToContact(contactId: string, tagId: string) {
  const { data, error } = await supabase
    .from('contact_tags')
    .insert([{ contact_id: contactId, tag_id: tagId }])
    .select()
    .single();

  // Ignora o erro 23505 (unique constraint) caso a tag já esteja vinculada
  if (error && error.code !== '23505') throw error;
  return data as ContactTagData | null;
}

export async function removeTagFromContact(contactId: string, tagId: string) {
  const { error } = await supabase
    .from('contact_tags')
    .delete()
    .match({ contact_id: contactId, tag_id: tagId });

  if (error) throw error;
  return true;
}
