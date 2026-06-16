# Literature Manager

A local desktop tool for managing academic literature with tag-based organization, PDF annotation, and attachment management. Designed to replace Zotero's clunky folder structure — one paper can belong to multiple tags.

Access the web UI at `http://127.0.0.1:8088` after starting. Click the ⚙️ gear icon in the top-right corner to toggle dark/light mode and switch between Chinese and English.

---

## Requirements

- Python 3.10+
- Windows / macOS / Linux

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the app
python main.py
```

Your browser will open automatically to `http://127.0.0.1:8088`.

## Packaging as Standalone EXE

To share with colleagues who don't have Python:

```bash
pip install pyinstaller
build.bat
```

The output goes to `dist\LiteratureManager\`. Copy the whole folder to any Windows machine and double-click `LiteratureManager.exe`.

All data (database, PDFs, attachments) is stored alongside the executable — migrate by copying the entire folder.

---

## Directory Structure

```
literature-manager/
├── main.py              # Entry point
├── config.py            # Path configuration
├── database.py          # SQLite connection
├── models.py            # Data models
├── schemas.py           # API schemas
├── routers/             # API routes
├── services/            # Zotero importer & annotation baking
├── static/              # Frontend (HTML/CSS/JS)
├── data/literature.db   # SQLite database (auto-created)
├── papers/              # PDF storage
├── attachments/         # Attachment storage
└── requirements.txt
```

---

## Feature Overview

### Literature Management

- **Add papers**: Click "+ Add Paper" → select PDF → auto-extract title from PDF metadata
- **Duplicate detection**: Warns if a paper with the same title already exists
- **Card view**: Thumbnails with title, author, year, tags
- **Quick edit**: Click any field (title, journal, authors, year, DOI) to edit inline
- **Delete**: Remove paper + its PDF file with one click

### Tag System

- Two-level hierarchical tags
- Color-coded for visual grouping
- One paper can have multiple tags
- "Untagged" virtual tag shows all unlabeled papers
- Click a tag to filter, click again to clear

### PDF Viewer

Built-in reader with full annotation support:

| Tool | Function |
|------|----------|
| Highlight | Select text → auto-create yellow highlight |
| Underline | Select text → create underline annotation |
| Box | Drag to draw a rectangle mark |
| Note | Click anywhere on page → add a sticky note |
| Pointer | Normal text selection/copy mode |

- All annotations stored in the database — **original PDF is never modified**
- Click annotation in the side panel → jump to that page
- Hover annotation → view content & delete
- Zoom (50%–400%), page navigation, text layer for copy/paste

### Notes & Attachments

- Rich text notes with auto-save (0.5s debounce)
- Export notes as `.txt`
- Attach files (.txt, .doc, .docx) to any paper
- Preview text-based attachments inline

### Zotero Import

- Auto-detects local Zotero data directory
- Scans and previews importable papers with annotation counts
- Highlights already-existing papers (auto-skipped)
- Merges Zotero annotations (highlight, underline, strikethrough, text notes) permanently into the PDF
- Preserves metadata (title, authors, year, journal, DOI)

### Settings (⚙️ Gear Button)

- Click the ⚙️ gear icon (top-right, draggable) to open the settings popup
- **Dark/Light Mode**: Toggle between light and dark themes
- **CN/EN**: Switch between Chinese and English interfaces
- All preferences persist across sessions

### Data Storage

| Data | Location | Notes |
|------|----------|-------|
| Metadata / Tags / Annotations / Notes | `data/literature.db` | Single SQLite file |
| PDF files | `papers/` | Original filenames |
| Attachments | `attachments/{paper_id}/` | Grouped by paper |

All data is local — no cloud, no server, no telemetry.

---

## Shortcuts

| Action | How |
|--------|-----|
| Open PDF | Double-click paper card, or click annotation in preview |
| Jump to annotation page | Click annotation entry in preview |
| Exit PDF viewer | Click "← Back to list" |
| Zoom PDF | Click +/− buttons |
| Create highlight | Select text (set tool to Highlight first) |
| Draw box | Select Box tool → drag on page |
| Add sticky note | Select Note tool → click on page |
| Export notes | In PDF viewer, click "Export" |
| Resize panels | Drag the blue divider lines |
