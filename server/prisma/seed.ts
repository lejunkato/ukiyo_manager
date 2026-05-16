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
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
