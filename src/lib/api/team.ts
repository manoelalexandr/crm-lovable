import { supabase } from '../supabase';

export async function createTeamMember(email: string, password: string, name: string, companyId: string, role: string = 'agent') {
    const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
            email,
            password,
            name,
            company_id: companyId,
            role
        }
    });

    if (error) {
        throw new Error("Erro de conexão ao criar usuário");
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    return data;
}

export async function getTeamMembers(companyId: string) {
    // Removemos o join com a tabela de users para parar o Erro 400
    const { data, error } = await supabase
        .from('company_users')
        .select('*')
        .eq('company_id', companyId);

    if (error) {
        console.error("Erro ao buscar equipe:", error);
        throw error;
    }

    return data;
}