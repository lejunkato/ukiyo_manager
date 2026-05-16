import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { Prisma, type OrderStatus } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth, signToken } from "./auth.js";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { categoryDto, menuItemDto, orderDto, roomDto, tabDto } from "./serializers.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, "../../dist");

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

interface CreateOrderItemInput {
  menuItemId?: string;
  name: string;
  quantity: number;
  price: number | string;
  observations?: string;
}

async function resolveRoom(identifier: string) {
  const direct = await prisma.room.findUnique({ where: { id: identifier } });
  if (direct) return direct;

  const rooms = await prisma.room.findMany();
  return rooms.find((room) => slugify(room.name) === identifier) ?? null;
}

app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");

    if (email !== env.adminEmail || password !== env.adminPassword) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: email
      },
      create: {
        email,
        name: email
      }
    });

    const token = signToken(user);
    res.json({
      token,
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/rooms", async (_req, res, next) => {
  try {
    const rooms = await prisma.room.findMany({ orderBy: [{ floor: "asc" }, { name: "asc" }] });
    res.json(rooms.map(roomDto));
  } catch (error) {
    next(error);
  }
});

app.get("/rooms/:roomId", async (req, res, next) => {
  try {
    const room = await resolveRoom(routeParam(req.params.roomId));
    if (!room) {
      res.status(404).json({ error: "room_not_found" });
      return;
    }

    res.json(roomDto(room));
  } catch (error) {
    next(error);
  }
});

app.post("/rooms", requireAuth, async (req, res, next) => {
  try {
    const room = await prisma.room.create({
      data: {
        name: String(req.body.name),
        floor: Number(req.body.floor),
        capacity: Number(req.body.capacity),
        hourlyRate: new Prisma.Decimal(req.body.hourlyRate),
        active: Boolean(req.body.active ?? true)
      }
    });
    res.status(201).json(roomDto(room));
  } catch (error) {
    next(error);
  }
});

app.put("/rooms/:id", requireAuth, async (req, res, next) => {
  try {
    const room = await prisma.room.update({
      where: { id: routeParam(req.params.id) },
      data: {
        name: req.body.name,
        floor: req.body.floor === undefined ? undefined : Number(req.body.floor),
        capacity: req.body.capacity === undefined ? undefined : Number(req.body.capacity),
        hourlyRate: req.body.hourlyRate === undefined ? undefined : new Prisma.Decimal(req.body.hourlyRate),
        active: req.body.active
      }
    });
    res.json(roomDto(room));
  } catch (error) {
    next(error);
  }
});

app.delete("/rooms/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.room.delete({ where: { id: routeParam(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/categories", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { order: "asc" } });
    res.json(categories.map(categoryDto));
  } catch (error) {
    next(error);
  }
});

app.post("/categories", requireAuth, async (req, res, next) => {
  try {
    const count = await prisma.category.count();
    const category = await prisma.category.create({
      data: {
        name: String(req.body.name),
        description: String(req.body.description ?? ""),
        order: Number(req.body.order ?? count + 1)
      }
    });
    res.status(201).json(categoryDto(category));
  } catch (error) {
    next(error);
  }
});

app.put("/categories/:id", requireAuth, async (req, res, next) => {
  try {
    const category = await prisma.category.update({
      where: { id: routeParam(req.params.id) },
      data: {
        name: req.body.name,
        description: req.body.description,
        order: req.body.order === undefined ? undefined : Number(req.body.order)
      }
    });
    res.json(categoryDto(category));
  } catch (error) {
    next(error);
  }
});

app.delete("/categories/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.category.delete({ where: { id: routeParam(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/menu-items", async (_req, res, next) => {
  try {
    const items = await prisma.menuItem.findMany({
      include: { category: true },
      orderBy: [{ category: { order: "asc" } }, { name: "asc" }]
    });
    res.json(items.map(menuItemDto));
  } catch (error) {
    next(error);
  }
});

app.post("/menu-items", requireAuth, async (req, res, next) => {
  try {
    const item = await prisma.menuItem.create({
      data: {
        categoryId: String(req.body.categoryId),
        name: String(req.body.name),
        description: String(req.body.description ?? ""),
        price: new Prisma.Decimal(req.body.price),
        available: Boolean(req.body.available ?? true),
        image: req.body.image
      },
      include: { category: true }
    });
    res.status(201).json(menuItemDto(item));
  } catch (error) {
    next(error);
  }
});

app.put("/menu-items/:id", requireAuth, async (req, res, next) => {
  try {
    const item = await prisma.menuItem.update({
      where: { id: routeParam(req.params.id) },
      data: {
        categoryId: req.body.categoryId,
        name: req.body.name,
        description: req.body.description,
        price: req.body.price === undefined ? undefined : new Prisma.Decimal(req.body.price),
        available: req.body.available,
        image: req.body.image
      },
      include: { category: true }
    });
    res.json(menuItemDto(item));
  } catch (error) {
    next(error);
  }
});

app.delete("/menu-items/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.menuItem.delete({ where: { id: routeParam(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/rooms/:roomId/tabs", async (req, res, next) => {
  try {
    const room = await resolveRoom(routeParam(req.params.roomId));
    if (!room) {
      res.status(404).json({ error: "room_not_found" });
      return;
    }

    const tabs = await prisma.tab.findMany({
      where: { roomId: room.id, active: true },
      orderBy: { createdAt: "asc" }
    });
    res.json(tabs.map(tabDto));
  } catch (error) {
    next(error);
  }
});

