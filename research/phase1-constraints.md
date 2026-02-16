# Phase 1: Project Constraints - CollabBoard

*Research Date: February 16, 2026*
*Project: Real-time Collaborative Whiteboard with AI Agents*
*Sprint Duration: 7 days (one-week sprint for Gauntlet program)*

---

## 1. Scale & Load Profile

### Initial Scale Requirements
- **Launch**: Small class/team size (~5-20 concurrent users)
- **6-month projection**: ~100-500 concurrent users
- **Traffic pattern**: Spiky (workshop/session-based usage, not steady)

### Real-Time Performance Requirements
- **Cursor sync**: <50ms latency (critical for "presence" feeling)
- **Object sync**: <100ms latency (drawing, sticky notes, shapes)
- **Cold start**: Must be minimal - WebSocket connections need to be persistent

### Recommendation: Start with Free/Low-Cost Managed Services

**Rationale:**
Given the scale profile (5-20 users at launch, spiky traffic), free-tier managed services are perfectly adequate. Based on current 2026 pricing:

**Supabase** emerges as the strongest option for real-time features:
- Unlimited WebSocket connections on free tier
- 500 MB database storage, 2 GB egress
- 50,000 monthly active users for auth
- Built-in real-time subscriptions (PostgreSQL change streams)
- **Critical limitation**: 7-day inactivity pause on free tier (unsuitable for production)

**For production-ready hosting with persistent WebSockets:**
- **Railway.app**: $5/month Hobby plan includes $5 usage credit
  - Native WebSocket support (HTTP, TCP, gRPC, WebSockets automatic)
  - Usage-based billing (memory, CPU, storage, egress)
  - No cold starts for persistent services
  - Best for real-time apps requiring 24/7 uptime

- **Render**: Free tier supports WebSockets but services spin down with inactivity
  - 100GB bandwidth/month free
  - Good for development/testing
  - Upgrade to paid ($7+/month) for always-on services

**Firebase Realtime Database** (alternative):
- 50,000 daily document reads, 20,000 writes (free tier)
- 1 GB storage free
- Native real-time sync capabilities
- May hit limits faster with whiteboard object updates

**Vercel NOT recommended** for WebSocket backend:
- Serverless functions do not support persistent WebSocket connections
- Would require third-party service (Pusher, Ably, etc.)
- Better suited for static frontend hosting only

### Scaling Guidance
At 300+ concurrent users:
- Switch to Redis-backed storage for state management
- Deploy at least 2 WebSocket instances (load balancing)
- Budget 15 Mbps outbound bandwidth per 100 concurrent users
- Consider regional deployment for latency optimization

### Tradeoffs
- **Free tier risk**: Services pausing after inactivity (Supabase, Render free)
- **Cold start penalty**: Serverless architectures unsuitable for WebSockets
- **Monitoring gap**: Free tiers lack advanced metrics/alerts
- **Regional limitations**: Most free tiers are single-region (US or EU)

---

## 2. Budget & Cost Ceiling

### Budget Reality
- **Sprint context**: One-week Gauntlet program project
- **Post-sprint**: Demo/portfolio piece, not immediate revenue
- **Monthly spend target**: $0-10/month for first 3 months

### Cost Strategy: Maximize Free Tiers, Use Managed Services

**Recommended Stack Cost Breakdown:**

**Option A: All-Free (Development/Demo)**
- Supabase Free: $0/month (with 7-day pause limitation)
- Vercel Free (frontend only): $0/month (100 GB bandwidth)
- Total: **$0/month**
- ⚠️ **Caveat**: Unsuitable for production due to inactivity pauses

**Option B: Minimal Production-Ready**
- Railway.app Hobby: $5/month (includes $5 usage credit)
- Vercel Free (frontend): $0/month
- Supabase Free (auth + database): $0/month
- Total: **$5/month** (most likely scenario)

**Option C: Full Production Stack**
- Railway.app Pro: $20/month (includes $20 usage credit)
- Vercel Pro: $20/month (if needed for team features)
- Supabase Pro: $25/month (no inactivity pause, better limits)
- Total: **$45-65/month** (only if scaling beyond 100+ users)

### Cost Optimization Strategies

