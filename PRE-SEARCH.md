# CollabBoard Pre-Search Document

**Project:** Real-Time Collaborative Whiteboard with AI Agent
**Date:** February 16, 2026
**Developer:** Solo, AI-first development workflow
**Sprint:** 7 days (MVP in 24 hours, full features by day 4, polish by day 7)

---

## Stack Summary

| Layer | Decision | Rationale |
|-------|----------|-----------|
| **Frontend** | Next.js 15 (App Router) + TypeScript + Tailwind CSS | Familiar, fast DX, excellent AI code generation support |
| **Canvas** | react-konva (Konva.js) | Best React integration, built-in transforms, proven for whiteboards |
| **Backend/Hosting** | Railway (~$10/month) | Native WebSocket support, no cold starts, all-in-one platform |
| **Database** | Supabase PostgreSQL + Realtime | 6ms median latency, SQL flexibility, integrated auth |
| **Auth** | Supabase Auth (email/password + Google OAuth) | 50K free MAUs, RLS integration, server-side first |
| **Real-Time Sync** | Supabase Realtime (objects) + Presence API (cursors) | Built-in, no custom WebSocket server needed for MVP |
| **Conflict Resolution** | Last-Write-Wins with optimistic UI | Spec-compliant, simple, fits MVP scope |
| **AI Integration** | Anthropic Claude Sonnet 4.5 with function calling + prompt caching | Best speed/cost ratio, <2s response time |
| **Testing** | Vitest (unit) + Playwright (E2E) | 10-20x faster than Jest, multi-browser collaboration testing |
| **Package Manager** | pnpm | Faster than npm, disk-efficient |

**Estimated Monthly Cost:** $10-20 (Railway $10 + Claude API ~$5-10)

---

## Architecture Overview

```
+-----------------------------------------------------------+
|                        CLIENTS                            |
|   [Browser 1]     [Browser 2]     [Browser N]            |
|   react-konva     react-konva     react-konva             |
|        |               |               |                  |
|        +-------+-------+-------+-------+                  |
|                |               |                          |
|          HTTPS/WSS       Supabase Realtime                |
+----------------+---------------+--------------------------+
                 |               |
+----------------+---------------+--------------------------+
|           RAILWAY              |                          |
|   +------------------------+   |                          |
|   |  Next.js App           |   |                          |
|   |  - API Routes          |   |                          |
|   |    /api/ai/*  ---------|---|--> Anthropic Claude API  |
|   |    /api/boards/*       |   |                          |
|   |  - SSR Pages           |   |                          |
|   +------------------------+   |                          |
+--------------------------------+--------------------------+
                                 |
+--------------------------------+--------------------------+
|           SUPABASE             |                          |
|   +----------------------------+--+                       |
|   |  PostgreSQL                   |                       |
|   |  - boards                     |                       |
|   |  - board_members              |                       |
|   |  - whiteboard_objects         |                       |
|   |  - (RLS policies)            |                       |
|   +-------------------------------+                       |
|   +-------------------------------+                       |
|   |  Realtime Engine              |                       |
|   |  - Object change streams      |  <100ms latency      |
|   |  - Presence (cursors)         |  <50ms latency       |
|   +-------------------------------+                       |
|   +-------------------------------+                       |
|   |  Auth (GoTrue)                |                       |
|   |  - Email/Password             |                       |
|   |  - Google OAuth               |                       |
|   +-------------------------------+                       |
+-----------------------------------------------------------+
```

---

## Phase 1: Define Your Constraints

### 1. Scale & Load Profile

**Decision:** Start with managed free/low-cost services; design for 5-20 concurrent users.

| Dimension | Target |
|-----------|--------|
| Users at launch | 5-20 concurrent per board |
| 6-month projection | 100-500 concurrent |
| Traffic pattern | Spiky (workshop/session-based) |
| Cursor sync latency | <50ms |
| Object sync latency | <100ms |
| Object capacity | 500+ without performance drops |
| Cold start tolerance | None (WebSockets need persistent connections) |

**Analysis:** Supabase Realtime delivers 6ms median latency and supports 32K+ concurrent connections — far exceeding our requirements. Railway provides persistent server with no cold starts. Vercel was ruled out because serverless functions cannot maintain WebSocket connections.

**Scaling path:** At 300+ users, add Redis-backed state, deploy multiple WebSocket instances, consider regional deployment.

