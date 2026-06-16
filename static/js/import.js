const ImportUI = {
    showDialog() {
        const modal = document.getElementById("modalContainer");
        modal.innerHTML = `
            <div class="modal-overlay" id="modalOverlay">
                <div class="modal">
                    <h3>从 Zotero 导入文献</h3>
                    <div id="importStatus" style="padding:16px;text-align:center;color:var(--text-muted);">
                        正在自动检测 Zotero 目录...
                    </div>
                    <div id="importPathRow" style="display:none;margin-bottom:8px;">
                        <label style="font-size:12px;color:var(--text-muted);">或手动输入路径：</label>
                        <input id="zoteroPath" placeholder="C:\\Users\\用户名\\Zotero" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;">
                    </div>
                    <div id="importPreview" style="max-height:260px;overflow-y:auto;margin-bottom:12px;"></div>
                    <div class="form-actions">
                        <button class="btn" id="btnCancelImport">取消</button>
                        <button class="btn btn-primary" id="btnPreview" style="display:none;">扫描预览</button>
                        <button class="btn btn-primary" id="btnExecute" style="display:none;">确认导入</button>
                    </div>
                </div>
            </div>`;
        document.getElementById("btnCancelImport").addEventListener("click", () => App.closeModal());
        document.getElementById("modalOverlay").addEventListener("click", function(e) {
            if (e.target === this) App.closeModal();
        });

        // Auto-detect
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
                status.innerHTML = `<span style="color:#22c55e;">✓ 检测到 Zotero: <code>${data.default}</code></span>`;
                document.getElementById("btnPreview").style.display = "inline-block";
                document.getElementById("importPathRow").style.display = "none";
            } else {
                status.innerHTML = '<span style="color:#f59e0b;">⚠ 未自动检测到 Zotero，请手动输入路径</span>';
                document.getElementById("importPathRow").style.display = "block";
                document.getElementById("btnPreview").style.display = "inline-block";
            }
        } catch (e) {
            document.getElementById("importStatus").innerHTML = '<span style="color:#f59e0b;">⚠ 检测失败，请手动输入路径</span>';
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
        if (!path) return App.toast("请指定 Zotero 数据目录", true);
        const prevDiv = document.getElementById("importPreview");
        const previewBtn = document.getElementById("btnPreview");
        prevDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">正在扫描 Zotero 数据库...</div>';
        previewBtn.disabled = true; previewBtn.textContent = "扫描中...";
        try {
            const result = await API.importPreview(path);
            if (!result.count) {
                prevDiv.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-muted);">未找到 PDF 文献</p>';
            } else {
                // Check duplicates
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
                    <p style="font-size:13px;margin-bottom:4px;">找到 <strong>${result.count}</strong> 篇</p>
                    ${dupCount ? `<p style="color:#f59e0b;font-size:12px;margin-bottom:6px;">⚠ 其中 <strong>${dupCount}</strong> 篇已存在，将自动跳过</p>` : ''}
                    <div style="max-height:180px;overflow-y:auto;">
                    ${result.items.slice(0, 100).map(it => {
                        const isDup = dupIds.has(it.title.toLowerCase().trim());
                        return `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);${isDup ? 'opacity:.5' : ''}">
                            ${isDup ? '<span style="color:#f59e0b;">[已存在]</span> ' : ''}
                            <strong>${App.esc(it.title)}</strong>
                            <span style="color:var(--text-muted);">${[it.authors, it.year].filter(Boolean).join(' · ')}</span>
                            ${it.annotation_count ? `<span style="color:var(--primary);font-weight:600;">(${it.annotation_count} 条注释)</span>` : ''}
                        </div>`;}).join("")}
                    ${result.count > 100 ? `<p style="font-size:12px;color:var(--text-muted);">...等 ${result.count - 100} 篇</p>` : ""}
                    </div>`;
                this._allItems = result.items;
                this._dupIds = dupIds;
                document.getElementById("btnExecute").style.display = "inline-block";
            }
        } catch (e) {
            prevDiv.innerHTML = `<p style="color:var(--danger);">${e.message}</p>`;
        }
        previewBtn.disabled = false; previewBtn.textContent = "扫描预览";
    },

    async execute() {
        const path = this._getPath();
        if (!this._allItems) return;
        const newCount = this._allItems.filter(it => !this._dupIds.has(it.title.toLowerCase().trim())).length;
        const skipCount = this._dupIds.size;
        let msg = `确认导入？PDF 复制到 papers/，注释合并入 PDF。`;
        if (skipCount) msg += `\n\n${skipCount} 篇已存在的将跳过，实际导入约 ${newCount} 篇。`;
        if (!confirm(msg)) return;
        const btn = document.getElementById("btnExecute");
        btn.disabled = true; btn.textContent = "导入中...";
        try {
            const result = await API.importExecute(path);
            const extra = result.duplicates_skipped ? `，跳过 ${result.duplicates_skipped} 篇重复` : "";
            App.toast(`导入 ${result.imported} 篇文献，合并 ${result.baked_annotations} 条注释${extra}`);
            App.closeModal();
            await App.search();
            await Tags.loadTree();
        } catch (e) {
            App.toast(e.message, true);
            btn.disabled = false; btn.textContent = "确认导入";
        }
    },
};
