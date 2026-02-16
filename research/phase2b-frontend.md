# Phase 2b Research: Frontend Framework & Third-Party Integrations

Research for CollabBoard - a real-time collaborative whiteboard application with AI agent capabilities.

**Research Date:** February 16, 2026
**Researcher:** frontend-researcher

---

## Project Requirements Summary

- **Infinite canvas** with smooth pan/zoom (60 FPS target)
- **Objects:** Sticky notes with editable text, shapes (rect, circle, line), connectors, frames
- **Interactions:** Move, resize, rotate objects; single and multi-select with transform handles
- **Multiplayer:** Cursors with name labels, real-time sync
- **AI Integration:** Agent manipulates board via natural language commands (Anthropic Claude API)
- **Performance:** 500+ objects without performance drops
- **Timeline:** One-week sprint, solo developer, AI-first development workflow

---

## 10. Frontend Framework & Rendering

### Overview of Canvas Rendering Approaches

For a collaborative whiteboard, the rendering layer is the foundation. We evaluated five main approaches based on performance, ease of implementation, AI code generation support, and suitability for the project requirements.

---

### Option A: React + Konva.js (react-konva)

**Description:** Konva is a high-performance 2D canvas library built on HTML5 Canvas API with declarative React bindings via react-konva.

**Pros:**
- **Excellent React integration:** Declarative API matches React patterns (`<Stage>`, `<Layer>`, `<Rect>`, `<Circle>`)
- **Built-in transform features:** Native support for drag, resize, rotate with transform handles via `Transformer` component
- **Scene graph architecture:** Automatically manages object relationships and coordinate systems (less manual tracking)
- **Good documentation:** Comprehensive examples for pan/zoom, selection, text editing
- **Performance optimizations available:** Layer caching, `listening={false}`, shape caching, perfect drawing toggle
- **Active community:** 473k weekly npm downloads, 13.9k GitHub stars
- **AI code generation friendly:** React + popular library = strong Copilot/ChatGPT support

**Cons:**
- **Performance at scale:** Benchmark shows 23 FPS with 8k objects (vs PixiJS at 60 FPS). Users report lag with 500+ shapes without optimization
- **Requires optimization work:** Need to implement layering strategies, shape caching, disable listeners for non-interactive objects
- **HTML5 Canvas limitation:** No WebGL acceleration (purely Canvas 2D)
- **Text editing complexity:** Requires custom implementation or third-party integration (no built-in rich text)

**Code-Level Considerations:**
```javascript
// Pan/zoom implementation is straightforward
const handleWheel = (e) => {
  e.evt.preventDefault();
  const stage = e.target.getStage();
  const oldScale = stage.scaleX();
  const pointer = stage.getPointerPosition();
  const newScale = e.evt.deltaY > 0 ? oldScale * 1.1 : oldScale / 1.1;
  stage.scale({ x: newScale, y: newScale });
  // Position adjustment for zoom-to-pointer
};

// Transform handles via Transformer component
<Transformer ref={transformerRef} />
```

**Performance Optimization Required:**
- Use separate layers for interactive vs static objects
- Implement viewport culling (only render visible objects)
- Cache complex shapes
- Set `listening={false}` on background objects