### 2. Budget & Cost Ceiling

**Decision:** Target $10-20/month total; maximize free tiers.

| Service | Cost | Free Tier |
|---------|------|-----------|
| Railway (hosting) | ~$10/month | $5 trial credit |
| Supabase (DB + Auth + Realtime) | $0/month | 50K MAUs, 500MB storage, 2GB egress |
| Anthropic Claude API | ~$5-15/month | Pay-per-use |
| **Total** | **~$15-25/month** | |

**Tradeoffs considered:**
- **All-free option** (Supabase free + Render free): $0/month but services pause after inactivity — unsuitable for demo reliability
- **Firebase alternative**: Free tier has 600-1500ms RTT for Realtime DB — fails <100ms requirement
- **Clerk for auth**: More polished UI but $0.02/MAU after 10K vs Supabase's $0.00325 after 50K

**Cost optimization:** Use Claude prompt caching (90% savings on system message). Batch whiteboard updates to reduce DB writes.

### 3. Time to Ship

**Decision:** Speed-to-market is the priority. Use familiar tools, managed services, proven libraries.

| Milestone | Deadline | Deliverables |
|-----------|----------|-------------|
| MVP | Day 1 (24h) | Infinite canvas, sticky notes, shapes, real-time sync, cursors, auth, deployed |
| Full Features | Day 4 | Connectors, frames, transforms, AI agent (6+ commands), presence |
| Final | Day 7 | Polish, error handling, documentation, demo video |

**Velocity strategy:**
- Next.js + React + TypeScript: zero learning curve
- react-konva: built-in transform handles save 2+ days vs raw Canvas
- Supabase: auth + DB + realtime in one SDK, saves 1-2 days on infrastructure
- AI-first workflow: Claude Code primary, Cursor secondary — target 40-60% AI-generated code
- Daily iteration with clear stopping points to avoid burnout

### 4. Compliance & Regulatory Needs

**Decision:** Minimal compliance burden. Standard web security practices only.

**Not required:** HIPAA, GDPR (no EU targeting), SOC 2, PCI-DSS, penetration testing, data residency restrictions, custom encryption.

**Must-have security basics:**
- HTTPS everywhere (enforced by Railway/Supabase defaults)
- Supabase Auth with OAuth 2.0
- Row-level security on all database tables
- Server-side Anthropic API key (never exposed to client)
- Input sanitization with DOMPurify for user-generated content
- Rate limiting on AI endpoints

### 5. Team & Skill Constraints

**Decision:** Solo developer; ship speed > learning; managed > self-hosted; community support > cutting-edge.

**AI-first development workflow:**
- **Claude Code** (primary): Feature implementation, refactoring, debugging
- **Cursor** (secondary): Inline completion, boilerplate generation
- **Claude API** (product feature): AI agent with function calling

**Risk mitigations:**
- Time-box debugging at 2 hours max, then seek help
- Limit AI agent to spec-required 6 commands minimum (avoid scope creep)
- Use proven libraries with large communities (more Stack Overflow answers)
- Daily progress milestones as clear stopping points

---

## Phase 2: Architecture Discovery

### 6. Hosting & Deployment

**Decision: Railway** (~$10/month)

| Option | WebSocket Support | DX | Cost | Verdict |
|--------|------------------|----|------|---------|
| **Railway** | Native (HTTP, TCP, WS) | Excellent | ~$10/mo | **SELECTED** |
| Render | Native | Good | $7/mo+ | Runner-up |
| Vercel | No (serverless) | Best for Next.js | Free | Ruled out (no WS) |
| Firebase Hosting | Via SDK only | Good | Free | 600ms+ RTT too high |

**Rationale:** Railway provides native WebSocket support, no cold starts, built-in monitoring, one-click deploys from GitHub, and built-in PostgreSQL if needed as fallback. Vercel is the gold standard for Next.js DX but fundamentally cannot support persistent WebSocket connections.

**CI/CD:** Railway auto-deploys from GitHub on push to main. No additional CI/CD setup needed for MVP.

### 7. Authentication & Authorization

**Decision: Supabase Auth** (email/password + Google OAuth)

