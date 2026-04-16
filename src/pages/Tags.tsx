import { useState } from "react";
import { Plus, Edit2, Trash2, Loader2, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTags, createTag, updateTag, deleteTag, TagData } from "@/lib/api/tags";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Tags = () => {
  const { company } = useAuth();
  const queryClient = useQueryClient();
  const companyId = company?.id;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagData | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["tags", companyId],
    queryFn: () => getTags(companyId!),
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editingTag) {
        return updateTag(editingTag.id, { name, color });
      }
      return createTag(companyId!, name, color);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags", companyId] });
      setIsModalOpen(false);
      setName("");
      setColor("#3b82f6");
      setEditingTag(null);
      toast.success(editingTag ? "Tag atualizada!" : "Tag criada!");
    },
    onError: () => toast.error("Erro ao salvar tag")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags", companyId] });
      toast.success("Tag removida!");
    },
    onError: () => toast.error("Erro ao remover tag")
  });

  const openModal = (tag?: TagData) => {
    if (tag) {
      setEditingTag(tag);
      setName(tag.name);
      setColor(tag.color);
    } else {
      setEditingTag(null);
      setName("");
      setColor("#3b82f6");
    }
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Você tem certeza que deseja excluir esta tag?")) {
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TagIcon className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-primary">Gestão de Tags</h1>
        </div>
        <Button onClick={() => openModal()} size="sm" className="h-9">
          <Plus className="h-4 w-4 mr-1" /> Criar Tag
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Visualização</TableHead>
              <TableHead>Nome da Tag</TableHead>
              <TableHead>Criada em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhuma tag cadastrada
                </TableCell>
              </TableRow>
            ) : (
              tags.map(tag => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <div 
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white" 
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{tag.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(tag.created_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openModal(tag)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(tag.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingTag ? "Editar Tag" : "Nova Tag"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nome da Tag</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Novo Cliente, VIP, Urgente..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="color">Cor</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 p-1 rounded cursor-pointer border border-border"
                />
                <div 
                  className="px-3 py-1 text-sm font-medium rounded-full text-white" 
                  style={{ backgroundColor: color }}
                >
                  {name || "Preview"}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tags;
