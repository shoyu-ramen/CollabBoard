# CollabBoard

A real-time collaborative whiteboard application (like Miro) with an AI-powered board agent. Built as a solo developer sprint using an AI-first development workflow.

**Deployed:** <!-- TODO: Add your Railway deployment URL here -->

![CollabBoard Screenshot](<!-- TODO: Add screenshot path or URL -->)

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript (strict) + Tailwind CSS
- **Canvas:** react-konva (Konva.js) for declarative canvas rendering
- **State:** Zustand (local UI) + Supabase Realtime (sync)
- **Database:** Supabase PostgreSQL with JSONB columns for object properties
- **Auth:** Supabase Auth (email/password + Google OAuth) with Row-Level Security
- **Real-time:** Supabase Realtime subscriptions + Presence API for live cursors
- **AI Agent:** Anthropic Claude with function calling, proxied through `/api/ai/`
- **Hosting:** Railway (persistent server, native WebSocket support)
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Package Manager:** pnpm

## Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd CollabBoard

# Install dependencies
pnpm install

# Set up environment variables (see below)
cp .env.example .env.local

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file with the following:

```env
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

- **Supabase:** Create a project at [supabase.com](https://supabase.com) and copy the URL and keys from Settings > API.
- **Anthropic:** Get an API key from [console.anthropic.com](https://console.anthropic.com).

## Architecture

### File Structure

```
src/
  app/                        # Next.js App Router
    (auth)/                   # Auth pages (login/signup)
    board/[id]/               # Main whiteboard page
    api/ai/                   # Claude API proxy endpoint
    api/boards/               # Board CRUD endpoints
  features/
    board/                    # Canvas, toolbar, shapes, hooks, types
      components/             # Canvas, Toolbar, PropertiesPanel, shapes/
      hooks/                  # useBoardObjects, useBoardRealtime, usePresence
      types.ts                # WhiteboardObject, ObjectProperties
    auth/                     # Auth components, hooks, services
    ai-agent/                 # AI service, tool schemas, tool executor, UI
      schemas/tools.ts        # Tool definitions for Claude function calling
      services/               # ai.service.ts, tool-executor.ts
  lib/                        # Supabase client, constants
  components/ui/              # Shared UI components (shadcn/ui)
```

### Data Model

| Table | Key Columns |
|---|---|
| `boards` | id, name, created_by, created_at |
| `board_members` | board_id, user_id, role (multi-tenancy via RLS) |
| `whiteboard_objects` | id, board_id, object_type, properties (JSONB), updated_by, updated_at, version |

### Real-time Sync Flow

1. Client makes an **optimistic local update** via Zustand
2. Writes to **Supabase** with timestamp + version
3. Supabase Realtime **broadcasts** to all connected clients
4. Clients merge via **Last-Write-Wins** on `updated_at`
5. Cursor positions use **Supabase Presence** (ephemeral, no DB writes)

### AI Agent

The AI agent uses Claude function calling with tool definitions for whiteboard manipulation:

- **Creation:** `createStickyNote`, `createShape`, `createFrame`, `createConnector`
- **Manipulation:** `moveObject`, `resizeObject`, `updateText`, `changeColor`
- **Query:** `getBoardState`
- **Complex:** Multi-step template generation (e.g., "create a SWOT analysis")

The AI endpoint is server-side only -- the Anthropic API key never reaches the client.

### Canvas Performance

Optimized for 500+ objects at 60 FPS:
- Separate Konva layers (background, objects, UI)
- Viewport culling with configurable padding
- `shape.cache()` for static objects
- `listening={false}` on non-interactive elements

## Observability

The AI agent emits structured JSON logs to stdout/stderr, which Railway captures natively and makes searchable. Every request is traceable end-to-end via a shared `requestId` (UUID).

### Log Events

| Event | Level | Description |
|---|---|---|
| `ai.request.start` | info | Request accepted — userId, boardId, message preview, board object count |
| `ai.request.complete` | info | Request finished — total duration, tool call count, created object count |
| `ai.request.rejected` | warn | Request rejected — reason (auth, rate limit, validation, authorization) |
| `ai.request.error` | error | Unhandled error — error message, stack trace, duration |
| `ai.claude.call` | info | Claude API call — iteration, duration, input/output tokens, stop reason, model |
| `ai.claude.error` | error | Claude API failure — iteration, duration, HTTP status code |
| `ai.tool.execute` | info | Tool executed successfully — tool name, duration, object ID |
| `ai.tool.error` | warn | Tool execution failed — tool name, error message |
| `ai.loop.complete` | info/warn | Agentic loop finished — total iterations, tool calls, token totals, whether max iterations was hit |

### Example Log Chain

A request like "Create a SWOT analysis" produces ~9 log lines:

```
ai.request.start    → userId, boardId, "Create a SWOT analysis..."
ai.claude.call      → iteration=1, 1180ms, 1450/890 tokens, stop_reason=tool_use, 5 tools
ai.tool.execute x5  → createFrame 45ms, createStickyNote 42ms, 38ms, 41ms, 39ms
ai.claude.call      → iteration=2, 1150ms, 2100/150 tokens, stop_reason=end_turn
ai.loop.complete    → 2 iterations, 5 tools, 3550/1040 tokens
ai.request.complete → 2650ms total, 5 tool calls, 5 objects created
```

All entries share the same `requestId` for correlation. Filter in Railway logs with `ai.request.start`, `ai.tool.error`, etc.

## Available Scripts

```bash
pnpm dev              # Start Next.js dev server
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm type-check       # Run TypeScript type checking
pnpm test             # Run Vitest unit tests
pnpm test:watch       # Run Vitest in watch mode
pnpm test:e2e         # Run Playwright E2E tests
```

## Deployment

This app is deployed on **Railway** for its persistent server and native WebSocket support.

1. Connect your GitHub repo to Railway
2. Set the environment variables listed above in Railway's dashboard
3. Railway auto-detects the Next.js build and deploys

The build command is `pnpm build` and the start command is `pnpm start`.
