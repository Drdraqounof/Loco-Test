import { NextRequest, NextResponse } from "next/server";

// In plain terms: this route handles YouTube search and playback-related requests.

import { parseYouTubeSearchFilters, type YouTubeVideoSearchFilters } from "@/lib/youtube";
import {
  deleteYouTubeConnection,
  getAuthorizedYouTubeClient,
  getStoredYouTubeConnection,
  getYouTubeOAuthConfig,
} from "@/lib/youtubeOAuth";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

interface YouTubeSearchItem {
  id?: {
    videoId?: string | null;
  };
  snippet?: {
    title?: string | null;
    channelTitle?: string | null;
    description?: string | null;
    publishedAt?: string | null;
    liveBroadcastContent?: string | null;
  };
  statistics?: {
    viewCount?: string | null;
  };
}

interface YouTubePlaylistItem {
  contentDetails?: {
    videoId?: string | null;
    videoPublishedAt?: string | null;
  };
  snippet?: {
    title?: string | null;
    videoOwnerChannelTitle?: string | null;
    channelTitle?: string | null;
    description?: string | null;
    publishedAt?: string | null;
  };
}

interface ScoredVideoCandidate {
  candidate: YouTubeSearchItem;
  score: number;
}

interface ClarificationOption {
  key: "ost" | "remix";
  label: "OST" | "Remix";
  video: {
    id: string;
    title: string;
    url: string;
    channel: string;
    publishedAt: string | null;
    viewCount: number;
  };
}

interface AuthorizedPlaylistResult {
  id: string;
  title: string;
  url: string;
  channel: string;
  itemCount: number;
}

const NOISE_TERMS = [
  "reaction",
  "reacts",
  "review",
  "recap",
  "analysis",
  "quiz",
  "cover",
  "karaoke",
  "instrumental",
  "slowed",
  "sped up",
  "speed up",
  "fanmade",
  "fan made",
  "parody",
  "mashup",
  "tribute",
  "edit",
  "edits",
  "amv",
  "vs",
  "versus",
  "fight",
  "scene",
];

const OFFICIAL_TERMS = ["official", "vevo", "artist", "topic"];
const MOVIE_TERMS = ["movie", "film", "full movie", "official trailer", "trailer", "theaters", "cinema"];
const THEME_TERMS = ["theme", "ost", "soundtrack", "opening", "ending", "op", "ed", "bgm"];
const THEME_NOISE_TERMS = ["tutorial", "piano tutorial", "guitar tutorial", "lesson", "how to play", "sheet", "tabs", "synthesia", "cover", "piano"];
const THEME_CLIP_NOISE_TERMS = ["plays for the first time", "first time", "scene", "moment", "episode", "clip", "shorts", "short", "explained", "breakdown", "reaction"];
const REMIX_TERMS = ["remix", "mix", "edit audio", "nightcore", "bootleg"];

function isOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && (process.env.YOUTUBE_REDIRECT_URI || process.env.APP_URL));
}

function normalizeLibraryText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPersonalLibraryKind(rawRequest: string) {
  const normalized = normalizeLibraryText(rawRequest);

  if (/\bwatch later\b/.test(normalized)) {
    return "watch-later" as const;
  }
  if (/\bliked videos\b/.test(normalized)) {
    return "liked" as const;
  }
  if (/\bmy uploads\b|\bmy videos\b/.test(normalized)) {
    return "uploads" as const;
  }
  if (/\bmy subscriptions\b/.test(normalized)) {
    return "subscriptions" as const;
  }

  return null;
}

