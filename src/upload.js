import { supabase } from './lib/supabase.js';
import { formatBytes, buildLangOptions } from './lib/utils.js';
import QRCode from 'qrcode';

export function renderUpload(container) {
  // Reset layout width in case Viewer expanded it
  container.style.maxWidth = '';
  
  container.innerHTML = `
    <div class="tabs">
      <button class="tab-btn active" id="tab-file">File Upload</button>
      <button class="tab-btn" id="tab-text">Paste Text</button>
      <button class="tab-btn" id="tab-history">History</button>
    </div>

    <!-- History Container -->
    <div id="uploadHistory" style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem;"></div>

    <div id="view-file">
      <div class="upload-box" id="dropZone">
        <div style="font-size: 1.5rem; margin-bottom: 1rem;">↓</div>
        <div>Select, paste or drop files</div>
      </div>
      <div class="upload-box hidden" id="uploadSuccess" style="cursor: default; border-color: var(--accent);">
         <!-- Success content will be injected here -->
      </div>
      <input type="file" id="fileInput" hidden multiple>
    </div>
    <div id="view-text" class="hidden">
      <div class="editor-wrapper">
        <div class="editor-header">
            <span>INPUT</span>
            <select id="langSelect" style="background:var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text); font-family:inherit; cursor: pointer; padding: 2px 5px; font-size: 0.8rem;">
                ${buildLangOptions('txt')}
            </select>
        </div>
        <textarea class="code-area" id="codeInput" placeholder="// Paste content..." spellcheck="false"></textarea>
      </div>
    </div>
    
    <div id="view-history" class="hidden">
        <div id="history-list" style="display: flex; flex-direction: column; gap: 1rem;">
            <div style="text-align: center; color: var(--text-muted); padding: 2rem;">No history found.</div>
        </div>
        <button id="clearHistoryBtn" class="btn-text" style="display: block; margin: 2rem auto; font-size: 0.8rem; color: #666;">Clear History</button>
    </div>

    <div id="uploadControls" class="upload-controls">
      <input type="text" class="input-minimal" id="customName" placeholder="filename (optional)">
      <button id="uploadBtn" class="btn-primary">Upload</button>
    </div>
    
    <!-- Upload Disclaimer -->
    <div style="margin-top: 1rem; text-align: center; font-size: 0.75rem; color: var(--text-muted);">
        By uploading, you agree to our <a href="/terms" style="color: var(--text-muted); text-decoration: underline;">Terms of Service</a>
    </div>

    <!-- QR Modal -->
    <div id="qrModal" class="modal hidden">
        <div class="modal-content" style="text-align: center; max-width: 350px;">
            <h3 class="modal-title">Scan to Share</h3>
            <div style="margin: 1.5rem auto; background: white; padding: 1rem; border-radius: 8px; width: fit-content;">
                <canvas id="qrCanvas"></canvas>
            </div>
            <button class="btn-text" id="closeQr">Close</button>
        </div>
    </div>
  `;
  attachEvents();
}

// Track selected files for multi-file support
let selectedFiles = [];

