import { useEffect, useState } from "react";
import { Clock, Check, X, QrCode, ChevronDown, ChevronUp, DollarSign, Edit, Trash2, Plus, Minus } from "lucide-react";
import QRCodeDisplay from "../components/QRCodeDisplay";
import { useAuth } from "../contexts/AuthContext";
import { getAdminWebSocketUrl } from "../lib/config";
import { api, type Order as ApiOrder, type OrderItem as ApiOrderItem, type Room, type RoomSession as ApiRoomSession, type RoomSummary } from "../lib/api";
import AdminHeader from "../components/AdminHeader";
import ConfirmDialog from "../components/ConfirmDialog";

type OrderItem = ApiOrderItem;

type Order = Omit<ApiOrder, "timestamp"> & { timestamp: Date };

interface RoomSessionView {
  sessionId: string;
  roomId: string;
  hourlyRate: number;
  tabs: TabSession[];
  startTime: Date;
  active: boolean;
}

interface TabSession {
  tabId: string;
  tabName: string;
  personName: string;
  orders: Order[];
  totalValue: number;
  roomChargePaid: number;
  paid: boolean;
  itemsSummary: Map<string, { name: string; quantity: number; price: number }>;
  hasSummary?: boolean;
}

interface TabPayment {
  tabName: string;
  roomCharge: number;
}

function getDefaultSessionStartDateTime() {
  const now = new Date();
  const roundedMinutes = Math.floor(now.getMinutes() / 15) * 15;
  now.setMinutes(roundedMinutes, 0, 0);
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-") + `T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function buildSessionStartDate(dateTime: string) {
  return new Date(dateTime);
}

