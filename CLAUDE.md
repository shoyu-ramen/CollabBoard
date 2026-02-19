# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CollabBoard is a real-time collaborative whiteboard application (like Miro) with an AI board agent. Solo developer, 7-day sprint, AI-first development workflow. The project spec is in `G4 Week 1 - CollabBoard.pdf` and architectural decisions are documented in `PRE-SEARCH.md` and `research/`.

## General Behavior

- Start producing output quickly. When asked for a plan or implementation, deliver a first draft within the first few messages rather than extensively exploring the codebase. Exploration can continue in parallel or after initial output.
- After making changes, always run `pnpm build` and `pnpm lint` before considering a task complete. If there are E2E tests relevant to the change, verify they pass locally before pushing to CI.
- When fixing bugs, verify the fix doesn't introduce regressions. Test the specific interaction flow described, not just that the code compiles. Think through adjacent states (selection, dragging, editing, hover, resize, rotate) and check those code paths too.

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript (strict) + Tailwind CSS
- **Canvas:** react-konva (Konva.js) — declarative `<Stage>`, `<Layer>`, `<Rect>` JSX
- **State:** Zustand (local UI) + Supabase Realtime (sync)
- **Database:** Supabase PostgreSQL with JSONB columns for whiteboard object properties
- **Auth:** Supabase Auth (email/password + Google OAuth) with Row-Level Security
- **Real-time:** Supabase Realtime subscriptions (objects, <100ms) + Presence API (cursors, <50ms)
- **AI:** Anthropic Claude Sonnet 4.5 with function calling, proxied through `/api/ai/` route
- **Hosting:** Railway (persistent server, native WebSocket support)
- **Testing:** Vitest (unit) + Playwright (E2E) + vitest-websocket-mock
- **Package manager:** pnpm

## Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Next.js dev server
pnpm build                # Production build
pnpm lint                 # ESLint
pnpm type-check           # TypeScript checking
pnpm test                 # Vitest unit tests
pnpm test:watch           # Vitest watch mode
pnpm test -- path/to/file # Run a single test file
pnpm test:e2e             # Playwright E2E tests
```

## Architecture

### File Organization (feature-based)

```
src/
  app/                    # Next.js App Router pages + API routes
    (auth)/               # Auth pages (login/signup)
    board/[id]/           # Main whiteboard page
    api/ai/               # Claude API proxy endpoint
    api/boards/           # Board CRUD endpoints
  features/
    board/                # Canvas, toolbar, shapes, hooks, types
    auth/                 # Auth components, hooks, services
    ai-agent/             # AI service, command schemas, UI
  lib/                    # Supabase client, WebSocket client, constants
  components/ui/          # Shared UI (shadcn/ui)
  hooks/                  # Shared hooks
```

### Data Model

- `boards` (id, name, created_by, created_at)
- `board_members` (board_id, user_id, role) — multi-tenancy via RLS
- `whiteboard_objects` (id, board_id, object_type, properties JSONB, updated_by, updated_at, version)

### Real-time Sync Flow

Client makes optimistic local update → writes to Supabase with timestamp + version → Supabase Realtime broadcasts to all connected clients → clients merge via Last-Write-Wins on `updated_at`. Cursor positions use Supabase Presence (ephemeral, no DB writes).

### AI Agent

The AI agent uses Claude function calling with tool definitions for whiteboard manipulation. Minimum tool schema: `createStickyNote`, `createShape`, `createFrame`, `createConnector`, `moveObject`, `resizeObject`, `updateText`, `changeColor`, `getBoardState`. Must support 6+ distinct command types across creation, manipulation, layout, and complex (template generation) categories. AI endpoint is server-side only — the Anthropic API key never reaches the client.

### Database

Always run database migrations before testing code that references new columns or schema changes. Never write application code that queries columns that don't exist yet.

### Architecture Principles

- Prefer targeted, scalable solutions over broad ones. Never broadcast state changes to all connected clients when only specific clients need updates.
- Never fetch all records and filter client-side as a workaround for permissions — this is a security anti-pattern. Use RLS and server-side filtering.

### Konva-Specific Notes

- Rotation pivot is at the **top-left corner** of the node, NOT the center. Always account for this in hit-testing, bounding box calculations, and transform decomposition.
- When calculating positions of rotated objects, use full affine transform math (cos/sin with offset from rotation point).

### Canvas Performance Strategy

For 500+ objects at 60 FPS: separate Konva layers (background, objects, UI), viewport culling, `shape.cache()` for static objects, `listening={false}` on non-interactive elements.

## Naming Conventions

- Components/Types: `PascalCase` (files and identifiers)
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Utility files: `camelCase` (e.g., `canvas.utils.ts`)
- WebSocket events: `namespace:action` (e.g., `board:element:create`)

## UI/UX Conventions

- When implementing keyboard shortcuts, check for conflicts with: (1) Text input fields — avoid `/` and common typing characters, (2) OS-level shortcuts — `Cmd+Space` on Mac is Spotlight, `Ctrl+Space` on Windows is IME, (3) Existing app shortcuts listed in `Toolbar.tsx`. Use OS-aware modifier keys (`Cmd` on Mac, `Ctrl` on Windows).
- For mobile/responsive features: always scope mobile-only UI to mobile breakpoints from the start. Use Tailwind responsive classes (e.g., `md:hidden`, `block md:hidden`) to ensure mobile-specific elements don't appear on desktop.
- Font size controls should always be sliders (not dropdowns, inputs, or steppers).

## Code Style

ESLint with `next/core-web-vitals` + `@typescript-eslint`. Prettier: single quotes, 2-space indent, trailing commas, 80 char width. Sanitize all user-generated content with DOMPurify (sticky note text, AI-generated content).

## Build Priority

Multiplayer sync is the hardest part — build and verify it first. Build vertically: finish one layer before the next. Test with multiple browser windows continuously.

1. Cursor sync (two cursors moving across browsers)
2. Object sync (create sticky notes visible to all users)
3. Conflict handling (LWW with version field)
4. State persistence (board survives refresh/reconnect)
5. Board features (shapes, frames, connectors, transforms)
6. AI commands basic (single-step creation/manipulation)
7. AI commands complex (multi-step template generation)
