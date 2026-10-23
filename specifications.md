# Specifications — Тактика проходження (v2.0)

This document says what the application does and what formats it uses. For how to run and deploy it, see [README.md](README.md). For the change history, see [whats_new.md](whats_new.md).

---

## 1. Purpose and scope

**Тактика проходження** ("passage tactics") is a client-side web app for drawing **mountaineering / rope-technique tactic tables**:

1. **Columns** are participants (numbered `1`, `2`, `3`, …).
2. **Rows** are time stages (часові стадії).
3. **Cells** hold symbols (actions such as "закріпити" or "здійснювати страховку"), parametrised generic symbols (for example a rope with its length), and free text.
4. **Cell edges** can be highlighted with colored lines to group cells or mark transitions.

The finished table can be saved as JSON, reopened later, and exported as a PNG image.

The UI is in **Ukrainian**. There is no backend, account system or server-side storage.

---

## 2. System overview

| Component | Path | Role |
|-----------|------|------|
| Main app | `static/index.html`, `static/script.js`, `static/style.css` | Table editor (deployed) |
| Symbol manifest | `static/images/image.json` | Lists frame symbols and generic templates |
| Frame symbols | `static/images/Frame N.svg` | Fixed-action SVG icons |
| Generic bases | `static/images/generic/*.svg` | SVG bases for parametrised symbols |
| Branding | `static/images/logo.svg`, `logo_500_500.svg` | Page logo and favicon |
| Dev server | `start_server.js`, `package.json` | Local HTTP server (Node.js, no dependencies) |
| Template editor | `tools/generic-template-editor/` | Local-only editor for `genericTemplates` |
| Legend | `symbol_table.jpg` | Reference image of the symbol set |
| Legacy script | `update_images.py` | Obsolete (see §10) |

### 2.1 Runtime dependencies

1. A modern browser with ES2020+, `fetch`, `DOMParser`, the HTML5 Drag and Drop API, `localStorage` and `sessionStorage`.
2. `html2canvas` **1.4.1**, loaded from cdnjs (needed only for PNG export).
3. Node.js 18.3+ (built-in modules only), needed only for local development.

### 2.2 Hosting

1. **Production:** the `static/` directory is deployed as a static site to Cloudflare Pages (`wrangler pages deploy static/`). Only `static/` is published.
2. **Local:** `npm start` (see §8).

---

## 3. Symbol manifest — `static/images/image.json`

The app fetches `images/image.json` at startup (relative to the site root).

### 3.1 Schema

```jsonc
{
  "genericTemplates": [ GenericTemplate, ... ],
  "frames":           [ Frame, ... ]
}
```

A bare JSON array is also accepted and treated as `{ "frames": <array>, "genericTemplates": [] }` (the 1.0 format). Missing keys default to empty arrays.

#### Frame

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `path` | string | yes | Image URL relative to the site root, e.g. `images/Frame 1.svg` |
| `name` | string | no | Tooltip text shown in the sidebar (Ukrainian action name) |
| `group` | string | no | Frames with the same `group` are shown as **one** sidebar tile with a number picker (§4.2). The value is the group's name and search keyword |

#### GenericTemplate

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `id` | string | yes | Unique, stable key. Saved tables refer to templates by this id |
| `name` | string | no | Display name (template dropdown, default tooltip) |
| `svg` | string | yes | Base SVG URL relative to the site root |
| `addUps` | AddUp[] | no | Text overlays. At most **3** are used |

#### AddUp

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `id` | string | yes | Key in the symbol's `values` map |
| `label` | string | no | Form label (falls back to `id`) |
| `placeholder` | string | no | Placeholder for text inputs |
| `control` | `"checkbox"` | no | When set, the add-up is a checkbox instead of a text input |
| `checkedText` | string | no | Text drawn when the checkbox is on (default `"с"`) |
| `svgText` | object | yes¹ | Overlay position: `{ x, y, fontSize, textAnchor }` in the base SVG's user units. `fontSize` defaults to 16. `textAnchor` is `start`, `middle` or `end` |

¹ An add-up with no `svgText` never draws anything.

### 3.2 Current content

