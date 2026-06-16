const PdfViewer = {
    pdfDoc: null,
    currentTool: 'none',
    docId: null,
    annotations: [],
    pdfjsLib: null,
    scale: 1.5,
    pages: [],
    dragStart: null,

    async init(pdfjsLib) {
        this.pdfjsLib = pdfjsLib;
        // Bind toolbar
        document.getElementById('btnPdfBack').addEventListener('click', () => this.close());
        document.getElementById('btnHighlight').addEventListener('click', () => this.setTool('highlight'));
        document.getElementById('btnUnderline').addEventListener('click', () => this.setTool('underline'));
        document.getElementById('btnRect').addEventListener('click', () => this.setTool('rect'));
        document.getElementById('btnNote').addEventListener('click', () => this.setTool('note'));
        document.getElementById('btnNone').addEventListener('click', () => this.setTool('none'));
        document.getElementById('btnPrevPage').addEventListener('click', () => this.prevPage());
        document.getElementById('btnNextPage').addEventListener('click', () => this.nextPage());
        document.getElementById('pageInput').addEventListener('change', () => this.goToPage());
        document.getElementById('btnZoomIn').addEventListener('click', () => this.zoom(0.25));
        document.getElementById('btnZoomOut').addEventListener('click', () => this.zoom(-0.25));
        document.getElementById('btnUploadNote').addEventListener('click', () => {
            document.getElementById('pdfNoteUpload').click();
        });
        document.getElementById('pdfNoteUpload').addEventListener('change', (e) => this.uploadNote(e));
    },

    zoom(delta) {
        this.scale = Math.max(0.5, Math.min(4.0, this.scale + delta));
        document.getElementById('zoomLabel').textContent = Math.round(this.scale * 100) + '%';
        this.renderAllPages();
    },

    async open(docId, targetPage) {
        this.docId = docId;
        this.scale = 1.5;
        document.getElementById('zoomLabel').textContent = '150%';
        document.getElementById('pdfOverlay').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        document.getElementById('annoList').innerHTML = '<div style="padding:10px;text-align:center;color:#888;font-size:12px;">加载中...</div>';
        document.getElementById('attList').innerHTML = '<div style="padding:10px;text-align:center;color:#888;font-size:12px;">加载中...</div>';
        document.getElementById('pdfContainer').innerHTML = '';

        // Load document metadata (notes)
        try {
            const doc = await API.doc(docId);
            const notesEl = document.getElementById('pdfNotes');
            notesEl.value = doc.notes || '';
            notesEl._originalNotes = doc.notes || '';
        } catch (e) { document.getElementById('pdfNotes').value = ''; }

        this.bindNotes();

        try { this.annotations = await API.annotations(docId) || []; }
        catch (e) { this.annotations = []; }
        this.renderAnnoList();
        this.loadAttachments();

        try {
            const pdfData = await fetch(`/api/documents/${docId}/pdf`);
            const buffer = await pdfData.arrayBuffer();
            this.pdfDoc = await this.pdfjsLib.getDocument({ data: buffer }).promise;
            document.getElementById('totalPages').textContent = this.pdfDoc.numPages;
            document.getElementById('pageInput').value = 1;
            await this.renderAllPages();
            if (targetPage !== undefined && targetPage >= 0) this.scrollToPage(targetPage);
        } catch (e) {
            document.getElementById('pdfContainer').innerHTML = '<div style="color:#fff;padding:40px;">无法加载 PDF: ' + e.message + '</div>';
        }
    },

    close() {
        // Save notes before closing
        this.saveNotesIfChanged();
        document.getElementById('pdfOverlay').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        this.pdfDoc = null; this.docId = null; this.annotations = []; this.pages = [];
        if (typeof App !== 'undefined' && App.state.selectedDoc) App.renderPreview();
    },

    bindNotes() {
        let saveTimer;
        const notesEl = document.getElementById('pdfNotes');
        notesEl.addEventListener('input', () => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => this.saveNotes(notesEl.value), 500);
        });
        notesEl.addEventListener('blur', () => this.saveNotes(notesEl.value));
        document.getElementById('btnExportNote').addEventListener('click', () => this.exportNotes());
    },

    async saveNotes(text) {
        if (!this.docId) return;
        if (text === this._lastSavedNotes) return;
        this._lastSavedNotes = text;
        try {
            await API.updateDoc(this.docId, { notes: text });
            // Sync back to main view
            if (typeof App !== 'undefined' && App.state.selectedDoc && App.state.selectedDoc.id === this.docId) {
                App.state.selectedDoc.notes = text;
            }
        } catch (e) { /* silent */ }
    },

    saveNotesIfChanged() {
        const notesEl = document.getElementById('pdfNotes');
        if (notesEl && notesEl.value !== notesEl._originalNotes) {
            this.saveNotes(notesEl.value);
        }
    },

    exportNotes() {
        const text = document.getElementById('pdfNotes').value;
        if (!text.trim()) { this.toast('笔记为空'); return; }
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Get title from doc
        API.doc(this.docId).then(d => {
            a.download = (d.title || 'document').replace(/[\\/:*?"<>|]/g, '_') + '_笔记.txt';
            a.click();
            URL.revokeObjectURL(url);
        }).catch(() => {
            a.download = '笔记.txt';
            a.click();
            URL.revokeObjectURL(url);
        });
        this.toast('笔记已导出');
    },

    async renderAllPages() {
        const container = document.getElementById('pdfContainer');
        container.innerHTML = '';
        this.pages = [];

        for (let i = 1; i <= this.pdfDoc.numPages; i++) {
            const page = await this.pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: this.scale });

            const pageDiv = document.createElement('div');
            pageDiv.className = 'pdf-page';
            pageDiv.dataset.page = i - 1;
            pageDiv.style.width = viewport.width + 'px';
            pageDiv.style.height = viewport.height + 'px';

            // Canvas (rendered image)
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            pageDiv.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            // Text layer using PDF.js built-in renderer for correct positioning
            const textContent = await page.getTextContent();
            const textDiv = document.createElement('div');
            textDiv.className = 'textLayer';
            textDiv.style.width = viewport.width + 'px';
            textDiv.style.height = viewport.height + 'px';
            pageDiv.appendChild(textDiv);

            if (this.pdfjsLib.renderTextLayer) {
                // PDF.js 4.x: renderTextLayer renders automatically on creation, no .render() method
                new this.pdfjsLib.renderTextLayer({
                    textContentSource: textContent,
                    container: textDiv,
                    viewport: viewport,
                });
            } else {
                // Fallback: manual span creation with corrected positioning
                for (const item of textContent.items) {
                    const tx = this.pdfjsLib.Util.transform(viewport.transform, item.transform);
                    const span = document.createElement('span');
                    span.textContent = item.str;
                    span.style.left = tx[4] + 'px';
                    span.style.top = (tx[5] - item.height * tx[3]) + 'px';
                    span.style.fontSize = Math.sqrt(tx[2]*tx[2] + tx[3]*tx[3]) + 'px';
                    span.style.fontFamily = item.fontName || 'sans-serif';
                    textDiv.appendChild(span);
                }
            }

            // Annotation overlay
            const annoLayer = document.createElement('div');
            annoLayer.className = 'annotation-layer';
            annoLayer.style.width = viewport.width + 'px';
            annoLayer.style.height = viewport.height + 'px';
            this.renderAnnotationsOnLayer(annoLayer, i - 1, viewport.width, viewport.height);
            pageDiv.appendChild(annoLayer);

            // Mouse events
            pageDiv.addEventListener('click', (e) => this.handleClick(e, pageDiv, i - 1, viewport.width, viewport.height));
            pageDiv.addEventListener('mouseup', (e) => this.handleTextSelect(e, pageDiv, i - 1, viewport.width, viewport.height));
            pageDiv.addEventListener('mousedown', (e) => this.handleMouseDown(e, pageDiv, i - 1, viewport.width, viewport.height));
            pageDiv.addEventListener('mousemove', (e) => this.handleMouseMove(e, pageDiv, i - 1, viewport.width, viewport.height));

            container.appendChild(pageDiv);
            this.pages.push({ div: pageDiv, viewport });
        }
    },

    /* ── Annotation Rendering ── */
    renderAnnotationsOnLayer(layer, pageNum, w, h) {
        for (const a of this.annotations.filter(a => a.page === pageNum)) {
            const x = (a.x || 0) * w, y = (a.y || 0) * h;
            const aw = Math.max((a.width || 0.1) * w, 5), ah = (a.height || 0.02) * h;

            if (a.anno_type === 'highlight') {
                const d = this._makeEl('hl', x, y, aw, ah, a.color + '55');
                if (a.text) d.title = a.text;
                d.addEventListener('click', ev => { ev.stopPropagation(); this.showTip(d, a); });
                layer.appendChild(d);
            } else if (a.anno_type === 'underline') {
                const d = this._makeEl('ul', x, y, aw, ah);
                d.style.borderBottom = '2px solid ' + a.color;
                d.style.bottom = (h - y - ah) + 'px';
                d.style.top = 'auto';
                if (a.text) d.title = a.text;
                d.addEventListener('click', ev => { ev.stopPropagation(); this.showTip(d, a); });
                layer.appendChild(d);
            } else if (a.anno_type === 'rect') {
                const d = this._makeEl('hl', x, y, aw, ah);
                d.style.background = 'transparent';
                d.style.border = '2px solid ' + a.color;
                if (a.text) d.title = a.text;
                d.addEventListener('click', ev => { ev.stopPropagation(); this.showTip(d, a); });
                layer.appendChild(d);
            } else if (a.anno_type === 'note') {
                const d = this._makeEl('note-icon', x, y, 20, 20);
                d.style.background = a.color || '#2563eb';
                d.textContent = 'N';
                d.addEventListener('click', ev => { ev.stopPropagation(); this.showTip(d, a); });
                layer.appendChild(d);
            }
        }
    },

    _makeEl(cls, x, y, w, h, bg) {
        const d = document.createElement('div'); d.className = cls;
        d.style.left = x + 'px'; d.style.top = y + 'px';
        d.style.width = w + 'px'; d.style.height = h + 'px';
        if (bg) d.style.background = bg;
        return d;
    },

    showTip(anchor, anno) {
        document.querySelectorAll('.note-tooltip').forEach(t => t.remove());
        const tip = document.createElement('div'); tip.className = 'note-tooltip';
        const del = document.createElement('button'); del.textContent = '✕';
        del.style.cssText = 'float:right;border:none;background:none;cursor:pointer;color:#ef4444;font-size:14px;padding:0 2px;';
        del.addEventListener('click', ev => { ev.stopPropagation(); this.deleteAnnotation(anno.id); tip.remove(); });
        tip.appendChild(del);
        tip.appendChild(document.createTextNode(anno.text || '(无内容)'));
        const ar = anchor.getBoundingClientRect();
        const cr = document.getElementById('pdfContainer').getBoundingClientRect();
        tip.style.left = (ar.right - cr.left + 8) + 'px';
        tip.style.top = (ar.top - cr.top) + 'px';
        document.getElementById('pdfContainer').appendChild(tip);
        setTimeout(() => { if (tip.parentNode) tip.remove(); }, 5000);
    },

    /* ── Mouse / Tool Handling ── */
    handleClick(e, pageDiv, pageNum, w, h) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) return; // skip if text was just selected
        if (this.currentTool !== 'note') return;
        const rect = pageDiv.getBoundingClientRect();
        const text = prompt('输入批注内容:');
        if (!text) return;
        this.createAnnotation({
            page: pageNum,
            x: (e.clientX - rect.left) / w, y: (e.clientY - rect.top) / h,
            width: 0.04, height: 0.03,
            text, anno_type: 'note',
            color: document.getElementById('annoColor').value,
        });
    },

    handleMouseDown(e, pageDiv, pageNum, w, h) {
        if (this.currentTool !== 'rect') return;
        const rect = pageDiv.getBoundingClientRect();
        this.dragStart = { pageNum, w, h, x: e.clientX - rect.left, y: e.clientY - rect.top };
    },

    handleMouseMove(e, pageDiv, pageNum, w, h) {
        if (!this.dragStart || this.dragStart.pageNum !== pageNum) return;
        // Visual feedback could be added here
    },

    handleTextSelect(e, pageDiv, pageNum, w, h) {
        if (this.currentTool === 'rect') {
            // End rect drag
            if (!this.dragStart || this.dragStart.pageNum !== pageNum) { this.dragStart = null; return; }
            const rect = pageDiv.getBoundingClientRect();
            const ex = e.clientX - rect.left, ey = e.clientY - rect.top;
            const x1 = Math.min(this.dragStart.x, ex), y1 = Math.min(this.dragStart.y, ey);
            const x2 = Math.max(this.dragStart.x, ex), y2 = Math.max(this.dragStart.y, ey);
            this.dragStart = null;
            const minW = 10 / w, minH = 10 / h;
            if ((x2 - x1) / w < minW && (y2 - y1) / h < minH) return;
            this.createAnnotation({
                page: pageNum,
                x: x1 / w, y: y1 / h,
                width: (x2 - x1) / w, height: (y2 - y1) / h,
                text: '', anno_type: 'rect',
                color: document.getElementById('annoColor').value,
            });
            return;
        }

        if (this.currentTool !== 'highlight' && this.currentTool !== 'underline') return;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        const target = pageDiv || e.target.closest('.pdf-page');
        if (!target) return;
        if (!pageDiv) { w = parseFloat(target.style.width); h = parseFloat(target.style.height); pageNum = parseInt(target.dataset.page); }
        const pageRect = target.getBoundingClientRect();
        const rects = range.getClientRects();
        if (!rects.length) return;
        const text = sel.toString().trim();
        for (const r of rects) {
            this.createAnnotation({
                page: pageNum,
                x: (r.left - pageRect.left) / w, y: (r.top - pageRect.top) / h,
                width: r.width / w, height: r.height / h,
                text, anno_type: this.currentTool,
                color: document.getElementById('annoColor').value,
            });
        }
        sel.removeAllRanges();
    },

    /* ── CRUD ── */
    async createAnnotation(data) {
        try {
            const anno = await API.createAnnotation(this.docId, data);
            this.annotations.push(anno);
            this.renderAnnoList();
            const pEl = document.querySelector(`.pdf-page[data-page="${data.page}"]`);
            if (pEl) {
                const layer = pEl.querySelector('.annotation-layer'); layer.innerHTML = '';
                this.renderAnnotationsOnLayer(layer, data.page, parseFloat(pEl.style.width), parseFloat(pEl.style.height));
            }
        } catch (e) { this.toast('创建失败: ' + e.message); }
    },

    async deleteAnnotation(annoId) {
        try {
            await API.deleteAnnotation(annoId);
            this.annotations = this.annotations.filter(a => a.id !== annoId);
            this.renderAnnoList();
            document.querySelectorAll('.pdf-page').forEach(pEl => {
                const pn = parseInt(pEl.dataset.page);
                const layer = pEl.querySelector('.annotation-layer'); layer.innerHTML = '';
                this.renderAnnotationsOnLayer(layer, pn, parseFloat(pEl.style.width), parseFloat(pEl.style.height));
            });
        } catch (e) { this.toast('删除失败: ' + e.message); }
    },

    renderAnnoList() {
        const el = document.getElementById('annoList');
        if (!this.annotations.length) { el.innerHTML = '<div style="padding:20px;text-align:center;color:#888;font-size:13px;">暂无批注</div>'; return; }
        const g = {};
        this.annotations.forEach(a => { (g[a.page + 1] = g[a.page + 1] || []).push(a); });
        el.innerHTML = Object.entries(g).sort((a,b) => a[0]-b[0]).map(([pg, items]) => `
            <div style="font-size:11px;color:#888;padding:4px 8px;font-weight:600;">第 ${pg} 页</div>
            ${items.map(a => `<div class="anno-entry" style="border-left-color:${a.color};" data-page="${a.page}">
                <div class="anno-type">${a.anno_type}</div>
                <div class="anno-text">${a.text ? esc(a.text) : '<em style="color:#aaa;">无内容</em>'}</div>
                <button class="anno-del" data-anno-id="${a.id}">✕</button>
            </div>`).join('')}
        `).join('');
        el.querySelectorAll('.anno-entry').forEach(entry => {
            entry.addEventListener('click', e => { if (!e.target.classList.contains('anno-del')) this.scrollToPage(parseInt(entry.dataset.page)); });
        });
        el.querySelectorAll('.anno-del').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); if (confirm('删除此批注？')) this.deleteAnnotation(parseInt(btn.dataset.annoId)); });
        });
    },

    /* ── Tools ── */
    setTool(tool) {
        this.currentTool = tool;
        ['Highlight','Underline','Rect','Note','None'].forEach(n => {
            document.getElementById('btn' + n).classList.toggle('active', n.toLowerCase() === tool);
        });
    },

    /* ── Navigation ── */
    scrollToPage(pn) {
        const pEl = document.querySelector(`.pdf-page[data-page="${pn}"]`);
        if (pEl) { pEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.getElementById('pageInput').value = pn + 1; }
    },
    prevPage() { const cur = parseInt(document.getElementById('pageInput').value) || 1; if (cur > 1) this.scrollToPage(cur - 2); },
    nextPage() { const cur = parseInt(document.getElementById('pageInput').value) || 1; if (cur < (this.pdfDoc?.numPages || 999)) this.scrollToPage(cur); },
    goToPage() { const p = parseInt(document.getElementById('pageInput').value); if (p >= 1 && p <= this.pdfDoc.numPages) this.scrollToPage(p - 1); },

    /* ── Attachments ── */
    async loadAttachments() {
        try {
            const atts = await API.attachments(this.docId) || [];
            this.renderAttList(atts);
        } catch (e) { document.getElementById('attList').innerHTML = '<div style="padding:10px;color:#888;font-size:12px;">加载失败</div>'; }
    },

    renderAttList(atts) {
        const el = document.getElementById('attList');
        if (!atts.length) {
            el.innerHTML = '<div style="padding:10px;text-align:center;color:#888;font-size:12px;">暂无附件</div>';
            return;
        }
        const icons = { txt: '📄', doc: '📝', docx: '📝', pdf: '📑', md: '📋', log: '📃', xlsx: '📊', xls: '📊', pptx: '🖥', csv: '📈', json: '📋', xml: '📋' };
        el.innerHTML = atts.map(a => {
            const icon = icons[a.file_type] || '📎';
            return `<div class="att-mini" data-att-id="${a.id}">
                <span class="att-icon">${icon}</span>
                <span class="att-name" title="${esc(a.filename)}">${esc(a.filename)}</span>
                <button class="att-del" data-att-id="${a.id}">✕</button>
            </div>`;
        }).join('');
        el.querySelectorAll('.att-mini').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.classList.contains('att-del')) return;
                this.viewAttachment(parseInt(row.dataset.attId));
            });
        });
        el.querySelectorAll('.att-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('删除此附件？')) this.deleteAtt(parseInt(btn.dataset.attId));
            });
        });
    },

    async viewAttachment(attId) {
        const m = document.createElement('div'); m.className = 'att-content-modal';
        m.innerHTML = `<div class="att-content-box"><h3><span>加载中...</span><button style="border:none;background:none;cursor:pointer;font-size:18px;" onclick="this.closest('.att-content-modal').remove()">✕</button></h3><div class="att-body">加载中...</div></div>`;
        document.body.appendChild(m);
        m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
        try {
            const resp = await fetch(`/api/documents/${this.docId}/attachments/${attId}/content`);
            const data = await resp.json();
            m.querySelector('h3 span').textContent = data.filename;
            if (data.ok) {
                m.querySelector('.att-body').textContent = (data.truncated ? '// --- 文件过大，仅显示前 50000 字符 ---\n' : '') + data.content;
            } else {
                m.querySelector('.att-body').innerHTML = `<p>${data.msg}</p><p><a href="/api/documents/${this.docId}/attachments/${attId}/download" target="_blank">点击下载</a></p>`;
            }
        } catch (e) {
            m.querySelector('.att-body').textContent = '加载失败: ' + e.message;
        }
    },

    async deleteAtt(attId) {
        try {
            await API.deleteAttachment(this.docId, attId);
            this.toast('附件已删除');
            this.loadAttachments();
        } catch (e) { this.toast('删除失败: ' + e.message, true); }
    },

    /* ── Upload note ── */
    async uploadNote(e) {
        const file = e.target.files[0];
        if (!file) return;
        const form = new FormData();
        form.append('file', file);
        try {
            const resp = await fetch(`/api/documents/${this.docId}/attachments`, { method: 'POST', body: form });
            if (resp.ok) {
                this.toast('附件已上传: ' + file.name);
                this.loadAttachments();
            } else {
                const err = await resp.json();
                this.toast('上传失败: ' + (err.detail || ''), true);
            }
        } catch (ex) { this.toast('上传失败: ' + ex.message, true); }
        e.target.value = '';
    },

    toast(msg, isErr) {
        const el = document.createElement('div'); el.className = 'toast' + (isErr ? ' error' : '');
        el.textContent = msg; document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    },
};

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}
