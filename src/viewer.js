import { supabase } from './lib/supabase.js';
import { formatBytes, buildLangOptions, getPrismLang } from './lib/utils.js';
import Prism from 'prismjs';
import 'prismjs/plugins/line-numbers/prism-line-numbers.js';
import 'prismjs/plugins/line-numbers/prism-line-numbers.css';

// Import language grammars (Prism only ships with markup, css, clike, javascript by default)
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';

const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || "https://pub-5a982d0ce8c9473bb5fabdc82a76e57e.r2.dev";

export async function renderViewer(container, id) {
  container.innerHTML = `<div>Fetching data...</div>`;

  const { data: file, error } = await supabase.from('files').select('*').eq('short_id', id).single();

  if (error || !file) {
    container.innerHTML = `<div>404 // FILE_NOT_FOUND</div><br><a href="/" style="color:#fff;">Return home</a>`;
    return;
  }

  if (file.filename === '__URL__') {
    container.innerHTML = `<div style="text-align: center; margin-top: 2rem; color: var(--text-muted);">Redirecting to target...</div>`;
    window.location.replace(file.storage_path);
    return;
  }

  const publicUrl = `${R2_PUBLIC_URL}/${file.storage_path}`;
  const ext = file.filename.split('.').pop().toLowerCase();
  const isCode = ['js','py','json','html','css','txt','md','sql','ts','c','java'].includes(ext);

  if (isCode) {
    const text = await (await fetch(publicUrl)).text();
    renderCodeViewer(container, text, file.filename, publicUrl, ext);
    Prism.highlightAll();
  } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    // Image Viewer
    container.innerHTML = `
        <div class="upload-box" style="cursor: default; padding: 2rem;">
            <div style="margin-bottom: 1rem; font-weight: 600;">${file.filename}</div>
            <img src="${publicUrl}" alt="${file.filename}" style="max-width: 100%; border-radius: var(--radius); border: 1px solid var(--border); display: block; margin: 0 auto 1rem auto;">
            <a href="${publicUrl}" class="btn-primary" download>Download Original</a>
        </div>
        <a href="/" style="display:block; margin-top:2rem; color:#666; text-decoration:none; text-align: center;">← Upload New</a>
    `;
  } else if (['mp4', 'webm', 'mov', 'mkv', 'ogg'].includes(ext)) {
    // Video Viewer
    container.innerHTML = `
        <div class="upload-box" style="cursor: default; padding: 2rem;">
            <div style="margin-bottom: 1rem; font-weight: 600;">${file.filename}</div>
            <video src="${publicUrl}" controls playsinline style="max-width: 100%; max-height: 70vh; border-radius: var(--radius); border: 1px solid var(--border); display: block; margin: 0 auto 1rem auto;"></video>
            <a href="${publicUrl}" class="btn-primary" download>Download Original</a>
        </div>
        <a href="/" style="display:block; margin-top:2rem; color:#666; text-decoration:none; text-align: center;">← Upload New</a>
    `;
  } else if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext)) {
    // Audio Viewer
    container.innerHTML = `
        <div class="upload-box" style="cursor: default; padding: 2rem;">
            <div style="margin-bottom: 1rem; font-weight: 600;">${file.filename}</div>
            <audio src="${publicUrl}" controls style="width: 100%; max-width: 500px; display: block; margin: 0 auto 1rem auto;"></audio>
            <a href="${publicUrl}" class="btn-primary" download>Download Original</a>
        </div>
        <a href="/" style="display:block; margin-top:2rem; color:#666; text-decoration:none; text-align: center;">← Upload New</a>
    `;
  } else if (ext === 'pdf') {
    // PDF Viewer
    container.innerHTML = `
        <div class="upload-box" style="cursor: default; padding: 1rem; height: 75vh; display: flex; flex-direction: column;">
            <div style="margin-bottom: 1rem; font-weight: 600;">${file.filename}</div>
            <iframe src="${publicUrl}" style="flex: 1; width: 100%; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 1rem;"></iframe>
            <a href="${publicUrl}" class="btn-primary" download>Download Original</a>
        </div>
        <a href="/" style="display:block; margin-top:2rem; color:#666; text-decoration:none; text-align: center;">← Upload New</a>
    `;
  } else {
    // Basic download button for other files
    container.innerHTML = `
        <div class="upload-box" style="cursor: default;">
            <div style="margin-bottom: 1rem;">${file.filename}</div>
            <a href="${publicUrl}" class="btn-primary" download>Download File</a>
        </div>
        <a href="/" style="display:block; margin-top:2rem; color:#666; text-decoration:none; text-align: center;">← Upload New</a>
    `;
  }
}