1. **38 frames** in the sidebar: `Frame 1–23`, `32–44`, `49`, `50`. Frames 18–23 ("учасник #1" … "#6") form the group `"учасник"`; frames 34–37 (the four "петля …" variants) form the group `"петля"`; frames 38–41 (перила, перила суддівські, вантажні перила, вантажні перила суддівські) form the group `"перила"`.
2. **3 generic templates** (built in the **Додати мотузку** window):
   1. `rope` ("Мотузка"): add-ups `meters` (text), `note` (text) and `referee` (checkbox, draws `с`).
   2. `helping_rope` ("Мотузка допоміжна"): add-ups `meters` and `note`.
   3. `rail_rope` ("Мотузка основна, перильна", base `generic/generic_rail_rope.svg`: a horizontal line over a wave): add-ups `meters`, `note` and `referee` (checkbox, draws `с` above the line). It replaces the former sidebar frames 51 ("мотузка основна, перильна") and 56 (the same, суддівська).
3. **Retired frame files:** `Frame 51.svg` and `Frame 56.svg` are no longer in the manifest, but the files stay in `static/images/`, so older saved tables that reference them still render. Do not delete them.

### 3.3 Overlay rendering rules

The main app (`buildGenericSymbolElement`) and the template editor (`buildPreviewSvg`) must implement these rules identically:

1. Fetch the base SVG as text (cached per path) and parse it with `DOMParser` as `image/svg+xml`. A `parsererror` fails the render.
2. For each add-up that has `svgText`:
   1. **Text add-up:** trim the value. If it is empty, draw nothing. Otherwise draw the value.
   2. **Checkbox add-up:** it is "on" if the value is `"1"`, `true`, `"true"`, or a string whose trimmed value equals `checkedText`. When on, draw `checkedText`.
3. Each overlay is appended as an SVG `<text>` element with `fill="#000000"`, `font-family="Arial, Helvetica, 'Liberation Sans', sans-serif"`, `font-weight="normal"` (overlay text is never bold), and the configured `x`, `y`, `font-size` and `text-anchor`.
4. Each overlay also gets a white halo (`stroke="#ffffff"`, `stroke-width` = 16% of the font size with a minimum of 2, `paint-order="stroke"`), so it stays readable where it crosses the base symbol's lines.

### 3.4 Symbol drawing style

All frame symbols and generic bases share one style so they read consistently at 50 px:

1. A 300×300 `viewBox`, transparent background (no background rectangles), and pure vector drawing (no embedded raster images).
2. Ink `#111111`, stroke width 12 (about 2 px at 50 px), with round line caps and joins.
3. Arrows use filled triangular heads; curved arrows (Frame 17) use open chevrons.
4. Letters and digits use `Arial, Helvetica, 'Liberation Sans', sans-serif`. The referee mark is the Cyrillic letter "С"/"с".
5. Each symbol keeps the shapes and layout of its original version: only line weight and finish were unified. File names are unchanged, so existing saved tables show the new drawings.
6. Generic bases keep their original curves, because add-up text positions (`svgText`) are tuned to them.

---

## 4. Main application — functional requirements

### 4.1 Layout

The UI uses a single light theme. Colors, radii and shadows are defined as CSS custom properties on `:root` in `style.css`.

1. **Sidebar** (236 px, left): the title "Позначки" with a "Перетягніть у таблицю" hint, a search box, a **Додати мотузку** button, then a grid of draggable symbol tiles, three per row. Symbols render at 50×50 px.
2. **Main content:**
   1. **Header:** logo, title "Тактика проходження" and the **?** help button. The logo links to the club's Telegram channel, https://t.me/kpi_globus, which opens in a new tab.
   2. **Toolbar** (`.controls`, sticky while the table scrolls), in three groups:
      1. **Учасник −/+**: icon buttons that remove or add a participant.
      2. **Пензель**.
      3. **Відкрити**, **Зберегти** and the primary **Завантажити PNG**.
   3. **Team table** (`#teamTable`, §4.3.1) and below it the **main table** (`#editableTable`), each shown as a white card.
   4. **Додати часову стадію:** a full-width button directly under the table, because new rows are added at the bottom.
3. **Narrow screens:** below 900 px, toolbar buttons show icons only, with their names kept in tooltips. Below 640 px, the sidebar moves above the table.

