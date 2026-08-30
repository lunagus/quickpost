// Metadata registration endpoint
// Used by the shell script after uploading directly to R2 via presigned URL.
// This allows the shell script to bypass Vercel's 4.5 MB body limit.

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).send("OK");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { short_id, filename, storage_path } = req.body || {};

    // Validate required fields
    if (!short_id || !filename || !storage_path) {
      return res.status(400).json({ error: "Missing required fields: short_id, filename, storage_path" });
    }
    if (typeof short_id !== "string" || typeof filename !== "string" || typeof storage_path !== "string") {
      return res.status(400).json({ error: "All fields must be strings" });
    }

    // Sanitize -- same rules as upload-url.js
    if (!/^[a-zA-Z0-9_-]+$/.test(short_id) || short_id.length > 255) {
      return res.status(400).json({ error: "Invalid short_id" });
    }
    if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(storage_path) || storage_path.length > 255) {
      return res.status(400).json({ error: "Invalid storage_path" });
    }

    // Insert into Supabase via REST API
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
      body: JSON.stringify({ short_id, filename, storage_path }),
    });

    if (!dbResponse.ok) {
      const detail = await dbResponse.text();
      throw new Error(`Database error: ${detail}`);
    }

    // Build URL from request headers
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const url = `${proto}://${host}/${storage_path}`;

    return res.status(200).json({ url, id: short_id, filename: storage_path });

  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: err.message || "Registration failed" });
  }
}
