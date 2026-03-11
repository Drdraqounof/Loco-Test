export interface SoundCloudPlaylistAlias {
  id: string;
  name: string;
  url: string;
}

export interface SoundCloudPlaybackIntent {
  kind: "playlist" | "track-search";
  aliasName?: string;
  query?: string;
  newest?: boolean;
}

export const SOUNDCLOUD_PLAYLIST_STORAGE_KEY = "soundcloudPlaylistAliases";

export function normalizeSoundCloudAliasName(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(my|the)\b/g, " ")
    .replace(/\bplaylist\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseStoredSoundCloudPlaylistAliases(rawValue: string | null): SoundCloudPlaylistAlias[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is SoundCloudPlaylistAlias => {
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

export function buildSoundCloudEmbedUrl(resourceUrl: string, autoPlay = true) {
  const params = new URLSearchParams({
    url: resourceUrl,
    auto_play: autoPlay ? "true" : "false",
    buying: "false",
    sharing: "false",
    download: "false",
    show_artwork: "true",
    hide_related: "false",
    show_comments: "false",
    show_user: "true",
    show_reposts: "false",
    visual: "false",
  });

  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

export function parseSoundCloudPlaybackIntent(text: string): SoundCloudPlaybackIntent | null {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!/^play\b/i.test(normalized)) {
    return null;
  }

  const playlistMatch = normalized.match(/^play\s+(?:my\s+)?(.+?)\s+playlist(?:\s+on\s+soundcloud)?$/i);
  if (playlistMatch?.[1]) {
    return {
      kind: "playlist",
      aliasName: playlistMatch[1].trim(),
    };
  }

  const newestMatch = normalized.match(/^play\s+(?:the\s+)?(?:newest|latest)\s+(.+?)\s+(?:song|track)(?:\s+on\s+soundcloud)?$/i);
  if (newestMatch?.[1]) {
    return {
      kind: "track-search",
      query: newestMatch[1].trim(),
      newest: true,
    };
  }

  const explicitTrackMatch = normalized.match(/^play\s+(.+?)\s+(?:song|track)(?:\s+on\s+soundcloud)?$/i);
  if (explicitTrackMatch?.[1]) {
    return {
      kind: "track-search",
      query: explicitTrackMatch[1].trim(),
      newest: false,
    };
  }

  const soundCloudQueryMatch = normalized.match(/^play\s+(.+?)\s+on\s+soundcloud$/i);
  if (soundCloudQueryMatch?.[1]) {
    return {
      kind: "track-search",
      query: soundCloudQueryMatch[1].trim(),
      newest: false,
    };
  }

  return null;
}