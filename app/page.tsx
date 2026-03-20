"use client";

// In plain terms: this is the main Loco screen.
// It handles the chat UI, user input, attachments, voice playback, message history,
// and the front-end behavior for talking to the assistant.

import { useState, useRef, useEffect, type ChangeEvent, type InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Settings, Trash2, Mic, Send, X, Copy, Check, Undo2, Play, Pause, Volume2, History, Plus, MessageSquare, Maximize2, Minimize2, ExternalLink } from "lucide-react";
import { useSpeechRecognition } from "@/tools/hooks/useSpeechRecognition";
import { useAudioPlayer } from "@/tools/hooks/useAudioPlayer";
import { useElectron } from "@/tools/hooks/useElectron";
import {
  createBrowserFileAttachments,
  createBrowserFolderAttachments,
  enrichAudioAttachments,
} from "@/tools/hooks/utils/attachmentHelpers";
import { parseResponse } from "@/tools/hooks/utils/messageParser";
import { VOICE_THEMES, VoiceKey } from "@/tools/hooks/utils/themes";
import {
  callAIAPI,
  type AssistantMode,
  type AssistantProvider,
  type WorkflowFailureReason,
  type WorkflowMode,
  type WorkflowPreferredModel,
  type WorkflowRouteCategory,
  type WorkflowTaskType,
  type ResolvedAssistantMode,
} from "@/tools/hooks/utils/apiClient";
import { formatBytes, type AttachmentContextItem } from "@/lib/attachmentContext";
import {
  buildYouTubeEmbedUrl,
  normalizeYouTubeAliasName,
  parseStoredYouTubePlaylistAliases,
  parseYouTubePlaybackIntent,
  YOUTUBE_PLAYLIST_STORAGE_KEY,
  type YouTubePlaylistAlias,
} from "@/lib/youtube";


// ── Types ──
interface Message {
  role: "user" | "assistant";
  content: string;
  meta?: {
    memoryHit?: boolean;
    routing?: {
      requestedAssistantMode: AssistantMode;
      resolvedAssistantMode: ResolvedAssistantMode;
      provider: AssistantProvider;
      fallbackReason?: string | null;
    };
    workflow?: {
      enabled: boolean;
      mode: WorkflowMode;
      taskType: WorkflowTaskType;
      routeCategory: WorkflowRouteCategory;
      preferredModel: WorkflowPreferredModel;
      planSummary: string;
      planSteps: string[];
      suggestedTools: string[];
      executableTools: string[];
      reviewAttemptCount: number;
      missingContext: boolean;
      failureReason: WorkflowFailureReason;
      recommendedContext: string[];
      reviewConfidence: number;
      reviewConfidenceThreshold: number;
    };
    memorySources?: string[];
    memoryMatches?: {
      assistantMemories?: Array<{
        content: string;
        kind: string;
      }>;
      conversationMatches?: Array<{
        date: string;
        userText: string;
        assistantText: string;
      }>;
    };
  };
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface ChatSessionsResponse {
  sessions: ChatSession[];
  persistenceUnavailable?: boolean;
}

interface YouTubePlaybackMemoryResponse {
  listens: RecentYouTubeListen[];
  persistenceUnavailable?: boolean;
}

interface ChatSessionResponse {
  session: ChatSession;
}

interface CodeBlock {
  language: string;
  code: string;
}

interface HighlightToken {
  value: string;
  className: string;
}

type DirectoryPickerProps = InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

const folderPickerProps: DirectoryPickerProps = {
  webkitdirectory: "",
  directory: "",
};

interface AttachmentPickerItem extends AttachmentContextItem {
  audioBase64?: string;
}

type TtsProvider = "browser" | "server" | "piper";

interface LastAudioClip {
  provider: TtsProvider;
  text: string;
  base64Audio?: string;
  mimeType?: string;
}

interface YouTubePlayerState {
  title: string;
  subtitle: string;
  sourceUrl: string;
  embedUrl: string;
}

interface YouTubeVideoChoice {
  id: string;
  title: string;
  url: string;
  channel: string;
  publishedAt: string | null;
  viewCount: number;
}

interface PendingYouTubeClarification {
  requestQuery: string;
  prompt: string;
  options: Array<{
    key: "ost" | "remix";
    label: "OST" | "Remix";
    video: YouTubeVideoChoice;
  }>;
}

interface RecentYouTubeListen {
  requestQuery: string;
  video: YouTubeVideoChoice;
  variantLabel?: string;
  playedAt: string;
}

interface PreviewRuntimeIssue {
  message: string;
  source: string;
  capturedAt: string;
}

interface PreviewBridgeMessage {
  source: "loco-preview";
  type: "loco-preview-ready" | "loco-preview-error";
  message?: string;
  errorSource?: string;
}

function getAssistantBadge(meta?: Message["meta"]) {
  return {
    avatarLabel: "L",
    chipLabel: "Loco",
    avatarClassName: "bg-primary/20 text-primary",
    chipClassName: "border-primary/25 bg-primary/10 text-primary",
  };
}

// ── Data ──
const ALL_PROMPTS = [
  { emoji: "📝", text: "Build a React Todo List component with add, delete, and localStorage persistence" },
  { emoji: "💡", text: "Explain React hooks (useState, useEffect, useRef) with practical examples" },
  { emoji: "🐛", text: "Help me debug: 'TypeError: undefined is not a function' in JavaScript" },
  { emoji: "🎨", text: "Create a responsive Navbar component using React and Tailwind CSS" },
  { emoji: "⚡", text: "Optimize this React component for performance (re-renders, memoization, keys)" },
  { emoji: "📚", text: "Explain the difference between var, let, and const with real examples" },
  { emoji: "🔧", text: "Set up a Next.js project with TypeScript and ESLint step-by-step" },
  { emoji: "🌐", text: "Build a React form with validation using React Hook Form or custom validation" },
  { emoji: "📊", text: "Create a data visualization dashboard using Chart.js in React" },
  { emoji: "🚀", text: "Deploy a Next.js app to Vercel with environment variables configured" },
];

const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  left: `${((i * 17 + 13) % 100)}%`,
  top: `${((i * 23 + 7) % 100)}%`,
  duration: ((i * 31 + 11) % 40) / 10 + 3,
  delay: ((i * 37 + 3) % 20) / 10,
  opacity: ((i * 41 + 5) % 60) / 100 + 0.2,
}));

const EYE_POSITIONS = [
  { x: -20, y: 0 }, { x: 0, y: 0 }, { x: 20, y: 0 },
  { x: 0, y: 0 }, { x: -20, y: 0 }, { x: 20, y: 0 },
  { x: 0, y: -12 }, { x: 0, y: 0 }, { x: -15, y: -8 },
  { x: 15, y: -8 }, { x: 0, y: 0 },
];

const YOUTUBE_RECENT_LISTENS_STORAGE_KEY = "youtubeRecentListens";

function normalizeYouTubeMemoryKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseStoredRecentYouTubeListens(rawValue: string | null): RecentYouTubeListen[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is RecentYouTubeListen => {
      return Boolean(
        entry &&
        typeof entry.requestQuery === "string" &&
        typeof entry.playedAt === "string" &&
        entry.video &&
        typeof entry.video.id === "string" &&
        typeof entry.video.title === "string" &&
        typeof entry.video.url === "string" &&
        typeof entry.video.channel === "string"
      );
    });
  } catch {
    return [];
  }
}

function isRecentReplayRequest(text: string) {
  const normalizedText = text.trim();
  return /^(?:hey\s+)?loco[,:\s-]*(?:play|put\s+on)?\s*(?:that|it|this|the\s+last\s+one|last\s+song|most\s+recent|recent\s+one)\s+again\b/i.test(normalizedText)
    || /^(?:hey\s+)?loco[,:\s-]*play\s+again\b/i.test(normalizedText);
}

function isRecentListenQuestion(text: string) {
  return /(?:what\s+did\s+i\s+(?:play|listen\s+to)\s+recently|most\s+recent\s+listen|recent\s+listens?)/i.test(text.trim());
}

function getRandomPrompts(count: number) {
  return [...ALL_PROMPTS].sort(() => Math.random() - 0.5).slice(0, count);
}

function normalizeCodeLanguage(language: string) {
  return language.trim().toLowerCase();
}

function getCodeLanguageFamily(language: string) {
  const normalized = normalizeCodeLanguage(language);

  if (["javascript", "js", "typescript", "ts", "jsx", "tsx", "javascriptreact", "typescriptreact"].includes(normalized)) {
    return "script";
  }

  if (["html", "xml", "svg"].includes(normalized)) {
    return "markup";
  }

  if (normalized === "css") {
    return "style";
  }

  if (["bash", "shell", "sh", "zsh"].includes(normalized)) {
    return "shell";
  }

  if (normalized === "json") {
    return "json";
  }

  return "plain";
}

function isCodePreviewBlock(block: CodeBlock) {
  return getCodeLanguageFamily(block.language) !== "shell";
}

function isReactPreviewLanguage(language: string) {
  return ["jsx", "tsx", "javascriptreact", "typescriptreact"].includes(normalizeCodeLanguage(language));
}