| Option | Free MAUs | Cost After Free | React DX | DB Integration |
|--------|-----------|----------------|----------|---------------|
| **Supabase Auth** | 50,000 | $0.00325/MAU | Custom forms | Tight (RLS) |
| Firebase Auth | 50,000 | Free (phone extra) | FirebaseUI | Firestore only |
| Clerk | 10,000 | $0.02/MAU | Drop-in components | Separate |

**Rationale:** Supabase Auth integrates directly with the database via Row-Level Security, making multi-tenancy trivial (`board_members` table filtered by `user_id`). 50K free MAUs and the lowest per-MAU pricing of any option. Server-side first approach fits Next.js App Router patterns.

**Tradeoff:** 1-2 hours building auth forms vs 30 minutes with Clerk. Worth it for database integration and lower long-term costs.

**Implementation:**
- Email/password + Google OAuth providers
- RLS policy: users can only access boards they're members of
- Supabase middleware for Next.js route protection
- Short-lived JWTs with auto-refresh

### 8. Database & Data Layer

**Decision: Supabase PostgreSQL with Realtime subscriptions**

| Option | Median Latency | Conflict Resolution | Flexibility | Vendor Lock-in |
|--------|---------------|--------------------|-----------|----|
| **Supabase Realtime** | 6ms | LWW + optimistic locking | SQL + JSONB | Low (open-source) |
| Firestore | 600-1500ms | Automatic merge | Document model | High (Google) |
| Custom WS + Postgres | Lowest possible | Custom | Maximum | None |

**Rationale:** Supabase Realtime's 6ms median latency (28ms p95) crushes the <100ms target. PostgreSQL provides SQL flexibility with JSONB columns for whiteboard object properties. Same platform as auth = single SDK, unified billing, simpler architecture.

**Schema design:**
```sql
boards (id, name, created_by, created_at)
board_members (board_id, user_id, role)
whiteboard_objects (id, board_id, object_type, properties JSONB, updated_by, updated_at, version)
```

**Conflict resolution:** Last-Write-Wins using `updated_at` timestamp with optimistic locking via `version` field. If a version mismatch occurs, the client re-fetches the latest state. Acceptable per spec.

**Cursor tracking:** Supabase Realtime Presence API (ephemeral, no DB writes needed).

**CRDTs (Yjs/Automerge):** Skipped for MVP. Last-write-wins is spec-compliant and saves 2-3 days of implementation. Can add Yjs post-MVP if conflict resolution becomes a user pain point.

### 9. Backend/API Architecture

**Decision: Hybrid Serverful — Next.js on Railway + Supabase**

| Approach | WebSocket | Cold Starts | AI Friendly | Complexity |
|----------|-----------|-------------|-------------|-----------|
| **Hybrid (Railway + Supabase)** | Full support | None | Yes | Medium |
| Full Serverless (Vercel + Supabase) | Via Supabase only | Yes | Limited | Low |
| Full Firebase | Via SDK | Yes | Limited (540s max) | Low |

**Rationale:** Single Next.js deployment on Railway handles frontend SSR, REST API routes, and can run long AI operations without time limits. Supabase handles real-time sync and persistence. This keeps the architecture simple (monolith) while meeting all performance requirements.

**API structure:**
```
/api/boards/          --> CRUD for boards (REST)
/api/boards/[id]/objects/ --> CRUD for whiteboard objects (REST)
/api/ai/command       --> AI agent endpoint (POST, proxies to Claude API)
```

**Real-time layers:**
1. Cursor positions --> Supabase Realtime Presence (<50ms, ephemeral)
2. Object updates --> Supabase Realtime subscriptions (<100ms, persistent)
3. AI responses --> Server-Sent Events for streaming output

---

## Phase 3: Post-Stack Refinement

### 10. Frontend Framework & Rendering

**Decision: React + Konva.js (react-konva)**

| Library | Performance (8K objects) | React Integration | Transform Handles | Time to MVP | AI Code Gen |
|---------|------------------------|-------------------|-------------------|-------------|-------------|
| **react-konva** | 23 FPS (optimizable) | Excellent | Built-in | 2-3 days | Excellent |
| Fabric.js | 9 FPS | Poor (imperative) | Built-in | 3-4 days | Moderate |
| PixiJS | 60 FPS | Moderate | Manual | 5+ days | Moderate |
| tldraw SDK | Excellent | Excellent | Built-in | 1-2 days | Limited |
| Raw Canvas | Variable | Manual | Manual | Infeasible | Generic |

