import { useState } from "react";
import { Plus, Edit2, Trash2, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getQuickResponses,
  createQuickResponse,
  updateQuickResponse,
  deleteQuickResponse,
  QuickResponse,
} from "@/lib/api/quickResponses";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const RespostasRapidas = () => {
  const { company } = useAuth();
  const queryClient = useQueryClient();
  const companyId = company?.id;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState<QuickResponse | null>(null);
  const [shortcut, setShortcut] = useState("");
  const [content, setContent] = useState("");

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["quick_responses", companyId],
    queryFn: () => getQuickResponses(companyId!),
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingResponse) {
        await updateQuickResponse(editingResponse.id, { shortcut, content });
      } else {
        await createQuickResponse(companyId!, shortcut, content);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick_responses", companyId] });
      setIsModalOpen(false);
      resetForm();
      toast.success(editingResponse ? "Resposta atualizada!" : "Resposta criada!");
    },
    onError: (err: any) => {
      const isDuplicate = err?.message?.includes("unique");
      toast.error(isDuplicate ? "Já existe uma resposta com esse atalho." : "Erro ao salvar resposta.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuickResponse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick_responses", companyId] });
      toast.success("Resposta removida!");
    },
    onError: () => toast.error("Erro ao remover resposta."),
  });

  const resetForm = () => {
    setEditingResponse(null);
    setShortcut("");
    setContent("");
  };

  const openModal = (response?: QuickResponse) => {
    if (response) {
      setEditingResponse(response);
      setShortcut(response.shortcut);
      setContent(response.content);
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Deseja remover esta resposta rápida?")) {
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

  return (
    <div className="p-6 h-[calc(100vh-3rem)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-primary">Respostas Rápidas</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Digite <code className="bg-secondary px-1 rounded text-xs">/atalho</code> no chat para inserir rapidamente.
          </p>
        </div>
        <Button onClick={() => openModal()} size="sm" className="h-9">
          <Plus className="h-4 w-4 mr-1" /> Nova Resposta
        </Button>
      </div>

      {/* Empty state */}
      {responses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-lg bg-card">
          <Zap className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-base font-semibold text-foreground">Nenhuma resposta rápida</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-xs text-center">
            Crie atalhos de texto para agilizar o atendimento. Ex: <strong>/ola</strong> → "Olá! Como posso ajudar?"
          </p>
          <Button onClick={() => openModal()} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" /> Criar primeira resposta
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Atalho</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className="w-[120px]">Criada em</TableHead>
                <TableHead className="text-right w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {responses.map((response) => (
                <TableRow key={response.id}>
                  <TableCell>
                    <code className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-mono font-semibold">
                      {response.shortcut}
                    </code>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[400px]">
                    <p className="truncate">{response.content}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(response.created_at), "dd/MM/yy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openModal(response)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(response.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingResponse ? "Editar Resposta" : "Nova Resposta Rápida"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="shortcut">
                Atalho{" "}
                <span className="text-xs text-muted-foreground font-normal">(começa com /)</span>
              </Label>
              <Input
                id="shortcut"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="Ex: /ola  /preco  /horario"
                className="font-mono"
                autoFocus
              />
              {shortcut && (
                <p className="text-xs text-muted-foreground">
                  Será salvo como:{" "}
                  <code className="bg-secondary px-1 rounded">
                    {shortcut.trim().toLowerCase().replace(/\s+/g, "_").replace(/^(?!\/)/, "/")}
                  </code>
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="content">Mensagem</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Digite o texto completo da resposta..."
                rows={4}
                className="resize-none text-sm"
              />
              <p className="text-xs text-muted-foreground text-right">{content.length} caracteres</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!shortcut.trim() || !content.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RespostasRapidas;