1. **Trade Money for Time (Recommended for Sprint)**
   - Use managed services (Firebase, Supabase, Railway)
   - Avoid self-hosting anything (no Docker, no VPS, no Kubernetes)
   - Pre-built auth, database, storage, real-time sync
   - **Time savings**: 2-3 days avoided on infrastructure setup

2. **Pay-Per-Use vs. Fixed Cost**
   - Railway.app uses pay-per-use (CPU, memory, egress)
   - Ideal for spiky traffic (only pay when users active)
   - Free tiers have fixed quotas (may hit limits unpredictably)

3. **Frontend Cost = $0**
   - Vercel Free tier: 150,000 function invocations/month
   - 100 GB bandwidth free
   - Unlimited static deployments
   - No credit card required until scaling

4. **AI Agent Costs** (separate consideration)
   - Claude API usage: ~$0.015/1K input tokens, ~$0.075/1K output tokens
   - Estimated $5-20/month for moderate agent use during demo
   - Consider caching strategies to reduce API calls

### Tradeoffs
- **Free tier lock-in**: May need migration if scaling fast
- **Feature limitations**: Advanced features (custom domains, team collaboration) require paid tiers
- **Support**: Free tiers have community support only
- **Vendor dependency**: Heavy reliance on platform-specific features

---

## 3. Time to Ship

### Sprint Timeline
- **Day 1 (24 hours)**: MVP - Basic whiteboard with cursor sync
- **Day 4**: Full feature set - Drawing tools, sticky notes, basic AI agent
- **Day 7**: Polish - UI refinement, error handling, demo-ready

### Speed-to-Market Strategy

**Critical Success Factors:**

1. **Use Familiar Frameworks** (Non-negotiable)
   - Next.js + React: Industry standard, 75% of React devs productive within 1 month
   - TypeScript: Type safety without slow compilation
   - Tailwind CSS: Utility-first, no CSS file switching
   - **Why**: Zero learning curve = ship 2-3x faster

2. **Leverage AI-First Development**
   - Claude Code for codebase navigation, refactoring, feature implementation
   - GitHub Copilot/Cursor for inline completion
   - Claude API for agent features (built-in, not custom AI)
   - **Time savings**: 40-60% reduction in boilerplate writing

