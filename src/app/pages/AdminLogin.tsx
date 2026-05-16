import { useState } from "react";
import logo from "../../imports/image.png";

export default function AdminLogin() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
      const response = await fetch(`${apiUrl}/auth/google/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Não foi possível iniciar o login");
      }

      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error(error);
      alert("Não foi possível iniciar o login com Google");
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
                Entrar com
              </span>
            </div>
          </div>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-primary rounded-full animate-spin"></div>
            ) : (
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span className="font-medium">
              {isLoading ? "Entrando..." : "Continuar com Google"}
            </span>
          </button>

          {/* Info */}
          <div className="text-center text-xs text-muted-foreground">
            <p>Ao fazer login, você concorda com os</p>
            <p className="mt-1">termos de uso do sistema</p>
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
