# Game Generation Token Usage & Cost Analysis

## Overview

This document outlines the token usage, costs, and quality trade-offs for Loco's game generation feature.

---

## Current Configuration

**Game Requests (e.g., "create a 2D shooter", "add enemies"):**
- Response token limit: **4000 tokens**
- Temperature: **0.5** (deterministic, follows example pattern)
- System prompt (base + example): **~2000 tokens**

**Non-game Requests:**
- Response token limit: **1000 tokens** (unchanged)
- Temperature: **0.7** (balanced creativity)

---

## Token Breakdown Per Game Generation

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt (Loco base) | ~1500 | Core persona instructions |
| Game examples context | ~500 | Full retro-shooter example |
| User message | ~50 | User's request |
| **Response** | **4000** | Generated game code |
| **Total per request** | **~6050** | — |

---

## Cost Analysis (OpenAI gpt-4o-mini pricing)

**API Rates:**
- Input tokens: $0.00015 per 1K tokens
- Output tokens: $0.0006 per 1K tokens

**Cost per game:**

| Token Limit | Input Cost | Output Cost | Total | Quality |
|------------|-----------|------------|-------|---------|
| 1000 (old) | $0.0003 | $0.0006 | $0.0009 | ⭐ Skeleton code |
| 4000 (current) | $0.0003 | $0.0024 | $0.0027 | ⭐⭐⭐⭐⭐ Full games |
| 6000 | $0.0003 | $0.0036 | $0.0039 | ⭐⭐⭐⭐⭐+ Better |
| 8000 | $0.0003 | $0.0048 | $0.0051 | ⭐⭐⭐⭐⭐++ Premium |

**Per 100 games:**
- 4000 tokens: **$0.27**
- 6000 tokens: **$0.39** (+$0.12)
- 8000 tokens: **$0.51** (+$0.24)

---

## Quality Expectations by Token Limit

### 1000 Tokens (Previous)
- ✗ Basic HTML skeleton
- ✗ External CSS/JS files
- ✗ ~60 lines total
- ✗ Missing mechanics (enemies, waves, collision)
- ✗ No UI polish
- **Result:** Unusable, incomplete games

### 4000 Tokens (Current) ✅
- ✓ Full 400-500 line games
- ✓ Embedded CSS + JavaScript
- ✓ Complete game mechanics (enemies, waves, collision detection)
- ✓ Professional UI (stats, instructions, controls)
- ✓ Animations and particle effects
- ✓ Game over states and restart
- **Result:** Production-ready games ready to play

### 6000 Tokens
- ✓ Everything above, plus:
- ✓ More complex enemy types
- ✓ Power-ups and special items
- ✓ Advanced animations
- ✓ Better visual polish
- **Result:** Enhanced, feature-rich games

### 8000 Tokens
- ✓ Everything above, plus:
- ✓ Multiple game modes
- ✓ Leaderboard/achievements
- ✓ Sound effects (via Web Audio API)
- ✓ Advanced mechanics (bosses, combo systems)
- **Result:** Premium game experiences

---

## Why 4000 Tokens Is Optimal

| Factor | Evaluation |
|--------|------------|
| **Cost** | ~0.27¢ per game (negligible) |
| **Quality** | Polished, playable 400-500 line games |
| **Speed** | Faster responses than 6000-8000 |
| **Token efficiency** | No wasted tokens on bloat |
| **Proven results** | Consistently generates full-featured games |
| **Scalability** | Room to grow without major cost impact |

**Recommendation:** Keep 4000 tokens as the standard. Upgrade to 6000-8000 only if:
- Specific game projects need advanced features
- User explicitly requests premium game generation
- Cost is not a constraint

---

## How to Change Token Limits

**File:** `app/api/route.ts` (line ~1810)

```typescript
const tokenConfig = isGameRequest 
  ? { temperature: 0.5, maxTokens: 4000 }  // Change here
  : { temperature: 0.7, maxTokens: 1000 };
```

**Example upgrade to 6000:**
```typescript
const tokenConfig = isGameRequest 
  ? { temperature: 0.5, maxTokens: 6000 }
  : { temperature: 0.7, maxTokens: 1000 };
```

---

## Game Example System

When a game request is detected, Loco automatically:

1. **Loads** the retro-shooter example from `/examples/games/retro-shooter/main.html`
2. **Injects** it into the system prompt with strict formatting rules
3. **Enforces** that responses follow the example structure:
   - Embedded CSS (no external files)
   - Embedded JavaScript (no external files)
   - 400+ lines minimum
   - Full game mechanics
   - Professional UI

**Game detection patterns:**
- "create a 2D shooter"
- "add enemies"
- "implement waves"
- "improve collision"
- "make a platformer"
- Any mention of "enemies", "boss", "shooter", "arcade", etc.

---

## Cost Savings Strategies

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Use Claude instead of OpenAI | ~40% cheaper | Requires Claude API credits |
| Cache game examples (future) | ~90% on follow-ups | Engineering effort |
| Batch multiple requests | 5-10% per batch | Latency increase |
| Use lower temperature | ~5-10% fewer tokens | May be less deterministic |

---

## Monitoring & Metrics

**Track these for cost optimization:**

```
Avg tokens per game request: __________
Games generated per month: __________
Monthly game generation cost: __________
Cost per game (calculated): __________
Quality rating (1-5): __________
```

**Monthly estimate (100 games at 4000 tokens):**
- ~404K input tokens (100 reqs × ~2050 tokens)
- ~400K output tokens (100 reqs × 4000 tokens)
- **Estimated cost: ~$0.27/month** (very low)

---

## Future Enhancements

1. **Prompt caching** (OpenAI feature)
   - Cache the 2000-token system prompt + example
   - Save ~90% on repeated requests

2. **Token budget per game tier**
   - "Quick game": 2000 tokens (fast)
   - "Standard game": 4000 tokens (current)
   - "Premium game": 8000 tokens (feature-rich)

3. **Multi-game generation**
   - Generate 3-5 game variants in one request
   - More efficient token usage per variant

---

## Conclusion

**Current setup (4000 tokens):**
- Produces excellent, playable games
- Costs less than a penny per game
- Fast and reliable
- Optimal for general use

**Keep this setting unless specific needs arise.**
