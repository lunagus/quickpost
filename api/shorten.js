export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).send("OK");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { url, custom_id } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing or invalid URL" });
    }

    // Basic URL validation
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch (_) {
      return res.status(400).json({ error: "Invalid URL format. Must include http:// or https://" });
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return res.status(400).json({ error: "Only http/https URLs are allowed" });
    }

    let shortId;
    if (custom_id) {
        if (!/^[a-zA-Z0-9_-]{2,50}$/.test(custom_id)) {
            return res.status(400).json({ error: "Custom alias must be 2-50 characters (alphanumeric, hyphens, underscores)" });
        }
        shortId = custom_id;
    } else {
        shortId = Math.random().toString(36).substring(2, 5);
    }

    // Save to Supabase using __URL__ marker
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/files`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        short_id: shortId,
        filename: "__URL__",          // Special marker so the viewer knows it's a redirect
        storage_path: targetUrl.href, // Store the target URL here
      }),
    });

    if (!dbResponse.ok) {
      const detail = await dbResponse.text();
      // Supabase/PostgREST usually returns 409 Conflict for unique constraint violations
      if (dbResponse.status === 409 || detail.includes("duplicate key value")) {
          return res.status(409).json({ error: "Alias is already in use. Please try another one." });
      }
      throw new Error(`Database error: ${detail}`);
    }

    // Return the shortened URL
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const shortUrl = `${proto}://${host}/${shortId}`;

    return res.status(200).json({ url: shortUrl, id: shortId });

  } catch (err) {
    console.error("Shorten error:", err);
    return res.status(500).json({ error: err.message || "Shorten failed" });
  }
}
