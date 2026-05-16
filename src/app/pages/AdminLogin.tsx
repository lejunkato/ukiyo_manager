import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import logo from "../../imports/image.png";
import { useAuth } from "../contexts/AuthContext";
import { getApiUrl } from "../lib/config";

const authErrorMessages: Record<string, string> = {
  invalid_credentials: "E-mail ou senha inválidos.",
  auth_failed: "Não foi possível concluir o login.",
};

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const errorCode = new URLSearchParams(window.location.search).get("error");
  const authErrorMessage = errorCode ? authErrorMessages[errorCode] : null;

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorCode = data?.error;
        throw new Error(
          authErrorMessages[errorCode] ||
            "Não foi possível iniciar o login"
        );
      }

      const data = await response.json();
      login(data.user, data.token);
      navigate("/admin/menu", { replace: true });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Não foi possível iniciar o login");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-neutral-900 to-primary/20 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 space-y-8">
          {/* Logo */}
          <div className="flex flex-col items-center">
            <img src={logo} alt="Ukiyo" className="w-32 h-32 object-contain mb-4" />
            <h1 className="text-center">Painel Administrativo</h1>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Faça login para acessar o gerenciamento
            </p>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Entrar
              </span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm mb-2">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full px-4 py-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full px-4 py-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading && (
                <div className="w-5 h-5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              )}
              <span className="font-medium">
                {isLoading ? "Entrando..." : "Entrar no painel"}
              </span>
            </button>
          </form>

          {authErrorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {authErrorMessage}
            </div>
          )}

          {/* Info */}
          <div className="text-center text-xs text-muted-foreground">
            <p>Acesso restrito às telas de gerenciamento</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-white/60">
          <p>Ukiyo Restaurante e Karaokê</p>
          <p className="mt-1">Sistema de Gerenciamento</p>
        </div>
      </div>
    </div>
  );
}
