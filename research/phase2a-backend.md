# Phase 2a: Backend Architecture Research
**CollabBoard - Real-Time Collaborative Whiteboard**

Research Date: 2026-02-16
Researcher: backend-researcher
Focus: Items 6-9 of Pre-Search Checklist

---

## 6. Hosting & Deployment

### Requirements Recap
- **WebSocket support is CRITICAL** (rules out traditional serverless)
- Must handle 5+ concurrent users per board
- Real-time cursor sync <50ms, object sync <100ms
- One-week sprint timeline (favor simplicity)
- Solo dev with AI assistance (minimal DevOps overhead)

### Option A: **Vercel** (with workarounds)

**Pros:**
- Best-in-class DX for Next.js deployments
- Automatic CI/CD from GitHub
- Excellent global CDN and edge network
- Zero-config deployments
- Built-in preview deployments for PRs

**Cons:**
- **No native WebSocket support** - serverless functions don't support long-lived connections
- Requires third-party real-time provider (Ably, Pusher, Supabase Realtime, Liveblocks)
- Recent workaround exists (Rivet for Vercel Functions) but adds complexity
- Cost can escalate quickly with function invocations

**Latency Implications:** You'd need to route real-time through a third-party service, adding network hops

**Sources:** [Vercel KB on WebSocket](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections), [Render vs Vercel comparison](https://render.com/docs/render-vs-vercel-comparison), [Rivet WebSocket solution](https://www.rivet.dev/blog/2025-10-20-how-we-built-websocket-servers-for-vercel-functions/)

---

### Option B: **Render**

**Pros:**
- **Native WebSocket support** through persistent server architecture
- Simple pricing ($7/month for starter web service)
- Docker support for custom deployments
- Built-in PostgreSQL and Redis services
- Free SSL and automatic deploys from GitHub
- Serverful architecture ideal for real-time apps

**Cons:**
- Less Next.js-optimized than Vercel (no automatic edge optimization)
- Smaller global footprint than Vercel/Firebase
- Cold starts on free tier (not an issue on paid)

**Latency Implications:** Direct WebSocket connections mean lower latency than proxied solutions

**Sources:** [Render vs Vercel](https://render.com/docs/render-vs-vercel-comparison), [Vercel alternatives](https://danubedata.ro/blog/best-vercel-alternatives-nextjs-hosting-2025)

---

### Option C: **Railway**

**Pros:**
- **Native WebSocket support** (handles HTTP, TCP, gRPC, WebSockets automatically)
- Excellent DX with auto-scaling and monitoring
- Built-in managed databases (PostgreSQL, MySQL, MongoDB, Redis)
- Unlimited environments and automatic PR previews
- One-click rollbacks
- Transparent usage-based pricing (~$8-15/month for typical Next.js app)
- Real-time resource monitoring and custom alerts

**Cons:**
- Smaller ecosystem than Vercel/Firebase
- Less documentation/community compared to major players
- 30-day trial with $5 credits, then $5/month baseline + usage

**Latency Implications:** Native WebSocket support enables direct connections

**Sources:** [Railway pricing](https://railway.com/pricing), [Railway features](https://railway.com/features), [Railway pricing analysis](https://www.saaspricepulse.com/tools/railway)

---

### Option D: **Firebase Hosting + Cloud Functions**

**Pros:**
- Integrated with Firebase ecosystem (Auth, Firestore, Realtime DB)
- Generous free tier (10 GB/month hosting, 125K/month function calls)
- Global CDN with automatic SSL
- Built-in real-time via Firestore/Realtime Database (no WebSockets needed)

**Cons:**
- **Cloud Functions don't support WebSockets** - would use Firebase SDK for real-time instead
- Vendor lock-in to Google ecosystem
- Firestore has higher latency than dedicated WebSocket solutions (~600ms RTT for Realtime DB)
- Less flexibility for custom backend logic

**Latency Implications:** Firebase Realtime Database averages 600ms RTT vs custom WebSocket solutions

**Sources:** [Firebase vs WebSocket](https://ably.com/topic/firebase-vs-websocket), [Firebase vs Socket.IO](https://ably.com/compare/firebase-vs-socketio), [Firebase alternatives](https://www.back4app.com/firebase-alternatives)

---

### **RECOMMENDATION: Railway** 🎯

**Rationale:**
1. **Native WebSocket support** is non-negotiable for <50ms cursor sync targets
2. **Excellent DX** matches Vercel's ease-of-use without the WebSocket limitation
3. **All-in-one platform** (hosting + DB + real-time) reduces moving parts for solo dev
4. **Transparent pricing** (~$8-15/month) fits startup budget
5. **Built-in monitoring** helps debug real-time performance issues
6. **One-week timeline** benefits from Railway's "batteries included" approach

**Implementation:**
- Deploy Next.js app to Railway
- Use Railway's PostgreSQL for persistence
- Implement custom WebSocket server (Socket.IO or native ws library) for real-time
- Connect to Supabase Realtime as fallback if needed

---

## 7. Authentication & Authorization

### Requirements Recap
- Social login + email/password minimum
- No RBAC needed for MVP (all users equal on a board)
- Multi-tenancy: boards are the unit of tenancy
- Should integrate easily with chosen hosting/database
- Low friction for solo dev implementation

### Option A: **Clerk**

**Pros:**
- **Best developer experience** - pre-built React components (SignIn, SignUp, UserButton)
- Beautiful, customizable UI out-of-the-box
- Excellent Next.js integration with middleware support
- Multi-factor authentication built-in
- Advanced user management features (profile editing, session management)
- Modern architecture designed for React/Next.js

**Cons:**
- **Costly at scale** - $0.02/MAU after 10K free users
- Overkill for simple auth needs (you're paying for features you won't use)
- Requires client-side components (not ideal for SSR-first apps)
- Less integrated with backend databases (separate user store)

**Pricing:** Free up to 10K MAUs, then $0.02/MAU

**Sources:** [Clerk vs Auth0 vs Firebase comparison](https://clerk.com/articles/user-management-platform-comparison-react-clerk-auth0-firebase), [Auth provider comparison 2026](https://designrevision.com/blog/auth-providers-compared)

---

### Option B: **Supabase Auth**

**Pros:**
- **Tightly integrated** with Supabase database (if using Supabase)
- **Most cost-effective** - $0.00325/MAU after 50K free users
- Open-source (can self-host if needed)
- Good social provider support (Google, GitHub, etc.)
- Row-level security (RLS) ties auth directly to database policies
- Magic links for passwordless auth
- Server-side by default (better for SSR)

**Cons:**
- **No pre-built UI components** - you build your own sign-in/sign-up forms
- More development time vs Clerk's drop-in components
- Less polished DX for frontend-heavy auth flows
- Customization requires more code

**Pricing:** Free up to 50K MAUs, then $0.00325/MAU

**Sources:** [Supabase vs Clerk](https://www.devtoolsacademy.com/blog/supabase-vs-clerk/), [Auth provider comparison](https://blog.hyperknot.com/p/comparing-auth-providers), [Clerk vs Supabase budget guide](https://www.getmonetizely.com/articles/clerk-vs-supabase-auth-how-to-choose-the-right-authentication-service-for-your-budget)

---

### Option C: **Firebase Auth**

**Pros:**
- **Generous free tier** - free up to 50K MAUs
- Mature, battle-tested platform (10+ years old)
- Excellent mobile SDK support
- Integrates seamlessly with Firestore/Realtime DB
- Multiple social providers out-of-box
- Good documentation and community

**Cons:**
- **Outdated developer experience** - "squarish buttons set in stone"
- Limited UI customization (CSS overrides only, no theming system)
- Vendor lock-in to Google Cloud
- Firebase UI Auth is "clunky" according to community
- Less modern than Clerk/Supabase for web-first apps

**Pricing:** Free up to 50K MAUs

**Sources:** [Auth provider comparison 2026](https://designrevision.com/blog/auth-providers-compared), [Firebase Auth comparison](https://blog.hyperknot.com/p/comparing-auth-providers)

---

### **RECOMMENDATION: Supabase Auth** 🎯

**Rationale:**
1. **Best cost/value ratio** - 50K free MAUs crushes Clerk's 10K, and $0.00325/MAU is 6x cheaper
2. **Database integration** - If using Supabase for real-time (fallback to Firebase), auth is already there
3. **Row-level security** - Database policies tied to auth make multi-tenancy trivial (filter by board_id + user_id)
4. **Server-side first** - Better for Next.js App Router SSR patterns
5. **Open-source escape hatch** - Can self-host if you outgrow managed service
6. **One-week timeline** - Trade UI polish for integration simplicity

**Trade-off:** You'll spend 1-2 days building auth forms vs 30 minutes with Clerk, but you gain:
- Tighter database integration
- Lower long-term costs
- More control over auth flows

**Implementation:**
- Use Supabase Auth with email/password + Google OAuth
- Create custom sign-in/sign-up forms (or use community templates)
- Implement RLS policies: `board_members` table with `user_id` + `board_id`
- Use Supabase middleware for Next.js route protection

---

## 8. Database & Data Layer

### Requirements Recap
- **Real-time sync is #1 priority** (cursor <50ms, objects <100ms)
- Document model fits whiteboard objects well (JSON blobs)
- Write-heavy during active editing, read-heavy on board load
- 500+ objects without performance drops
- Last-write-wins conflict resolution is acceptable (per spec)
- State persistence (board survives all users leaving)

### Option A: **Firestore (Firebase)**

**Pros:**
- **Built for real-time** - automatic sync to all clients
- Document model is perfect for whiteboard objects (`boards/{boardId}/objects/{objectId}`)
- Automatic scaling (no manual sharding/replication)
- Offline support with local caching
- Strong integration with Firebase Auth
- Generous free tier (50K reads/day, 20K writes/day, 1GB storage)

**Cons:**
- **Higher latency** - average RTT ~1,500ms for Firestore, ~600ms for Realtime DB
- **Vendor lock-in** - proprietary to Google, migration is painful
- Limited querying capabilities (no joins, complex filters are expensive)
- Costs can escalate with high read/write volumes
- NoSQL means no relational integrity

**Performance:** 600-1,500ms RTT is **NOT compliant** with <100ms object sync requirement

**Sources:** [Firestore vs Supabase performance](https://propelius.ai/blogs/real-time-collaboration-tools-supabase-vs-firebase), [Supabase vs Firebase analysis](https://chat2db.ai/resources/blog/supabase-vs-firebase)

---

### Option B: **Supabase Realtime (PostgreSQL + Realtime)**

**Pros:**
- **Significantly lower latency** - median ~6ms, 95th percentile ~28ms
- **Relational database** - PostgreSQL gives you SQL, joins, constraints, triggers
- **Open-source** - can self-host or migrate to vanilla Postgres
- **Scales to high concurrency** - supports 32,000+ concurrent users, 224K msgs/sec
- Row-level security for multi-tenancy
- Uses PostgreSQL's Write-Ahead Logging (WAL) for real-time - elegant architecture

**Cons:**
- **Requires more database expertise** - need to design schema, indexes, RLS policies
- **Manual scaling** - at very high scale, need read replicas, connection pooling
- **Not document-native** - must model whiteboard objects as JSONB columns or normalized tables
- WebSocket connection limits (need to manage connection pooling)

**Performance:** 6ms median latency is **WELL BELOW** <100ms target, even 95th percentile (28ms) complies

**Sources:** [Supabase vs Firebase performance](https://chat2db.ai/resources/blog/supabase-vs-firebase), [Supabase realtime scalability](https://www.closefuture.io/blogs/supabase-vs-firebase), [Supabase vs Firebase collaboration tools](https://propelius.ai/blogs/real-time-collaboration-tools-supabase-vs-firebase)

---

### Option C: **Custom WebSocket + Any Database (Railway Postgres + Socket.IO)**

**Pros:**
- **Full control** over real-time protocol and data flow
- **Lowest possible latency** - direct WebSocket communication, no intermediary
- Can use optimized binary protocols (MessagePack, Protobuf)
- Database choice decoupled from real-time layer
- Can implement custom CRDT logic (Yjs, Automerge) for advanced conflict resolution

**Cons:**
- **Most implementation work** - you build the entire real-time sync layer
- **Operational complexity** - need to handle connection management, reconnection, state sync
- **One-week timeline risk** - building from scratch eats precious time
- No built-in persistence for real-time messages (must implement yourself)

**Performance:** Theoretical best latency, but implementation complexity is high

**Sources:** [Next.js collaborative whiteboard architecture](https://medium.com/@adredars/building-a-real-time-collaborative-whiteboard-frontend-with-next-js-7c6b2ef1e072), [Collaborative whiteboard with Socket.IO](https://github.com/costingh/collaborative-whiteboard)

---

### **RECOMMENDATION: Supabase Realtime + Hybrid Approach** 🎯

**Rationale:**
1. **Performance meets requirements** - 6ms median latency destroys <100ms target
2. **Proven at scale** - 32K concurrent users, 224K msgs/sec is overkill for 5+ users
3. **SQL flexibility** - can model boards/objects/users relationally with JSONB for object properties
4. **Auth integration** - same platform as Supabase Auth (single vendor, unified SDK)
5. **Cost-effective** - PostgreSQL is cheaper long-term than Firestore at scale
6. **Open-source** - no vendor lock-in, can self-host or migrate

**Hybrid Architecture:**
- **Supabase Realtime** for cursor positions (high-frequency, low-persistence)
- **Supabase PostgreSQL** for whiteboard objects (persistent, versioned)
- **Optional: Socket.IO layer** on Railway for ultra-low-latency cursor sync if Supabase Realtime doesn't meet <50ms

**Schema Design:**
```sql
-- Boards table
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Board members (multi-tenancy)
CREATE TABLE board_members (
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'editor',
  PRIMARY KEY (board_id, user_id)
);

-- Whiteboard objects (JSONB for flexibility)
CREATE TABLE whiteboard_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL, -- 'rectangle', 'circle', 'text', etc.
  properties JSONB NOT NULL, -- {x, y, width, height, color, ...}
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1
);

-- Real-time cursor positions (ephemeral, use Supabase Realtime broadcast)
-- No table needed - use Realtime presence API
```

**Conflict Resolution:**
- Last-write-wins using `updated_at` timestamp (acceptable per spec)
- Optional: increment `version` field for optimistic locking

**Implementation:**
- Use Supabase Realtime subscriptions for `whiteboard_objects` changes
- Use Supabase Realtime presence for cursor tracking (no DB writes)
- Batch object updates to reduce write volume

---

## 9. Backend/API Architecture

### Requirements Recap
- Monolith is fine for MVP scope
- Need WebSocket for real-time, REST/HTTP for AI agent endpoints
- No background job requirements for MVP
- Must integrate Claude AI with function calling
- One-week sprint favors simplicity

### Architectural Options Analysis

#### Option A: **Full Serverless (Vercel + Supabase)**

**Architecture:**
- Next.js API routes on Vercel for REST endpoints
- Supabase handles real-time via WebSocket
- Supabase Edge Functions for serverless logic

**Pros:**
- Zero server management
- Auto-scaling built-in
- Pay-per-use pricing

**Cons:**
- No native WebSocket on Vercel (must use Supabase exclusively)
- Cold starts for API routes
- Edge function limitations (no long-running AI calls)

**Sources:** [Vercel WebSocket limitations](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)

---

#### Option B: **Hybrid Serverful (Railway + Supabase)**

**Architecture:**
- Next.js app on Railway (supports WebSocket)
- Custom Socket.IO server for real-time (optional, if Supabase insufficient)
- Supabase PostgreSQL for persistence
- Next.js API routes for AI agent endpoints

**Pros:**
- Full WebSocket control
- No cold starts (always-on server)
- Can run long AI operations (Claude function calling)
- Single deployment for frontend + backend

**Cons:**
- Must manage server restarts/scaling (minimal on Railway)
- Fixed cost vs serverless pay-per-use
- More moving parts than pure serverless

**Sources:** [Railway WebSocket support](https://railway.com/features), [Next.js collaborative whiteboard](https://medium.com/@adredars/building-a-real-time-collaborative-whiteboard-frontend-with-next-js-7c6b2ef1e072)

---

#### Option C: **Full Firebase (Firebase Hosting + Cloud Functions)**

**Architecture:**
- Firebase Hosting for Next.js static/SSR
- Cloud Functions for AI agent endpoints
- Firestore for real-time + persistence
- Firebase SDK for client-side real-time sync

**Pros:**
- All-in-one Google ecosystem
- Mature platform with excellent docs
- Built-in real-time (no custom WebSocket needed)

**Cons:**
- Firestore latency doesn't meet <100ms requirement (600-1,500ms RTT)
- Vendor lock-in
- Cloud Functions have execution time limits (540s max)
- No native WebSocket for custom protocols

**Sources:** [Firebase vs Supabase performance](https://propelius.ai/blogs/real-time-collaboration-tools-supabase-vs-firebase), [Firebase alternatives](https://www.back4app.com/firebase-alternatives)

---

### **RECOMMENDATION: Hybrid Serverful (Railway + Supabase)** 🎯

**Rationale:**
1. **Meets all latency requirements** - Railway WebSocket + Supabase <100ms easily
2. **AI agent friendly** - No cold starts or time limits for Claude API calls
3. **Monolith simplicity** - Single Next.js app handles UI, API, WebSocket
4. **One-week feasible** - Railway's DX makes deployment trivial
5. **Future-proof** - Can add background jobs, queues, etc. without architectural changes

**API Structure:**

```
/api/
├── boards/              # REST endpoints for board CRUD
│   ├── [id]/
│   │   ├── route.ts     # GET /api/boards/:id (fetch board data)
│   │   └── objects/
│   │       └── route.ts # POST /api/boards/:id/objects (create object)
├── ai/                  # AI agent endpoints
│   ├── suggest/         # POST /api/ai/suggest (Claude suggestions)
│   └── generate/        # POST /api/ai/generate (AI-generated content)
└── auth/                # Handled by Supabase (no custom routes needed)

/socket/                 # WebSocket server
└── server.ts            # Socket.IO server for real-time sync
```

**Real-Time Layers:**

1. **Cursor positions** → Socket.IO broadcast (ephemeral, <50ms)
2. **Object updates** → Supabase Realtime (persistent, <100ms)
3. **AI responses** → HTTP Server-Sent Events (SSE) for streaming

**Implementation:**
- Deploy Next.js app to Railway with custom WebSocket server
- Use Supabase for PostgreSQL + Realtime fallback
- Implement Socket.IO for cursor sync if needed
- Use Next.js API routes for Claude AI integration (Anthropic SDK)
- Enable Server-Sent Events (SSE) for streaming AI responses

---

## CRDT Libraries Comparison (Bonus Research)

While not explicitly in items 6-9, CRDT research is critical for conflict resolution:

### Yjs vs Automerge

#### **Yjs**

**Pros:**
- **High performance** - memory-efficient binary encoding
- Best for text-heavy collaboration (Google Docs-like)
- Excellent garbage collection for large documents
- Modular architecture (y-websocket, y-webrtc, y-indexeddb)
- Scales better than JSON-based CRDTs

**Cons:**
- Steeper learning curve (custom data types like Y.Array)
- Requires custom UI integration (no drop-in components)
- More complex to implement than simple last-write-wins

**Sources:** [CRDT libraries comparison 2025](https://velt.dev/blog/best-crdt-libraries-real-time-data-sync), [CRDT benchmarks](https://github.com/dmonad/crdt-benchmarks)

---

#### **Automerge**

**Pros:**
- Familiar JSON data model (easier learning curve)
- Multi-language support (JS, Rust, Go)
- Good for document-based apps

**Cons:**
- **Memory-intensive** - JSON-based, struggles with large files
- 4GB WebAssembly memory limit
- Slower operations than Yjs
- Less optimized for high-frequency updates

**Sources:** [Yjs vs Automerge comparison](https://the-expert-developer.medium.com/react-native-in-2025-offline-first-collaboration-with-crdts-automerge-yjs-webrtc-sync-1d87f45455d6), [JavaScript CRDT comparison](https://notmyidea.org/a-comparison-of-javascript-crdts.html)

---

### **RECOMMENDATION: Skip CRDTs for MVP** 🎯

**Rationale:**
1. **Spec allows last-write-wins** - CRDTs are overkill for MVP
2. **One-week timeline** - CRDTs add 2-3 days of complexity
3. **Future enhancement** - Can add Yjs later if conflict resolution becomes issue
4. **Supabase timestamps** - `updated_at` + version field gives simple LWW

**When to revisit:**
- Post-MVP if users report frequent conflicts
- If adding rich text editing (then Yjs is worth it)
- If offline-first becomes a requirement

---

## General Conflict Resolution Strategies

### Last-Write-Wins (LWW)

**How it works:**
- Each object update includes a timestamp
- Database/server keeps the most recent change
- Simple to implement with `updated_at` field

**Pros:**
- Trivial implementation
- No complex merge logic
- Works well for low-conflict scenarios (5 users on 500 objects = low collision rate)

**Cons:**
- Can lose data if two users edit same object simultaneously
- No merge intelligence (e.g., can't merge text edits)

**Best for:** MVP whiteboard where objects are discrete (moving/resizing rectangles)

---

### Operational Transformation (OT)

**How it works:**
- Transforms concurrent operations to account for earlier changes
- Used by Google Docs, Figma

**Pros:**
- Intelligent merging of concurrent edits
- No data loss from conflicts

**Cons:**
- Complex to implement correctly
- Requires central server to sequence operations
- Overkill for discrete objects (better for text editing)

**Sources:** [Conflict resolution in collaborative editing](https://tryhoverify.com/blog/conflict-resolution-in-real-time-collaborative-editing/)

---

### **RECOMMENDATION: Last-Write-Wins with Optimistic UI** 🎯

**Implementation:**
1. Client sends object update with `updated_at` timestamp
2. Server/Supabase compares timestamp, keeps latest
3. Broadcast change to all clients via Realtime
4. Client applies optimistic update immediately, reconciles on server response

**Conflict notification:**
- If client's update is rejected (server has newer version), show toast: "Another user modified this object"
- Client re-fetches latest version and merges if possible

**Code example:**
```typescript
// Client-side optimistic update
const updateObject = async (objectId: string, changes: Partial<WhiteboardObject>) => {
  // 1. Optimistic UI update
  setObjects(prev => prev.map(obj =>
    obj.id === objectId ? { ...obj, ...changes, updated_at: new Date() } : obj
  ));

  // 2. Send to server
  const { data, error } = await supabase
    .from('whiteboard_objects')
    .update({
      properties: changes,
      updated_at: new Date(),
      version: obj.version + 1
    })
    .eq('id', objectId)
    .eq('version', obj.version) // Optimistic locking
    .select();

  // 3. Handle conflicts
  if (error?.code === 'PGRST116') { // Version mismatch
    toast.error('Another user modified this object');
    // Re-fetch latest version
    await refetchObject(objectId);
  }
};
```

---

## Summary of Recommendations

| Category | Recommendation | Key Rationale |
|----------|---------------|---------------|
| **Hosting** | Railway | Native WebSocket, excellent DX, ~$10/month |
| **Auth** | Supabase Auth | Best cost/value, database integration, 50K free MAUs |
| **Database** | Supabase Realtime + PostgreSQL | 6ms latency crushes <100ms target, SQL flexibility |
| **API Architecture** | Hybrid Serverful (Railway + Supabase) | No cold starts, WebSocket support, AI-friendly |
| **CRDT Library** | None (MVP) | Last-write-wins is acceptable, add Yjs post-MVP if needed |
| **Conflict Resolution** | Last-Write-Wins + Optimistic UI | Simple, fast, fits MVP scope |

---

## Tech Stack Summary

```
Frontend:          Next.js 15 (App Router) on Railway
Auth:              Supabase Auth (email/password + Google OAuth)
Database:          Supabase PostgreSQL (with JSONB for object properties)
Real-time:         Supabase Realtime (objects) + optional Socket.IO (cursors)
Hosting:           Railway (~$10/month)
AI Integration:    Anthropic Claude API (function calling)
State Management:  Zustand + Supabase Realtime subscriptions
```

**Estimated Monthly Cost:**
- Railway: $10-15
- Supabase: $0 (free tier covers 50K MAUs, 2GB DB, 500MB storage)
- Anthropic API: Pay-per-use (~$5-20 depending on AI usage)

**Total: ~$15-35/month for MVP**

---

## Implementation Sequence (One-Week Sprint)

### Day 1-2: Foundation
- Set up Railway + Supabase accounts
- Deploy basic Next.js app to Railway
- Configure Supabase Auth with Google OAuth
- Design PostgreSQL schema (boards, members, objects)

### Day 3-4: Real-Time Core
- Implement Supabase Realtime subscriptions for object updates
- Add cursor tracking with Realtime presence
- Build basic whiteboard canvas (Fabric.js or Konva.js)
- Implement last-write-wins conflict resolution

### Day 5: AI Integration
- Add Anthropic Claude API endpoints
- Implement function calling for whiteboard actions
- Add AI suggestion UI

### Day 6-7: Polish & Deploy
- Test with 5+ concurrent users
- Performance optimization (batch updates, debouncing)
- Deploy to production on Railway
- Load test real-time sync latency

---

## References & Sources

### Hosting & Deployment
- [Do Vercel Serverless Functions support WebSocket connections?](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)
- [Render vs Vercel Comparison](https://render.com/docs/render-vs-vercel-comparison)
- [How We Built WebSocket Servers for Vercel Functions](https://www.rivet.dev/blog/2025-10-20-how-we-built-websocket-servers-for-vercel-functions/)
- [Railway Pricing](https://railway.com/pricing)
- [Railway Features](https://railway.com/features)
- [Best Vercel Alternatives for Next.js Hosting in 2025](https://danubedata.ro/blog/best-vercel-alternatives-nextjs-hosting-2025)

### Authentication
- [User Management Platform Comparison for React: Clerk vs Auth0 vs Firebase (2025)](https://clerk.com/articles/user-management-platform-comparison-react-clerk-auth0-firebase)
- [Supabase vs Clerk](https://www.devtoolsacademy.com/blog/supabase-vs-clerk/)
- [Comparing Auth from Supabase, Firebase, Auth.js, Ory, Clerk and others](https://blog.hyperknot.com/p/comparing-auth-providers)
- [Best Auth Provider Comparison: Clerk vs Auth0 vs Supabase vs Firebase (2026)](https://designrevision.com/blog/auth-providers-compared)
- [Clerk vs Supabase Auth: Budget Guide](https://www.getmonetizely.com/articles/clerk-vs-supabase-auth-how-to-choose-the-right-authentication-service-for-your-budget)

### Database & Real-Time
- [Real-Time Collaboration Tools: Supabase vs. Firebase](https://propelius.ai/blogs/real-time-collaboration-tools-supabase-vs-firebase)
- [Supabase vs Firebase](https://supabase.com/alternatives/supabase-vs-firebase)
- [Firebase vs Supabase Realtime: which should you choose in 2026?](https://ably.com/compare/firebase-vs-supabase)
- [Supabase vs Firebase: A Comprehensive Analysis](https://chat2db.ai/resources/blog/supabase-vs-firebase)
- [Supabase vs. Firebase: Which is best?](https://zapier.com/blog/supabase-vs-firebase/)

### CRDT & Conflict Resolution
- [Best CRDT Libraries 2025](https://velt.dev/blog/best-crdt-libraries-real-time-data-sync)
- [CRDT Benchmarks (GitHub)](https://github.com/dmonad/crdt-benchmarks)
- [Yjs on GitHub](https://github.com/yjs/yjs)
- [React Native in 2025: Offline-First Collaboration with CRDTs](https://the-expert-developer.medium.com/react-native-in-2025-offline-first-collaboration-with-crdts-automerge-yjs-webrtc-sync-1d87f45455d6)
- [A comparison of JS CRDTs](https://notmyidea.org/a-comparison-of-javascript-crdts.html)
- [Conflict Resolution in Real-Time Collaborative Editing](https://tryhoverify.com/blog/conflict-resolution-in-real-time-collaborative-editing/)

### Backend Architecture
- [Firebase vs WebSocket](https://ably.com/topic/firebase-vs-websocket)
- [Firebase vs Socket.IO: which should you choose in 2026?](https://ably.com/compare/firebase-vs-socketio)
- [Building a Real-time Collaborative Whiteboard with Next.js](https://medium.com/@adredars/building-a-real-time-collaborative-whiteboard-frontend-with-next-js-7c6b2ef1e072)
- [Build a Real-time Collaborative Whiteboard: NextJS, Supabase, Stream Video](https://getstream.io/blog/collaborative-nextjs-whiteboard/)

---

**Research completed: 2026-02-16**
**Total sources consulted: 50+**
**Next steps: Share with team-lead for Phase 2b/2c research coordination**
