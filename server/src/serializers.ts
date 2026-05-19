import type { Category, MenuItem, Order, OrderItem, Room, RoomSession, Tab } from "@prisma/client";

export function userDto(user: { id: string; email: string; name: string; role: string; active: boolean; createdAt: Date; updatedAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export function roomDto(room: Room) {
  return {
    ...room,
    hourlyRate: Number(room.hourlyRate)
  };
}

export function categoryDto(category: Category) {
  return category;
}

export function menuItemDto(item: MenuItem & { category?: Category }) {
  return {
    ...item,
    price: Number(item.price),
    category: item.category?.name
  };
}

export function tabDto(tab: Tab) {
  return {
    ...tab,
    roomChargePaid: Number(tab.roomChargePaid)
  };
}

export function roomSessionDto(session: RoomSession) {
  return session;
}

export function orderDto(order: Order & { room?: Room; roomSession?: RoomSession | null; tab?: Tab; items: OrderItem[] }) {
  return {
    ...order,
    roomId: order.room?.name ?? order.roomId,
    roomSessionId: order.roomSession?.id ?? order.roomSessionId,
    tabId: order.tab?.id ?? order.tabId,
    tabName: order.tab?.tabName,
    personName: order.tab?.personName,
    tabPaid: order.tab?.paid ?? false,
    tabRoomChargePaid: Number(order.tab?.roomChargePaid ?? 0),
    total: Number(order.total),
    timestamp: order.createdAt,
    items: order.items.map((item) => ({
      ...item,
      price: Number(item.price)
    }))
  };
}
