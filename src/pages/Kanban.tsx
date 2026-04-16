import { useState, useEffect, useMemo } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getKanbanBoard, 
  updateTicketColumn, 
  createKanbanColumn, 
  updateColumnsPositions, 
  updateKanbanColumn,
  deleteKanbanColumn,
  KanbanColumnData, 
  KanbanTicket 
} from "@/lib/api/kanban";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import { KanbanCard } from "@/components/kanban/KanbanCard";
import { createPortal } from "react-dom";

const Kanban = () => {
  const { company } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals state
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [isEditColumnOpen, setIsEditColumnOpen] = useState(false);
  const [isDeleteColumnOpen, setIsDeleteColumnOpen] = useState(false);
  
  // Form states
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newColumnColor, setNewColumnColor] = useState("open");
  const [editingColumn, setEditingColumn] = useState<KanbanColumnData | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<string | null>(null);

  // DND states
  const [activeColumn, setActiveColumn] = useState<KanbanColumnData | null>(null);
  const [activeCard, setActiveCard] = useState<KanbanTicket | null>(null);

  const companyId = company?.id;

  // Sensors for DND
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ["kanban", companyId],
    queryFn: () => getKanbanBoard(companyId!),
    enabled: !!companyId,
  });

  const columns = useMemo(() => data?.columns || [], [data?.columns]);
  const tickets = useMemo(() => data?.tickets || [], [data?.tickets]);

  // Mutations
  const addColumnMutation = useMutation({
    mutationFn: () => createKanbanColumn(companyId!, newColumnTitle, newColumnColor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban", companyId] });
      setIsAddColumnOpen(false);
      setNewColumnTitle("");
      toast.success("Coluna adicionada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar coluna");
      console.error(error);
    }
  });

  const editColumnMutation = useMutation({
    mutationFn: (updates: Partial<KanbanColumnData>) => updateKanbanColumn(editingColumn!.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban", companyId] });
      setIsEditColumnOpen(false);
      toast.success("Coluna atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar coluna");
      console.error(error);
    }
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (columnId: string) => deleteKanbanColumn(columnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban", companyId] });
      setIsDeleteColumnOpen(false);
      toast.success("Coluna excluída!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir coluna");
      console.error(error);
    }
  });

  const updateColumnsMutation = useMutation({
    mutationFn: (cols: KanbanColumnData[]) => updateColumnsPositions(cols),
    onMutate: async (newColumns) => {
      await queryClient.cancelQueries({ queryKey: ["kanban", companyId] });
      const previousData = queryClient.getQueryData<{ columns: KanbanColumnData[], tickets: KanbanTicket[] }>(["kanban", companyId]);
      
      if (previousData) {
        queryClient.setQueryData(["kanban", companyId], {
          ...previousData,
          columns: newColumns
        });
      }
      
      return { previousData };
    },
    onError: (error, __, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["kanban", companyId], context.previousData);
      }
      toast.error("Erro ao reorganizar colunas");
      console.error(error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban", companyId] });
    },
  });

  const moveTicketMutation = useMutation({
    mutationFn: ({ ticketId, columnId }: { ticketId: string; columnId: string }) => 
      updateTicketColumn(ticketId, columnId),
    onMutate: async ({ ticketId, columnId }) => {
      await queryClient.cancelQueries({ queryKey: ["kanban", companyId] });
      const previousData = queryClient.getQueryData<{ columns: KanbanColumnData[], tickets: KanbanTicket[] }>(["kanban", companyId]);
      
      if (previousData) {
        queryClient.setQueryData(["kanban", companyId], {
          ...previousData,
          tickets: previousData.tickets.map(t => 
            t.id === ticketId ? { ...t, kanban_column_id: columnId } : t
          )
        });
      }
      
      return { previousData };
    },
    onError: (error, __, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["kanban", companyId], context.previousData);
      }
      toast.error("Erro ao mover ticket");
      console.error(error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban", companyId] });
    },
  });

  // Real-time listener
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('kanban_changes_total')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `company_id=eq.${companyId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["kanban", companyId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_columns', filter: `company_id=eq.${companyId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["kanban", companyId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  // DND Handlers
  const onDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === "Column") {
      setActiveColumn(event.active.data.current.column);
      return;
    }
    if (event.active.data.current?.type === "Card") {
      setActiveCard(event.active.data.current.card);
      return;
    }
  };

  const onDragOver = (event: DragOverEvent) => {
    // Logic for live card feedback between columns could be added here
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveColumn(null);
    setActiveCard(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Handle Column Reordering
    if (active.data.current?.type === "Column" && activeId !== overId) {
      const oldIndex = columns.findIndex(col => col.id === activeId);
      const newIndex = columns.findIndex(col => col.id === overId);
      
      const newOrder = arrayMove(columns, oldIndex, newIndex);
      const updates = newOrder.map((col, idx) => ({ ...col, position: idx }));
      updateColumnsMutation.mutate(updates);
      return;
    }

    // Handle Card Moving
    if (active.data.current?.type === "Card") {
      const activeTicket = active.data.current.card as KanbanTicket;
      let targetColumnId: string | null = null;

      if (over.data.current?.type === "Column") {
        targetColumnId = over.id as string;
      } else if (over.data.current?.type === "Card") {
        targetColumnId = (over.data.current.card as KanbanTicket).kanban_column_id;
      }

      if (targetColumnId && targetColumnId !== activeTicket.kanban_column_id) {
        moveTicketMutation.mutate({ ticketId: activeTicket.id as string, columnId: targetColumnId });
      }
    }
  };

  const handleEditClick = (column: KanbanColumnData) => {
    setEditingColumn(column);
    setNewColumnTitle(column.title);
    setNewColumnColor(column.color);
    setIsEditColumnOpen(true);
  };

  const handleDeleteClick = (columnId: string) => {
    const hasTickets = tickets.some(t => t.kanban_column_id === columnId);
    if (hasTickets) {
      toast.error("Não é possível excluir uma coluna que contém tickets. Mova-os primeiro.");
      return;
    }
    setColumnToDelete(columnId);
    setIsDeleteColumnOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando painel...</span>
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-3rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h1 className="text-xl font-bold text-primary">Kanban</h1>
        <div className="flex items-center gap-3">
          <Input 
            placeholder="Buscar por nome..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 h-9 text-sm"
          />
          <Button 
            size="sm" 
            variant="outline" 
            className="h-9 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={() => {
              setNewColumnTitle("");
              setNewColumnColor("open");
              setIsAddColumnOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Adicionar coluna
          </Button>
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          <SortableContext items={columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            {columns.map(col => (
              <KanbanColumn
                key={col.id}
                column={col}
                tickets={tickets.filter(t => 
                  t.kanban_column_id === col.id && 
                  t.contact_name.toLowerCase().includes(searchQuery.toLowerCase())
                )}
                allColumns={columns}
                companyId={companyId!}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
              />
            ))}
          </SortableContext>
        </div>

        {/* Drag Overlay */}
        {createPortal(
          <DragOverlay>
            {activeColumn && (
              <KanbanColumn
                column={activeColumn}
                tickets={tickets.filter(t => t.kanban_column_id === activeColumn.id)}
                allColumns={columns}
                companyId={companyId!}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            )}
            {activeCard && (
              <KanbanCard
                card={activeCard}
                columns={columns}
                companyId={companyId!}
              />
            )}
          </DragOverlay>,
          document.body
        )}
      </DndContext>

      {/* Dialogs */}
      <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nova Coluna</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right text-xs">Título</Label>
              <Input
                id="title"
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                className="col-span-3 h-9 text-sm"
                placeholder="Ex: Negociação"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="color" className="text-right text-xs">Categoria</Label>
              <div className="col-span-3">
                <Select value={newColumnColor} onValueChange={setNewColumnColor}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione uma cor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberto (Cinza)</SelectItem>
                    <SelectItem value="attending">Em Atendimento (Rosa)</SelectItem>
                    <SelectItem value="pending">Pendente (Amarelo)</SelectItem>
                    <SelectItem value="done">Finalizado (Verde)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddColumnOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => addColumnMutation.mutate()} disabled={!newColumnTitle.trim() || addColumnMutation.isPending}>
              {addColumnMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar coluna"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditColumnOpen} onOpenChange={setIsEditColumnOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Coluna</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-title" className="text-right text-xs">Título</Label>
              <Input
                id="edit-title"
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                className="col-span-3 h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-color" className="text-right text-xs">Categoria</Label>
              <div className="col-span-3">
                <Select value={newColumnColor} onValueChange={setNewColumnColor}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberto (Cinza)</SelectItem>
                    <SelectItem value="attending">Em Atendimento (Rosa)</SelectItem>
                    <SelectItem value="pending">Pendente (Amarelo)</SelectItem>
                    <SelectItem value="done">Finalizado (Verde)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsEditColumnOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => editColumnMutation.mutate({ title: newColumnTitle, color: newColumnColor })}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteColumnOpen} onOpenChange={setIsDeleteColumnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Coluna</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta etapa? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsDeleteColumnOpen(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteColumnMutation.mutate(columnToDelete!)}>
              Excluir Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Kanban;
