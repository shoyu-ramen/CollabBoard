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
    api/boards/               # Board CRUD + member management endpoints
  features/
    board/                    # Canvas, toolbar, shapes, hooks, types
      components/             # Canvas, Toolbar, PropertiesPanel, MemberManagementModal, shapes/
      hooks/                  # useBoardObjects, useBoardRealtime, usePresence
      types.ts                # WhiteboardObject, ObjectProperties, Board
    auth/                     # Auth components, hooks, services
    ai-agent/                 # AI service, tool schemas, tool executor, UI
      schemas/tools.ts        # Tool definitions for Claude function calling
      services/               # ai.service.ts, tool-executor.ts
  lib/                        # Supabase client, constants
  components/ui/              # Shared UI components (shadcn/ui)
```

### Board Visibility & Access Control

Boards support **public** and **private** visibility:

- **Public boards** are visible to all authenticated users on the dashboard and can be joined by anyone.
- **Private boards** are only visible to the board owner and explicitly invited members. Other users cannot see or access them.

Board owners can manage membership from within the board via the **Members** modal, which allows inviting users by email and removing existing members. Visibility is set at creation time in the dashboard's "New Board" dialog.

Access control is enforced at multiple layers:
- **Database (RLS):** Row-Level Security policies on `boards`, `board_members`, and `whiteboard_objects` restrict reads to public boards or boards where the user is the owner/member.
- **API (defense-in-depth):** Server-side routes additionally filter private boards the user doesn't own or belong to, guarding against RLS misconfiguration.

### Data Model

| Table | Key Columns |
|---|---|
| `boards` | id, name, created_by, created_at, visibility (`public` \| `private`) |
| `board_members` | board_id, user_id, role (multi-tenancy via RLS) |
| `whiteboard_objects` | id, board_id, object_type, properties (JSONB), updated_by, updated_at, version |

### Real-time Sync Flow

1. Client makes an **optimistic local update** via Zustand (instant, 0ms)
2. **Broadcasts** to other clients via Supabase Realtime broadcast channel (<16ms)
3. Writes to **Supabase DB** asynchronously (fire-and-forget, no UI blocking)
4. Other clients receive via broadcast first, Postgres changes as fallback
5. Clients merge via **Last-Write-Wins** on `updated_at` with version tiebreaker
6. Cursor positions use **Supabase Presence** (ephemeral, no DB writes)

#### Sync Optimizations

- **Dual-channel architecture**: Separate channels for DB changes (`board:sync`) and live interactions (`board:live`) to avoid interference
- **16ms broadcast throttle**: Cursor and object move broadcasts match 60fps refresh rate
- **Lerp-interpolated cursors**: Remote cursors animate smoothly at 60fps via `requestAnimationFrame` instead of jumping between broadcast positions
- **RAF-batched cursor updates**: Incoming cursor messages are coalesced per animation frame to prevent excessive re-renders
- **Throttled text broadcasts**: Text input broadcasts are rate-limited to 50ms to prevent keystroke flooding
- **Deep property merging**: Zustand store merges nested `properties` objects to avoid overwriting unrelated fields during partial updates
- **Batch operations**: Group drag/resize sends a single `object_move_batch` broadcast; bulk deletes use a single DB query

### AI Agent

The AI agent uses Claude function calling with tool definitions for whiteboard manipulation:

- **Creation:** `createStickyNote`, `createShape`, `createFrame`, `createConnector`
- **Manipulation:** `moveObject`, `resizeObject`, `updateText`, `changeColor`
- **Query:** `getBoardState`
- **Complex:** Multi-step template generation (e.g., "create a SWOT analysis")

The AI endpoint is server-side only -- the Anthropic API key never reaches the client.

### Canvas Performance

Optimized for 500+ objects at 60 FPS:
- Separate Konva layers (background, objects, UI, cursors)
- Viewport culling with configurable padding
- `shape.cache()` for static objects
- `listening={false}` on non-interactive elements and cursor layers
- Lerp-interpolated cursor rendering via dedicated RAF loop

### Performance Targets

All targets are validated by automated tests (unit + E2E):

| Metric | Target | Validated By |
|---|---|---|
| Frame rate | 60 FPS during pan/zoom/manipulation | `canvas-performance.spec.ts` (30 FPS CI threshold) |
| Object sync latency | <100ms client-side processing | `sync-latency.spec.ts` |
| Cursor sync latency | <16ms broadcast interval (60fps) | `sync-performance.test.ts` + `sync-latency.spec.ts` |
| Cursor rendering | 60fps lerp interpolation | `CursorOverlay` RAF loop |
| Object capacity | 500+ objects without degradation | `canvas-performance.test.ts` + `canvas-performance.spec.ts` |
| Store throughput | 500 rapid updates in <100ms | `sync-performance.test.ts` |
| LWW resolution | 10,000 checks in <10ms | `sync-performance.test.ts` |
| Concurrent users | 5+ without degradation | `concurrent-users.spec.ts` |
| AI response latency | <2s for single-step commands | `ai-latency.spec.ts` |
| AI command breadth | 6+ distinct command types | `tools-breadth.test.ts` |

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

### Test Structure

```
tests/
  unit/
    board/
      board-objects-store.test.ts     # Zustand store CRUD
      canvas-performance.test.ts      # Viewport culling & store ops at 500+ objects
      sync-performance.test.ts        # Sync throughput, throttle intervals, LWW perf, deep merge
      realtime-utils.test.ts          # Realtime sync utilities
    ai-agent/
      tools-schema.test.ts            # AI tool schema validation
      tools-breadth.test.ts           # AI tool count & category coverage
      tool-executor.test.ts           # Tool execution logic
      tool-executor-integration.test.ts
      ai-service.test.ts              # AI service unit tests
    api/
      ai-route.test.ts               # API route handler tests
      rate-limiter.test.ts            # Rate limiting
  e2e/
    helpers/
      board.helpers.ts               # Mock Supabase, canvas utilities
      performance.helpers.ts          # FPS measurement, pan/zoom simulation
    fixtures/
      ai-responses.ts                # Deterministic AI response fixtures
    performance/
      canvas-performance.spec.ts     # FPS + object capacity E2E
      sync-latency.spec.ts           # Object & cursor sync latency
      ai-latency.spec.ts             # AI command response time
      concurrent-users.spec.ts       # 5-context simultaneous usage
      rapid-operations.spec.ts       # Rapid object creation
```

To run only the performance test suite:

```bash
pnpm test -- tests/unit/board/canvas-performance.test.ts tests/unit/ai-agent/tools-breadth.test.ts
pnpm test:e2e tests/e2e/performance/
```

To run live AI latency tests (requires a valid `ANTHROPIC_API_KEY`):

```bash
LIVE_AI_TESTS=true pnpm test:e2e tests/e2e/performance/ai-latency.spec.ts
```

## Deployment

This app is deployed on **Railway** for its persistent server and native WebSocket support.

1. Connect your GitHub repo to Railway
2. Set the environment variables listed above in Railway's dashboard
3. Railway auto-detects the Next.js build and deploys

The build command is `pnpm build` and the start command is `pnpm start`.
