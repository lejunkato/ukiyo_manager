import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Clock, Check, X, QrCode, ChevronDown, ChevronUp, DollarSign, LogOut, Edit, Trash2, Plus, Minus } from "lucide-react";
import logo from "../../imports/image.png";
import QRCodeDisplay from "../components/QRCodeDisplay";
import { useAuth } from "../contexts/AuthContext";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  roomId: string;
  tabName: string;
  personName: string;
  items: OrderItem[];
  total: number;
  status: "pending" | "preparing" | "delivered" | "cancelled";
  timestamp: Date;
}

const mockOrders: Order[] = [
  {
    id: "1",
    roomId: "Sala 1",
    tabName: "Comanda 1",
    personName: "João Silva",
    items: [
      { id: "1", name: "Sushi Combinado", quantity: 2, price: 68.9 },
      { id: "2", name: "Refrigerante Lata", quantity: 3, price: 6.9 },
    ],
    total: 158.5,
    status: "pending",
    timestamp: new Date(Date.now() - 5 * 60000),
  },
  {
    id: "2",
    roomId: "Sala 1",
    tabName: "Comanda 2",
    personName: "Maria Santos",
    items: [
      { id: "3", name: "Hot Roll Filadélfia", quantity: 1, price: 42.9 },
      { id: "4", name: "Temaki de Salmão", quantity: 2, price: 24.9 },
    ],
    total: 92.7,
    status: "preparing",
    timestamp: new Date(Date.now() - 10 * 60000),
  },
  {
    id: "3",
    roomId: "Sala 3",
    tabName: "Comanda 1",
    personName: "Pedro Costa",
    items: [
      { id: "1", name: "Sushi Combinado", quantity: 1, price: 68.9 },
      { id: "5", name: "Yakisoba", quantity: 2, price: 38.9 },
    ],
    total: 146.7,
    status: "preparing",
    timestamp: new Date(Date.now() - 15 * 60000),
  },
];

interface RoomSession {
  roomId: string;
  hourlyRate: number;
  tabs: TabSession[];
  startTime: Date;
  active: boolean;
}

interface TabSession {
  tabName: string;
  personName: string;
  orders: Order[];
  totalValue: number;
  roomChargePaid: number;
  paid: boolean;
  itemsSummary: Map<string, { name: string; quantity: number; price: number }>;
}

interface TabPayment {
  tabName: string;
  roomCharge: number;
}

const mockRoomRates: Record<string, number> = {
  "Sala 1": 50,
  "Sala 2": 40,
  "Sala 3": 60,
  "Sala 4": 70,
  "Sala 5": 50,
};

