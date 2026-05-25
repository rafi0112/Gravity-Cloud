# Gravity Cloud — Private AI Cloud Frontend

A ChatGPT/Claude-style React frontend for your FastAPI + Ollama + ChromaDB RAG backend.

## Stack

- React 18 + Vite
- Tailwind CSS (glassmorphism, dark/light mode, 5 accent themes)
- Framer Motion (animations)
- Zustand (state management with localStorage persistence)
- Axios (API calls)
- React Router v6
- React Markdown + remark-gfm
- React Dropzone (PDF uploads)
- React Hot Toast (notifications)
- Lucide React (icons)

## Setup

```bash
cd frontend
npm install
npm run dev
```

> Vite dev server proxies `/api/*` → `http://localhost:8000`

The same host port is served by `gateway-lb` in Docker, which forwards to the scaled `gateway-service` replicas.

## Pages

| Route        | Description                              |
| ------------ | ---------------------------------------- |
| `/`          | Dashboard with stats & feature overview  |
| `/chat`      | AI Chat interface (ChatGPT-style)        |
| `/documents` | PDF upload & document management         |
| `/nodes`     | Service health, node metrics, queue view |
| `/settings`  | Theme (dark/light + 5 accent colors)     |

## API Integration

| Endpoint                        | Used In                |
| ------------------------------- | ---------------------- |
| `POST /ask` (text/plain)        | Chat page              |
| `POST /upload-file` (multipart) | Documents page         |
| `GET /db-status`                | Dashboard              |
| `GET /`                         | Dashboard health check |
| `POST /clear-db`                | Documents page         |

## Theme System

Themes are persisted in `localStorage` under `nc-theme`.

**Dark/Light:** toggle in header or Settings page.

**Accent colors:** Blue · Purple · Emerald · Rose · Orange — selectable in Settings.

## Folder Structure

```
frontend/src/
├── components/
│   ├── chat/         MessageBubble, ChatInput, ChatWelcome
│   ├── upload/       FileUploadZone
│   ├── layout/       Sidebar, Header
│   └── ui/           TypingDots
├── pages/            DashboardPage, ChatPage, DocumentsPage, SettingsPage
├── layouts/          AppLayout
├── context/          themeStore.js, chatStore.js, docStore.js
├── hooks/            useChat.js
├── services/         api.js
├── styles/           globals.css
└── App.jsx
```