export default function AdminOrders() {
  const { token } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeSessions, setActiveSessions] = useState<ApiRoomSession[]>([]);
  const [activeRoomSummaries, setActiveRoomSummaries] = useState<RoomSummary[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [activeTab, setActiveTab] = useState<"orders" | "sessions">("orders");
  const [showQRModal, setShowQRModal] = useState<string | null>(null);
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(new Set());
  const [closingTab, setClosingTab] = useState<{
    room: RoomSessionView;
    tab: TabSession;
  } | null>(null);
  const [closingRoom, setClosingRoom] = useState<RoomSessionView | null>(null);
  const [customPayments, setCustomPayments] = useState<Record<string, number>>({});
  const [paymentMode, setPaymentMode] = useState<"equal" | "custom">("equal");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewedOrders, setViewedOrders] = useState<Set<string>>(new Set());
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [isConfirmingTabPayment, setIsConfirmingTabPayment] = useState(false);
  const [isConfirmingRoomPayment, setIsConfirmingRoomPayment] = useState(false);
  const [showStartSessionModal, setShowStartSessionModal] = useState(false);
  const [startSessionRoomId, setStartSessionRoomId] = useState("");
  const [startSessionDateTime, setStartSessionDateTime] = useState(getDefaultSessionStartDateTime);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [pendingDeleteOrderId, setPendingDeleteOrderId] = useState<string | null>(null);
  const [pendingRemoveTabItem, setPendingRemoveTabItem] = useState<{
    roomId: string;
    tabName: string;
    itemId: string;
  } | null>(null);

  const normalizeOrder = (order: ApiOrder): Order => ({
    ...order,
    timestamp: new Date(order.timestamp),
  });

  const loadOrders = async () => {
    try {
      const [loadedOrders, loadedRooms] = await Promise.all([
        api.getOrders(token),
        api.getRooms(),
      ]);
      const loadedSessions = await Promise.all(
        loadedRooms.map((room) => api.getActiveRoomSession(room.id))
      );

      const activeSessionList = loadedSessions
        .map((sessionInfo) => sessionInfo.activeSession)
        .filter((session): session is ApiRoomSession => Boolean(session));
      const activeRoomIdSet = new Set(activeSessionList.map((session) => session.roomId));
      const loadedSummaries = await Promise.all(
        loadedRooms
          .filter((room) => activeRoomIdSet.has(room.id))
          .map((room) => api.getRoomSummary(room.id).catch(() => null))
      );

      setOrders(loadedOrders.map(normalizeOrder));
      setRooms(loadedRooms);
      setActiveSessions(activeSessionList);
      setActiveRoomSummaries(
        loadedSummaries.filter((summary): summary is RoomSummary => Boolean(summary))
      );
      setViewedOrders(new Set(loadedOrders.filter((order) => order.viewed).map((order) => order.id)));
    } catch (error) {
      console.error(error);
      alert("Não foi possível carregar os pedidos");
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [token]);

  useEffect(() => {
    if (!token) return;

    let refreshTimer: number | undefined;
    let reconnectTimer: number | undefined;
    let closedByEffect = false;
    let socket: WebSocket | null = null;

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        loadOrders();
      }, 250);
    };

    const connect = () => {
      setRealtimeStatus("connecting");
      socket = new WebSocket(getAdminWebSocketUrl(token));

      socket.addEventListener("open", () => {
        setRealtimeStatus("connected");
      });

      socket.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "orders:changed" || data.type === "sessions:changed") {
            scheduleRefresh();
          }
        } catch (error) {
          console.error(error);
        }
      });

      socket.addEventListener("close", () => {
        setRealtimeStatus("disconnected");
        if (!closedByEffect) {
          reconnectTimer = window.setTimeout(connect, 3000);
        }
      });

      socket.addEventListener("error", () => {
        socket?.close();
      });
    };

    connect();

    return () => {
      closedByEffect = true;
      window.clearTimeout(refreshTimer);
      window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [token]);

  const markAsViewed = async (orderId: string) => {
    setViewedOrders((prev) => new Set([...prev, orderId]));
    const order = orders.find((item) => item.id === orderId);
    if (!order?.viewed) {
      try {
        const updatedOrder = normalizeOrder(await api.updateOrder(orderId, { viewed: true }, token));
        setOrders((prev) => prev.map((item) => item.id === orderId ? updatedOrder : item));
      } catch (error) {
        console.error(error);
      }
    }
  };

  const openEditOrder = (order: Order) => {
    setEditingOrder({ ...order });
  };

  const saveEditedOrder = async () => {
    if (!editingOrder) return;

    try {
      const updatedOrder = normalizeOrder(await api.updateOrderItems(editingOrder.id, editingOrder.items, token));
      setOrders((prev) =>
        prev.map((order) =>
          order.id === editingOrder.id ? updatedOrder : order
        )
      );
      setEditingOrder(null);
    } catch (error) {
      console.error(error);
      alert("Não foi possível salvar o pedido");
    }
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
    setPendingDeleteOrderId(orderId);
  };

  const confirmDeleteOrder = async () => {
    if (!pendingDeleteOrderId) return;
    try {
      await api.deleteOrder(pendingDeleteOrderId, token);
      setOrders((prev) => prev.filter((order) => order.id !== pendingDeleteOrderId));
      setPendingDeleteOrderId(null);
    } catch (error) {
      console.error(error);
      alert("Não foi possível excluir o pedido");
    }
  };

  const updateTabItem = async (roomId: string, tabName: string, itemId: string, newQuantity: number) => {
    const affectedOrders: Order[] = [];
    const nextOrders = orders
      .map((order) => {
        if (order.roomId === roomId && order.tabName === tabName) {
          const updatedItems = order.items.map((item) => {
            if (item.id === itemId) {
              return { ...item, quantity: newQuantity };
            }
            return item;
          }).filter((item) => item.quantity > 0);

          const newTotal = updatedItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );

          const updatedOrder = { ...order, items: updatedItems, total: newTotal };
          affectedOrders.push(updatedOrder);
          return updatedOrder;
        }
        return order;
      })
      .filter((order) => order.items.length > 0);

    setOrders(nextOrders);

    try {
      await Promise.all(
        affectedOrders.map((order) =>
          order.items.length > 0
            ? api.updateOrderItems(order.id, order.items, token)
            : api.deleteOrder(order.id, token)
        )
      );
      await loadOrders();
    } catch (error) {
      console.error(error);
      alert("Não foi possível atualizar a comanda");
      await loadOrders();
    }
  };

  const removeTabItem = async (roomId: string, tabName: string, itemId: string) => {
    setPendingRemoveTabItem({ roomId, tabName, itemId });
  };

  const confirmRemoveTabItem = async () => {
    if (!pendingRemoveTabItem) return;
    const { roomId, tabName, itemId } = pendingRemoveTabItem;
    setPendingRemoveTabItem(null);
    await updateTabItem(roomId, tabName, itemId, 0);
  };

  const updateOrderStatus = async (orderId: string, status: Order["status"]) => {
    try {
      const updatedOrder = normalizeOrder(await api.updateOrder(orderId, { status }, token));
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? updatedOrder : order))
      );
    } catch (error) {
      console.error(error);
      alert("Não foi possível atualizar o status do pedido");
    }
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

  const toMoney = (value: number): number => Math.round(value * 100) / 100;

  const sumMoney = (values: number[]): number =>
    values.reduce((sum, value) => toMoney(sum + value), 0);

  const calculateRoomCost = (startTime: Date, hourlyRate: number): number => {
    const diff = Math.max(Date.now() - startTime.getTime(), 0);
    const billedHours = Math.max(Math.ceil(diff / 3600000), 1);
    return toMoney(billedHours * hourlyRate);
  };

  const getOpenTabsCount = (tabs: TabSession[]): number =>
    Math.max(tabs.filter((tab) => !tab.paid).length, 1);

  const calculatePaidConsumption = (tabs: TabSession[]): number => {
    return sumMoney(tabs.filter((tab) => tab.paid).map((tab) => tab.totalValue));
  };

  const calculatePaidRoomCharge = (tabs: TabSession[]): number => {
    return sumMoney(tabs.map((tab) => tab.roomChargePaid));
  };

  const calculateRoomBalances = (room: RoomSessionView) => {
    const totalConsumption = sumMoney(room.tabs.map((tab) => tab.totalValue));
    const roomCost = calculateRoomCost(room.startTime, room.hourlyRate);
    const paidConsumption = calculatePaidConsumption(room.tabs);
    const paidRoomCharge = calculatePaidRoomCharge(room.tabs);
    const totalPaid = toMoney(paidConsumption + paidRoomCharge);
    const consumptionBalance = Math.max(toMoney(totalConsumption - paidConsumption), 0);
    const roomBalance = Math.max(toMoney(roomCost - paidRoomCharge), 0);
    const totalBalance = toMoney(consumptionBalance + roomBalance);

    return {
      totalConsumption,
      roomCost,
      paidConsumption,
      paidRoomCharge,
      totalPaid,
      consumptionBalance,
      roomBalance,
      totalBalance,
    };
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

  const groupOrdersByRoom = (): RoomSessionView[] => {
    const roomMap = new Map<string, RoomSessionView>();
    const sessionsByRoomId = new Map(activeSessions.map((session) => [session.roomId, session]));

    activeSessions.forEach((session) => {
      const room = rooms.find((item) => item.id === session.roomId);
      if (!room) return;

      const summary = activeRoomSummaries.find((item) => item.room.id === room.id);
      roomMap.set(room.name, {
        sessionId: session.id,
        roomId: room.name,
        hourlyRate: room.hourlyRate,
        tabs: summary?.tabs.map((tab) => ({
          tabId: tab.id,
          tabName: tab.tabName,
          personName: tab.personName,
          orders: [],
          totalValue: toMoney(tab.totalValue),
          roomChargePaid: tab.roomChargePaid,
          paid: tab.paid,
          hasSummary: true,
          itemsSummary: new Map(),
        })) ?? [],
        startTime: new Date(session.startedAt),
        active: true,
      });
    });

    orders.forEach((order) => {
      const roomInfo = rooms.find((room) => room.name === order.roomId);
      const activeSession = roomInfo ? sessionsByRoomId.get(roomInfo.id) : undefined;
      const roomRate = roomInfo?.hourlyRate ?? 50;
      if (!roomMap.has(order.roomId)) {
        roomMap.set(order.roomId, {
          sessionId: order.roomSessionId ?? activeSession?.id ?? "",
          roomId: order.roomId,
          hourlyRate: roomRate,
          tabs: [],
          startTime: activeSession ? new Date(activeSession.startedAt) : order.timestamp,
          active: true,
        });
      }

      const room = roomMap.get(order.roomId)!;
      let tab = room.tabs.find((t) => t.tabName === order.tabName);

      if (!tab) {
        tab = {
          tabId: order.tabId,
          tabName: order.tabName,
          personName: order.personName,
          orders: [],
          totalValue: 0,
          roomChargePaid: order.tabRoomChargePaid,
          paid: order.tabPaid,
          itemsSummary: new Map(),
        };
        room.tabs.push(tab);
      } else {
        tab.roomChargePaid = order.tabRoomChargePaid;
        tab.paid = order.tabPaid;
      }

      tab.orders.push(order);
      if (!tab.hasSummary) {
        tab.totalValue = toMoney(tab.totalValue + order.total);
      }

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

      if (!activeSession && order.timestamp < room.startTime) {
        room.startTime = order.timestamp;
      }
    });

    return Array.from(roomMap.values());
  };

  const closeTab = (room: RoomSessionView, tab: TabSession) => {
    if (tab.paid) return;
    setClosingTab({ room, tab });
  };

  const confirmCloseTab = async (roomCharge: number) => {
    if (!closingTab) return;
    if (closingTab.tab.paid || isConfirmingTabPayment) return;

    try {
      setIsConfirmingTabPayment(true);
      await api.updateTab(closingTab.tab.tabId, {
        roomChargePaid: roomCharge,
        paid: true,
      }, token);
      alert(
        `Comanda fechada!\n${closingTab.tab.personName} - ${closingTab.tab.tabName}\n` +
          `Consumo: R$ ${closingTab.tab.totalValue.toFixed(2)}\n` +
          `Taxa da Sala: R$ ${roomCharge.toFixed(2)}\n` +
          `Total: R$ ${(closingTab.tab.totalValue + roomCharge).toFixed(2)}`
      );
      setClosingTab(null);
      await loadOrders();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error && error.message === "tab_already_paid"
        ? "Esta comanda já foi paga."
        : "Não foi possível fechar a comanda");
      await loadOrders();
    } finally {
      setIsConfirmingTabPayment(false);
    }
  };

  const closeRoom = (room: RoomSessionView) => {
    setClosingRoom(room);
    setPaymentMode("equal");
    setCustomPayments({});
  };

  const openStartSessionModal = () => {
    const activeRoomIds = new Set(activeSessions.map((session) => session.roomId));
    const firstAvailableRoom = rooms.find((room) => !activeRoomIds.has(room.id));
    setStartSessionRoomId(firstAvailableRoom?.id ?? "");
    setStartSessionDateTime(getDefaultSessionStartDateTime());
    setShowStartSessionModal(true);
  };

  const openRoomSession = async () => {
    if (!startSessionRoomId) return;

    try {
      setIsStartingSession(true);
      await api.openRoomSession(
        startSessionRoomId,
        { startedAt: buildSessionStartDate(startSessionDateTime).toISOString() },
        token
      );
      setShowStartSessionModal(false);
      await loadOrders();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error && error.message === "room_session_already_open"
        ? "Esta sala já tem uma sessão aberta."
        : "Não foi possível abrir a sessão da sala");
    } finally {
      setIsStartingSession(false);
    }
  };

  const confirmCloseRoom = async () => {
    if (!closingRoom) return;
    if (isConfirmingRoomPayment) return;

    const openTabs = closingRoom.tabs.filter((t) => !t.paid);
    const {
      roomCost: totalRoomCost,
      paidRoomCharge,
      roomBalance: remainingRoomCost,
    } = calculateRoomBalances(closingRoom);

    let payments: TabPayment[] = [];

    if (paymentMode === "equal") {
      const perTab = openTabs.length > 0 ? toMoney(remainingRoomCost / openTabs.length) : 0;
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

    try {
      setIsConfirmingRoomPayment(true);
      await Promise.all(
        openTabs.map((tab) => {
          const payment = payments.find((item) => item.tabName === tab.tabName);
          return api.updateTab(tab.tabId, {
            paid: true,
            active: false,
            roomChargePaid: payment?.roomCharge ?? 0,
          }, token);
        })
      );

      if (closingRoom.sessionId) {
        await api.closeRoomSession(closingRoom.sessionId, token);
      }

      alert(
        `Sala fechada!\n${closingRoom.roomId}\n\n` +
          `Custo Total da Sala: R$ ${totalRoomCost.toFixed(2)}\n` +
          `Já Pago: R$ ${paidRoomCharge.toFixed(2)}\n` +
          `Restante: R$ ${remainingRoomCost.toFixed(2)}\n\n` +
          `Divisão:\n${summary}`
      );

      setClosingRoom(null);
      await loadOrders();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error && error.message === "tab_already_paid"
        ? "Uma das comandas já havia sido paga. A tela será atualizada."
        : "Não foi possível fechar a sala");
      await loadOrders();
    } finally {
      setIsConfirmingRoomPayment(false);
    }
  };

  const roomSessions = groupOrdersByRoom();
  const activeRoomIds = new Set(activeSessions.map((session) => session.roomId));
  const roomsWithoutActiveSession = rooms.filter((room) => !activeRoomIds.has(room.id));
  const qrRoom = showQRModal ? rooms.find((room) => room.name === showQRModal) : null;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader
        title="Gerenciar Comandas"
        description="Acompanhe pedidos e sessões das salas"
        backTo="/"
        rightSlot={
          <div className="hidden sm:flex text-xs text-white/70 items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                realtimeStatus === "connected"
                  ? "bg-green-400"
                  : realtimeStatus === "connecting"
                    ? "bg-yellow-400"
                    : "bg-red-400"
              }`}
            />
            {realtimeStatus === "connected"
              ? "Tempo real"
              : realtimeStatus === "connecting"
                ? "Conectando"
                : "Reconectando"}
          </div>
        }
      />

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
          {isLoadingOrders && (
            <div className="text-center py-12 text-muted-foreground">
              Carregando pedidos...
            </div>
          )}

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
	                          {order.roomId} - {order.personName}
	                        </h4>
                        {isNew && (
                          <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded animate-pulse">
                            NOVO
                          </span>
                        )}
                      </div>
	                      <div className="text-xs text-muted-foreground">
	                        {order.tabName}
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2>Sessões abertas</h2>
              </div>
              <button
                onClick={openStartSessionModal}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Iniciar Sessão
              </button>
            </div>

            {roomSessions.map((room) => {
              const isRoomExpanded = expandedRooms.has(room.roomId);
              const {
                totalConsumption,
                roomCost,
                totalPaid,
                consumptionBalance,
                roomBalance,
                totalBalance,
              } = calculateRoomBalances(room);

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
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mr-4">
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
                            Saldo Consumo
                          </div>
                          <div className="text-sm text-primary">
                            R$ {consumptionBalance.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            Saldo Sala
                          </div>
                          <div className="text-sm text-primary">
                            R$ {roomBalance.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            Saldo em Aberto
                          </div>
                          <div className="text-sm text-primary">
                            R$ {totalBalance.toFixed(2)}
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
	                                      <h3>{tab.personName}</h3>
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
	                                      {tab.tabName} • {tab.orders.length}{" "}
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
                Nenhuma sessão aberta no momento
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
	                  {closingTab.tab.personName} - {closingTab.tab.tabName}
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
                    toMoney(
                      calculateRoomCost(
                        closingTab.room.startTime,
                        closingTab.room.hourlyRate
                      ) / getOpenTabsCount(closingTab.room.tabs)
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
                    {toMoney(
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
                disabled={isConfirmingTabPayment}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConfirmingTabPayment ? "Confirmando..." : "Confirmar Pagamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Session Modal */}
      {showStartSessionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-md w-full p-6">
            <h2 className="mb-4">Iniciar Sessão</h2>

            <div className="space-y-4 mb-6">
              {roomsWithoutActiveSession.length === 0 ? (
                <div className="bg-card border border-border rounded-lg p-4 text-sm text-muted-foreground">
                  Todas as salas já possuem uma sessão aberta.
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm mb-2">Sala</label>
                    <select
                      value={startSessionRoomId}
                      onChange={(event) => setStartSessionRoomId(event.target.value)}
                      className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {roomsWithoutActiveSession.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name} - R$ {room.hourlyRate.toFixed(2)}/h
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-2">Data e hora de início</label>
                    <input
                      type="datetime-local"
                      step={900}
                      value={startSessionDateTime}
                      onChange={(event) => setStartSessionDateTime(event.target.value)}
                      className="w-full px-4 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowStartSessionModal(false)}
                className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={openRoomSession}
                disabled={roomsWithoutActiveSession.length === 0 || !startSessionRoomId || isStartingSession}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStartingSession ? "Iniciando..." : "Iniciar"}
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
              {(() => {
                const balances = calculateRoomBalances(closingRoom);
                const openTabsCount = closingRoom.tabs.filter((t) => !t.paid).length;
                const perTabRoomBalance = openTabsCount > 0
                  ? balances.roomBalance / openTabsCount
                  : 0;

                return (
                  <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">
                    Custo Total da Sala
                  </div>
                  <div className="text-primary">
                    R${" "}
                    {balances.roomCost.toFixed(2)}
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
                    {balances.paidRoomCharge.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="bg-accent border border-border rounded-lg p-4">
                <div className="flex justify-between">
                  <span>Saldo Restante da Sala</span>
                  <span className="text-primary">
                    R$ {balances.roomBalance.toFixed(2)}
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
                      em aberto • R$ {perTabRoomBalance.toFixed(2)}{" "}
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
                  </>
                );
              })()}

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
	                            <div className="text-sm">{tab.personName}</div>
	                            <div className="text-xs text-muted-foreground">
	                              {tab.tabName}
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
	                          {tab.personName} - {tab.tabName}
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
                disabled={isConfirmingRoomPayment}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConfirmingRoomPayment ? "Confirmando..." : "Confirmar Fechamento"}
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
      {showQRModal && qrRoom && (
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
              value={`${window.location.origin}/room/${qrRoom.publicCode}`}
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

      <ConfirmDialog
        open={Boolean(pendingDeleteOrderId)}
        title="Excluir pedido"
        description="Deseja realmente excluir este pedido?"
        confirmLabel="Excluir"
        onConfirm={confirmDeleteOrder}
        onCancel={() => setPendingDeleteOrderId(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingRemoveTabItem)}
        title="Remover item"
        description="Deseja remover este item da comanda?"
        confirmLabel="Remover"
        onConfirm={confirmRemoveTabItem}
        onCancel={() => setPendingRemoveTabItem(null)}
      />
    </div>
  );
}
