import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const R2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  if (!TELEGRAM_TOKEN) return;
  const payload = { 
    chat_id: chatId, 
    text, 
    parse_mode: "HTML",
    disable_web_page_preview: true 
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function saveToSupabase(shortId, filename, storagePath) {
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
        filename: filename,
        storage_path: storagePath,
      }),
    });
    if (!dbResponse.ok) {
        const detail = await dbResponse.text();
        throw new Error(`Supabase insert failed: ${detail}`);
    }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("OK");
  
  try {
    const { message } = req.body || {};
    if (!message || !message.chat) return res.status(200).send("OK");

    const chatId = message.chat.id;

    // Handle Text / URL
    if (message.text) {
        const text = message.text.trim();
        
        if (text.startsWith('/start') || text.startsWith('/help')) {
            const welcomeText = "<b>Welcome to quickpost!</b>\n\nSend me a photo, file, text snippet, or long URL, and I will instantly reply with a short qpst.cc link to share it.";
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: "View on Github", url: "https://github.com/lunagus/quickpost" },
                        { text: "Support the project", url: "https://coff.ee/lunagus" }
                    ]
                ]
            };
            await sendTelegramMessage(chatId, welcomeText, keyboard);
            return res.status(200).send("OK");
        }

        // 1. Is it a URL?
        let isUrl = false;
        try {
            const url = new URL(text);
            if (['http:', 'https:'].includes(url.protocol)) isUrl = true;
        } catch(e) {}

        const shortId = Math.random().toString(36).substring(2, 5);

        if (isUrl) {
            // Store as __URL__ redirect
            await saveToSupabase(shortId, "__URL__", text);
        } else {
            // Store as text snippet
            const storagePath = `${shortId}.txt`;
            await R2.send(new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: storagePath,
                Body: Buffer.from(text, 'utf-8'),
                ContentType: "text/plain"
            }));
            await saveToSupabase(shortId, "snippet.txt", storagePath);
        }
        
        await sendTelegramMessage(chatId, `https://qpst.cc/${shortId}`);
        return res.status(200).send("OK");
    }

    // Handle File (Document / Photo / Video)
    let fileId, filename;
    if (message.document) {
        fileId = message.document.file_id;
        filename = message.document.file_name || "file.bin";
    } else if (message.photo && message.photo.length > 0) {
        // Get highest resolution photo (last in array)
        fileId = message.photo[message.photo.length - 1].file_id;
        filename = "photo.jpg";
    } else if (message.video) {
        fileId = message.video.file_id;
        filename = message.video.file_name || "video.mp4";
    } else if (message.animation) {
        fileId = message.animation.file_id;
        filename = message.animation.file_name || "animation.gif";
    } else {
        await sendTelegramMessage(chatId, "Unsupported message type. Send text, URLs, photos, videos, or documents.");
        return res.status(200).send("OK");
    }

    // Acknowledge receipt to avoid Telegram timeouts for large files
    await sendTelegramMessage(chatId, "Uploading...");

    // Get File Path from Telegram
    const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok) throw new Error("Failed to get file from Telegram");
    
    // Download File Buffer
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileData.result.file_path}`;
    const dlRes = await fetch(fileUrl);
    const arrayBuffer = await dlRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to R2
    const shortId = Math.random().toString(36).substring(2, 5);
    const ext = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "bin";
    const storagePath = `${shortId}.${ext}`;

    // Determine basic mime type for images/documents so browser doesn't force download
    let mime = "application/octet-stream";
    if (ext === "jpg" || ext === "jpeg") mime = "image/jpeg";
    else if (ext === "png") mime = "image/png";
    else if (ext === "gif") mime = "image/gif";
    else if (ext === "webp") mime = "image/webp";
    else if (ext === "svg") mime = "image/svg+xml";
    else if (ext === "pdf") mime = "application/pdf";
    else if (ext === "mp4") mime = "video/mp4";
    else if (ext === "webm") mime = "video/webm";
    else if (ext === "mov") mime = "video/quicktime";
    else if (ext === "mkv") mime = "video/x-matroska";

    await R2.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: storagePath,
        Body: buffer,
        ContentType: mime
    }));

    // Register Metadata
    await saveToSupabase(shortId, filename, storagePath);
    
    await sendTelegramMessage(chatId, `https://qpst.cc/${storagePath}`);
    
    return res.status(200).send("OK");

  } catch (err) {
    console.error("Telegram error:", err);
    // Try to notify the user if it failed, but safely
    try {
        if (req.body?.message?.chat?.id) {
            await sendTelegramMessage(req.body.message.chat.id, "Upload failed. The file might be too large (Telegram limits bots to 20MB) or an error occurred.");
        }
    } catch(e) {}
    
    // Always return 200 to Telegram so it doesn't infinitely retry
    return res.status(200).send("Error handled");
  }
}
