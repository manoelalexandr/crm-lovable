import { useState, useRef, useEffect } from "react";
import {
  CheckCircle2, Eye, Clock, Zap, Paperclip, Send,
  MoreVertical, MessageSquare, Search, Smartphone,
  Instagram, Loader2, DownloadCloud, ArrowLeft, FileText
} from "lucide-react"; // <-- ArrowLeft adicionado aqui!
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "react-router-dom";
import {
  getTickets, getTicketMessages, sendMessage,
  sendMediaMessage, resolveTicket, importChatHistory,
  syncContactAvatar, Ticket, Message
} from "@/lib/api/tickets";

import { getQuickResponses, QuickResponse } from "@/lib/api/quickResponses";
import { useAuth } from "@/contexts/AuthContext";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

const ChannelBadge = ({ channel }: { channel: string }) => {
  if (channel === 'instagram') {
    return (
      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white font-medium">
        <Instagram className="h-3 w-3" /> Instagram
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#25D366]/10 text-[#25D366] font-medium">
      <Smartphone className="h-3 w-3" /> WhatsApp
    </span>
  );
};

const Atendimentos = () => {
  const { company, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"aguardando" | "atendendo" | "grupos">("atendendo");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const companyId = company?.id;

  // 1. Descobre o cargo (role) do utilizador logado
  const { data: currentUserRole } = useQuery({
    queryKey: ["userRole", companyId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_users')
        .select('role')
        .eq('company_id', companyId)
        .eq('user_id', user!.id)
        .single();
      return data?.role || 'agent';
    },
    enabled: !!companyId && !!user?.id
  });

  // 2. Busca tickets da aba atual (Agora com a aba de grupos ATIVADA)
  const { data: currentList = [], isLoading: isLoadingTickets } = useQuery({
    queryKey: ["tickets", companyId, activeTab, user?.id, currentUserRole],
    queryFn: () => getTickets(
      companyId!,
      activeTab as "aguardando" | "atendendo" | "resolvido" | "grupos",
      user!.id,
      currentUserRole
    ),
    enabled: !!companyId && !!currentUserRole, // Removemos a trava dos grupos
  });

  // Busca mensagens do ticket selecionado
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ["messages", selectedTicket?.id],
    queryFn: () => getTicketMessages(selectedTicket!.id),
    enabled: !!selectedTicket?.id,
  });

  // Busca respostas rápidas da empresa
  const { data: quickResponses = [] } = useQuery<QuickResponse[]>({
    queryKey: ["quick_responses", companyId],
    queryFn: () => getQuickResponses(companyId!),
    enabled: !!companyId,
  });

  // Filtra respostas rápidas com base no que foi digitado após "/"
  const quickReplyFilter = messageInput.startsWith("/") ? messageInput.toLowerCase() : "";
  const filteredQuickReplies = quickReplyFilter
    ? quickResponses.filter((r) => r.shortcut.startsWith(quickReplyFilter))
    : quickResponses;

  const [searchParams, setSearchParams] = useSearchParams();
  const ticketIdFromUrl = searchParams.get("ticketId");

  useEffect(() => {
    const fetchAndOpenTicket = async () => {
      if (!ticketIdFromUrl || !companyId) return;

      try {
        const { data: ticket, error } = await supabase
          .from('tickets')
          .select(`
            *,
            contacts (
              id,
              name,
              phone,
              avatar_url
            )
          `)
          .eq('id', ticketIdFromUrl)
          .eq('company_id', companyId)
          .single();

        if (error || !ticket) return;

        let targetTab: "aguardando" | "atendendo" | "grupos" = "atendendo";
        if (ticket.status === 'waiting' || ticket.status === 'pending') {
          targetTab = "aguardando";
        }

        if (activeTab !== targetTab) {
          setActiveTab(targetTab);
        }

        setSelectedTicket(ticket as unknown as Ticket);

        searchParams.delete("ticketId");
        setSearchParams(searchParams, { replace: true });

      } catch (err) {
        console.error("Erro ao abrir ticket da URL:", err);
      }
    };

    fetchAndOpenTicket();
  }, [ticketIdFromUrl, companyId]);

  // Realtime subscription
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('crm_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["tickets", companyId] });
          const newMessage = payload.new as { ticket_id: string };
          if (newMessage && newMessage.ticket_id === selectedTicket?.id) {
            queryClient.invalidateQueries({ queryKey: ["messages", selectedTicket.id] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["tickets", companyId] });
          const updatedTicket = payload.new as Ticket;
          if (updatedTicket && updatedTicket.id === selectedTicket?.id) {
            setSelectedTicket(prev => prev ? { ...prev, ...updatedTicket, contacts: prev.contacts } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, selectedTicket?.id, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedTicket && !selectedTicket.contacts?.avatar_url) {
      syncContactAvatar(selectedTicket.id, selectedTicket.contact_id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["tickets", companyId] });
      });
    }
  }, [selectedTicket?.id]);

  // ZERAR NOTIFICAÇÕES INSTANTANEAMENTE ao abrir o chat ou receber mensagem com ele aberto
  useEffect(() => {
    if (selectedTicket && selectedTicket.unread_count > 0) {
      const clearUnreadCount = async () => {
        // 1. Zera no Banco de Dados
        await supabase
          .from('tickets')
          .update({ unread_count: 0 })
          .eq('id', selectedTicket.id);

        // 2. Atualiza a lista lateral e o Sininho
        queryClient.invalidateQueries({ queryKey: ["tickets", companyId] });
        queryClient.invalidateQueries({ queryKey: ["unread_notifications"] });

        // 3. Atualiza o estado local para a bolinha sumir NA HORA
        setSelectedTicket(prev => prev ? { ...prev, unread_count: 0 } : null);
      };

      clearUnreadCount();
    }
  }, [selectedTicket?.id, selectedTicket?.unread_count, companyId, queryClient]);

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => sendMessage(selectedTicket!.id, content, companyId!, user!.id),
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedTicket!.id] });
      queryClient.invalidateQueries({ queryKey: ["tickets", companyId] });
    },
    onError: (error) => {
      toast.error("Erro ao enviar mensagem.");
      console.error(error);
    }
  });

  const resolveTicketMutation = useMutation({
    mutationFn: () => resolveTicket(selectedTicket!.id, companyId!),
    onSuccess: () => {
      toast.success("Atendimento finalizado!");
      setSelectedTicket(null);
      queryClient.invalidateQueries({ queryKey: ["tickets", companyId] });
      queryClient.invalidateQueries({ queryKey: ["kanban", companyId] });
    },
    onError: () => toast.error("Erro ao finalizar atendimento."),
  });

  const importHistoryMutation = useMutation({
    mutationFn: () => importChatHistory(selectedTicket!.id, companyId!, user!.id),
    onSuccess: (count) => {
      toast.success(`${count} mensagens importadas com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["messages", selectedTicket!.id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao importar histórico.");
    }
  });

  const sendMediaMutation = useMutation({
    mutationFn: ({ url, type }: { url: string, type: any }) =>
      sendMediaMessage(selectedTicket!.id, url, type, companyId!, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedTicket?.id] });
      queryClient.invalidateQueries({ queryKey: ["tickets", companyId] });
    },
    onError: () => toast.error("Erro ao enviar arquivo")
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedTicket || !companyId) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${companyId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('chat_media')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath);

      let mediaType: 'image' | 'audio' | 'video' | 'document' = 'document';
      if (file.type.startsWith('image/')) mediaType = 'image';
      else if (file.type.startsWith('audio/')) mediaType = 'audio';
      else if (file.type.startsWith('video/')) mediaType = 'video';

      sendMediaMutation.mutate({ url: publicUrl, type: mediaType });
      toast.success("Arquivo enviado!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessageInput(val);
    setShowQuickReplies(val.startsWith("/"));
  };

  const applyQuickReply = (response: QuickResponse) => {
    setMessageInput(response.content);
    setShowQuickReplies(false);
  };

  const tabs = [
    { key: "atendendo" as const, label: "Atendendo", count: activeTab === 'atendendo' ? currentList.length : 0, color: "bg-primary" },
    { key: "aguardando" as const, label: "Aguardando", count: activeTab === 'aguardando' ? currentList.length : 0, color: "bg-warning" },
    { key: "grupos" as const, label: "Grupos", count: 0, color: "bg-muted" },
  ];

  return (
    <div className="flex h-[calc(100vh-3rem)] w-full overflow-hidden">

      {/* 1. LISTA DE TICKETS: Fica invisível no celular se houver um ticket selecionado */}
      <div className={`${selectedTicket ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col border-r border-border bg-card shrink-0 h-full`}>
        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar atendimento e mensagens"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors relative
                ${activeTab === tab.key ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <div className="flex items-center justify-center gap-1.5">
                {tab.count > 0 && (
                  <span className={`${tab.color} text-primary-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1`}>
                    {tab.count}
                  </span>
                )}
                {tab.label}
              </div>
              {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>

        {/* Ticket List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoadingTickets && currentList.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Carregando tickets...</div>
          ) : currentList.map(ticket => {
            const contactName = ticket.contacts?.name || ticket.contacts?.phone || 'Desconhecido';
            const channel = ticket.source || 'whatsapp';
            const timeFormatted = ticket.last_message_at
              ? format(new Date(ticket.last_message_at), 'HH:mm')
              : '';

            return (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`flex items-start gap-3 p-3 border-b border-border cursor-pointer transition-colors
                      ${selectedTicket?.id === ticket.id ? "bg-sidebar-accent" : "hover:bg-secondary/50"}`}
              >
                {ticket.contacts?.avatar_url ? (
                  <img
                    src={ticket.contacts.avatar_url}
                    alt="Avatar"
                    className="h-9 w-9 rounded-full object-cover shrink-0 border border-border"
                    onError={(e) => {
                      e.currentTarget.onerror = null; // Previne loop infinito
                      // Dispara a busca pela nova foto na Evolution
                      syncContactAvatar(ticket.id, ticket.contact_id, true).then(() => {
                        queryClient.invalidateQueries({ queryKey: ["tickets", companyId] });
                      });
                    }}
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-medium text-muted-foreground">
                    {contactName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{contactName}</span>
                    <span className="text-[11px] text-muted-foreground">{timeFormatted}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{ticket.last_message || 'Sem mensagens'}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <ChannelBadge channel={channel} />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  {ticket.unread_count > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                      {ticket.unread_count}
                    </span>
                  )}
                  {activeTab === "aguardando" && (
                    <button className="text-muted-foreground hover:text-primary" title="Espiar conversa">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. ÁREA DE CHAT: Fica com flex-1 total e tem o botão de voltar no mobile */}
      {selectedTicket ? (
        <div className={`${selectedTicket ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-card overflow-hidden h-full min-w-0`}>

          {/* Chat Header */}
          <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card shrink-0 z-10 w-full overflow-hidden">
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 pr-2">

              {/* BOTÃO VOLTAR (Só aparece no mobile) */}
              <button
                className="md:hidden p-1.5 -ml-2 mr-1 text-muted-foreground hover:bg-muted rounded-md"
                onClick={() => setSelectedTicket(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              {selectedTicket.contacts?.avatar_url ? (
                <img
                  src={selectedTicket.contacts.avatar_url}
                  alt="Avatar"
                  className="h-8 w-8 rounded-full object-cover shrink-0 border border-slate-200"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    syncContactAvatar(selectedTicket.id, selectedTicket.contact_id, true).then(() => {
                      queryClient.invalidateQueries({ queryKey: ["tickets", companyId] });
                    });
                  }}
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-sm font-bold text-slate-400 border border-slate-200">
                  {(selectedTicket.contacts?.name || 'D').charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{selectedTicket.contacts?.name || 'Cliente Desconhecido'}</p>
                <div className="flex items-center gap-2 truncate">
                  <span className="text-[10px] text-muted-foreground capitalize shrink-0">{selectedTicket.source || 'whatsapp'}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">•</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">#{selectedTicket.id.slice(0, 5).toUpperCase()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 text-blue-600 border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-700"
                onClick={() => importHistoryMutation.mutate()}
                disabled={importHistoryMutation.isPending}
                title="Puxar últimas mensagens do celular"
              >
                {importHistoryMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  : <DownloadCloud className="h-3.5 w-3.5 shrink-0" />}
                <span className="hidden sm:inline">Importar Histórico</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-green-500/50 text-green-600 hover:bg-green-500/10 hover:text-green-700"
                onClick={() => resolveTicketMutation.mutate()}
                disabled={resolveTicketMutation.isPending}
                title="Finalizar este atendimento"
              >
                {resolveTicketMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                <span className="hidden sm:inline">Finalizar</span>
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0" title="Mais opções">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Chat Content Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Chat Messages */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-secondary/10 scrollbar-thin">
                {isLoadingMessages ? (
                  <div className="p-4 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    Carregando histórico...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</div>
                ) : (
                  messages.reduce((groups: { date: string, messages: Message[] }[], msg) => {
                    const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
                    if (!groups.length || groups[groups.length - 1].date !== date) {
                      groups.push({ date, messages: [] });
                    }
                    groups[groups.length - 1].messages.push(msg);
                    return groups;
                  }, [] as { date: string, messages: Message[] }[]).map((group) => (
                    <div key={group.date} className="space-y-4">
                      <div className="flex justify-center">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground bg-background px-2 py-0.5 rounded-full border border-border">
                          {isToday(new Date(group.date)) ? 'Hoje' :
                            isYesterday(new Date(group.date)) ? 'Ontem' :
                              format(new Date(group.date), "dd 'de' MMMM", { locale: ptBR })}
                        </span>
                      </div>
                      {group.messages.map((msg: Message) => {
                        const isAgent = msg.sender_type === "agent" || msg.sender_type === "system" || msg.sender_type === "bot";
                        return (
                          <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm shadow-sm
                              ${isAgent
                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                : "bg-card border border-border text-foreground rounded-tl-none"}`}>

                              {/* 1. IMAGENS (Com limite de tamanho e fundo bonitinho) */}
                              {msg.type === 'image' && msg.media_url && (
                                <div className="mb-2 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity bg-black/5 flex justify-center" onClick={() => window.open(msg.media_url!, '_blank')}>
                                  <img src={msg.media_url} alt="Imagem enviada" className="max-w-[250px] sm:max-w-xs max-h-[300px] object-contain rounded-lg" />
                                </div>
                              )}

                              {/* 2. ÁUDIOS (Player padronizado) */}
                              {msg.type === 'audio' && msg.media_url && (
                                <div className="mb-2 min-w-[220px] sm:min-w-[280px]">
                                  <audio src={msg.media_url} controls className="h-10 w-full" />
                                </div>
                              )}

                              {/* 3. VÍDEOS (Limitados para não explodir a tela) */}
                              {msg.type === 'video' && msg.media_url && (
                                <div className="mb-2 rounded-lg overflow-hidden bg-black/10 flex justify-center max-w-[250px] sm:max-w-xs">
                                  <video src={msg.media_url} controls className="max-w-full max-h-[300px] rounded-lg" />
                                </div>
                              )}

                              {/* 4. DOCUMENTOS (O que faltava! PDF, DOCX, planilhas) */}
                              {msg.type === 'document' && msg.media_url && (
                                <a
                                  href={msg.media_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-3 p-3 border rounded-lg mb-2 transition-colors no-underline
                                    ${isAgent
                                      ? "bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20 text-primary-foreground"
                                      : "bg-background/50 border-border hover:bg-background text-foreground"}`}
                                >
                                  <div className={`h-10 w-10 rounded flex items-center justify-center shrink-0 
                                    ${isAgent ? "bg-primary-foreground/20" : "bg-primary/10"}`}>
                                    <FileText className={`h-5 w-5 ${isAgent ? "text-primary-foreground" : "text-primary"}`} />
                                  </div>
                                  <div className="flex flex-col overflow-hidden min-w-[120px]">
                                    <span className="text-sm font-semibold truncate">
                                      Documento Anexado
                                    </span>
                                    <span className={`text-[10px] truncate ${isAgent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                      Clique para abrir/baixar
                                    </span>
                                  </div>
                                  <DownloadCloud className="h-4 w-4 shrink-0 opacity-70 ml-2" />
                                </a>
                              )}

                              {/* Renderiza o texto (se existir) ignorando o [Arquivo de...] automático do Webhook */}
                              {msg.content && !msg.content.startsWith('[Arquivo de') && (
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              )}
                              <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${isAgent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                {format(new Date(msg.created_at), 'HH:mm')}
                                {isAgent && (
                                  <span title={msg.status === 'sent' ? 'Enviado' : 'Erro'}>
                                    {msg.status === 'sent' ? '✓' : '⚠'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="border-t border-border p-3 bg-card shrink-0">
                {showQuickReplies && filteredQuickReplies.length > 0 && (
                  <div className="mb-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    <div className="px-3 py-1.5 border-b border-border bg-secondary/40 flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Respostas Rápidas</span>
                    </div>
                    {filteredQuickReplies.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => applyQuickReply(r)}
                        className="w-full flex items-start gap-3 px-3 py-2 hover:bg-secondary/60 transition-colors text-left"
                      >
                        <code className="shrink-0 text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded mt-0.5">
                          {r.shortcut}
                        </code>
                        <span className="text-xs text-muted-foreground truncate">{r.content}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showQuickReplies && filteredQuickReplies.length === 0 && quickResponses.length === 0 && (
                  <div className="mb-2 px-3 py-2 bg-secondary/30 border border-border rounded-lg">
                    <p className="text-xs text-muted-foreground">Nenhuma resposta rápida cadastrada. <a href="/respostas-rapidas" className="text-primary underline">Criar agora →</a></p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || !selectedTicket}
                    title="Enviar arquivo"
                  >
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 shrink-0 transition-colors ${showQuickReplies ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary'}`}
                    onClick={() => {
                      if (!showQuickReplies) {
                        setMessageInput("/");
                        setShowQuickReplies(true);
                      } else {
                        setShowQuickReplies(false);
                        setMessageInput("");
                      }
                    }}
                    title="Respostas rápidas (ou digite /)"
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Mensagem ou / para respostas..."
                    value={messageInput}
                    onChange={handleMessageInputChange}
                    onKeyDown={e => {
                      if (e.key === 'Escape') {
                        setShowQuickReplies(false);
                        return;
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (messageInput.trim() && !messageInput.startsWith('/')) {
                          sendMessageMutation.mutate(messageInput);
                        }
                      }
                    }}
                    className="h-9 text-sm"
                    disabled={sendMessageMutation.isPending || isUploading}
                  />
                  <Button
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      if (messageInput.trim() && !messageInput.startsWith('/')) {
                        sendMessageMutation.mutate(messageInput);
                      }
                    }}
                    disabled={sendMessageMutation.isPending || !messageInput.trim() || isUploading || messageInput.startsWith('/')}
                    title="Enviar mensagem"
                  >
                    {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Contact Sidebar */}
            <div className="w-64 shrink-0 border-l border-border bg-card hidden xl:flex flex-col overflow-y-auto">
              <div className="p-4 flex flex-col items-center">
                {selectedTicket.contacts?.avatar_url ? (
                  <img src={selectedTicket.contacts.avatar_url} alt="Avatar" className="h-20 w-20 rounded-full object-cover shrink-0 mb-3 border-2 border-slate-200 shadow-sm" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-400 mb-3 border-2 border-slate-200">
                    {(selectedTicket.contacts?.name || 'D').charAt(0).toUpperCase()}
                  </div>
                )}
                <h3 className="font-bold text-center text-sm">{selectedTicket.contacts?.name || 'Cliente Desconhecido'}</h3>
                <p className="text-xs text-muted-foreground">{selectedTicket.contacts?.phone}</p>

                <div className="w-full mt-6 space-y-4">
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Canal Original</h4>
                    <ChannelBadge channel={selectedTicket.source || 'whatsapp'} />
                  </div>

                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Informações</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        <span>Ticket #{selectedTicket.id.slice(0, 5).toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Criado em {format(new Date(selectedTicket.created_at), 'dd/MM/yy')}</span>
                      </div>
                    </div>
                  </div>

                  {selectedTicket.contacts?.notes && (
                    <div>
                      <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Anotações</h4>
                      <div className="bg-secondary/50 p-2 rounded text-xs text-muted-foreground border border-border">
                        {selectedTicket.contacts.notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // 3. ESTADO VAZIO: Também fica invisível no celular para dar espaço à lista
        <div className="hidden md:flex flex-1 items-center justify-center bg-secondary/20">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary tracking-tight">TRIP<span className="text-foreground/40">.ia</span></h2>
            <p className="text-sm text-muted-foreground mt-2">Selecione um ticket para começar a conversar</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Atendimentos;