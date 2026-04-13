import { useState } from "react";
import { Search, Plus, Calendar, Tag, DollarSign, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface KanbanCard {
  id: number;
  name: string;
  ticketNumber: number;
  date: string;
  value: number;
  tags: string[];
  assignee?: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  colorClass: string;
  headerBg: string;
  cards: KanbanCard[];
}

const initialColumns: KanbanColumn[] = [
  {
    id: "open",
    title: "Em aberto",
    colorClass: "border-kanban-open",
    headerBg: "bg-kanban-open",
    cards: [
      { id: 1, name: "Giovanna C.", ticketNumber: 22, date: "02/04/2026", value: 0, tags: ["NO TAG"], assignee: "AtendChat Admin" },
      { id: 2, name: "5581958483", ticketNumber: 807, date: "02/04/2026", value: 0, tags: ["NO TAG"] },
      { id: 3, name: "5581917425", ticketNumber: 808, date: "02/04/2026", value: 0, tags: ["NO TAG"] },
    ],
  },
  {
    id: "attending",
    title: "Em atendimento",
    colorClass: "border-kanban-attending",
    headerBg: "bg-kanban-attending",
    cards: [
      { id: 4, name: "Manoel Ale", ticketNumber: 14, date: "07/03/2026", value: 0, tags: ["NO TAG"], assignee: "AtendChat Admin" },
    ],
  },
  {
    id: "pending",
    title: "Pendência",
    colorClass: "border-kanban-pending",
    headerBg: "bg-kanban-pending",
    cards: [],
  },
  {
    id: "done",
    title: "Finalizados",
    colorClass: "border-kanban-done",
    headerBg: "bg-kanban-done",
    cards: [],
  },
];

const Kanban = () => {
  const [columns] = useState<KanbanColumn[]>(initialColumns);
  const [searchDate] = useState("09/04/2026");

  const totalValue = (cards: KanbanCard[]) =>
    cards.reduce((sum, c) => sum + c.value, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="p-6 h-[calc(100vh-3rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-primary">Kanban</h1>
        <div className="flex items-center gap-3">
          <Select defaultValue="ticket">
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ticket">Número do Ticket</SelectItem>
              <SelectItem value="date">Data</SelectItem>
              <SelectItem value="name">Nome</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Início</span>
              <Input type="text" defaultValue={searchDate} className="w-28 h-9 text-sm" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Fim</span>
              <Input type="text" defaultValue={searchDate} className="w-28 h-9 text-sm" />
            </div>
          </div>
          <Button size="sm" className="h-9">
            <Search className="h-4 w-4 mr-1" /> Buscar
          </Button>
          <Button size="sm" variant="outline" className="h-9 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> Adicionar coluna
          </Button>
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => (
          <div key={col.id} className="flex flex-col w-72 shrink-0">
            {/* Column Header */}
            <div className={`${col.headerBg} text-primary-foreground rounded-t-lg px-4 py-2.5 flex items-center justify-between`}>
              <span className="text-sm font-semibold">{col.title}</span>
              <span className="text-xs opacity-80">Total: {totalValue(col.cards)}</span>
            </div>

            {/* Cards Container */}
            <div className={`flex-1 bg-card border-2 ${col.colorClass} border-t-0 rounded-b-lg p-3 space-y-3 overflow-y-auto scrollbar-thin`}>
              {col.cards.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum ticket</p>
              ) : (
                col.cards.map(card => (
                  <div key={card.id} className="bg-background border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium">{card.name}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Ticket nº {card.ticketNumber}</span>
                    </div>

                    {card.assignee && (
                      <p className="text-xs text-primary font-medium mb-1">Atribuir Valor</p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">{card.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">R$ {card.value.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                      {card.tags.map(tag => (
                        <Badge key={tag} variant="destructive" className="text-[10px] h-4 px-1.5">
                          {tag}
                        </Badge>
                      ))}
                      {card.assignee && (
                        <Badge className="text-[10px] h-4 px-1.5 bg-foreground text-background">
                          {card.assignee}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Kanban;
