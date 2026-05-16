import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = [
    { name: "Sushi", description: "Sushis tradicionais e especiais", order: 1 },
    { name: "Temaki", description: "Temakis variados", order: 2 },
    { name: "Hot Roll", description: "Hot rolls empanados", order: 3 },
    { name: "Pratos Quentes", description: "Pratos orientais quentes", order: 4 },
    { name: "Bebidas", description: "Bebidas em geral", order: 5 }
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.order.toString() },
      update: category,
      create: { id: category.order.toString(), ...category }
    });
  }

  const rooms = [
    { name: "Sala 1", floor: 1, capacity: 8, hourlyRate: 50 },
    { name: "Sala 2", floor: 1, capacity: 6, hourlyRate: 40 },
    { name: "Sala 3", floor: 2, capacity: 10, hourlyRate: 60 },
    { name: "Sala 4", floor: 2, capacity: 12, hourlyRate: 70 },
    { name: "Sala 5", floor: 3, capacity: 8, hourlyRate: 50 }
  ];

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { name: room.name },
      update: room,
      create: room
    });
  }

  const menuItems = [
    {
      id: "menu-sushi-combinado",
      categoryId: "1",
      name: "Sushi Combinado",
      description: "12 peças variadas de sushi fresco com salmão, atum e peixe branco",
      price: 68.9
    },
    {
      id: "menu-temaki-salmao",
      categoryId: "2",
      name: "Temaki de Salmão",
      description: "Temaki com salmão fresco, cream cheese, pepino e cebolinha",
      price: 24.9
    },
    {
      id: "menu-temaki-atum",
      categoryId: "2",
      name: "Temaki de Atum",
      description: "Temaki com atum fresco, cebolinha e gergelim",
      price: 26.9
    },
    {
      id: "menu-hot-roll-filadelfia",
      categoryId: "3",
      name: "Hot Roll Filadélfia",
      description: "8 peças de hot roll empanado com salmão grelhado e cream cheese philadelphia",
      price: 42.9
    },
    {
      id: "menu-yakisoba",
      categoryId: "4",
      name: "Yakisoba",
      description: "Macarrão frito com legumes frescos e proteína à escolha",
      price: 38.9
    },
    {
      id: "menu-refrigerante-lata",
      categoryId: "5",
      name: "Refrigerante Lata",
      description: "Coca-Cola, Guaraná Antarctica ou Sprite - 350ml gelado",
      price: 6.9
    }
  ];

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: item,
      create: item
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
