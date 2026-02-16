# Phase 3: Post-Stack Refinement - Security, Structure, Testing, DX

Research for CollabBoard real-time collaborative whiteboard application.

**Project Context:**
- Real-time collaborative whiteboard (like Miro)
- React + TypeScript frontend with canvas rendering
- WebSocket-based real-time sync
- AI agent integration (Anthropic Claude function calling)
- Firebase or Supabase backend
- One-week sprint, solo dev, AI-first development
- Must be deployed and publicly accessible

---

## 12. Security Vulnerabilities

### WebSocket Security

**Authentication & Authorization:**
- Authenticate during the initial WebSocket handshake using JWT or OAuth tokens
- **Critical:** Authorization checks must be applied per message or action, not just at handshake
- Use short-lived JWTs with refresh tokens to minimize impact of token compromise
- Never send credentials over WebSocket - use tokens only

**Message Validation:**
- Validate every message received over WebSocket for both structure and content
- Use JSON.parse() with try/catch and custom sanitization for all incoming data
- Implement message schema validation to prevent injection attacks

**Transport & Origin Security:**
- **Always use wss:// (WebSocket Secure)** - never ws:// in production
- Validate Origin header during handshake against an allowlist of trusted domains
- Reject requests from unverified sources to prevent CSRF attacks

**Rate Limiting & DoS Prevention:**
- Implement per-connection rate limiting (e.g., max messages per second)
- Set global rate limits across all connections
- Enforce message size limits to prevent memory exhaustion
- Disconnect clients that violate limits

**For CollabBoard:**
```typescript
// Example: WebSocket authentication on connection
const ws = new WebSocket(`wss://api.collabboard.app?token=${jwtToken}`);

// Server-side validation
interface BoardMessage {
  type: 'draw' | 'move' | 'delete' | 'ai_command';
  payload: unknown;
  timestamp: number;
}

function validateMessage(msg: unknown): msg is BoardMessage {
  // Validate schema, sanitize inputs
  // Check user permissions for the action
}
```

### XSS Prevention in User-Generated Content

**Primary Threats:**
- Text elements on the canvas (sticky notes, labels)
- AI-generated content inserted into the board
- Collaborative editing features

**Defense Strategy:**

1. **Sanitization Libraries:**
   - Use **DOMPurify** for all user-generated HTML content
   - Configure to allow only safe tags: `<b>`, `<i>`, `<em>`, `<strong>`, `<p>`
   - Strip all script tags, event handlers, and dangerous attributes

2. **Storage & Rendering:**
   - Store user input in original form in database
   - Sanitize/encode at point of output, not input
   - Never use `dangerouslySetInnerHTML` without DOMPurify sanitization

3. **Content Security Policy (CSP):**
   - Implement strict CSP that disallows inline scripts
   - Restrict script sources to trusted domains only
   - Prevents execution even if XSS payload is injected

4. **Framework Defaults:**
   - React escapes by default - leverage this
   - Only bypass with `dangerouslySetInnerHTML` when absolutely necessary
   - Always sanitize before bypassing

**For CollabBoard:**
```typescript
import DOMPurify from 'dompurify';

// Sticky note text rendering
function StickyNote({ content }: { content: string }) {
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
    ALLOWED_ATTR: []
  });

  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

### API Key Security

**Anthropic API Key Protection:**
- **NEVER expose API keys in client code** - must be server-side only
- Use environment variables with proper .gitignore
- Create a backend API route that proxies AI requests
- Implement authentication on AI endpoints

**Example Architecture:**
```
Client → Authenticated Request → Next.js API Route → Anthropic API
                                  (API key here)
```

### CORS Configuration

- Configure CORS for real-time connections carefully
- Whitelist specific origins only, never use `*` in production
- For WebSocket upgrades, validate Origin header explicitly

### Rate Limiting AI Endpoints

- Implement per-user rate limits on AI function calls
- Set daily/hourly quotas to prevent abuse and cost overruns
- Consider caching AI responses for identical requests
- Monitor usage and alert on anomalies

**Recommended Tools:**
- `express-rate-limit` or `@upstash/ratelimit` for Next.js
- Firebase App Check for abuse prevention

---

## 13. File Structure & Project Organization

### Recommended Structure for CollabBoard