function isLikelyReactPreviewBlock(block: CodeBlock) {
  if (isReactPreviewLanguage(block.language)) {
    return true;
  }

  const normalizedLanguage = normalizeCodeLanguage(block.language);
  if (!["javascript", "js", "typescript", "ts"].includes(normalizedLanguage)) {
    return false;
  }

  const source = block.code;
  const hasReactImport = /from\s+["']react["']/.test(source) || /require\(["']react["']\)/.test(source);
  const hasClientComponentHint = /["']use client["']/.test(source);
  const hasHookUsage = /\buse(?:State|Effect|Ref|Reducer|Memo|Callback|Id|Transition|DeferredValue)\s*\(/.test(source);
  const hasUppercaseComponent = /(?:function|const|let|var)\s+[A-Z][A-Za-z0-9_]*\s*(?:\(|=)/.test(source);
  const hasJsxMarkup = /return\s*\(|<[A-Za-z][\w:-]*(?:\s|>|\/)/.test(source);

  return (hasReactImport || hasClientComponentHint || hasHookUsage) && hasUppercaseComponent && hasJsxMarkup;
}

function isLikelyExecutableJavaScriptBlock(block: CodeBlock) {
  const normalizedLanguage = normalizeCodeLanguage(block.language);

  if (!["javascript", "js"].includes(normalizedLanguage)) {
    return false;
  }

  const source = block.code.trim();

  if (!source) {
    return false;
  }

  // Reject file trees and path listings that are often mislabeled as JavaScript.
  if (/^[\w.-]+\/$/m.test(source) || /[├└│]──/.test(source)) {
    return false;
  }

  const executablePatterns = [
    /\b(const|let|var|function|class|import|export|if|for|while|document\.|window\.|new\s+[A-Z]|requestAnimationFrame|addEventListener)\b/,
    /=>/,
    /[{}();]/,
  ];

  return executablePatterns.some((pattern) => pattern.test(source));
}

function escapeEmbeddedScript(code: string) {
  return code.replace(/<\/script/gi, "<\\/script");
}

function formatAllCodeBlocksForCopy(blocks: CodeBlock[]) {
  return blocks
    .map((block) => `\`\`\`${block.language || "text"}\n${block.code}\n\`\`\``)
    .join("\n\n");
}

function formatCommandsForCopy(commands: string[]) {
  return commands.map((command) => `$ ${command}`).join("\n");
}

function extractReactPreviewSource(source: string) {
  let defaultExportName: string | null = null;

  let prepared = source
    .replace(/^\s*import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "")
    .replace(/^\s*import\s+["'][^"']+["'];?\s*$/gm, "")
    .replace(/^\s*export\s+default\s+function\s+([A-Za-z_]\w*)/m, (_, name: string) => {
      defaultExportName = name;
      return `function ${name}`;
    })
    .replace(/^\s*export\s+default\s+class\s+([A-Za-z_]\w*)/m, (_, name: string) => {
      defaultExportName = name;
      return `class ${name}`;
    })
    .replace(/^\s*export\s+default\s+([A-Za-z_]\w*)\s*;?\s*$/gm, (_, name: string) => {
      defaultExportName = name;
      return "";
    })
    .replace(/^\s*export\s+\{[^}]+\};?\s*$/gm, "")
    .replace(/^\s*export\s+(?=(const|function|class|let|var|interface|type|enum)\b)/gm, "");

  if (!defaultExportName) {
    prepared = prepared.replace(/^\s*export\s+default\s+/m, () => {
      defaultExportName = "PreviewComponent";
      return `const ${defaultExportName} = `;
    });
  }

  if (!defaultExportName) {
    const componentPatterns = [
      /function\s+([A-Z][A-Za-z0-9_]*)\s*\(/,
      /class\s+([A-Z][A-Za-z0-9_]*)\s+extends/,
      /const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
      /let\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
      /var\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
      /const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*function\s*\(/,
    ];

    for (const pattern of componentPatterns) {
      const match = prepared.match(pattern);
      if (match?.[1]) {
        defaultExportName = match[1];
        break;
      }
    }
  }

  if (!defaultExportName && prepared.trim().startsWith("<")) {
    defaultExportName = "PreviewComponent";
    prepared = `const ${defaultExportName} = () => (\n${prepared.trim()}\n);`;
  }

  return {
    source: prepared.trim(),
    componentName: defaultExportName,
  };
}

function buildPreviewBridgeScript(options?: { reportReadyOnLoad?: boolean }) {
  const reportReadyOnLoad = options?.reportReadyOnLoad ?? false;

  return `<script>
      (() => {
        const send = (type, payload = {}) => {
          try {
            window.parent?.postMessage({ source: "loco-preview", type, ...payload }, "*");
          } catch {}
        };

        const normalize = (value) => {
          if (!value) {
            return "Unknown preview error";
          }

          if (typeof value === "string") {
            return value;
          }

          return String(value.stack || value.message || value.reason || value);
        };

        window.__locoPreviewSendReady = () => send("loco-preview-ready");
        window.__locoPreviewReportError = (error, errorSource = "runtime") => {
          send("loco-preview-error", {
            message: normalize(error),
            errorSource,
          });
        };

        window.addEventListener("error", (event) => {
          event.preventDefault?.();
          window.__locoPreviewReportError(event.error || event.message, "runtime");
        });

        window.addEventListener("unhandledrejection", (event) => {
          event.preventDefault?.();
          window.__locoPreviewReportError(event.reason, "promise");
        });

        ${reportReadyOnLoad ? 'window.addEventListener("load", () => { window.setTimeout(() => window.__locoPreviewSendReady(), 0); });' : ""}
      })();
    <\/script>`;
}

function buildReactPreviewDocument(codeBlocks: CodeBlock[], css: string) {
  const reactBlocks = codeBlocks.filter((block) => isLikelyReactPreviewBlock(block));

  if (reactBlocks.length === 0) {
    return null;
  }

  const combinedSource = reactBlocks.map((block) => block.code).join("\n\n");
  const prepared = extractReactPreviewSource(combinedSource);

  if (!prepared.componentName) {
    return null;
  }

  const safeCode = escapeEmbeddedScript(prepared.source);
  const previewBridgeScript = buildPreviewBridgeScript();

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, system-ui, sans-serif;
        background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
        color: #0f172a;
      }
      #root {
        min-height: 100vh;
      }
      #preview-error {
        display: none;
        margin: 16px;
        padding: 16px;
        border-radius: 16px;
        background: #0f172a;
        color: #f8fafc;
        white-space: pre-wrap;
        font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      ${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <pre id="preview-error"></pre>
    ${previewBridgeScript}
    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script type="text/babel" data-presets="react,typescript">
      const reportPreviewError = (error) => {
        const root = document.getElementById("root");
        const panel = document.getElementById("preview-error");
        if (root) {
          root.innerHTML = "";
        }
        if (panel) {
          panel.style.display = "block";
          panel.textContent = String(error?.stack || error?.message || error);
        }
        window.__locoPreviewReportError?.(error, "react-runtime");
      };

      window.addEventListener("error", (event) => {
        event.preventDefault();
        reportPreviewError(event.error || event.message);
      });

      try {
        const { useState, useEffect, useMemo, useRef, useReducer, useContext, useTransition, useDeferredValue, useId, Fragment } = React;
        ${safeCode}
        const PreviewComponent = ${prepared.componentName};
        const previewRoot = ReactDOM.createRoot(document.getElementById("root"));
        previewRoot.render(React.createElement(PreviewComponent));
      } catch (error) {
        reportPreviewError(error);
      }
    <\/script>
  </body>
</html>`;
}

function getHighlightTokens(line: string, language: string): HighlightToken[] {
  const family = getCodeLanguageFamily(language);
  const scriptKeywords = new Set([
    "import", "from", "export", "default", "function", "return", "const", "let", "var", "if", "else", "for",
    "while", "switch", "case", "break", "continue", "try", "catch", "finally", "new", "class", "extends",
    "async", "await", "throw", "typeof", "instanceof", "interface", "type", "enum", "implements", "true",
    "false", "null", "undefined", "public", "private", "protected", "readonly", "as",
  ]);

  let pattern: RegExp | null = null;

  if (family === "script") {
    pattern = /(\/\/.*$|\/\*[\s\S]*?\*\/)|(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(?:import|from|export|default|function|return|const|let|var|if|else|for|while|switch|case|break|continue|try|catch|finally|new|class|extends|async|await|throw|typeof|instanceof|interface|type|enum|implements|true|false|null|undefined|public|private|protected|readonly|as)\b|\b\d+(?:\.\d+)?\b|[{}()[\].,;:+\-*/=<>!?|&]+/g;
  } else if (family === "markup") {
    pattern = /(<!--.*?-->)|(<\/?[A-Za-z][\w:-]*)|(\/?\s*>)|(\s+[A-Za-z_:][\w:.-]*(?==))|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  } else if (family === "style") {
    pattern = /(\/\*.*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|#[0-9a-fA-F]{3,8}|\.[A-Za-z_-][\w-]*|@[A-Za-z-]+|\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)?\b|[{}():;,.>+#-]+/g;
  } else if (family === "shell") {
    pattern = /(#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\$\{?\w+\}?)|(--?[\w-]+)|\b(?:sudo|npm|npx|node|pnpm|yarn|git|cd|ls|mkdir|rm|cp|mv|echo|cat|docker|docker-compose|curl)\b/g;
  } else if (family === "json") {
    pattern = /("(?:[^"\\]|\\.)*"(?=\s*:))|("(?:[^"\\]|\\.)*")|\b(?:true|false|null)\b|\b\d+(?:\.\d+)?\b|[{}\[\],:]/g;
  }

  if (!pattern) {
    return [{ value: line || " ", className: "text-foreground" }];
  }

  const tokens: HighlightToken[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(pattern)) {
    const value = match[0] ?? "";
    const index = match.index ?? 0;

    if (index > lastIndex) {
      tokens.push({
        value: line.slice(lastIndex, index),
        className: "text-foreground",
      });
    }

    const trimmed = value.trim();
    let className = "text-foreground";

    if (family === "script") {
      className = trimmed.startsWith("//") || trimmed.startsWith("/*")
        ? "text-slate-500 italic"
        : /^[`"']/.test(trimmed)
          ? "text-emerald-300"
          : /^\d/.test(trimmed)
            ? "text-amber-300"
            : scriptKeywords.has(trimmed)
              ? "text-sky-300"
              : "text-violet-300";
    } else if (family === "markup") {
      className = trimmed.startsWith("<!--")
        ? "text-slate-500 italic"
        : trimmed.startsWith("<") || trimmed === ">" || trimmed === "/>"
          ? "text-pink-300"
          : /^["']/.test(trimmed)
            ? "text-emerald-300"
            : "text-amber-300";
    } else if (family === "style") {
      className = trimmed.startsWith("/*")
        ? "text-slate-500 italic"
        : trimmed.startsWith("@")
          ? "text-sky-300"
          : /^["']/.test(trimmed)
            ? "text-emerald-300"
            : trimmed.startsWith("#") || trimmed.startsWith(".")
              ? "text-pink-300"
              : /^\d/.test(trimmed)
                ? "text-amber-300"
                : "text-violet-300";
    } else if (family === "shell") {
      className = trimmed.startsWith("#")
        ? "text-slate-500 italic"
        : /^["']/.test(trimmed)
          ? "text-emerald-300"
          : trimmed.startsWith("$")
            ? "text-cyan-300"
            : trimmed.startsWith("-")
              ? "text-amber-300"
              : "text-sky-300";
    } else if (family === "json") {
      className = /:$/.test(trimmed) || /"\s*:/.test(value)
        ? "text-sky-300"
        : /^["']/.test(trimmed)
          ? "text-emerald-300"
          : /^\d/.test(trimmed)
            ? "text-amber-300"
            : trimmed === "true" || trimmed === "false" || trimmed === "null"
              ? "text-violet-300"
              : "text-muted-foreground";
    }

    tokens.push({ value, className });
    lastIndex = index + value.length;
  }

  if (lastIndex < line.length) {
    tokens.push({
      value: line.slice(lastIndex),
      className: "text-foreground",
    });
  }

  return tokens.length > 0 ? tokens : [{ value: line || " ", className: "text-foreground" }];
}

function renderHighlightedLine(line: string, language: string) {
  return getHighlightTokens(line, language).map((token, index) => (
    <span key={`${index}-${token.value}`} className={token.className}>
      {token.value || " "}
    </span>
  ));
}

function buildPreviewDocument(codeBlocks: CodeBlock[]) {
  if (codeBlocks.length === 0) {
    return null;
  }

  const htmlBlocks = codeBlocks.filter((block) => {
    const language = normalizeCodeLanguage(block.language);
    return language === "html" || language === "xml";
  });
  const cssBlocks = codeBlocks.filter((block) => normalizeCodeLanguage(block.language) === "css");
  const jsBlocks = codeBlocks.filter(isLikelyExecutableJavaScriptBlock);
  const svgBlock = codeBlocks.find((block) => normalizeCodeLanguage(block.language) === "svg");
  const css = cssBlocks.map((block) => block.code).join("\n\n");
  const previewBridgeScript = buildPreviewBridgeScript({ reportReadyOnLoad: true });

  if (svgBlock) {
    return `<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, #0f172a 0%, #020617 100%);
      }
      svg {
        max-width: 100%;
        max-height: 100vh;
      }
    </style>
  </head>
  <body>
    ${previewBridgeScript}
    ${svgBlock.code}
  </body>
</html>`;
  }

  const reactPreviewDocument = buildReactPreviewDocument(codeBlocks, css);
  if (reactPreviewDocument) {
    return reactPreviewDocument;
  }

  if (htmlBlocks.length === 0) {
    return null;
  }

  const html = htmlBlocks.map((block) => block.code).join("\n\n");
  const script = jsBlocks.map((block) => block.code).join("\n\n");

  if (html) {
    const styleTag = css ? `<style>${css}</style>` : "";
    const scriptTag = `${previewBridgeScript}${script ? `<script>${script}<\/script>` : ""}`;

    if (/<html[\s>]/i.test(html)) {
      let document = html;
      if (styleTag) {
        document = /<head[\s>]/i.test(document)
          ? document.replace(/<\/head>/i, `${styleTag}</head>`)
          : document.replace(/<html([^>]*)>/i, `<html$1><head>${styleTag}</head>`);
      }
      if (scriptTag) {
        document = /<\/body>/i.test(document)
          ? document.replace(/<\/body>/i, `${scriptTag}</body>`)
          : `${document}${scriptTag}`;
      }
      return document;
    }

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${styleTag}
  </head>
  <body>
    ${html}
    ${scriptTag}
  </body>
</html>`;
  }
}

function renderLineNumberedCode(code: string, language: string) {
  return code.split("\n").map((line, index) => (
    <div key={`${index}-${line}`} className="grid grid-cols-[auto_1fr] gap-4 px-4">
      <span className="select-none text-right text-[11px] text-muted-foreground/60">{index + 1}</span>
      <span className="whitespace-pre-wrap break-words text-foreground">{renderHighlightedLine(line || " ", language)}</span>
    </div>
  ));
}

function renderCodeBlocks(blocks: CodeBlock[]) {
  return blocks.map((block, index) => (
    <section key={`${block.language}-${index}`} className={index > 0 ? "border-t border-border/70" : ""}>
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>{block.language || `block ${index + 1}`}</span>
        <span>{block.code.split("\n").length} lines</span>
      </div>
      <pre className="overflow-x-auto py-3 font-mono text-xs leading-relaxed">{renderLineNumberedCode(block.code, block.language)}</pre>
    </section>
  ));
}

// Helper to strip URLs from text for speech
const stripUrlsFromText = (text: string): string => {
  let cleaned = text;
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  cleaned = cleaned.replace(/<a\s+href="[^"]*"[^>]*>([^<]*)<\/a>/gi, "$1");
  cleaned = cleaned.replace(/https?:\/\/[^\s)]+/g, "");
  cleaned = cleaned.replace(/www\.[^\s)]+/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
};

function chunkSpeechText(text: string) {
  const phraseChunks = text
    .replace(/\s*[-–—]\s*/g, ", ")
    .split(/(?<=[.!?…;:])\s+|(?<=,)\s+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const chunks: string[] = [];

  for (const phrase of phraseChunks) {
    const words = phrase.split(/\s+/).filter(Boolean);

    if (words.length <= 12) {
      chunks.push(phrase);
      continue;
    }

    for (let index = 0; index < words.length; index += 10) {
      chunks.push(words.slice(index, index + 10).join(" "));
    }
  }

  return chunks;
}

function selectPreferredBrowserVoice(voices: SpeechSynthesisVoice[], voiceIndex: number) {
  return (
    voices.find((voice) => /google uk english male/i.test(voice.name) || /google uk english male/i.test(voice.voiceURI)) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb") && /daniel|george|arthur|alfie/i.test(voice.name)) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb") && /david|natural|google/i.test(voice.name)) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb")) ||
    voices.find((voice) => /david|natural|google/i.test(voice.name)) ||
    (voices.length > 0 ? voices[voiceIndex % voices.length] : null)
  );
}

// Helper for natural chunked speech synthesis
function speakChunks(text: string, voiceIndex: number, retryCount = 0) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const chunks = chunkSpeechText(text);

  if (chunks.length === 0) {
    return;
  }

  const voices = window.speechSynthesis.getVoices();

  if (voices.length === 0 && retryCount < 3) {
    window.setTimeout(() => speakChunks(text, voiceIndex, retryCount + 1), 150);
    return;
  }

  const preferredVoice = selectPreferredBrowserVoice(voices, voiceIndex);

  function speakNext(remaining: string[]) {
    if (!remaining.length) return;
    const utterance = new SpeechSynthesisUtterance(remaining[0]);
    utterance.lang = preferredVoice?.lang || "en-GB";
    utterance.rate = 0.9;
    utterance.pitch = 0.92;
    utterance.volume = 1.0;
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onend = () => {
      const pauseDuration = /[.!?…]$/.test(remaining[0]) ? 220 : /[,;:]$/.test(remaining[0]) ? 140 : 110;
      window.setTimeout(() => speakNext(remaining.slice(1)), pauseDuration);
    };
    window.speechSynthesis.speak(utterance);
  }

  speakNext(chunks);
}

// ── Main Component ──
export default function Home() {
  const router = useRouter();
  const { isElectron, clipboard, attachments: electronAttachments, tts } = useElectron();
  
  // Start screen state - always start false to avoid hydration mismatch
  const [showStartScreen, setShowStartScreen] = useState(false);
  const [startScreenChecked, setStartScreenChecked] = useState(false);
  const [phase, setPhase] = useState<"intro" | "eyes" | "fadeout">("intro");
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });

  // Chat & settings state
  const [voice, setVoice] = useState<VoiceKey>("echo");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [extractedCode, setExtractedCode] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [activeCodeBlockIndex, setActiveCodeBlockIndex] = useState(0);
  const [terminalView, setTerminalView] = useState<"preview" | "code" | "commands">("code");
  const [terminalCommands, setTerminalCommands] = useState<string[]>([]);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState<Array<{ emoji: string; text: string }>>([]);
  const [lastAudioClip, setLastAudioClip] = useState<LastAudioClip | null>(null);
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>("browser");
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("auto");
  const [experimentalAiWorkflowEnabled, setExperimentalAiWorkflowEnabled] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [enablePingPong, setEnablePingPong] = useState(true);
  const [enableChess, setEnableChess] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [deletingAllHistory, setDeletingAllHistory] = useState(false);
  const [expandedMemoryHits, setExpandedMemoryHits] = useState<number[]>([]);
  const [attachments, setAttachments] = useState<AttachmentContextItem[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [youTubeAliases, setYouTubeAliases] = useState<YouTubePlaylistAlias[]>([]);
  const [youTubePlayer, setYouTubePlayer] = useState<YouTubePlayerState | null>(null);
  const [pendingYouTubeClarification, setPendingYouTubeClarification] = useState<PendingYouTubeClarification | null>(null);
  const [recentYouTubeListens, setRecentYouTubeListens] = useState<RecentYouTubeListen[]>([]);
  const [previewRuntimeIssue, setPreviewRuntimeIssue] = useState<PreviewRuntimeIssue | null>(null);
  const [autoFixingPreview, setAutoFixingPreview] = useState(false);
  const activeSessionIdRef = useRef<string | null>(null);
  const autoFixPreviewSignaturesRef = useRef<Set<string>>(new Set());

  const updateActiveSessionId = (sessionId: string | null) => {
    activeSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
  };

  const upsertSessionState = (session: ChatSession) => {
    setChatSessions((previousSessions) => {
      const withoutCurrent = previousSessions.filter((entry) => entry.id !== session.id);
      return [session, ...withoutCurrent].sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
    });
  };

  const syncTerminalFromMessages = (sessionMessages: Message[]) => {
    const lastAssistant = [...sessionMessages].reverse().find((message) => message.role === "assistant");

    if (lastAssistant) {
      const parsed = parseResponse(lastAssistant.content);
      const previewDocument = buildPreviewDocument(parsed.codeBlocks);
      const previewableCodeBlocks = parsed.codeBlocks.filter(isCodePreviewBlock);
      setShowTerminal(parsed.codeBlocks.length > 0 || parsed.commands.length > 0);
      setCodeBlocks(parsed.codeBlocks);
      setActiveCodeBlockIndex(0);
      if (previewableCodeBlocks.length > 0) {
        setExtractedCode(previewableCodeBlocks[0].code);
        setCodeLanguage(previewableCodeBlocks[0].language);
      } else {
        setExtractedCode("");
        setCodeLanguage("javascript");
      }
      setTerminalView(previewDocument ? "preview" : previewableCodeBlocks.length > 0 ? "code" : "commands");
      setTerminalCommands(parsed.commands);
      return;
    }

    setShowTerminal(false);
    setExtractedCode("");
    setCodeLanguage("javascript");
    setCodeBlocks([]);
    setActiveCodeBlockIndex(0);
    setTerminalView("code");
    setTerminalCommands([]);
  };

  const applySession = (session: ChatSession) => {
    setMessages(session.messages);
    updateActiveSessionId(session.id);
    setShowHistory(false);
    syncTerminalFromMessages(session.messages);
  };

  const persistSession = async (msgs: Message[], preferredSessionId?: string | null) => {
    if (msgs.length === 0) {
      return null;
    }

    const title = msgs.find((message) => message.role === "user")?.content.slice(0, 50) || "Untitled";
    const response = await fetch("/api/chat-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: preferredSessionId ?? activeSessionIdRef.current ?? undefined,
        title,
        messages: msgs,
      }),
    });

    if (response.status === 503) {
      console.warn("Chat history persistence is unavailable; continuing without saving this session.");
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to save chat session: ${response.status}`);
    }

    const data = (await response.json()) as ChatSessionResponse;
    upsertSessionState(data.session);
    updateActiveSessionId(data.session.id);
    return data.session;
  };

  const persistRecentYouTubeListen = async (listen: RecentYouTubeListen) => {
    const response = await fetch("/api/youtube-memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(listen),
    });

    if (response.status === 503) {
      console.warn("YouTube playback memory persistence is unavailable; keeping the listen in local storage only.");
      return;
    }

    if (!response.ok) {
      throw new Error(`Failed to save YouTube playback memory: ${response.status}`);
    }
  };

  const rememberRecentYouTubeListen = (requestQuery: string, video: YouTubeVideoChoice, variantLabel?: string) => {
    const nextListen: RecentYouTubeListen = {
      requestQuery,
      video,
      variantLabel,
      playedAt: new Date().toISOString(),
    };

    void persistRecentYouTubeListen(nextListen).catch((error) => {
      console.error("Failed to persist remembered YouTube listen:", error);
    });

    setRecentYouTubeListens((currentListens) => {
      const filteredListens = currentListens.filter((entry) => entry.video.id !== video.id);
      const nextListens = [nextListen, ...filteredListens].slice(0, 12);
      localStorage.setItem(YOUTUBE_RECENT_LISTENS_STORAGE_KEY, JSON.stringify(nextListens));
      return nextListens;
    });
  };

  const playResolvedYouTubeVideo = (requestQuery: string, video: YouTubeVideoChoice, variantLabel?: string) => {
    setYouTubePlayer({
      title: video.title,
      subtitle: video.channel ? `YouTube video • ${video.channel}` : "YouTube video",
      sourceUrl: video.url,
      embedUrl: buildYouTubeEmbedUrl(video.id),
    });
    rememberRecentYouTubeListen(requestQuery, video, variantLabel);
    setPendingYouTubeClarification(null);
  };

  const findRecentListenForQuery = (requestQuery: string) => {
    const normalizedQuery = normalizeYouTubeMemoryKey(requestQuery);
    return recentYouTubeListens.find((entry) => normalizeYouTubeMemoryKey(entry.requestQuery) === normalizedQuery) || null;
  };

  const readLegacySessions = () => {
    const sessions: ChatSession[] = [];

    try {
      const savedSessions = localStorage.getItem("chatSessions");
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions);
        if (Array.isArray(parsedSessions)) {
          sessions.push(...parsedSessions);
        }
      }
    } catch (error) {
      console.error("Failed to read legacy chat sessions:", error);
    }

    try {
      const savedHistory = localStorage.getItem("conversationHistory");
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          sessions.unshift({
            id: `legacy-${Date.now()}`,
            title: parsedHistory.find((message: Message) => message.role === "user")?.content.slice(0, 50) || "Imported chat",
            messages: parsedHistory,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error("Failed to read legacy conversation history:", error);
    }

    return sessions.filter((session) => Array.isArray(session.messages) && session.messages.length > 0);
  };

  const loadSessionsFromServer = async () => {
    const response = await fetch("/api/chat-sessions", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load chat sessions: ${response.status}`);
    }

    let data = (await response.json()) as ChatSessionsResponse;

    if (!data.persistenceUnavailable && data.sessions.length === 0) {
      const legacySessions = readLegacySessions();
      if (legacySessions.length > 0) {
        for (const legacySession of legacySessions) {
          await persistSession(legacySession.messages, null);
        }
        localStorage.removeItem("chatSessions");
        localStorage.removeItem("conversationHistory");

        const refreshedResponse = await fetch("/api/chat-sessions", { cache: "no-store" });
        if (refreshedResponse.ok) {
          data = (await refreshedResponse.json()) as ChatSessionsResponse;
        }
      }
    }

    setChatSessions(data.sessions);
    updateActiveSessionId(null);
    setMessages([]);
    syncTerminalFromMessages([]);
  };

  const loadRememberedYouTubeListensFromServer = async () => {
    const response = await fetch("/api/youtube-memory", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load YouTube playback memories: ${response.status}`);
    }

    const data = (await response.json()) as YouTubePlaybackMemoryResponse;
    if (data.persistenceUnavailable) {
      return;
    }

    if (data.listens.length > 0) {
      setRecentYouTubeListens(data.listens);
      localStorage.setItem(YOUTUBE_RECENT_LISTENS_STORAGE_KEY, JSON.stringify(data.listens));
      return;
    }

    const localListens = parseStoredRecentYouTubeListens(localStorage.getItem(YOUTUBE_RECENT_LISTENS_STORAGE_KEY));
    if (localListens.length === 0) {
      return;
    }

    for (const localListen of localListens) {
      await persistRecentYouTubeListen(localListen);
    }
  };

  const loadSession = (session: ChatSession) => {
    applySession(session);
  };

  const deleteSession = async (id: string) => {
    const response = await fetch(`/api/chat-sessions/${id}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(`Failed to delete chat session: ${response.status}`);
    }

    setChatSessions((previousSessions) => previousSessions.filter((session) => session.id !== id));
    if (activeSessionId === id) {
      updateActiveSessionId(null);
      setMessages([]);
      syncTerminalFromMessages([]);
    }
  };

  const deleteAllHistory = async () => {
    if (deletingAllHistory || chatSessions.length === 0) {
      return;
    }

    const confirmed = window.confirm("Delete all saved chat history? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    setDeletingAllHistory(true);
    try {
      const response = await fetch("/api/chat-sessions", { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`Failed to delete all chat sessions: ${response.status}`);
      }

      localStorage.removeItem("chatSessions");
      localStorage.removeItem("conversationHistory");
      setChatSessions([]);
      updateActiveSessionId(null);
      setMessages([]);
      syncTerminalFromMessages([]);
      setShowHistory(false);
      setPreviewRuntimeIssue(null);
      setAutoFixingPreview(false);
      autoFixPreviewSignaturesRef.current.clear();
    } finally {
      setDeletingAllHistory(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    updateActiveSessionId(null);
    setShowTerminal(false); setExtractedCode(""); setCodeBlocks([]); setActiveCodeBlockIndex(0); setTerminalView("code"); setTerminalCommands([]);
    setPreviewRuntimeIssue(null);
    setAutoFixingPreview(false);
    autoFixPreviewSignaturesRef.current.clear();
    setLastAudioClip(null);
    setAttachments([]);
    if (window.speechSynthesis) { window.speechSynthesis.cancel(); setIsSpeechPaused(false); }
    setShowHistory(false);
  };

  const { listening, label, speechSupported, userMessage, setUserMessage, toggleListening } = useSpeechRecognition();
  const { audioRef, playAudio, isPlayingAudio } = useAudioPlayer();
  const theme = VOICE_THEMES[voice];
  const prevListeningRef = useRef(listening);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);

  const mergeAttachments = (incoming: AttachmentContextItem[]) => {
    setAttachments((currentAttachments) => {
      const merged = new Map(currentAttachments.map((attachment) => [attachment.id, attachment]));
      for (const attachment of incoming) {
        merged.set(attachment.id, attachment);
      }
      return Array.from(merged.values());
    });
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((currentAttachments) => currentAttachments.filter((attachment) => attachment.id !== attachmentId));
  };

  const speakWithBrowser = (text: string) => {
    if (!window.speechSynthesis) {
      return false;
    }

    setIsSpeechPaused(false);
    const voiceMap: { [key: string]: number } = { alloy: 0, echo: 1, fable: 2 };
    speakChunks(text, voiceMap[voice] ?? 1);
    return true;
  };

  const synthesizePiperAudio = async (text: string) => {
    if (!isElectron) {
      return null;
    }

    try {
      const result = await tts.synthesize(text, voice);
      return {
        provider: "piper" as const,
        text,
        base64Audio: result.audioBase64,
        mimeType: result.mimeType,
      };
    } catch (error) {
      console.error("Piper synthesis failed:", error);
      return null;
    }
  };

  const playSavedClip = async (clip: LastAudioClip) => {
    if (clip.provider === "browser") {
      return speakWithBrowser(clip.text);
    }

    if (clip.provider === "piper") {
      const readyClip = clip.base64Audio ? clip : await synthesizePiperAudio(clip.text);
      if (!readyClip?.base64Audio) {
        return false;
      }

      setLastAudioClip(readyClip);
      playAudio(readyClip.base64Audio, readyClip.mimeType || "audio/wav");
      return true;
    }

    if (!clip.base64Audio) {
      return false;
    }

    playAudio(clip.base64Audio, clip.mimeType || "audio/mp3");
    return true;
  };

  const handleYouTubePlayback = async (text: string) => {
    if (isRecentListenQuestion(text)) {
      const mostRecentListen = recentYouTubeListens[0];
      if (!mostRecentListen) {
        return {
          handled: true,
          assistantMessage: "I do not have any recent YouTube listens saved yet, sir.",
        };
      }

      return {
        handled: true,
        assistantMessage: `Sir, your most recent listen was ${mostRecentListen.video.title} from ${mostRecentListen.video.channel}.${mostRecentListen.variantLabel ? ` You picked the ${mostRecentListen.variantLabel}.` : ""} Do you want me to play this again?`,
      };
    }

    if (pendingYouTubeClarification) {
      const selectedOption = pendingYouTubeClarification.options.find((option) => {
        return new RegExp(`\\b${option.key}\\b`, "i").test(text) || new RegExp(`\\b${option.label}\\b`, "i").test(text);
      });

      if (selectedOption) {
        playResolvedYouTubeVideo(pendingYouTubeClarification.requestQuery, selectedOption.video, selectedOption.label);
        return {
          handled: true,
          assistantMessage: `Playing the ${selectedOption.label} choice, ${selectedOption.video.title} from ${selectedOption.video.channel}, sir.`,
        };
      }
    }

    if (isRecentReplayRequest(text)) {
      const mostRecentListen = recentYouTubeListens[0];
      if (!mostRecentListen) {
        return {
          handled: true,
          assistantMessage: "I do not have a recent YouTube listen to replay yet, sir.",
        };
      }

      playResolvedYouTubeVideo(mostRecentListen.requestQuery, mostRecentListen.video, mostRecentListen.variantLabel);
      return {
        handled: true,
        assistantMessage: `Playing ${mostRecentListen.video.title} from ${mostRecentListen.video.channel} again, sir. This was your most recent listen.`,
      };
    }

    const intent = parseYouTubePlaybackIntent(text);

    if (!intent) {
      return null;
    }

    if (intent.kind === "playlist") {
      const normalizedAlias = normalizeYouTubeAliasName(intent.aliasName || "");
      const matchingAlias = youTubeAliases.find(
        (alias) => normalizeYouTubeAliasName(alias.name) === normalizedAlias
      );

      if (matchingAlias) {
        setYouTubePlayer({
          title: matchingAlias.name,
          subtitle: "YouTube playlist",
          sourceUrl: matchingAlias.url,
          embedUrl: buildYouTubeEmbedUrl(matchingAlias.url),
        });
        setPendingYouTubeClarification(null);

        return {
          handled: true,
          assistantMessage: `Playing your ${matchingAlias.name} playlist on YouTube, sir.`,
        };
      }

      try {
        const playlistParams = new URLSearchParams({
          mode: "playlist",
          query: intent.aliasName || "",
          rawRequest: intent.rawRequest || text,
        });
        const response = await fetch(`/api/youtube?${playlistParams.toString()}`);
        const data = await response.json();

        if (!response.ok || !data?.playlist?.url) {
          return {
            handled: true,
            assistantMessage: typeof data?.error === "string"
              ? `${data.error} I could not start playlist playback, sir.`
              : `I couldn't find a saved or signed-in YouTube playlist called "${intent.aliasName}", sir.`,
          };
        }

        setYouTubePlayer({
          title: data.playlist.title,
          subtitle: data.playlist.channel ? `YouTube playlist • ${data.playlist.channel}` : "YouTube playlist",
          sourceUrl: data.playlist.url,
          embedUrl: buildYouTubeEmbedUrl(data.playlist.url),
        });
        setPendingYouTubeClarification(null);

        return {
          handled: true,
          assistantMessage: `Playing your signed-in YouTube playlist ${data.playlist.title}, sir.`,
        };
      } catch (error) {
        console.error("YouTube playlist playback error:", error);
        return {
          handled: true,
          assistantMessage: `I couldn't find a saved or signed-in YouTube playlist called "${intent.aliasName}", sir.`,
        };
      }
    }

    const params = new URLSearchParams({
      mode: "video",
      query: intent.query || "",
      newest: intent.newest ? "true" : "false",
      rawRequest: intent.rawRequest || text,
    });

    try {
      const response = await fetch(`/api/youtube?${params.toString()}`);
      const data = await response.json();

      if (data?.needsClarification && data?.clarification?.options) {
        const clarification = data.clarification as PendingYouTubeClarification;
        setPendingYouTubeClarification(clarification);
        const recentMatch = findRecentListenForQuery(intent.query || text);
        const optionSummary = clarification.options
          .map((option) => `${option.label}: ${option.video.title} from ${option.video.channel} (${option.video.viewCount.toLocaleString()} views)`)
          .join(". ");

        return {
          handled: true,
          assistantMessage: recentMatch
            ? `${clarification.prompt} ${optionSummary}. Last time for this request you played ${recentMatch.video.title} from ${recentMatch.video.channel}${recentMatch.variantLabel ? ` as the ${recentMatch.variantLabel}` : ""}. Do you want me to play this again, or should I use the OST or the remix, sir?`
            : `${clarification.prompt} ${optionSummary}. Tell me OST or remix, sir.`,
        };
      }

      if (!response.ok || !data?.video?.url) {
        return {
          handled: true,
          assistantMessage: typeof data?.error === "string"
            ? `${data.error} I could not start playback, sir.`
            : "I couldn't start YouTube playback right now, sir.",
        };
      }

      playResolvedYouTubeVideo(intent.query || text, data.video as YouTubeVideoChoice);

      return {
        handled: true,
        assistantMessage: `Playing ${data.video.title}${data.video.channel ? ` from ${data.video.channel}` : ""} on YouTube, sir.`,
      };
    } catch (error) {
      console.error("YouTube playback error:", error);
      return {
        handled: true,
        assistantMessage: "I couldn't reach YouTube right now, sir.",
      };
    }
  };

  const toggleMemoryHit = (messageIndex: number) => {
    setExpandedMemoryHits((currentExpanded) =>
      currentExpanded.includes(messageIndex)
        ? currentExpanded.filter((entry) => entry !== messageIndex)
        : [...currentExpanded, messageIndex]
    );
  };

  const finalizeAttachments = async (incoming: AttachmentPickerItem[]) => {
    if (incoming.length === 0) {
      return;
    }

    setAttachmentBusy(true);
    try {
      const enriched = await enrichAudioAttachments(incoming);
      mergeAttachments(enriched);
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handleBrowserFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = "";
    setShowAttachmentMenu(false);

    if (selectedFiles.length === 0) {
      return;
    }

    setAttachmentBusy(true);
    try {
      const builtAttachments = await createBrowserFileAttachments(selectedFiles);
      const enriched = await enrichAudioAttachments(builtAttachments);
      mergeAttachments(enriched);
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handleBrowserFolderSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = "";
    setShowAttachmentMenu(false);

    if (selectedFiles.length === 0) {
      return;
    }

    setAttachmentBusy(true);
    try {
      const builtAttachments = await createBrowserFolderAttachments(selectedFiles);
      mergeAttachments(builtAttachments);
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handlePickFiles = async () => {
    setShowAttachmentMenu(false);

    if (isElectron) {
      await finalizeAttachments(await electronAttachments.openFiles());
      return;
    }

    fileInputRef.current?.click();
  };

  const handlePickFolder = async () => {
    setShowAttachmentMenu(false);

    if (isElectron) {
      await finalizeAttachments(await electronAttachments.openFolder());
      return;
    }

    folderInputRef.current?.click();
  };

  // ── Check start screen on mount (client-only) ──
  useEffect(() => {
    const hasSeenStartScreen = localStorage.getItem("hasSeenStartScreen") === "true";
    if (!hasSeenStartScreen) {
      setShowStartScreen(true);
    }
    setStartScreenChecked(true);
    // Set random prompts on client only to avoid hydration mismatch
    setSuggestedPrompts(getRandomPrompts(3));
  }, []);

  useEffect(() => {
    if (!showStartScreen) {
      return;
    }

    setPhase("intro");
    setEyePos({ x: 0, y: 0 });

    const introTimer = window.setTimeout(() => {
      setPhase("eyes");
    }, 350);

    let eyeIndex = 0;
    const eyeInterval = window.setInterval(() => {
      setEyePos(EYE_POSITIONS[eyeIndex % EYE_POSITIONS.length]);
      eyeIndex += 1;
    }, 280);

    const fadeTimer = window.setTimeout(() => {
      setPhase("fadeout");
    }, 3350);

    const hideTimer = window.setTimeout(() => {
      setShowStartScreen(false);
      localStorage.setItem("hasSeenStartScreen", "true");
    }, 3850);

    return () => {
      window.clearTimeout(introTimer);
      window.clearInterval(eyeInterval);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [showStartScreen]);

  // ── Listen for voice commands to trigger TTS ──
  useEffect(() => {
    if (!speechSupported || !userMessage) return;
    const lowerMsg = userMessage.toLowerCase();
    if (lowerMsg.includes("read this out loud") || lowerMsg.includes("use voice")) {
      setAutoPlayAudio(true);
      if (messages.length > 0) {
        const cleanedMessage = stripUrlsFromText(messages[messages.length - 1]?.content || "");
        const nextClip: LastAudioClip = { provider: "browser", text: cleanedMessage };
        setLastAudioClip(nextClip);
        void playSavedClip(nextClip);
      }
      setUserMessage(""); // Clear after action
    }
  }, [userMessage, messages, speechSupported, voice]);

  const skipIntro = () => {
    setPhase("fadeout");
    setTimeout(() => { setShowStartScreen(false); localStorage.setItem("hasSeenStartScreen", "true"); }, 500);
  };

  // ── Initialize ──
  useEffect(() => {
    setIsMounted(true);
    // Load settings from localStorage
    const savedVoice = localStorage.getItem("selectedVoice") as VoiceKey || "echo";
    const savedAutoPlay = localStorage.getItem("autoPlayAudio") === "true";
    const savedTtsProvider = localStorage.getItem("selectedTtsProvider");
    const savedAssistantMode = localStorage.getItem("selectedAssistantMode");
    const savedPingPong = localStorage.getItem("enablePingPong") !== "false";
    const savedChess = localStorage.getItem("enableChess") !== "false";
    const savedExperimentalAiWorkflow = localStorage.getItem("experimentalAiWorkflow") === "true";
    
    setVoice(savedVoice);
    setAutoPlayAudio(savedAutoPlay);
    if (savedTtsProvider === "browser" || savedTtsProvider === "server" || savedTtsProvider === "piper") {
      setTtsProvider(savedTtsProvider);
    }
    if (savedAssistantMode === "auto" || savedAssistantMode === "loco" || savedAssistantMode === "claude") {
      setAssistantMode(savedAssistantMode);
    }
    setEnablePingPong(savedPingPong);
    setEnableChess(savedChess);
    setExperimentalAiWorkflowEnabled(savedExperimentalAiWorkflow);
    void loadSessionsFromServer().catch((error) => {
      console.error("Failed to load persisted chat sessions:", error);
    });
    
    // Initialize speech synthesis
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncYouTubeAliases = () => {
      setYouTubeAliases(
        parseStoredYouTubePlaylistAliases(localStorage.getItem(YOUTUBE_PLAYLIST_STORAGE_KEY))
      );
      setRecentYouTubeListens(
        parseStoredRecentYouTubeListens(localStorage.getItem(YOUTUBE_RECENT_LISTENS_STORAGE_KEY))
      );
    };

    syncYouTubeAliases();
    void loadRememberedYouTubeListensFromServer().catch((error) => {
      console.error("Failed to load remembered YouTube listens:", error);
    });
    window.addEventListener("storage", syncYouTubeAliases);

    return () => {
      window.removeEventListener("storage", syncYouTubeAliases);
    };
  }, []);

  useEffect(() => {
    if (!showAttachmentMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!attachmentMenuRef.current?.contains(event.target as Node)) {
        setShowAttachmentMenu(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [showAttachmentMenu]);

  useEffect(() => {
    const handlePreviewMessage = (event: MessageEvent) => {
      const data = event.data as PreviewBridgeMessage | null;

      if (!data || data.source !== "loco-preview") {
        return;
      }

      if (data.type === "loco-preview-ready") {
        setPreviewRuntimeIssue(null);
        return;
      }

      if (data.type === "loco-preview-error") {
        const message = typeof data.message === "string" && data.message.trim().length > 0
          ? data.message.trim()
          : "Unknown preview error";

        setPreviewRuntimeIssue({
          message,
          source: typeof data.errorSource === "string" && data.errorSource ? data.errorSource : "runtime",
          capturedAt: new Date().toISOString(),
        });
      }
    };

    window.addEventListener("message", handlePreviewMessage);
    return () => window.removeEventListener("message", handlePreviewMessage);
  }, []);

  const requestPreviewAutoFix = async (issue: PreviewRuntimeIssue, baseMessages: Message[]) => {
    if (baseMessages.length === 0) {
      return;
    }

    const currentSessionId = activeSessionIdRef.current;
    setAutoFixingPreview(true);
    setLoading(true);

    try {
      const session = await persistSession(baseMessages, currentSessionId);
      const result = await callAIAPI(
        baseMessages,
        voice,
        session?.id ?? currentSessionId,
        [],
        issue,
        true,
        assistantMode,
        experimentalAiWorkflowEnabled,
      );

      if (!result.success || !result.data) {
        const fallbackMessage = result.error
          ? `I hit an error while auto-fixing that preview: ${result.error}`
          : "I hit an error while auto-fixing that preview. Please try again.";
        const nextMessages: Message[] = [...baseMessages, {
          role: "assistant",
          content: fallbackMessage,
        }];
        setMessages(nextMessages);
        await persistSession(nextMessages, session?.id ?? currentSessionId);
        return;
      }

      const message = result.data.message || "No response";
      const parsed = parseResponse(message);
      const previewDocument = buildPreviewDocument(parsed.codeBlocks);
      const previewableCodeBlocks = parsed.codeBlocks.filter(isCodePreviewBlock);
      const hasCode = parsed.codeBlocks.length > 0 || parsed.commands.length > 0;

      setShowTerminal(hasCode);
      setCodeBlocks(parsed.codeBlocks);
      setActiveCodeBlockIndex(0);
      setTerminalView(previewDocument ? "preview" : previewableCodeBlocks.length > 0 ? "code" : "commands");

      if (previewableCodeBlocks.length > 0) {
        setExtractedCode(previewableCodeBlocks[0].code);
        setCodeLanguage(previewableCodeBlocks[0].language);
      } else {
        setExtractedCode("");
        setCodeLanguage("javascript");
      }

      setTerminalCommands(parsed.commands);
      const nextMessages: Message[] = [...baseMessages, {
        role: "assistant",
        content: message,
        meta: {
          routing: result.data.routing,
          workflow: result.data.workflow,
          memoryHit: result.data.memoryHit,
          memorySources: result.data.memorySources,
          memoryMatches: result.data.memoryMatches,
        },
      }];
      setMessages(nextMessages);
      await persistSession(nextMessages, session?.id ?? currentSessionId);
    } catch (error) {
      console.error("Preview auto-fix error:", error);
    } finally {
      setAutoFixingPreview(false);
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    if (!previewRuntimeIssue || loading || autoFixingPreview) {
      return;
    }

    const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");

    if (!latestAssistant) {
      return;
    }

    const signature = `${latestAssistant.content.slice(0, 200)}::${previewRuntimeIssue.message}`;

    if (autoFixPreviewSignaturesRef.current.has(signature)) {
      return;
    }

    autoFixPreviewSignaturesRef.current.add(signature);
    void requestPreviewAutoFix(previewRuntimeIssue, messages);
  }, [assistantMode, autoFixingPreview, experimentalAiWorkflowEnabled, loading, messages, previewRuntimeIssue, voice]);

  // ── Chat logic ──
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  
  // Sync speech recognition input
  useEffect(() => {
    if (userMessage) setInput(userMessage);
  }, [userMessage]);

  // Auto-send when speech recognition stops
  useEffect(() => {
    if (prevListeningRef.current && !listening && input.trim() && !loading) {
      handleSend();
    }
    prevListeningRef.current = listening;
  }, [listening, input, loading]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
         // Allow spacebar to trigger listening in overlay mode, even if window is not focused
         const isOverlayMode = window.locoOverlayMode || false;
        if (
          e.code === "Space" &&
          (!inputRef.current?.matches(":focus") || isOverlayMode)
        ) {
          e.preventDefault();
          toggleListening();
        }
      if ((e.key.toLowerCase() === "p" || e.code === "KeyP") && !inputRef.current?.matches(":focus")) {
        if (window.speechSynthesis?.speaking) {
          handleTogglePause();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [listening]);

  // Electron overlay mode: Ctrl+Space global shortcut triggers listening via IPC
  useEffect(() => {
    const api = window.electronAPI;
    if (api?.onStartListening) {
      api.onStartListening(() => {
        if (!listening) toggleListening();
      });
    }
  }, []);

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0 && !previewRuntimeIssue) || loading) return;
    setLoading(true);
    const pendingAttachments = attachments;
    const pendingPreviewRuntimeIssue = previewRuntimeIssue;
    const outboundInput = input.trim()
      || (pendingPreviewRuntimeIssue
        ? "The live preview failed. Fix the generated code using the captured runtime error."
        : "Analyze the attached files and tell me what matters.");
    
    try {
      const updated: Message[] = [...messages, { role: "user", content: outboundInput }];
      const currentSessionId = activeSessionIdRef.current;
      setMessages(updated);
      setInput("");
      setUserMessage("");
      setAttachments([]);

      // Check for game triggers
      if (enablePingPong && outboundInput.toLowerCase().includes("ping pong")) {
        router.push("/experimental/game");
        return;
      }
      if (enableChess && outboundInput.toLowerCase().includes("chess")) {
        router.push("/experimental/chess");
        return;
      }

      const youTubeResult = await handleYouTubePlayback(outboundInput);
      if (youTubeResult?.handled) {
        const nextMessages: Message[] = [...updated, {
          role: "assistant",
          content: youTubeResult.assistantMessage,
        }];
        setMessages(nextMessages);
        await persistSession(nextMessages, currentSessionId);
        return;
      }

      const session = await persistSession(updated, currentSessionId);
      const result = await callAIAPI(
        updated,
        voice,
        session?.id ?? currentSessionId,
        pendingAttachments,
        pendingPreviewRuntimeIssue,
        false,
        assistantMode,
        experimentalAiWorkflowEnabled,
      );
      
      if (!result.success || !result.data) {
        const fallbackMessage = result.error
          ? `I hit an error while generating that response: ${result.error}`
          : "I hit an error while generating that response. Please try again.";
        const errorMessages: Message[] = [...updated, {
          role: "assistant",
          content: fallbackMessage,
        }];
        setMessages(errorMessages);
        await persistSession(errorMessages, session?.id ?? currentSessionId);
        return;
      }

      const message = result.data.message || "No response";
      const parsed = parseResponse(message);
      const previewDocument = buildPreviewDocument(parsed.codeBlocks);
      const previewableCodeBlocks = parsed.codeBlocks.filter(isCodePreviewBlock);
      
      const hasCode = parsed.codeBlocks.length > 0 || parsed.commands.length > 0;
      setShowTerminal(hasCode);
      setCodeBlocks(parsed.codeBlocks);
      setActiveCodeBlockIndex(0);
      setTerminalView(previewDocument ? "preview" : previewableCodeBlocks.length > 0 ? "code" : "commands");
      
      if (previewableCodeBlocks.length > 0) {
        setExtractedCode(previewableCodeBlocks[0].code);
        setCodeLanguage(previewableCodeBlocks[0].language);
      } else {
        setExtractedCode("");
        setCodeLanguage("javascript");
      }
      
      setTerminalCommands(parsed.commands);
      const nextMessages: Message[] = [...updated, {
        role: "assistant",
        content: message,
        meta: {
          routing: result.data.routing,
          workflow: result.data.workflow,
          memoryHit: result.data.memoryHit,
          memorySources: result.data.memorySources,
          memoryMatches: result.data.memoryMatches,
        },
      }];
      setMessages(nextMessages);
      await persistSession(nextMessages, session?.id ?? currentSessionId);
      
      const cleanedMessage = stripUrlsFromText(message);
      let nextAudioClip: LastAudioClip | null = null;

      if (ttsProvider === "piper") {
        nextAudioClip = { provider: "piper", text: cleanedMessage };
      } else if (ttsProvider === "browser") {
        nextAudioClip = { provider: "browser", text: cleanedMessage };
      } else if (result.data.audio) {
        nextAudioClip = {
          provider: "server",
          text: cleanedMessage,
          base64Audio: result.data.audio,
          mimeType: "audio/mp3",
        };
      } else if (window.speechSynthesis) {
        nextAudioClip = { provider: "browser", text: cleanedMessage };
      }

      setLastAudioClip(nextAudioClip);

      if (autoPlayAudio && nextAudioClip) {
        const played = await playSavedClip(nextAudioClip);
        if (!played && nextAudioClip.provider !== "browser" && window.speechSynthesis) {
          const fallbackClip: LastAudioClip = { provider: "browser", text: cleanedMessage };
          setLastAudioClip(fallbackClip);
          speakWithBrowser(cleanedMessage);
        }
      }
    } catch (error) {
      console.error("AI Error:", error);
      setAttachments(pendingAttachments);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = () => { 
    setMessages([]); 
    updateActiveSessionId(null);
    setAttachments([]);
    setShowTerminal(false);
    setExtractedCode("");
    setCodeLanguage("javascript");
    setCodeBlocks([]);
    setActiveCodeBlockIndex(0);
    setTerminalView("code");
    setTerminalCommands([]);
    setPreviewRuntimeIssue(null);
    setAutoFixingPreview(false);
    autoFixPreviewSignaturesRef.current.clear();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeechPaused(false);
    }
    setLastAudioClip(null);
  };

  const handleUndo = () => {
    if (messages.length < 2) return;
    const newMessages = messages.slice(0, -2);
    const currentSessionId = activeSessionIdRef.current;
    setMessages(newMessages);
    syncTerminalFromMessages(newMessages);
    if (currentSessionId && newMessages.length > 0) {
      void persistSession(newMessages, currentSessionId).catch((error) => {
        console.error("Failed to persist updated chat after undo:", error);
      });
    }
    if (currentSessionId && newMessages.length === 0) {
      updateActiveSessionId(null);
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeechPaused(false);
    }
    setLastAudioClip(null);
  };

  const handleTogglePause = () => {
    if (!window.speechSynthesis) return;
    if (isSpeechPaused) {
      window.speechSynthesis.resume();
      setIsSpeechPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsSpeechPaused(true);
    }
  };

  const handleReplay = async () => {
    if (!lastAudioClip) {
      return;
    }

    await playSavedClip(lastAudioClip);
  };

  const previewableCodeBlocks = codeBlocks.filter(isCodePreviewBlock);
  const activeCodeBlock = previewableCodeBlocks[activeCodeBlockIndex] ?? null;
  const canSend = Boolean(input.trim() || attachments.length > 0 || previewRuntimeIssue);

  const handleCopy = async () => {
    const codeToCopy = previewableCodeBlocks.length > 1
      ? formatAllCodeBlocksForCopy(previewableCodeBlocks)
      : activeCodeBlock?.code ?? extractedCode;

    if (!codeToCopy) {
      return;
    }

    try {
      if (isElectron) {
        await clipboard.write(codeToCopy);
      } else {
        await navigator.clipboard.writeText(codeToCopy);
      }

      setCopiedTarget("code");
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch (error) {
      console.error("Failed to copy code:", error);
    }
  };

  const handleCopyCommands = async () => {
    const commandsToCopy = formatCommandsForCopy(terminalCommands);

    if (!commandsToCopy) {
      return;
    }

    try {
      if (isElectron) {
        await clipboard.write(commandsToCopy);
      } else {
        await navigator.clipboard.writeText(commandsToCopy);
      }

      setCopiedTarget("commands");
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch (error) {
      console.error("Failed to copy commands:", error);
    }
  };

  const previewDocument = buildPreviewDocument(codeBlocks);
  const hasPreview = Boolean(previewDocument);
  const canShowCode = previewableCodeBlocks.length > 0;

  useEffect(() => {
    if (!isPreviewFullscreen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPreviewFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isPreviewFullscreen]);

  useEffect(() => {
    if (!showTerminal || !hasPreview) {
      setIsPreviewFullscreen(false);
    }
  }, [showTerminal, hasPreview]);

  useEffect(() => {
    if (!previewDocument) {
      setPreviewRuntimeIssue(null);
    }
  }, [previewDocument]);

  // ── Loading state while checking localStorage ──
  if (!startScreenChecked) {
    return (
      <div className="flex flex-col bg-background items-center justify-center" style={{ height: isElectron ? "calc(100vh - 32px)" : "100vh" }}>
        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse">
          <span className="text-primary font-bold text-lg">L</span>
        </div>
      </div>
    );
  }

  // ── Start Screen ──
  if (showStartScreen) {
    return (
      <AnimatePresence>
        {phase !== "fadeout" && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background overflow-hidden"
            style={{ height: isElectron ? "calc(100vh - 32px)" : "100vh" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            {PARTICLES.map((p, i) => (
              <motion.div
                key={i}
                className="absolute w-[3px] h-[3px] rounded-full bg-primary/60"
                style={{ left: p.left, top: p.top }}
                animate={{ y: [0, -30, 0], opacity: [p.opacity, p.opacity * 0.3, p.opacity] }}
                transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}

            <div className="flex flex-col items-center gap-8">
              <AnimatePresence>
                {phase === "eyes" && (
                  <motion.div
                    className="flex gap-6"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: "backOut" }}
                  >
                    {[0, 1].map((eyeIdx) => (
                      <motion.div
                        key={eyeIdx}
                        className="w-20 h-28 rounded-[50%] bg-primary/80 relative"
                        style={{
                          boxShadow: "0 0 40px hsl(var(--primary) / 0.5), 0 0 80px hsl(var(--primary) / 0.2)",
                          animation: "blink 4s ease-in-out infinite, glow-pulse 3s ease-in-out infinite",
                        }}
                      >
                        <motion.div
                          className="absolute w-4 h-4 rounded-full bg-primary-foreground/90"
                          animate={{ x: eyePos.x, y: eyePos.y }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          style={{ top: "35%", left: "50%", marginLeft: -8, marginTop: -8 }}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div className="text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
                <h1 className="text-7xl font-bold tracking-tight text-primary" style={{ animation: "text-glow 3s ease-in-out infinite" }}>Loco</h1>
                {phase === "eyes" && (
                  <motion.p className="mt-4 text-muted-foreground text-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                    Your AI Assistant is waking up...
                  </motion.p>
                )}
              </motion.div>

              {phase === "eyes" && (
                <motion.button
                  className="px-6 py-2 rounded-full border border-primary/40 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 hover:border-primary transition-all"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                  onClick={skipIntro}
                >
                  Skip Intro →
                </motion.button>
              )}
            </div>

            {phase === "eyes" && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full origin-left" style={{ animation: "loading-bar 3s ease-in-out forwards" }} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── Main Chat UI ──
  return (
    <div className="flex flex-col bg-background" style={{ height: isElectron ? "calc(100vh - 32px)" : "100vh" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold text-lg">L</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Loco</h1>
            <p className="text-xs text-muted-foreground">
              {messages.length > 0 ? `${Math.floor(messages.length / 2)} messages` : "Ready to chat"} • {voice}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Audio controls */}
          {lastAudioClip && (
            <>
              {lastAudioClip.provider === "browser" && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleTogglePause}
                  disabled={!window.speechSynthesis?.speaking}
                  title={isSpeechPaused ? "Resume" : "Pause"}
                >
                  {isSpeechPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleReplay}
                disabled={window.speechSynthesis?.speaking || isPlayingAudio}
                title="Replay"
              >
                <Volume2 className="w-4 h-4" />
              </Button>
            </>
          )}
          {messages.length >= 2 && (
            <Button variant="ghost" size="icon" onClick={handleUndo} disabled={loading} title="Undo">
              <Undo2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => router.push("/settings")} title="Settings">
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(v => !v)} title="Chat History" className={`gap-1.5 ${showHistory ? "text-primary" : "text-muted-foreground"}`}>
            <History className="w-4 h-4" />
            History
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowTerminal((v) => !v)} title="Toggle Terminal Panel" className="gap-1.5 text-muted-foreground">
            {showTerminal ? "◀ Close Terminal" : "▶ Terminal"}
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1.5 text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>
      </header>

      {/* Status Bar */}
      {isMounted && (autoPlayAudio || (label && label !== "tap to speak" && label !== "speech not supported")) && (
        <div className="px-6 py-2 border-b border-border/30 bg-card/30 flex items-center gap-4 text-xs text-muted-foreground">
          {autoPlayAudio && <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" /> Auto-play</span>}
          {label && label !== "tap to speak" && label !== "speech not supported" && (
            <span className={`flex items-center gap-1 ${label === "listening..." ? "text-primary" : (label.includes("error") || label.includes("no ") || label.includes("denied")) ? "text-destructive" : ""}`}>
              {label === "listening..." && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
              {label}
            </span>
          )}
          <div className="flex-1" />
          <span className="opacity-60">Space: Record {window.speechSynthesis?.speaking && "• P: Pause"}</span>
        </div>
      )}

      {youTubePlayer && (
        <div className="border-b border-border/30 bg-card/20 px-6 py-3">
          <div className="rounded-[24px] border border-border/60 bg-card/70 p-4 shadow-[0_18px_40px_rgba(2,6,23,0.18)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">YouTube Now Playing</div>
                <div className="mt-2 text-base font-semibold text-foreground">{youTubePlayer.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{youTubePlayer.subtitle}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={youTubePlayer.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/55 px-3 py-2 text-sm font-medium text-foreground transition-all hover:border-primary/30 hover:bg-background/80"
                    title="Open this video directly on YouTube"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in YouTube
                  </a>
                  <span className="text-xs text-muted-foreground">
                    If the embed says video unavailable, open it directly on YouTube.
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setYouTubePlayer(null)}
                title="Close player"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-black/30">
              <iframe
                title="YouTube player"
                src={youTubePlayer.embedUrl}
                width="100%"
                height="315"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* History Sidebar */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, x: -60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-[280px] border-r border-border/50 bg-card/80 backdrop-blur-xl flex flex-col flex-shrink-0"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <span className="text-sm font-semibold text-foreground">Chat History</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="px-3 py-2 border-b border-border/30 space-y-2">
                <Button variant="surface" size="sm" className="w-full gap-2 text-xs" onClick={startNewChat}>
                  <Plus className="w-3.5 h-3.5" /> New Chat
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    void deleteAllHistory().catch((error) => {
                      console.error("Failed to delete all chat history:", error);
                    });
                  }}
                  disabled={deletingAllHistory || chatSessions.length === 0}
                >
                  <Trash2 className="w-3.5 h-3.5" /> {deletingAllHistory ? "Deleting..." : "Delete All History"}
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                {chatSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-2 py-8">
                    <MessageSquare className="w-8 h-8 opacity-20" />
                    <p>No saved chats yet</p>
                  </div>
                ) : (
                  chatSessions.map(session => (
                    <div
                      key={session.id}
                      className={`group flex items-start justify-between gap-2 mx-2 mb-1 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-muted/60 ${
                        activeSessionId === session.id ? "bg-primary/10 border border-primary/20" : ""
                      }`}
                      onClick={() => loadSession(session)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{session.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(session.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {" · "}{Math.floor(session.messages.length / 2)} msg{Math.floor(session.messages.length / 2) !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0 mt-0.5"
                        onClick={e => {
                          e.stopPropagation();
                          void deleteSession(session.id).catch((error) => {
                            console.error("Failed to delete chat session:", error);
                          });
                        }}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <span className="text-4xl">💬</span>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">Start a conversation</h2>
                  <p className="text-muted-foreground text-sm">Try asking a question or use voice input</p>
                </motion.div>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {suggestedPrompts.map((prompt, i) => (
                    <motion.button key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
                      onClick={() => setInput(prompt.text)}
                      className="px-4 py-2 rounded-full bg-surface border border-border text-sm text-secondary-foreground hover:bg-surface-hover hover:border-primary/30 transition-all"
                    >
                      {prompt.emoji} {prompt.text.split(" ").slice(0, 3).join(" ")}...
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((msg, i) => (
                  (() => {
                    const assistantBadge = getAssistantBadge(msg.meta);

                    return (
                  <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${assistantBadge.avatarClassName}`}>
                        <span className="text-xs font-bold">{assistantBadge.avatarLabel}</span>
                      </div>
                    )}
                    <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm text-card-foreground"
                    }`}>
                      {msg.role === "assistant" && (
                        <div className="mb-2 flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${assistantBadge.chipClassName}`}>
                            {assistantBadge.chipLabel}
                          </span>
                          {msg.meta?.routing?.requestedAssistantMode === "auto" && msg.meta?.routing?.resolvedAssistantMode ? (
                            <span className="text-[11px] text-muted-foreground">
                              Auto routed
                            </span>
                          ) : null}
                          {msg.meta?.workflow?.enabled ? (
                            <span className="text-[11px] text-muted-foreground">
                              Enhanced workflow · {msg.meta.workflow.taskType} · {msg.meta.workflow.preferredModel}
                            </span>
                          ) : null}
                        </div>
                      )}
                      {msg.role === "assistant" && msg.meta?.memoryHit && (
                        <div className="mb-2">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-left"
                            onClick={() => toggleMemoryHit(i)}
                            title={msg.meta.memorySources?.length ? `Memory hit: ${msg.meta.memorySources.join(", ")}` : "Memory hit"}
                          >
                            <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-primary">
                              Memory Hit
                            </span>
                          </button>
                          {msg.meta.memorySources?.length ? (
                            <span className="mt-1 block text-[11px] text-muted-foreground">
                              {msg.meta.memorySources.join(" + ")}
                            </span>
                          ) : null}
                          {expandedMemoryHits.includes(i) && msg.meta.memoryMatches && (
                            <div className="mt-2 space-y-2 rounded-xl border border-border/60 bg-background/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                              {(msg.meta.memoryMatches.assistantMemories?.length || 0) > 0 && (
                                <div>
                                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/80">Remembered facts</div>
                                  <div className="space-y-1">
                                    {msg.meta.memoryMatches.assistantMemories?.map((memory, memoryIndex) => (
                                      <div key={`${i}-assistant-memory-${memoryIndex}`} className="rounded-lg bg-card/60 px-2 py-1.5 text-foreground/90">
                                        {memory.content}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(msg.meta.memoryMatches.conversationMatches?.length || 0) > 0 && (
                                <div>
                                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/80">Prior conversation</div>
                                  <div className="space-y-1.5">
                                    {msg.meta.memoryMatches.conversationMatches?.map((match, matchIndex) => (
                                      <div key={`${i}-conversation-memory-${matchIndex}`} className="rounded-lg bg-card/60 px-2 py-2">
                                        <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-primary/70">{match.date}</div>
                                        <div className="text-foreground/90">User: {match.userText}</div>
                                        {match.assistantText ? (
                                          <div className="mt-1 text-muted-foreground">Loco: {match.assistantText}</div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {msg.role === "assistant"
                        ? (
                            <ReactMarkdown components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                              pre: ({ children }) => <>{children}</>,
                              ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>,
                              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:text-primary transition-colors">{children}</a>,
                              blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/50 pl-3 my-2 text-muted-foreground italic">{children}</blockquote>,
                              h1: ({ children }) => <h1 className="text-xl font-bold mb-2 text-accent">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-semibold mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-semibold mb-1">{children}</h3>,
                            }}>{parseResponse(msg.content).cleanText}</ReactMarkdown>
                          )
                        : msg.content}
                    </div>
                  </motion.div>
                    );
                  })()
                ))}

                {loading && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-primary text-xs font-bold">L</span>
                    </div>
                    <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((j) => (
                          <motion.div key={j} className="w-2 h-2 rounded-full bg-primary/60" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, delay: j * 0.2, repeat: Infinity }} />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-border/50 bg-card/30 backdrop-blur-xl">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleBrowserFilesSelected}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleBrowserFolderSelected}
              {...folderPickerProps}
            />
            <div className="max-w-3xl mx-auto space-y-3">
              {previewRuntimeIssue && (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-destructive">Preview error captured</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {autoFixingPreview ? "Loco is automatically trying to fix the preview now." : "Loco will auto-fix this preview, and you can still press send if you want to intervene manually."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewRuntimeIssue(null)}
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Dismiss
                    </button>
                  </div>
                  <pre className="mt-3 max-h-28 overflow-auto whitespace-pre-wrap rounded-xl bg-background/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-destructive">
                    {previewRuntimeIssue.message}
                  </pre>
                </div>
              )}
              {(attachments.length > 0 || attachmentBusy) && (
                <div className="rounded-2xl border border-border/60 bg-background/40 px-3 py-3">
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-foreground"
                        >
                          <span className="max-w-[240px] truncate">
                            {attachment.name}
                            {attachment.kind === "folder" && typeof attachment.fileCount === "number" ? ` · ${attachment.fileCount} files` : ""}
                            {` · ${formatBytes(attachment.size)}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(attachment.id)}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={`Remove ${attachment.name}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {attachmentBusy && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Analyzing attachments...
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-3" ref={attachmentMenuRef}>
                <div className="relative">
                  <Button
                    type="button"
                    variant="surface"
                    size="icon"
                    onClick={() => setShowAttachmentMenu((current) => !current)}
                    disabled={loading || attachmentBusy}
                    title="Add files or folder"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <AnimatePresence>
                    {showAttachmentMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.16 }}
                        className="absolute bottom-[calc(100%+12px)] left-0 z-30 w-52 rounded-2xl border border-border/70 bg-card/95 p-2 shadow-2xl backdrop-blur-xl"
                      >
                        <button
                          type="button"
                          onClick={() => void handlePickFiles()}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
                        >
                          <span>Add files</span>
                          <span className="text-xs text-muted-foreground">code, audio, docs</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handlePickFolder()}
                          className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
                        >
                          <span>Add folder</span>
                          <span className="text-xs text-muted-foreground">project scan</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <input 
                  ref={inputRef} 
                  type="text" 
                  value={input} 
                  onChange={(e) => { setInput(e.target.value); setUserMessage(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  disabled={loading} 
                  placeholder={previewRuntimeIssue ? "Preview failed. Ask Loco to fix it, or press send." : attachments.length > 0 ? "Ask Loco to analyze what you attached..." : "Ask anything..."}
                  className="flex-1 px-4 py-3 rounded-xl bg-input/50 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all disabled:opacity-50"
                />
                <Button onClick={handleSend} disabled={loading || !canSend} variant="glow" className="px-5">
                  {loading ? (
                    <div className="flex gap-1">
                      {[0, 1, 2].map((j) => <motion.span key={j} className="w-1.5 h-1.5 rounded-full bg-primary-foreground" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, delay: j * 0.15, repeat: Infinity }} />)}
                    </div>
                  ) : <Send className="w-4 h-4" />}
                </Button>
                {speechSupported && (
                  <Button 
                    variant={listening ? "glow" : "surface"} 
                    size="icon" 
                    onClick={toggleListening}
                    disabled={loading || attachmentBusy}
                    title="Voice input"
                    className={listening ? "animate-pulse" : ""}
                  >
                    <Mic className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Terminal Panel */}
        <AnimatePresence>
          {showTerminal && (
            <motion.div
              initial={{ opacity: 0, x: 60 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 60 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-[560px] border-l border-border/50 bg-card/80 backdrop-blur-xl flex flex-col flex-shrink-0 lg:w-[560px]"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground">Workspace Preview</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowTerminal(false)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-1 min-h-0 flex-col p-5">
                {(hasPreview || canShowCode || terminalCommands.length > 0) && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {hasPreview && (
                      <Button
                        variant={terminalView === "preview" ? "default" : "surface"}
                        size="sm"
                        className="h-7 px-3 text-xs"
                        onClick={() => setTerminalView("preview")}
                      >
                        Preview
                      </Button>
                    )}
                    {canShowCode && (
                      <Button
                        variant={terminalView === "code" ? "default" : "surface"}
                        size="sm"
                        className="h-7 px-3 text-xs"
                        onClick={() => setTerminalView("code")}
                      >
                        Code
                      </Button>
                    )}
                    {terminalCommands.length > 0 && (
                      <Button
                        variant={terminalView === "commands" ? "default" : "surface"}
                        size="sm"
                        className="h-7 px-3 text-xs"
                        onClick={() => setTerminalView("commands")}
                      >
                        Commands
                      </Button>
                    )}
                  </div>
                )}

                {terminalView === "preview" && hasPreview && (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Live Preview</div>
                        <p className="mt-1 text-xs text-muted-foreground">Rendered sandbox for previewable web code blocks.</p>
                      </div>
                      <Button onClick={() => setIsPreviewFullscreen(true)} variant="surface" size="sm" className="gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5" /> Full Screen
                      </Button>
                    </div>
                    {previewRuntimeIssue && (
                      <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-destructive">Captured Preview Error</p>
                            <p className="mt-1 text-xs text-muted-foreground">This error will be forwarded to Loco on your next request.</p>
                          </div>
                          <Button variant="surface" size="sm" className="h-7 px-3 text-xs" onClick={() => setPreviewRuntimeIssue(null)}>
                            Clear
                          </Button>
                        </div>
                        <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-background/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-destructive">
                          {previewRuntimeIssue.message}
                        </pre>
                      </div>
                    )}
                    <div className="flex flex-1 min-h-0 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                      <iframe
                        title="Generated code preview"
                        sandbox="allow-scripts"
                        srcDoc={previewDocument ?? undefined}
                        className="h-full min-h-[520px] w-full bg-white"
                      />
                    </div>
                  </div>
                )}

                {terminalView === "code" && activeCodeBlock && (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Code Preview</div>
                        <p className="mt-1 text-xs text-muted-foreground">Readable, line-numbered view of every extracted code block.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={handleCopy} variant="surface" size="sm" className="gap-1.5">
                          {copiedTarget === "code" ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Code</>}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
                      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        <span>{previewableCodeBlocks.length > 1 ? `${previewableCodeBlocks.length} code blocks` : activeCodeBlock.language || "code"}</span>
                        <span>{previewableCodeBlocks.reduce((total, block) => total + block.code.split("\n").length, 0)} lines</span>
                      </div>
                      <div className="flex-1 overflow-auto">{renderCodeBlocks(previewableCodeBlocks)}</div>
                    </div>
                  </div>
                )}
                
                {terminalView === "commands" && terminalCommands.length > 0 && (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Terminal Commands</div>
                      <Button onClick={handleCopyCommands} variant="surface" size="sm" className="gap-1.5">
                        {copiedTarget === "commands" ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Commands</>}
                      </Button>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">Review commands before running them in your real terminal.</p>
                    <div className="flex-1 overflow-auto">
                      {terminalCommands.map((cmd, i) => (
                        <div key={i} className="mb-2 font-mono text-xs text-foreground bg-background/50 p-3 rounded-lg border-l-2 border-primary">
                          <span className="text-primary/70">$ </span>{cmd}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {!canShowCode && terminalCommands.length === 0 && !hasPreview && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                    <span className="text-4xl mb-4 opacity-30">📟</span>
                    <p className="font-medium mb-2">No previewable code found</p>
                    <p className="text-xs opacity-60">Ask the AI to provide code wrapped in markdown blocks or terminal commands.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} autoPlay controls style={{ display: "none" }} />

      <AnimatePresence>
        {isPreviewFullscreen && hasPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md"
          >
            <div className="flex h-full flex-col p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/80 px-4 py-3 shadow-xl">
                <div>
                  <div className="text-sm font-medium text-foreground">Full Screen Preview</div>
                  <p className="mt-1 text-xs text-muted-foreground">Click inside the preview to focus keyboard and mouse controls. Press Escape to close.</p>
                </div>
                <Button onClick={() => setIsPreviewFullscreen(false)} variant="surface" size="sm" className="gap-1.5">
                  <Minimize2 className="w-3.5 h-3.5" /> Exit Full Screen
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                <iframe
                  title="Generated code preview full screen"
                  sandbox="allow-scripts"
                  srcDoc={previewDocument ?? undefined}
                  className="h-full w-full bg-white"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {copiedTarget && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50"
          >
            <Check className="w-5 h-5" />
            <span className="font-medium">
              {copiedTarget === "commands" ? "Commands copied to clipboard!" : copiedTarget === "all-code" ? "All code blocks copied to clipboard!" : "Code copied to clipboard!"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
