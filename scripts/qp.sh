#!/usr/bin/env bash
# qp -- quickpost CLI uploader
# Uploads files to qpst.cc from the terminal (up to 50 MB).
#
# Usage:
#   qp file.png              Upload a file
#   cat file | qp             Upload from stdin
#   qp -n customname file.py  Upload with custom name
#
# Environment:
#   QP_URL  Base URL (default: https://qpst.cc)

set -euo pipefail

QP_URL="${QP_URL:-https://qpst.cc}"
CUSTOM_NAME=""

# --- Parse options ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--name)
      CUSTOM_NAME="$2"
      shift 2
      ;;
    -h|--help)
      echo "qp -- quickpost CLI uploader"
      echo ""
      echo "Usage:"
      echo "  qp <file>              Upload a file"
      echo "  cat <file> | qp        Upload from stdin"
      echo "  qp -n <name> <file>    Upload with custom name"
      echo ""
      echo "Options:"
      echo "  -n, --name <name>      Set a custom filename (without extension)"
      echo "  -h, --help             Show this help"
      echo ""
      echo "Environment:"
      echo "  QP_URL                 Base URL (default: https://qpst.cc)"
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

# --- Determine input file ---
TEMP_FILE=""

if [[ $# -gt 0 ]]; then
  FILE="$1"
  if [[ ! -f "$FILE" ]]; then
    echo "Error: file not found: $FILE" >&2
    exit 1
  fi
  ORIG_NAME=$(basename "$FILE")
  MIME=$(file -b --mime-type "$FILE" 2>/dev/null || echo "application/octet-stream")
else
  if [[ -t 0 ]]; then
    echo "Error: no file specified and nothing on stdin" >&2
    echo "Usage: qp <file>  or  <command> | qp" >&2
    exit 1
  fi
  TEMP_FILE=$(mktemp)
  trap 'rm -f "$TEMP_FILE"' EXIT
  cat > "$TEMP_FILE"
  FILE="$TEMP_FILE"
  ORIG_NAME="stdin.txt"
  MIME="text/plain"
fi

# --- Derive extension and ID ---
EXT="${ORIG_NAME##*.}"
[[ "$EXT" == "$ORIG_NAME" ]] && EXT="txt"
EXT=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')

if [[ -n "$CUSTOM_NAME" ]]; then
  BASE_ID=$(echo "$CUSTOM_NAME" | sed 's/\.[^.]*$//' | sed 's/[^a-zA-Z0-9_-]/_/g')
  [[ -z "$BASE_ID" ]] && BASE_ID=$(cat /dev/urandom | LC_ALL=C tr -dc 'a-z0-9' | head -c 3)
else
  BASE_ID=$(cat /dev/urandom | LC_ALL=C tr -dc 'a-z0-9' | head -c 3)
fi

STORAGE_PATH="${BASE_ID}.${EXT}"

# --- Step 1: Get presigned URL ---
PRESIGN=$(curl -sS -f -X POST "${QP_URL}/api/upload-url" \
  -H "Content-Type: application/json" \
  -d "{\"fileName\":\"${STORAGE_PATH}\",\"fileType\":\"${MIME}\"}" 2>&1) || {
  echo "Error: failed to get upload URL" >&2
  echo "$PRESIGN" >&2
  exit 1
}

UPLOAD_URL=$(echo "$PRESIGN" | sed -n 's/.*"uploadUrl":"\([^"]*\)".*/\1/p')

if [[ -z "$UPLOAD_URL" ]]; then
  echo "Error: could not parse upload URL from response" >&2
  echo "$PRESIGN" >&2
  exit 1
fi

# --- Step 2: Upload file directly to R2 (bypasses Vercel size limit) ---
HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X PUT "$UPLOAD_URL" \
  -H "Content-Type: ${MIME}" \
  --data-binary "@${FILE}")

if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 300 ]]; then
  echo "Error: upload to storage failed (HTTP ${HTTP_CODE})" >&2
  exit 1
fi

# --- Step 3: Register metadata ---
REG=$(curl -sS -f -X POST "${QP_URL}/api/register" \
  -H "Content-Type: application/json" \
  -d "{\"short_id\":\"${BASE_ID}\",\"filename\":\"${STORAGE_PATH}\",\"storage_path\":\"${STORAGE_PATH}\"}" 2>&1) || {
  echo "Error: failed to register file metadata" >&2
  echo "$REG" >&2
  exit 1
}

# --- Output the share URL ---
URL=$(echo "$REG" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')
if [[ -n "$URL" ]]; then
  echo "$URL"
else
  echo "${QP_URL}/${STORAGE_PATH}"
fi
