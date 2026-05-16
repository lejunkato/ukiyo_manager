import type { Category, MenuItem, Order, OrderItem, Room, Tab } from "@prisma/client";

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

export function orderDto(order: Order & { room?: Room; tab?: Tab; items: OrderItem[] }) {
  return {
    ...order,
    roomId: order.room?.name ?? order.roomId,
    tabName: order.tab?.tabName,
    personName: order.tab?.personName,
    total: Number(order.total),
    timestamp: order.createdAt,
    items: order.items.map((item) => ({
      ...item,
      price: Number(item.price)
    }))
  };
}
