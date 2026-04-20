import { useState } from "react";
import { Plus, Wifi, WifiOff, Smartphone, Instagram, Loader2, QrCode, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChannels, createChannel, updateChannel, deleteChannel, generateEvolutionQR, checkConnectionState, ChannelData } from "@/lib/api/channels";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

const Conexoes = () => {
  const { company } = useAuth();
  const queryClient = useQueryClient();
  const companyId = company?.id;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  
  // States do formulário
  const [name, setName] = useState("");
  const [type, setType] = useState<'whatsapp' | 'instagram'>('whatsapp');
  const [evoUrl, setEvoUrl] = useState("http://sua-evolution-api.com");
  const [evoKey, setEvoKey] = useState("SUA_API_KEY_GLOBAL");
  
  const [activeQrCode, setActiveQrCode] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<ChannelData | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["channels", companyId],
    queryFn: () => getChannels(companyId!),
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        company_id: companyId!,
        name,
        type,
        status: 'disconnected' as const,
        is_active: true,
        evolution_instance_name: `${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 10)}-${companyId?.slice(0, 8)}`,
        evolution_api_url: evoUrl,
        evolution_api_key: evoKey,
      };
      return createChannel(payload);
    },
    onSuccess: (newChannel) => {
      queryClient.invalidateQueries({ queryKey: ["channels", companyId] });
      setIsModalOpen(false);
      setName("");
      setIsEditMode(false);
      setSelectedChannel(null);
      toast.success(isEditMode ? "Conexão atualizada!" : "Conexão salva!");
      
      if (!isEditMode && newChannel.type === 'whatsapp') {
        openQrCode(newChannel);
      }
    },
    onError: () => toast.error("Erro ao salvar conexão")
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) => {
      const payload = {
        name,
        type,
        evolution_api_url: evoUrl,
        evolution_api_key: evoKey,
      };
      return updateChannel(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", companyId] });
      setIsModalOpen(false);
      setIsEditMode(false);
      setSelectedChannel(null);
      toast.success("Conexão atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar conexão")
  });

  const testConnection = async () => {
    setIsTestingConn(true);
    try {
      const formattedUrl = evoUrl.endsWith('/') ? evoUrl.slice(0, -1) : evoUrl;
      const cleanKey = evoKey.trim();
      const res = await fetch(`${formattedUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: { 'apikey': cleanKey }
      });
      
      if (res.ok) {
        toast.success("Conexão bem-sucedida! A URL e a Chave estão corretas.");
      } else {
        const err = await res.text();
        toast.error(`Falha na conexão: ${res.status} (Verifique a API Key)`);
        console.error("Erro no teste:", err);
      }
    } catch (e) {
      toast.error("Erro ao tentar alcançar o servidor. Verifique a URL.");
      console.error(e);
    } finally {
      setIsTestingConn(false);
    }
  };

  const handleEdit = (channel: ChannelData) => {
    setSelectedChannel(channel);
    setName(channel.name);
    setType(channel.type as 'whatsapp' | 'instagram');
    setEvoUrl(channel.evolution_api_url || "");
    setEvoKey(channel.evolution_api_key || "");
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", companyId] });
      toast.success("Conexão removida!");
    },
    onError: () => toast.error("Erro ao remover conexão")
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => updateChannel(id, { status: 'disconnected' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", companyId] });
      toast.success("Conexão desconectada!");
    }
  });

  const openQrCode = async (channel: ChannelData) => {
    setSelectedChannel(channel);
    setIsQrModalOpen(true);
    setIsGeneratingQr(true);
    
    try {
      if (channel.evolution_api_url && channel.evolution_instance_name) {
        const res = await generateEvolutionQR(channel.evolution_api_url, channel.evolution_api_key || '', channel.evolution_instance_name);
        setActiveQrCode(res.base64);
      } else {
        toast.error("Configurações da Evolution API ausentes neste canal.");
        setIsQrModalOpen(false);
      }
    } catch (error: any) {
      // Se falhou ao gerar o QR, pode ser que já esteja conectado. Vamos verificar o status.
      if (channel.evolution_api_url && channel.evolution_instance_name) {
        try {
          const state = await checkConnectionState(channel.evolution_api_url, channel.evolution_api_key || '', channel.evolution_instance_name);
          if (state === 'open') {
            await updateChannel(channel.id, { status: 'connected' });
            queryClient.invalidateQueries({ queryKey: ["channels", companyId] });
            toast.success(`${channel.name} já estava conectado!`);
          } else {
            toast.error(error?.message || "Erro ao gerar QR Code");
          }
        } catch (e) {
          toast.error("Erro ao gerar QR Code");
        }
      }
      setIsQrModalOpen(false);
    } finally {
      setIsGeneratingQr(false);
    }
  };

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('channels_realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'channels',
          filter: `company_id=eq.${companyId}`,
        },
        (payload: { new: any }) => {
          console.log("Realtime Channel Update:", payload);
          queryClient.invalidateQueries({ queryKey: ["channels", companyId] });
          
          if (selectedChannel?.id === (payload.new as ChannelData).id) {
            const newStatus = (payload.new as ChannelData).status;
            if (newStatus === 'connected') {
              setIsQrModalOpen(false);
              setActiveQrCode(null);
              toast.success(`${(payload.new as any).name} conectado com sucesso!`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, selectedChannel?.id, queryClient]);

  // Fallback Polling for connection status when QR Modal is open
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (isQrModalOpen && selectedChannel?.evolution_instance_name && selectedChannel?.evolution_api_url) {
      pollInterval = setInterval(async () => {
        try {
          const state = await checkConnectionState(
            selectedChannel.evolution_api_url!,
            selectedChannel.evolution_api_key || '',
            selectedChannel.evolution_instance_name!
          );

          if (state === 'open') {
            console.log("Polling detected open connection!");
            clearInterval(pollInterval);
            
            // Sync status with our database
            await updateChannel(selectedChannel.id, { status: 'connected' });
            queryClient.invalidateQueries({ queryKey: ["channels", companyId] });
            
            setIsQrModalOpen(false);
            setActiveQrCode(null);
            toast.success(`${selectedChannel.name} conectado com sucesso!`);
          }
        } catch (e) {
          console.error("Error polling connection state:", e);
        }
      }, 5000); // Check every 5 seconds
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isQrModalOpen, selectedChannel, companyId, queryClient]);

  const simulateSuccessfulConnection = () => {
    if (selectedChannel) {
      updateChannel(selectedChannel.id, { status: 'connected' }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["channels", companyId] });
        setIsQrModalOpen(false);
        setActiveQrCode(null);
        toast.success(`${selectedChannel.name} conectado com sucesso!`);
      });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Certeza que deseja excluir esta conexão permanente?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected': return <Badge className="bg-success">Conectado</Badge>;
      case 'disconnected': return <Badge variant="destructive">Desconectado</Badge>;
      case 'qrcode': return <Badge variant="secondary" className="bg-warning text-warning-foreground">Aguardando QR Code</Badge>;
      case 'connecting': return <Badge variant="outline">Conectando...</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 h-[calc(100vh-3rem)] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-primary">Gerenciar Conexões</h1>
          <p className="text-sm text-muted-foreground mt-1">Conecte seus números de WhatsApp e perfis do Instagram.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Conexão
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {channels.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-card border border-border border-dashed rounded-lg">
            <Smartphone className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-lg font-medium">Nenhuma conexão ativa</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Você ainda não conectou nenhum canal. Adicione seu WhatsApp ou Instagram para começar a receber tickets.
            </p>
            <Button onClick={() => setIsModalOpen(true)} size="sm" variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-1" /> Adicionar Canal
            </Button>
          </div>
        ) : (
          channels.map(channel => (
            <Card key={channel.id} className="relative overflow-hidden group">
              <div className={`absolute top-0 left-0 w-1.5 h-full ${channel.status === 'connected' ? 'bg-success' : 'bg-destructive'}`} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${channel.type === 'whatsapp' ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white'}`}>
                      {channel.type === 'whatsapp' ? <Smartphone className="h-6 w-6" /> : <Instagram className="h-6 w-6" />}
                    </div>
                    <div>
                      <CardTitle className="text-base">{channel.name}</CardTitle>
                      <CardDescription className="uppercase mt-0.5 text-[10px] tracking-wider font-semibold">
                        {channel.type}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(channel.status)}
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="grid grid-cols-2 gap-2 text-sm bg-secondary/30 p-3 rounded-md">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Número / ID</p>
                    <p className="font-medium truncate">{channel.phone_number || "Não identificado"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Atualização</p>
                    <p className="font-medium">{format(new Date(channel.updated_at), 'dd/MM/yy HH:mm')}</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0 flex gap-2 border-t border-border pt-3">
                {channel.status === 'connected' ? (
                  <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => disconnectMutation.mutate(channel.id)}>
                    <WifiOff className="h-4 w-4 mr-2" /> Desconectar
                  </Button>
                ) : (
                  <Button size="sm" className="flex-1" onClick={() => openQrCode(channel)}>
                    <QrCode className="h-4 w-4 mr-2" /> Gerar QR Code
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary" onClick={() => handleEdit(channel)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(channel.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) {
          setIsEditMode(false);
          setName("");
        }
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Editar Conexão" : "Nova Conexão"}</DialogTitle>
            <DialogDescription>Configure os dados do servidor Evolution API.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Canal</Label>
              <Select value={type} onValueChange={(val: 'whatsapp' | 'instagram') => setType(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp (Evolution API)</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nome interno da conexão</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Suporte Principal" />
            </div>

            {type === 'whatsapp' && (
              <>
                <div className="flex flex-col gap-2 mt-2">
                  <Label htmlFor="evoUrl" className="text-xs text-muted-foreground">URL da Evolution API (Avançado)</Label>
                  <Input id="evoUrl" value={evoUrl} onChange={(e) => setEvoUrl(e.target.value)} className="h-8 text-xs bg-secondary" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="evoKey" className="text-xs text-muted-foreground">Global API Key (Avançado)</Label>
                  <Input id="evoKey" type="password" value={evoKey} onChange={(e) => setEvoKey(e.target.value)} className="h-8 text-xs bg-secondary" />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" size="sm" onClick={testConnection} disabled={isTestingConn || !evoUrl || !evoKey} className="text-xs">
              {isTestingConn ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wifi className="h-3 w-3 mr-1" />}
              Testar Conexão
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => isEditMode ? updateMutation.mutate(selectedChannel!.id) : saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending || updateMutation.isPending}>
              {saveMutation.isPending || updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEditMode ? "Salvar Alterações" : "Salvar e Conectar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal QR Code */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="sm:max-w-[400px] text-center flex flex-col items-center">
          <DialogHeader className="text-center w-full">
            <DialogTitle className="text-center">Leia o QR Code</DialogTitle>
            <DialogDescription className="text-center">
              Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e aponte a câmera.
            </DialogDescription>
          </DialogHeader>
          
          <div className="my-6 p-4 bg-white rounded-xl border border-border shadow-sm flex items-center justify-center min-h-[250px] min-w-[250px]">
             {isGeneratingQr ? (
               <div className="flex flex-col items-center gap-3">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 <span className="text-sm text-slate-500 font-medium">Buscando QR Code na Evolution API...</span>
               </div>
             ) : activeQrCode ? (
               <img src={activeQrCode} alt="WhatsApp QR Code" className="w-[220px] h-[220px]" />
             ) : (
               <div className="flex justify-center flex-col items-center gap-2">
                  <WifiOff className="h-8 w-8 text-destructive" />
                  <span className="text-sm text-destructive">Falha ao gerar QR Code.</span>
               </div>
             )}
          </div>

          <div className="flex flex-col w-full gap-2 text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg text-left">
            <p className="flex items-center gap-2"><Wifi justify-center className="h-4 w-4 text-success" /> Mantenha o celular conectado à internet.</p>
          </div>

          <DialogFooter className="w-full mt-4 flex-col gap-2 sm:flex-col items-stretch">
            {activeQrCode && (
              <Button onClick={simulateSuccessfulConnection} className="w-full" variant="outline" size="sm">
                (Botão de Teste) Simular que fiz a leitura
              </Button>
            )}
            <Button onClick={() => setIsQrModalOpen(false)} className="w-full">
               Fechar janela
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Conexoes;
