# What’s new

This document compares **1.0** (last state on `master` before the **generic-images** work) with **2.0** (current branch: reusable generic SVG symbols, richer table cells, dev tooling).

---

## 1.0 — baseline (`master` before generic-images)

- **Sidebar**  
  - Symbols came only from **`frames`** in `static/images/image.json`: each entry points at a frame SVG (e.g. `images/Frame 1.svg`).

- **Local server**  
  - Single file **`start_server.py`** serving the **`static/`** tree only (same idea as Cloudflare Pages: site root = `static/`).

- **Table**  
  - Drag frame images into cells, edit plain text, brush-painted cell borders, save/load table JSON, export PNG via `html2canvas`.  
  - Cells could hold multiple images; right-click removed an image in a cell.

- **Assets**  
  - A larger set of **frame** SVGs (including frames **24–31, 45–48, 52–55, 57–60** that were later removed in 2.0 to slim the set).

- **Manifest**  
  - `image.json` described **`frames`** only (no `genericTemplates`).

- **Tooling**  
  - No **generic template editor** and no **`tools/`** web app under the dev server.

---

## 2.0 — generic-images (current)

### Manifest & symbols

- **`genericTemplates`** in `static/images/image.json`: reusable **inline SVG** bases under `static/images/generic/` (e.g. rope, helping rope) with **add-ups** (positioned text overlays, optional checkbox-style markers).
- **`frames`**: still supported; **20 unused frame files** were removed to match the trimmed manifest.
- **Custom symbols**: users can add **named presets** via **+** (modal), stored in **`localStorage`**; **right-click** a custom entry in the sidebar to remove it from the list.

### Table & JSON

- **Rich cells**: content is ordered **segments** — frame images, generic symbols, and **text blocks** interleaved (`img → text → img → text …`).
- **Saving** uses **`type: "mixed"`** with a **`segments`** array. Older **`type: "images"`** saves (with **`caption`**) still **load**.
- **Text next to symbols**: shrink-to-fit text blocks; **click** empty area **after the last image** adds a new text segment; if the cell **already ends with text**, the same kind of click **edits that last text** (no duplicate empty row).
- **Plain text-only cells** unchanged (`type: "text"`).

### Dev server (`start_server` package)

- **`python -m start_server`** — serves **`static/`** at `/` and repo **`tools/`** at **`/tools/`** (default port **8000**, next free if busy).
- **`python -m start_server --generic`** — opens the **generic template editor** in the browser.
- **`python start_server.py`** — thin wrapper, same behavior.

### Generic template editor (`tools/generic-template-editor/`)

- **Web UI** (replaces any prior idea of a separate Python/tkinter SVG dump): edit **`genericTemplates`**, **live SVG preview**, sample values per template, **`sessionStorage`** for preview test values during the tab session.
- **Download** full **`image.json`** and replace `static/images/image.json` manually.

### Repo hygiene

- **`.gitignore`** expanded (Python caches/venvs, `.wrangler/`, `node_modules/`, OS junk, env files, etc.).

### Docs

- **`README.md`** updated for 2.0 run instructions and layout.
- **`whats_new.md`** (this file) — 1.0 vs 2.0 summary.

---

## Version tag suggestion

- **1.0** ≈ last commit on **`master`** before merging **generic-images** (or the commit you tag as pre-generic).
- **2.0** ≈ **generic-images** branch / merge commit (tag e.g. `v2.0.0` when you release).
