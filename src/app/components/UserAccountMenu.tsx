import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { LogOut, Settings, Users } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface UserAccountMenuProps {
  onOpenSettings?: () => void;
}

export default function UserAccountMenu({ onOpenSettings }: UserAccountMenuProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = user.name?.trim()?.charAt(0) || user.email.charAt(0);

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((value) => !value)}
        className="w-11 h-11 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center justify-center"
        title="Conta"
      >
        <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm uppercase">
          {initials}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-popover text-popover-foreground border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-5 bg-secondary/40 text-center">
            <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground mx-auto mb-3 flex items-center justify-center text-xl uppercase">
              {initials}
            </div>
            <div className="font-medium">{user.name}</div>
            <div className="text-sm text-muted-foreground break-all">{user.email}</div>
            <div className="text-xs text-muted-foreground mt-1 capitalize">{user.role}</div>
          </div>

          <div className="py-2">
            {user.role === "superadmin" && (
              <Link
                to="/admin/users"
                onClick={() => setIsOpen(false)}
                className="w-full px-4 py-3 text-sm hover:bg-secondary/60 transition-colors flex items-center gap-3"
              >
                <Users className="w-4 h-4" />
                Usuários e acessos
              </Link>
            )}

            {onOpenSettings && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="w-full px-4 py-3 text-sm hover:bg-secondary/60 transition-colors flex items-center gap-3 text-left"
              >
                <Settings className="w-4 h-4" />
                Configurações
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 text-sm hover:bg-secondary/60 transition-colors flex items-center gap-3 text-left"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
