import { existsSync, readFileSync } from "node:fs";
import { Agent, type Dispatcher } from "undici";
import { isPersistenceUnavailableError } from "@/lib/persistence";

// In plain terms: OpenAI HTTP transport with optional local TLS workarounds, plus persistence helpers.

const OPENAI_CA_CERT_PATH = process.env.OPENAI_CA_CERT_PATH;
const OPENAI_ALLOW_INSECURE_TLS = process.env.OPENAI_ALLOW_INSECURE_TLS === "true";

let openAIDispatcher: Dispatcher | null | undefined;
let openAIInsecureFallbackDispatcher: Dispatcher | undefined;

export function isTlsCertificateError(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  const code = candidate?.code || candidate?.cause?.code;
  return code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" || code === "SELF_SIGNED_CERT_IN_CHAIN" || code === "DEPTH_ZERO_SELF_SIGNED_CERT";
}

export function getOpenAIDispatcher() {
  if (openAIDispatcher !== undefined) {
    return openAIDispatcher;
  }

  if (OPENAI_CA_CERT_PATH) {
    if (!existsSync(OPENAI_CA_CERT_PATH)) {
      throw new Error(`OPENAI_CA_CERT_PATH does not exist: ${OPENAI_CA_CERT_PATH}`);
    }

    openAIDispatcher = new Agent({
      connect: {
        ca: readFileSync(OPENAI_CA_CERT_PATH, "utf8"),
      },
    });
    return openAIDispatcher;
  }

  if (OPENAI_ALLOW_INSECURE_TLS && process.env.NODE_ENV !== "production") {
    openAIDispatcher = new Agent({
      connect: {
        rejectUnauthorized: false,
      },
    });
    return openAIDispatcher;
  }

  openAIDispatcher = null;
  return openAIDispatcher;
}

export function getOpenAIInsecureFallbackDispatcher() {
  if (!openAIInsecureFallbackDispatcher) {
    openAIInsecureFallbackDispatcher = new Agent({
      connect: {
        rejectUnauthorized: false,
      },
    });
  }

  return openAIInsecureFallbackDispatcher;
}

export function shouldRetryOpenAIWithInsecureTls(error: unknown) {
  return isTlsCertificateError(error)
    && process.env.NODE_ENV !== "production"
    && !OPENAI_CA_CERT_PATH
    && !OPENAI_ALLOW_INSECURE_TLS;
}

export async function fetchOpenAI(url: string, init: RequestInit) {
  const dispatcher = getOpenAIDispatcher();

  try {
    if (!dispatcher) {
      return await fetch(url, init);
    }

    return await fetch(url, {
      ...init,
      dispatcher,
    } as RequestInit & { dispatcher: Dispatcher });
  } catch (error) {
    if (shouldRetryOpenAIWithInsecureTls(error)) {
      console.warn(
        "OpenAI TLS validation failed in local development. Retrying once with rejectUnauthorized=false. Configure NODE_EXTRA_CA_CERTS or OPENAI_CA_CERT_PATH for an explicit trust chain."
      );

      try {
        return await fetch(url, {
          ...init,
          dispatcher: getOpenAIInsecureFallbackDispatcher(),
        } as RequestInit & { dispatcher: Dispatcher });
      } catch (retryError) {
        error = retryError;
      }
    }

    if (isTlsCertificateError(error)) {
      throw new Error(
        "OpenAI TLS validation failed. This is usually a local certificate trust issue, not an OpenAI token balance issue. Configure NODE_EXTRA_CA_CERTS before starting the dev server, set OPENAI_CA_CERT_PATH to a PEM file for your local root certificate, or for local development only set OPENAI_ALLOW_INSECURE_TLS=true and restart the dev server."
      );
    }

    throw error;
  }
}

export async function withOptionalPersistence<T>(
  label: string,
  action: () => Promise<T>,
  fallback: T
): Promise<{ value: T; available: boolean }> {
  try {
    return {
      value: await action(),
      available: true,
    };
  } catch (error) {
    if (isPersistenceUnavailableError(error)) {
      console.warn(`${label} unavailable; continuing without persistence.`, error);
      return {
        value: fallback,
        available: false,
      };
    }

    throw error;
  }
}

export function normalizeModelOutput(content: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}