### 4.2 Sidebar symbols

1. On load, the sidebar shows every manifest **frame** (as `<img>` with a `name` tooltip), followed by the user's **custom symbols** from `localStorage`.
2. Generic templates are **not** shown directly. The user creates presets (custom ropes) from them with the **Додати мотузку** button.
3. **Add a rope (Додати мотузку):** opens the modal "Нова мотузка":
   1. **Позначка:** a grid of tiles (`#addSymbolTemplateGrid`, `role="radiogroup"`), one per generic template, each showing its base SVG and name. The user clicks a tile (or focuses it and presses Space/Enter) to select it. The selected tile is highlighted (`aria-checked="true"`), and its id is kept in the hidden input `#addSymbolTemplate`. Nothing is preselected when the modal opens.
   2. After a selection, an editor area appears with a **live preview** (`#addSymbolPreview`, rendered with the §3.3 overlay rules) next to one input per add-up (first 3 only): a text field, or a checkbox for `control: "checkbox"`. The preview updates on every edit and when switching templates.
   3. The user optionally enters a display name ("Назва (підказка)"). It defaults to the template name, then the template id.
   4. On submit, the app generates `customId = "c_<timestamp>_<random7>"`, appends the entry to storage and adds the symbol to the sidebar. Checkbox values are stored as `"1"` (on) or `""` (off).
   5. If no tile is selected, the app alerts "Оберіть позначку мотузки.".
4. **Delete a custom symbol:** right-click it in the sidebar and confirm ("Видалити цю мотузку зі списку?"). It is removed from storage and from the sidebar. Copies already placed in table cells stay.
5. A custom entry whose `templateId` no longer exists in the manifest is silently skipped.
6. Custom symbols have an accent-colored corner so they can be told apart from manifest frames.

