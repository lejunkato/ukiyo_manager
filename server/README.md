# Backend Ukiyo

API Node/Express com Prisma e PostgreSQL para salas, cardápio, comandas, pedidos e login administrativo simples.

## Rodar localmente

1. Instale as dependências:

```bash
npm install
```

2. Crie um `.env` a partir do `.env.example` e configure `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONTEND_URL` e `BACKEND_URL`.

3. Gere o Prisma Client e rode as migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Suba a API e o frontend em terminais separados:

```bash
npm run dev:server
npm run dev
```

## Render

O arquivo `render.yaml` cria:

- um Web Service Node;
- um PostgreSQL;
- deploy das migrations antes do build;
- start da API por `npm run start`.

Configure no Render:

```env
FRONTEND_URL=https://seu-site.onrender.com
BACKEND_URL=https://seu-site.onrender.com
VITE_API_URL=https://seu-site.onrender.com
ADMIN_EMAIL=seu-email@gmail.com
ADMIN_PASSWORD=uma-senha-forte
```

## Principais endpoints

- `GET /health`
- `POST /auth/login`
- `GET /rooms`
- `POST /rooms`
- `GET /categories`
- `POST /categories`
- `GET /menu-items`
- `POST /menu-items`
- `GET /rooms/:roomId/tabs`
- `POST /rooms/:roomId/tabs`
- `GET /orders`
- `POST /orders`
- `PATCH /orders/:id`
- `DELETE /orders/:id`

Rotas administrativas de escrita usam `Authorization: Bearer <token>`.
