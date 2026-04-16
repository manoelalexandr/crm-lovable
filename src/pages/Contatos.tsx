import { useState } from "react";
import { Plus, Edit2, Trash2, Loader2, Users, Mail, Phone, Calendar as CalendarIcon, Tag as TagIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContacts, createContact, updateContact, deleteContact, ContactData } from "@/lib/api/contacts";
import { getTags, assignTagToContact, removeTagFromContact, TagData } from "@/lib/api/tags";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const Contatos = () => {
  const { company } = useAuth();
  const queryClient = useQueryClient();
  const companyId = company?.id;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactData | null>(null);
  
  // Form States
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts", companyId],
    queryFn: () => getContacts(companyId!),
    enabled: !!companyId,
  });

  const { data: allTags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ["tags", companyId],
    queryFn: () => getTags(companyId!),
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { name, phone, email, notes };
      if (editingContact) {
        return updateContact(editingContact.id, payload);
      }
      return createContact({ company_id: companyId!, ...payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", companyId] });
      setIsModalOpen(false);
      resetForm();
      toast.success(editingContact ? "Contato atualizado!" : "Contato criado!");
    },
    onError: () => toast.error("Erro ao salvar contato")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", companyId] });
      toast.success("Contato removido!");
    },
    onError: () => toast.error("Erro ao remover contato")
  });

  // Tag Management Mutations
  const assignTagMutation = useMutation({
    mutationFn: ({ contactId, tagId }: { contactId: string, tagId: string }) => assignTagToContact(contactId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", companyId] });
      toast.success("Tag vinculada!");
    }
  });

  const removeTagMutation = useMutation({
    mutationFn: ({ contactId, tagId }: { contactId: string, tagId: string }) => removeTagFromContact(contactId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", companyId] });
    }
  });

  const resetForm = () => {
    setEditingContact(null);
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
  };

  const openModal = (contact?: ContactData) => {
    if (contact) {
      setEditingContact(contact);
      setName(contact.name);
      setPhone(contact.phone || "");
      setEmail(contact.email || "");
      setNotes(contact.notes || "");
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Você tem certeza que deseja excluir este contato? Isso também removerá suas tags.")) {
      deleteMutation.mutate(id);
    }
  };

  if (contactsLoading || tagsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Helper to extract flattened tags from contact_tags structure
  const extractTags = (contact: ContactData): TagData[] => {
    if (!contact.contact_tags) return [];
    return contact.contact_tags.map((ct: any) => ct.tags).filter(Boolean);
  };

  return (
    <div className="p-6 h-[calc(100vh-3rem)] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-primary">Contatos</h1>
        </div>
        <Button onClick={() => openModal()} size="sm" className="h-9">
          <Plus className="h-4 w-4 mr-1" /> Novo Contato
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden whitespace-nowrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum contato encontrado
                </TableCell>
              </TableRow>
            ) : (
              contacts.map(contact => {
                const contactTags = extractTags(contact);
                return (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium text-sm">{contact.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {contact.phone && (
                          <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {contact.phone}</div>
                        )}
                        {contact.email && (
                          <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {contact.email}</div>
                        )}
                        {!contact.phone && !contact.email && "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {contactTags.length > 0 ? (
                          contactTags.map(tag => (
                            <span 
                              key={tag.id}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white" 
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {format(new Date(contact.created_at), 'dd/MM/yy')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openModal(contact)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(contact.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Editar Contato" : "Novo Contato"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55..." />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            
            {editingContact && (
              <div className="flex flex-col gap-2 p-3 bg-secondary/50 rounded-lg border border-border mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <TagIcon className="h-4 w-4 text-primary" />
                  <Label className="font-semibold text-primary">Tags do Contato</Label>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {extractTags(editingContact).map(tag => (
                    <Badge 
                      key={tag.id} 
                      className="flex items-center gap-1 text-white hover:opacity-90 transition-opacity pr-1"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                      <button 
                        onClick={() => removeTagMutation.mutate({ contactId: editingContact.id, tagId: tag.id })}
                        className="ml-1 rounded-full p-0.5 hover:bg-black/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {extractTags(editingContact).length === 0 && (
                    <span className="text-xs text-muted-foreground w-full">Nenhuma tag vinculada ainda.</span>
                  )}
                </div>

                <Select onValueChange={(tagId) => assignTagMutation.mutate({ contactId: editingContact.id, tagId })}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Adicionar nova tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allTags.filter(t => !extractTags(editingContact).some(ct => ct.id === t.id)).map(tag => (
                      <SelectItem key={tag.id} value={tag.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Anotações Internas</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Contatos;
