export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).send("OK");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { url } = req.body || {};

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

    // Generate 3-char random ID
    const shortId = Math.random().toString(36).substring(2, 5);

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
