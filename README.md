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
- **Upload API** -- REST endpoint for terminal, scripts, and third-party tools. See [API documentation](#api) below.

---

## API

quickpost exposes a public upload API. No authentication required.

### `POST /api/upload`

Accepts a `multipart/form-data` request with a single file. Returns the share URL.

**Form fields:**

| Field      | Required | Description                                      |
|------------|----------|--------------------------------------------------|
| `file`     | Yes      | The file to upload                               |
| `filename` | No       | Custom filename (without extension). If omitted, a random 3-character ID is generated. |

**Response format:**

- **Plain text** (default) -- Returns just the URL followed by a newline. Ideal for piping in scripts.
- **JSON** -- Set `Accept: application/json` header to receive `{ "url", "id", "filename" }`.

**Size limit:** 4.5 MB (Vercel serverless constraint). For larger files, use the [shell script](#shell-script-up-to-50-mb) or the [web UI](https://qpst.cc).

### Upload via curl

```bash
# Upload a file (returns the share URL)
curl -F file=@screenshot.png https://qpst.cc/api/upload

# Upload with a custom name
curl -F file=@screenshot.png -F filename=myshot https://qpst.cc/api/upload

# Pipe from stdin
echo "print('hello')" | curl -F "file=@-;filename=hello.py" https://qpst.cc/api/upload

# Get JSON response
curl -F file=@image.png -H "Accept: application/json" https://qpst.cc/api/upload
```

**JSON response example:**

```json
{
  "url": "https://qpst.cc/abc.png",
  "id": "abc",
  "filename": "abc.png"
}
```

### Shell Script (up to 50 MB)

The `qp` shell script uses a two-step upload flow (presigned URL then direct-to-storage PUT), bypassing the 4.5 MB API limit. Supports files up to 50 MB from any terminal.

**Install:**

```bash
# Linux / macOS
curl -o ~/.local/bin/qp https://raw.githubusercontent.com/lunagus/quickpost/main/scripts/qp.sh
chmod +x ~/.local/bin/qp
```

Make sure `~/.local/bin` is in your `PATH`. Alternatively, install to `/usr/local/bin` for system-wide access.

**Usage:**

```bash
qp screenshot.png           # Upload a file, prints URL
cat code.py | qp             # Pipe from stdin
qp -n myname notes.md        # Upload with custom name
qp --help                    # Show help
```

**Environment variables:**

| Variable | Default              | Description       |
|----------|----------------------|-------------------|
| `QP_URL` | `https://qpst.cc`   | Base URL to upload to. Override for self-hosted instances. |

### ShareX

1. Download [`sharex.sxcu`](https://raw.githubusercontent.com/lunagus/quickpost/main/sharex.sxcu).
2. Open ShareX > Destinations > Custom uploader settings.
3. Click Import > From file, and select the downloaded `.sxcu` file.
4. Set quickpost as your active Image/Text/File uploader.

Screenshots and files will be uploaded to quickpost automatically, with the share URL copied to your clipboard.

### `POST /api/register`

Metadata registration endpoint used internally by the shell script. Registers a file that was uploaded directly to R2 via a presigned URL.

**JSON body:**

| Field          | Required | Description                           |
|----------------|----------|---------------------------------------|
| `short_id`     | Yes      | The file identifier (alphanumeric, hyphens, underscores) |
| `filename`     | Yes      | Display filename (e.g., `abc.py`) |
| `storage_path` | Yes      | R2 object key (e.g., `abc.py`)    |

**Response:** JSON `{ "url", "id", "filename" }`

---

## How It Works

1. **Upload (Web)** -- The client requests a presigned PUT URL from `/api/upload-url`, uploads the file directly to R2, then saves metadata (short ID, filename, storage path) to Supabase.
2. **Upload (API)** -- The serverless function receives the file, uploads to R2 server-side, and saves metadata to Supabase in a single request.
3. **Upload (Shell)** -- The script gets a presigned URL, PUTs the file directly to R2 (bypassing Vercel), then calls `/api/register` to save metadata.
4. **View** -- The SPA router extracts the ID from the URL, fetches metadata from Supabase, loads the file from R2, and renders it with syntax highlighting (code) or as an image/download.
5. **Expiry** -- A scheduled job (configured in R2 lifecycle rules) deletes files after 24 hours.

---

## Roadmap

- [x] File upload with drag-and-drop, paste, multi-file support
- [x] Code snippet viewer with Prism.js syntax highlighting
- [x] Upload API with curl and ShareX support
- [x] Shell script for terminal uploads (up to 50 MB)
- [ ] Configurable expiration -- Choose expiry duration (1h, 6h, 12h, 24h, 48h) instead of fixed 24h
- [ ] Telegram bot -- Upload files via Telegram and receive the share link in chat
- [ ] Password-protected uploads -- Optional password gate on shared files
- [ ] Download limits -- Auto-delete after N downloads
- [ ] URL shortener -- Shorten external URLs alongside file/text uploads

---

## Contributing

Contributions are welcome. If you'd like to improve quickpost, feel free to submit a Pull Request.

To report bugs or request features: [github.com/lunagus/quickpost/issues](https://github.com/lunagus/quickpost/issues)

---

## License

[GPL-3.0](LICENSE)
