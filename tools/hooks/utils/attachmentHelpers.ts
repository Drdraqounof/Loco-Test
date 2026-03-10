import {
  detectAttachmentCategory,
  isAudioAttachment,
  isTextReadableAttachment,
  type AttachmentContextItem,
} from "@/lib/attachmentContext";

export interface PendingAttachment extends AttachmentContextItem {
  audioBase64?: string;
}

const MAX_TEXT_CHARS = 12000;
const MAX_FOLDER_CHARS = 32000;
const MAX_FOLDER_FILES = 20;
const IGNORED_DIRECTORY_NAMES = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", "out"]);

function normalizePath(value: string) {
  return value.replace(/\\/g, "/");
}

function makeAttachmentId(parts: string[]) {
  return parts.filter(Boolean).join("::").toLowerCase();
}

function shouldIgnoreRelativePath(relativePath: string) {
  const segments = normalizePath(relativePath).split("/").filter(Boolean);
  return segments.some((segment) => IGNORED_DIRECTORY_NAMES.has(segment));
}

function trimContent(text: string, maxChars: number) {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }

  return {
    text: `${text.slice(0, maxChars)}\n...\n[truncated]`,
    truncated: true,
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

async function transcribeAudioBlob(audioFile: Blob, fileName: string) {
  const formData = new FormData();
  formData.append("file", audioFile, fileName);

  const response = await fetch("/api/stt", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.error || `Transcription failed with ${response.status}`);
  }

  const payload = await response.json();
  return typeof payload.text === "string" ? payload.text.trim() : "";
}

function base64ToBlob(base64: string, mimeType: string) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}

export async function enrichAudioAttachments(attachments: PendingAttachment[]) {
  const enriched = await Promise.all(
    attachments.map(async (attachment) => {
      if (attachment.category !== "audio") {
        const { audioBase64, ...rest } = attachment;
        return rest;
      }

      try {
        let transcript = attachment.transcript || "";

        if (!transcript && attachment.audioBase64) {
          const audioBlob = base64ToBlob(attachment.audioBase64, attachment.mimeType || "audio/mpeg");
          transcript = await transcribeAudioBlob(audioBlob, attachment.name);
        }

        const { audioBase64, ...rest } = attachment;

        if (!transcript) {
          return {
            ...rest,
            note: attachment.note || "Audio attached. No transcript was produced.",
          };
        }

        return {
          ...rest,
          transcript,
          note: attachment.note || "Audio attached. Transcript extracted for analysis.",
        };
      } catch (error) {
        const { audioBase64, ...rest } = attachment;
        return {
          ...rest,
          note: `Audio attached. Transcription failed: ${error instanceof Error ? error.message : "unknown error"}`,
        };
      }
    })
  );

  return enriched;
}

async function buildBrowserFileAttachment(file: File, relativePath?: string): Promise<PendingAttachment> {
  const category = detectAttachmentCategory(file.name, file.type);
  const normalizedPath = relativePath ? normalizePath(relativePath) : file.name;
  const attachment: PendingAttachment = {
    id: makeAttachmentId(["browser", normalizedPath, String(file.size), String(file.lastModified)]),
    name: file.name,
    kind: "file",
    category,
    source: "browser",
    size: file.size,
    mimeType: file.type,
    path: normalizedPath,
  };

  if (isTextReadableAttachment(file.name, file.type)) {
    const text = await file.text();
    const trimmed = trimContent(text, MAX_TEXT_CHARS);
    attachment.content = trimmed.text;
    if (trimmed.truncated) {
      attachment.note = "Text content truncated for prompt size control.";
    }
  } else if (isAudioAttachment(file.name, file.type)) {
    attachment.note = "Audio attached. Extracting transcript for analysis.";
    attachment.audioBase64 = arrayBufferToBase64(await file.arrayBuffer());
  } else {
    attachment.note = `Attached as ${category}. Metadata is available even if the file contents are not directly readable.`;
  }

  return attachment;
}

export async function createBrowserFileAttachments(files: File[]) {
  const processedFiles = files.filter((file) => !shouldIgnoreRelativePath(file.webkitRelativePath || file.name));
  return Promise.all(processedFiles.map((file) => buildBrowserFileAttachment(file)));
}

export async function createBrowserFolderAttachments(files: File[]) {
  const includedFiles = files.filter((file) => file.webkitRelativePath && !shouldIgnoreRelativePath(file.webkitRelativePath));
  const groups = new Map<string, File[]>();

  for (const file of includedFiles) {
    const normalizedPath = normalizePath(file.webkitRelativePath);
    const rootName = normalizedPath.split("/")[0] || "Selected folder";
    const currentGroup = groups.get(rootName) || [];
    currentGroup.push(file);
    groups.set(rootName, currentGroup);
  }

  const attachments: PendingAttachment[] = [];

  for (const [rootName, groupFiles] of groups) {
    const sortedFiles = [...groupFiles].sort((left, right) => left.webkitRelativePath.localeCompare(right.webkitRelativePath));
    const lines: string[] = [];
    const notes: string[] = [];
    let charBudget = 0;
    let includedRelevantFiles = 0;
    let totalSize = 0;

    for (const file of sortedFiles) {
      totalSize += file.size;
    }

    for (const file of sortedFiles) {
      if (includedRelevantFiles >= MAX_FOLDER_FILES || charBudget >= MAX_FOLDER_CHARS) {
        break;
      }

      const relativePath = normalizePath(file.webkitRelativePath);
      if (isTextReadableAttachment(file.name, file.type)) {
        const rawText = await file.text();
        const remainingChars = Math.max(1200, MAX_FOLDER_CHARS - charBudget);
        const trimmed = trimContent(rawText, Math.min(MAX_TEXT_CHARS, remainingChars));
        const snippet = `File: ${relativePath}\n${trimmed.text}`;
        lines.push(snippet);
        charBudget += snippet.length;
        includedRelevantFiles += 1;
        if (trimmed.truncated) {
          notes.push(`${relativePath} was truncated.`);
        }
        continue;
      }

      if (isAudioAttachment(file.name, file.type) && includedRelevantFiles < MAX_FOLDER_FILES) {
        try {
          const transcript = await transcribeAudioBlob(file, file.name);
          if (transcript) {
            const snippet = `Audio: ${relativePath}\nTranscript:\n${transcript}`;
            lines.push(snippet);
            charBudget += snippet.length;
          } else {
            notes.push(`${relativePath} is audio but produced no transcript.`);
          }
        } catch (error) {
          notes.push(`${relativePath} transcription failed.`);
        }
        includedRelevantFiles += 1;
      }
    }

    if (sortedFiles.length > MAX_FOLDER_FILES) {
      notes.push(`Only the first ${MAX_FOLDER_FILES} relevant files were included.`);
    }

    attachments.push({
      id: makeAttachmentId(["browser-folder", rootName, String(sortedFiles.length), String(totalSize)]),
      name: rootName,
      kind: "folder",
      category: "folder",
      source: "browser",
      size: totalSize,
      path: rootName,
      fileCount: sortedFiles.length,
      content: lines.join("\n\n"),
      note: notes.length > 0 ? notes.join(" ") : "Folder attached for analysis.",
    });
  }

  return attachments;
}