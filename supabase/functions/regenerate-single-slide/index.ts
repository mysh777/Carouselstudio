import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODEL = "claude-sonnet-4-5-20250929";
const HOURLY_LIMIT = 30;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Empty response");
  return text;
}

function parseOne(raw: string): { headline: string; body: string; caption: string } {
  let t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const fb = t.indexOf("{");
  const lb = t.lastIndexOf("}");
  if (fb >= 0 && lb > fb) t = t.slice(fb, lb + 1);
  const p = JSON.parse(t);
  return {
    headline: String(p.headline ?? ""),
    body: String(p.body ?? ""),
    caption: String(p.caption ?? ""),
  };
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

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("generation_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if ((count ?? 0) >= HOURLY_LIMIT) {
      return json({ error: "Rate limit exceeded (30/hour)" }, 429);
    }

    const body = await req.json();
    const { idea_text, slide_count, slides, target_index, text_limits, carousel_type } = body;
    if (
      !idea_text ||
      typeof target_index !== "number" ||
      !Array.isArray(slides) ||
      !text_limits
    ) {
      return json({ error: "Missing required fields" }, 400);
    }

    const system = `You are an expert Instagram carousel copywriter.
Regenerate slide #${target_index + 1} of ${slide_count} (${carousel_type || "educational"} carousel).
Keep structural role: ${target_index === 0 ? "HOOK" : target_index === slide_count - 1 ? (carousel_type === "promotional" ? "CTA" : "summary") : "middle point"}.
Character limits: headline ${text_limits.headline.maxChars}, body ${text_limits.body.maxChars}, caption ${text_limits.caption.maxChars}.
Match the language of the idea. Output ONE JSON object { "headline": "...", "body": "...", "caption": "..." }. No markdown, no commentary.`;

    const context = slides
      .map((s: { headline: string; body: string; caption: string }, i: number) =>
        `Slide ${i + 1}${i === target_index ? " (TO REGENERATE)" : ""}:
  headline: ${s.headline}
  body: ${s.body}
  caption: ${s.caption}`
      )
      .join("\n");

    const user_content = `Idea:\n${idea_text}\n\nCurrent slides:\n${context}\n\nRegenerate slide ${target_index + 1} with a fresh angle, while staying consistent with the others.`;

    const raw = await callClaude(apiKey, system, user_content);
    const result = parseOne(raw);
    await supabase
      .from("generation_log")
      .insert({ user_id: user.id, function_name: "regenerate-single-slide" });

    return json({ slide: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});