**References:**
- [Performance tips for react-konva](https://konvajs.org/docs/performance/All_Performance_Tips.html)
- [Pan/zoom implementation guide](https://colinwren.is/blog/adding-zoom-and-panning-to-your-react-konva-stage/)
- [GitHub Issue: Performance with 500+ shapes](https://github.com/konvajs/react-konva/issues/491)

---

### Option B: React + Fabric.js

**Description:** Feature-rich canvas library with extensive object manipulation capabilities and built-in support for filters, animations, and serialization.

**Pros:**
- **Rich feature set:** Built-in filters, animations, gradients, patterns
- **Strong object model:** Sophisticated object manipulation, grouping, serialization
- **Collaborative whiteboard examples:** Multiple real-world implementations using Fabric.js + Socket.IO
- **Text editing:** Better built-in text support than Konva
- **Popular:** 237k weekly downloads, 30.7k GitHub stars
- **Serialization:** Easy JSON export/import for state sync

**Cons:**
- **Poorest performance:** Benchmark shows 9 FPS with 8k objects (slowest of the three)
- **Not React-native:** Imperative API doesn't match React patterns well (requires manual DOM management)
- **Heavier library:** Larger bundle size with features you may not need
- **Custom property handling:** Serialization only includes standard properties; custom properties (like IDs) need separate handling
- **Less AI-friendly:** Imperative API harder for AI code generation vs declarative React components

**Code-Level Considerations:**
```javascript
// Imperative approach (not React-like)
const canvas = new fabric.Canvas('canvas');
const rect = new fabric.Rect({
  left: 100,
  top: 100,
  fill: 'red',
  width: 50,
  height: 50
});
canvas.add(rect);

// Need to manually handle object changes for sync
canvas.on('object:modified', (e) => {
  // Emit to Socket.IO
  const obj = e.target;
  socket.emit('object:modified', obj.toJSON(['id'])); // Custom props need explicit listing
});
```

**References:**
- [Building collaborative whiteboard with Fabric.js + Next.js](https://medium.com/@adredars/building-a-real-time-collaborative-whiteboard-frontend-with-next-js-7c6b2ef1e072)
- [Fabric.js collaborative implementation guide](https://medium.com/@aydankirk92/building-a-real-time-multi-user-collaborative-whiteboard-using-fabric-js-part-i-23405823ee03)
- [Performance comparison: Fabric vs Konva vs PixiJS](https://github.com/slaylines/canvas-engines-comparison)

---

### Option C: React + PixiJS

**Description:** High-performance WebGL-powered 2D rendering library with Canvas 2D fallback.

**Pros:**
- **Best raw performance:** 60 FPS with 8k objects (WebGL acceleration)
- **Hardware acceleration:** Leverages GPU for rendering
- **Handles scale well:** Designed for games and high object counts
- **React bindings available:** `@pixi/react` provides React integration

**Cons:**
- **Lower-level API:** More boilerplate for basic shapes, transforms, interactions
- **Weak interaction model:** No built-in transform handles, selection, or drag-drop (must implement)
- **Text editing complexity:** More difficult to integrate editable text fields
- **Overkill for whiteboard:** Designed for game engines, not collaborative tools
- **Less AI code generation support:** Fewer examples, less training data for AI assistants
- **WebGL compatibility:** Older browsers may lack support (though Canvas 2D fallback exists)

**Code-Level Considerations:**
```javascript
// More verbose for simple shapes
const rect = new PIXI.Graphics();
rect.beginFill(0xFF0000);
rect.drawRect(100, 100, 50, 50);
rect.endFill();
rect.interactive = true;
rect.on('pointerdown', onDragStart);
// Must manually implement drag, resize, rotate logic
```

**Use Case:** Better for rendering-heavy applications (particles, animations) than object-manipulation whiteboards.

**References:**
- [PixiJS vs Konva performance analysis](https://aircada.com/blog/pixijs-vs-konva)
- [Performance benchmarks](https://benchmarks.slaylines.io/)

---

### Option D: React + Raw HTML5 Canvas

**Description:** Direct use of Canvas 2D API without abstraction libraries.

**Pros:**
- **Maximum control:** No library overhead or constraints
- **Lightweight:** Zero dependencies for rendering
- **Custom optimizations:** Full control over rendering pipeline

**Cons:**
- **Massive implementation burden:** Must build scene graph, hit detection, transform handles, selection, text editing, layers from scratch
- **Time prohibitive:** One-week sprint makes this infeasible
- **Reinventing the wheel:** Solving problems already solved by Konva/Fabric
- **Harder to maintain:** More custom code = more bugs, less AI assistance
- **Not recommended for MVP:** Only viable for teams with specialized needs or >6 months timeline

**Code-Level Considerations:**
- Manual transformation matrix management
- Hit detection via pixel inspection or bounding box math
- State management for all objects
- Redraw pipeline optimization
- Event delegation and propagation

**References:**
- [Creating infinite whiteboard with raw canvas](https://medium.com/@tom.humph/creating-an-infinite-whiteboard-97527e886712)
- [When to use canvas libraries](https://drabstract.medium.com/your-guide-to-when-to-use-a-javascript-canvas-library-or-framework-efb30d526797)

---

### Option E: React + SVG-Based Approach

**Description:** Using SVG elements instead of Canvas for rendering (e.g., Excalidraw's approach).

**Pros:**
- **DOM-based:** Easy event handling, accessibility, CSS styling
- **Crisp at all zoom levels:** Vector-based, no pixelation
- **Inspect/debug easily:** Elements visible in browser DevTools
- **Text editing:** Native `contentEditable` or input overlays

**Cons:**
- **Performance ceiling:** 500+ SVG DOM nodes can cause rendering bottlenecks
- **Not suitable for 60 FPS:** Slower than Canvas for high object counts
- **More memory:** Each object = DOM node with overhead
- **Limited by browser:** SVG performance varies significantly across browsers

**When to Use:** Small to medium object counts (<200 objects), accessibility requirements, or when DOM manipulation benefits outweigh performance needs.

**References:**
- [Excalidraw architecture (uses Canvas + Rough.js, not pure SVG)](https://github.com/excalidraw/excalidraw)
- [tldraw infinite canvas (SVG + Canvas hybrid)](https://tldraw.dev/)

---

### Option F: tldraw SDK (React + Custom Engine)

**Description:** tldraw is a production-ready infinite canvas SDK for React with a custom rendering engine and state management.

**Pros:**
- **Production-ready:** Battle-tested in real products
- **All features included:** Pan/zoom, selection, transform handles, text editing, multiplayer cursors
- **High performance:** Optimized for thousands of objects
- **Extensible:** Custom shapes via ShapeUtil interface
- **WebGL shaders support:** Shader starter kit for dynamic backgrounds (v4.1.0+)
- **Multiplayer built-in:** Sync engine, presence, cursor chat
- **React-first:** Declarative API with hooks

**Cons:**
- **Less control:** Opinionated architecture may limit customization
- **Learning curve:** Custom API patterns (ShapeUtil, Editor, Store)
- **Vendor lock-in:** Tightly coupled to tldraw's state model
- **Overkill for simple MVP:** May be over-engineered if you don't need all features
- **AI code generation:** Fewer examples/training data than Konva/Fabric (newer library)

**Code-Level Considerations:**
```javascript
// Custom shapes via ShapeUtil
class StickyNoteUtil extends BaseBoxShapeUtil<StickyNote> {
  static type = 'sticky-note'
  getDefaultProps() { return { w: 200, h: 200, text: '' } }
  component(shape) { return <StickyNoteComponent {...shape} /> }
  indicator(shape) { return <rect width={shape.props.w} height={shape.props.h} /> }
}

// Pass to Tldraw component
<Tldraw shapeUtils={[StickyNoteUtil]} />
```

**When to Use:** If you want a complete whiteboard foundation and are comfortable with tldraw's architecture.

**References:**
- [tldraw documentation](https://tldraw.dev/)
- [Custom shapes guide](https://tldraw.dev/examples/custom-shape)
- [Editable text shapes](https://tldraw.dev/examples/editable-shape)

---

### Comparison Matrix

| Criteria | Konva | Fabric | PixiJS | Raw Canvas | SVG | tldraw SDK |
|----------|-------|--------|--------|------------|-----|------------|
| **Performance (500+ objects)** | ⚠️ Moderate (needs optimization) | ❌ Poor | ✅ Excellent | ✅ Excellent | ❌ Poor | ✅ Excellent |
| **React Integration** | ✅ Excellent | ❌ Poor | ⚠️ Moderate | ⚠️ Manual | ✅ Good | ✅ Excellent |
| **Transform Handles** | ✅ Built-in | ✅ Built-in | ❌ Manual | ❌ Manual | ⚠️ Manual | ✅ Built-in |
| **Text Editing** | ⚠️ Requires work | ⚠️ Basic | ❌ Complex | ❌ Complex | ✅ Native | ✅ Built-in |
| **AI Code Gen Support** | ✅ Excellent | ⚠️ Good | ⚠️ Moderate | ✅ Generic | ✅ Good | ⚠️ Limited |
| **Learning Curve** | ⚠️ Moderate | ⚠️ Moderate | ⚠️ High | ❌ Very High | ✅ Low | ⚠️ High |
| **Time to MVP** | ✅ Fast (2-3 days) | ⚠️ Moderate (3-4 days) | ❌ Slow (5+ days) | ❌ Infeasible | ✅ Fast (2-3 days) | ✅ Fastest (1-2 days) |
| **Bundle Size** | ⚠️ ~150KB | ⚠️ ~200KB | ⚠️ ~150KB | ✅ 0KB | ✅ 0KB | ❌ ~500KB |
| **Community/Docs** | ✅ Excellent | ✅ Excellent | ✅ Excellent | ✅ Generic | ✅ Excellent | ⚠️ Growing |

---

### RECOMMENDATION: React + Konva.js (react-konva)

**Rationale:**

For a **one-week sprint with solo development and AI-first workflow**, React + Konva strikes the best balance:

1. **AI Code Generation:** React's popularity + Konva's well-documented API = excellent Copilot/ChatGPT support. The declarative JSX syntax is easier for AI to generate than imperative Fabric code.

2. **Time to MVP:** Built-in transform handles, layers, and scene graph save days of implementation vs PixiJS or raw Canvas.

3. **Performance is achievable:** While 500 objects without optimization may lag, implementing viewport culling + layer separation + shape caching can reach 60 FPS. The one-week timeline leaves 1-2 days for performance tuning after core features.

4. **React-first architecture:** Matches the rest of your stack (React for UI), making state management and component composition natural.

5. **Proven for whiteboards:** Used in production collaborative tools, with clear patterns for pan/zoom, selection, and multiplayer cursors.

**Performance Strategy:**
- Use separate layers for background, objects, and UI overlays
- Implement viewport culling (only render objects in view)
- Cache static shapes with `shape.cache()`
- Set `listening={false}` on non-interactive objects
- Profile after 300 objects and optimize bottlenecks

**Alternatives to Consider:**
- **If performance testing reveals Konva can't hit 60 FPS:** Migrate to PixiJS (risk: 2+ days of refactoring)
- **If you want zero risk and fastest MVP:** Use tldraw SDK (trade-off: less control, vendor lock-in)

**Implementation Plan:**
1. Day 1: Set up react-konva stage with pan/zoom
2. Day 2: Implement shapes (sticky notes, rect, circle, line) with transform handles
3. Day 3: Add text editing, selection, multi-select
4. Day 4: Integrate Yjs for real-time sync + multiplayer cursors
5. Day 5: AI agent integration (Claude API function calling)
6. Day 6: Performance optimization (viewport culling, caching)
7. Day 7: Bug fixes, polish, deployment

---

## 11. Third-Party Integrations

### AI API: Anthropic Claude with Function Calling

**Requirement:** AI agent manipulates the whiteboard via natural language commands (e.g., "Create a sticky note that says 'Meeting Notes' in the top-left corner").

---

#### Anthropic Claude API Overview

**Model Options (2026 Pricing):**

| Model | Input Cost | Output Cost | Speed | Use Case |
|-------|------------|-------------|-------|----------|
| **Claude Haiku 4.5** | $1/MTok | $5/MTok | Fastest | Real-time chat responses |
| **Claude Sonnet 4.5** | $3/MTok | $15/MTok | Balanced | Recommended for whiteboard AI |
| **Claude Opus 4.6** | $5/MTok | $25/MTok | Most capable | Complex reasoning (overkill here) |

**Function Calling Pricing:**
- Tool use requests and results are charged as standard input/output tokens
- No additional fee for function calling
- Example: A function call with 100 tokens of parameters + 200 tokens of result = 100 input tokens + 200 output tokens

**Cost Optimization Features:**
1. **Prompt Caching:** Save up to 90% on repeated prompts (e.g., system message with whiteboard schema). Cached reads cost $0.30/MTok for Sonnet 4.5.
2. **Batch API:** 50% discount for non-urgent requests (not suitable for real-time whiteboard commands).

**Recommended Model:** Claude Sonnet 4.5 with prompt caching for the whiteboard schema.

---

#### Rate Limits (2026)

**Tiered Rate Limits:**

Anthropic uses a tier system based on total spend:

| Tier | Spend Required | Requests/Min | Input Tokens/Min | Output Tokens/Min |
|------|----------------|--------------|------------------|-------------------|
| **Tier 1** | $5 | 50 | 20,000 | 8,000 |
| **Tier 2** | $40 | 1,000 | 80,000 | 40,000 |
| **Tier 3** | $200 | 2,000 | 160,000 | 80,000 |
| **Tier 4** | $400+ | 4,000+ | 320,000+ | 160,000+ |

**Important Notes:**
- Rate limits are **per organization**, not per API key
- Measured across three dimensions: RPM, input tokens/min, output tokens/min
- **Weekly rate limits** introduced in August 2025 for heavy users (enterprise agreements available for scale)

**Concurrency Considerations for CollabBoard:**
- Single user issuing AI commands: Tier 1 is sufficient (50 requests/min = <1 second response time)
- 5 concurrent users: Tier 2 recommended (1000 RPM / 5 = 200 requests/user/min)
- 10+ concurrent users: Tier 3 or enterprise agreement

**MVP Recommendation:** Start with Tier 1 ($5 deposit). Upgrade to Tier 2 ($40) if you need to support >2 concurrent users during development/testing.

---

#### Function Calling Implementation

Claude supports structured function calling for whiteboard commands. Example:

```json
{
  "name": "create_sticky_note",
  "description": "Creates a sticky note on the whiteboard",
  "input_schema": {
    "type": "object",
    "properties": {
      "text": { "type": "string", "description": "Note content" },
      "x": { "type": "number", "description": "X position (0-1000)" },
      "y": { "type": "number", "description": "Y position (0-1000)" },
      "color": { "type": "string", "enum": ["yellow", "pink", "blue"] }
    },
    "required": ["text", "x", "y"]
  }
}
```

**User Command:** "Create a sticky note that says 'Meeting Notes' in the top-left corner"

**Claude Response:**
```json
{
  "tool_use": {
    "name": "create_sticky_note",
    "input": {
      "text": "Meeting Notes",
      "x": 50,
      "y": 50,
      "color": "yellow"
    }
  }
}
```

**Your App:** Executes function, returns result to Claude, optionally gets confirmation response.

---

#### Vendor Lock-In Considerations

**Tight Coupling:**
- Claude API is Anthropic-specific (no OpenAI or Gemini compatibility)
- Function calling schemas differ between providers

**Mitigation Strategies:**
1. **Abstraction Layer:** Create an `AIService` interface with Claude implementation. Swapping to GPT-4 requires a new adapter, not a rewrite.
2. **Open Standards:** Use JSON Schema for function definitions (transferable to OpenAI, though syntax differs).
3. **Feature Parity:** Anthropic, OpenAI, and Google all support function calling (different APIs, same concept).

**Risk Assessment:** **Low-Medium**
- For MVP, vendor lock-in is acceptable (focus on shipping)
- If Claude pricing changes, migration to OpenAI is a 1-2 day effort (not weeks)
- Anthropic is a stable, venture-backed company (low risk of shutdown)

**Recommendation:** Don't over-engineer abstraction for MVP. Add an adapter pattern if you need multi-provider support later.

---

### Collaborative Features: Yjs for Real-Time Sync

**Requirement:** Multiplayer cursors, real-time object updates, conflict-free synchronization.

---

#### Yjs Overview

**What is Yjs?**
- CRDT (Conflict-free Replicated Data Type) library for real-time collaboration
- Handles conflict resolution automatically (no "last write wins" issues)
- Providers for WebSockets, WebRTC, and more
- Used by Notion, Figma, and other collaborative tools

**Key Benefits:**
1. **Offline support:** Changes buffer locally and sync when reconnected
2. **Conflict-free:** Multiple users editing simultaneously without overwrites
3. **Lightweight:** Smaller payload than OT (Operational Transformation)
4. **Proven:** Battle-tested in production apps

---

#### Yjs + Canvas Library Integration

**Konva + Yjs Example:**
A real-world implementation uses Yjs with Konva for collaborative canvas editing. The approach:

1. Store shape data in a Yjs shared type (e.g., `Y.Map` or `Y.Array`)
2. Subscribe to Yjs updates
3. Apply changes to Konva canvas
4. On local changes, update Yjs document (which syncs to peers)

**Code Pattern:**
```javascript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Shared document
const ydoc = new Y.Doc();
const yShapes = ydoc.getArray('shapes'); // Shared shape list

// WebSocket provider for sync
const provider = new WebsocketProvider('ws://localhost:1234', 'room-name', ydoc);

// Listen for remote changes
yShapes.observe(event => {
  event.changes.added.forEach(item => {
    // Add shape to Konva layer
    const shapeData = item.content.getContent()[0];
    const shape = new Konva.Rect(shapeData);
    layer.add(shape);
  });
});

// On local change (e.g., user creates shape)
const newShape = { x: 100, y: 100, width: 50, height: 50, fill: 'red' };
yShapes.push([newShape]); // Automatically syncs to all peers
```

**Multiplayer Cursors:**
Yjs Awareness API tracks ephemeral state (cursors, selections):

```javascript
const awareness = provider.awareness;

// Update local cursor position
awareness.setLocalStateField('cursor', { x: 200, y: 150, name: 'Alice' });

// Listen for peer cursors
awareness.on('change', () => {
  const states = awareness.getStates();
  states.forEach((state, clientId) => {
    if (clientId !== awareness.clientID) {
      // Render peer cursor
      renderCursor(state.cursor);
    }
  });
});
```

**References:**
- [CollabCanvas: Yjs + Konva example](https://github.com/adam0white/CollabCanvas)
- [Weave.js: Yjs-based whiteboard library](https://medium.com/@InditexTech/meet-weave-js-an-open-source-library-to-build-whiteboards-canvas-and-design-applications-0b6046f50363)

---

#### Yjs Provider Options

| Provider | Transport | Use Case | Pros | Cons |
|----------|-----------|----------|------|------|
| **y-websocket** | WebSocket | Most common | Simple, reliable | Requires WebSocket server |
| **y-webrtc** | WebRTC | Peer-to-peer | No server needed | NAT traversal issues, less reliable |
| **y-partykit** | PartyKit (serverless) | Serverless apps | Auto-scaling, low ops | Vendor lock-in (PartyKit) |
| **y-sweet** | Cloudflare Durable Objects | Edge computing | Low latency, global | Requires Cloudflare Workers |

**Recommendation for MVP:** `y-websocket` with a Node.js WebSocket server (simple, reliable, easy to deploy).

---

#### Vendor Lock-In Considerations: Real-Time Backend

**Options:**

1. **Yjs + Custom WebSocket Server**
   - Lock-in: None (open protocol)
   - Hosting: Any server (Node.js, Go, Python)
   - Scaling: Requires manual work (Redis pub/sub, sticky sessions)

2. **Liveblocks**
   - Lock-in: High (proprietary API)
   - Pros: Managed service, easy multiplayer, presence, storage
   - Cons: Expensive at scale, vendor dependency
   - Pricing: Free tier (100 MAU), $99/mo for 1000 MAU

3. **PartyKit**
   - Lock-in: Medium (Yjs-compatible, but platform-specific)
   - Pros: Serverless Yjs hosting, auto-scaling
   - Cons: Newer platform, less battle-tested
   - Pricing: Free tier, pay-per-connection

4. **Cloudflare Durable Objects + Yjs**
   - Lock-in: Medium (Yjs-compatible, Cloudflare-specific)
   - Pros: Edge computing, low latency
   - Cons: Complex setup, vendor dependency
   - Pricing: $5/mo + usage

**Recommendation:** Yjs + custom WebSocket server for MVP (no vendor lock-in, simple deployment). Migrate to PartyKit/Liveblocks if scaling becomes painful.

---

### Other Third-Party Integrations

**Not needed for MVP:**
- **Payments:** No monetization required
- **Email:** No notifications or user invites
- **Analytics:** Focus on shipping, not tracking
- **Auth:** Deferred to backend research (Phase 2a)

---

## Summary of Recommendations

### 10. Frontend Framework & Rendering
**RECOMMENDED:** React + Konva.js (react-konva)

**Rationale:**
- Best balance of AI code generation support, React integration, and time-to-MVP
- Built-in transform handles, scene graph, and event system save days of work
- Performance can reach 60 FPS with viewport culling and layer optimization
- Proven in collaborative whiteboard projects

**Runner-Up:** tldraw SDK (if you want zero risk and fastest MVP, trade-off is vendor lock-in)

---

### 11. Third-Party Integrations

#### AI API
**RECOMMENDED:** Anthropic Claude Sonnet 4.5 with Prompt Caching

**Configuration:**
- **Model:** Claude Sonnet 4.5 ($3 input / $15 output per MTok)
- **Optimization:** Prompt caching for whiteboard schema (90% savings on system message)
- **Rate Limit Tier:** Start with Tier 1 ($5), upgrade to Tier 2 ($40) for >2 concurrent users
- **Function Calling:** Define functions for create/move/delete/update operations
- **Vendor Lock-In:** Low-medium risk; migration to OpenAI is 1-2 days if needed

**Cost Estimate (MVP):**
- 100 AI commands/day * 30 days = 3000 requests
- Avg 1000 tokens/request (cached system message reduces input)
- Total: ~$10-20/month

---

#### Real-Time Collaboration
**RECOMMENDED:** Yjs with y-websocket provider

**Configuration:**
- **CRDT Library:** Yjs (battle-tested, conflict-free sync)
- **Provider:** y-websocket with Node.js server (simple, no vendor lock-in)
- **Multiplayer Cursors:** Yjs Awareness API
- **State Sync:** Y.Array for shapes, Y.Map for metadata
- **Vendor Lock-In:** None (open protocol, self-hosted)

**Deployment:**
- WebSocket server on same host as API (or separate if scaling needed)
- Use Redis pub/sub for horizontal scaling (future optimization)

---

## Key Takeaways

1. **React + Konva balances speed and capability** for a one-week sprint with AI-assisted development.

2. **Performance requires intentional optimization** (viewport culling, caching, layers), but is achievable with 500+ objects.

3. **Claude Sonnet 4.5 with function calling** provides excellent AI capabilities at reasonable cost (<$20/mo for MVP).

4. **Yjs eliminates real-time sync complexity** with built-in CRDT conflict resolution and multiplayer cursors.

5. **Avoid premature abstraction:** Don't over-engineer vendor lock-in mitigation for MVP. Ship first, refactor later if needed.

---

## References

### Performance & Benchmarks
- [Canvas engines performance comparison (PixiJS, Konva, Fabric)](https://github.com/slaylines/canvas-engines-comparison)
- [Konva performance tips](https://konvajs.org/docs/performance/All_Performance_Tips.html)
- [PixiJS vs Konva analysis](https://aircada.com/blog/pixijs-vs-konva)

### React + Konva
- [Adding zoom and panning to react-konva](https://colinwren.is/blog/adding-zoom-and-panning-to-your-react-konva-stage/)
- [Building canvas-based editors in React (Konva patterns)](https://www.alikaraki.me/blog/canvas-editors-konva)
- [Performance issue with 500+ shapes](https://github.com/konvajs/react-konva/issues/491)

### Fabric.js Collaborative Examples
- [Building collaborative whiteboard with Next.js and Fabric.js](https://medium.com/@adredars/building-a-real-time-collaborative-whiteboard-frontend-with-next-js-7c6b2ef1e072)
- [Real-time multi-user whiteboard with Fabric.js](https://medium.com/@aydankirk92/building-a-real-time-multi-user-collaborative-whiteboard-using-fabric-js-part-i-23405823ee03)

### Excalidraw & tldraw
- [Excalidraw rendering architecture](https://deepwiki.com/zsviczian/excalidraw/6.1-rendering-architecture)
- [tldraw infinite canvas SDK](https://tldraw.dev/)
- [tldraw custom shapes](https://tldraw.dev/examples/custom-shape)
- [tldraw editable shapes](https://tldraw.dev/examples/editable-shape)

### Anthropic Claude API
- [Claude API pricing 2026](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)
- [Claude API quota tiers and limits](https://www.aifreeapi.com/en/posts/claude-api-quota-tiers-limits)
- [Claude pricing explained](https://intuitionlabs.ai/articles/claude-pricing-plans-api-costs)

### Yjs & Collaboration
- [CollabCanvas: Yjs + Konva + Cloudflare Workers](https://github.com/adam0white/CollabCanvas)
- [Weave.js: Yjs-based whiteboard library](https://medium.com/@InditexTech/meet-weave-js-an-open-source-library-to-build-whiteboards-canvas-and-design-applications-0b6046f50363)

### AI Code Generation
- [GitHub Copilot vs ChatGPT vs Claude for frontend development](https://www.200oksolutions.com/blog/github-copilot-vs-chatgpt-vs-claude-frontend/)

---

**End of Phase 2b Research**
