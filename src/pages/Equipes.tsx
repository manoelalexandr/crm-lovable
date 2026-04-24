import { useState } from "react";
import { Plus, Shield, User, Loader2, Trash2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createTeamMember, getTeamMembers } from "@/lib/api/team";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
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

const Equipe = () => {
    const { company, user: currentUser } = useAuth();
    const queryClient = useQueryClient();
    const companyId = company?.id;

    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form States
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("agent");

    // Busca os membros da equipe
    const { data: team = [], isLoading } = useQuery({
        queryKey: ["team", companyId],
        queryFn: () => getTeamMembers(companyId!),
        enabled: !!companyId,
    });

    const createMutation = useMutation({
        mutationFn: () => createTeamMember(email, password, name, companyId!, role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["team", companyId] });
            setIsModalOpen(false);
            setName("");
            setEmail("");
            setPassword("");
            setRole("agent");
            toast.success("Membro da equipe adicionado com sucesso!");
        },
        onError: (error: any) => toast.error(error.message || "Erro ao adicionar membro"),
    });

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-6 h-[calc(100vh-3rem)] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-primary flex items-center gap-2">
                        <Shield className="h-5 w-5" /> Equipe e Acessos
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gerencie quem tem acesso ao sistema da sua empresa.
                    </p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} size="sm" className="h-9">
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Membro
                </Button>
            </div>

            {/* Tabela de Usuários */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Acesso</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {team.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                    Você é o único membro desta empresa.
                                </TableCell>
                            </TableRow>
                        ) : (
                            team.map((member: any) => {
                                const memberName = member.name || "Usuário";
                                const memberEmail = member.email || "Sem e-mail";
                                const isMe = member.user_id === currentUser?.id;

                                return (
                                    <TableRow key={member.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-bold text-muted-foreground">
                                                    {memberName.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm flex items-center gap-2">
                                                        {memberName}
                                                        {isMe && <Badge variant="outline" className="text-[10px] py-0 h-4">Você</Badge>}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Mail className="h-3 w-3" /> {memberEmail}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {member.role === 'admin' ? (
                                                <Badge className="bg-blue-500 hover:bg-blue-600 text-white flex w-fit items-center gap-1">
                                                    <Shield className="h-3 w-3" /> Administrador
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="flex w-fit items-center gap-1">
                                                    <User className="h-3 w-3" /> Atendente
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                disabled={isMe} // Não deixa o usuário excluir a si mesmo
                                                onClick={() => toast.info("Função de excluir em breve!")}
                                            >
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

            {/* Modal de Novo Usuário */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Convidar Membro</DialogTitle>
                        <DialogDescription>
                            Crie o acesso para um novo funcionário da sua empresa.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="name">Nome do funcionário</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Pedro Silva"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="email">E-mail de login</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="pedro@empresa.com"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="password">Senha Temporária</Label>
                            <Input
                                id="password"
                                type="text"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                            />
                        </div>
                        <div className="flex flex-col gap-2 mt-2">
                            <Label>Nível de Acesso</Label>
                            <Select value={role} onValueChange={setRole}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="agent">
                                        <div className="flex flex-col">
                                            <span className="font-medium">Atendente</span>
                                            <span className="text-[10px] text-muted-foreground">Apenas atende chats e move o Kanban.</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="admin">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-blue-600">Administrador</span>
                                            <span className="text-[10px] text-muted-foreground">Acesso total às configurações e equipe.</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button
                            size="sm"
                            onClick={() => createMutation.mutate()}
                            disabled={!name || !email || password.length < 6 || createMutation.isPending}
                        >
                            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Acesso"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Equipe;