3. **Pre-Built Canvas Library** (Don't reinvent)
   - **Fabric.js** (recommended):
     - Mature, 43x more popular than Konva
     - Object-oriented API, SVG export support
     - Extensive examples and community resources
     - Built-in object manipulation (resize, rotate, group)
   - **Konva.js** (alternative):
     - Better performance (dirty region rendering)
     - Smaller learning curve
     - No SVG export (limitation)
   - **Decision**: Fabric.js for feature richness, Konva.js if performance critical

4. **Real-Time: Use Managed, Not Custom**
   - Supabase real-time subscriptions (PostgreSQL-based)
   - OR Socket.IO on Railway.app (more control)
   - **Avoid**: Building custom WebSocket server from scratch
   - **Time savings**: 1-2 days on protocol, reconnection, scaling logic

5. **Daily Iteration Cadence**
   - Day 1 end: Cursor sync working, basic drawing
   - Day 2 end: Persistent shapes, user authentication
   - Day 3 end: Sticky notes, basic collaboration
   - Day 4 end: AI agent integration (simple commands)
   - Day 5-7: Polish, bug fixing, demo prep

### Development Velocity Best Practices

**Modern Next.js Optimizations (2026):**
- React Server Components: Reduce client JS bundle by 40-60%
- Turbopack: 10x faster HMR than Webpack (seconds → milliseconds)
- Modular folder structure: Feature-based, not file-type-based
- Built-in API routes: No separate Express server needed

**Performance Shortcuts:**
- Use React.memo strategically (canvas re-renders expensive)
- WebSocket event batching (send updates every 50ms, not per-action)
- Canvas optimization: Dirty region tracking, object pooling
- Image optimization: Next.js Image component (automatic WebP conversion)

### Tradeoffs
- **Tech debt accumulation**: Fast shipping = less refactoring time
- **Feature vs. polish tension**: May need to cut AI agent features if time-constrained
- **Testing gaps**: 7-day sprint = minimal automated testing
- **Documentation debt**: Code comments may be sparse

---

## 4. Compliance & Regulatory Needs

### Compliance Context
- **No health data**: No HIPAA requirements
- **No EU targeting**: No explicit GDPR focus (but good practice to be GDPR-friendly)
- **No enterprise clients**: No SOC 2, ISO 27001, or contractual security audits
- **Target users**: Individual developers, small teams, educational workshops

### Minimal Compliance Approach

**Standard Web Security Practices (Must-Have):**

1. **Authentication & Authorization**
   - Use Supabase Auth or Firebase Auth (OAuth 2.0 compliant)
   - Social login (Google, GitHub) - reduces password management risk
   - Row-level security (RLS) on database tables
   - JWT tokens with short expiration (15-60 minutes)

2. **Data Encryption**
   - HTTPS everywhere (enforced by Vercel/Railway by default)
   - Database encryption at rest (default in Supabase/Firebase)
   - No custom encryption needed (rely on platform defaults)

3. **Input Validation & Sanitization**
   - Server-side validation for all user inputs
   - Canvas object data sanitization (prevent XSS in SVG exports)
   - Rate limiting on API endpoints (prevent abuse)

4. **Basic Privacy Practices** (GDPR-friendly)
   - Privacy policy page (use template)
   - Cookie consent banner (if using analytics)
   - User data export capability (Supabase admin API)
   - Account deletion flow (soft delete with 30-day recovery)

**Explicitly NOT Required:**
- ❌ SOC 2 audit
- ❌ HIPAA compliance
- ❌ PCI-DSS (no payment processing in MVP)
- ❌ Penetration testing
- ❌ Security certifications
- ❌ Data residency restrictions
- ❌ Custom encryption key management

### Security Best Practices (Nice-to-Have)

1. **OWASP Top 10 Awareness**
   - SQL injection: Use parameterized queries (Supabase default)
   - XSS: Sanitize canvas object data, use React's built-in escaping
   - CSRF: Use SameSite cookies, CSRF tokens for state-changing operations
   - Command injection: Validate AI agent commands (whitelist approach)

2. **Real-Time Security**
   - WebSocket authentication: Validate JWT on connection
   - Room-based authorization: Users can only join boards they created/invited to
   - Rate limiting: Max 100 WebSocket messages/second per user

3. **AI Agent Security**
   - Prompt injection protection: Sanitize user inputs to Claude API
   - Cost limiting: Max $10/user/month API spend (hard cap)
   - Content filtering: Basic profanity filter on public boards

### Monitoring & Incident Response

**Free Tier Monitoring:**
- Vercel Analytics (free): Page views, Web Vitals
- Supabase Dashboard: Database queries, API usage
- Railway Logs: WebSocket connection errors
- Sentry Free (10K events/month): Error tracking

**Incident Response (Minimal):**
- Email alerts for critical errors (Sentry)
- Manual review of reported abuse (email form)
- No 24/7 on-call (portfolio project, not production SaaS)

### Tradeoffs
- **Reputation risk**: Security incidents could harm portfolio credibility
- **User trust**: Lack of clear privacy policy reduces adoption
- **Legal exposure**: Minimal but not zero (terms of service recommended)
- **Scaling blockers**: Enterprise customers would require SOC 2/GDPR compliance later

---

## 5. Team & Skill Constraints

### Team Composition
- **Solo developer**: One person building entire stack
- **AI-first workflow**: Claude Code + at least one additional AI tool
- **Sprint duration**: 7 days (168 hours, realistically ~40-60 hours of deep work)

### Skill Profile Assumptions
- **Familiar frameworks preferred**: Likely React/Next.js experience
- **Full-stack capability**: Can handle frontend + backend + deployment
- **AI tooling proficiency**: Comfortable with prompt engineering, code review of AI output

### Technology Selection Criteria

**Prioritization Framework:**

1. **Ship Speed > Learning New Things** (Critical)
   - Use Next.js (not Svelte/Solid) if React-familiar
   - Use Tailwind CSS (not custom CSS frameworks)
   - Use TypeScript (type safety without Rust-level complexity)
   - Use npm/yarn (not pnpm unless already familiar)

2. **Managed > Self-Hosted** (Always)
   - Supabase/Firebase > Custom PostgreSQL server
   - Railway.app > AWS EC2 instances
   - Vercel > Custom Nginx deployment
   - **Reason**: No DevOps time sink

3. **Community Support > Cutting-Edge** (Risk management)
   - Fabric.js (mature, 43x more popular) > Custom Canvas API
   - Socket.IO (battle-tested) > WebRTC (more complex)
   - Next.js (mainstream) > Fresh/Astro (newer frameworks)
   - **Reason**: More Stack Overflow answers, fewer dead ends

### AI-First Development Strategy

**Tool Combination (Recommended):**

1. **Claude Code (Primary)**
   - Codebase navigation ("find all WebSocket event handlers")
   - Feature implementation ("add sticky note component with drag-drop")
   - Refactoring ("extract canvas logic to custom hook")
   - Debugging ("why is cursor sync lagging by 500ms?")

2. **GitHub Copilot or Cursor (Secondary)**
   - Inline code completion (reduce typing)
   - Boilerplate generation (API routes, TypeScript types)
   - Test case suggestions (if time permits)

3. **Claude API (Product Feature)**
   - AI agent capabilities (interpret natural language commands)
   - Smart suggestions ("add a flowchart based on these sticky notes")
   - Content generation (auto-label objects, summarize board)

**AI Tooling Best Practices:**

- **Code review discipline**: Always read AI-generated code before committing
- **Security vigilance**: Watch for SQL injection, XSS, hardcoded secrets
- **Iterative prompting**: Start broad ("add user auth"), then refine ("use Supabase Auth with Google OAuth")
- **Context management**: Feed AI relevant files (don't assume it knows full codebase)
- **Fallback plan**: If AI stuck, Google/Stack Overflow within 15 minutes

### Risk Mitigation

**Single Point of Failure (Solo Dev):**
- Risk: Getting stuck on a bug = entire sprint blocked
- Mitigation: Time-box debugging (2-hour max), then ask for help (Discord, Gauntlet Slack)
- Mitigation: Use proven libraries (less likely to hit edge-case bugs)

**Scope Creep:**
- Risk: AI agents are complex = could consume entire sprint
- Mitigation: Define MVP features Day 1 (e.g., "AI agent can only add/move sticky notes, not analyze board")
- Mitigation: Feature flags for AI features (can disable if not ready)

**Burnout:**
- Risk: 7-day sprint = temptation to work 12-hour days
- Mitigation: Daily progress milestones (clear stopping points)
- Mitigation: Sleep > coding (well-rested = fewer bugs)

### Recommended Tech Stack (Final)

**Frontend:**
- Next.js 15+ (React Server Components, Turbopack)
- TypeScript (strict mode)
- Tailwind CSS (utility-first styling)
- Fabric.js or Konva.js (canvas manipulation)
- Zustand or Jotai (lightweight state management)

**Backend:**
- Next.js API routes (serverless functions)
- Supabase (auth + database + real-time) OR
- Railway.app + Socket.IO (if need persistent WebSocket server)

**Real-Time:**
- Supabase real-time subscriptions (PostgreSQL-based) OR
- Socket.IO on Railway.app (more control, traditional WebSocket)

**AI Integration:**
- Claude API (Sonnet 4.5 for speed, Opus 4.6 for quality)
- Streaming responses (better UX for longer AI outputs)

**Deployment:**
- Vercel (frontend, API routes)
- Railway.app (WebSocket server if not using Supabase)
- Supabase (database, auth, real-time)

**Tooling:**
- Claude Code (codebase assistant)
- GitHub Copilot or Cursor (inline completion)
- VS Code (editor)
- Git + GitHub (version control)

### Tradeoffs
- **Over-reliance on AI**: May miss learning opportunities
- **Tech stack lock-in**: Tight coupling to Vercel/Supabase ecosystems
- **Solo dev bottleneck**: No code review, potential blind spots
- **Polish vs. features**: May sacrifice UI refinement for feature completion

---

## Summary: Key Recommendations

### Immediate Decisions (Day 0)

1. **Hosting Stack**: Railway.app ($5/month) + Vercel (free)
   - Railway for persistent WebSocket server (Socket.IO)
   - Vercel for Next.js frontend deployment
   - Supabase for auth + database (free tier)

2. **Canvas Library**: Fabric.js (mature, feature-rich)
   - Konva.js if performance becomes issue (test first)

3. **Real-Time Approach**: Socket.IO on Railway.app
   - More control than Supabase real-time subscriptions
   - Easier debugging for custom whiteboard logic

4. **AI Agent Scope**: Limit to 3 commands max
   - Example: "Add sticky note", "Organize by color", "Summarize board"
   - Use Claude Sonnet 4.5 (faster, cheaper than Opus)

### Success Metrics

**Day 1 (MVP):**
- [ ] Basic canvas with drawing tools (pen, rectangle, circle)
- [ ] Real-time cursor sync (<50ms latency)
- [ ] User authentication (Google OAuth via Supabase)
- [ ] Board persistence (save/load to database)

**Day 4 (Full Feature Set):**
- [ ] Sticky notes with drag-drop
- [ ] Object manipulation (resize, rotate, delete)
- [ ] Multi-user collaboration (5+ users simultaneously)
- [ ] Basic AI agent (1-2 commands working)
- [ ] Board sharing (invite by email/link)

**Day 7 (Polish):**
- [ ] Smooth animations and transitions
- [ ] Error handling (reconnection logic, conflict resolution)
- [ ] Responsive design (desktop + tablet)
- [ ] Demo video recorded
- [ ] Deployed to production (public URL)

### Budget Summary
- **Development**: $5/month (Railway.app Hobby)
- **AI API**: $5-15 during sprint (Claude API usage)
- **Total Month 1**: ~$10-20
- **Scaling trigger**: If 100+ concurrent users, upgrade to Railway Pro ($20/month)

### Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| WebSocket scaling issues | High | Medium | Test with 20+ simulated users Day 3 |
| AI agent scope creep | High | High | Hard cap at 3 commands, feature-flag |
| Debugging time sink | Medium | High | 2-hour time-box, then ask for help |
| Free tier limits hit | Medium | Low | Monitor Supabase dashboard daily |
| Solo dev burnout | High | Medium | Daily progress milestones, sleep schedule |

---

## Research Sources

### Pricing & Platform Research
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Supabase Realtime Pricing](https://supabase.com/docs/guides/realtime/pricing)
- [Vercel Limits](https://vercel.com/docs/limits)
- [Render Pricing](https://render.com/pricing)
- [Railway Pricing](https://railway.com/pricing)

### Technical Architecture
- [Building Real-Time Collaborative Whiteboard with NestJS and Socket.IO](https://medium.com/@adredars/building-a-real-time-collaborative-whiteboard-backend-with-nestjs-and-socket-io-2229f7bf73bd)
- [Design a Real-Time Collaborative Whiteboard System](https://www.coudo.ai/blog/design-a-real-time-collaborative-whiteboard-system)
- [Hybrid WebRTC-WebSocket Communication](https://www.researchgate.net/publication/394065151_Hybrid_WebRTC-WebSocket_Communication_and_Adaptive_State_Synchronization_for_Scalable_Real-Time_3D_Collaborative_Whiteboard)

### Framework Best Practices
- [React & Next.js in 2025 - Modern Best Practices](https://strapi.io/blog/react-and-nextjs-in-2025-modern-best-practices)
- [Next.js vs React: When to Use Which (2026)](https://designrevision.com/blog/nextjs-vs-react)
- [React & Next.js Best Practices in 2026](https://fabwebstudio.com/blog/react-nextjs-best-practices-2026-performance-scale)

### Canvas Libraries
- [Konva.js vs Fabric.js: In-Depth Technical Comparison](https://medium.com/@www.blog4j.com/konva-js-vs-fabric-js-in-depth-technical-comparison-and-use-case-analysis-9c247968dd0f)
- [Konva.js vs. Fabric.js: Choosing Your Canvas Companion](https://www.oreateai.com/blog/konvajs-vs-fabricjs-choosing-your-canvas-companion/9d255e8dbd093ab89c868295b2d20187)
- [Top 5 JavaScript Whiteboard & Canvas Libraries](https://byby.dev/js-whiteboard-libs)

### Competitive Analysis
- [Miro Alternatives: Top Collaborative Whiteboard Tools](https://brightseotools.com/post/Miro-Alternatives)
- [20 Best Miro Alternatives For Collaboration In 2026](https://thedigitalprojectmanager.com/tools/miro-alternative/)

---

*End of Phase 1 Research*
*Next: Phase 2a (Backend Architecture) and Phase 2b (Frontend Framework)*
