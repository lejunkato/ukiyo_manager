import { Link } from "react-router";
import logo from "../../imports/image.png";

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        <div className="flex justify-center">
          <img src={logo} alt="Ukiyo" className="w-64 h-64 object-contain" />
        </div>

        <div className="space-y-4">
          <Link
            to="/room/sala-1"
            className="block w-full bg-primary text-primary-foreground py-4 px-6 rounded-lg hover:bg-primary/90 transition-colors text-center"
          >
            Acesso Cliente (Exemplo: Sala 1)
          </Link>

          <div className="border-t border-white/20 pt-4 mt-4">
            <p className="text-white/60 text-sm mb-3 text-center">
              Painel Administrativo
            </p>
            <div className="space-y-3">
              <Link
                to="/admin/rooms"
                className="block w-full bg-white text-black py-3 px-6 rounded-lg hover:bg-white/90 transition-colors text-center"
              >
                Salas
              </Link>

              <Link
                to="/admin/menu"
                className="block w-full bg-white text-black py-3 px-6 rounded-lg hover:bg-white/90 transition-colors text-center"
              >
                Cardápio
              </Link>

              <Link
                to="/admin/orders"
                className="block w-full bg-white text-black py-3 px-6 rounded-lg hover:bg-white/90 transition-colors text-center"
              >
                Comandas
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
