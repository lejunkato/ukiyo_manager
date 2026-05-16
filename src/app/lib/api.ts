import { getApiUrl } from "./config";

const API_URL = getApiUrl();

export interface Room {
  id: string;
  name: string;
  floor: number;
  capacity: number;
  hourlyRate: number;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  order: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  available: boolean;
  image?: string;
  category?: string;
}

export interface Tab {
  id: string;
  roomId: string;
  tabName: string;
  personName: string;
  paid: boolean;
  roomChargePaid: number;
}

export interface OrderItem {
  id: string;
  menuItemId?: string | null;
  name: string;
  quantity: number;
  price: number;
  observations?: string | null;
}

export interface Order {
  id: string;
  roomId: string;
  tabId: string;
  tabName: string;
  personName: string;
  items: OrderItem[];
  total: number;
  status: "pending" | "preparing" | "delivered" | "cancelled";
  viewed: boolean;
  timestamp: string;
}

export interface RoomSummary {
  room: Room;
  tabs: Array<{
    id: string;
    tabName: string;
    personName: string;
    totalValue: number;
    paid: boolean;
    roomChargePaid: number;
    items: { name: string; quantity: number; price: number }[];
  }>;
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...init } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${path}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getRooms: () => request<Room[]>("/rooms"),
  getRoom: (roomId: string) => request<Room>(`/rooms/${roomId}`),
  createRoom: (data: Omit<Room, "id">, token?: string | null) =>
    request<Room>("/rooms", { method: "POST", body: JSON.stringify(data), token }),
  updateRoom: (id: string, data: Partial<Room>, token?: string | null) =>
    request<Room>(`/rooms/${id}`, { method: "PUT", body: JSON.stringify(data), token }),
  deleteRoom: (id: string, token?: string | null) =>
    request<void>(`/rooms/${id}`, { method: "DELETE", token }),

  getCategories: () => request<Category[]>("/categories"),
  createCategory: (data: Omit<Category, "id" | "order"> & { order?: number }, token?: string | null) =>
    request<Category>("/categories", { method: "POST", body: JSON.stringify(data), token }),
  updateCategory: (id: string, data: Partial<Category>, token?: string | null) =>
    request<Category>(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data), token }),
  deleteCategory: (id: string, token?: string | null) =>
    request<void>(`/categories/${id}`, { method: "DELETE", token }),

  getMenuItems: () => request<MenuItem[]>("/menu-items"),
  createMenuItem: (data: Omit<MenuItem, "id" | "category">, token?: string | null) =>
    request<MenuItem>("/menu-items", { method: "POST", body: JSON.stringify(data), token }),
  updateMenuItem: (id: string, data: Partial<MenuItem>, token?: string | null) =>
    request<MenuItem>(`/menu-items/${id}`, { method: "PUT", body: JSON.stringify(data), token }),
  deleteMenuItem: (id: string, token?: string | null) =>
    request<void>(`/menu-items/${id}`, { method: "DELETE", token }),

  getTabs: (roomId: string) => request<Tab[]>(`/rooms/${roomId}/tabs`),
  createTab: (roomId: string, data: Pick<Tab, "tabName" | "personName">) =>
    request<Tab>(`/rooms/${roomId}/tabs`, { method: "POST", body: JSON.stringify(data) }),
  updateTab: (id: string, data: Partial<Tab>, token?: string | null) =>
    request<Tab>(`/tabs/${id}`, { method: "PATCH", body: JSON.stringify(data), token }),
  getRoomSummary: (roomId: string) => request<RoomSummary>(`/rooms/${roomId}/summary`),

  getOrders: (token?: string | null) => request<Order[]>("/orders", { token }),
  createOrder: (
    data: {
      roomId: string;
      tabId: string;
      items: Array<{
        menuItemId?: string;
        name: string;
        quantity: number;
        price: number;
        observations?: string;
      }>;
    }
  ) => request<Order>("/orders", { method: "POST", body: JSON.stringify(data) }),
  updateOrder: (id: string, data: Partial<Order>, token?: string | null) =>
    request<Order>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(data), token }),
  updateOrderItems: (id: string, items: OrderItem[], token?: string | null) =>
    request<Order>(`/orders/${id}/items`, { method: "PUT", body: JSON.stringify({ items }), token }),
  deleteOrder: (id: string, token?: string | null) =>
    request<void>(`/orders/${id}`, { method: "DELETE", token }),
};
