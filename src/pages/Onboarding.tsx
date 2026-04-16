import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Onboarding = () => {
  const { user, refreshCompany } = useAuth();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    try {
      // 1. Gera o slug da empresa a partir do nome
      const slug = companyName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const finalDisplayName = displayName || user.email?.split("@")[0] || "Administrador";

      // 2. Chama a Action RPC no Supabase que faz a transação no servidor com segurança.
      const { data: companyId, error: rpcError } = await supabase.rpc('create_new_company', {
        p_name: companyName,
        p_slug: slug,
        p_display_name: finalDisplayName
      });

      if (rpcError) {
        if (rpcError.message.includes('duplicate_slug')) {
          toast.error("Uma empresa com esse nome já existe. Escolha outro nome.");
        } else {
          throw rpcError;
        }
        setIsLoading(false);
        return;
      }

      // 3. Atualiza o contexto (força buscar o novo company_users que o banco acabou de criar) e redireciona
      await refreshCompany();
      toast.success(`Empresa "${companyName}" criada com sucesso!`);
      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao criar empresa: " + (error.message || "Erro desconhecido"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <div className="w-full max-w-md bg-card rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Bem-vindo ao TRIP.ia!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Antes de começar, vamos configurar sua empresa.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Nome da Empresa *</Label>
            <Input
              id="company-name"
              placeholder="Ex: Minha Empresa Ltda"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              disabled={isLoading}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-name">Seu nome (como atendente)</Label>
            <Input
              id="display-name"
              placeholder="Ex: João Silva"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isLoading}
              className="h-11"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-base font-semibold mt-2"
            disabled={isLoading || !companyName.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Criando empresa...
              </>
            ) : (
              "Criar empresa e continuar"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