function attachEvents() {
  const fileView = document.getElementById('view-file');
  const textView = document.getElementById('view-text');
  const historyView = document.getElementById('view-history');
  const uploadControls = document.getElementById('uploadControls');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const codeInput = document.getElementById('codeInput');
  
  // Helper to reset the form inputs
  const resetForm = () => {
      document.getElementById('customName').value = "";
      fileInput.value = ""; 
      codeInput.value = ""; 
      selectedFiles = [];
      dropZone.innerHTML = `
        <div style="font-size: 1.5rem; margin-bottom: 1rem;">↓</div>
        <div>Select, paste or drop files</div>
      `;
      const btn = document.getElementById('uploadBtn');
      btn.innerText = "Upload";
      btn.disabled = false;
  };

  const updateTabs = (activeId) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(activeId).classList.add('active');
  };

  document.getElementById('tab-file').onclick = () => {
    fileView.classList.remove('hidden'); 
    textView.classList.add('hidden'); 
    historyView.classList.add('hidden');
    uploadControls.classList.remove('hidden');
    document.getElementById('uploadHistory').classList.remove('hidden');
    updateTabs('tab-file');
  };
  
  document.getElementById('tab-text').onclick = () => {
    textView.classList.remove('hidden'); 
    fileView.classList.add('hidden'); 
    historyView.classList.add('hidden');
    uploadControls.classList.remove('hidden');
    document.getElementById('uploadHistory').classList.remove('hidden');
    updateTabs('tab-text');
  };
  
  document.getElementById('tab-history').onclick = () => {
    renderHistoryList();
    historyView.classList.remove('hidden'); 
    fileView.classList.add('hidden'); 
    textView.classList.add('hidden');
    uploadControls.classList.add('hidden');
    document.getElementById('uploadHistory').classList.add('hidden');
    updateTabs('tab-history');
  };

  document.getElementById('clearHistoryBtn').onclick = () => {
      if(confirm('Clear all local upload history?')) {
          localStorage.removeItem('qp_upload_history');
          renderHistoryList();
      }
  };

  // File input change
  dropZone.onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    if (e.target.files.length > 0) {
      selectedFiles = Array.from(e.target.files);
      updateDropZoneLabel();
    }
  };

  // Drag and Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      selectedFiles = files;
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      fileInput.files = dt.files;
      updateDropZoneLabel();
    }
  });

  document.getElementById('uploadBtn').onclick = handleUpload;
  
  // Close QR Modal
  document.getElementById('closeQr').onclick = () => document.getElementById('qrModal').classList.add('hidden');

  // Edit Feature: Check if we have content to edit
  const editContent = localStorage.getItem('qp_edit_content');
  if (editContent) {
      localStorage.removeItem('qp_edit_content');
      document.getElementById('tab-text').click();
      codeInput.value = editContent;
      codeInput.dispatchEvent(new Event('input'));
  }

  // Ctrl+Enter / Cmd+Enter keyboard shortcut for upload
  codeInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleUpload();
    }
  });

  // Global Paste Handler
  document.onpaste = (e) => {
    if (['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName) && 
        (document.activeElement.type === 'text' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
    }
    // Switch to upload view if on history
    if(!historyView.classList.contains('hidden')) {
        document.getElementById('tab-file').click();
    }

    const items = (e.clipboardData || e.originalEvent.clipboardData).items;

    // Check for Image
    for (const item of items) {
        if (item.type.indexOf("image") === 0) {
            e.preventDefault();
            const blob = item.getAsFile();
            const file = new File([blob], `pasted_image_${Date.now()}.png`, { type: item.type });
            document.getElementById('tab-file').click();
            selectedFiles = [file];
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            updateDropZoneLabel();
            return; 
        }
    }

    // Check for Text
    for (const item of items) {
        if (item.type === "text/plain") {
             e.preventDefault();
             item.getAsString((s) => {
                 if(!s.trim()) return;
                 document.getElementById('tab-text').click();
                 codeInput.value = s;
                 codeInput.dispatchEvent(new Event('input'));
                 codeInput.focus();
             });
             return;
        }
    }
  };
  
  // Event delegation for result card buttons (no more window globals)
  document.getElementById('uploadHistory').addEventListener('click', handleHistoryAction);

  // Store resetForm reference
  window._qpResetForm = resetForm;
}

function updateDropZoneLabel() {
  const dropZone = document.getElementById('dropZone');
  if (selectedFiles.length === 1) {
    dropZone.innerHTML = `<div>SELECTED: ${selectedFiles[0].name}</div>`;
  } else if (selectedFiles.length > 1) {
    dropZone.innerHTML = `<div>SELECTED: ${selectedFiles.length} files</div>`;
  }
}

function handleHistoryAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  
  const action = btn.dataset.action;
  const url = btn.dataset.url;
  const inputId = btn.dataset.inputId;
  
  if (action === 'copy') {
    const input = document.getElementById(inputId);
    if (input) {
      navigator.clipboard.writeText(input.value);
      input.classList.add('success-ring');
      setTimeout(() => input.classList.remove('success-ring'), 1000);
    }
  } else if (action === 'copy-raw') {
    copyRaw(btn, url);
  } else if (action === 'qr') {
    showQr(url);
  }
}