app.post("/rooms/:roomId/tabs", async (req, res, next) => {
  try {
    const room = await resolveRoom(routeParam(req.params.roomId));
    if (!room) {
      res.status(404).json({ error: "room_not_found" });
      return;
    }

    const tab = await prisma.tab.create({
      data: {
        roomId: room.id,
        tabName: String(req.body.tabName),
        personName: String(req.body.personName)
      }
    });
    res.status(201).json(tabDto(tab));
  } catch (error) {
    next(error);
  }
});

app.patch("/tabs/:id", requireAuth, async (req, res, next) => {
  try {
    const tab = await prisma.tab.update({
      where: { id: routeParam(req.params.id) },
      data: {
        paid: req.body.paid,
        active: req.body.active,
        roomChargePaid: req.body.roomChargePaid === undefined
          ? undefined
          : new Prisma.Decimal(req.body.roomChargePaid),
        closedAt: req.body.active === false ? new Date() : undefined
      }
    });
    res.json(tabDto(tab));
  } catch (error) {
    next(error);
  }
});

app.get("/rooms/:roomId/summary", async (req, res, next) => {
  try {
    const room = await resolveRoom(routeParam(req.params.roomId));
    if (!room) {
      res.status(404).json({ error: "room_not_found" });
      return;
    }

    const tabs = await prisma.tab.findMany({
      where: { roomId: room.id, active: true },
      include: {
        orders: {
          include: { items: true },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    res.json({
      room: roomDto(room),
      tabs: tabs.map((tab) => {
        const itemsMap = new Map<string, { name: string; quantity: number; price: number }>();
        let totalValue = 0;

        for (const order of tab.orders) {
          if (order.status === "cancelled") continue;
          totalValue += Number(order.total);
          for (const item of order.items) {
            const key = item.name;
            const existing = itemsMap.get(key);
            if (existing) {
              existing.quantity += item.quantity;
            } else {
              itemsMap.set(key, {
                name: item.name,
                quantity: item.quantity,
                price: Number(item.price)
              });
            }
          }
        }

        return {
          id: tab.id,
          tabName: tab.tabName,
          personName: tab.personName,
          totalValue,
          paid: tab.paid,
          roomChargePaid: Number(tab.roomChargePaid),
          items: Array.from(itemsMap.values())
        };
      })
    });
  } catch (error) {
    next(error);
  }
});

app.get("/orders", requireAuth, async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      include: { room: true, tab: true, items: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(orders.map(orderDto));
  } catch (error) {
    next(error);
  }
});

app.post("/orders", async (req, res, next) => {
  try {
    const room = await resolveRoom(String(req.body.roomId));
    if (!room) {
      res.status(404).json({ error: "room_not_found" });
      return;
    }

    const items: CreateOrderItemInput[] = Array.isArray(req.body.items) ? req.body.items : [];
    const total = items.reduce(
      (sum: number, item: CreateOrderItemInput) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    const order = await prisma.order.create({
      data: {
        roomId: room.id,
        tabId: String(req.body.tabId),
        total: new Prisma.Decimal(total),
        items: {
          create: items.map((item: CreateOrderItemInput) => ({
            menuItemId: item.menuItemId,
            name: String(item.name),
            quantity: Number(item.quantity),
            price: new Prisma.Decimal(item.price),
            observations: item.observations
          }))
        }
      },
      include: { room: true, tab: true, items: true }
    });

    res.status(201).json(orderDto(order));
  } catch (error) {
    next(error);
  }
});

app.patch("/orders/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await prisma.order.update({
      where: { id: routeParam(req.params.id) },
      data: {
        status: req.body.status as OrderStatus | undefined,
        viewed: req.body.viewed
      },
      include: { room: true, tab: true, items: true }
    });
    res.json(orderDto(order));
  } catch (error) {
    next(error);
  }
});

app.put("/orders/:id/items", requireAuth, async (req, res, next) => {
  try {
    const orderId = routeParam(req.params.id);
    const items: CreateOrderItemInput[] = Array.isArray(req.body.items) ? req.body.items : [];
    const total = items.reduce(
      (sum: number, item: CreateOrderItemInput) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    const order = await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId } });
      return tx.order.update({
        where: { id: orderId },
        data: {
          total: new Prisma.Decimal(total),
          items: {
            create: items.map((item: CreateOrderItemInput) => ({
              menuItemId: item.menuItemId,
              name: String(item.name),
              quantity: Number(item.quantity),
              price: new Prisma.Decimal(item.price),
              observations: item.observations
            }))
          }
        },
        include: { room: true, tab: true, items: true }
      });
    });

    res.json(orderDto(order));
  } catch (error) {
    next(error);
  }
});

app.delete("/orders/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.order.delete({ where: { id: routeParam(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use(express.static(clientDistPath));

app.get(/^(?!\/(?:auth|rooms|categories|menu-items|orders|tabs|health)(?:\/|$)).*/, (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "internal_server_error" });
});

app.listen(env.port, () => {
  console.log(`API listening on port ${env.port}`);
});
