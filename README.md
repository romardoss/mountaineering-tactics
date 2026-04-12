# Тактика проходження (mountaineering tactics)

Static web app for building tactic tables: drag symbols from the sidebar into cells, edit text, paint cell edges, save/load JSON, and export the table as PNG. UI is Ukrainian.

## Stack

- Plain HTML/CSS/JS under `static/`
- `html2canvas` (CDN) for PNG export
- Sidebar symbols and labels come from `static/images/image.json` (`frames` plus optional `genericTemplates` for inline SVG + text overlays; user-added symbols persist in `localStorage`)

## Run locally

From the repository root:

```bash
python -m start_server
```

Optional: open the generic template editor in the browser:

```bash
python -m start_server --generic
```

`python start_server.py` is equivalent (wrapper around the same module).

Serves **`static/`** at the site root (same layout as Cloudflare Pages) and **`tools/`** under **`/tools/`** (default port `8000`, may use the next free port). Open the URL shown in the terminal.

Requirements: **Python 3**.

## Deploy

```bash
wrangler pages dev static/
wrangler pages publish static/
wrangler pages deploy static/
```

Install the [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`), run `wrangler login`, then deploy from this directory. Prefer `wrangler pages deploy static/` for uploads; `publish` may be deprecated depending on your Wrangler version.

## Layout

| Path | Role |
|------|------|
| `static/index.html` | Page shell, help modal |
| `static/style.css` | Layout and styles |
| `static/script.js` | Table logic, export, help |
| `static/images/` | SVG symbols, `image.json` manifest (`frames` + `genericTemplates`) |
| `static/images/generic/` | Reusable SVG bases for custom symbols (e.g. `generic_rope.svg`) |
| `start_server/` + `start_server.py` | Local dev server: `static/` at `/`, `tools/` at `/tools/` (`python -m start_server` or `python start_server.py`; add `--generic` to open the editor) |
| `tools/generic-template-editor/` | Optional web UI to edit `genericTemplates` in `image.json` with live SVG preview; run `python -m start_server --generic` or open **`/tools/generic-template-editor/`**, then download `image.json` into `static/images/` |

## Generic template editor (optional)

Run **`python -m start_server --generic`** (or start the server and open **`/tools/generic-template-editor/`**). Edit templates, use the sample fields to preview overlays, then download **`image.json`** and replace `static/images/image.json`.
