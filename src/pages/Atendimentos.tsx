import { useState } from "react";
import { Eye, Paperclip, Send, MoreVertical, ArrowRightLeft, Clock, MessageSquare, Search, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Ticket {
  id: number;
  name: string;
  phone: string;
  lastMessage: string;
  time: string;
  channel: "whatsapp" | "instagram" | "facebook";
  tags: string[];
  unread: number;
}

const mockAguardando: Ticket[] = [
  { id: 1, name: "Maria Silva", phone: "+55 81 9999-1234", lastMessage: "Olá, preciso de ajuda com meu pedido", time: "10:32", channel: "whatsapp", tags: ["CLIENTE"], unread: 3 },
  { id: 2, name: "João Pedro", phone: "+55 81 9888-5678", lastMessage: "Quanto custa o plano premium?", time: "10:28", channel: "instagram", tags: ["LEAD"], unread: 1 },
  { id: 3, name: "Ana Costa", phone: "+55 11 9777-9012", lastMessage: "Bom dia!", time: "10:15", channel: "whatsapp", tags: [], unread: 2 },
];

const mockAtendendo: Ticket[] = [
  { id: 4, name: "Giovanna Cordeiro", phone: "+55 81 9641-2272", lastMessage: "Perfeito, vou aguardar então", time: "09:45", channel: "whatsapp", tags: ["CLIENTE"], unread: 0 },
  { id: 5, name: "Manoel Alexandre", phone: "+55 81 8973-6830", lastMessage: "Obrigado pelo atendimento", time: "09:30", channel: "facebook", tags: ["VIP"], unread: 0 },
];

const mockMessages = [
  { id: 1, from: "client", text: "Olá, preciso de ajuda com meu pedido #4521", time: "10:30" },
  { id: 2, from: "client", text: "O produto chegou com defeito", time: "10:31" },
  { id: 3, from: "client", text: "Podem me ajudar?", time: "10:32" },
];

const channelColors: Record<string, string> = {
  whatsapp: "bg-success text-success-foreground",
  instagram: "bg-pink-500 text-primary-foreground",
  facebook: "bg-info text-info-foreground",
};

const Atendimentos = () => {
  const [activeTab, setActiveTab] = useState<"aguardando" | "atendendo" | "grupos">("atendendo");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(mockAtendendo[0]);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const currentList = activeTab === "aguardando" ? mockAguardando : activeTab === "atendendo" ? mockAtendendo : [];

  const tabs = [
    { key: "atendendo" as const, label: "Atendendo", count: mockAtendendo.length, color: "bg-primary" },
    { key: "aguardando" as const, label: "Aguardando", count: mockAguardando.length, color: "bg-warning" },
    { key: "grupos" as const, label: "Grupos", count: 0, color: "bg-muted" },
  ];

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Left Panel - Ticket List */}
      <div className="w-80 border-r border-border bg-card flex flex-col shrink-0">
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
          {currentList.map(ticket => (
            <div
              key={ticket.id}
              onClick={() => setSelectedTicket(ticket)}
              className={`flex items-start gap-3 p-3 border-b border-border cursor-pointer transition-colors
                ${selectedTicket?.id === ticket.id ? "bg-sidebar-accent" : "hover:bg-secondary/50"}`}
            >
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-medium text-muted-foreground">
                {ticket.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{ticket.name}</span>
                  <span className="text-[11px] text-muted-foreground">{ticket.time}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{ticket.lastMessage}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${channelColors[ticket.channel]}`}>
                    {ticket.channel.toUpperCase()}
                  </span>
                  {ticket.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-[10px] h-4 px-1">{tag}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                {ticket.unread > 0 && (
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                    {ticket.unread}
                  </span>
                )}
                {activeTab === "aguardando" && (
                  <button className="text-muted-foreground hover:text-primary" title="Espiar conversa">
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Chat */}
      {selectedTicket ? (
        <div className="flex-1 flex flex-col bg-card">
          {/* Chat Header */}
          <div className="h-14 border-b border-border flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                {selectedTicket.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium">{selectedTicket.name}</p>
                <p className="text-xs text-muted-foreground">{selectedTicket.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Transferir ticket">
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Agendar">
                <Clock className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Nota interna">
                <StickyNote className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/20">
            {mockMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.from === "agent" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm
                  ${msg.from === "agent"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground"}`}>
                  <p>{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${msg.from === "agent" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{msg.time}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="border-t border-border p-3 flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Digite uma mensagem..."
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              className="h-9 text-sm"
            />
            <Button size="icon" className="h-8 w-8 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-secondary/20">
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