function extractPersonalLibrarySearchQuery(rawRequest: string) {
  return rawRequest
    .replace(/^(?:hey\s+)?loco[,:\s-]*/i, "")
    .replace(/^(?:play|show|find|put\s+on|open)\s+(?:me\s+)?(?:the\s+)?/i, "")
    .replace(/\b(?:my uploads|my videos|liked videos|watch later|my subscriptions)\b/gi, " ")
    .replace(/\bon\s+youtube\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toPlaylistVideoItem(item: YouTubePlaylistItem): YouTubeSearchItem | null {
  const videoId = item?.contentDetails?.videoId;
  const title = item?.snippet?.title;

  if (!videoId || !title || title === "Deleted video" || title === "Private video") {
    return null;
  }

  return {
    id: {
      videoId,
    },
    snippet: {
      title,
      channelTitle: item?.snippet?.videoOwnerChannelTitle || item?.snippet?.channelTitle || "YouTube",
      description: item?.snippet?.description || "",
      publishedAt: item?.contentDetails?.videoPublishedAt || item?.snippet?.publishedAt || undefined,
    },
  };
}

async function getAuthorizedPlaylistId(rawRequest: string, youtube: NonNullable<Awaited<ReturnType<typeof getAuthorizedYouTubeClient>>>["youtube"]) {
  const channelResponse = await youtube.channels.list({
    mine: true,
    part: ["contentDetails"],
    maxResults: 1,
  });

  const relatedPlaylists = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists;
  const kind = getPersonalLibraryKind(rawRequest);

  if (kind === "uploads") {
    return relatedPlaylists?.uploads || null;
  }

  if (kind === "liked") {
    return relatedPlaylists?.likes || null;
  }

  if (kind === "watch-later") {
    return relatedPlaylists?.watchLater || null;
  }

  if (kind === "subscriptions") {
    return "subscriptions" as const;
  }

  return null;
}

async function getAuthorizedPersonalVideo(rawRequest: string, newest: boolean, youtube: NonNullable<Awaited<ReturnType<typeof getAuthorizedYouTubeClient>>>["youtube"]) {
  const playlistId = await getAuthorizedPlaylistId(rawRequest, youtube);

  if (playlistId === "subscriptions") {
    return {
      error: "Signed-in subscription playback is not implemented yet. Try liked videos, watch later, uploads, or one of your playlists.",
      status: 400,
    };
  }

  if (!playlistId) {
    return {
      error: "I could not access that personal YouTube library yet. Sign in again, or try liked videos, watch later, uploads, or one of your playlists.",
      status: 404,
    };
  }

  const response = await youtube.playlistItems.list({
    playlistId,
    part: ["snippet", "contentDetails"],
    maxResults: 50,
  });

  const playlistItems = (response.data.items || [])
    .map((item) => toPlaylistVideoItem(item))
    .filter((item): item is YouTubeSearchItem => Boolean(item));

  if (playlistItems.length === 0) {
    return {
      error: "That personal YouTube library is empty or unavailable right now.",
      status: 404,
    };
  }

  const narrowedQuery = extractPersonalLibrarySearchQuery(rawRequest);
  const filters = narrowedQuery
    ? parseYouTubeSearchFilters(rawRequest, narrowedQuery, newest)
    : null;

  const video = filters ? selectVideo(playlistItems, filters) : playlistItems[0];

  if (!video?.id?.videoId) {
    return {
      error: narrowedQuery
        ? `I could not find a matching saved YouTube item for "${narrowedQuery}" in your signed-in library.`
        : "I could not find a playable video in that signed-in YouTube library.",
      status: 404,
    };
  }

  return {
    video: toVideoResponse(video),
    status: 200,
  };
}

async function findAuthorizedPlaylist(query: string, youtube: NonNullable<Awaited<ReturnType<typeof getAuthorizedYouTubeClient>>>["youtube"]): Promise<AuthorizedPlaylistResult | null> {
  const response = await youtube.playlists.list({
    mine: true,
    part: ["snippet", "contentDetails"],
    maxResults: 50,
  });

  const normalizedQuery = normalizeLibraryText(query);
  const playlists = (response.data.items || []).filter((playlist) => Boolean(playlist.id && playlist.snippet?.title));

  if (playlists.length === 0) {
    return null;
  }

  const rankedPlaylists = playlists
    .map((playlist) => {
      const title = normalizeLibraryText(playlist.snippet?.title || "");
      let score = 0;

      if (title === normalizedQuery) {
        score += 100;
      } else if (title.includes(normalizedQuery)) {
        score += 50;
      }

      for (const token of normalizedQuery.split(" ").filter(Boolean)) {
        if (title.includes(token)) {
          score += 8;
        }
      }

      return {
        playlist,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const match = rankedPlaylists[0]?.playlist;
  if (!match?.id || !match.snippet?.title) {
    return null;
  }

  return {
    id: match.id,
    title: match.snippet.title,
    url: `https://www.youtube.com/playlist?list=${match.id}`,
    channel: match.snippet.channelTitle || "YouTube",
    itemCount: Number(match.contentDetails?.itemCount || 0),
  };
}

function isMusicLikeRequest(filters: YouTubeVideoSearchFilters) {
  return Boolean(
    filters.mediaHint === "song" ||
    filters.mediaHint === "track" ||
    filters.mediaHint === "theme" ||
    filters.mediaHint === "ost" ||
    filters.mediaHint === "soundtrack" ||
    filters.mediaHint === "opening" ||
    filters.mediaHint === "ending" ||
    filters.mediaHint === "remix"
  );
}

function getViewCount(candidate: YouTubeSearchItem) {
  const rawValue = candidate.statistics?.viewCount;
  const parsedValue = rawValue ? Number(rawValue) : 0;
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function scoreViewCount(viewCount: number) {
  if (viewCount >= 10_000_000) {
    return 20;
  }
  if (viewCount >= 1_000_000) {
    return 14;
  }
  if (viewCount >= 100_000) {
    return 8;
  }
  if (viewCount >= 10_000) {
    return 4;
  }
  return 0;
}

function toVideoResponse(candidate: YouTubeSearchItem) {
  return {
    id: candidate.id?.videoId || "",
    title: candidate.snippet?.title || "Unknown title",
    url: candidate.id?.videoId ? `https://www.youtube.com/watch?v=${candidate.id.videoId}` : "",
    channel: candidate.snippet?.channelTitle || "Unknown channel",
    publishedAt: candidate.snippet?.publishedAt || null,
    viewCount: getViewCount(candidate),
  };
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesPhrase(haystack: string, needle: string | undefined) {
  if (!needle) {
    return false;
  }

  return haystack.includes(normalizeText(needle));
}

function getExactPhraseVariants(filters: YouTubeVideoSearchFilters) {
  const basePhrase = normalizeText(filters.exactSearchPhrase || "");
  if (!basePhrase) {
    return [];
  }

  if (
    filters.mediaHint === "theme" ||
    filters.mediaHint === "ost" ||
    filters.mediaHint === "soundtrack" ||
    filters.mediaHint === "opening" ||
    filters.mediaHint === "ending"
  ) {
    const subject = normalizeText(filters.searchQuery);
    return Array.from(new Set([
      `${subject} theme`.trim(),
      `${subject} ost`.trim(),
      `${subject} soundtrack`.trim(),
      `${subject} opening`.trim(),
      `${subject} ending`.trim(),
      basePhrase,
    ].filter(Boolean)));
  }

  return [basePhrase];
}

function getBestPhraseMatchCount(haystack: string, filters: YouTubeVideoSearchFilters) {
  const variants = getExactPhraseVariants(filters);
  const normalizedHaystack = normalizeText(haystack);

  return variants.reduce((best, phrase) => {
    if (normalizedHaystack.includes(phrase)) {
      return Math.max(best, phrase.split(" ").filter(Boolean).length);
    }

    return Math.max(best, getOrderedTokenMatchCount(normalizedHaystack, phrase));
  }, 0);
}

function getOrderedTokenMatchCount(haystack: string, needle: string) {
  const haystackWords = normalizeText(haystack).split(" ").filter(Boolean);
  const needleWords = normalizeText(needle).split(" ").filter(Boolean);

  if (needleWords.length === 0 || haystackWords.length === 0) {
    return 0;
  }

  let matchedCount = 0;
  let haystackIndex = 0;

  for (const word of needleWords) {
    while (haystackIndex < haystackWords.length && haystackWords[haystackIndex] !== word) {
      haystackIndex += 1;
    }

    if (haystackIndex >= haystackWords.length) {
      break;
    }

    matchedCount += 1;
    haystackIndex += 1;
  }

  return matchedCount;
}

function scoreRecency(publishedAt: string | null | undefined) {
  if (!publishedAt) {
    return 0;
  }

  const publishedMs = new Date(publishedAt).getTime();
  if (!Number.isFinite(publishedMs)) {
    return 0;
  }

  const ageDays = Math.max(0, (Date.now() - publishedMs) / (1000 * 60 * 60 * 24));
  if (ageDays <= 7) {
    return 36;
  }

  if (ageDays <= 30) {
    return 28;
  }

  if (ageDays <= 90) {
    return 18;
  }

  if (ageDays <= 365) {
    return 10;
  }

  return 2;
}

function scoreVideo(candidate: YouTubeSearchItem, filters: YouTubeVideoSearchFilters) {
  const title = normalizeText(candidate.snippet?.title);
  const channel = normalizeText(candidate.snippet?.channelTitle);
  const description = normalizeText(candidate.snippet?.description);
  const combined = `${title} ${channel} ${description}`.trim();

  let score = 0;

  for (const keyword of filters.keywords) {
    if (title.includes(keyword)) {
      score += 9;
    } else if (combined.includes(keyword)) {
      score += 4;
    } else {
      score -= 6;
    }
  }

  if (filters.artist) {
    if (includesPhrase(channel, filters.artist)) {
      score += 42;
    }
    if (includesPhrase(title, filters.artist)) {
      score += 20;
    }
    if (!includesPhrase(channel, filters.artist) && !includesPhrase(title, filters.artist)) {
      score -= 30;
    }
  }

  if (filters.author) {
    if (includesPhrase(channel, filters.author)) {
      score += 55;
    } else {
      score -= 28;
    }
  }

  if (filters.location) {
    if (includesPhrase(combined, filters.location)) {
      score += 12;
    } else {
      score -= 6;
    }
  }

  const liveState = candidate.snippet?.liveBroadcastContent;
  if (filters.live) {
    if (liveState === filters.live) {
      score += 38;
    } else {
      score -= 20;
    }
  } else if (liveState === "live") {
    score -= 10;
  }

  if (filters.officialPreferred) {
    const hasOfficialSignal = OFFICIAL_TERMS.some((term) => combined.includes(term));
    score += hasOfficialSignal ? 18 : -8;
  }

  if (filters.exactTitlePreferred && filters.searchQuery) {
    const normalizedQuery = normalizeText(filters.searchQuery);
    const orderedMatchCount = getOrderedTokenMatchCount(title, normalizedQuery);
    const expectedTokenCount = normalizedQuery.split(" ").filter(Boolean).length;
    const bestPhraseMatchCount = getBestPhraseMatchCount(title, filters);
    const expectedPhraseTokenCount = Math.max(...getExactPhraseVariants(filters).map((phrase) => phrase.split(" ").filter(Boolean).length), 0);

    if (title.includes(normalizedQuery)) {
      score += 24;
    } else if (combined.includes(normalizedQuery)) {
      score += 10;
    } else {
      score -= 14;
    }

    if (expectedTokenCount > 0) {
      if (orderedMatchCount === expectedTokenCount) {
        score += 18;
      } else if (orderedMatchCount >= Math.max(1, expectedTokenCount - 1)) {
        score += 6;
      } else {
        score -= 16;
      }
    }

    if (expectedPhraseTokenCount > 0) {
      if (bestPhraseMatchCount === expectedPhraseTokenCount) {
        score += 28;
      } else if (bestPhraseMatchCount >= Math.max(1, expectedPhraseTokenCount - 1)) {
        score += 8;
      } else {
        score -= 24;
      }
    }
  }

  if (filters.mediaHint === "movie" || filters.mediaHint === "film") {
    const hasMovieSignal = MOVIE_TERMS.some((term) => combined.includes(term));
    score += hasMovieSignal ? 22 : -12;

    if (title.includes("trailer") && OFFICIAL_TERMS.some((term) => combined.includes(term))) {
      score += 10;
    }
  }

  if (filters.mediaHint === "trailer") {
    if (title.includes("trailer")) {
      score += 26;
    } else {
      score -= 12;
    }
  }

  if (filters.mediaHint === "clip") {
    if (title.includes("clip")) {
      score += 10;
    }
  }

  if (
    filters.mediaHint === "theme" ||
    filters.mediaHint === "ost" ||
    filters.mediaHint === "soundtrack" ||
    filters.mediaHint === "opening" ||
    filters.mediaHint === "ending"
  ) {
    const hasThemeSignal = THEME_TERMS.some((term) => combined.includes(term));
    const hasThemeNoise = THEME_NOISE_TERMS.some((term) => combined.includes(term));
    const hasThemeClipNoise = THEME_CLIP_NOISE_TERMS.some((term) => combined.includes(term));
    score += hasThemeSignal ? 22 : -16;

    if (title.includes("cover") || title.includes("edit") || title.includes("amv")) {
      score -= 18;
    }

    if (hasThemeNoise) {
      score -= 26;
    }

    if (hasThemeClipNoise) {
      score -= 30;
    }
  }

  if (filters.mediaHint === "remix") {
    const hasRemixSignal = REMIX_TERMS.some((term) => combined.includes(term));
    score += hasRemixSignal ? 18 : -12;
  }

  if (isMusicLikeRequest(filters)) {
    score += scoreViewCount(getViewCount(candidate));
  }

  for (const term of NOISE_TERMS) {
    if (combined.includes(term)) {
      score -= 24;
    }
  }

  if (filters.newest) {
    score += scoreRecency(candidate.snippet?.publishedAt);
  }

  return score;
}

function classifyMusicVariant(candidate: YouTubeSearchItem) {
  const title = normalizeText(candidate.snippet?.title);
  const description = normalizeText(candidate.snippet?.description);
  const channel = normalizeText(candidate.snippet?.channelTitle);
  const combined = `${title} ${channel} ${description}`.trim();

  if (REMIX_TERMS.some((term) => combined.includes(term))) {
    return "remix" as const;
  }

  if (THEME_TERMS.some((term) => combined.includes(term))) {
    return "ost" as const;
  }

  return null;
}

function isStrongMovieMatch(candidate: YouTubeSearchItem, filters: YouTubeVideoSearchFilters) {
  if (!(filters.mediaHint === "movie" || filters.mediaHint === "film")) {
    return true;
  }

  const title = normalizeText(candidate.snippet?.title);
  const channel = normalizeText(candidate.snippet?.channelTitle);
  const description = normalizeText(candidate.snippet?.description);
  const combined = `${title} ${channel} ${description}`.trim();
  const normalizedQuery = normalizeText(filters.searchQuery);
  const expectedTokenCount = normalizedQuery.split(" ").filter(Boolean).length;
  const orderedMatchCount = getOrderedTokenMatchCount(title, normalizedQuery);
  const hasMovieSignal = MOVIE_TERMS.some((term) => combined.includes(term));
  const hasOfficialSignal = OFFICIAL_TERMS.some((term) => combined.includes(term));
  const hasNoisySignal = NOISE_TERMS.some((term) => combined.includes(term));

  if (hasNoisySignal) {
    return false;
  }

  if (title.includes(normalizedQuery) && (hasMovieSignal || hasOfficialSignal)) {
    return true;
  }

  if (expectedTokenCount > 0 && orderedMatchCount === expectedTokenCount && (hasMovieSignal || hasOfficialSignal)) {
    return true;
  }

  return false;
}

function isStrongThemeMatch(candidate: YouTubeSearchItem, filters: YouTubeVideoSearchFilters) {
  if (!(
    filters.mediaHint === "theme" ||
    filters.mediaHint === "ost" ||
    filters.mediaHint === "soundtrack" ||
    filters.mediaHint === "opening" ||
    filters.mediaHint === "ending"
  )) {
    return true;
  }

  const title = normalizeText(candidate.snippet?.title);
  const description = normalizeText(candidate.snippet?.description);
  const channel = normalizeText(candidate.snippet?.channelTitle);
  const combined = `${title} ${channel} ${description}`.trim();
  const expectedTokenCount = Math.max(...getExactPhraseVariants(filters).map((phrase) => phrase.split(" ").filter(Boolean).length), 0);
  const orderedMatchCount = getBestPhraseMatchCount(title, filters);
  const hasThemeSignal = THEME_TERMS.some((term) => combined.includes(term));
  const hasNoisySignal = NOISE_TERMS.some((term) => combined.includes(term));
  const hasThemeNoise = THEME_NOISE_TERMS.some((term) => combined.includes(term));
  const hasThemeClipNoise = THEME_CLIP_NOISE_TERMS.some((term) => combined.includes(term));

  if (hasNoisySignal || hasThemeNoise || hasThemeClipNoise || !hasThemeSignal) {
    return false;
  }

  if (getExactPhraseVariants(filters).some((phrase) => title.includes(phrase))) {
    return true;
  }

  if (expectedTokenCount > 0 && orderedMatchCount >= Math.max(1, expectedTokenCount - 1)) {
    return true;
  }

  return false;
}

function buildSearchQuery(filters: YouTubeVideoSearchFilters) {
  const parts = [filters.searchQuery];

  if (filters.exactSearchPhrase) {
    parts.unshift(`"${filters.exactSearchPhrase}"`);
  }

  if (filters.exactTitlePreferred) {
    parts.push(`"${filters.searchQuery}"`);
  }

  if (filters.artist && !includesPhrase(normalizeText(filters.searchQuery), filters.artist)) {
    parts.push(`"${filters.artist}"`);
  }

  if (filters.author && !includesPhrase(normalizeText(filters.searchQuery), filters.author)) {
    parts.push(`"${filters.author}"`);
  }

  if (filters.location && !includesPhrase(normalizeText(filters.searchQuery), filters.location)) {
    parts.push(`"${filters.location}"`);
  }

  if (filters.officialPreferred) {
    parts.push("official");
  }

  if (filters.mediaHint === "movie" || filters.mediaHint === "film") {
    parts.push("movie");
  }

  if (filters.mediaHint === "trailer") {
    parts.push("trailer");
  }

  if (
    filters.mediaHint === "theme" ||
    filters.mediaHint === "ost" ||
    filters.mediaHint === "soundtrack" ||
    filters.mediaHint === "opening" ||
    filters.mediaHint === "ending"
  ) {
    parts.push(filters.mediaHint);
    if (filters.mediaHint === "theme") {
      parts.push("ost");
    }
  }

  if (filters.mediaHint === "remix") {
    parts.push("remix");
  }

  if (filters.live) {
    parts.push("live");
  }

  return parts.filter(Boolean).join(" ").trim();
}

function rankCandidates(candidates: YouTubeSearchItem[], filters: YouTubeVideoSearchFilters) {
  return [...candidates]
    .map((candidate) => ({
      candidate,
      score: scoreVideo(candidate, filters),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftViews = getViewCount(left.candidate);
      const rightViews = getViewCount(right.candidate);
      if (rightViews !== leftViews) {
        return rightViews - leftViews;
      }

      const leftTime = left.candidate.snippet?.publishedAt ? new Date(left.candidate.snippet.publishedAt).getTime() : 0;
      const rightTime = right.candidate.snippet?.publishedAt ? new Date(right.candidate.snippet.publishedAt).getTime() : 0;
      return rightTime - leftTime;
    });
}

function getClarificationOptions(rankedCandidates: ScoredVideoCandidate[], filters: YouTubeVideoSearchFilters) {
  if (!(filters.mediaHint === "song" || filters.mediaHint === "track")) {
    return null;
  }

  const ostMatch = rankedCandidates.find(({ candidate, score }) => {
    return score >= 20 && classifyMusicVariant(candidate) === "ost" && isStrongThemeMatch(candidate, { ...filters, mediaHint: "ost" });
  });

  const remixMatch = rankedCandidates.find(({ candidate, score }) => {
    return score >= 20 && classifyMusicVariant(candidate) === "remix";
  });

  if (!ostMatch || !remixMatch) {
    return null;
  }

  const ostVideoId = ostMatch.candidate.id?.videoId;
  const remixVideoId = remixMatch.candidate.id?.videoId;
  if (!ostVideoId || !remixVideoId || ostVideoId === remixVideoId) {
    return null;
  }

  return [
    {
      key: "ost",
      label: "OST",
      video: toVideoResponse(ostMatch.candidate),
    },
    {
      key: "remix",
      label: "Remix",
      video: toVideoResponse(remixMatch.candidate),
    },
  ] satisfies ClarificationOption[];
}

function selectVideo(candidates: YouTubeSearchItem[], filters: YouTubeVideoSearchFilters) {
  const usable = candidates.filter((candidate) => Boolean(candidate?.id?.videoId && candidate?.snippet?.title));

  if (usable.length === 0) {
    return null;
  }

  const rankedCandidates = rankCandidates(usable, filters);

  const bestMatch = rankedCandidates[0];
  if (!bestMatch) {
    return null;
  }

  if ((filters.mediaHint === "movie" || filters.mediaHint === "film") && !isStrongMovieMatch(bestMatch.candidate, filters)) {
    return null;
  }

  if (!isStrongThemeMatch(bestMatch.candidate, filters)) {
    return null;
  }

  if (filters.exactTitlePreferred && bestMatch.score < 20) {
    return null;
  }

  return bestMatch.candidate;
}

async function hydrateVideoStatistics(items: YouTubeSearchItem[]) {
  const ids = items
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return items;
  }

  const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  statsUrl.searchParams.set("part", "statistics");
  statsUrl.searchParams.set("id", ids.join(","));
  statsUrl.searchParams.set("key", YOUTUBE_API_KEY || "");
  statsUrl.searchParams.set("maxResults", String(ids.length));

  const response = await fetch(statsUrl.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return items;
  }

  const data = await response.json();
  const statsById = new Map<string, { viewCount?: string }>();
  const statItems = Array.isArray(data?.items) ? data.items : [];
  for (const item of statItems) {
    const id = typeof item?.id === "string" ? item.id : null;
    if (id) {
      statsById.set(id, item.statistics || {});
    }
  }

  return items.map((item) => {
    const videoId = item.id?.videoId;
    if (!videoId) {
      return item;
    }

    return {
      ...item,
      statistics: statsById.get(videoId),
    };
  });
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");

  if (!mode) {
    const oauthConfigured = isOAuthConfigured();
    let redirectUri: string | null = null;
    let connection = null;
    let storageReady = true;

    try {
      redirectUri = getYouTubeOAuthConfig().redirectUri;
    } catch {
      redirectUri = null;
    }

    if (oauthConfigured) {
      try {
        connection = await getStoredYouTubeConnection();
      } catch (error) {
        console.error("YouTube connection status error:", error);
        storageReady = false;
      }
    }

    return NextResponse.json({
      configured: Boolean(YOUTUBE_API_KEY),
      oauthConfigured,
      storageReady,
      connected: Boolean(connection),
      email: connection?.email ?? null,
      channelTitle: connection?.channelTitle ?? null,
      redirectUri,
    });
  }

  if (mode !== "video" && mode !== "playlist") {
    return NextResponse.json({ error: "Unsupported YouTube mode." }, { status: 400 });
  }

  const query = request.nextUrl.searchParams.get("query")?.trim();
  const rawRequest = request.nextUrl.searchParams.get("rawRequest")?.trim() || query || "";
  const newest = request.nextUrl.searchParams.get("newest") === "true";

  if (!query) {
    return NextResponse.json({ error: mode === "playlist" ? "Playlist query is required." : "Video query is required." }, { status: 400 });
  }

  if (mode === "playlist") {
    if (!isOAuthConfigured()) {
      return NextResponse.json(
        {
          error: "YouTube sign-in is not configured yet. Add Google OAuth variables first.",
        },
        { status: 400 }
      );
    }

    const authorizedClient = await getAuthorizedYouTubeClient(request.nextUrl.origin);
    if (!authorizedClient) {
      return NextResponse.json(
        {
          error: "Sign in with YouTube first, then ask me to play one of your playlists.",
        },
        { status: 400 }
      );
    }

    try {
      const playlist = await findAuthorizedPlaylist(query, authorizedClient.youtube);

      if (!playlist) {
        return NextResponse.json({ error: `I could not find a signed-in YouTube playlist named "${query}".` }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        playlist,
      });
    } catch (error) {
      console.error("Authorized YouTube playlist lookup error:", error);
      return NextResponse.json({ error: "I could not reach your signed-in YouTube playlists right now." }, { status: 502 });
    }
  }

  if (!YOUTUBE_API_KEY && !isOAuthConfigured()) {
    return NextResponse.json(
      {
        error: "YouTube is not configured yet. Add YOUTUBE_API_KEY for public search or Google OAuth variables for personal YouTube access.",
      },
      { status: 400 }
    );
  }

  const filters = parseYouTubeSearchFilters(rawRequest, query, newest);

  if (filters.myVideos) {
    if (!isOAuthConfigured()) {
      return NextResponse.json(
        {
          error: "Personal YouTube library requests need YouTube sign-in to be configured first. Add Google OAuth variables, then connect your account in Settings.",
        },
        { status: 400 }
      );
    }

    const authorizedClient = await getAuthorizedYouTubeClient(request.nextUrl.origin);
    if (!authorizedClient) {
      return NextResponse.json(
        {
          error: "Personal YouTube library requests need a signed-in YouTube account connection. Connect YouTube in Settings first.",
        },
        { status: 400 }
      );
    }

    try {
      const personalResult = await getAuthorizedPersonalVideo(rawRequest, newest, authorizedClient.youtube);

      if (!personalResult.video) {
        return NextResponse.json({ error: personalResult.error }, { status: personalResult.status });
      }

      return NextResponse.json({
        success: true,
        video: personalResult.video,
      });
    } catch (error) {
      console.error("Authorized YouTube personal library error:", error);
      return NextResponse.json({ error: "I could not reach your signed-in YouTube library right now." }, { status: 502 });
    }
  }

  if (!YOUTUBE_API_KEY) {
    return NextResponse.json(
      {
        error: "Public YouTube search is not configured yet. Add YOUTUBE_API_KEY to your environment.",
      },
      { status: 400 }
    );
  }

  const apiUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  apiUrl.searchParams.set("part", "snippet");
  apiUrl.searchParams.set("q", buildSearchQuery(filters));
  apiUrl.searchParams.set("key", YOUTUBE_API_KEY);
  apiUrl.searchParams.set("type", "video");
  apiUrl.searchParams.set("videoEmbeddable", "true");
  apiUrl.searchParams.set("maxResults", "25");
  apiUrl.searchParams.set("safeSearch", "moderate");
  if (isMusicLikeRequest(filters)) {
    apiUrl.searchParams.set("videoCategoryId", "10");
  }
  if (filters.uploadedAfter) {
    apiUrl.searchParams.set("publishedAfter", filters.uploadedAfter);
  }
  if (filters.uploadedBefore) {
    apiUrl.searchParams.set("publishedBefore", filters.uploadedBefore);
  }
  if (filters.live) {
    apiUrl.searchParams.set("eventType", filters.live);
  }
  if (newest || filters.live) {
    apiUrl.searchParams.set("order", "date");
  }

  try {
    const response = await fetch(apiUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `YouTube search failed: ${response.status} ${text}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawItems = Array.isArray(data?.items) ? (data.items as YouTubeSearchItem[]) : [];
    const items = await hydrateVideoStatistics(rawItems);
    const clarificationOptions = getClarificationOptions(rankCandidates(items.filter((item) => Boolean(item?.id?.videoId && item?.snippet?.title)), filters), filters);

    if (clarificationOptions) {
      return NextResponse.json({
        success: false,
        needsClarification: true,
        clarification: {
          prompt: `I found multiple strong matches for "${query}", sir. Do you want the OST or the remix?`,
          options: clarificationOptions,
        },
      });
    }

    const video = selectVideo(items, filters);

    if (!video?.id?.videoId || !video.snippet?.title) {
      const message = filters.mediaHint === "movie" || filters.mediaHint === "film"
        ? `I could not find a reliable public movie or trailer match for "${query}" on YouTube.`
        : filters.mediaHint === "theme" || filters.mediaHint === "ost" || filters.mediaHint === "soundtrack" || filters.mediaHint === "opening" || filters.mediaHint === "ending"
          ? `I could not find a reliable theme or soundtrack match for "${query}" on YouTube.`
          : `No YouTube videos matched "${query}".`;

      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      video: toVideoResponse(video),
    });
  } catch (error) {
    console.error("YouTube API error:", error);
    return NextResponse.json({ error: "Unable to reach YouTube right now." }, { status: 502 });
  }
}

export async function DELETE() {
  try {
    await deleteYouTubeConnection();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("YouTube disconnect error:", error);
    return NextResponse.json({ success: false, error: "Could not disconnect YouTube right now." }, { status: 500 });
  }
}