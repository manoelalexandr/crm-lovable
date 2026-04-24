import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KanbanColumnData, KanbanTicket } from "@/lib/api/kanban";
import { KanbanCard } from "./KanbanCard";
import { Edit2, Trash2 } from "lucide-react";

interface KanbanColumnProps {
  column: KanbanColumnData;
  tickets: KanbanTicket[];
  allColumns: KanbanColumnData[];
  companyId: string;
  onEdit: (column: KanbanColumnData) => void;
  onDelete: (columnId: string) => void;
}

export const KanbanColumn = ({
  column,
  tickets,
  allColumns,
  companyId,
  onEdit,
  onDelete
}: KanbanColumnProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getHeaderBg = (color: string) => {
    switch (color) {
      case 'open': return 'bg-kanban-open';
      case 'attending': return 'bg-kanban-attending';
      case 'pending': return 'bg-kanban-pending';
      case 'done': return 'bg-kanban-done';
      default: return 'bg-primary';
    }
  };

  const getBorderClass = (color: string) => {
    switch (color) {
      case 'open': return 'border-kanban-open';
      case 'attending': return 'border-kanban-attending';
      case 'pending': return 'border-kanban-pending';
      case 'done': return 'border-kanban-done';
      default: return 'border-primary';
    }
  };

  const totalValue = () => {
    const val = tickets.reduce((sum, t) => sum + (t.kanban_value || 0), 0);
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col w-72 shrink-0 h-full"
    >
      {/* Column Header */}
      <div
        {...attributes}
        {...listeners}
        className={`${getHeaderBg(column.color)} text-primary-foreground rounded-t-lg px-3 py-2.5 flex items-center justify-between cursor-grab active:cursor-grabbing group/header`}
      >
        <div className="flex flex-col">
          <span className="text-sm font-semibold truncate max-w-[150px]">{column.title}</span>
          <span className="text-[10px] opacity-80">Total: {totalValue()}</span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(column); }}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(column.id); }}
            className="p-1 hover:bg-white/20 rounded transition-colors text-white/90 hover:text-white"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Cards Container */}
      <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className={`flex-1 bg-card border-2 ${getBorderClass(column.color)} border-t-0 rounded-b-lg p-3 space-y-3 overflow-y-auto scrollbar-thin shadow-inner min-h-[150px]`}>
          {tickets.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhum ticket</p>
          ) : (
            tickets.map(ticket => (
              <KanbanCard
                key={ticket.id}
                card={ticket}
                columns={allColumns}
                companyId={companyId}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
};
