/* ── i18n: Internationalization for Literature Manager ── */
const LANG = {
  zh: {
    /* App */
    'app.title': '文献管理系统',
    'app.langToggle': 'CN/EN',
    'settings.theme': '日夜切换',
    /* Sidebar */
    'sidebar.title': '标签分类',
    'sidebar.importZotero': '从 Zotero 导入',
    'sidebar.untagged': '未分类',

    /* Toolbar */
    'toolbar.searchPlaceholder': '搜索标题、作者、摘要...',
    'toolbar.allYears': '全部年份',
    'toolbar.addDoc': '+ 添加文献',

    /* Empty / Hint */
    'empty.docGrid': '选择左侧标签或搜索文献',
    'empty.preview': '选择一篇文献查看批注和笔记',
    'empty.noDocs': '没有文献 — 点击右上角 + 添加',
    'empty.metaPending': '元数据待补充',
    'empty.none': '无',
    'empty.noAnnotations': '暂无批注',
    'empty.noContent': '无内容',
    'empty.noAttachments': '暂无附件',

    /* Preview panel */
    'preview.annotations': '批注 ({count})',
    'preview.page': '第',
    'preview.pageSuffix': '页',
    'preview.info': '信息',
    'preview.journal': '期刊',
    'preview.authors': '作者',
    'preview.year': '年份',
    'preview.doi': 'DOI',
    'preview.tags': '标签',
    'preview.notes': '笔记',
    'preview.delete': '删除',
    'preview.addTag': '+ 标签',
    'preview.editTitle': '点击编辑标题',

    /* Add Doc Modal */
    'addDoc.title': '添加文献',
    'addDoc.pdfFile': 'PDF 文件 *',
    'addDoc.titleField': '标题 *',
    'addDoc.authors': '作者',
    'addDoc.year': '年份',
    'addDoc.journal': '期刊',
    'addDoc.doi': 'DOI',
    'addDoc.abstract': '摘要',
    'addDoc.cancel': '取消',
    'addDoc.add': '添加',
    'addDoc.extracting': '提取元数据中...',
    'addDoc.autoFilled': '✓ 已自动填充',
    'addDoc.filenameUsed': '已填入文件名',
    'addDoc.dupWarning': '⚠ 可能重复：库中已存在「{title}」({year})',
    'addDoc.dupUnknownYear': '未知年份',
    'addDoc.selectPdf': '请选择 PDF',
    'addDoc.titleRequired': '标题不能为空',
    'addDoc.dupConfirm': '库中可能已存在相同文献，是否继续添加？',
    'addDoc.added': '文献已添加',
    'addDoc.deleted': '文献已删除',

    /* Delete confirm */
    'delete.docConfirm': '删除「{title}」？此操作不可撤销。',
    'delete.tagConfirm': '删除此标签？',
    'delete.annoConfirm': '删除此批注？',
    'delete.attConfirm': '删除此附件？',

    /* PDF Viewer - Toolbar */
    'pdf.back': '← 返回列表',
    'pdf.highlight': '高亮',
    'pdf.underline': '下划线',
    'pdf.rect': '方框',
    'pdf.note': '批注',
    'pdf.pointer': '指针',
    'pdf.attachment': '📎 附件',
    'pdf.notes': '笔记',
    'pdf.export': '导出',
    'pdf.notesPlaceholder': '在此编写笔记...',
    'pdf.annoList': '批注列表',
    'pdf.attList': '附件列表',
    'pdf.loading': '加载中...',
    'pdf.loadFailed': '加载失败',
    'pdf.cannotLoad': '无法加载 PDF: {msg}',
    'pdf.notesEmpty': '笔记为空',
    'pdf.notesExported': '笔记已导出',
    'pdf.annoPage': '第 {pg} 页',
    'pdf.annoDeleted': '批注已删除',
    'pdf.attDeleted': '附件已删除',
    'pdf.attDeleteFailed': '删除失败: {msg}',
    'pdf.attUploaded': '附件已上传: {name}',
    'pdf.attUploadFailed': '上传失败: {msg}',
    'pdf.attPreviewLoading': '加载中...',
    'pdf.attPreviewFailed': '加载失败: {msg}',
    'pdf.attTooLarge': '// --- 文件过大，仅显示前 50000 字符 ---\n',
    'pdf.attClickDownload': '点击下载',
    'pdf.notePrompt': '输入批注内容:',
    'pdf.annoCreateFailed': '创建失败: {msg}',
    'pdf.annoDeleteFailed': '删除失败: {msg}',

    /* Tag management */
    'tag.newTitle': '新建标签',
    'tag.editTitle': '编辑标签',
    'tag.name': '名称',
    'tag.color': '颜色',
    'tag.cancel': '取消',
    'tag.create': '创建',
    'tag.save': '保存',
    'tag.nameRequired': '标签名不能为空',

    /* Zotero Import */
    'import.title': '从 Zotero 导入文献',
    'import.detecting': '正在自动检测 Zotero 目录...',
    'import.detected': '✓ 检测到 Zotero: {path}',
    'import.notDetected': '⚠ 未自动检测到 Zotero，请手动输入路径',
    'import.detectFailed': '⚠ 检测失败，请手动输入路径',
    'import.manualPath': '或手动输入路径：',
    'import.pathPlaceholder': 'C:\\Users\\用户名\\Zotero',
    'import.pathRequired': '请指定 Zotero 数据目录',
    'import.scanning': '正在扫描 Zotero 数据库...',
    'import.scanningLabel': '扫描中...',
    'import.noPdf': '未找到 PDF 文献',
    'import.found': '找到 <strong>{count}</strong> 篇',
    'import.dupSkip': '⚠ 其中 <strong>{count}</strong> 篇已存在，将自动跳过',
    'import.existing': '[已存在]',
    'import.annotations': '({count} 条注释)',
    'import.etc': '...等 {count} 篇',
    'import.preview': '扫描预览',
    'import.confirm': '确认导入',
    'import.cancel': '取消',
    'import.confirmMsg': '确认导入？PDF 复制到 papers/，注释合并入 PDF。',
    'import.confirmSkip': '\n\n{count} 篇已存在的将跳过，实际导入约 {newCount} 篇。',
    'import.importing': '导入中...',
    'import.result': '导入 {imported} 篇文献，合并 {baked} 条注释',
    'import.dupSkipped': '，跳过 {count} 篇重复',

    /* Months */
    'month.01': '01',
    'month.02': '02',
    'month.03': '03',
    'month.04': '04',
    'month.05': '05',
    'month.06': '06',
    'month.07': '07',
    'month.08': '08',
    'month.09': '09',
    'month.10': '10',
    'month.11': '11',
    'month.12': '12',
  },

  en: {
    /* App */
    'app.title': 'Literature Manager',
    'app.langToggle': '中/EN',
    'settings.theme': 'Dark/Light',
    /* Sidebar */
    'sidebar.title': 'Tags',
    'sidebar.importZotero': 'Import from Zotero',
    'sidebar.untagged': 'Untagged',

    /* Toolbar */
    'toolbar.searchPlaceholder': 'Search title, author, abstract...',
    'toolbar.allYears': 'All years',
    'toolbar.addDoc': '+ Add Paper',

    /* Empty / Hint */
    'empty.docGrid': 'Select a tag on the left or search papers',
    'empty.preview': 'Select a paper to view annotations and notes',
    'empty.noDocs': 'No papers — click + Add Paper in the toolbar',
    'empty.metaPending': 'Metadata pending',
    'empty.none': 'None',
    'empty.noAnnotations': 'No annotations',
    'empty.noContent': 'No content',
    'empty.noAttachments': 'No attachments',

    /* Preview panel */
    'preview.annotations': 'Annotations ({count})',
    'preview.page': 'p.',
    'preview.pageSuffix': '',
    'preview.info': 'Info',
    'preview.journal': 'Journal',
    'preview.authors': 'Authors',
    'preview.year': 'Year',
    'preview.doi': 'DOI',
    'preview.tags': 'Tags',
    'preview.notes': 'Notes',
    'preview.delete': 'Delete',
    'preview.addTag': '+ Tag',
    'preview.editTitle': 'Click to edit title',

    /* Add Doc Modal */
    'addDoc.title': 'Add Paper',
    'addDoc.pdfFile': 'PDF File *',
    'addDoc.titleField': 'Title *',
    'addDoc.authors': 'Authors',
    'addDoc.year': 'Year',
    'addDoc.journal': 'Journal',
    'addDoc.doi': 'DOI',
    'addDoc.abstract': 'Abstract',
    'addDoc.cancel': 'Cancel',
    'addDoc.add': 'Add',
    'addDoc.extracting': 'Extracting metadata...',
    'addDoc.autoFilled': '✓ Auto-filled',
    'addDoc.filenameUsed': 'Filename used as title',
    'addDoc.dupWarning': '⚠ Possible duplicate: "{title}" ({year}) already exists',
    'addDoc.dupUnknownYear': 'unknown year',
    'addDoc.selectPdf': 'Please select a PDF',
    'addDoc.titleRequired': 'Title is required',
    'addDoc.dupConfirm': 'A similar paper may already exist. Add anyway?',
    'addDoc.added': 'Paper added',
    'addDoc.deleted': 'Paper deleted',

    /* Delete confirm */
    'delete.docConfirm': 'Delete "{title}"? This cannot be undone.',
    'delete.tagConfirm': 'Delete this tag?',
    'delete.annoConfirm': 'Delete this annotation?',
    'delete.attConfirm': 'Delete this attachment?',

    /* PDF Viewer - Toolbar */
    'pdf.back': '← Back to list',
    'pdf.highlight': 'Highlight',
    'pdf.underline': 'Underline',
    'pdf.rect': 'Box',
    'pdf.note': 'Note',
    'pdf.pointer': 'Pointer',
    'pdf.attachment': '📎 Attachment',
    'pdf.notes': 'Notes',
    'pdf.export': 'Export',
    'pdf.notesPlaceholder': 'Write your notes here...',
    'pdf.annoList': 'Annotations',
    'pdf.attList': 'Attachments',
    'pdf.loading': 'Loading...',
    'pdf.loadFailed': 'Load failed',
    'pdf.cannotLoad': 'Cannot load PDF: {msg}',
    'pdf.notesEmpty': 'Notes are empty',
    'pdf.notesExported': 'Notes exported',
    'pdf.annoPage': 'p. {pg}',
    'pdf.annoDeleted': 'Annotation deleted',
    'pdf.attDeleted': 'Attachment deleted',
    'pdf.attDeleteFailed': 'Delete failed: {msg}',
    'pdf.attUploaded': 'Attachment uploaded: {name}',
    'pdf.attUploadFailed': 'Upload failed: {msg}',
    'pdf.attPreviewLoading': 'Loading...',
    'pdf.attPreviewFailed': 'Load failed: {msg}',
    'pdf.attTooLarge': '// --- File too large, showing first 50000 characters ---\n',
    'pdf.attClickDownload': 'Click to download',
    'pdf.notePrompt': 'Enter annotation text:',
    'pdf.annoCreateFailed': 'Create failed: {msg}',
    'pdf.annoDeleteFailed': 'Delete failed: {msg}',

    /* Tag management */
    'tag.newTitle': 'New Tag',
    'tag.editTitle': 'Edit Tag',
    'tag.name': 'Name',
    'tag.color': 'Color',
    'tag.cancel': 'Cancel',
    'tag.create': 'Create',
    'tag.save': 'Save',
    'tag.nameRequired': 'Tag name is required',

    /* Zotero Import */
    'import.title': 'Import from Zotero',
    'import.detecting': 'Auto-detecting Zotero directory...',
    'import.detected': '✓ Zotero found: {path}',
    'import.notDetected': '⚠ Could not auto-detect Zotero, please enter path manually',
    'import.detectFailed': '⚠ Detection failed, please enter path manually',
    'import.manualPath': 'Or enter path manually:',
    'import.pathPlaceholder': 'C:\\Users\\username\\Zotero',
    'import.pathRequired': 'Please specify Zotero data directory',
    'import.scanning': 'Scanning Zotero database...',
    'import.scanningLabel': 'Scanning...',
    'import.noPdf': 'No PDF papers found',
    'import.found': 'Found <strong>{count}</strong> papers',
    'import.dupSkip': '⚠ <strong>{count}</strong> already exist and will be skipped',
    'import.existing': '[Existing]',
    'import.annotations': '({count} annotations)',
    'import.etc': '...and {count} more',
    'import.preview': 'Preview',
    'import.confirm': 'Import',
    'import.cancel': 'Cancel',
    'import.confirmMsg': 'Confirm import? PDFs will be copied to papers/, annotations merged into PDFs.',
    'import.confirmSkip': '\n\n{count} existing papers will be skipped. About {newCount} will be imported.',
    'import.importing': 'Importing...',
    'import.result': 'Imported {imported} papers, merged {baked} annotations',
    'import.dupSkipped': ', skipped {count} duplicates',

    /* Months */
    'month.01': 'Jan', 'month.02': 'Feb', 'month.03': 'Mar',
    'month.04': 'Apr', 'month.05': 'May', 'month.06': 'Jun',
    'month.07': 'Jul', 'month.08': 'Aug', 'month.09': 'Sep',
    'month.10': 'Oct', 'month.11': 'Nov', 'month.12': 'Dec',
  }
};

