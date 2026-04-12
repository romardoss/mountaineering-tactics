# Тактика проходження (mountaineering tactics)

Static web app for building tactic tables: drag symbols from the sidebar into cells, edit text, paint cell edges, save/load JSON, and export the table as PNG. UI is Ukrainian.

## Stack

- Plain HTML/CSS/JS under `static/`
- `html2canvas` (CDN) for PNG export
- Sidebar symbols and labels come from `static/images/image.json`

## Run locally

From the repository root:

```bash
python start_server.py
```

Serves `static/` (default port `8000`, may use the next free port). Open the URL shown in the terminal.

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
| `static/images/` | SVG symbols, `image.json` manifest |
| `start_server.py` | Local dev server for `static/` |