async function copyRaw(btn, url) {
  try {
    const text = await (await fetch(url)).text();
    if (!text) return alert("Content not available");
    navigator.clipboard.writeText(text);
    const old = btn.innerText;
    btn.innerText = 'COPIED';
    setTimeout(() => btn.innerText = old, 1500);
  } catch(e) {
    alert("Failed to copy raw content");
  }
}

function showQr(url) {
  const modal = document.getElementById('qrModal');
  const canvas = document.getElementById('qrCanvas');
  modal.classList.remove('hidden');
  QRCode.toCanvas(canvas, url, { width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' } }, function (error) {
    if (error) console.error(error);
  });
}

function saveToHistory(item) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem('qp_upload_history') || '[]'); } catch(e){}
    history.unshift(item);
    if(history.length > 50) history = history.slice(0, 50);
    localStorage.setItem('qp_upload_history', JSON.stringify(history));
}

function renderHistoryList() {
    const list = document.getElementById('history-list');
    let history = [];
    try { history = JSON.parse(localStorage.getItem('qp_upload_history') || '[]'); } catch(e){}
    
    if(history.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No history found.</div>';
        return;
    }
    
    list.innerHTML = history.map((item, index) => {
        const inputId = `hist-${index}`;
        return `
        <div class="upload-box history-card">
            <div class="history-header">
                 <div class="history-meta">
                    <div style="font-weight: 600; font-size: 0.9rem; color: var(--text);">${item.fileName}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(item.date).toLocaleString()}</div>
                 </div>
                 <div class="tag">${item.type}</div>
            </div>
             <div class="url-group">
                <input type="text" value="${item.url}" id="${inputId}" class="url-input" readonly>
                <div class="url-actions">
                    <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="action-btn">OPEN</a>
                </div>
            </div>
        </div>
    `}).join('');
}

async function handleUpload() {
  try {
    const isFile = !document.getElementById('view-file').classList.contains('hidden');
    const customName = document.getElementById('customName').value.trim();

    if (isFile) {
      // Multi-file upload
      if (selectedFiles.length === 0) {
        const fileInput = document.getElementById('fileInput');
        if (fileInput.files.length > 0) {
          selectedFiles = Array.from(fileInput.files);
        }
      }
      if (selectedFiles.length === 0) throw new Error("No file selected");
      
      const btn = document.getElementById('uploadBtn');
      const totalFiles = selectedFiles.length;
      btn.disabled = true;
      
      for (let i = 0; i < totalFiles; i++) {
        const file = selectedFiles[i];
        const prefix = totalFiles > 1 ? `(${i + 1}/${totalFiles}) ` : '';
        btn.innerText = `${prefix}Uploading...`;
        
        // Only use custom name for single file uploads
        const name = totalFiles === 1 ? (customName || file.name) : file.name;
        await uploadSingleFile(file, name, btn, prefix, true);
      }
      
      window._qpResetForm();
      
    } else {
      // Text snippet upload
      const codeInput = document.getElementById('codeInput');
      const content = codeInput.value;
      if (!content) throw new Error("Please enter some text");
      
      const ext = document.getElementById('langSelect').value;
      const fileName = customName ? (customName.includes('.') ? customName : `${customName}.${ext}`) : `snippet.${ext}`;
      const file = new File([content], fileName, { type: 'text/plain' });
      
      const btn = document.getElementById('uploadBtn');
      btn.innerText = "Uploading...";
      btn.disabled = true;
      
      await uploadSingleFile(file, fileName, btn, '', false, content);
      window._qpResetForm();
    }

  } catch (err) {
      console.error(err);
      alert("Error: " + (err.message || err));
      const btn = document.getElementById('uploadBtn');
      if(btn) {
          btn.innerText = "Upload";
          btn.disabled = false;
      }
  }
}