export default function AdminOrders() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [activeTab, setActiveTab] = useState<"orders" | "sessions">("orders");
  const [showQRModal, setShowQRModal] = useState<string | null>(null);
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(new Set());
  const [closingTab, setClosingTab] = useState<{
    room: RoomSession;
    tab: TabSession;
  } | null>(null);
  const [closingRoom, setClosingRoom] = useState<RoomSession | null>(null);
  const [customPayments, setCustomPayments] = useState<Record<string, number>>({});
  const [paymentMode, setPaymentMode] = useState<"equal" | "custom">("equal");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewedOrders, setViewedOrders] = useState<Set<string>>(new Set());

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const markAsViewed = (orderId: string) => {
    setViewedOrders((prev) => new Set([...prev, orderId]));
  };

  const openEditOrder = (order: Order) => {
    setEditingOrder({ ...order });
  };

  const saveEditedOrder = () => {
    if (!editingOrder) return;

    setOrders((prev) =>
      prev.map((order) =>
        order.id === editingOrder.id ? editingOrder : order
      )
    );
    setEditingOrder(null);
  };

  const updateOrderItem = (itemId: string, quantity: number) => {
    if (!editingOrder) return;

    if (quantity <= 0) {
      setEditingOrder({
        ...editingOrder,
        items: editingOrder.items.filter((item) => item.id !== itemId),
        total: editingOrder.items
          .filter((item) => item.id !== itemId)
          .reduce((sum, item) => sum + item.price * item.quantity, 0),
      });
    } else {
      setEditingOrder({
        ...editingOrder,
        items: editingOrder.items.map((item) =>
          item.id === itemId ? { ...item, quantity } : item
        ),
        total: editingOrder.items
          .map((item) =>
            item.id === itemId ? { ...item, quantity } : item
          )
          .reduce((sum, item) => sum + item.price * item.quantity, 0),
      });
    }
  };

  const deleteOrder = (orderId: string) => {
    if (confirm("Deseja realmente excluir este pedido?")) {
      setOrders((prev) => prev.filter((order) => order.id !== orderId));
    }
  };

  const updateTabItem = (roomId: string, tabName: string, itemId: string, newQuantity: number) => {
    setOrders((prev) => {
      return prev.map((order) => {
        if (order.roomId === roomId && order.tabName === tabName) {
          const updatedItems = order.items.map((item) => {
            if (item.id === itemId) {
              const quantityDiff = newQuantity - item.quantity;
              if (quantityDiff === 0) return item;

              return { ...item, quantity: newQuantity };
            }
            return item;
          }).filter((item) => item.quantity > 0);

          const newTotal = updatedItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );

          return { ...order, items: updatedItems, total: newTotal };
        }
        return order;
      }).filter((order) => order.items.length > 0);
    });
  };

  const removeTabItem = (roomId: string, tabName: string, itemId: string) => {
    if (!confirm("Deseja remover este item da comanda?")) return;

    setOrders((prev) => {
      return prev.map((order) => {
        if (order.roomId === roomId && order.tabName === tabName) {
          const updatedItems = order.items.filter((item) => item.id !== itemId);

          if (updatedItems.length === 0) return null;

          const newTotal = updatedItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );

          return { ...order, items: updatedItems, total: newTotal };
        }
        return order;
      }).filter((order) => order !== null) as Order[];
    });
  };

  const updateOrderStatus = (orderId: string, status: Order["status"]) => {
    setOrders((prev) =>
      prev.map((order) => (order.id === orderId ? { ...order, status } : order))
    );
  };

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "preparing":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "delivered":
        return "bg-green-500/10 text-green-700 border-green-500/20";
      case "cancelled":
        return "bg-red-500/10 text-red-700 border-red-500/20";
    }
  };

  const getStatusText = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "preparing":
        return "Preparando";
      case "delivered":
        return "Entregue";
      case "cancelled":
        return "Cancelado";
    }
  };

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m atrás`;
  };

  const formatDuration = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const calculateRoomCost = (startTime: Date, hourlyRate: number): number => {
    const diff = Date.now() - startTime.getTime();
    const hours = diff / 3600000;
    return hours * hourlyRate;
  };

  const toggleRoom = (roomId: string) => {
    setExpandedRooms((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(roomId)) {
        newSet.delete(roomId);
      } else {
        newSet.add(roomId);
      }
      return newSet;
    });
  };

  const toggleTab = (tabKey: string) => {
    setExpandedTabs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tabKey)) {
        newSet.delete(tabKey);
      } else {
        newSet.add(tabKey);
      }
      return newSet;
    });
  };

  const groupOrdersByRoom = (): RoomSession[] => {
    const roomMap = new Map<string, RoomSession>();

    orders.forEach((order) => {
      if (!roomMap.has(order.roomId)) {
        roomMap.set(order.roomId, {
          roomId: order.roomId,
          hourlyRate: mockRoomRates[order.roomId] || 50,
          tabs: [],
          startTime: order.timestamp,
          active: true,
        });
      }

      const room = roomMap.get(order.roomId)!;
      let tab = room.tabs.find((t) => t.tabName === order.tabName);

      if (!tab) {
        tab = {
          tabName: order.tabName,
          personName: order.personName,
          orders: [],
          totalValue: 0,
          roomChargePaid: 0,
          paid: false,
          itemsSummary: new Map(),
        };
        room.tabs.push(tab);
      }

      tab.orders.push(order);
      tab.totalValue += order.total;

      order.items.forEach((item) => {
        const existing = tab!.itemsSummary.get(item.id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          tab!.itemsSummary.set(item.id, {
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          });
        }
      });

      if (order.timestamp < room.startTime) {
        room.startTime = order.timestamp;
      }
    });

    return Array.from(roomMap.values());
  };

  const closeTab = (room: RoomSession, tab: TabSession) => {
    setClosingTab({ room, tab });
  };

  const confirmCloseTab = (roomCharge: number) => {
    if (!closingTab) return;

    const updatedTab = { ...closingTab.tab, roomChargePaid: roomCharge, paid: true };
    alert(
      `Comanda fechada!\n${closingTab.tab.tabName} - ${closingTab.tab.personName}\n` +
        `Consumo: R$ ${closingTab.tab.totalValue.toFixed(2)}\n` +
        `Taxa da Sala: R$ ${roomCharge.toFixed(2)}\n` +
        `Total: R$ ${(closingTab.tab.totalValue + roomCharge).toFixed(2)}`
    );
    setClosingTab(null);
  };

  const closeRoom = (room: RoomSession) => {
    setClosingRoom(room);
    setPaymentMode("equal");
    setCustomPayments({});
  };

  const confirmCloseRoom = () => {
    if (!closingRoom) return;

    const openTabs = closingRoom.tabs.filter((t) => !t.paid);
    const totalRoomCost = calculateRoomCost(closingRoom.startTime, closingRoom.hourlyRate);
    const paidRoomCharge = closingRoom.tabs.reduce((sum, t) => sum + t.roomChargePaid, 0);
    const remainingRoomCost = totalRoomCost - paidRoomCharge;

    let payments: TabPayment[] = [];

    if (paymentMode === "equal") {
      const perTab = remainingRoomCost / openTabs.length;
      payments = openTabs.map((t) => ({
        tabName: t.tabName,
        roomCharge: perTab,
      }));
    } else {
      payments = openTabs.map((t) => ({
        tabName: t.tabName,
        roomCharge: customPayments[t.tabName] || 0,
      }));
    }

    const summary = payments
      .map(
        (p) =>
          `${p.tabName}: R$ ${p.roomCharge.toFixed(2)} (sala) + consumo`
      )
      .join("\n");

    alert(
      `Sala fechada!\n${closingRoom.roomId}\n\n` +
        `Custo Total da Sala: R$ ${totalRoomCost.toFixed(2)}\n` +
        `Já Pago: R$ ${paidRoomCharge.toFixed(2)}\n` +
        `Restante: R$ ${remainingRoomCost.toFixed(2)}\n\n` +
        `Divisão:\n${summary}`
    );

    setClosingRoom(null);
  };

  const roomSessions = groupOrdersByRoom();

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
              <h1>Gerenciar Comandas</h1>
              <p className="text-sm opacity-80">
                Acompanhe pedidos e sessões das salas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="text-sm text-white/80">
                {user.email}
              </div>
            )}
            <button
              onClick={handleLogout}
              className="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-6 py-3 transition-colors ${
              activeTab === "orders"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pedidos
          </button>
          <button
            onClick={() => setActiveTab("sessions")}
            className={`px-6 py-3 transition-colors ${
              activeTab === "sessions"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sessões das Salas
          </button>
        </div>
      </div>

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {orders
              .filter((order) => order.status !== "delivered" && order.status !== "cancelled")
              .map((order) => {
                const isNew = !viewedOrders.has(order.id);

                return (
                <div
                  key={order.id}
                  onClick={() => markAsViewed(order.id)}
                  className={`bg-card border rounded-lg p-3 cursor-pointer transition-all ${
                    isNew
                      ? "border-primary shadow-lg shadow-primary/20"
                      : "border-border"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm">
                          {order.roomId} - {order.tabName}
                        </h4>
                        {isNew && (
                          <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded animate-pulse">
                            NOVO
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.personName}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(order.timestamp)}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {getStatusText(order.status)}
                    </span>
                  </div>

                  <div className="space-y-1 mb-2">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between text-xs bg-secondary/30 rounded px-2 py-1"
                      >
                        <span>
                          {item.quantity}x {item.name}
                        </span>
                        <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-border">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-primary text-sm">
                        R$ {order.total.toFixed(2)}
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditOrder(order);
                        }}
                        className="flex-1 px-2 py-1.5 bg-secondary text-secondary-foreground rounded text-xs hover:bg-secondary/80 transition-colors flex items-center justify-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        Editar
                      </button>
                      {order.status === "pending" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateOrderStatus(order.id, "preparing");
                          }}
                          className="flex-1 px-2 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                        >
                          Preparar
                        </button>
                      )}
                      {order.status === "preparing" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateOrderStatus(order.id, "delivered");
                          }}
                          className="flex-1 px-2 py-1.5 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Entregar
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateOrderStatus(order.id, "cancelled");
                        }}
                        className="px-2 py-1.5 bg-destructive text-destructive-foreground rounded text-xs hover:bg-destructive/90 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled").length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Nenhum pedido ativo no momento
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === "sessions" && (
        <div className="max-w-7xl mx-auto p-6">
          <div className="space-y-4">
            {roomSessions.map((room) => {
              const isRoomExpanded = expandedRooms.has(room.roomId);
              const totalConsumption = room.tabs.reduce(
                (sum, tab) => sum + tab.totalValue,
                0
              );
              const roomCost = calculateRoomCost(room.startTime, room.hourlyRate);
              const paidRoomCharge = room.tabs.reduce(
                (sum, t) => sum + t.roomChargePaid,
                0
              );
              const paidConsumption = room.tabs
                .filter((t) => t.paid)
                .reduce((sum, t) => sum + t.totalValue, 0);
              const totalPaid = paidConsumption + paidRoomCharge;
              const remainingRoomCost = roomCost - paidRoomCharge;

              return (
                <div
                  key={room.roomId}
                  className="bg-card border border-primary rounded-lg overflow-hidden"
                >
                  {/* Room Header */}
                  <div
                    className="bg-secondary/30 p-4 cursor-pointer hover:bg-secondary/40 transition-colors"
                    onClick={() => toggleRoom(room.roomId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {isRoomExpanded ? (
                          <ChevronUp className="w-5 h-5 text-primary" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-primary" />
                        )}
                        <div>
                          <h2 className="text-primary">{room.roomId}</h2>
                          <div className="text-sm text-muted-foreground mt-1">
                            {room.tabs.length}{" "}
                            {room.tabs.length === 1 ? "comanda" : "comandas"} •
                            Duração: {formatDuration(room.startTime)} • R${" "}
                            {room.hourlyRate.toFixed(2)}/h
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mr-4">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            Valor da Sala
                          </div>
                          <div className="text-sm">
                            R$ {roomCost.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            Total Consumo
                          </div>
                          <div className="text-sm">
                            R$ {totalConsumption.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            Total Pago
                          </div>
                          <div className="text-sm text-green-600">
                            R$ {totalPaid.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            Saldo em Aberto
                          </div>
                          <div className="text-sm text-primary">
                            R$ {remainingRoomCost.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowQRModal(room.roomId);
                        }}
                        className="p-2 hover:bg-secondary rounded-md transition-colors"
                      >
                        <QrCode className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Room Tabs */}
                  {isRoomExpanded && (
                    <div className="p-4 space-y-3">
                      {room.tabs.map((tab) => {
                        const tabKey = `${room.roomId}-${tab.tabName}`;
                        const isTabExpanded = expandedTabs.has(tabKey);

                        return (
                          <div
                            key={tabKey}
                            className={`border rounded-lg overflow-hidden ${
                              tab.paid
                                ? "border-green-500 bg-green-500/5"
                                : "border-border"
                            }`}
                          >
                            {/* Tab Header */}
                            <div
                              className="bg-secondary/20 p-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                              onClick={() => toggleTab(tabKey)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {isTabExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3>{tab.tabName}</h3>
                                      {tab.paid ? (
                                        <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded">
                                          PAGA
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs rounded">
                                          EM ABERTO
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {tab.personName} • {tab.orders.length}{" "}
                                      {tab.orders.length === 1
                                        ? "pedido"
                                        : "pedidos"}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-primary">
                                    R$ {tab.totalValue.toFixed(2)}
                                  </div>
                                  {tab.roomChargePaid > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      Sala paga: R$ {tab.roomChargePaid.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Tab Items Summary */}
                            {isTabExpanded && (
                              <div className="p-3 space-y-2">
                                <h4 className="text-sm text-muted-foreground mb-2">
                                  Consumo Agrupado
                                </h4>
                                {Array.from(tab.itemsSummary.entries()).map(
                                  ([itemId, item]) => (
                                    <div
                                      key={itemId}
                                      className="bg-secondary/30 rounded px-3 py-3 text-sm"
                                    >
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="flex-1">
                                          {item.quantity}x {item.name}
                                        </span>
                                        <span className="text-primary ml-2">
                                          R${" "}
                                          {(item.price * item.quantity).toFixed(2)}
                                        </span>
                                      </div>
                                      {!tab.paid && (
                                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateTabItem(
                                                  room.roomId,
                                                  tab.tabName,
                                                  itemId,
                                                  item.quantity - 1
                                                );
                                              }}
                                              className="w-6 h-6 bg-secondary hover:bg-secondary/80 rounded flex items-center justify-center transition-colors"
                                            >
                                              <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="w-8 text-center text-xs">
                                              {item.quantity}
                                            </span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateTabItem(
                                                  room.roomId,
                                                  tab.tabName,
                                                  itemId,
                                                  item.quantity + 1
                                                );
                                              }}
                                              className="w-6 h-6 bg-primary text-primary-foreground hover:bg-primary/90 rounded flex items-center justify-center transition-colors"
                                            >
                                              <Plus className="w-3 h-3" />
                                            </button>
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeTabItem(
                                                room.roomId,
                                                tab.tabName,
                                                itemId
                                              );
                                            }}
                                            className="text-destructive hover:text-destructive/80 text-xs transition-colors"
                                          >
                                            Remover
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )
                                )}
                                <div className="pt-2 mt-2 border-t border-border flex justify-between">
                                  <span className="text-sm">Subtotal</span>
                                  <span className="text-primary">
                                    R$ {tab.totalValue.toFixed(2)}
                                  </span>
                                </div>

                                {!tab.paid && (
                                  <button
                                    onClick={() => closeTab(room, tab)}
                                    className="w-full mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                  >
                                    <DollarSign className="w-4 h-4" />
                                    Fechar Comanda
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <button
                        onClick={() => closeRoom(room)}
                        className="w-full mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                      >
                        Fechar Conta da Sala
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {roomSessions.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma sessão ativa no momento
              </div>
            )}
          </div>
        </div>
      )}

      {/* Close Tab Modal */}
      {closingTab && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-md w-full p-6">
            <h2 className="mb-4">Fechar Comanda</h2>

            <div className="space-y-4 mb-6">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Comanda</div>
                <div>
                  {closingTab.tab.tabName} - {closingTab.tab.personName}
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Consumo</span>
                  <span>R$ {closingTab.tab.totalValue.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2">
                  Valor da Sala a Pagar (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={
                    (
                      calculateRoomCost(
                        closingTab.room.startTime,
                        closingTab.room.hourlyRate
                      ) / closingTab.room.tabs.filter((t) => !t.paid).length
                    ).toFixed(2)
                  }
                  id="room-charge-input"
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="bg-accent border border-border rounded-lg p-4">
                <div className="flex justify-between">
                  <span>Total a Pagar</span>
                  <span className="text-primary">
                    R${" "}
                    {(
                      closingTab.tab.totalValue +
                      parseFloat(
                        (
                          document.getElementById(
                            "room-charge-input"
                          ) as HTMLInputElement
                        )?.value || "0"
                      )
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setClosingTab(null)}
                className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById(
                    "room-charge-input"
                  ) as HTMLInputElement;
                  confirmCloseTab(parseFloat(input.value));
                }}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Room Modal */}
      {closingRoom && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border sticky top-0 bg-background">
              <h2>Fechar Conta da Sala - {closingRoom.roomId}</h2>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">
                    Custo Total da Sala
                  </div>
                  <div className="text-primary">
                    R${" "}
                    {calculateRoomCost(
                      closingRoom.startTime,
                      closingRoom.hourlyRate
                    ).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDuration(closingRoom.startTime)} • R${" "}
                    {closingRoom.hourlyRate.toFixed(2)}/h
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">
                    Já Pago
                  </div>
                  <div>
                    R${" "}
                    {closingRoom.tabs
                      .reduce((sum, t) => sum + t.roomChargePaid, 0)
                      .toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="bg-accent border border-border rounded-lg p-4">
                <div className="flex justify-between">
                  <span>Saldo Restante da Sala</span>
                  <span className="text-primary">
                    R${" "}
                    {(
                      calculateRoomCost(
                        closingRoom.startTime,
                        closingRoom.hourlyRate
                      ) -
                      closingRoom.tabs.reduce(
                        (sum, t) => sum + t.roomChargePaid,
                        0
                      )
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="mb-3">Modo de Divisão</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setPaymentMode("equal")}
                    className={`w-full p-4 border rounded-lg text-left transition-colors ${
                      paymentMode === "equal"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-secondary/20"
                    }`}
                  >
                    <div>Dividir Igualmente</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {closingRoom.tabs.filter((t) => !t.paid).length} comandas
                      em aberto • R${" "}
                      {(
                        (calculateRoomCost(
                          closingRoom.startTime,
                          closingRoom.hourlyRate
                        ) -
                          closingRoom.tabs.reduce(
                            (sum, t) => sum + t.roomChargePaid,
                            0
                          )) /
                        closingRoom.tabs.filter((t) => !t.paid).length
                      ).toFixed(2)}{" "}
                      por comanda
                    </div>
                  </button>

                  <button
                    onClick={() => setPaymentMode("custom")}
                    className={`w-full p-4 border rounded-lg text-left transition-colors ${
                      paymentMode === "custom"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-secondary/20"
                    }`}
                  >
                    <div>Divisão Personalizada</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Definir valor individual para cada comanda
                    </div>
                  </button>
                </div>
              </div>

              {paymentMode === "custom" && (
                <div className="space-y-3">
                  <h4>Valores por Comanda</h4>
                  {closingRoom.tabs
                    .filter((t) => !t.paid)
                    .map((tab) => (
                      <div
                        key={tab.tabName}
                        className="bg-card border border-border rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-sm">{tab.tabName}</div>
                            <div className="text-xs text-muted-foreground">
                              {tab.personName}
                            </div>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={customPayments[tab.tabName] || ""}
                            onChange={(e) =>
                              setCustomPayments({
                                ...customPayments,
                                [tab.tabName]: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-32 px-3 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}

              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="mb-3">Comandas em Aberto</h4>
                <div className="space-y-2">
                  {closingRoom.tabs
                    .filter((t) => !t.paid)
                    .map((tab) => (
                      <div
                        key={tab.tabName}
                        className="flex justify-between text-sm"
                      >
                        <span>
                          {tab.tabName} - {tab.personName}
                        </span>
                        <span>Consumo: R$ {tab.totalValue.toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border flex gap-3">
              <button
                onClick={() => setClosingRoom(null)}
                className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmCloseRoom}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Confirmar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <div className="flex justify-between items-center">
                <div>
                  <h2>Editar Pedido</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {editingOrder.roomId} - {editingOrder.tabName}
                  </p>
                </div>
                <button
                  onClick={() => setEditingOrder(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="mb-3">Itens do Pedido</h3>
                <div className="space-y-3">
                  {editingOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-card border border-border rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <h4>{item.name}</h4>
                          <div className="text-sm text-muted-foreground mt-1">
                            R$ {item.price.toFixed(2)} cada
                          </div>
                        </div>
                        <div className="text-primary">
                          R$ {(item.price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            Quantidade:
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateOrderItem(item.id, item.quantity - 1)
                              }
                              className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center hover:bg-secondary/80"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-12 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateOrderItem(item.id, item.quantity + 1)
                              }
                              className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => updateOrderItem(item.id, 0)}
                          className="text-destructive hover:text-destructive/80 text-sm"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}

                  {editingOrder.items.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum item no pedido
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-accent border border-border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span>Total do Pedido</span>
                  <span className="text-primary">
                    R$ {editingOrder.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border flex gap-3">
              <button
                onClick={() => setEditingOrder(null)}
                className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveEditedOrder}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Salvar Alterações
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
              <h2>QR Code - {showQRModal}</h2>
              <button
                onClick={() => setShowQRModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <QRCodeDisplay
              value={`${window.location.origin}/room/${showQRModal
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
              roomName={showQRModal}
            />

            <p className="text-sm text-muted-foreground text-center mt-4">
              Clientes podem escanear este QR code para fazer pedidos
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
