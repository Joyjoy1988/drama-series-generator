export default async function handler(req, res) {
  console.log("[generate] method:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log("[generate] ANTHROPIC_API_KEY present:", !!apiKey);
  console.log("[generate] ANTHROPIC_API_KEY length:", apiKey?.length ?? 0);
  console.log("[generate] ANTHROPIC_API_KEY prefix:", apiKey ? apiKey.slice(0, 7) + "…" : "none");

  if (!apiKey) {
    console.error("[generate] Missing ANTHROPIC_API_KEY env var");
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });
  }

  console.log("[generate] Request body model:", req.body?.model);
  console.log("[generate] Request body max_tokens:", req.body?.max_tokens);
  console.log("[generate] Messages count:", req.body?.messages?.length);

  try {
    console.log("[generate] Forwarding to Anthropic API…");
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    console.log("[generate] Anthropic response status:", upstream.status);
    const data = await upstream.json();

    if (!upstream.ok) {
      console.error("[generate] Anthropic error response:", JSON.stringify(data));
    } else {
      console.log("[generate] Success — stop_reason:", data.stop_reason);
    }

    return res.status(upstream.status).json(data);
  } catch (err) {
    console.error("[generate] Fetch threw:", err.message, err.stack);
    return res.status(502).json({ error: "Upstream request failed", detail: err.message });
  }
}
