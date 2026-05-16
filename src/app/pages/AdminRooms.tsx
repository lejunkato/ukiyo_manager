import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Plus, Pencil, Trash2, QrCode, LogOut } from "lucide-react";
import logo from "../../imports/image.png";
import QRCodeDisplay from "../components/QRCodeDisplay";
import { useAuth } from "../contexts/AuthContext";

interface Room {
  id: string;
  name: string;
  floor: number;
  capacity: number;
  hourlyRate: number;
  active: boolean;
}

const initialRooms: Room[] = [
  { id: "1", name: "Sala 1", floor: 1, capacity: 8, hourlyRate: 50, active: true },
  { id: "2", name: "Sala 2", floor: 1, capacity: 6, hourlyRate: 40, active: true },
  { id: "3", name: "Sala 3", floor: 2, capacity: 10, hourlyRate: 60, active: true },
  { id: "4", name: "Sala 4", floor: 2, capacity: 12, hourlyRate: 70, active: true },
  { id: "5", name: "Sala 5", floor: 3, capacity: 8, hourlyRate: 50, active: true },
];

export default function AdminRooms() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [showModal, setShowModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState<Room | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const [formData, setFormData] = useState({
    name: "",
    floor: "",
    capacity: "",
    hourlyRate: "",
    active: true,
  });

  const openModal = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setFormData({
        name: room.name,
        floor: room.floor.toString(),
        capacity: room.capacity.toString(),
        hourlyRate: room.hourlyRate.toString(),
        active: room.active,
      });
    } else {
      setEditingRoom(null);
      setFormData({
        name: "",
        floor: "",
        capacity: "",
        hourlyRate: "",
        active: true,
      });
    }
    setShowModal(true);
  };

  const saveRoom = () => {
    if (!formData.name || !formData.floor || !formData.capacity || !formData.hourlyRate) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }

    const newRoom: Room = {
      id: editingRoom?.id || Date.now().toString(),
      name: formData.name,
      floor: parseInt(formData.floor),
      capacity: parseInt(formData.capacity),
      hourlyRate: parseFloat(formData.hourlyRate),
      active: formData.active,
    };

    if (editingRoom) {
      setRooms((prev) =>
        prev.map((room) => (room.id === editingRoom.id ? newRoom : room))
      );
    } else {
      setRooms((prev) => [...prev, newRoom]);
    }

    setShowModal(false);
  };

  const deleteRoom = (id: string) => {
    if (confirm("Deseja realmente excluir esta sala?")) {
      setRooms((prev) => prev.filter((room) => room.id !== id));
    }
  };

  const toggleActive = (id: string) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.id === id ? { ...room, active: !room.active } : room
      )
    );
  };

  const groupedByFloor = rooms.reduce((acc, room) => {
    if (!acc[room.floor]) acc[room.floor] = [];
    acc[room.floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-black text-white p-6 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <img src={logo} alt="Ukiyo" className="w-16 h-16 object-contain" />
            <div>
              <h1>Gerenciar Salas</h1>
              <p className="text-sm opacity-80">
                Adicione e configure as salas do karaokê
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <>
                <div className="text-sm text-white/80 mr-2">
                  {user.email}
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-secondary text-secondary-foreground px-4 py-3 rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-2"
                  title="Sair"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={() => openModal()}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nova Sala
            </button>
          </div>
        </div>
      </div>

      {/* Rooms List */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="space-y-6">
          {Object.entries(groupedByFloor)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([floor, floorRooms]) => (
              <div key={floor} className="space-y-4">
                <h2 className="text-primary border-b border-border pb-2">
                  {floor}º Andar
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {floorRooms.map((room) => (
                    <div
                      key={room.id}
                      className={`bg-card border border-border rounded-lg p-4 ${
                        !room.active ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3>{room.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Capacidade: {room.capacity} pessoas
                          </p>
                          <p className="text-sm text-primary mt-1">
                            R$ {room.hourlyRate.toFixed(2)}/hora
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => setShowQRModal(room)}
                            className="p-2 hover:bg-secondary rounded-md transition-colors"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openModal(room)}
                            className="p-2 hover:bg-secondary rounded-md transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteRoom(room.id)}
                            className="p-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleActive(room.id)}
                        className={`w-full py-2 px-4 rounded-md transition-colors text-sm ${
                          room.active
                            ? "bg-primary/10 text-primary hover:bg-primary/20"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {room.active ? "✓ Ativa" : "✕ Inativa"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          {rooms.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma sala cadastrada. Clique em "Nova Sala" para adicionar.
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h2>{editingRoom ? "Editar Sala" : "Nova Sala"}</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block mb-2">Nome da Sala *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Ex: Sala 1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2">Andar *</label>
                  <input
                    type="number"
                    value={formData.floor}
                    onChange={(e) =>
                      setFormData({ ...formData, floor: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="1"
                  />
                </div>

                <div>
                  <label className="block mb-2">Capacidade *</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="8"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-2">Valor por Hora (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.hourlyRate}
                  onChange={(e) =>
                    setFormData({ ...formData, hourlyRate: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="50.00"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) =>
                    setFormData({ ...formData, active: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <label htmlFor="active" className="cursor-pointer">
                  Sala ativa
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-border flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveRoom}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                {editingRoom ? "Salvar Alterações" : "Adicionar Sala"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2>QR Code - {showQRModal.name}</h2>
              <button
                onClick={() => setShowQRModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <QRCodeDisplay
              value={`${window.location.origin}/room/${showQRModal.name
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
              roomName={showQRModal.name}
            />

            <p className="text-sm text-muted-foreground text-center mt-4">
              Clientes podem escanear este QR code para acessar a sala
            </p>

            <button
              onClick={() => window.print()}
              className="w-full mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Imprimir QR Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
