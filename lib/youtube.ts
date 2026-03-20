// In plain terms: this file helps Loco understand YouTube requests, playlist aliases, and search filters.

export interface YouTubePlaylistAlias {
  id: string;
  name: string;
  url: string;
}

export interface YouTubePlaybackIntent {
  kind: "playlist" | "video-search";
  aliasName?: string;
  query?: string;
  newest?: boolean;
  rawRequest?: string;
  mediaHint?: "song" | "track" | "video" | "movie" | "film" | "clip" | "trailer" | "episode" | "theme" | "ost" | "soundtrack" | "opening" | "ending" | "remix";
}

export interface YouTubeVideoSearchFilters {
  rawRequest: string;
  normalizedRequest: string;
  searchQuery: string;
  exactSearchPhrase?: string;
  keywords: string[];
  artist?: string;
  author?: string;
  location?: string;
  live?: "live" | "upcoming" | "completed";
  myVideos: boolean;
  newest: boolean;
  uploadedAfter?: string;
  uploadedBefore?: string;
  officialPreferred: boolean;
  mediaHint?: "song" | "track" | "video" | "movie" | "film" | "clip" | "trailer" | "episode" | "theme" | "ost" | "soundtrack" | "opening" | "ending" | "remix";
  exactTitlePreferred: boolean;
}

export const YOUTUBE_PLAYLIST_STORAGE_KEY = "youtubePlaylistAliases";

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "me",
  "of",
  "on",
  "show",
  "the",
  "to",
  "video",
  "videos",
  "youtube",
]);

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupSearchValue(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[-,\s]+|[-,\s]+$/g, "")
    .trim();
}

function resolveMediaHint(normalizedRequest: string) {
  const orderedHints: Array<YouTubeVideoSearchFilters["mediaHint"]> = [
    "remix",
    "theme",
    "ost",
    "soundtrack",
    "opening",
    "ending",
    "song",
    "track",
    "video",
    "movie",
    "film",
    "clip",
    "trailer",
    "episode",
  ];

  return orderedHints.find((hint) => new RegExp(`\\b${hint}\\b`, "i").test(normalizedRequest));
}

function buildExactSearchPhrase(baseQuery: string, mediaHint?: YouTubeVideoSearchFilters["mediaHint"]) {
  const normalizedBaseQuery = cleanupSearchValue(baseQuery);
  if (!normalizedBaseQuery || !mediaHint) {
    return normalizedBaseQuery || undefined;
  }

  const normalizedWithBoundaries = ` ${normalizeSearchText(normalizedBaseQuery)} `;
  const hasHintAlready = new RegExp(`\\b${mediaHint}\\b`, "i").test(normalizedWithBoundaries);

  if (mediaHint === "song" || mediaHint === "track") {
    return normalizedBaseQuery;
  }

  if (hasHintAlready) {
    return normalizedBaseQuery;
  }

  if (mediaHint === "remix") {
    return `${normalizedBaseQuery} remix`.trim();
  }

  return `${normalizedBaseQuery} ${mediaHint}`.trim();
}

function normalizeMediaSubjectQuery(query: string, mediaHint?: YouTubeVideoSearchFilters["mediaHint"]) {
  const cleanedQuery = cleanupSearchValue(query);

  if (!mediaHint || !/(?:theme|ost|soundtrack|opening|ending)/i.test(mediaHint)) {
    return cleanedQuery;
  }

  return cleanedQuery
    .replace(/\b([a-z0-9]+)'s\b$/i, "$1")
    .replace(/\b([a-z0-9]{4,})s\b$/i, "$1")
    .replace(/\b([a-z0-9]+)'s\b(?=\s+(?:theme|ost|soundtrack|opening|ending)\b)/gi, "$1")
    .replace(/\b([a-z0-9]+)s\b(?=\s+(?:theme|ost|soundtrack|opening|ending)\b)/gi, "$1")
    .trim();
}

function toUtcIso(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, 0, 0, 0)).toISOString();
}

function startOfUtcDay(date: Date) {
  return toUtcIso(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function startOfUtcWeek(date: Date) {
  const currentDay = date.getUTCDay();
  const diff = currentDay === 0 ? -6 : 1 - currentDay;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff));
  return startOfUtcDay(start);
}

