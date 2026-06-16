const App = {
    state: { docs: [], selectedDoc: null, activeTag: null },

    /* ── Init ── */
    async init() {
        // Init PdfViewer
        const initPdf = () => {
            if (typeof pdfjsLib !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
                PdfViewer.init(pdfjsLib);
            }
        };
        if (typeof pdfjsLib !== 'undefined') initPdf();
        else window.addEventListener('load', initPdf);

        // Bind controls
        document.getElementById("btnNewTag").addEventListener("click", () => Tags.showCreateDialog());
        document.getElementById("btnZoteroImport").addEventListener("click", () => ImportUI.showDialog());
        document.getElementById("btnAddDoc").addEventListener("click", () => this.showAddDialog());
        document.getElementById("searchInput").addEventListener("input", () => this.search());
        document.getElementById("yearFilter").addEventListener("change", () => this.search());

        // Language toggle — inside settings popup
        document.getElementById("popupLang").addEventListener("click", () => {
            const next = getLang() === 'zh' ? 'en' : 'zh';
            setLang(next);
            document.getElementById("popupLang").textContent = t('app.langToggle');
            applyStaticI18n();
            document.title = t('app.title');
            document.getElementById("settingsPopup").classList.remove("show");
        });

        // Settings (gear) button + popup
        this.initSettings();

        // Resizers
        this.initResizers();

        // Clean up orphaned records (files deleted from disk)
        try { await fetch("/api/documents/cleanup-orphans"); } catch(e) {}

        // Apply initial i18n
        document.title = t('app.title');

        await Tags.loadTree();
        await this.search();
    },

    /* ── Resizers ── */
    initResizers() {
        let sidebar = document.getElementById("sidebar");
        let rsSide = document.getElementById("resizerSidebar");
        let startX, startW;
        rsSide.addEventListener("mousedown", (e) => {
            startX = e.clientX;
            startW = sidebar.offsetWidth;
            rsSide.classList.add("active");
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
        });
        document.addEventListener("mousemove", (e) => {
            if (!rsSide.classList.contains("active")) return;
            const w = Math.max(160, Math.min(500, startW + (e.clientX - startX)));
            sidebar.style.width = w + "px";
            sidebar.style.minWidth = w + "px";
        });
        document.addEventListener("mouseup", () => {
            rsSide.classList.remove("active");
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        });

        let grid = document.getElementById("docGrid");
        let preview = document.getElementById("preview");
        let rsPrev = document.getElementById("resizerPreview");
        let startY, startGH;
        rsPrev.addEventListener("mousedown", (e) => {
            startY = e.clientY;
            startGH = grid.offsetHeight;
            rsPrev.classList.add("active");
            document.body.style.cursor = "row-resize";
            document.body.style.userSelect = "none";
        });
        document.addEventListener("mousemove", (e) => {
            if (!rsPrev.classList.contains("active")) return;
            const delta = startY - e.clientY;
            const totalH = grid.offsetHeight + preview.offsetHeight + 4;
            const newGH = Math.max(100, Math.min(totalH - 120, startGH - delta));
            grid.style.flex = "none";
            grid.style.height = newGH + "px";
            preview.style.flex = "1";
        });
        document.addEventListener("mouseup", () => {
            rsPrev.classList.remove("active");
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        });
    },

    /* ── Search ── */
    async search() {
        const q = document.getElementById("searchInput").value.trim();
        const year = document.getElementById("yearFilter").value;
        const params = {};
        if (q) params.q = q;
        if (year) params.year = year;
        if (this.state.activeTag) {
            if (this.state.activeTag === '__untagged__') {
                params.untagged = 'true';
            } else {
                params.tag = this.state.activeTag;
            }
        }
        try { this.state.docs = await API.docs(params); }
        catch (e) { this.toast(e.message, true); this.state.docs = []; }
        this.renderGrid();
        this.updateYearFilter();
    },

    /* ── Card Grid ── */
    renderGrid() {
        const el = document.getElementById("docGrid");
        if (!this.state.docs.length) {
            el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);font-size:14px;">' + t('empty.noDocs') + '</div>';
            return;
        }
        el.innerHTML = this.state.docs.map(d => {
            const sel = this.state.selectedDoc?.id === d.id ? ' selected' : '';
            const meta = [d.authors, d.year, d.journal].filter(Boolean).join(' · ') || t('empty.metaPending');
            return `<div class="doc-card${sel}" data-doc-id="${d.id}">
                <img class="card-thumb" src="/api/documents/${d.id}/thumbnail"
                     loading="lazy" onerror="this.replaceWith(placeholder())"
                     alt="">
                <div class="card-body">
                    <div class="card-title" title="${this.esc(d.title)}">${this.esc(d.title)}</div>
                    <div class="card-meta">${this.esc(meta)}</div>
                    <div class="card-tags">${(d.tags||[]).map(t =>
                        `<span class="card-tag" style="background:${t.color}">${this.esc(t.name)}</span>`
                    ).join('')}</div>
                </div>
            </div>`;
        }).join('');

        window._placeholderIdx = 0;

        el.querySelectorAll(".card-thumb").forEach(img => {
            img.addEventListener("error", function() {
                const ph = document.createElement('div');
                ph.className = 'card-thumb-placeholder';
                ph.innerHTML = '&#128214;';
                this.replaceWith(ph);
            });
        });
        el.querySelectorAll(".doc-card").forEach(card => {
            const docId = parseInt(card.dataset.docId);
            card.addEventListener("click", () => this.selectDoc(docId));
            card.addEventListener("dblclick", () => this.openPdf(docId));
        });
    },

    updateYearFilter() {
        const years = [...new Set(this.state.docs.map(d => d.year).filter(Boolean))].sort((a,b)=>b-a);
        const sel = document.getElementById("yearFilter");
        const cur = sel.value;
        sel.innerHTML = '<option value="">' + t('toolbar.allYears') + '</option>' + years.map(y => `<option value="${y}">${y}</option>`).join("");
        sel.value = cur;
    },

    /* ── Select & Preview ── */
    async selectDoc(id) {
        try {
            const doc = await API.doc(id);
            this.state.selectedDoc = doc;
            this.renderGrid();
            await this.renderPreview();
        } catch (e) { this.toast(e.message, true); }
    },

    async renderPreview() {
        const doc = this.state.selectedDoc;
        const panel = document.getElementById("preview");
        if (!doc) {
            panel.className = "empty";
            panel.innerHTML = "<span>" + t('empty.preview') + "</span>";
            return;
        }
        panel.className = "";

        let annos = [];
        try { annos = await API.annotations(doc.id) || []; } catch (e) {}

        const grouped = {};
        annos.forEach(a => { grouped[a.page+1] = (grouped[a.page+1]||[]).concat(a); });

        panel.innerHTML = `
            <div id="previewHeader">
                <input id="previewTitle" value="${this.esc(doc.title)}" style="flex:1;font-size:14px;font-weight:600;padding:4px 6px;border-radius:4px;" title="${t('preview.editTitle')}">
                <button id="btnDeleteDoc" class="btn btn-danger btn-sm" style="flex-shrink:0;">${t('preview.delete')}</button>
            </div>
            <div id="previewContent" style="display:flex;gap:12px;flex:1;overflow:hidden;">
                <!-- Col 1: Annotations -->
                <div class="col" style="flex:2;">
                    <h4>${t('preview.annotations', {count: annos.length})}</h4>
                    <div style="overflow-y:auto;flex:1;">
                    ${annos.length ? Object.entries(grouped).reverse().map(([page, items]) =>
                        items.map(a => `<div class="anno-mini" style="border-left-color:${a.color};" data-page="${a.page}">
                            <span class="type">${t('preview.page')}${page}${t('preview.pageSuffix')} ${a.anno_type}</span>
                            <div>${a.text ? this.esc(a.text) : '<em>' + t('empty.noContent') + '</em>'}</div>
                        </div>`).join('')
                    ).join('') : '<div class="note-mini">' + t('empty.noAnnotations') + '</div>'}
                    </div>
                </div>
                <!-- Col 2: Editable metadata -->
                <div class="col" style="flex:2;">
                    <h4>${t('preview.info')}</h4>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <div><label style="font-size:10px;color:var(--text-muted);">${t('preview.journal')}</label>
                            <input id="previewJournal" value="${this.esc(doc.journal||'')}" style="width:100%;padding:4px 6px;font-size:12px;"></div>
                        <div><label style="font-size:10px;color:var(--text-muted);">${t('preview.authors')}</label>
                            <input id="previewAuthors" value="${this.esc(doc.authors||'')}" style="width:100%;padding:4px 6px;font-size:12px;"></div>
                        <div><label style="font-size:10px;color:var(--text-muted);">${t('preview.year')}</label>
                            <input type="number" id="previewYear" value="${doc.year||''}" style="width:100%;padding:4px 6px;font-size:12px;"></div>
                        <div><label style="font-size:10px;color:var(--text-muted);">${t('preview.doi')}</label>
                            <input id="previewDoi" value="${doc.doi||''}" style="width:100%;padding:4px 6px;font-size:12px;"></div>
                        <div><label style="font-size:10px;color:var(--text-muted);">${t('preview.tags')}</label>
                            <div class="card-tags" id="previewTags" style="margin-bottom:3px;">${(doc.tags||[]).map(t =>
                                `<span class="card-tag" style="background:${t.color};cursor:default;">${this.esc(t.name)}<span data-remove-tag="${t.id}" style="cursor:pointer;margin-left:2px;">&times;</span></span>`
                            ).join('') || '<span class="note-mini">' + t('empty.none') + '</span>'}</div>
                            <select id="previewAddTag" style="width:100%;padding:3px;font-size:11px;border:1px solid var(--border);border-radius:4px;"><option value="">${t('preview.addTag')}</option></select>
                        </div>
                    </div>
                </div>
                <!-- Col 3: Notes -->
                <div class="col" style="flex:3;">
                    <h4>${t('preview.notes')}</h4>
                    <textarea id="previewNotes" style="width:100%;flex:1;min-height:120px;padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;resize:vertical;font-family:inherit;">${this.esc(doc.notes||'')}</textarea>
                </div>
            </div>`;

        // --- Bind events ---
        const titleEl = document.getElementById("previewTitle");
        titleEl.addEventListener("focus", () => { titleEl.style.borderColor = "var(--primary)"; titleEl.style.background = "#fff"; });
        titleEl.addEventListener("blur", () => { titleEl.style.borderColor = ""; titleEl.style.background = ""; this.saveField("title", titleEl.value); });
        titleEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); titleEl.blur(); } });

        ["previewYear","previewJournal","previewDoi","previewAuthors"].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const field = id.replace("preview","").toLowerCase();
            el.addEventListener("change", () => this.saveField(field, el.value));
        });

        const notesEl = document.getElementById("previewNotes");
        let notesTimer;
        notesEl.addEventListener("input", () => {
            clearTimeout(notesTimer);
            notesTimer = setTimeout(() => this.saveField("notes", notesEl.value), 600);
        });

        document.getElementById("btnDeleteDoc").addEventListener("click", () => {
            if (confirm(t('delete.docConfirm', {title: doc.title.slice(0,50)}))) this.deleteDoc(doc.id);
        });

        document.querySelectorAll("#previewTags [data-remove-tag]").forEach(sp => {
            sp.addEventListener("click", async (e) => {
                e.stopPropagation();
                await API.removeDocTag(parseInt(sp.dataset.removeTag), doc.id);
                const d = await API.doc(doc.id); this.state.selectedDoc = d;
                this.renderGrid(); this.renderPreview();
            });
        });
        this.fillPreviewTags();

        const tagSel = document.getElementById("previewAddTag");
        tagSel.addEventListener("change", async function() {
            if (!this.value) return;
            await API.addDocTag(parseInt(this.value), doc.id);
            const d = await API.doc(doc.id); App.state.selectedDoc = d;
            App.renderGrid(); App.renderPreview();
        });

        panel.querySelectorAll(".anno-mini").forEach(el => {
            el.addEventListener("click", () => this.openPdf(doc.id, parseInt(el.dataset.page)));
        });
    },

    async saveField(field, value) {
        const doc = this.state.selectedDoc;
        if (!doc) return;
        const data = {};
        data[field] = field === "year" ? (parseInt(value) || null) : value;
        try {
            const updated = await API.updateDoc(doc.id, data);
            this.state.selectedDoc = updated;
            this.renderGrid();
            if (field === "notes" && typeof PdfViewer !== 'undefined' && PdfViewer.docId === doc.id) {
                const el = document.getElementById("pdfNotes");
                if (el && el.value !== value) el.value = value;
            }
        } catch (e) { this.toast(e.message, true); }
    },

    async fillPreviewTags() {
        try {
            const all = await API.tags();
            const docTagIds = (this.state.selectedDoc.tags||[]).map(t=>t.id);
            const avail = all.filter(t=>!docTagIds.includes(t.id));
            const sel = document.getElementById("previewAddTag");
            if (sel) sel.innerHTML = '<option value="">' + t('preview.addTag') + '</option>' + avail.map(t=>`<option value="${t.id}">${t.name}</option>`).join("");
        } catch(e){}
    },

    /* ── PDF Viewer ── */
    openPdf(docId, page) {
        PdfViewer.open(docId, page);
    },

    /* ── Add / Edit Modals ── */
    showAddDialog() {
        const m = document.getElementById("modalContainer");
        m.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal">
            <h3>${t('addDoc.title')}</h3>
            <div class="form-group"><label>${t('addDoc.pdfFile')}</label><input type="file" id="addPdf" accept=".pdf"></div>
            <div id="extractStatus" style="font-size:11px;color:var(--text-muted);margin-bottom:4px;display:none;"></div>
            <div id="dupWarning" style="font-size:12px;color:#f59e0b;margin-bottom:4px;display:none;"></div>
            <div class="form-group"><label>${t('addDoc.titleField')}</label><input id="addTitle"></div>
            <div class="form-group"><label>${t('addDoc.authors')}</label><input id="addAuthors"></div>
            <div class="form-group"><label>${t('addDoc.year')}</label><input type="number" id="addYear"></div>
            <div class="form-group"><label>${t('addDoc.journal')}</label><input id="addJournal"></div>
            <div class="form-group"><label>${t('addDoc.doi')}</label><input id="addDoi"></div>
            <div class="form-group"><label>${t('addDoc.abstract')}</label><textarea id="addAbstract"></textarea></div>
            <div class="form-actions">
                <button class="btn" id="btnCancel">${t('addDoc.cancel')}</button>
                <button class="btn btn-primary" id="btnCreate">${t('addDoc.add')}</button>
            </div>
        </div></div>`;
        document.getElementById("btnCancel").addEventListener("click", () => this.closeModal());
        document.getElementById("modalOverlay").addEventListener("click", e => { if (e.target.id==="modalOverlay") this.closeModal(); });
        document.getElementById("btnCreate").addEventListener("click", () => this.createDoc());
        document.getElementById("addPdf").addEventListener("change", async function() {
            const f = this.files[0]; if (!f) return;
            const filename = f.name.replace(/\.[^.]+$/, "");
            document.getElementById("addTitle").value = filename;
            document.getElementById("addTitle").style.borderColor = "";
            document.getElementById("dupWarning").style.display = "none";
            const s = document.getElementById("extractStatus"); s.style.display="block"; s.textContent=t('addDoc.extracting');
            try {
                const meta = await API.extractMeta(f);
                if (meta.title) { document.getElementById("addTitle").value = meta.title; document.getElementById("addTitle").style.borderColor="#22c55e"; }
                if (meta.authors) document.getElementById("addAuthors").value = meta.authors;
                if (meta.doi) document.getElementById("addDoi").value = meta.doi.replace(/^\.org\//,'');
                s.textContent = meta.title ? t('addDoc.autoFilled') : t('addDoc.filenameUsed');
                s.style.color = meta.title ? "#22c55e" : "var(--text-muted)";
                App._checkDup();
            } catch (e) { s.textContent = t('addDoc.filenameUsed'); s.style.color = "var(--text-muted)"; }
        });
        document.getElementById("addTitle").addEventListener("input", () => App._checkDup());
        document.getElementById("addAuthors").addEventListener("input", () => App._checkDup());
        document.getElementById("addYear").addEventListener("input", () => App._checkDup());
    },

    async _checkDup() {
        const title = document.getElementById("addTitle")?.value.trim();
        if (!title) return;
        const dup = document.getElementById("dupWarning");
        try {
            const authors = document.getElementById("addAuthors")?.value.trim() || "";
            const year = document.getElementById("addYear")?.value.trim() || "";
            const params = `?title=${encodeURIComponent(title)}&authors=${encodeURIComponent(authors)}&year=${encodeURIComponent(year)}`;
            const resp = await fetch("/api/documents/check-duplicate" + params);
            const data = await resp.json();
            if (data.duplicate) {
                dup.style.display = "block";
                dup.textContent = t('addDoc.dupWarning', {title: data.title, year: (data.year || t('addDoc.dupUnknownYear'))});
            } else {
                dup.style.display = "none";
            }
        } catch(e) {}
    },

    async createDoc() {
        const pdf = document.getElementById("addPdf");
        const title = document.getElementById("addTitle").value.trim();
        if (!pdf.files.length) return this.toast(t('addDoc.selectPdf'), true);
        if (!title) return this.toast(t('addDoc.titleRequired'), true);

        const dup = document.getElementById("dupWarning");
        if (dup.style.display !== "none") {
            if (!confirm(t('addDoc.dupConfirm'))) return;
        }

        const form = new FormData();
        form.append("pdf", pdf.files[0]);
        form.append("title", title);
        form.append("authors", document.getElementById("addAuthors").value.trim());
        form.append("year", document.getElementById("addYear").value.trim());
        form.append("journal", document.getElementById("addJournal").value.trim());
        form.append("doi", document.getElementById("addDoi").value.trim());
        form.append("abstract", document.getElementById("addAbstract").value.trim());
        try {
            await fetch("/api/documents", { method:"POST", body:form });
            this.closeModal(); this.toast(t('addDoc.added')); await this.search();
        } catch (e) { this.toast(e.message, true); }
    },

    async deleteDoc(id) {
        try {
            await API.deleteDoc(id);
            this.state.selectedDoc = null;
            this.toast(t('addDoc.deleted')); await this.search();
            document.getElementById("preview").className = "empty";
            document.getElementById("preview").innerHTML = "<span>" + t('empty.preview') + "</span>";
        } catch (e) { this.toast(e.message, true); }
    },

    /* ── Utils ── */
    closeModal() { document.getElementById("modalContainer").innerHTML = ""; },

    initSettings() {
        const btn = document.getElementById("btnSettings");
        const popup = document.getElementById("settingsPopup");
        const themeBtn = document.getElementById("popupTheme");

        const savedTheme = localStorage.getItem("lm-theme");
        if (savedTheme === "dark") {
            document.body.classList.add("dark");
            themeBtn.innerHTML = "☀️ " + t('settings.theme');
        }

        themeBtn.addEventListener("click", () => {
            const isDark = document.body.classList.toggle("dark");
            themeBtn.innerHTML = (isDark ? "☀️ " : "🌙 ") + t('settings.theme');
            localStorage.setItem("lm-theme", isDark ? "dark" : "light");
            popup.classList.remove("show");
        });

        btn.addEventListener("click", (e) => {
            if (btn.dataset.wasDragged === "1") {
                btn.dataset.wasDragged = "0";
                return;
            }
            popup.classList.toggle("show");
        });

        document.addEventListener("click", (e) => {
            if (!btn.contains(e.target) && !popup.contains(e.target)) {
                popup.classList.remove("show");
            }
        });

        document.getElementById("popupLang").textContent = t('app.langToggle');

        const savedPos = localStorage.getItem("lm-settings-pos");
        if (savedPos) {
            const [tx, ty] = savedPos.split(",").map(Number);
            btn.style.top = ty + "px";
            btn.style.left = tx + "px";
            btn.style.right = "auto";
        }

        let dragX, dragY, startX, startY, moved;
        btn.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            moved = false;
            startX = e.clientX; startY = e.clientY;
            const rect = btn.getBoundingClientRect();
            dragX = e.clientX - rect.left;
            dragY = e.clientY - rect.top;
            btn.classList.add("dragging");
            e.preventDefault();
        });
        document.addEventListener("mousemove", (e) => {
            if (!btn.classList.contains("dragging")) return;
            const dx = Math.abs(e.clientX - startX);
            const dy = Math.abs(e.clientY - startY);
            if (dx > 2 || dy > 2) moved = true;
            if (moved) {
                btn.style.right = "auto";
                btn.style.top = (e.clientY - dragY) + "px";
                btn.style.left = (e.clientX - dragX) + "px";
            }
        });
        document.addEventListener("mouseup", () => {
            if (btn.classList.contains("dragging")) {
                btn.classList.remove("dragging");
                if (moved) {
                    btn.dataset.wasDragged = "1";
                    localStorage.setItem("lm-settings-pos", btn.style.left.replace("px","") + "," + btn.style.top.replace("px",""));
                }
            }
        });
    },
    esc(s) { if (!s) return ""; const d = document.createElement("div"); d.textContent = s; return d.innerHTML; },
    toast(msg, isErr) {
        const el = document.createElement("div");
        el.className = "toast" + (isErr ? " error" : "");
        el.textContent = msg;
        document.getElementById("toastContainer").appendChild(el);
        setTimeout(() => el.remove(), 3000);
    },
};

document.addEventListener("DOMContentLoaded", () => App.init());