function renderCodeViewer(container, text, filename, publicUrl, ext) {
  // Widen the container for code view
  document.querySelector('.container').style.maxWidth = '1200px';

  const lines = text.split('\n').length;
  const size = formatBytes(new Blob([text]).size);
  const prismLang = getPrismLang(ext);

  container.innerHTML = `
    <div class="editor-wrapper">
      <div class="viewer-header">
          <div style="display: flex; gap: 1rem; align-items: baseline;">
            <span style="font-weight: 600; color: var(--text);">${filename}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${lines} lines • ${size}</span>
          </div>
          <div class="viewer-actions">
              <select id="viewerLangSelect" style="background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text-muted); padding: 0.2rem 0.5rem; font-family: inherit; font-size: 0.75rem; margin-right: 0.5rem; cursor: pointer;">
                  ${buildLangOptions(ext)}
              </select>
              <button id="downloadBtn" class="action-btn">DOWNLOAD</button>
              <button id="editBtn" class="action-btn">EDIT</button>
              <button id="wrapBtn" class="action-btn">WRAP: OFF</button>
              <a href="${publicUrl}" target="_blank" rel="noopener noreferrer" class="action-btn">RAW</a>
              <button id="copyBtn" class="action-btn">COPY</button>
          </div>
      </div>
      <pre id="codePre" class="line-numbers"><code class="language-${prismLang}">${escapeHtml(text)}</code></pre>
    </div>
    <a href="/" style="display:block; margin-top:2rem; color:#666; text-decoration:none;">← Upload New</a>
  `;

  // Attach Events
  document.getElementById('downloadBtn').onclick = () => {
      try {
          const blob = new Blob([text], { type: 'text/plain' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
      } catch (e) {
          alert('Download failed: ' + e.message);
      }
  };

  const copyBtn = document.getElementById('copyBtn');
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'COPIED!';
      setTimeout(() => copyBtn.textContent = 'COPY', 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      copyBtn.textContent = 'ERROR';
    }
  };

  const wrapBtn = document.getElementById('wrapBtn');
  const pre = document.getElementById('codePre');
  let isWrapped = false;
  
  wrapBtn.onclick = () => {
    isWrapped = !isWrapped;
    pre.style.whiteSpace = isWrapped ? 'pre-wrap' : 'pre';
    pre.style.wordBreak = isWrapped ? 'break-word' : 'normal';
    wrapBtn.textContent = `WRAP: ${isWrapped ? 'ON' : 'OFF'}`;
  };

  // Edit Feature
  document.getElementById('editBtn').onclick = () => {
    try {
        localStorage.setItem('qp_edit_content', text);
        window.location.href = '/';
    } catch(e) {
        alert('Browser storage full or disabled. Cannot edit.');
    }
  };

  // Line Linking
  setTimeout(() => {
    if(window.location.hash && /^#L\d+$/.test(window.location.hash)) {
        const lineNum = parseInt(window.location.hash.substring(2));
        const lineEl = document.querySelector(`.line-numbers-rows > span:nth-child(${lineNum})`);
        if(lineEl) {
            lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            lineEl.style.backgroundColor = 'rgba(255, 215, 0, 0.3)';
        }
    }
  }, 500);

  // Dynamic Syntax Highlighting (re-highlight when language dropdown changes)
  document.getElementById('viewerLangSelect').onchange = (e) => {
      const newExt = e.target.value;
      const newPrismLang = getPrismLang(newExt);
      const codeEl = document.querySelector('#codePre code');
      codeEl.className = `language-${newPrismLang}`;
      Prism.highlightElement(codeEl);
  };
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
