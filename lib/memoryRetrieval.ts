// In plain terms: this file scores and filters memory matches so the app can recall useful past information.

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "before", "but", "by", "do", "for", "from",
  "had", "has", "have", "i", "if", "in", "into", "is", "it", "its", "me", "my", "of", "on", "or",
  "our", "so", "still", "that", "the", "their", "them", "there", "these", "they", "this", "to", "us",
  "was", "we", "were", "what", "when", "with", "you", "your",
]);

const TOPIC_CLUSTERS = [
  [
    "star", "stars", "astronomy", "astrology", "space", "constellation", "constellations", "celestial",
    "cosmos", "galaxy", "galaxies", "planet", "planets", "zodiac", "horoscope", "dipper", "ursa", "moon",
  ],
  ["code", "coding", "program", "programming", "developer", "software", "app", "apps"],
  ["music", "song", "songs", "audio", "sound", "album", "artist"],
];

const TOPIC_ALIASES = new Map<string, Set<string>>();

for (const cluster of TOPIC_CLUSTERS) {
  for (const token of cluster) {
    TOPIC_ALIASES.set(token, new Set(cluster));
  }
}

function stemToken(token: string) {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("ing") && token.length > 5) {
    return token.slice(0, -3);
  }

  if (token.endsWith("ed") && token.length > 4) {
    return token.slice(0, -2);
  }

  if (token.endsWith("es") && token.length > 4) {
    return token.slice(0, -2);
  }

  if (token.endsWith("s") && token.length > 3) {
    return token.slice(0, -1);
  }

  return token;
}

export function trimSnippet(text: string, maxLength = 180) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

export function tokenizeForMemorySearch(text: string) {
  const rawTokens = text
    .toLowerCase()
    .match(/[a-z0-9']+/g) || [];

  const tokens = new Set<string>();

  for (const rawToken of rawTokens) {
    const stemmed = stemToken(rawToken);
    if (!stemmed || STOP_WORDS.has(stemmed)) {
      continue;
    }

    tokens.add(stemmed);
    const aliases = TOPIC_ALIASES.get(stemmed);
    if (aliases) {
      for (const alias of aliases) {
        tokens.add(alias);
      }
    }
  }

  return Array.from(tokens);
}

export function scoreMemoryRelevance(query: string, candidate: string) {
  const queryTokens = tokenizeForMemorySearch(query);
  const candidateTokens = new Set(tokenizeForMemorySearch(candidate));

  if (queryTokens.length === 0 || candidateTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  let strongOverlap = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      overlap += 1;
      if (query.toLowerCase().includes(token) && candidate.toLowerCase().includes(token)) {
        strongOverlap += 1;
      }
    }
  }

  if (overlap === 0) {
    return 0;
  }

  return overlap + strongOverlap * 2;
}