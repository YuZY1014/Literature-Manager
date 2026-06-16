const ImportUI = {
    showDialog() {
        const modal = document.getElementById("modalContainer");
        modal.innerHTML = `
            <div class="modal-overlay" id="modalOverlay">
                <div class="modal">
                    <h3>${t('import.title')}</h3>
                    <div id="importStatus" style="padding:16px;text-align:center;color:var(--text-muted);">
                        ${t('import.detecting')}
                    </div>
                    <div id="importPathRow" style="display:none;margin-bottom:8px;">
                        <label style="font-size:12px;color:var(--text-muted);">${t('import.manualPath')}</label>
                        <input id="zoteroPath" placeholder="${t('import.pathPlaceholder')}" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;">
                    </div>
                    <div id="importPreview" style="max-height:260px;overflow-y:auto;margin-bottom:12px;"></div>
                    <div class="form-actions">
                        <button class="btn" id="btnCancelImport">${t('import.cancel')}</button>
                        <button class="btn btn-primary" id="btnPreview" style="display:none;">${t('import.preview')}</button>
                        <button class="btn btn-primary" id="btnExecute" style="display:none;">${t('import.confirm')}</button>
                    </div>
                </div>
            </div>`;
        document.getElementById("btnCancelImport").addEventListener("click", () => App.closeModal());
        document.getElementById("modalOverlay").addEventListener("click", function(e) {
            if (e.target === this) App.closeModal();
        });

        this._detectedPath = null;
        this._autoDetect();

        document.getElementById("btnPreview").addEventListener("click", () => this.preview());
        document.getElementById("btnExecute").addEventListener("click", () => this.execute());
    },

    async _autoDetect() {
        try {
            const resp = await fetch("/api/import/zotero/auto-detect");
            const data = await resp.json();
            const status = document.getElementById("importStatus");
            if (data.default) {
                this._detectedPath = data.default;
                status.innerHTML = `<span style="color:#22c55e;">${t('import.detected', {path: data.default})}</span>`;
                document.getElementById("btnPreview").style.display = "inline-block";
                document.getElementById("importPathRow").style.display = "none";
            } else {
                status.innerHTML = `<span style="color:#f59e0b;">${t('import.notDetected')}</span>`;
                document.getElementById("importPathRow").style.display = "block";
                document.getElementById("btnPreview").style.display = "inline-block";
            }
        } catch (e) {
            document.getElementById("importStatus").innerHTML = `<span style="color:#f59e0b;">${t('import.detectFailed')}</span>`;
            document.getElementById("importPathRow").style.display = "block";
            document.getElementById("btnPreview").style.display = "inline-block";
        }
    },

    _getPath() {
        if (this._detectedPath) return this._detectedPath;
        const inp = document.getElementById("zoteroPath");
        return inp ? inp.value.trim() : "";
    },

    async preview() {
        const path = this._getPath();
        if (!path) return App.toast(t('import.pathRequired'), true);
        const prevDiv = document.getElementById("importPreview");
        const previewBtn = document.getElementById("btnPreview");
        prevDiv.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);">${t('import.scanning')}</div>`;
        previewBtn.disabled = true; previewBtn.textContent = t('import.scanningLabel');
        try {
            const result = await API.importPreview(path);
            if (!result.count) {
                prevDiv.innerHTML = `<p style="padding:20px;text-align:center;color:var(--text-muted);">${t('import.noPdf')}</p>`;
            } else {
                let dupIds = new Set();
                try {
                    const existing = await API.docs();
                    const existingMap = new Map();
                    existing.forEach(d => { existingMap.set(d.title.toLowerCase().trim(), d); });
                    result.items.forEach(it => {
                        const key = it.title.toLowerCase().trim();
                        if (existingMap.has(key)) dupIds.add(key);
                    });
                } catch(e){}
                const dupCount = dupIds.size;

                prevDiv.innerHTML = `
                    <p style="font-size:13px;margin-bottom:4px;">${t('import.found', {count: result.count})}</p>
                    ${dupCount ? `<p style="color:#f59e0b;font-size:12px;margin-bottom:6px;">${t('import.dupSkip', {count: dupCount})}</p>` : ''}
                    <div style="max-height:180px;overflow-y:auto;">
                    ${result.items.slice(0, 100).map(it => {
                        const isDup = dupIds.has(it.title.toLowerCase().trim());
                        return `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);${isDup ? 'opacity:.5' : ''}">
                            ${isDup ? `<span style="color:#f59e0b;">${t('import.existing')}</span> ` : ''}
                            <strong>${App.esc(it.title)}</strong>
                            <span style="color:var(--text-muted);">${[it.authors, it.year].filter(Boolean).join(' · ')}</span>
                            ${it.annotation_count ? `<span style="color:var(--primary);font-weight:600;">${t('import.annotations', {count: it.annotation_count})}</span>` : ''}
                        </div>`;}).join("")}
                    ${result.count > 100 ? `<p style="font-size:12px;color:var(--text-muted);">${t('import.etc', {count: result.count - 100})}</p>` : ""}
                    </div>`;
                this._allItems = result.items;
                this._dupIds = dupIds;
                document.getElementById("btnExecute").style.display = "inline-block";
            }
        } catch (e) {
            prevDiv.innerHTML = `<p style="color:var(--danger);">${e.message}</p>`;
        }
        previewBtn.disabled = false; previewBtn.textContent = t('import.preview');
    },

    async execute() {
        const path = this._getPath();
        if (!this._allItems) return;
        const newCount = this._allItems.filter(it => !this._dupIds.has(it.title.toLowerCase().trim())).length;
        const skipCount = this._dupIds.size;
        let msg = t('import.confirmMsg');
        if (skipCount) msg += t('import.confirmSkip', {count: skipCount, newCount});
        if (!confirm(msg)) return;
        const btn = document.getElementById("btnExecute");
        btn.disabled = true; btn.textContent = t('import.importing');
        try {
            const result = await API.importExecute(path);
            const extra = result.duplicates_skipped ? t('import.dupSkipped', {count: result.duplicates_skipped}) : "";
            App.toast(t('import.result', {imported: result.imported, baked: result.baked_annotations}) + extra);
            App.closeModal();
            await App.search();
            await Tags.loadTree();
        } catch (e) {
            App.toast(e.message, true);
            btn.disabled = false; btn.textContent = t('import.confirm');
        }
    },
};