**Decision: Monorepo vs Single Next.js App**

For a one-week sprint with Next.js:
- **Use single Next.js app** - simpler, faster to develop
- Leverage Next.js App Router for API routes and WebSocket handling
- Only consider monorepo if using separate backend framework (e.g., Express)

**Note:** Next.js with WebSockets requires server deployment (not Vercel). Use platforms like Railway, Render, or Fly.io.

### Feature-Based Structure (Recommended)

```
/Users/ross/gauntlet/CollabBoard/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── board/
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Main board interface
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   └── route.ts      # Anthropic API proxy
│   │   │   ├── boards/
│   │   │   │   └── route.ts      # CRUD operations
│   │   │   └── socket/
│   │   │       └── route.ts      # WebSocket handler (using next-ws)
│   │   ├── layout.tsx
│   │   └── page.tsx              # Landing page
│   │
│   ├── features/                 # Feature-based organization
│   │   ├── board/
│   │   │   ├── components/
│   │   │   │   ├── Canvas.tsx
│   │   │   │   ├── Toolbar.tsx
│   │   │   │   └── StickyNote.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useCanvas.ts
│   │   │   │   └── useRealtimeSync.ts
│   │   │   ├── types/
│   │   │   │   └── board.types.ts
│   │   │   └── utils/
│   │   │       └── canvas.utils.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── services/
│   │   │
│   │   └── ai-agent/
│   │       ├── components/
│   │       ├── services/
│   │       │   └── claudeService.ts
│   │       └── types/
│   │           └── agent.types.ts
│   │
│   ├── lib/                      # Shared utilities
│   │   ├── firebase.ts           # Firebase client setup
│   │   ├── websocket.ts          # WebSocket client
│   │   └── constants.ts
│   │
│   ├── components/               # Shared components
│   │   ├── ui/                   # shadcn/ui components
│   │   └── layout/
│   │
│   └── hooks/                    # Shared hooks
│       └── useAuth.ts
│
├── public/
│   └── assets/
│
├── .env.local                    # Environment variables
├── .env.example
├── next.config.js
├── tsconfig.json
└── package.json
```

### Key Organizational Principles

1. **Feature-Based Modules:**
   - Each feature (board, auth, ai-agent) is self-contained
   - Enhances maintainability and AI code generation
   - Easy to locate related code

2. **AI Agent Logic Location:**
   - Place in `/src/features/ai-agent/`
   - Service layer handles API communication
   - Types define function calling schemas
   - Components for AI chat interface

3. **AI-First Development Considerations:**
   - Clear feature boundaries help AI tools understand context
   - Co-located files reduce need for cross-file navigation
   - Explicit type definitions improve AI code generation

4. **WebSocket Organization:**
   - Client logic: `/src/lib/websocket.ts` and feature hooks
   - Server logic: `/src/app/api/socket/route.ts`
   - Event types: `/src/features/board/types/events.types.ts`

---

## 14. Naming Conventions & Code Style

### TypeScript Naming Conventions

**Components (PascalCase):**
```typescript
// ✅ Good
export function Canvas() {}
export const StickyNote = () => {};
export default function BoardPage() {}

// ❌ Bad
export function canvas() {}
export const sticky_note = () => {};
```

**Functions & Variables (camelCase):**
```typescript
// ✅ Good
const userId = 'abc123';
function handleDrawEvent() {}
const isConnected = true;

// ❌ Bad
const UserID = 'abc123';
function HandleDrawEvent() {}
```

**Types & Interfaces (PascalCase):**
```typescript
// ✅ Good
interface BoardElement {}
type DrawEvent = {};
enum ElementType {}

// ❌ Bad
interface boardElement {}
type draw_event = {};
```

**Constants (UPPER_SNAKE_CASE):**
```typescript
// ✅ Good
const MAX_BOARD_SIZE = 10000;
const WEBSOCKET_RECONNECT_DELAY = 3000;

// ❌ Bad
const maxBoardSize = 10000;
```

**Files:**
- Components: `Canvas.tsx`, `StickyNote.tsx` (PascalCase)
- Utilities: `canvas.utils.ts`, `validation.ts` (camelCase)
- Types: `board.types.ts`, `events.types.ts`
- Hooks: `useCanvas.ts`, `useRealtimeSync.ts`

