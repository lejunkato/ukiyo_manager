import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Plus, Save } from "lucide-react";
import logo from "../../imports/image.png";
import { useAuth } from "../contexts/AuthContext";
import { api, type AdminUser } from "../lib/api";
import UserAccountMenu from "../components/UserAccountMenu";

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "superadmin";
  active: boolean;
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  password: "",
  role: "admin",
  active: true,
};

export default function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = async () => {
    try {
      setUsers(await api.getUsers(token));
    } catch (error) {
      console.error(error);
      alert("Não foi possível carregar os usuários");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [token]);

  const startCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
  };

  const startEdit = (adminUser: AdminUser) => {
    setEditingUser(adminUser);
    setForm({
      name: adminUser.name,
      email: adminUser.email,
      password: "",
      role: adminUser.role,
      active: adminUser.active,
    });
  };

  const saveUser = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      alert("Preencha nome e e-mail");
      return;
    }

    if (!editingUser && form.password.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    try {
      setIsSaving(true);
      if (editingUser) {
        const { password, ...data } = form;
        const updatedUser = await api.updateUser(
          editingUser.id,
          password ? form : data,
          token
        );
        setUsers((prev) => prev.map((item) => item.id === updatedUser.id ? updatedUser : item));
      } else {
        const createdUser = await api.createUser(form, token);
        setUsers((prev) => [...prev, createdUser]);
      }

      setEditingUser(null);
      setForm(emptyForm);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error && error.message === "user_already_exists"
        ? "Já existe um usuário com este e-mail."
        : "Não foi possível salvar o usuário");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-black text-white p-6 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/menu" className="hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <img src={logo} alt="Ukiyo" className="w-16 h-16 object-contain" />
            <div>
              <h1>Usuários</h1>
              <p className="text-sm opacity-80">Controle de acesso do time</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UserAccountMenu />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <div className="bg-card border border-border rounded-lg p-5 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h2>{editingUser ? "Editar usuário" : "Novo usuário"}</h2>
            {editingUser && (
              <button
                onClick={startCreate}
                className="p-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                title="Novo usuário"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2">Nome</label>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">
                {editingUser ? "Nova senha" : "Senha"}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={editingUser ? "Deixe em branco para manter" : ""}
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Permissão</label>
              <select
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserForm["role"] }))}
                className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                className="w-4 h-4"
              />
              Usuário ativo
            </label>
            <button
              onClick={saveUser}
              disabled={isSaving}
              className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Salvando..." : "Salvar usuário"}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando usuários...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum usuário cadastrado</div>
          ) : (
            users.map((adminUser) => (
              <button
                key={adminUser.id}
                onClick={() => startEdit(adminUser)}
                className={`w-full bg-card border rounded-lg p-4 text-left hover:bg-secondary/20 transition-colors ${
                  editingUser?.id === adminUser.id ? "border-primary" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div>{adminUser.name}</div>
                    <div className="text-sm text-muted-foreground">{adminUser.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm capitalize">{adminUser.role}</div>
                    <div className={`text-xs ${adminUser.active ? "text-green-600" : "text-destructive"}`}>
                      {adminUser.active ? "Ativo" : "Inativo"}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