/* ── Current language ── */
let _currentLang = localStorage.getItem('lm-lang') || 'zh';

/* ── Translate function ── */
function t(key, ...args) {
  const dict = LANG[_currentLang] || LANG.zh;
  let str = dict[key];
  if (str === undefined) {
    // fallback to zh
    str = LANG.zh[key] || key;
  }
  // Replace {0}, {1}, ... or named placeholders like {name}
  if (args.length === 1 && typeof args[0] === 'object') {
    const map = args[0];
    for (const k in map) {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), map[k]);
    }
  } else {
    args.forEach((v, i) => {
      str = str.replace(new RegExp('\\{' + i + '\\}', 'g'), v);
    });
  }
  return str;
}

/* ── Get / Set language ── */
function getLang() { return _currentLang; }

function setLang(lang) {
  if (!LANG[lang]) return;
  _currentLang = lang;
  localStorage.setItem('lm-lang', lang);
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  // Re-render the entire app
  if (typeof Tags !== 'undefined') Tags.loadTree();
  if (typeof App !== 'undefined') {
    App.renderGrid();
    App.updateYearFilter();
    if (App.state.selectedDoc) App.renderPreview();
    else document.getElementById('preview').innerHTML = `<span>${t('empty.preview')}</span>`;
  }
}

/* ── Init i18n on page load (update static elements) ── */
function applyStaticI18n() {
  document.documentElement.lang = _currentLang === 'en' ? 'en' : 'zh-CN';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const attr = el.dataset.i18nAttr || 'textContent';
    if (attr === 'textContent') {
      el.textContent = t(key);
    } else {
      el.setAttribute(attr, t(key));
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

// Run on DOMContentLoaded automatically
document.addEventListener('DOMContentLoaded', applyStaticI18n);