### Real-Time Event Naming

**Consistent Pattern for WebSocket Events:**
```typescript
// Use namespace:action pattern
type BoardEvent =
  | 'board:element:create'
  | 'board:element:update'
  | 'board:element:delete'
  | 'board:cursor:move'
  | 'board:user:join'
  | 'board:user:leave'
  | 'ai:command:execute'
  | 'ai:response:stream';

// ✅ Good - clear, hierarchical, consistent
const EVENT_TYPES = {
  BOARD: {
    ELEMENT_CREATE: 'board:element:create',
    ELEMENT_UPDATE: 'board:element:update',
  },
  AI: {
    COMMAND_EXECUTE: 'ai:command:execute',
  }
} as const;
```

### Board Object Type Naming

```typescript
// Base types
interface Point {
  x: number;
  y: number;
}

interface BoardElement {
  id: string;
  type: ElementType;
  position: Point;
  createdBy: string;
  createdAt: number;
}

// Specific element types
interface StickyNoteElement extends BoardElement {
  type: 'sticky_note';
  content: string;
  color: string;
}

interface DrawingElement extends BoardElement {
  type: 'drawing';
  path: Point[];
  strokeColor: string;
  strokeWidth: number;
}

// Use discriminated unions
type Element = StickyNoteElement | DrawingElement | TextElement;
```

### ESLint + Prettier Configuration

**Install Dependencies:**
```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier eslint-config-prettier eslint-plugin-prettier
npm install -D eslint-plugin-react eslint-plugin-react-hooks
```

**Recommended .eslintrc.json (Flat Config for ESLint v9+):**
```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2025,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "plugins": ["@typescript-eslint", "react", "react-hooks", "prettier"],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "prettier/prettier": "error"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

**Recommended .prettierrc:**
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "useTabs": false,
  "trailingComma": "es5",
  "printWidth": 80,
  "arrowParens": "always"
}
```

**VS Code Auto-Format:**
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## 15. Testing Strategy

### Unit Tests: Vitest (Recommended)

**Why Vitest over Jest for CollabBoard:**
- 10-20x faster than Jest, especially with TypeScript
- Native ESM and TypeScript support (no configuration needed)
- Perfect for Vite-based projects
- 95% Jest-compatible API
- Lower memory usage (30% less than Jest)
- Built-in watch mode with HMR-like experience

**Setup:**
```bash
npm install -D vitest @vitest/ui
npm install -D @testing-library/react @testing-library/jest-dom
```

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
```

**What to Test:**
- Board utility functions (coordinate transformations, collision detection)
- Canvas rendering logic
- Data transformations (serialize/deserialize board state)
- AI agent function calling schemas and validation
- Authentication helpers

**Example:**
```typescript
// src/features/board/utils/canvas.utils.test.ts
import { describe, it, expect } from 'vitest';
import { pointInRect, calculateDistance } from './canvas.utils';