async function uploadSingleFile(file, fileName, btn, prefix = '', isFileUpload = true, rawContentOverride = null) {
    // === VALIDATION ===
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        throw new Error(`File is too large (${formatBytes(file.size)}). Maximum allowed size is 50MB.`);
    }
    if (file.size === 0) {
        throw new Error("File is empty (0 bytes). Cannot upload.");
    }
    if (fileName.length > 255) {
        throw new Error("Filename is too long. Please rename it to under 255 characters.");
    }

    // === FILENAME & PATH CONFIGURATION ===
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'txt';
    const customName = document.getElementById('customName').value.trim();

    let baseId;
    if (customName && selectedFiles.length <= 1) {
        const lowerName = customName.toLowerCase();
        const lowerExt = '.' + ext;
        if (lowerName.endsWith(lowerExt)) {
            baseId = customName.slice(0, -lowerExt.length);
        } else {
            baseId = customName;
        }
    } else {
        // 3-char base36 ID (~46K possibilities, sufficient for 24h ephemeral files)
        baseId = Math.random().toString(36).substring(2, 5);
    }

    const shortId = baseId;
    const path = `${baseId}.${ext}`;
    const displayName = path;

    // Cache raw content for "Raw Copy" button
    let rawContentToCopy = rawContentOverride;
    if (!rawContentToCopy && file.size < 1024 * 512) {
        try { rawContentToCopy = await file.text(); } catch(e) {}
    }

    // === GET PRESIGNED URL ===
    const presignResponse = await fetch('/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: path, fileType: file.type })
    });

    if (!presignResponse.ok) {
        throw new Error('Failed to get secure upload URL from server');
    }
    
    const { uploadUrl } = await presignResponse.json();

    // === UPLOAD TO R2 WITH PROGRESS ===
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          btn.innerText = `${prefix}Uploading... ${pct}%`;
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error('Upload to storage failed'));
        }
      });
      
      xhr.addEventListener('error', () => reject(new Error('Upload to storage failed')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
      
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    // === SAVE METADATA TO SUPABASE ===
    const { error: dbErr } = await supabase.from('files').insert({ short_id: shortId, filename: displayName, storage_path: path });
    if (dbErr) throw dbErr;

    // === SUCCESS UI ===
    const directLink = `https://qpst.cc/${path}`;
    const showRaw = rawContentToCopy !== null && ['txt','js','py','html','css','json','sql','md','ts','c','java'].includes(ext);

    saveToHistory({
        fileName: displayName,
        url: directLink,
        date: new Date().toISOString(),
        type: isFileUpload ? 'File' : `Snippet (${ext})`
    });

    const resultCard = document.createElement('div');
    resultCard.className = 'upload-box history-card';
    resultCard.style.marginBottom = '1rem'; 
    
    const resultId = Math.random().toString(36).substring(7);

    resultCard.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.25rem; width: 100%; text-align: left;">
          <div style="color: var(--accent); font-size: 1rem; font-weight: 700;">UPLOAD COMPLETE</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">File: ${displayName}</div>
          
          <div class="url-group">
              <input type="text" value="${directLink}" id="url-${resultId}" class="url-input" readonly>
              
              <div class="url-actions">
                   <button data-action="qr" data-url="${directLink}" class="action-btn" title="Show QR Code">QR</button>
                  ${showRaw ? `<button data-action="copy-raw" data-url="${directLink}" class="action-btn" title="Copy Raw Content">RAW</button>` : ''}
                  <button data-action="copy" data-input-id="url-${resultId}" class="action-btn">COPY</button>
                   <a href="${directLink}" target="_blank" rel="noopener noreferrer" class="action-btn">OPEN</a>
              </div>
          </div>
          
           <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">
              Expires in 24h
          </div>
      </div>
    `;

    document.getElementById('uploadHistory').prepend(resultCard);
}
