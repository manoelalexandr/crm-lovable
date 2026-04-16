import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, DollarSign, User } from "lucide-react";
import { format } from "date-fns";
import { KanbanTicket, KanbanColumnData, updateTicketColumn } from "@/lib/api/kanban";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface KanbanCardProps {
  card: KanbanTicket;
  columns: KanbanColumnData[];
  companyId: string;
}

export const KanbanCard = ({ card, columns, companyId }: KanbanCardProps) => {
  const queryClient = useQueryClient();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: "Card",
      card,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const moveTicketMutation = useMutation({
    mutationFn: ({ ticketId, columnId }: { ticketId: string; columnId: string }) => 
      updateTicketColumn(ticketId, columnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban", companyId] });
    },
    onError: (error) => {
      toast.error("Erro ao mover ticket");
      console.error(error);
    }
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-background border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow group relative"
    >
      {/* Drag Handle Area */}
      <div {...attributes} {...listeners} className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing" />
      
      <div className="relative z-10 pointer-events-none">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium line-clamp-1">{card.contact_name}</span>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">#{card.ticket_number}</span>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 mb-2 min-h-[2rem]">
          {card.last_message || "Sem mensagens"}
        </p>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(card.created_at), 'dd/MM/yy')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-medium text-success">
              {card.kanban_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        </div>
      </div>

      {/* Select remains interactive */}
      <div className="mt-3 relative z-20">
        <Select onValueChange={(val) => moveTicketMutation.mutate({ ticketId: card.id, columnId: val })}>
          <SelectTrigger className="h-7 text-[10px] w-full bg-secondary/50 border-none">
            <SelectValue placeholder="Mover etapa" />
          </SelectTrigger>
          <SelectContent>
            {columns.map(c => (
              <SelectItem key={c.id} value={c.id} className="text-[10px]">
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