describe('canvas utilities', () => {
  it('should detect point inside rectangle', () => {
    expect(pointInRect({ x: 5, y: 5 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(true);
  });
});
```

### Integration Testing: Real-Time Sync

**Challenge:** Testing WebSocket synchronization is inherently difficult.

**Recommended Approach:**

1. **Mock WebSocket Connections:**
   - Use `vitest-websocket-mock` for unit-level WebSocket testing
   - Test client-side message handling in isolation

2. **Local Server Testing:**
   - Spin up actual WebSocket server in test environment
   - Create multiple client connections
   - Verify state synchronization

**Example:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import WS from 'vitest-websocket-mock';

describe('real-time sync', () => {
  let mockServer: WS;

  beforeEach(() => {
    mockServer = new WS('ws://localhost:3000/socket');
  });

  it('should sync element creation across clients', async () => {
    await mockServer.connected;

    // Client 1 creates element
    mockServer.send(JSON.stringify({
      type: 'board:element:create',
      payload: { id: '1', type: 'sticky_note' }
    }));

    // Verify broadcast to other clients
    expect(mockServer).toReceiveMessage(expect.objectContaining({
      type: 'board:element:create'
    }));
  });
});
```

### E2E Testing: Playwright

**Why Playwright for CollabBoard:**
- Excellent multi-browser support (Chrome, Firefox, Safari)
- Built-in WebSocket inspection and interception
- Can simulate multiple users in different browser contexts
- Direct WebSocket communication for better performance
- Network interception for testing real-time scenarios

**Setup:**
```bash
npm install -D @playwright/test
npx playwright install
```

**Multi-User Testing:**
```typescript
// tests/e2e/collaboration.spec.ts
import { test, expect } from '@playwright/test';

test('two users can collaborate on same board', async ({ browser }) => {
  // Create two separate browser contexts (different users)
  const user1Context = await browser.newContext();
  const user2Context = await browser.newContext();

  const user1Page = await user1Context.newPage();
  const user2Page = await user2Context.newPage();

  // Both navigate to same board
  await user1Page.goto('http://localhost:3000/board/test-board');
  await user2Page.goto('http://localhost:3000/board/test-board');

  // User 1 creates sticky note
  await user1Page.click('[data-testid="add-sticky-note"]');
  await user1Page.fill('[data-testid="note-input"]', 'Hello from User 1');

  // User 2 should see the note appear
  await expect(user2Page.locator('text=Hello from User 1')).toBeVisible({
    timeout: 5000
  });

  await user1Context.close();
  await user2Context.close();
});
```

**WebSocket Inspection:**
```typescript
test('should handle WebSocket reconnection', async ({ page }) => {
  // Listen to WebSocket events
  page.on('websocket', ws => {
    ws.on('framesent', event => console.log('Sent:', event.payload));
    ws.on('framereceived', event => console.log('Received:', event.payload));
  });

  await page.goto('http://localhost:3000/board/test');

  // Simulate network interruption
  await page.route('**/*', route => route.abort());
  await page.waitForTimeout(1000);

  // Restore network
  await page.unroute('**/*');

  // Verify reconnection
  await expect(page.locator('[data-testid="connection-status"]'))
    .toHaveText('Connected');
});
```

### Coverage Target for MVP

**For One-Week Sprint:**
- **Don't aim for high coverage** - focus on critical paths
- Target: 40-60% coverage on business logic
- 100% coverage on critical security functions (auth, sanitization)

**Priority Test Coverage:**
1. Real-time sync (element create/update/delete)
2. Board state persistence
3. Authentication flows
4. AI agent command validation
5. Input sanitization

**Skip Testing:**
- UI component snapshots (too fragile for MVP)
- Trivial getters/setters
- Third-party library integrations (trust the library)

### Mocking Strategy

**Mock WebSocket Connections:**
- Use `vitest-websocket-mock` for client-side WebSocket tests
- Create mock server for integration tests

**Mock AI API Calls:**
```typescript
// src/features/ai-agent/__mocks__/claudeService.ts
import { vi } from 'vitest';

export const mockClaudeService = {
  executeCommand: vi.fn().mockResolvedValue({
    content: 'Mocked AI response',
    functionCalls: []
  })
};
```

**Mock Firebase/Supabase:**
- Use Firebase emulators for integration testing
- Mock auth state in unit tests

```typescript
// Mock Firebase auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInWithEmailAndPassword: vi.fn().mockResolvedValue({
    user: { uid: 'test-user-id' }
  })
}));
```

---

## 16. Recommended Tooling & DX

### VS Code Extensions (2025)

**Essential for React + TypeScript:**

1. **ES7+ React/Redux/React-Native Snippets**
   - Fast component creation with shortcuts
   - Supports TypeScript and React hooks
   - Example: `rafce` → React Arrow Function Component Export

2. **ESLint** + **Prettier - Code formatter**
   - Auto-format on save
   - Enforce consistent code style
   - Catch errors in real-time

3. **Tailwind CSS IntelliSense**
   - Autocomplete for Tailwind utility classes
   - Preview colors and spacing
   - Essential if using Tailwind

4. **TypeScript Error Translator**
   - Makes TypeScript errors human-readable
   - Huge time-saver for complex type errors

5. **Import Cost**
   - Shows package size when importing
   - Helps avoid bloating bundle size
   - Critical for frontend performance

6. **Error Lens**
   - Shows errors inline in editor
   - Faster debugging workflow

7. **Pretty TypeScript Errors**
   - Better formatting for TS errors
   - Makes complex types easier to understand

8. **GitLens**
   - Inline Git blame and history
   - Useful for solo dev to track changes

**AI Development Tools:**
- **Primary: Claude Code** (already using)
- **Secondary: GitHub Copilot** for inline suggestions
- **Cursor** as alternative AI-first editor

### CLI Tools

**Project Setup:**
```bash
# Next.js app creation
npx create-next-app@latest collabboard --typescript --tailwind --app

# Firebase CLI (if using Firebase)
npm install -g firebase-tools
firebase login
firebase init

# Supabase CLI (if using Supabase)
npm install -g supabase
supabase login
```

**Development Tools:**
```bash
# TypeScript type checking
npm run type-check

# Lint and format
npm run lint
npm run format

# Test
npm run test
npm run test:e2e
```

### Debugging Real-Time Apps

**Browser DevTools:**

1. **WebSocket Inspector (Chrome/Firefox):**
   - Open DevTools → Network → WS
   - Shows all WebSocket frames sent/received
   - Filter by message type
   - Inspect message payloads

2. **React DevTools:**
   - Inspect component state
   - Profile performance
   - Track re-renders

3. **Redux DevTools** (if using Redux):
   - Time-travel debugging
   - State diff visualization

**Server-Side Debugging:**
```typescript
// Add structured logging
import pino from 'pino';

const logger = pino({
  transport: { target: 'pino-pretty' }
});

wss.on('connection', (ws, req) => {
  logger.info({ userId: req.user.id }, 'WebSocket connected');

  ws.on('message', (data) => {
    logger.debug({ data }, 'Received message');
  });
});
```

**WebSocket Debugging Tips:**
- Log all incoming/outgoing messages with timestamps
- Add unique correlation IDs to trace message flows
- Use Chrome's `chrome://inspect` for Node debugging
- Monitor connection state transitions

### Hot Reload with WebSocket Connections

**Challenge:** HMR can break WebSocket connections.

**Solutions:**

1. **Reconnection Logic:**
```typescript
// Auto-reconnect on connection loss
useEffect(() => {
  let ws: WebSocket;
  let reconnectTimeout: NodeJS.Timeout;

  const connect = () => {
    ws = new WebSocket('wss://...');

    ws.onclose = () => {
      reconnectTimeout = setTimeout(connect, 3000);
    };
  };

  connect();

  return () => {
    clearTimeout(reconnectTimeout);
    ws.close();
  };
}, []);
```

2. **Development Mode Flag:**
```typescript
// Skip auto-reconnect during HMR
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log('HMR update, maintaining WebSocket');
  });
}
```

3. **Socket.io Alternative:**
- Socket.io handles reconnection automatically
- Better DX for development
- Slightly more overhead than raw WebSocket

### Package Managers

**Recommendation: pnpm or Bun**
- **pnpm**: Faster than npm, saves disk space, better monorepo support
- **Bun**: Fastest, built-in test runner, drop-in replacement for Node.js
- Avoid npm/yarn for new projects in 2025

### Environment Management

```bash
# .env.local (gitignored)
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
FIREBASE_ADMIN_KEY=yyy
ANTHROPIC_API_KEY=zzz  # NEVER expose in client

# .env.example (committed)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
FIREBASE_ADMIN_KEY=your_admin_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

**Type-safe Environment Variables:**
```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
```

### Deployment Considerations

**WebSocket-Compatible Hosts:**
- Railway (recommended for MVP)
- Render
- Fly.io
- DigitalOcean App Platform

**NOT compatible:**
- Vercel (no WebSocket support)
- Netlify (no WebSocket support)

**Deployment Checklist:**
- [ ] Use `wss://` in production
- [ ] Set up CORS allowlist
- [ ] Configure environment variables
- [ ] Enable Firebase/Supabase security rules
- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Configure rate limiting
- [ ] Test with multiple concurrent users

---

## Summary & Key Recommendations

### Security Priorities
1. Authenticate WebSockets with JWT at handshake + per-message validation
2. Use DOMPurify for all user content (sticky notes, text)
3. Keep Anthropic API key server-side only
4. Implement rate limiting on AI endpoints
5. Use strict CSP to prevent XSS

### Architecture Decisions
- **Structure:** Single Next.js app with feature-based organization
- **Testing:** Vitest for unit tests, Playwright for E2E
- **Code Style:** ESLint + Prettier with recommended configs
- **Deployment:** Railway or Render (WebSocket support required)

### Developer Experience
- Use Vitest (not Jest) - 10x faster with TypeScript
- Install recommended VS Code extensions
- Set up auto-format on save
- Use browser WebSocket inspector for debugging
- Implement auto-reconnect logic for HMR

### Testing Strategy for One-Week Sprint
- Focus on critical paths: real-time sync, auth, AI validation
- Target 40-60% coverage, not 100%
- Mock WebSocket and AI calls for faster tests
- Use Playwright multi-context for multi-user testing

---

## References

### WebSocket Security
- [WebSocket Security - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [WebSocket Authentication: Securing Real-Time Connections in 2025 - VideoSDK](https://www.videosdk.live/developer-hub/websocket/websocket-authentication)
- [WebSocket Security: Top 8 Vulnerabilities - Bright Security](https://brightsec.com/blog/websocket-security-top-vulnerabilities/)

### XSS Prevention
- [Preventing XSS in User-Generated Content](https://blog.openreplay.com/preventing-xss-user-generated-content/)
- [What Is XSS? Types, Examples & OWASP Prevention Guide [2025 Guide]](https://www.codeant.ai/blogs/the-only-xss-prevention-guide-you-need-in-2025)
- [How to Prevent XSS Attacks in React Rich Text Editor | Syncfusion Blogs](https://www.syncfusion.com/blogs/post/react-rich-text-editor-xss-prevention)

### Next.js Folder Structure
- [Best next.js folder structure 2025 | by Albert Barsegyan | Medium](https://medium.com/@albert_barsegyan/best-next-js-folder-structure-2025-da809c0cb68c)
- [The Battle-Tested NextJS Project Structure I Use in 2025. | by Burpdeepak | Medium](https://medium.com/@burpdeepak96/the-battle-tested-nextjs-project-structure-i-use-in-2025-f84c4eb5f426)
- [Building Real-Time Web Applications with Next.js and WebSockets | by @rnab | Medium](https://arnab-k.medium.com/building-real-time-web-applications-with-next-js-and-websockets-878b15f5726f)

### ESLint & Prettier
- [Setting Up a React + TypeScript Project with Vite, ESLint, Prettier, and Husky | JavaScript in Plain English](https://javascript.plainenglish.io/setting-up-a-react-typescript-project-with-vite-eslint-prettier-and-husky-ef7c9dada761)
- [Recommended ESLint and Prettier config for React TypeScript · GitHub](https://gist.github.com/jonbeebe/297856ce3f3123843601954f7a08addb)
- [Linting in TypeScript using ESLint and Prettier - LogRocket Blog](https://blog.logrocket.com/linting-typescript-eslint-prettier/)

### Testing
- [Jest vs Vitest: Which Test Runner Should You Use in 2025? | by Ruver Dornelas | Medium](https://medium.com/@ruverd/jest-vs-vitest-which-test-runner-should-you-use-in-2025-5c85e4f2bda9)
- [Vitest vs Jest | Better Stack Community](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/)
- [Playwright: Testing WebSockets and Live Data Streams](https://dzone.com/articles/playwright-for-real-time-applications-testing-webs)
- [Inspect WebSockets with Playwright - A Practical Guide](https://www.linkedin.com/pulse/inspect-websockets-playwright-practical-guide-sachith-palihawadana)

### VS Code Extensions
- [10 Best VSCode Extensions For React Developers That Will Transform Your Coding in 2025 | Level Up Coding](https://levelup.gitconnected.com/10-best-vscode-extensions-for-react-developers-that-will-transform-your-coding-in-2025-b72a862d665a)
- [7 Best VS Code Extensions for React Development to Boost Productivity | Syncfusion Blogs](https://www.syncfusion.com/blogs/post/best-vs-code-extensions-for-react)

### Backend Security
- [Best Practices for Supabase | Security, Scaling & Maintainability](https://www.leanware.co/insights/supabase-best-practices)
- [Firebase Security Rules: The Definitive Guide | AuditYourApp](https://www.audityour.app/guides/firebase-security-rules-guide)
- [Supabase vs. Firebase: a Complete Comparison in 2025](https://www.bytebase.com/blog/supabase-vs-firebase/)
