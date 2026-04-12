# Тактика проходження (mountaineering tactics)

Prod web version is by the link:
https://mountaineering-tactics-e0i.pages.dev/

YouTube tutorials:
1. https://youtu.be/xjq_BIWG_mQ
2. https://youtu.be/twp5ZQn7TEs

If any suggestions, write them here https://docs.google.com/document/d/1x-UwBtVQTPDgQ9rpQW5t13jk7ALCZZuHRYcSSdy_0C4/edit?usp=sharing
or ask a dev

**Version 2.0** — static web app for building tactic tables: drag symbols from the sidebar, place **frames** and **generic SVG** symbols in cells, add **interleaved text**, paint cell edges, save/load JSON (including **mixed** cell format), export PNG. UI is Ukrainian.

For changes since the pre–generic-images **`master`** baseline, see **[whats_new.md](whats_new.md)**.

## Stack

- Plain HTML/CSS/JS under `static/`
- `html2canvas` (CDN) for PNG export
- **`static/images/image.json`**: **`frames`** (frame SVGs) + **`genericTemplates`** (inline SVG bases + text add-ups)
- **Custom symbols** (from **+**): stored in **`localStorage`**, draggable like frames/generics

## Run locally

From the repository root:

```bash
python -m start_server
```

Optional: open the **generic template editor** in the browser:

```bash
python -m start_server --generic
```

`python start_server.py` is equivalent (wrapper around the same module).

The server exposes:

- **`static/`** at the site root (same layout as **Cloudflare Pages** deploy of `static/`)
- **`tools/`** at **`/tools/…`** (e.g. generic template editor)

Default port **8000** (or the next free port). Open the URL printed in the terminal.

Requirements: **Python 3**.

## Deploy

```bash
wrangler pages dev static/
wrangler pages publish static/
wrangler pages deploy static/
```

Install the [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`), run `wrangler login`, then deploy from this directory. Prefer `wrangler pages deploy static/` for uploads; `publish` may be deprecated depending on your Wrangler version.

> Deploy uploads only **`static/`**. The **generic template editor** in `tools/` is for **local editing**; after exporting `image.json`, copy it into `static/images/`.

## Layout

| Path | Role |
|------|------|
| `static/index.html` | Page shell, help modal, **+** custom symbol modal |
| `static/style.css` | Layout and styles |
| `static/script.js` | Table, drag/drop, mixed cells, save/load, export, help |
| `static/images/` | SVG symbols, **`image.json`** (`frames` + `genericTemplates`) |
| `static/images/generic/` | SVG bases for generic symbols (e.g. `generic_rope.svg`) |
| `start_server/` + `start_server.py` | Dev server: `static/` at `/`, `tools/` at `/tools/` |
| `tools/generic-template-editor/` | Local web editor for `genericTemplates` (preview + download `image.json`) |

## Generic template editor (optional)

Run **`python -m start_server --generic`**, or start the server and open **`/tools/generic-template-editor/`**.

Edit templates, preview overlays, download **`image.json`**, then replace **`static/images/image.json`** in the repo.

## Table data format (short)

- **Plain cell**: `type: "text"`, `content` string.
- **Rich cell**: `type: "mixed"`, **`segments`** in order: `img` paths, `generic` payloads, `text` strings. Older **`type: "images"`** + **`caption`** files still open.

See **[whats_new.md](whats_new.md)** for the full 1.0 → 2.0 feature list.
