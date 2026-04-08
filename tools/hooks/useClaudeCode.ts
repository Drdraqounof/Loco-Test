import { useState, useCallback } from "react";

interface UseClaudeCodeOptions {
  language?: string;
  context?: string;
}

interface ClaudeCodeResponse {
  success: boolean;
  code?: string;
  error?: string;
  model?: string;
}

export function useClaudeCode() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateCode = useCallback(
    async (
      prompt: string,
      options: UseClaudeCodeOptions = {}
    ): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/claude-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            language: options.language || "javascript",
            context: options.context || "",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `HTTP error! status: ${response.status}`
          );
        }

        const data: ClaudeCodeResponse = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to generate code");
        }

        return data.code || null;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("Claude code generation error:", message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    generateCode,
    loading,
    error,
  };
}
