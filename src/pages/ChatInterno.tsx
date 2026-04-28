import { useState, useRef, useEffect } from "react";
import { Send, Search, Loader2, ArrowLeft, Users, UserCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    getCompanyColleagues, getChatMessages,
    sendInternalMessage, createDirectChat, InternalMessage, InternalChat
} from "@/lib/api/internalChat";

export default function ChatInterno() {
    const { company, user } = useAuth();
    const queryClient = useQueryClient();
    const [activeChat, setActiveChat] = useState<InternalChat | null>(null);
    const [activeColleague, setActiveColleague] = useState<any | null>(null);
    const [messageInput, setMessageInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const companyId = company?.id;
    const currentUserId = user?.id;

    // 1. Busca os colegas de equipe
    const { data: colleagues = [], isLoading: isLoadingColleagues } = useQuery({
        queryKey: ["colleagues", companyId],
        queryFn: () => getCompanyColleagues(companyId!, currentUserId!),
        enabled: !!companyId && !!currentUserId,
    });

    // 2. Busca as mensagens do chat ativo
    const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
        queryKey: ["internal_messages", activeChat?.id],
        queryFn: () => getChatMessages(activeChat!.id),
        enabled: !!activeChat?.id,
    });

    // Rola para baixo ao receber novas mensagens
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Realtime: Escuta novas mensagens internas
    useEffect(() => {
        if (!companyId) return;

        const channel = supabase
            .channel('internal_chat_realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'internal_messages', filter: `company_id=eq.${companyId}` },
                (payload) => {
                    const newMessage = payload.new as InternalMessage;
                    if (newMessage.chat_id === activeChat?.id) {
                        queryClient.invalidateQueries({ queryKey: ["internal_messages", activeChat.id] });
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [companyId, activeChat?.id, queryClient]);

    // Mutação para abrir/criar chat com um colega
    const openChatMutation = useMutation({
        mutationFn: (targetUserId: string) => createDirectChat(companyId!, currentUserId!, targetUserId),
        onSuccess: (chat, targetUserId) => {
            setActiveChat(chat);
            const colleague = colleagues.find((c: any) => c.user_id === targetUserId);
            setActiveColleague(colleague);
        },
        onError: () => toast.error("Erro ao abrir chat.")
    });

    // Mutação para enviar mensagem
    const sendMessageMutation = useMutation({
        mutationFn: (content: string) => sendInternalMessage(activeChat!.id, companyId!, currentUserId!, content),
        onSuccess: () => {
            setMessageInput("");
            queryClient.invalidateQueries({ queryKey: ["internal_messages", activeChat!.id] });
        },
        onError: () => toast.error("Erro ao enviar mensagem.")
    });

    const filteredColleagues = colleagues.filter((c: any) =>
        c.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-[calc(100vh-3rem)] w-full overflow-hidden">

            {/* PAINEL ESQUERDO: LISTA DE COLEGAS */}
            <div className={`${activeChat ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col border-r border-border bg-card shrink-0 h-full`}>
                <div className="p-4 border-b border-border bg-secondary/20">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" /> Equipe
                    </h2>
                </div>

                <div className="p-3 border-b border-border">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar colega..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-8 h-9 text-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
                    {isLoadingColleagues ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Carregando equipe...</div>
                    ) : filteredColleagues.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Nenhum colega encontrado.</div>
                    ) : filteredColleagues.map((colleague: any) => (
                        <div
                            key={colleague.user_id}
                            onClick={() => openChatMutation.mutate(colleague.user_id)}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors
                    ${activeColleague?.user_id === colleague.user_id ? "bg-sidebar-accent" : "hover:bg-secondary/50"}`}
                        >
                            <div className="relative shrink-0">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                    {colleague.display_name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${colleague.status === 'online' ? 'bg-green-500' : 'bg-slate-400'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="text-sm font-semibold truncate block">{colleague.display_name || 'Usuário'}</span>
                                <span className="text-xs text-muted-foreground capitalize">{colleague.status || 'offline'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* PAINEL DIREITO: ÁREA DE CHAT */}
            {activeChat ? (
                <div className={`${activeChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-background overflow-hidden h-full min-w-0`}>

                    {/* CABEÇALHO DO CHAT */}
                    <div className="h-14 border-b border-border flex items-center px-4 bg-card shrink-0 z-10 w-full overflow-hidden gap-3">
                        <button
                            className="md:hidden p-1.5 -ml-2 text-muted-foreground hover:bg-muted rounded-md"
                            onClick={() => { setActiveChat(null); setActiveColleague(null); }}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold border border-primary/20">
                            {activeColleague?.display_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold truncate">{activeColleague?.display_name}</p>
                            <p className="text-xs text-muted-foreground truncate">Chat Interno</p>
                        </div>
                    </div>

                    {/* MENSAGENS */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-secondary/5 scrollbar-thin">
                        {isLoadingMessages || openChatMutation.isPending ? (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="text-sm">Carregando conversa...</span>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <p className="text-sm">Nenhuma mensagem ainda. Diga olá!</p>
                            </div>
                        ) : (
                            messages.map((msg: InternalMessage, idx: number) => {
                                const isMe = msg.user_id === currentUserId;
                                const showName = !isMe && (idx === 0 || messages[idx - 1].user_id !== msg.user_id);

                                // Pega o nome do colega buscando na lista que já temos
                                const sender = colleagues.find((c: any) => c.user_id === msg.user_id);
                                const senderName = sender?.display_name || 'Usuário';

                                return (
                                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} flex-col ${isMe ? "items-end" : "items-start"}`}>
                                        {showName && <span className="text-xs text-muted-foreground mb-1 ml-1 font-medium">{senderName}</span>}
                                        <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm shadow-sm
                      ${isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border text-foreground rounded-tl-none"}`}>
                                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                            <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                                {format(new Date(msg.created_at), 'HH:mm')}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* INPUT DE MENSAGEM */}
                    <div className="border-t border-border p-3 bg-card shrink-0 flex items-center gap-2">
                        <Input
                            placeholder="Digite sua mensagem para a equipe..."
                            value={messageInput}
                            onChange={e => setMessageInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey && messageInput.trim()) {
                                    e.preventDefault();
                                    sendMessageMutation.mutate(messageInput);
                                }
                            }}
                            className="h-10"
                            disabled={sendMessageMutation.isPending}
                        />
                        <Button
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            onClick={() => messageInput.trim() && sendMessageMutation.mutate(messageInput)}
                            disabled={sendMessageMutation.isPending || !messageInput.trim()}
                        >
                            {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>

                </div>
            ) : (
                <div className="hidden md:flex flex-1 items-center justify-center bg-secondary/10 flex-col gap-3">
                    <div className="h-20 w-20 bg-card rounded-full flex items-center justify-center shadow-sm border border-border">
                        <MessageSquare className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-foreground tracking-tight">Chat Interno</h2>
                        <p className="text-sm text-muted-foreground mt-1">Selecione um colega ao lado para iniciar uma conversa</p>
                    </div>
                </div>
            )}
        </div>
    );
}