import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODEL = "claude-sonnet-4-5-20250929";
const HOURLY_LIMIT = 30;

type TextLimits = {
  headline: { maxChars: number };
  body: { maxChars: number };
  caption: { maxChars: number };
};

type SlideText = {
  slide_index: number;
  headline: string;
  body: string;
  caption: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("generation_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  return (count ?? 0) < HOURLY_LIMIT;
}

async function logUsage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  fn: string,
) {
  await supabase.from("generation_log").insert({ user_id: userId, function_name: fn });
}

function buildSystemPrompt(
  slideCount: number,
  carouselType: string,
  limits: TextLimits,
): string {
  return `You are an expert Instagram carousel copywriter.

Produce ${slideCount} slides for a ${carouselType} carousel.

Structure:
- Slide 1: a HOOK that stops the scroll.
- Slide ${slideCount}: ${carouselType === "promotional" ? "a strong CTA inviting the reader to act" : "a concise summary or memorable takeaway"}.
- Middle slides: develop the idea, one focused point each.

Strict character limits (each field must fit):
- headline: max ${limits.headline.maxChars} characters
- body: max ${limits.body.maxChars} characters
- caption: max ${limits.caption.maxChars} characters

Language: use the SAME language as the user's idea. Preserve natural style.

Output: a single JSON object { "slides": [ { "slide_index": 0, "headline": "...", "body": "...", "caption": "..." } , ... ] }
- Array length MUST equal ${slideCount}
- slide_index is 0-based and sequential
- No markdown fences, no preamble, no trailing commentary. JSON only.
- Before emitting, self-check that every field respects its character limit; shorten if needed.`;
}

async function callClaude(
  apiKey: string,
  system: string,
  userContent: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Claude API error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Empty response from model");
  return text;
}

function parseSlides(raw: string, slideCount: number): SlideText[] {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  const parsed = JSON.parse(text);
  const arr: SlideText[] = parsed.slides ?? parsed;
  if (!Array.isArray(arr) || arr.length !== slideCount) {
    throw new Error(`Expected ${slideCount} slides, got ${Array.isArray(arr) ? arr.length : "?"}`);
  }
  return arr.map((s, i) => ({
    slide_index: i,
    headline: String(s.headline ?? ""),
    body: String(s.body ?? ""),
    caption: String(s.caption ?? ""),
  }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 503);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const ok = await checkRateLimit(supabase, user.id);
    if (!ok) return json({ error: "Rate limit exceeded (30/hour)" }, 429);

    const body = await req.json();
    const { idea_text, slide_count, carousel_type, text_limits, language } = body;
    if (!idea_text || !slide_count || !text_limits) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (slide_count < 2 || slide_count > 10) {
      return json({ error: "slide_count must be 2..10" }, 400);
    }

    const system = buildSystemPrompt(slide_count, carousel_type || "educational", text_limits);
    const user_content = [
      `Idea:\n${idea_text}`,
      language ? `Language: ${language}` : null,
    ].filter(Boolean).join("\n\n");

    const raw = await callClaude(apiKey, system, user_content);
    const slides = parseSlides(raw, slide_count);
    await logUsage(supabase, user.id, "generate-carousel-texts");

    return json({ slides });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});
