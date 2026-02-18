# AI Cost Analysis

## Development & Testing Costs

### LLM API Spend During Development

| Category | Estimated Tokens (Input) | Estimated Tokens (Output) | Estimated Cost |
|---|---|---|---|
| Claude Code (development) | ~2M | ~500K | ~$40 |
| Claude Code (testing/debugging) | ~500K | ~200K | ~$12 |
| Cursor (inline edits) | ~200K | ~100K | ~$3 |
| **Total Development** | **~2.7M** | **~800K** | **~$55** |

### Production AI Feature (AI Board Agent)

The AI board agent uses Claude Sonnet via the `/api/ai/` route for whiteboard manipulation commands.

| Metric | Value |
|---|---|
| Model | Claude Sonnet 4.6 |
| Avg input tokens per command | ~1,500 (system prompt + tools + board state + user message) |
| Avg output tokens per command | ~300 (tool calls + response text) |
| Input price | $3.00 / 1M tokens |
| Output price | $15.00 / 1M tokens |
| **Cost per AI command** | **~$0.009** (~0.9 cents) |

## Production Cost Projections

### Assumptions

- **Commands per session:** 5 AI commands per active session (average)
- **Sessions per user per month:** 8 sessions (moderate engagement)
- **Commands per user per month:** 40 commands
- **Tokens per command:** ~1,500 input + ~300 output
- **Supabase:** Free tier covers up to ~500 MAU; Pro plan ($25/mo) for higher tiers
- **Railway:** Starter plan (~$5/mo base); scales with usage
- **Realtime connections:** Supabase handles up to 200 concurrent on free, 500 on Pro

### Monthly Cost Projections

| Component | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|---|
| **AI API (Claude)** | $36 | $360 | $3,600 | $36,000 |
| **Supabase (DB + Auth + Realtime)** | $0 (free) | $25 (Pro) | $75 (Pro+) | $400 (Team) |
| **Railway (hosting)** | $5 | $10 | $50 | $200 |
| **Total Monthly** | **~$41** | **~$395** | **~$3,725** | **~$36,600** |
| **Per-user/month** | **$0.41** | **$0.40** | **$0.37** | **$0.37** |

### AI Cost Breakdown by Command Type

| Command Type | Avg Input Tokens | Avg Output Tokens | Cost per Call |
|---|---|---|---|
| `createStickyNote` | 1,200 | 200 | $0.007 |
| `createShape` | 1,200 | 200 | $0.007 |
| `createFrame` | 1,200 | 250 | $0.007 |
| `createConnector` | 1,300 | 250 | $0.008 |
| `moveObject` / `resizeObject` | 1,400 | 150 | $0.006 |
| `updateText` / `changeColor` | 1,300 | 150 | $0.006 |
| `getBoardState` | 1,200 | 100 | $0.005 |
| Complex (multi-step templates) | 2,000 | 800 | $0.018 |

### Cost Optimization Strategies

1. **Prompt caching:** Cache the system prompt and tool definitions to reduce input tokens by ~40% on repeated calls (Anthropic prompt caching)
2. **Board state summarization:** Instead of sending full board state, send a summary with object counts and types -- reduces input by ~30% for large boards
3. **Rate limiting:** Current limit of 10 AI commands per minute per user prevents runaway costs
4. **Model tiering:** Use Claude Haiku for simple commands (create/move) and Sonnet for complex multi-step commands -- could reduce AI costs by ~60%
5. **Batching:** Group rapid sequential commands into a single API call where possible
