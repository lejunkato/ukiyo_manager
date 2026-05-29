import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, QrCode } from "lucide-react";
import QRCodeDisplay from "../components/QRCodeDisplay";
import { useAuth } from "../contexts/AuthContext";
import { api, type Room } from "../lib/api";
import AdminActionBar from "../components/AdminActionBar";
import AdminHeader from "../components/AdminHeader";
import ConfirmDialog from "../components/ConfirmDialog";

export default function AdminRooms() {
  const { token } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState<Room | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [pendingDeleteRoomId, setPendingDeleteRoomId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    floor: "",
    capacity: "",
    hourlyRate: "",
    active: true,
  });

  useEffect(() => {
    const loadRooms = async () => {
      try {
        setRooms(await api.getRooms());
      } catch (error) {
        console.error(error);
        alert("Não foi possível carregar as salas");
      } finally {
        setIsLoadingRooms(false);
      }
    };

    loadRooms();
  }, []);

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

  const saveRoom = async () => {
    if (!formData.name || !formData.floor || !formData.capacity || !formData.hourlyRate) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }

    const roomData = {
      name: formData.name,
      floor: parseInt(formData.floor),
      capacity: parseInt(formData.capacity),
      hourlyRate: parseFloat(formData.hourlyRate),
      active: formData.active,
    };

    try {
      if (editingRoom) {
        const updatedRoom = await api.updateRoom(editingRoom.id, roomData, token);
        setRooms((prev) =>
          prev.map((room) => (room.id === editingRoom.id ? updatedRoom : room))
        );
      } else {
        const newRoom = await api.createRoom(roomData, token);
        setRooms((prev) => [...prev, newRoom]);
      }
      setShowModal(false);
    } catch (error) {
      console.error(error);
      alert("Não foi possível salvar a sala");
    }
  };

  const deleteRoom = (id: string) => {
    setPendingDeleteRoomId(id);
  };

  const confirmDeleteRoom = async () => {
    if (!pendingDeleteRoomId) return;
    try {
      await api.deleteRoom(pendingDeleteRoomId, token);
      setRooms((prev) => prev.filter((room) => room.id !== pendingDeleteRoomId));
      setPendingDeleteRoomId(null);
    } catch (error) {
      console.error(error);
      alert("Não foi possível excluir a sala");
    }
  };

  const toggleActive = async (id: string) => {
    const room = rooms.find((item) => item.id === id);
    if (!room) return;

    try {
      const updatedRoom = await api.updateRoom(id, { active: !room.active }, token);
      setRooms((prev) =>
        prev.map((item) => (item.id === id ? updatedRoom : item))
      );
    } catch (error) {
      console.error(error);
      alert("Não foi possível atualizar a sala");
    }
  };

  const groupedByFloor = rooms.reduce((acc, room) => {
    if (!acc[room.floor]) acc[room.floor] = [];
    acc[room.floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader
        title="Gerenciar Salas"
        description="Adicione e configure as salas do karaokê"
        backTo="/"
      />
      <AdminActionBar>
        <button
          onClick={() => openModal()}
          className="bg-primary text-primary-foreground px-4 sm:px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span className="sm:hidden">Nova</span>
          <span className="hidden sm:inline">Nova Sala</span>
        </button>
      </AdminActionBar>

      {/* Rooms List */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="space-y-6">
          {isLoadingRooms && (
            <div className="text-center py-12 text-muted-foreground">
              Carregando salas...
            </div>
          )}

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
              value={`${window.location.origin}/room/${showQRModal.publicCode}`}
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

      <ConfirmDialog
        open={Boolean(pendingDeleteRoomId)}
        title="Excluir sala"
        description="Deseja realmente excluir esta sala?"
        confirmLabel="Excluir"
        onConfirm={confirmDeleteRoom}
        onCancel={() => setPendingDeleteRoomId(null)}
      />
    </div>
  );
}
