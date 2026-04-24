import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // 1. RESPOSTA IMEDIATA AO CORS (Isso resolve o erro que você viu na tela)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // 2. Inicializa o banco de dados APÓS o CORS passar
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Chaves do Supabase não encontradas no ambiente.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Lê os dados enviados pela sua tela
    const { email, password, name, company_id, role } = await req.json();

    // 4. Cria o usuário no Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { name: name }
    });

    if (authError) throw authError;

    // 5. Atualiza o app_metadata para o sistema reconhecer a empresa
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
      authData.user.id,
      { app_metadata: { company_id: company_id } }
    );

    if (updateAuthError) throw updateAuthError;

    // 6. Salva na tabela company_users
    const { error: profileError } = await supabase
      .from('company_users')
      .insert({
        user_id: authData.user.id,
        company_id: company_id,
        role: role || 'agent',
        name: name,
        email: email,
        display_name: name
      });

    if (profileError) throw profileError;

    // Retorna sucesso
    return new Response(JSON.stringify({ success: true, user: authData.user }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    // Retorna o erro formatado para a tela
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});