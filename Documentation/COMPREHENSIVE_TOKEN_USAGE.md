# Comprehensive Token Usage Guide

## Overview

This document maps **all token usage** across Loco's AI features. Understanding token consumption helps predict costs and optimize performance.

---

## Token Usage by Feature

### 1️⃣ Regular Chat (Default)

**When used:**
- General questions
- Explanations
- Calendar requests
- YouTube integration questions
- Attachment analysis
- Any non-game, non-code request

**Token allocation:**
- **Max output tokens:** 1000
- **Temperature:** 0.7 (balanced creativity)
- **System prompt size:** ~1500 tokens (Loco persona)

**Per-request cost:**
- Input: ~0.0003¢
- Output: ~0.0006¢
- **Total: ~0.0009¢ per chat message**

**Annual estimate (1000 chats/month):**
- 12,000 messages × $0.0009 = **~$11/year** (negligible)

---

### 2️⃣ Game Generation

**When used:**
- "Create a 2D shooter"
- "Add enemies"
- "Make a platformer"
- "Implement waves"
- Any game mechanics request

**Token allocation:**
- **Max output tokens:** 4000
- **Temperature:** 0.5 (deterministic, follows patterns)
- **System prompt size:** ~2000 tokens (base + game example)

**Per-request cost:**
- Input: ~0.0003¢
- Output: ~0.0024¢
- **Total: ~0.0027¢ per game**

**Annual estimate (100 games/month):**
- 1,200 games × $0.0027 = **~$3.24/year** (very low)

---

### 3️⃣ Pipeline Review (Quality Control)

**When used:**
- Automatically triggered after game/code generation
- Checks: correctness, user satisfaction, code quality
- Only runs if initial response might miss the mark

**Token allocation:**
- **Max output tokens:** 500
- **Temperature:** 0.1 (strict, deterministic)
- **System prompt:** ~500 tokens (review criteria)
- **Input:** Previous message + candidate response

**Per-request cost:**
- Input: ~0.0001¢
- Output: ~0.0003¢
- **Total: ~0.0004¢ per review**

**When triggered:**
- ~20-30% of game requests (when quality check needed)
- Rarely triggered for regular chat

**Annual estimate (30 reviews/month):**
- 360 reviews × $0.0004 = **~$0.14/year**

---

### 4️⃣ Code Generation Requests

**When used:**
- "Generate a function to..."
- "Write a sorting algorithm"
- Code snippets, helpers, utilities

**Token allocation:**
- **Max output tokens:** 1000 (like regular chat)
- **Temperature:** 0.7 (balanced)
- **System prompt size:** ~1500 tokens

**Per-request cost:**
- **Total: ~0.0009¢ per code snippet**

**Note:** Same budget as chat because it's treated as a specialized chat message (not full game generation).

---

### 5️⃣ Optional: Claude API (When Enabled)

**When used:**
- If Claude API key is available
- Primary choice for games/code (better quality)
- Falls back to OpenAI if Claude fails

**Token allocation:**
- **Same as OpenAI** (4000 for games, 1000 for chat)
- **Temperature:** Same (0.5 for games, 0.7 for chat)
- **Cost:** ~2x cheaper than OpenAI for same tokens

**Cost comparison (per game):**
- OpenAI: $0.0027
- Claude: $0.0015 (less than 1.5¢)

---

### 6️⃣ Optional: Gemini API (Fallback, Deprecated)

**Status:** Rarely used (quota issues, formatting problems)

**If used:**
- **Max tokens:** 1000 (capped due to system instruction limits)
- **Temperature:** 0.7
- **Cost:** ~50¢ cheaper than OpenAI per 1M tokens

**Current status:** Disabled due to API constraints (will reactivate if improved)

---

## Token Distribution Over Time

### Per Month (Typical Usage)

**Assumption:** 100 games, 1000 chats, 30 reviews

| Feature | Requests | Tokens/Request | Total Tokens | Cost |
|---------|----------|----------------|-------------|------|
| Regular chat | 1000 | 1050 | 1,050,000 | $0.63 |
| Game generation | 100 | 6050 | 605,000 | $0.36 |
| Pipeline reviews | 30 | 1000 | 30,000 | $0.02 |
| **TOTAL** | **1130** | — | **1,685,000** | **$1.01** |

**Monthly cost: ~$1** (includes everything)

### Per Year (Scaled)

- **Total tokens:** ~20.2M
- **Total cost:** ~$12/year
- **Per-feature cost:**
  - Chat: ~$7.56/year
  - Games: ~$4.32/year
  - Reviews: ~$0.24/year

---

## Why Different Token Limits?

| Feature | Tokens | Temperature | Reasoning |
|---------|--------|-------------|-----------|
| **Regular chat** | 1000 | 0.7 | Short answers, natural variation |
| **Game generation** | 4000 | 0.5 | Full 400-500 line code, follows patterns |
| **Code snippets** | 1000 | 0.7 | Functions/helpers, shorter than games |
| **Pipeline review** | 500 | 0.1 | Strict evaluation, binary decisions |

