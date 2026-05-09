function getConfig() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
  };
}

export function GET() {
  return Response.json(getConfig());
}

export default function handler(_req, res) {
  const body = JSON.stringify(getConfig());

  if (res && typeof res.setHeader === "function") {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(body);
    return;
  }

  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
