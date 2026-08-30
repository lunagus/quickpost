import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import formidable from "formidable";
import { readFileSync, unlinkSync } from "fs";

// Disable Vercel's default body parser so formidable can handle multipart
export const config = {
  api: {
    bodyParser: false,
  },
};

const R2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).send("OK");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse multipart form data
    const form = formidable({ maxFileSize: 4.5 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const file = files.file?.[0];
    if (!file) {
      return res.status(400).json({ error: "No file provided. Use: curl -F file=@yourfile https://qpst.cc/api/upload" });
    }

    // Extract metadata
    const origName = file.originalFilename || "upload.bin";
    const ext = origName.includes(".") ? origName.split(".").pop().toLowerCase() : "bin";
    const mime = file.mimetype || "application/octet-stream";

    // Custom filename support (optional "filename" field)
    const customName = fields.filename?.[0]?.trim();
    let baseId;
    if (customName) {
      // Strip extension if user included it, sanitize to safe chars
      baseId = customName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      if (!baseId) baseId = Math.random().toString(36).substring(2, 5);
    } else {
      baseId = Math.random().toString(36).substring(2, 5);
    }

    // Enforce length limit
    if (baseId.length > 128) baseId = baseId.substring(0, 128);

    const storagePath = `${baseId}.${ext}`;

    // Read the temp file into a buffer
    const fileBuffer = readFileSync(file.filepath);

    // Clean up temp file
    try { unlinkSync(file.filepath); } catch (_) {}

    // Upload to R2
    await R2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: storagePath,
      ContentType: mime,
      Body: fileBuffer,
    }));

    // Save metadata to Supabase via REST API
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
        short_id: baseId,
        filename: storagePath,
        storage_path: storagePath,
      }),
    });

    if (!dbResponse.ok) {
      const detail = await dbResponse.text();
      throw new Error(`Database error: ${detail}`);
    }

    // Build the share URL from request headers (works in dev and prod)
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const url = `${proto}://${host}/${storagePath}`;

    // Return plain text by default (best for scripting), JSON if requested
    if (req.headers.accept?.includes("application/json")) {
      return res.status(200).json({ url, id: baseId, filename: storagePath });
    }
    return res.status(200).type("text/plain").send(url + "\n");

  } catch (err) {
    console.error("Upload error:", err);
    const message = err.code === 1009
      ? "File too large. API uploads are limited to 4.5 MB. Use the web UI for larger files."
      : err.message || "Upload failed";
    return res.status(err.code === 1009 ? 413 : 500).json({ error: message });
  }
}
