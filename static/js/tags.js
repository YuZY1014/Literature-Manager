const Tags = {
    state: { tags: [] },

    async loadTree() {
        try { this.state.tags = await API.tags(); }
        catch (e) { this.state.tags = []; }
        this.renderTree();
    },

    renderTree() {
        const el = document.getElementById("tagTree");
        const active = App.state.activeTag;

        let html = `<div class="tag-item${active === '__untagged__' ? ' active' : ''}" data-tag-name="__untagged__">
            <span class="tag-dot" style="background:#94a3b8;"></span>
            <span class="tag-name">未分类</span>
        </div>`;

        for (const t of this.state.tags) {
            html += `<div class="tag-item${active === t.name ? ' active' : ''}" data-tag-name="${this.esc(t.name)}" style="padding-left:14px;">
                <span class="tag-dot" style="background:${t.color}"></span>
                <span class="tag-name">${this.esc(t.name)}</span>
                <span class="tag-actions">
                    <button class="tag-act-btn edit" data-tag-id="${t.id}" data-tag-name="${this.esc(t.name)}" data-tag-color="${t.color}" title="编辑标签">
                        <svg viewBox="0 0 16 16" width="12" height="12"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10Z" fill="currentColor"/></svg>
                    </button>
                    <button class="tag-act-btn del" data-tag-id="${t.id}" title="删除标签">
                        <svg viewBox="0 0 16 16" width="12" height="12"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1ZM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118ZM2.5 3h11V2h-11v1Z" fill="currentColor"/></svg>
                    </button>
                </span>
            </div>`;
        }
        el.innerHTML = html;

        el.querySelectorAll(".tag-item").forEach(item => {
            item.addEventListener("click", () => this.selectTag(item.dataset.tagName));
        });
        el.querySelectorAll(".tag-act-btn.edit").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.showEditDialog(parseInt(btn.dataset.tagId), btn.dataset.tagName, btn.dataset.tagColor);
            });
        });
        el.querySelectorAll(".tag-act-btn.del").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.deleteTag(parseInt(btn.dataset.tagId));
            });
        });
    },

    selectTag(name) {
        App.state.activeTag = App.state.activeTag === name ? null : name;
        this.renderTree();
        App.search();
    },

    showCreateDialog() {
        const modal = document.getElementById("modalContainer");
        modal.innerHTML = `
            <div class="modal-overlay" id="modalOverlay">
                <div class="modal">
                    <h3>新建标签</h3>
                    <div class="form-group"><label>名称</label><input id="tagName"></div>
                    <div class="form-group"><label>颜色</label><input type="color" id="tagColor" value="#3b82f6">${colorPresets()}</div>
                    <div class="form-actions">
                        <button class="btn" id="btnCancelTag">取消</button>
                        <button class="btn btn-primary" id="btnCreateTag">创建</button>
                    </div>
                </div>
            </div>`;
        document.getElementById("btnCancelTag").addEventListener("click", () => App.closeModal());
        document.getElementById("btnCreateTag").addEventListener("click", () => this.createTag());
        document.getElementById("modalOverlay").addEventListener("click", function(e) {
            if (e.target === this) App.closeModal();
        });
        bindColorPresets();
    },

    async createTag() {
        const name = document.getElementById("tagName").value.trim();
        if (!name) return App.toast("标签名不能为空", true);
        const data = { name, color: document.getElementById("tagColor").value };
        try {
            await API.createTag(data);
            App.closeModal();
            await this.loadTree();
        } catch (e) { App.toast(e.message, true); }
    },

    showEditDialog(id, name, color) {
        const modal = document.getElementById("modalContainer");
        modal.innerHTML = `
            <div class="modal-overlay" id="modalOverlay">
                <div class="modal">
                    <h3>编辑标签</h3>
                    <div class="form-group"><label>名称</label><input id="tagName" value="${this.esc(name)}"></div>
                    <div class="form-group"><label>颜色</label><input type="color" id="tagColor" value="${color}">${colorPresets()}</div>
                    <div class="form-actions">
                        <button class="btn" id="btnCancelTag">取消</button>
                        <button class="btn btn-primary" id="btnUpdateTag">保存</button>
                    </div>
                </div>
            </div>`;
        document.getElementById("btnCancelTag").addEventListener("click", () => App.closeModal());
        document.getElementById("btnUpdateTag").addEventListener("click", () => this.updateTag(id));
        document.getElementById("modalOverlay").addEventListener("click", function(e) {
            if (e.target === this) App.closeModal();
        });
        bindColorPresets();
    },

    async updateTag(id) {
        const data = { name: document.getElementById("tagName").value.trim(), color: document.getElementById("tagColor").value };
        try {
            await API.updateTag(id, data);
            App.closeModal();
            await this.loadTree();
            if (App.state.selectedDoc) await App.selectDoc(App.state.selectedDoc.id);
        } catch (e) { App.toast(e.message, true); }
    },

    async deleteTag(id) {
        if (!confirm("删除此标签？")) return;
        try {
            await API.deleteTag(id);
            await this.loadTree();
            if (App.state.selectedDoc) await App.selectDoc(App.state.selectedDoc.id);
        } catch (e) { App.toast(e.message, true); }
    },

    esc(s) { return s ? s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;") : ""; },
};

// Shared color preset helpers
const COLOR_PRESETS = [
    "#ef4444", "#f97316", "#f59e0b", "#eab308",
    "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
    "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
    "#ec4899", "#f43f5e", "#78716c", "#475569",
];

function colorPresets() {
    return `<div class="color-presets">${COLOR_PRESETS.map(c =>
        `<span class="color-chip" data-color="${c}" style="background:${c};" title="${c}"></span>`
    ).join('')}</div>`;
}

function bindColorPresets() {
    document.querySelectorAll(".color-chip").forEach(chip => {
        chip.addEventListener("click", function() {
            document.getElementById("tagColor").value = this.dataset.color;
        });
    });
}
