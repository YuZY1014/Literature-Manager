async function api(url, opts = {}) {
    let res;
    try {
        res = await fetch(url, opts);
    } catch (e) {
        throw new Error("无法连接到服务器，请检查应用是否正在运行");
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Request failed");
    }
    if (res.status === 204) return null;
    return res.json();
}

const API = {
    // Documents
    docs: (params = "") => api("/api/documents" + (params ? "?" + new URLSearchParams(params) : "")),
    doc: (id) => api(`/api/documents/${id}`),
    createDoc: (data) => api("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    updateDoc: (id, data) => api(`/api/documents/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    deleteDoc: (id) => api(`/api/documents/${id}`, { method: "DELETE" }),

    // Tags
    tags: () => api("/api/tags"),
    createTag: (data) => api("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    updateTag: (id, data) => api(`/api/tags/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    deleteTag: (id) => api(`/api/tags/${id}`, { method: "DELETE" }),
    addDocTag: (tagId, docId) => api(`/api/tags/${tagId}/documents/${docId}`, { method: "POST" }),
    removeDocTag: (tagId, docId) => api(`/api/tags/${tagId}/documents/${docId}`, { method: "DELETE" }),

    // Annotations
    annotations: (docId) => api(`/api/documents/${docId}/annotations`),
    createAnnotation: (docId, data) => api(`/api/documents/${docId}/annotations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    updateAnnotation: (id, data) => api(`/api/annotations/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    deleteAnnotation: (id) => api(`/api/annotations/${id}`, { method: "DELETE" }),

    // Attachments
    attachments: (docId) => api(`/api/documents/${docId}/attachments`),
    deleteAttachment: (docId, attId) => api(`/api/documents/${docId}/attachments/${attId}`, { method: "DELETE" }),

    // Import
    importPreview: (profilePath) => api("/api/import/zotero/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile_path: profilePath }) }),
    importExecute: (profilePath) => api("/api/import/zotero/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile_path: profilePath }) }),

    // PDF metadata extraction
    extractMeta: async (file) => {
        const form = new FormData();
        form.append("pdf", file);
        const res = await fetch("/api/documents/extract-meta", { method: "POST", body: form });
        return res.json();
    },
};