7. **Search:** typing in the search box hides sidebar symbols whose tooltip (`title`) doesn't contain the query (case-insensitive). If nothing matches, the sidebar shows "Нічого не знайдено". Symbols added later are filtered too.
8. **Frame groups** (учасник 1–6, петля, перила):
   1. All frames with the same `group` collapse into one tile (`.symbol-group`), placed where the group's first frame is in the manifest. The tile shows its current frame (the first one by default) and a badge: "1–N" when every frame name ends in `#<number>` (a numbered group), otherwise the number of variants N. The tooltip says "вибрати номер" or "вибрати варіант" accordingly.
   2. Hovering, clicking or pressing Enter/Space on the tile opens a picker (`.symbol-group-popover`, fixed position, above the tile or below it if there's no room) with one option per frame.
   3. Clicking an option makes it the tile's current frame. Dragging the tile drops the current frame. Dragging an option drops that frame directly (and makes it current).
   4. The picker closes 200 ms after the pointer leaves both the tile and the picker, when a drag starts, when the sidebar scrolls, or on Escape.
   5. Drops use the frame's image path, exactly like single frames, so saved tables and older files are unaffected.
   6. Search (item 7) matches a group tile by its group name or **any** of its variants' names (`data-search`), not only the variant currently shown.

### 4.3 Table structure

1. The initial table has 3 participant columns, 2 rows filled with `-`, and a final **"Дія"** (actions) column.
2. Every row ends with an actions cell (`.buttonRow`). It shows the label "Крок N" (a CSS counter, so it renumbers automatically) and three icon buttons:
   1. **Додати крок вище** (`.row-insert-above-btn`) inserts an empty row above this one.
   2. **Додати крок нижче** (`.row-insert-below-btn`) inserts an empty row below this one.
   3. **Видалити крок** (`.row-remove-btn`) deletes this row.
3. **Додати часову стадію** (under the table) appends an empty row at the bottom. An empty row has `-` in every participant cell, plus its actions cell.
4. **Учасник +** (`#addColBtn`): inserts a column before "Дія". Its header is the previous last header number + 1. Its cells are filled with `-`.
5. **Учасник −** (`#removeColBtn`): removes the last participant column. The last remaining participant column cannot be removed (alert "Не можна видалити останнього учасника.").

#### 4.3.1 Team table

A smaller table above the main one describes the team at the start.

1. It has **no header row**. It has the same number of columns as the main table, and its column widths match (the last column is 124 px in both), so the columns line up. During export, the column widths are applied to the cells of its first row.
2. It always has exactly **two rows**, which cannot be added or deleted:
   1. **Names** (`.team-names-row`): one always-editable text input per participant (`.member-name-input`), with the placeholder "Ім’я учасника". **Enter** finishes editing.
   2. **Спорядження перед стартом** (`.team-start-row`): cells behave exactly like main-table cells (§4.4–4.7: drop symbols, mixed text, right-click removal, brush). It is used to show which ropes and equipment each member carries at the start. New cells contain `-`.
3. Its last-column cells hold the labels "Імена" and "Спорядження перед стартом" (`.buttonRow.team-label-cell`) instead of buttons.
4. **Учасник +/−** adds or removes the last column in **both** tables.

### 4.4 Placing symbols (drag and drop)

1. Symbols can be dropped onto any participant cell of the main table and of the team table's start row. Drops on name cells and on "Дія" cells are ignored.
2. On the first drop, the cell's plain text is cleared and replaced by a `.cell-content-wrapper` container. Later drops append to that container.
3. Drag payloads:
   1. **Frame:** `text/plain` holds the image path.
   2. **Generic:** `application/x-tactics-symbol` holds the JSON payload. `text/plain` holds `tactics-generic:<URI-encoded JSON>` as a fallback.
4. A generic symbol is re-rendered from its template on drop. If rendering fails, the app alerts "Не вдалося вставити позначку.".
5. Symbols placed in cells cannot be dragged again.

### 4.5 Text editing

1. **Plain cell** (no symbols): clicking it turns it into an inline text input.
2. **Mixed cell** (has a wrapper):
   1. Clicking a text segment edits that segment.
   2. Clicking empty space when the cell **ends with text** edits that last text segment.
   3. Clicking empty space otherwise creates an empty text segment right after the **last** symbol and edits it.
   4. Clicking a symbol does nothing.
3. In all inline inputs, **Enter** or blur commits the change and **Escape** reverts it.
4. Only one input can be open in a cell at a time.

### 4.6 Removing content (right-click in the table)

1. Right-clicking a symbol (image or generic) removes it.
2. Right-clicking anywhere in a cell that has painted borders clears **all four** of its painted borders.
3. The browser context menu is suppressed only when one of these actions happened.

### 4.7 Brush (Пензель)

1. The **Пензель** button toggles brush mode. While it is on, the button gets the `brush-active` class and `aria-pressed="true"`, the toolbar shows a hint, and table cells use a crosshair cursor.
2. In brush mode, clicking within **8 px** of a cell edge toggles a 3 px **orange** line on the nearest edge (`painted-top|right|bottom|left`).
3. In brush mode, clicks do not edit text.

### 4.8 Save (Зберегти)

The app downloads `table-data.json` in the format described in §5: the team names, the team start row and the main rows. The "Дія" columns are not saved.

### 4.9 Open (Відкрити)

1. The user picks a `.json` file. The app replaces both tables with its contents.
2. Both the current object format and the older **bare-array** format (§5.4) are accepted. An old file opens with empty names and `-` in every start cell.
3. Headers are regenerated as `1..N` + "Дія". N is the length of the first row, or the number of team names or start cells if there are no rows, or the current column count otherwise. An empty table therefore keeps its header.
4. Invalid JSON produces the alert "Некоректний файл JSON.". Valid JSON with an unknown structure produces "Не вдалося відкрити таблицю: невідомий формат файлу." and leaves the current table untouched.
5. Generic segments whose template is missing from the manifest are skipped silently.

### 4.10 Export (Завантажити PNG)

1. The app downloads `table-export.png`, a raster of `#main-content` made with `html2canvas`. The PNG contains the team table and the **whole** main table, however long, not only the part visible on screen. It is cropped to the content, with no empty space below or to the right.
   1. During capture, `body.exporting` turns off the inner scrolling of the 100vh layout, so `#main-content` grows to its full height.
   2. The window is scrolled to the top, and html2canvas gets the full document size (`windowWidth`, `windowHeight`) with `scrollX`/`scrollY` set to 0.
   3. Afterwards, the scroll positions of the window and of `#main-content` are restored.
2. **Column width in the PNG:** every participant column gets the same width.
   1. The width is the widest single line of symbols in any cell of either table (images and generic symbols, plus the gaps between them), plus the cell padding, plus a margin (`EXPORT_CELL_MARGIN`, 24 px).
   2. Columns are never narrower than `EXPORT_MIN_CELL_WIDTH` (120 px), which also applies when there are no symbols.
   3. Text in a cell wraps within that width.
   4. Both tables get the same column widths. Their cards and the captured area shrink to the wider of the tables and the header.
   5. The on-screen column widths are restored after the export.
3. During capture, the sidebar, toolbar, **?** button, **Додати мотузку** button, **Додати часову стадію** button and the "Дія" columns of both tables are hidden. Name inputs are temporarily replaced by plain text (`.member-name-export`), so empty names stay blank instead of showing the placeholder.
4. During capture, `<img>` sources are inlined as data URLs, and inline generic SVGs are temporarily replaced by `<img>` elements with SVG data URLs.
5. Table cells must keep an explicit background color and have no CSS transitions. Otherwise html2canvas paints artifacts into the PNG.
6. Everything is restored afterwards, even if the export fails. On failure, the app alerts "Не вдалося експортувати таблицю."

### 4.11 Help and modals

1. **?** opens the "Як користуватися" help modal (usage summary and a contact link).
2. Both modals close with the × button, a backdrop click or **Escape**. While a modal is open, page scrolling is locked.

---

## 5. Table file format (`table-data.json`)

The current format (written since the team table was added) is an object:

```jsonc
{
  "format": "tactics-table",
  "version": 3,
  "team": {
    "names": [ "Андрій", "Оля", "" ],   // one string per column ("" = empty)
    "start": [ Cell, Cell, Cell ]      // team start row, one cell per column
  },
  "rows": [ [ Cell, Cell, Cell ], ... ] // main table, one array per step
}
```

Every row, plus `team.names` and `team.start`, should have the same length (the column count). Cells use the variants below.

### 5.1 Cell variants

```jsonc
// Plain text cell
{ "type": "text", "content": "-", "paintedBorders": Borders }

// Mixed cell (written by 2.0)
{ "type": "mixed", "segments": [ Segment, ... ], "paintedBorders": Borders }

// Legacy cell (1.x, read-only: still opens, never written)
{ "type": "images", "content": [ "images/Frame 3.svg", GenericSegment, ... ],
  "caption": "text", "paintedBorders": Borders }
```

`Borders` is `{ "top": bool, "right": bool, "bottom": bool, "left": bool }`. It is optional when reading.

### 5.2 Segments (in display order)

| Kind | Shape |
|------|-------|
| Frame image | `{ "type": "img", "src": "images/Frame 1.svg" }` |
| Text | `{ "type": "text", "text": "..." }` |
| Generic symbol | `{ "kind": "generic", "templateId": "rope", "values": { "meters": "40", "referee": "1" }, "displayName": "мотузка 40м", "customId": "c_..." }` |

### 5.3 Rules

1. Image `src` is saved as the URL path without the leading `/`, so files stay portable between local and deployed hosts.
2. A wrapper with no segments is saved as `{ "type": "text", "content": "" }`.
3. A generic segment stores **values only**. It is re-rendered from the current manifest when loaded, so changing a template changes how saved tables look. A template `id` must therefore never be renamed or removed while tables still use it.
4. A legacy `images` cell loads as its images followed by one text segment holding `caption`.

### 5.4 Older formats (read-only)

1. **Bare array** (all saves before the team table): the top level is the `rows` array itself, with no `team`. It loads with an empty team table.
2. Missing or partial `team.names` / `team.start` arrays are padded with empty names and `-` cells.

---

## 6. Client-side storage

| Key | Storage | Owner | Content |
|-----|---------|-------|---------|
| `tactics_custom_symbols_v1` | `localStorage` | Main app | `[{ customId, templateId, values, displayName }]` |
| `tactics_generic_editor_sample_values_v1` | `sessionStorage` | Template editor | `{ [templateId]: { [addUpId]: value } }` preview samples |

Custom symbols are per browser and per origin. They are not part of saved table files, but placed copies are fully described in each table's segments.

---

## 7. Generic template editor (`/tools/generic-template-editor/`)

This is a local-only tool for maintaining `genericTemplates`. It is not deployed.

1. It loads `/images/image.json` through the dev server.
2. It lists templates. **Новий шаблон** adds one with id `template_<timestamp>` and the `generic_rope.svg` base. **Видалити** deletes the selected one after confirmation, but at least one template must remain.
3. It edits a template's `id`, `name` and `svg` path.
4. It edits add-ups (maximum **3**): `id`, `label`, `placeholder`, control type, `checkedText` and `svgText` (x, y, fontSize, textAnchor). **Додати add-up** adds `field_<n>` at (200, 100), size 16, centered. **Прибрати останній** removes the last add-up.
5. It shows a live preview using the rules in §3.3, with per-template sample values kept in `sessionStorage`. Sample values follow a template when its id is renamed.
6. **Завантажити image.json** downloads the full manifest (frames unchanged, 2-space indent, trailing newline). The maintainer then replaces `static/images/image.json` by hand.

---

## 8. Development server (`start_server.js`)

1. **Commands:**
   1. `npm start` serves the app.
   2. `npm run generic` serves it and opens the template editor instead of the app.
   3. `node start_server.js [--generic]` does the same without npm. `--help` prints usage.
2. **Routing:**
   1. `/tools/...` is served from `<repo>/tools/`.
   2. Every other path is served from `<repo>/static/`. A directory serves its `index.html`, so `/` serves `static/index.html`.
   3. A directory requested without a trailing slash is redirected (301) to the slash form, so relative links inside its page resolve.
   4. Path traversal (`..`, including URL-encoded) cannot leave the chosen root.
   5. Missing files return 404. Only `GET` and `HEAD` are allowed; other methods return 405.
3. **Port:** starts at 8000. If a port is busy, it tries the next one, up to 20 ports.
4. **Caching:** conditional requests are never answered with 304, and every response carries `Cache-Control: no-store`, `Pragma: no-cache` and `Expires: 0`, so edits show up on reload.
5. **Browser:** opens the app (or the editor with `--generic`) with the OS launcher (`start`, `open` or `xdg-open`). If no launcher is found, it prints the URL.
6. **Stopping:** Ctrl+C stops the server cleanly.

---

## 9. Non-functional requirements

1. **Static only:** no build step and no server-side code in production.
2. **Dev tooling:** the dev server must stay dependency-free (no `npm install` step).
3. **Offline use:** works offline once loaded, except PNG export, which needs the `html2canvas` CDN script.
4. **Privacy:** all data stays in the browser or in files the user downloads.
5. **Portability:** saved tables reference assets by relative path and template id. They open on any host that serves the same `static/` tree.
6. **Backward compatibility:**
   1. The bare-array manifest (1.0) must still load.
   2. Legacy `images` cells must still load.
   3. Generic template ids are a stable contract (§5.3).
7. **Accessibility:** modals use `role="dialog"` and `aria-modal`, and the help button maintains `aria-expanded`. Focus returns to the opening button when a modal closes.

---

## 10. Known limitations and open issues

1. Only the top-level structure of an opened file is validated. A file whose top level is valid but whose individual cells are malformed (for example `null` cells) can still fail partway through loading.
2. The "add participant" column number is computed from the last header text. A non-numeric header gives `NaN`.
3. The help modal and the add-symbol modal have no focus trap.
4. Generic symbols render at a fixed 50×50 px. Overlay coordinates are in each base SVG's own coordinate system.
5. `update_images.py` is obsolete:
   1. Its `SCRIPT_FILE` path has a typo (`statis/script.js`).
   2. It targets an `imageUrls` array that no longer exists.
   3. It ignores `.svg` files.

   The manifest is now `image.json`, maintained by hand or with the template editor.
6. Custom symbols live in `localStorage`, so they are lost when site data is cleared and are not synced across devices.
7. Pressing **Enter** in a mixed-cell text input saves it, and the blur that follows tries to save it again. This logs a harmless `replaceWith` DOM error in the console. The saved text is correct.