**Rationale:** react-konva provides the best balance of React integration, built-in features, and AI code generation support. The declarative JSX syntax (`<Stage>`, `<Layer>`, `<Rect>`) is natural for React developers and AI tools. Built-in `Transformer` component provides drag/resize/rotate handles out of the box.

**Performance strategy for 500+ objects:**
1. Separate layers for background, objects, and UI overlays
2. Viewport culling (only render objects in view)
3. Shape caching with `shape.cache()` for static objects
4. Set `listening={false}` on non-interactive elements
5. Profile after 300 objects and optimize bottlenecks

**Runner-up:** tldraw SDK could deliver the fastest MVP (1-2 days) with all features built-in, but introduces vendor lock-in and has less AI training data. Consider as fallback if Konva performance is insufficient.

**SPA approach:** No SSR/SSG needed for the canvas page. Landing page can use SSR. No offline/PWA requirements.

### 11. Third-Party Integrations

**AI API — Anthropic Claude Sonnet 4.5:**

| Model | Input Cost | Output Cost | Speed | Recommendation |
|-------|-----------|-------------|-------|----------------|
| Haiku 4.5 | $1/MTok | $5/MTok | Fastest | Too limited for complex commands |
| **Sonnet 4.5** | $3/MTok | $15/MTok | Balanced | **SELECTED** — best speed/cost ratio |
| Opus 4.6 | $5/MTok | $25/MTok | Most capable | Overkill for whiteboard commands |

- **Prompt caching** on the system message with whiteboard schema saves up to 90% on input tokens
- **Rate limits:** Tier 1 (50 RPM) sufficient for single-user testing; upgrade to Tier 2 ($40 deposit, 1000 RPM) for 5+ concurrent users
- **Function calling:** No additional fee beyond standard token costs
- **Cost estimate:** ~$10-20/month for moderate usage (100 commands/day)

**Vendor lock-in mitigation:** Create a thin `AIService` abstraction. Migration to OpenAI would be 1-2 days of adapter work. Not worth over-engineering for MVP.

**Other integrations:** None needed for MVP (no payments, email, analytics).

### 12. Security Vulnerabilities

**Key risks and mitigations for our stack:**

| Risk | Mitigation |
|------|-----------|
| WebSocket hijacking | Authenticate with JWT at handshake, validate Origin header, use `wss://` only |
| XSS in sticky notes | Sanitize all user content with DOMPurify; React escapes by default |
| API key exposure | Anthropic key server-side only; proxy through `/api/ai/` route |
| CORS misconfiguration | Whitelist specific origins, never use `*` in production |
| AI endpoint abuse | Per-user rate limiting (e.g., 10 AI commands/minute), daily cost caps |
| Message injection | Validate every WebSocket message against schema; whitelist board actions |

**Content Security Policy:** Implement strict CSP disallowing inline scripts.

### 13. File Structure & Project Organization

**Decision: Single Next.js app with feature-based organization**

```
CollabBoard/
|-- src/
|   |-- app/                      # Next.js App Router
|   |   |-- (auth)/login/         # Auth pages
|   |   |-- board/[id]/page.tsx   # Main board interface
|   |   |-- api/
|   |   |   |-- ai/route.ts       # Claude API proxy
|   |   |   `-- boards/route.ts   # Board CRUD
|   |   |-- layout.tsx
|   |   `-- page.tsx              # Landing page
|   |-- features/
|   |   |-- board/                # Canvas, toolbar, shapes, hooks
|   |   |-- auth/                 # Auth components, hooks
|   |   `-- ai-agent/            # AI service, command schemas, UI
|   |-- lib/                      # Supabase client, constants
|   |-- components/ui/            # Shared UI (shadcn/ui)
|   `-- hooks/                    # Shared hooks
|-- tests/
|   |-- unit/
|   `-- e2e/
|-- .env.local / .env.example
|-- next.config.js
|-- tsconfig.json
`-- package.json
```

**Why single app over monorepo:** One-week sprint. Monorepo adds tooling overhead (Turborepo, workspace config) with no benefit for a solo developer. Single Next.js app handles frontend + API routes in one deployment.

