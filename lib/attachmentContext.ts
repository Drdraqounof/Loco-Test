export type AttachmentKind = "file" | "folder";
export type AttachmentCategory = "code" | "text" | "audio" | "image" | "video" | "document" | "binary" | "folder";

export interface AttachmentContextItem {
  id: string;
  name: string;
  kind: AttachmentKind;
  category: AttachmentCategory;
  source: "browser" | "electron";
  size: number;
  mimeType?: string;
  path?: string;
  content?: string;
  transcript?: string;
  note?: string;
  fileCount?: number;
}

const codeExtensions = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".rb", ".php", ".java", ".cs", ".go", ".rs", ".cpp", ".cc", ".cxx", ".c", ".h", ".hpp",
  ".swift", ".kt", ".kts", ".scala", ".sh", ".bash", ".zsh", ".ps1", ".sql", ".prisma", ".html", ".css", ".scss", ".sass", ".less", ".json", ".yml",
  ".yaml", ".toml", ".xml", ".md", ".mdx",
]);

const textExtensions = new Set([
  ".txt", ".log", ".env", ".ini", ".conf", ".config", ".csv", ".gitignore", ".dockerignore",
]);

const documentExtensions = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"]);
const videoExtensions = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm"]);
const audioExtensions = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".webm"]);

function getExtension(name: string) {
  const normalized = name.toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  return lastDot >= 0 ? normalized.slice(lastDot) : "";
}

export function detectAttachmentCategory(name: string, mimeType = ""): AttachmentCategory {
  const extension = getExtension(name);
  const normalizedMimeType = mimeType.toLowerCase();

  if (normalizedMimeType.startsWith("audio/") || audioExtensions.has(extension)) {
    return "audio";
  }

  if (normalizedMimeType.startsWith("image/") || imageExtensions.has(extension)) {
    return "image";
  }

  if (normalizedMimeType.startsWith("video/") || videoExtensions.has(extension)) {
    return "video";
  }

  if (codeExtensions.has(extension)) {
    return "code";
  }

  if (normalizedMimeType.startsWith("text/") || textExtensions.has(extension)) {
    return "text";
  }

  if (documentExtensions.has(extension)) {
    return "document";
  }

  return "binary";
}

export function isTextReadableAttachment(name: string, mimeType = "") {
  const category = detectAttachmentCategory(name, mimeType);
  return category === "code" || category === "text";
}

export function isAudioAttachment(name: string, mimeType = "") {
  return detectAttachmentCategory(name, mimeType) === "audio";
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

export function buildAttachmentPromptContext(attachments: AttachmentContextItem[]) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return "";
  }

  return [
    "USER ATTACHMENTS:",
    ...attachments.map((attachment, index) => {
      const lines = [
        `${index + 1}. ${attachment.name}`,
        `Type: ${attachment.kind} / ${attachment.category}`,
        `Source: ${attachment.source}`,
        `Size: ${formatBytes(attachment.size)}`,
      ];

      if (attachment.path) {
        lines.push(`Path: ${attachment.path}`);
      }

      if (typeof attachment.fileCount === "number") {
        lines.push(`Contained files: ${attachment.fileCount}`);
      }

      if (attachment.note) {
        lines.push(`Note: ${attachment.note}`);
      }

      if (attachment.transcript) {
        lines.push(`Transcript:\n${attachment.transcript}`);
      }

      if (attachment.content) {
        lines.push(`Content:\n${attachment.content}`);
      }

      return lines.join("\n");
    }),
  ].join("\n\n");
}