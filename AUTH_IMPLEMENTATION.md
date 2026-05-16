# Implementação de Autenticação com Google

> Status atual: o backend foi scaffoldado em `server/` e a tela
> `/admin/login` já chama `POST /auth/google/login`. O callback
> `/admin/callback` também já existe e salva o token JWT no `localStorage`.
> Use este documento como referência de configuração no Google/Render.

## 📋 O que foi criado

O sistema já tem toda a interface pronta. Você só precisa conectar com seu backend.

### ✅ Estrutura implementada:

- **Tela de Login** (`/admin/login`) - Design completo com botão Google
- **Proteção de Rotas** - Todas as rotas `/admin/*` estão protegidas
- **Contexto de Autenticação** - Gerencia estado do usuário
- **Botão de Logout** - Em todas as páginas admin
- **Persistência** - Usa localStorage para manter sessão

## 🔧 Como implementar no seu backend (Render)

### Arquivo: `src/app/pages/AdminLogin.tsx`

Localize a função `handleGoogleLogin` (linha ~10):

```typescript
const handleGoogleLogin = async () => {
  setIsLoading(true);

  // TODO: Implementar aqui a chamada para o seu backend
  // Exemplo:
  // const response = await fetch('https://seu-backend.render.com/auth/google');
  // window.location.href = response.url;
  
  // SUBSTITUA pelo seu código:
  
  try {
    // 1. Chamar sua API no Render para iniciar OAuth
    const response = await fetch('https://seu-app.onrender.com/auth/google/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    // 2. Redirecionar para URL de autenticação do Google
    window.location.href = data.authUrl;
    
  } catch (error) {
    console.error('Erro no login:', error);
    setIsLoading(false);
  }
};
```

### Fluxo de Autenticação Sugerido:

1. **Frontend** → Clica "Continuar com Google"
2. **Backend** → Gera URL do Google OAuth
3. **Google** → Usuário faz login
4. **Backend** → Recebe callback do Google
5. **Backend** → Valida e cria sessão
6. **Backend** → Redireciona para `/admin/callback?token=...`
7. **Frontend** → Salva token e dados do usuário

### Criar página de callback

Adicione em `src/app/routes.tsx`:

```typescript
{
  path: "/admin/callback",
  Component: AdminCallback, // Criar este componente
}
```

Exemplo do componente `AdminCallback.tsx`:

```typescript
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";

export default function AdminCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    // Pegar token da URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');
    const name = params.get('name');
    const picture = params.get('picture');

    if (token && email) {
      // Salvar usuário
      login({ email, name: name || email, picture });
      
      // Redirecionar para admin
      navigate('/admin/menu');
    } else {
      // Erro - voltar para login
      navigate('/admin/login');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
```

## 🚀 Exemplo de Backend (Node.js/Express no Render)

```javascript
const express = require('express');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://seu-app.onrender.com/auth/google/callback'
);

// Iniciar login
app.post('/auth/google/login', (req, res) => {
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email']
  });
  
  res.json({ authUrl });
});

// Callback do Google
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    
    // Verificar se email tem permissão
    const allowedEmails = process.env.ALLOWED_EMAILS.split(',');
    if (!allowedEmails.includes(payload.email)) {
      return res.redirect('https://seu-app.figma.site/admin/login?error=unauthorized');
    }
    
    // Redirecionar com dados do usuário
    const params = new URLSearchParams({
      token: tokens.id_token,
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    });
    
    res.redirect(`https://seu-app.figma.site/admin/callback?${params}`);
    
  } catch (error) {
    res.redirect('https://seu-app.figma.site/admin/login?error=auth_failed');
  }
});
```

## 🔐 Variáveis de Ambiente no Render

Configure no Render:

```
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-secret
ALLOWED_EMAILS=seu-email@gmail.com,outro-email@gmail.com
```

## 📝 Obter Credenciais do Google

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um projeto
3. Vá em "APIs e Serviços" → "Credenciais"
4. Criar "ID do cliente OAuth 2.0"
5. Adicionar URLs autorizadas:
   - **Origem**: `https://seu-app.onrender.com`
   - **Redirecionamento**: `https://seu-app.onrender.com/auth/google/callback`

## ✅ Checklist

- [ ] Backend implementado no Render
- [ ] Credenciais do Google configuradas
- [ ] Variáveis de ambiente definidas
- [ ] Emails permitidos configurados
- [ ] Testar fluxo completo de login
- [ ] Testar logout
- [ ] Testar proteção de rotas

## 💡 Dicas

- Use HTTPS em produção (Render já fornece)
- Liste apenas emails autorizados
- Implemente refresh token se necessário
- Adicione logs para debug
- Considere adicionar rate limiting

---

**Qualquer dúvida, consulte:**
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Render Docs](https://render.com/docs)
