import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function listAllInFolder(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = [prefix];
  while (stack.length) {
    const dir = stack.pop()!;
    const { data, error } = await admin.storage
      .from(bucket)
      .list(dir, { limit: 1000 });
    if (error || !data) continue;
    for (const item of data) {
      const full = dir ? `${dir}/${item.name}` : item.name;
      if (item.id === null) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { project_id, slide_paths } = await req.json();
    let paths: string[] = [];
    if (project_id) {
      paths = await listAllInFolder(admin, "carousel-photos", `${user.id}/${project_id}`);
    } else if (Array.isArray(slide_paths)) {
      paths = slide_paths.filter((p: string) => p.startsWith(`${user.id}/`));
    } else {
      return json({ error: "Missing project_id or slide_paths" }, 400);
    }

    if (paths.length === 0) return json({ removed: 0 });
    const { error } = await admin.storage.from("carousel-photos").remove(paths);
    if (error) throw error;
    return json({ removed: paths.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});
