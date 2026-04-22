import { supabase } from '../supabase';

export interface QuickResponse {
  id: string;
  company_id: string;
  shortcut: string;
  content: string;
  created_at: string;
}

export async function getQuickResponses(companyId: string): Promise<QuickResponse[]> {
  const { data, error } = await supabase
    .from('quick_responses')
    .select('*')
    .eq('company_id', companyId)
    .order('shortcut', { ascending: true });

  if (error) throw error;
  return (data || []) as QuickResponse[];
}

export async function createQuickResponse(
  companyId: string,
  shortcut: string,
  content: string
): Promise<QuickResponse> {
  // Normaliza o atalho: lowercase, sem espaços, com prefixo "/"
  const normalizedShortcut = shortcut.trim().toLowerCase().replace(/\s+/g, '_').replace(/^(?!\/)/, '/');

  const { data, error } = await supabase
    .from('quick_responses')
    .insert({ company_id: companyId, shortcut: normalizedShortcut, content: content.trim() })
    .select()
    .single();

  if (error) throw error;
  return data as QuickResponse;
}

export async function updateQuickResponse(
  id: string,
  updates: { shortcut?: string; content?: string }
): Promise<void> {
  const payload: { shortcut?: string; content?: string } = {};
  if (updates.shortcut) {
    payload.shortcut = updates.shortcut.trim().toLowerCase().replace(/\s+/g, '_').replace(/^(?!\/)/, '/');
  }
  if (updates.content) {
    payload.content = updates.content.trim();
  }

  const { error } = await supabase
    .from('quick_responses')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteQuickResponse(id: string): Promise<void> {
  const { error } = await supabase
    .from('quick_responses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