**Temperature explanation:**
- **0.1:** Deterministic (always same answer) → Good for reviews
- **0.5:** Focused (follows patterns) → Good for games
- **0.7:** Balanced (creative but coherent) → Good for chat/code

---

## Cost Optimization Strategies

### Quick Wins (Implement Now)

| Strategy | Cost Savings | Difficulty |
|----------|------------|-----------|
| Use Claude when available | 40% | Already enabled |
| Avoid unnecessary reviews | 10-20% | Monitor review rate |
| Cache system prompts (future OpenAI feature) | 90% on repeats | Planned |

### Medium-term (Planned)

| Feature | Status | Saving |
|---------|--------|--------|
| Prompt caching | OpenAI feature coming | 90% on cached prompts |
| Batch reviews | Combine multiple reviews | 10-15% |
| Token-aware model selection | Use smaller models for simple tasks | 30-50% |

### Long-term (Roadmap)

| Feature | Description | Potential |
|---------|-------------|-----------|
| Fine-tuned models | Custom model for Loco persona | 60-70% cheaper |
| On-device inference | Local LLM for simple tasks | Free for local |
| Hybrid approach | Local + cloud as needed | 40-50% savings |

---

## Monitoring Token Usage

### Current Metrics to Track

```
Monthly API costs (OpenAI + Claude + Gemini combined)
Total tokens consumed
Tokens per feature (chat, games, reviews)
Average response token count
Failure rate that triggers reviews
```

### Where to Monitor

**OpenAI Dashboard:**
- https://platform.openai.com/account/billing/overview
- Shows usage, costs, rate limits

**Claude Dashboard:**
- https://console.anthropic.com/
- Shows token consumption and costs

### Setting Cost Alerts

**Recommended alerts:**
- Alert at $5/month (double current usage)
- Alert if average tokens exceed 20% above baseline
- Daily cost cap to prevent overages

---

## Per-API-Provider Breakdown

### OpenAI (Primary)

**Models used:**
- **gpt-4o-mini:** Chat, games, reviews (main workload)

**Pricing (current):**
- Input: $0.00015 per 1K tokens
- Output: $0.0006 per 1K tokens

**Est. monthly cost:** $0.80

---

### Claude (Secondary, When Available)

**Models used:**
- **claude-3.5-sonnet:** Games/code (premium quality)

**Pricing:**
- Input: $0.003 per 1M tokens
- Output: $0.015 per 1M tokens

**Est. monthly cost:** $0.40 (if used exclusively)

---

### Gemini (Backup, Rarely Used)

**Models used:**
- **gemini-2.0-flash:** Fallback

**Pricing:**
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens

**Status:** Disabled (quota issues)

---

## Token Budgeting Recommendations

### Conservative (Low Risk)

- Games: 4000 tokens ✓ (current, safe)
- Chat: 1000 tokens ✓ (current, safe)
- Reviews: 500 tokens ✓ (current, safe)
- **Monthly budget:** $2

### Balanced (Current)

- Games: 4000 tokens
- Chat: 1000 tokens
- Reviews: 500 tokens
- **Monthly budget:** $1-2

### Aggressive (Premium Quality)

- Games: 8000 tokens (premium games)
- Chat: 1500 tokens (longer responses)
- Reviews: 750 tokens (detailed feedback)
- **Monthly budget:** $3-4

---

## FAQ

**Q: Why does game generation use 4x more tokens than chat?**
A: Games need 400-500 lines of code. At 1000 tokens, that gets cut off at ~200 lines (skeleton code). 4000 tokens allows the full polished game to fit.

**Q: Will costs increase if I scale?**
A: Not significantly. Even 10,000 games/month would cost ~$40/year. API pricing is extremely cheap at scale.

**Q: Can I set custom token limits?**
A: Yes. File: `app/api/route.ts` line ~1811. Edit `maxTokens` values directly.

**Q: What happens if a response needs more tokens?**
A: The response gets cut off at the limit. That's why reviews catch subpar responses and trigger rewrites.

**Q: Should I upgrade to larger models?**
A: Not necessary yet. gpt-4o-mini is highly efficient for Loco's workloads. Upgrade only if quality issues emerge.

---

## Summary

**Current token usage is optimized and extremely cost-effective:**

| Feature | Tokens | Cost/Unit | Annual |
|---------|--------|-----------|--------|
| Regular chat (1K/month) | 1000 | $0.0009 | ~$11 |
| Games (100/month) | 4000 | $0.0027 | ~$3 |
| Reviews (30/month) | 500 | $0.0004 | ~$0.15 |
| **TOTAL** | — | — | **~$14/year** |

**This is one of the lowest AI costs possible** while maintaining high quality. Scale as needed without cost concerns.