### 14. Naming Conventions & Code Style

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `StickyNote.tsx`, `Canvas.tsx` |
| Functions/variables | camelCase | `handleDraw()`, `isConnected` |
| Types/interfaces | PascalCase | `BoardElement`, `DrawEvent` |
| Constants | UPPER_SNAKE_CASE | `MAX_BOARD_SIZE`, `WS_RECONNECT_DELAY` |
| Files (components) | PascalCase | `StickyNote.tsx` |
| Files (utilities) | camelCase | `canvas.utils.ts` |
| WebSocket events | namespace:action | `board:element:create`, `ai:command:execute` |

**Tooling:** ESLint (with `next/core-web-vitals` + `@typescript-eslint`) + Prettier (single quotes, 2-space tabs, trailing commas). Auto-format on save via VS Code settings.

### 15. Testing Strategy

**Decision: Lean testing focused on critical paths**

| Layer | Tool | Target | Priority |
|-------|------|--------|----------|
| Unit | Vitest | Board logic, AI validation, utilities | High |
| E2E | Playwright | Multi-user collaboration, auth flows | High |
| Integration | vitest-websocket-mock | Real-time sync message handling | Medium |

**Coverage target:** 40-60% on business logic; 100% on security functions (auth, sanitization).

**What to test:**
1. Real-time sync (element CRUD propagation)
2. Board state persistence (save/load cycle)
3. Authentication flows (login, protected routes)
4. AI agent command validation and execution
5. Input sanitization (XSS prevention)

**What to skip:** UI snapshots, trivial getters, third-party library internals.

**Multi-user E2E with Playwright:**
```typescript
// Two browser contexts simulate two users on the same board
const user1 = await browser.newContext();
const user2 = await browser.newContext();
// User 1 creates element --> verify User 2 sees it within 5s
```

### 16. Recommended Tooling & DX

**VS Code extensions:** ES7+ React Snippets, ESLint, Prettier, Tailwind IntelliSense, Error Lens, Import Cost, GitLens.

**CLI tools:**
```bash
npx create-next-app@latest collabboard --typescript --tailwind --app
npx supabase init
npx playwright install
```

**Debugging real-time:** Chrome DevTools Network --> WS tab for WebSocket frame inspection. Structured logging with `pino` on server.

**HMR + WebSocket:** Implement auto-reconnect logic; Socket.IO handles this automatically if used. Supabase client SDK also auto-reconnects.

---

## Key Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Konva performance at 500+ objects | High | Medium | Viewport culling, layer separation, shape caching. Fallback: tldraw SDK |
| Supabase Realtime doesn't meet <50ms for cursors | Medium | Low | Supabase Presence is built for this. Fallback: Socket.IO on Railway |
| AI agent scope creep | High | High | Hard limit at spec-required 6 commands. Feature-flag additional commands |
| Solo dev debugging time sink | Medium | High | 2-hour time-box rule, then seek help. Use proven libraries |
| Free tier limits hit mid-demo | High | Low | Monitor Supabase dashboard daily. Railway has $5 buffer |
| WebSocket auth vulnerabilities | High | Medium | JWT validation at handshake + per-message validation |

---

## Build Priority Order

Per spec guidance ("multiplayer sync is the hardest part, start here"):

1. **Cursor sync** — Two cursors moving across browsers (Day 1)
2. **Object sync** — Create sticky notes visible to all users (Day 1-2)
3. **Conflict handling** — Last-write-wins with version field (Day 2)
4. **State persistence** — Board survives refreshes and reconnects (Day 2)
5. **Board features** — Shapes, frames, connectors, transforms (Day 3-4)
6. **AI commands (basic)** — Single-step creation/manipulation (Day 4-5)
7. **AI commands (complex)** — Multi-step template generation (Day 5-6)
8. **Polish & deploy** — Error handling, UI refinement, demo prep (Day 6-7)

---

## Research Sources

This document synthesizes findings from 50+ sources across hosting, auth, database, frontend, security, and tooling research. Full source lists with URLs are available in the `/research/` directory:

- `research/phase1-constraints.md` — Scale, budget, timeline, compliance, skills
- `research/phase2a-backend.md` — Hosting, auth, database, API architecture
- `research/phase2b-frontend.md` — Canvas libraries, AI API, real-time sync
- `research/phase3-refinement.md` — Security, file structure, testing, DX

---

*Pre-Search completed: February 16, 2026*
*Methodology: AI-first research using Claude Code with specialized research agents*
