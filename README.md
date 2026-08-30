# quickpost

A lightweight, ephemeral file and code snippet sharing platform. Upload, get a short link, share it. Files auto-delete after 24 hours. No accounts, no tracking.

**Live at [qpst.cc](https://qpst.cc)**

---

## Features

- **File Upload** -- Select, drag-and-drop, paste from clipboard, or browse one or multiple files. Supports images, PDFs, archives, and any file type up to 50 MB.
- **Code Snippets** -- Paste text with syntax highlighting for Python, JavaScript, TypeScript, HTML, CSS, JSON, Java, C/C++, SQL, and Markdown.
- **Code Viewer** -- Line numbers, word wrap toggle, download, copy, raw view, re-edit, and language switching.
- **Short URLs** -- Clean `qpst.cc/<id>` links with optional custom filenames.
- **QR Codes** -- Generate a scannable QR code for any upload link.
- **Upload History** -- Client-side history stored in localStorage. Never touches the server.
- **Direct File Links** -- Image and file URLs resolve directly (e.g., `qpst.cc/abc.png` serves the file).

---

## How It Works

1. **Upload** -- The client requests a presigned PUT URL from `/api/upload-url`, uploads the file directly to R2, then saves metadata (short ID, filename, storage path) to Supabase.
2. **View** -- The SPA router extracts the ID from the URL, fetches metadata from Supabase, loads the file from R2, and renders it with syntax highlighting (code) or as an image/download.
3. **Expiry** -- A scheduled job (configured in R2 lifecycle rules) deletes files after 24 hours.

---

## New Features Roadmap

- **Upload via curl / shell script** -- A simple `curl -F` one-liner or a lightweight shell script to upload files from the terminal and receive the share link in stdout.
- **Upload API** -- A proper REST endpoint returning JSON or plain text responses, compatible with ShareX, Flameshot, and other screenshot tools.
- **Configurable expiration** -- Allow users to choose expiry duration (1h, 6h, 12h, 24h, 48h) instead of a fixed 24-hour window.
- **Telegram bot** -- Upload files via a Telegram bot and receive the share link in chat.
- **Password-protected uploads** -- Optional password gate on shared files.
- **Download limits** -- Set a maximum number of downloads before a file is automatically deleted.
- **URL shortener** -- Shorten external URLs alongside file/text uploads.

---

## Contributing

Contributions are welcome. If you'd like to improve QuickPost, feel free to submit a Pull Request.

To report bugs or request features: [github.com/lunagus/QuickPost/issues](https://github.com/lunagus/quickpost/issues)

---

## License

[GPL-3.0](LICENSE)
