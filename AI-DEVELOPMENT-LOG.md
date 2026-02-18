# AI Development Log

## Tools & Workflow

- **Primary AI Tool:** Claude Code (CLI) -- used for architecture planning, code generation, debugging, testing, and iterative feature development
- **Secondary AI Tool:** Cursor -- used for inline edits and quick code completions during active development
- **Development Approach:** AI-first workflow where Claude Code drove the majority of implementation, from initial scaffold through feature-complete MVP

## MCP Usage

No custom MCP servers were configured for this project. Claude Code's built-in tools (file read/write, bash, search) were sufficient for all development tasks.

## Effective Prompts

### 1. Initial Architecture & Scaffold
> "Implement the complete CollabBoard MVP based on the spec in G4 Week 1 - CollabBoard.pdf and the architectural decisions in PRE-SEARCH.md. Use Next.js 15 App Router, react-konva, Supabase for auth/DB/realtime, and Zustand for local state."

**Why it worked:** Providing the full spec document and pre-research gave Claude all the context needed to make consistent architectural decisions across the entire codebase in a single pass.

### 2. Real-time Sync Implementation
> "Implement real-time object sync using Supabase Realtime subscriptions. Use Last-Write-Wins conflict resolution with the version field. Cursor positions should use Supabase Presence API with no DB writes. Throttle cursor updates to 50ms."

**Why it worked:** Specific technical requirements (LWW, Presence vs Realtime, throttle values) eliminated ambiguity and produced correct implementation on the first attempt.

### 3. AI Agent Tool Schema
> "Create the AI agent with Claude function calling. Define tool schemas for createStickyNote, createShape, createFrame, createConnector, moveObject, resizeObject, updateText, changeColor, and getBoardState. The tool executor should write directly to Supabase and return created object IDs."

**Why it worked:** Listing all required tools upfront ensured complete coverage of the spec requirements. Specifying the execution strategy (direct Supabase writes) prevented unnecessary indirection.

### 4. Canvas Performance Optimization
> "Add viewport culling to the canvas -- only render objects within the visible viewport plus 200px padding. Use separate Konva layers for background grid, objects, and UI overlays. Add listening={false} to non-interactive elements."

**Why it worked:** Concrete optimization techniques with specific values (200px padding) produced measurable performance improvements without over-engineering.

### 5. Comprehensive Test Suite
> "Write Vitest unit tests for all critical paths: board object store operations, AI tool execution, API route auth/validation, real-time sync hooks, and presence tracking. Mock Supabase client and Anthropic SDK."

**Why it worked:** Enumerating the test categories ensured broad coverage. Specifying what to mock prevented tests from requiring live services.

## Code Analysis

- **AI-generated code:** ~85%
- **Hand-written/modified code:** ~15%

The AI generated the vast majority of boilerplate, component structure, API routes, test files, and configuration. Hand-written modifications were primarily for:
- Fixing edge cases in real-time sync that only appeared during multi-browser testing
- Fine-tuning canvas interaction UX (drag thresholds, selection behavior)
- Correcting TypeScript type narrowing in complex union types
- Adjusting Konva rendering details (layer ordering, hit detection areas)

## Strengths & Limitations

### Strengths
- **Rapid scaffolding:** Generated a full-stack app with auth, database, real-time sync, and AI integration in a fraction of the time it would take manually
- **Consistent patterns:** AI maintained consistent code style, naming conventions, and architectural patterns across the entire codebase
- **Test generation:** Produced comprehensive test suites with proper mocking strategies
- **Boilerplate elimination:** Handled repetitive tasks like Supabase client setup, API route handlers, and Zustand store definitions efficiently

### Limitations
- **Canvas interaction nuance:** Konva event handling edge cases (e.g., drag vs click disambiguation, multi-touch) required manual iteration and testing
- **Real-time race conditions:** LWW conflict resolution needed manual verification with multiple browser windows -- AI couldn't simulate concurrent users
- **Visual design judgment:** Color choices, spacing, and UI polish required human aesthetic review
- **Context window limits:** Large refactors spanning many files sometimes required breaking work into multiple prompts to maintain coherence

## Key Learnings

1. **Pre-research pays off:** Writing PRE-SEARCH.md with architectural decisions before coding dramatically improved AI output quality -- the AI had clear constraints to work within
2. **Spec as context:** Providing the full project spec to Claude Code ensured feature completeness and reduced back-and-forth
3. **Test-driven validation:** Having AI write tests alongside features caught integration issues early that would have been painful to debug later
4. **Incremental complexity:** Building the real-time sync layer first (as recommended by the spec) created a solid foundation that made subsequent features easier to implement
5. **AI is best at structure, humans at polish:** The AI excelled at generating correct architectural patterns and boilerplate, but human judgment was essential for UX refinement and edge case handling
