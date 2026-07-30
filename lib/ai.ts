// Server-side OpenAI wrapper. Keeps the API key on the server (never shipped to
// the client) and gives every AI action one place to call. Uses plain fetch so
// there's no SDK dependency to manage.
//
// Configure by setting OPENAI_API_KEY in the environment (Vercel / Supabase).
// Optional: OPENAI_MODEL (defaults to gpt-4o-mini — cheap and fast; set to
// gpt-4o for higher quality).

export type AiResult = { text?: string; error?: string };
export type AiState = AiResult; // for useFormState

export async function openaiComplete(system: string, user: string, opts?: { model?: string; maxTokens?: number; temperature?: number }): Promise<AiResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { error: "AI isn’t configured yet — add OPENAI_API_KEY to the app environment." };
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: opts?.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: opts?.temperature ?? 0.4,
        max_tokens: opts?.maxTokens ?? 800,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      // Don't let a slow model hang a server action forever.
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { error: `AI request failed (${res.status}). ${t.slice(0, 160)}` };
    }
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content?.trim();
    return text ? { text } : { error: "The model returned no text." };
  } catch (e) {
    return { error: `AI request error: ${(e as Error).message}` };
  }
}