function startOfUtcMonth(date: Date) {
  return toUtcIso(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function startOfUtcYear(date: Date) {
  return toUtcIso(date.getUTCFullYear(), 0, 1);
}

function parseMonthYear(fragment: string) {
  const match = fragment.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?\b/i);
  if (!match) {
    return null;
  }

  const month = MONTHS[match[1].toLowerCase()];
  const year = match[2] ? Number(match[2]) : new Date().getUTCFullYear();
  if (Number.isNaN(year)) {
    return null;
  }

  return {
    after: toUtcIso(year, month, 1),
    before: month === 11 ? toUtcIso(year + 1, 0, 1) : toUtcIso(year, month + 1, 1),
  };
}

function parseYearRange(fragment: string) {
  const match = fragment.match(/\b(20\d{2}|19\d{2})\b/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  return {
    after: toUtcIso(year, 0, 1),
    before: toUtcIso(year + 1, 0, 1),
  };
}

function tokenizeSearchTerms(value: string) {
  return normalizeSearchText(value)
    .split(" ")
    .filter((word) => word && !SEARCH_STOP_WORDS.has(word));
}

function extractTaggedValue(value: string, tags: string[]) {
  const pattern = new RegExp(`\\b(?:${tags.join("|")})\\s*[:=-]?\\s+(.+?)(?=\\s+(?:artist|author|channel|by|from|in|near|around|after|before|since|today|yesterday|this|last|live|upcoming|completed)\\b|$)`, "i");
  const match = value.match(pattern);
  if (!match?.[1]) {
    return null;
  }

  return cleanupSearchValue(match[1]);
}

function extractLocation(value: string) {
  const match = value.match(/\b(?:in|near|around)\s+(.+?)(?=\s+(?:after|before|since|today|yesterday|this|last|live|upcoming|completed)\b|$)/i);
  if (!match?.[1]) {
    return null;
  }

  const location = cleanupSearchValue(match[1]);
  if (!location || /^(?:today|yesterday|this|last|\d{4})$/i.test(location)) {
    return null;
  }

  return location;
}

function parseUploadedWindow(input: string) {
  const now = new Date();

  if (/\btoday\b/i.test(input)) {
    return { uploadedAfter: startOfUtcDay(now) };
  }

  if (/\byesterday\b/i.test(input)) {
    const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    return {
      uploadedAfter: startOfUtcDay(yesterday),
      uploadedBefore: startOfUtcDay(now),
    };
  }

  if (/\bthis week\b/i.test(input)) {
    return { uploadedAfter: startOfUtcWeek(now) };
  }

  if (/\blast week\b/i.test(input)) {
    const startOfThisWeek = new Date(startOfUtcWeek(now));
    const startOfLastWeek = new Date(Date.UTC(
      startOfThisWeek.getUTCFullYear(),
      startOfThisWeek.getUTCMonth(),
      startOfThisWeek.getUTCDate() - 7
    ));
    return {
      uploadedAfter: startOfUtcDay(startOfLastWeek),
      uploadedBefore: startOfUtcDay(startOfThisWeek),
    };
  }

  if (/\bthis month\b/i.test(input)) {
    return { uploadedAfter: startOfUtcMonth(now) };
  }

  if (/\blast month\b/i.test(input)) {
    const startOfThisMonth = new Date(startOfUtcMonth(now));
    const startOfLastMonth = new Date(Date.UTC(
      startOfThisMonth.getUTCFullYear(),
      startOfThisMonth.getUTCMonth() - 1,
      1
    ));
    return {
      uploadedAfter: startOfUtcDay(startOfLastMonth),
      uploadedBefore: startOfUtcDay(startOfThisMonth),
    };
  }

  if (/\bthis year\b/i.test(input)) {
    return { uploadedAfter: startOfUtcYear(now) };
  }

  if (/\blast year\b/i.test(input)) {
    const startOfThisYear = new Date(startOfUtcYear(now));
    const startOfLastYear = new Date(Date.UTC(startOfThisYear.getUTCFullYear() - 1, 0, 1));
    return {
      uploadedAfter: startOfUtcDay(startOfLastYear),
      uploadedBefore: startOfUtcDay(startOfThisYear),
    };
  }

  const sinceMonth = input.match(/\b(?:since|after|from|in)\s+((?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?)\b/i);
  if (sinceMonth?.[1]) {
    const range = parseMonthYear(sinceMonth[1]);
    if (range) {
      if (/\bbefore\b/i.test(input)) {
        return { uploadedBefore: range.after };
      }

      if (/\bin\b/i.test(sinceMonth[0])) {
        return { uploadedAfter: range.after, uploadedBefore: range.before };
      }

      return { uploadedAfter: range.after };
    }
  }

  const beforeMonth = input.match(/\bbefore\s+((?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?)\b/i);
  if (beforeMonth?.[1]) {
    const range = parseMonthYear(beforeMonth[1]);
    if (range) {
      return { uploadedBefore: range.after };
    }
  }

  const sinceYear = input.match(/\b(?:since|after|from|in)\s+(20\d{2}|19\d{2})\b/i);
  if (sinceYear?.[1]) {
    const range = parseYearRange(sinceYear[1]);
    if (range) {
      if (/\bin\b/i.test(sinceYear[0])) {
        return { uploadedAfter: range.after, uploadedBefore: range.before };
      }

      return { uploadedAfter: range.after };
    }
  }

  const beforeYear = input.match(/\bbefore\s+(20\d{2}|19\d{2})\b/i);
  if (beforeYear?.[1]) {
    const range = parseYearRange(beforeYear[1]);
    if (range) {
      return { uploadedBefore: range.after };
    }
  }

  return {};
}

export function parseYouTubeSearchFilters(rawRequest: string, query: string, newest = false): YouTubeVideoSearchFilters {
  const cleanedRawRequest = cleanupSearchValue(rawRequest || query);
  const normalizedRequest = normalizeSearchText(cleanedRawRequest);
  const mediaHint = resolveMediaHint(normalizedRequest);
  const myVideos = /\b(?:my videos|my uploads|my subscriptions|watch later|liked videos)\b/i.test(normalizedRequest);
  const live = /\bupcoming\b/i.test(normalizedRequest)
    ? "upcoming"
    : /\bcompleted\b/i.test(normalizedRequest)
      ? "completed"
      : /\b(?:live|livestream|live stream)\b/i.test(normalizedRequest)
        ? "live"
        : undefined;

  let workingQuery = normalizeMediaSubjectQuery(query || cleanedRawRequest, mediaHint);

  const explicitArtist = extractTaggedValue(workingQuery, ["artist"]);
  if (explicitArtist) {
    workingQuery = cleanupSearchValue(workingQuery.replace(new RegExp(`\\bartist\\s*[:=-]?\\s+${explicitArtist.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`, "i"), " "));
  }

  const explicitAuthor = extractTaggedValue(workingQuery, ["author", "channel"]);
  if (explicitAuthor) {
    workingQuery = cleanupSearchValue(workingQuery.replace(new RegExp(`\\b(?:author|channel)\\s*[:=-]?\\s+${explicitAuthor.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`, "i"), " "));
  }

  const location = extractLocation(workingQuery) || extractLocation(cleanedRawRequest);
  if (location) {
    workingQuery = cleanupSearchValue(workingQuery.replace(new RegExp(`\\b(?:in|near|around)\\s+${location.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`, "i"), " "));
  }

  const uploadedWindow = parseUploadedWindow(`${cleanedRawRequest} ${workingQuery}`);

  const artist = explicitArtist || (
    newest &&
    !explicitAuthor &&
    !/\b(?:about|tutorial|review|reaction|analysis|episode|podcast|documentary|interview|highlights?)\b/i.test(workingQuery) &&
    tokenizeSearchTerms(workingQuery).length <= 5
      ? cleanupSearchValue(workingQuery)
      : undefined
  );

  const officialPreferred = Boolean(
    artist ||
    mediaHint === "movie" ||
    mediaHint === "film" ||
    mediaHint === "trailer" ||
    /\b(?:official|vevo|music video|artist channel)\b/i.test(cleanedRawRequest)
  );

  return {
    rawRequest: cleanedRawRequest,
    normalizedRequest,
    searchQuery: workingQuery || normalizeMediaSubjectQuery(query, mediaHint) || cleanedRawRequest,
    exactSearchPhrase: buildExactSearchPhrase(
      workingQuery || normalizeMediaSubjectQuery(query, mediaHint) || cleanedRawRequest,
      mediaHint,
    ),
    keywords: tokenizeSearchTerms(workingQuery || normalizeMediaSubjectQuery(query, mediaHint) || cleanedRawRequest),
    artist,
    author: explicitAuthor || undefined,
    location: location || undefined,
    live,
    myVideos,
    newest,
    uploadedAfter: uploadedWindow.uploadedAfter,
    uploadedBefore: uploadedWindow.uploadedBefore,
    officialPreferred,
    mediaHint,
    exactTitlePreferred:
      mediaHint === "movie" ||
      mediaHint === "film" ||
      mediaHint === "episode" ||
      mediaHint === "theme" ||
      mediaHint === "ost" ||
      mediaHint === "soundtrack" ||
      mediaHint === "opening" ||
      mediaHint === "ending" ||
      mediaHint === "remix" ||
      /\bfull\b/i.test(normalizedRequest),
  };
}

export function normalizeYouTubeAliasName(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(my|the)\b/g, " ")
    .replace(/\bplaylist\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseStoredYouTubePlaylistAliases(rawValue: string | null): YouTubePlaylistAlias[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is YouTubePlaylistAlias => {
      return Boolean(
        entry &&
        typeof entry.id === "string" &&
        typeof entry.name === "string" &&
        typeof entry.url === "string"
      );
    });
  } catch {
    return [];
  }
}

function extractYouTubePlaylistId(resourceUrl: string) {
  try {
    const url = new URL(resourceUrl);
    const directList = url.searchParams.get("list");
    if (directList) {
      return directList;
    }

    if (url.hostname.includes("youtu.be")) {
      return url.searchParams.get("list");
    }

    return null;
  } catch {
    return null;
  }
}

function extractYouTubeVideoId(resource: string) {
  if (!resource) {
    return null;
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(resource)) {
    return resource;
  }

  try {
    const url = new URL(resource);
    if (url.hostname.includes("youtu.be")) {
      const shortId = url.pathname.replace(/^\//, "").trim();
      return /^[a-zA-Z0-9_-]{11}$/.test(shortId) ? shortId : null;
    }

    const watchId = url.searchParams.get("v");
    if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) {
      return watchId;
    }

    const embedId = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    return embedId?.[1] || null;
  } catch {
    return null;
  }
}

export function buildYouTubeEmbedUrl(resource: string, autoPlay = true) {
  const playlistId = extractYouTubePlaylistId(resource);
  if (playlistId) {
    const params = new URLSearchParams({
      list: playlistId,
      autoplay: autoPlay ? "1" : "0",
      rel: "0",
    });

    return `https://www.youtube.com/embed/videoseries?${params.toString()}`;
  }

  const videoId = extractYouTubeVideoId(resource);
  if (!videoId) {
    return resource;
  }

  const params = new URLSearchParams({
    autoplay: autoPlay ? "1" : "0",
    rel: "0",
  });

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function normalizePlaybackIntentInput(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(?:you\s*tube|youtbe|yutube|youtuube|yt)\b/gi, "youtube")
    .trim();
}

function cleanupPlaybackSegment(value: string) {
  return value
    .replace(/^(?:hey|yo|okay|ok|please|uh|um)\s+/i, "")
    .replace(/^(?:hey\s+|yo\s+)?loco[,:\s-]*/i, "")
    .replace(/[,:\s-]+loco$/i, "")
    .trim();
}

function extractPlaybackCommand(text: string) {
  const normalized = normalizePlaybackIntentInput(text);
  if (!normalized) {
    return "";
  }

  const sentenceLikeSegments = normalized
    .split(/[.!?\n]+/)
    .map((segment) => cleanupPlaybackSegment(segment))
    .filter(Boolean);

  const candidates = [
    ...sentenceLikeSegments,
    cleanupPlaybackSegment(normalized),
  ];

  for (const candidate of candidates) {
    if (/^(?:play|show|find|put\s+on|open)\b/i.test(candidate)) {
      return candidate;
    }

    const commandMatch = candidate.match(/\b(?:play|show|find|put\s+on|open)\b[\s\S]*$/i);
    if (commandMatch?.[0]) {
      const extracted = commandMatch[0].trim();
      const prefix = candidate.slice(0, commandMatch.index || 0).trim();
      if (!prefix || /^(?:hey|yo|okay|ok|please|uh|um|loco|sir|assistant)$/i.test(prefix)) {
        return extracted;
      }
    }
  }

  return cleanupPlaybackSegment(normalized);
}

export function parseYouTubePlaybackIntent(text: string): YouTubePlaybackIntent | null {
  const normalized = extractPlaybackCommand(text);

  if (!/^(?:play|show|find|put\s+on|open)\b/i.test(normalized)) {
    return null;
  }

  const playlistMatch = normalized.match(/^(?:play|show|open)\s+(?:my\s+)?(.+?)\s+playlist(?:\s+on\s+youtube)?$/i);
  if (playlistMatch?.[1]) {
    return {
      kind: "playlist",
      aliasName: playlistMatch[1].trim(),
      rawRequest: text.trim(),
    };
  }

  const newestMatch = normalized.match(/^(?:play|show|find|put\s+on)\s+(?:me\s+)?(?:the\s+)?(?:newest|latest)\s+(.+?)\s+(?:song|track|video)(?:\s+on\s+youtube)?$/i);
  if (newestMatch?.[1]) {
    return {
      kind: "video-search",
      query: newestMatch[1].trim(),
      newest: true,
      rawRequest: text.trim(),
    };
  }

  const videoTopicMatch = normalized.match(/^(?:play|show|find)\s+(?:me\s+)?(?:some\s+)?videos?\s+(?:about|of|for)\s+(.+?)(?:\s+on\s+youtube)?$/i);
  if (videoTopicMatch?.[1]) {
    return {
      kind: "video-search",
      query: videoTopicMatch[1].trim(),
      newest: false,
      rawRequest: text.trim(),
    };
  }

  const prefixedMediaMatch = normalized.match(/^(?:play|show|find|put\s+on)\s+(?:me\s+)?(?:the\s+)?(song|track|video|movie|film|clip|trailer|episode|theme|ost|soundtrack|opening|ending|remix)\s+(.+?)(?:\s+on\s+youtube)?$/i);
  if (prefixedMediaMatch?.[1] && prefixedMediaMatch?.[2]) {
    return {
      kind: "video-search",
      query: prefixedMediaMatch[2].trim(),
      newest: false,
      rawRequest: text.trim(),
      mediaHint: prefixedMediaMatch[1].toLowerCase() as YouTubePlaybackIntent["mediaHint"],
    };
  }

  const explicitVideoMatch = normalized.match(/^(?:play|show|find|put\s+on)\s+(?:me\s+)?(.+?)\s+(song|track|video|movie|film|clip|trailer|episode|theme|ost|soundtrack|opening|ending|remix)(?:\s+on\s+youtube)?$/i);
  if (explicitVideoMatch?.[1]) {
    const rawMediaHint = explicitVideoMatch[2].toLowerCase();
    const normalizedMediaHint = rawMediaHint === "theme"
      || rawMediaHint === "ost"
      || rawMediaHint === "soundtrack"
      || rawMediaHint === "opening"
      || rawMediaHint === "ending"
      ? rawMediaHint
      : rawMediaHint;

    return {
      kind: "video-search",
      query: explicitVideoMatch[1].trim(),
      newest: false,
      rawRequest: text.trim(),
      mediaHint: normalizedMediaHint as YouTubePlaybackIntent["mediaHint"],
    };
  }

  const sourcedAudioMatch = normalized.match(/^(?:play|put\s+on)\s+(?:me\s+)?(.+?)\s+from\s+(.+?)(?:\s+on\s+youtube)?$/i);
  if (sourcedAudioMatch?.[1] && sourcedAudioMatch?.[2]) {
    return {
      kind: "video-search",
      query: `${sourcedAudioMatch[1].trim()} from ${sourcedAudioMatch[2].trim()}`,
      newest: false,
      rawRequest: text.trim(),
      mediaHint: "song",
    };
  }

  const youTubeQueryMatch = normalized.match(/^(?:play|show|find|put\s+on)\s+(?:me\s+)?(.+?)\s+on\s+youtube$/i);
  if (youTubeQueryMatch?.[1]) {
    return {
      kind: "video-search",
      query: youTubeQueryMatch[1].trim(),
      newest: false,
      rawRequest: text.trim(),
    };
  }

  const looseYouTubeQueryMatch = normalized.match(/^(?:play|show|find|put\s+on)\s+(?:me\s+)?(.+?)\s+youtube$/i);
  if (looseYouTubeQueryMatch?.[1]) {
    return {
      kind: "video-search",
      query: looseYouTubeQueryMatch[1].trim(),
      newest: false,
      rawRequest: text.trim(),
    };
  }

  const genericPlayMatch = normalized.match(/^(?:play|put\s+on)\s+(?:me\s+)?(.+?)$/i);
  if (genericPlayMatch?.[1]) {
    return {
      kind: "video-search",
      query: genericPlayMatch[1].trim(),
      newest: false,
      rawRequest: text.trim(),
      mediaHint: "song",
    };
  }

  return null;
}