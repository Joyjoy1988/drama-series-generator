"use strict";

const https = require("https");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function anthropicRequest(apiKey, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    };

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (e) {
          reject(new Error("Failed to parse Anthropic response: " + raw.slice(0, 200)));
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  // Set CORS headers on every response
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    console.log("[generate] invoked — method:", req.method);

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log("[generate] API key present:", !!apiKey, "length:", apiKey ? apiKey.length : 0);
    console.log("[generate] API key prefix:", apiKey ? apiKey.slice(0, 10) + "..." : "MISSING");

    if (!apiKey) {
      console.error("[generate] ANTHROPIC_API_KEY env var is not set");
      return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });
    }

    const body = req.body;
    console.log("[generate] model:", body && body.model);
    console.log("[generate] max_tokens:", body && body.max_tokens);
    console.log("[generate] messages length:", body && body.messages && body.messages.length);

    if (!body || !body.model || !body.messages) {
      console.error("[generate] Invalid request body:", JSON.stringify(body).slice(0, 200));
      return res.status(400).json({ error: "Invalid request body — model and messages are required" });
    }

    console.log("[generate] Calling Anthropic...");
    const result = await anthropicRequest(apiKey, body);
    console.log("[generate] Anthropic status:", result.status);

    if (result.status !== 200) {
      console.error("[generate] Anthropic error body:", JSON.stringify(result.body));
    } else {
      console.log("[generate] stop_reason:", result.body.stop_reason);
    }

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("[generate] Unhandled error:", err.message);
    console.error("[generate] Stack:", err.stack);
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
};
