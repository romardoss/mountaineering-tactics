document.addEventListener('DOMContentLoaded', () => {
    const imageJson = 'images/image.json';
    const STORAGE_CUSTOM = 'tactics_custom_symbols_v1';
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const promiseJson = fetch(imageJson).then((r) => r.json());
    const table = document.getElementById('editableTable');
    const addRowBtn = document.getElementById('addRowBtn');
    const saveBtn = document.getElementById('saveBtn');
    const openBtn = document.getElementById('openBtn');
    const fileInput = document.getElementById('fileInput');
    const exportBtn = document.getElementById('exportBtn');
    const addColBtn = document.getElementById('addColBtn');
    const removeColBtn = document.getElementById('removeColBtn');
    const brushBtn = document.getElementById('brushBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarSymbols = document.getElementById('sidebarSymbols');
    const controls = document.querySelector('.controls');
    const helpBtn = document.getElementById('helpBtn');
    const addSymbolBtn = document.getElementById('addSymbolBtn');
    const addSymbolModal = document.getElementById('addSymbolModal');
    const addSymbolForm = document.getElementById('addSymbolForm');
    const addSymbolTemplate = document.getElementById('addSymbolTemplate');
    const addSymbolFields = document.getElementById('addSymbolFields');
    const addSymbolDisplayName = document.getElementById('addSymbolDisplayName');
    const addSymbolTemplateGrid = document.getElementById('addSymbolTemplateGrid');
    const addSymbolEditor = document.getElementById('addSymbolEditor');
    const addSymbolPreview = document.getElementById('addSymbolPreview');

    if (!table || !addRowBtn || !sidebar || !sidebarSymbols || !saveBtn || !openBtn || !fileInput || !exportBtn || !controls || !addColBtn || !removeColBtn || !brushBtn) {
        console.error('Required element not found!');
        return;
    }

    /** @type {{ genericTemplates: object[], frames: object[] }} */
    let manifest = { genericTemplates: [], frames: [] };
    const templateById = new Map();
    const templateSvgCache = new Map();

    function normalizeManifest(raw) {
        if (Array.isArray(raw)) {
            return { frames: raw, genericTemplates: [] };
        }
        return {
            frames: raw.frames || [],
            genericTemplates: raw.genericTemplates || [],
        };
    }

    function loadCustomSymbols() {
        try {
            const s = localStorage.getItem(STORAGE_CUSTOM);
            if (!s) return [];
            const parsed = JSON.parse(s);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveCustomSymbols(list) {
        localStorage.setItem(STORAGE_CUSTOM, JSON.stringify(list));
    }

    function removeCustomSymbolFromStorage(customId) {
        const list = loadCustomSymbols().filter((e) => e.customId !== customId);
        saveCustomSymbols(list);
    }

    /**
     * @param {HTMLElement} el
     * @param {string} customId
     */
    function wireCustomSidebarDelete(el, customId, displayTitle) {
        el.classList.add('symbol-custom');
        el.dataset.customId = customId;
        const baseTitle = displayTitle || '';
        el.title = baseTitle ? `${baseTitle} — ПКМ: видалити зі списку` : 'ПКМ: видалити зі списку';
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!confirm('Видалити цю мотузку зі списку?')) return;
            removeCustomSymbolFromStorage(customId);
            el.remove();
        });
    }

    async function getTemplateSvgString(svgPath) {
        if (templateSvgCache.has(svgPath)) {
            return templateSvgCache.get(svgPath);
        }
        const res = await fetch(svgPath);
        const text = await res.text();
        templateSvgCache.set(svgPath, text);
        return text;
    }

    /**
     * @param {object} template - genericTemplates[] entry
     * @param {Record<string, string>} values - addUp id -> text
     * @returns {Promise<HTMLElement>} div.symbol-generic
     */
    async function buildGenericSymbolElement(template, values, payload) {
        const svgText = await getTemplateSvgString(template.svg);
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const srcSvg = doc.documentElement;
        if (srcSvg.querySelector('parsererror')) {
            throw new Error('Invalid SVG template');
        }
        const svg = /** @type {SVGSVGElement} */ (document.importNode(srcSvg, true));

        (template.addUps || []).forEach((addUp) => {
            if (!addUp.svgText) return;
            const raw = values[addUp.id];
            let displayText = null;
            if (addUp.control === 'checkbox') {
                const letter = addUp.checkedText != null ? String(addUp.checkedText) : 'с';
                const on =
                    raw === '1' ||
                    raw === true ||
                    raw === 'true' ||
                    (typeof raw === 'string' && raw.trim() === letter);
                if (!on) return;
                displayText = letter;
            } else {
                const v = (raw != null ? String(raw) : '').trim();
                if (!v) return;
                displayText = v;
            }
            const t = document.createElementNS(SVG_NS, 'text');
            const st = addUp.svgText;
            t.setAttribute('x', String(st.x));
            t.setAttribute('y', String(st.y));
            t.setAttribute('fill', '#000000');
            // Same face as the letters inside the symbols; explicit regular weight (never bold)
            t.setAttribute('font-family', "Arial, Helvetica, 'Liberation Sans', sans-serif");
            t.setAttribute('font-weight', 'normal');
            t.setAttribute('font-size', String(st.fontSize || 16));
            // White halo keeps the text readable where it crosses the symbol's lines
            t.setAttribute('stroke', '#ffffff');
            t.setAttribute('stroke-width', String(Math.max(2, (st.fontSize || 16) * 0.16)));
            t.setAttribute('stroke-linejoin', 'round');
            t.setAttribute('paint-order', 'stroke');
            if (st.textAnchor) {
                t.setAttribute('text-anchor', st.textAnchor);
            }
            t.textContent = displayText;
            svg.appendChild(t);
        });

        const wrap = document.createElement('div');
        wrap.className = 'symbol-generic';
        wrap.setAttribute('draggable', 'true');
        wrap.setAttribute('data-symbol-json', JSON.stringify(payload));
        wrap.appendChild(svg);
        return wrap;
    }

    function wireGenericDrag(wrap, payload) {
        const encoded = `tactics-generic:${encodeURIComponent(JSON.stringify(payload))}`;
        wrap.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/x-tactics-symbol', JSON.stringify(payload));
            e.dataTransfer.setData('text/plain', encoded);
            e.dataTransfer.effectAllowed = 'copy';
        });
    }

    /** Drag payload for a frame symbol (the table stores frames by image path). */
    function setFrameDragData(e, path) {
        e.dataTransfer.setData('text/plain', path);
        e.dataTransfer.setData('application/x-tactics-symbol', '');
        e.dataTransfer.effectAllowed = 'copy';
    }

    function appendSidebarFrame(frame) {
        const img = document.createElement('img');
        img.src = frame.path;
        img.draggable = true;
        img.title = frame.name || '';
        img.addEventListener('dragstart', (e) => setFrameDragData(e, frame.path));
        sidebarSymbols.appendChild(img);
    }

    // ---------- Frame groups: several numbered frames shown as one sidebar tile ----------
    // Hovering the tile shows a picker above it; each option is clickable (sets the tile's
    // current frame) and draggable (drops that frame directly). Drops use the frame paths,
    // so saved tables are unchanged.
    const groupPopover = document.createElement('div');
    groupPopover.className = 'symbol-group-popover';
    groupPopover.setAttribute('role', 'group');
    groupPopover.hidden = true;
    document.body.appendChild(groupPopover);
    let groupPopoverTile = null;
    let groupPopoverHideTimer = 0;

    function hideGroupPopover() {
        clearTimeout(groupPopoverHideTimer);
        groupPopover.hidden = true;
        groupPopoverTile = null;
    }

    function scheduleHideGroupPopover() {
        clearTimeout(groupPopoverHideTimer);
        groupPopoverHideTimer = setTimeout(hideGroupPopover, 200);
    }

    groupPopover.addEventListener('mouseenter', () => clearTimeout(groupPopoverHideTimer));
    groupPopover.addEventListener('mouseleave', scheduleHideGroupPopover);
    sidebar.addEventListener('scroll', hideGroupPopover);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !groupPopover.hidden) {
            const tile = groupPopoverTile;
            hideGroupPopover();
            tile?.focus();
        }
    });

    /**
     * @param {HTMLElement} tile
     * @param {{ name: string, frames: object[], getCurrent: () => object, setCurrent: (f: object) => void }} group
     */
    function showGroupPopover(tile, group) {
        clearTimeout(groupPopoverHideTimer);
        if (groupPopoverTile === tile && !groupPopover.hidden) return;
        groupPopoverTile = tile;
        groupPopover.setAttribute('aria-label', group.name);
        const options = group.frames.map((frame, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'symbol-group-option';
            btn.draggable = true;
            btn.title = frame.name || '';
            btn.setAttribute('aria-pressed', String(frame === group.getCurrent()));
            const img = document.createElement('img');
            img.src = frame.path;
            img.alt = String(i + 1);
            img.draggable = false;
            btn.appendChild(img);
            btn.addEventListener('click', () => {
                group.setCurrent(frame);
                options.forEach((o) => o.setAttribute('aria-pressed', String(o === btn)));
            });
            btn.addEventListener('dragstart', (e) => {
                setFrameDragData(e, frame.path);
                group.setCurrent(frame);
                setTimeout(hideGroupPopover, 0); // after the drag has started
            });
            return btn;
        });
        groupPopover.replaceChildren(...options);
        groupPopover.hidden = false;
        // Fixed position above the tile (below if there is no room), kept inside the window
        const r = tile.getBoundingClientRect();
        const pw = groupPopover.offsetWidth;
        const ph = groupPopover.offsetHeight;
        const left = Math.min(Math.max(8, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 8);
        const above = r.top - ph - 8;
        groupPopover.style.left = `${left}px`;
        groupPopover.style.top = `${above >= 8 ? above : r.bottom + 8}px`;
        groupPopover.classList.toggle('symbol-group-popover--below', above < 8);
        groupPopover.style.setProperty('--arrow-x', `${r.left + r.width / 2 - left}px`);
    }

    /**
     * @param {string} name - group name (also the search keyword)
     * @param {object[]} frames - frames in display order
     */
    function appendSidebarFrameGroup(name, frames) {
        let current = frames[0];
        // Numbered groups ("учасник #1" … "#6") pick a number; others pick a variant
        const numbered = frames.every((f) => /#\d+$/.test(f.name || ''));
        const pickWord = numbered ? 'номер' : 'варіант';
        const tile = document.createElement('div');
        tile.className = 'symbol-group';
        tile.draggable = true;
        tile.tabIndex = 0;
        tile.setAttribute('role', 'button');
        tile.setAttribute('aria-haspopup', 'true');
        const img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        const badge = document.createElement('span');
        badge.className = 'symbol-group__badge';
        badge.textContent = numbered ? `1–${frames.length}` : String(frames.length);
        tile.dataset.search = [name, ...frames.map((f) => f.name || '')].join(' ');
        tile.append(img, badge);
        const group = {
            name,
            frames,
            getCurrent: () => current,
            setCurrent: (frame) => {
                current = frame;
                img.src = frame.path;
                tile.title = `${frame.name || name} — наведіть, щоб вибрати ${pickWord}`;
                tile.setAttribute('aria-label', `${frame.name || name}: вибрати ${pickWord}`);
            },
        };
        group.setCurrent(current);
        tile.addEventListener('dragstart', (e) => {
            setFrameDragData(e, current.path);
            setTimeout(hideGroupPopover, 0);
        });
        tile.addEventListener('mouseenter', () => showGroupPopover(tile, group));
        tile.addEventListener('mouseleave', scheduleHideGroupPopover);
        tile.addEventListener('click', () => showGroupPopover(tile, group));
        tile.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            showGroupPopover(tile, group);
            groupPopover.querySelector('[aria-pressed="true"]')?.focus();
        });
        sidebarSymbols.appendChild(tile);
    }

    async function appendSidebarCustom(entry) {
        const template = templateById.get(entry.templateId);
        if (!template) return;
        const payload = {
            kind: 'generic',
            templateId: entry.templateId,
            values: entry.values || {},
            displayName: entry.displayName || template.name,
            customId: entry.customId,
        };
        const el = await buildGenericSymbolElement(template, entry.values || {}, payload);
        const displayTitle = entry.displayName || template.name;
        el.title = displayTitle;
        wireGenericDrag(el, payload);
        wireCustomSidebarDelete(el, entry.customId, displayTitle);
        sidebarSymbols.appendChild(el);
    }

    async function fillSidebar() {
        sidebarSymbols.innerHTML = '';
        hideGroupPopover();
        // Frames sharing a `group` collapse into one tile, placed where the group's first frame is
        const shownGroups = new Set();
        manifest.frames.forEach((frame) => {
            if (!frame.group) {
                appendSidebarFrame(frame);
                return;
            }
            if (shownGroups.has(frame.group)) return;
            shownGroups.add(frame.group);
            appendSidebarFrameGroup(
                frame.group,
                manifest.frames.filter((f) => f.group === frame.group),
            );
        });
        const customs = loadCustomSymbols();
        for (const c of customs) {
            await appendSidebarCustom(c);
        }
    }

    const symbolSearch = document.getElementById('symbolSearch');
    const symbolSearchEmpty = document.getElementById('symbolSearchEmpty');

    /** Hide sidebar symbols whose tooltip doesn't match the search box. */
    function applySymbolFilter() {
        if (!symbolSearch) return;
        const query = symbolSearch.value.trim().toLowerCase();
        let visible = 0;
        for (const el of sidebarSymbols.children) {
            // Group tiles carry every variant name in data-search, so any variant finds them
            const haystack = `${el.dataset.search || ''} ${el.title || ''}`.toLowerCase();
            const match = !query || haystack.includes(query);
            el.hidden = !match;
            if (match) visible++;
        }
        if (symbolSearchEmpty) symbolSearchEmpty.hidden = !query || visible > 0;
    }

    if (symbolSearch) {
        symbolSearch.addEventListener('input', applySymbolFilter);
        new MutationObserver(applySymbolFilter).observe(sidebarSymbols, { childList: true });
    }

    promiseJson.then((raw) => {
        manifest = normalizeManifest(raw);
        manifest.genericTemplates.forEach((t) => templateById.set(t.id, t));
        fillSidebar();
        fillTemplateGrid();
    });

    /** One selectable tile per generic template in the "Додати мотузку" modal. */
    function fillTemplateGrid() {
        if (!addSymbolTemplateGrid) return;
        addSymbolTemplateGrid.innerHTML = '';
        manifest.genericTemplates.forEach((t) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'template-option';
            btn.dataset.templateId = t.id;
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', 'false');
            btn.title = t.name || t.id;
            const img = document.createElement('img');
            img.src = t.svg;
            img.alt = '';
            const label = document.createElement('span');
            label.textContent = t.name || t.id;
            btn.append(img, label);
            btn.addEventListener('click', () => selectAddSymbolTemplate(t.id));
            addSymbolTemplateGrid.appendChild(btn);
        });
    }

    /** @param {string} templateId - '' clears the selection */
    function selectAddSymbolTemplate(templateId) {
        if (addSymbolTemplate) addSymbolTemplate.value = templateId;
        addSymbolTemplateGrid?.querySelectorAll('.template-option').forEach((btn) => {
            btn.setAttribute('aria-checked', String(btn.dataset.templateId === templateId));
        });
        if (addSymbolEditor) addSymbolEditor.hidden = !templateId;
        renderAddSymbolFields(templateId);
        updateAddSymbolPreview();
    }

    /** Values of the add-up inputs currently shown in the modal (checkbox: '1' or ''). */
    function readAddSymbolValues() {
        const values = {};
        addSymbolFields?.querySelectorAll('[data-add-up-id]').forEach((input) => {
            const id = input.dataset.addUpId;
            if (!id) return;
            values[id] = input.type === 'checkbox' ? (input.checked ? '1' : '') : input.value || '';
        });
        return values;
    }

    let previewRequest = 0;

    /** Re-render the live preview of the rope being configured. */
    async function updateAddSymbolPreview() {
        if (!addSymbolPreview) return;
        const request = ++previewRequest;
        const template = templateById.get(addSymbolTemplate?.value || '');
        if (!template) {
            addSymbolPreview.innerHTML = '';
            return;
        }
        try {
            const values = readAddSymbolValues();
            const el = await buildGenericSymbolElement(template, values, { kind: 'generic', templateId: template.id, values });
            if (request !== previewRequest) return; // a newer edit already started rendering
            el.removeAttribute('draggable');
            addSymbolPreview.replaceChildren(el);
        } catch (err) {
            console.error(err);
        }
    }

    const helpModal = document.getElementById('helpModal');
    if (helpBtn && helpModal) {
        const closeBtn = helpModal.querySelector('.help-modal__close');
        const openHelp = () => {
            helpModal.removeAttribute('hidden');
            helpBtn.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
            closeBtn?.focus();
        };
        const closeHelp = () => {
            helpModal.setAttribute('hidden', '');
            helpBtn.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
            helpBtn.focus();
        };
        helpBtn.addEventListener('click', () => openHelp());
        helpModal.querySelectorAll('[data-close-modal]').forEach((el) => {
            el.addEventListener('click', () => closeHelp());
        });
    }

    function openAddSymbolModal() {
        if (!addSymbolModal) return;
        addSymbolModal.removeAttribute('hidden');
        addSymbolForm?.reset();
        selectAddSymbolTemplate('');
        if (addSymbolDisplayName) addSymbolDisplayName.value = '';
        document.body.style.overflow = 'hidden';
    }

    function closeAddSymbolModal() {
        if (!addSymbolModal) return;
        addSymbolModal.setAttribute('hidden', '');
        document.body.style.overflow = '';
        addSymbolBtn?.focus();
    }

    function renderAddSymbolFields(templateId) {
        if (!addSymbolFields) return;
        addSymbolFields.innerHTML = '';
        const template = templateById.get(templateId);
        if (!template || !template.addUps) return;
        template.addUps.slice(0, 3).forEach((addUp) => {
            const row = document.createElement('label');
            row.className = 'add-symbol-form__row';
            if (addUp.control === 'checkbox') {
                row.classList.add('add-symbol-form__row--checkbox');
            }
            const span = document.createElement('span');
            span.textContent = addUp.label || addUp.id;
            row.appendChild(span);
            if (addUp.control === 'checkbox') {
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.name = `addUp_${addUp.id}`;
                input.dataset.addUpId = addUp.id;
                input.title = addUp.label || '';
                row.appendChild(input);
            } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.name = `addUp_${addUp.id}`;
                input.dataset.addUpId = addUp.id;
                input.placeholder = addUp.placeholder || '';
                input.autocomplete = 'off';
                row.appendChild(input);
            }
            addSymbolFields.appendChild(row);
        });
    }

    if (addSymbolBtn && addSymbolModal) {
        addSymbolBtn.addEventListener('click', () => openAddSymbolModal());
        addSymbolModal.querySelectorAll('[data-close-add-symbol]').forEach((el) => {
            el.addEventListener('click', () => closeAddSymbolModal());
        });
        addSymbolFields?.addEventListener('input', () => updateAddSymbolPreview());
        addSymbolFields?.addEventListener('change', () => updateAddSymbolPreview());
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (addSymbolModal && !addSymbolModal.hidden) {
            closeAddSymbolModal();
            return;
        }
        if (helpModal && !helpModal.hidden) {
            helpModal.setAttribute('hidden', '');
            document.body.style.overflow = '';
            helpBtn?.setAttribute('aria-expanded', 'false');
            helpBtn?.focus();
        }
    });

    if (addSymbolForm) {
        addSymbolForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const templateId = addSymbolTemplate?.value;
            if (!templateId) {
                alert('Оберіть позначку мотузки.');
                return;
            }
            const template = templateById.get(templateId);
            if (!template) return;
            const values = readAddSymbolValues();
            const displayName = (addSymbolDisplayName?.value || '').trim() || template.name || templateId;
            const customId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            const entry = { customId, templateId, values, displayName };
            const list = loadCustomSymbols();
            list.push(entry);
            saveCustomSymbols(list);
            await appendSidebarCustom(entry);
            closeAddSymbolModal();
        });
    }

    let isBrushActive = false;

    brushBtn.addEventListener('click', () => {
        isBrushActive = !isBrushActive;
        brushBtn.classList.toggle('brush-active');
        brushBtn.setAttribute('aria-pressed', String(isBrushActive));
    });

    /**
     * Insert an empty row (`-` in every participant cell) at the given tbody index (-1 = end).
     * @param {number} index
     */
    function insertEmptyRow(index) {
        const newRow = tableBody.insertRow(index);
        const columnCount = table.querySelector('thead tr').childElementCount - 1;
        for (let i = 0; i < columnCount; i++) {
            const newCell = newRow.insertCell();
            newCell.textContent = '-';
        }
        addRemoveButton(newRow);
        return newRow;
    }

    function createRowActionButton(className, label, svgPaths, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `row-action-btn ${className}`;
        btn.title = label;
        btn.setAttribute('aria-label', label);
        btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${svgPaths}</svg>`;
        btn.addEventListener('click', onClick);
        return btn;
    }

    /** Actions cell: insert step above / below, delete step. */
    const addRemoveButton = (row) => {
        const newCell = row.insertCell();
        newCell.className = 'buttonRow';
        const actions = document.createElement('div');
        actions.className = 'row-actions';
        actions.append(
            createRowActionButton(
                'row-insert-above-btn',
                'Додати крок вище',
                '<rect x="3" y="13" width="18" height="8" rx="1"/><path d="M12 3v6M9 6h6"/>',
                () => insertEmptyRow(row.sectionRowIndex),
            ),
            createRowActionButton(
                'row-insert-below-btn',
                'Додати крок нижче',
                '<rect x="3" y="3" width="18" height="8" rx="1"/><path d="M12 15v6M9 18h6"/>',
                () => insertEmptyRow(row.sectionRowIndex + 1),
            ),
            createRowActionButton(
                'row-remove-btn',
                'Видалити крок',
                '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
                () => row.remove(),
            ),
        );
        newCell.appendChild(actions);
    };

    const tableBody = table.querySelector('tbody');
    if (!tableBody) {
        console.error('Table body not found!');
        return;
    }

    tableBody.querySelectorAll('tr').forEach(addRemoveButton);

    // ---------- Team table (above the main table): member names + equipment at the start ----------
    const teamTable = document.getElementById('teamTable');
    const teamBody = teamTable?.querySelector('tbody');
    if (!teamTable || !teamBody) {
        console.error('Team table not found!');
        return;
    }
    const TEAM_NAME_PLACEHOLDER = 'Ім’я учасника';

    function getColumnCount() {
        return table.querySelector('thead tr').childElementCount - 1;
    }

    /**
     * @param {HTMLTableRowElement} row
     * @param {number} index - cell index (-1 = end)
     * @param {string} [name]
     */
    function insertMemberNameCell(row, index, name) {
        const cell = row.insertCell(index);
        cell.className = 'member-name-cell';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'member-name-input';
        input.placeholder = TEAM_NAME_PLACEHOLDER;
        input.autocomplete = 'off';
        input.setAttribute('aria-label', TEAM_NAME_PLACEHOLDER);
        input.value = name || '';
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') input.blur();
        });
        cell.appendChild(input);
        return cell;
    }

    function insertTeamLabelCell(row, label) {
        const cell = row.insertCell();
        cell.className = 'buttonRow team-label-cell';
        cell.textContent = label;
    }

    /**
     * Rebuild the team table for the given column count.
     * @param {number} columnCount
     * @param {{ names?: string[], start?: object[] }} [team]
     */
    async function buildTeamTable(columnCount, team = {}) {
        teamBody.innerHTML = '';
        const names = Array.isArray(team.names) ? team.names : [];
        const start = Array.isArray(team.start) ? team.start : [];
        const namesRow = teamBody.insertRow();
        namesRow.className = 'team-names-row';
        const startRow = teamBody.insertRow();
        startRow.className = 'team-start-row';
        for (let i = 0; i < columnCount; i++) {
            insertMemberNameCell(namesRow, -1, typeof names[i] === 'string' ? names[i] : '');
            const cell = startRow.insertCell();
            if (start[i]) await fillCell(cell, start[i]);
            else cell.textContent = '-';
        }
        insertTeamLabelCell(namesRow, 'Імена');
        insertTeamLabelCell(startRow, 'Спорядження перед стартом');
    }

    buildTeamTable(getColumnCount());

    /** Both table bodies that hold symbol cells. */
    const symbolBodies = [teamBody, tableBody];

    /** A cell that accepts symbols, text and brush edges (not names, not the actions column). */
    function isSymbolCell(cell) {
        return (
            !!cell &&
            cell.tagName === 'TD' &&
            !cell.classList.contains('buttonRow') &&
            !cell.classList.contains('member-name-cell')
        );
    }

    function parseDroppedSymbol(textPlain, appJson) {
        if (appJson) {
            try {
                const p = JSON.parse(appJson);
                if (p && p.kind === 'generic' && p.templateId) return p;
            } catch {
                /* ignore */
            }
        }
        if (textPlain && textPlain.startsWith('tactics-generic:')) {
            try {
                const p = JSON.parse(decodeURIComponent(textPlain.slice('tactics-generic:'.length)));
                if (p && p.kind === 'generic' && p.templateId) return p;
            } catch {
                /* ignore */
            }
        }
        if (textPlain && textPlain.length) {
            return { kind: 'path', path: textPlain };
        }
        return null;
    }

    /** Cell currently highlighted as a drop target (visual only). */
    let dropTargetCell = null;

    function setDropTarget(cell) {
        if (cell === dropTargetCell) return;
        dropTargetCell?.classList.remove('drop-target');
        dropTargetCell = cell;
        dropTargetCell?.classList.add('drop-target');
    }

    /** Bind the same handler on every symbol-cell table body. */
    function onSymbolBodies(type, handler) {
        symbolBodies.forEach((body) => body.addEventListener(type, handler));
    }

    onSymbolBodies('dragover', (e) => {
        e.preventDefault();
        const cell = e.target.closest && e.target.closest('td');
        setDropTarget(isSymbolCell(cell) ? cell : null);
    });

    onSymbolBodies('dragleave', (e) => {
        if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) setDropTarget(null);
    });

    document.addEventListener('dragend', () => setDropTarget(null));

    onSymbolBodies('drop', async (e) => {
        e.preventDefault();
        setDropTarget(null);
        let targetCell = e.target;
        while (targetCell && targetCell.tagName !== 'TD') {
            targetCell = targetCell.parentElement;
        }
        if (!isSymbolCell(targetCell)) return;

        const appJson = e.dataTransfer.getData('application/x-tactics-symbol');
        const textPlain = e.dataTransfer.getData('text/plain');
        const parsed = parseDroppedSymbol(textPlain, appJson);
        if (!parsed) return;

        let wrapper = targetCell.querySelector('.cell-content-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'cell-content-wrapper';
            targetCell.innerHTML = '';
            targetCell.appendChild(wrapper);
        }

        if (parsed.kind === 'path') {
            const img = document.createElement('img');
            img.src = parsed.path;
            wrapper.appendChild(img);
            return;
        }

        const template = templateById.get(parsed.templateId);
        if (!template) return;
        const payload = {
            kind: 'generic',
            templateId: parsed.templateId,
            values: parsed.values || {},
            displayName: parsed.displayName || template.name,
            customId: parsed.customId,
        };
        try {
            const el = await buildGenericSymbolElement(template, payload.values, payload);
            el.removeAttribute('draggable');
            wrapper.appendChild(el);
        } catch (err) {
            console.error(err);
            alert('Не вдалося вставити позначку.');
        }
    });

    onSymbolBodies('contextmenu', (e) => {
        let actionTaken = false;
        const gen = e.target.closest && e.target.closest('.symbol-generic');
        if (gen) {
            gen.remove();
            actionTaken = true;
        } else if (e.target.tagName === 'IMG') {
            e.target.remove();
            actionTaken = true;
        }
        const cell = e.target.closest('td');
        if (cell) {
            const borders = ['painted-top', 'painted-right', 'painted-bottom', 'painted-left'];
            if (borders.some((b) => cell.classList.contains(b))) {
                cell.classList.remove(...borders);
                actionTaken = true;
            }
        }
        if (actionTaken) e.preventDefault();
    });

    const makeCellEditable = (cell) => {
        const originalContent = cell.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalContent;
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();
        const saveContent = () => {
            cell.textContent = input.value;
            input.remove();
        };
        input.addEventListener('blur', saveContent);
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') saveContent();
            else if (ev.key === 'Escape') {
                cell.textContent = originalContent;
                input.remove();
            }
        });
    };

    /**
     * Last direct child that is an image or generic symbol (order in the cell).
     * @param {HTMLElement} wrapper
     * @returns {HTMLElement | null}
     */
    function getLastMediaElement(wrapper) {
        let last = null;
        for (const ch of wrapper.children) {
            if (ch.tagName === 'IMG' || ch.classList.contains('symbol-generic')) {
                last = ch;
            }
        }
        return last;
    }

    /**
     * New empty text block placed immediately after the last image/symbol (or at end if none).
     * @param {HTMLElement} wrapper
     * @returns {HTMLSpanElement}
     */
    function appendNewCellTextAfterLastMedia(wrapper) {
        const span = document.createElement('span');
        span.className = 'cell-text';
        span.textContent = '';
        const lastMedia = getLastMediaElement(wrapper);
        if (lastMedia) {
            lastMedia.insertAdjacentElement('afterend', span);
        } else {
            wrapper.appendChild(span);
        }
        return span;
    }

    /**
     * @param {HTMLElement} wrapper
     * @returns {object[]}
     */
    function serializeMixedSegments(wrapper) {
        const segments = [];
        for (const el of wrapper.children) {
            if (el.tagName === 'IMG') {
                try {
                    const url = new URL(el.src);
                    segments.push({ type: 'img', src: url.pathname.substring(1) });
                } catch {
                    segments.push({ type: 'img', src: el.getAttribute('src') });
                }
            } else if (el.classList.contains('symbol-generic')) {
                try {
                    segments.push(JSON.parse(el.getAttribute('data-symbol-json') || '{}'));
                } catch {
                    segments.push({ kind: 'generic', error: true });
                }
            } else if (el.classList.contains('cell-text')) {
                segments.push({ type: 'text', text: el.textContent });
            }
        }
        return segments;
    }

    /**
     * @param {HTMLElement} cell
     * @param {HTMLSpanElement} textSpan
     */
    function editCellCaption(cell, textSpan) {
        const wrapper = cell.querySelector('.cell-content-wrapper');
        if (!wrapper || !textSpan || !textSpan.classList.contains('cell-text')) return;
        if (cell.querySelector('.cell-text-input')) return;
        const span = textSpan;
        const original = span.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'cell-text-input';
        input.value = original;
        span.replaceWith(input);
        input.focus();
        const saveContent = () => {
            const next = document.createElement('span');
            next.className = 'cell-text';
            next.textContent = input.value;
            input.replaceWith(next);
        };
        input.addEventListener('blur', saveContent);
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') saveContent();
            else if (ev.key === 'Escape') {
                const next = document.createElement('span');
                next.className = 'cell-text';
                next.textContent = original;
                input.replaceWith(next);
            }
        });
    }

    onSymbolBodies('click', (e) => {
        const cell = e.target.closest('td');
        if (!isSymbolCell(cell)) return;

        if (isBrushActive) {
            const rect = cell.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const borderThreshold = 8;
            const distances = {
                top: y,
                bottom: rect.height - y,
                left: x,
                right: rect.width - x,
            };
            const closestEdge = Object.keys(distances).reduce((a, b) => (distances[a] < distances[b] ? a : b));
            if (distances[closestEdge] <= borderThreshold) {
                cell.classList.toggle(`painted-${closestEdge}`);
            }
            return;
        }

        const clickedText = e.target.closest('.cell-text');
        if (clickedText && cell.contains(clickedText)) {
            if (!cell.querySelector('input')) editCellCaption(cell, clickedText);
            return;
        }

        if (e.target.closest('.symbol-generic') || e.target.closest('td img')) {
            return;
        }

        const wrapper = cell.querySelector('.cell-content-wrapper');
        if (wrapper) {
            if (!cell.querySelector('input')) {
                const lastEl = wrapper.lastElementChild;
                if (lastEl && lastEl.classList.contains('cell-text')) {
                    editCellCaption(cell, lastEl);
                } else {
                    const span = appendNewCellTextAfterLastMedia(wrapper);
                    editCellCaption(cell, span);
                }
            }
            return;
        }

        if (!cell.querySelector('input')) makeCellEditable(cell);
    });

    addRowBtn.addEventListener('click', () => {
        insertEmptyRow(-1);
    });

    addColBtn.addEventListener('click', () => {
        const headerRow = table.querySelector('thead tr');
        const headerCells = headerRow.querySelectorAll('th');
        const lastHeader = headerCells[headerCells.length - 2];
        const newColNumber = parseInt(lastHeader.textContent, 10) + 1;
        const newHeader = document.createElement('th');
        newHeader.textContent = newColNumber;
        headerRow.insertBefore(newHeader, headerRow.lastElementChild);
        tableBody.querySelectorAll('tr').forEach((row) => {
            const newCell = row.insertCell(row.cells.length - 1);
            newCell.textContent = '-';
        });
        const namesRow = teamBody.querySelector('.team-names-row');
        const startRow = teamBody.querySelector('.team-start-row');
        insertMemberNameCell(namesRow, namesRow.cells.length - 1);
        startRow.insertCell(startRow.cells.length - 1).textContent = '-';
    });

    removeColBtn.addEventListener('click', () => {
        const headerRow = table.querySelector('thead tr');
        const headerCells = headerRow.querySelectorAll('th');
        if (headerCells.length <= 2) {
            alert('Не можна видалити останнього учасника.');
            return;
        }
        headerCells[headerCells.length - 2].remove();
        [...tableBody.rows, ...teamBody.rows].forEach((row) => {
            row.deleteCell(row.cells.length - 2);
        });
    });

    function collectVisualExportNodes() {
        return document.querySelectorAll(
            '#teamTable .cell-content-wrapper img, #teamTable .cell-content-wrapper .symbol-generic svg, ' +
                '#editableTable .cell-content-wrapper img, #editableTable .cell-content-wrapper .symbol-generic svg',
        );
    }

    function svgToDataUrl(svg) {
        const s = new XMLSerializer().serializeToString(svg);
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
    }

    /** Extra space added to the widest symbol row when sizing export columns. */
    const EXPORT_CELL_MARGIN = 24;
    /** Export columns are never narrower than this (keeps text-only columns readable). */
    const EXPORT_MIN_CELL_WIDTH = 120;

    /**
     * Width of the widest single line of symbols in any cell (images + generic symbols + gaps between them).
     * @returns {number} 0 when no cell holds a symbol
     */
    function measureWidestSymbolRow() {
        let widest = 0;
        symbolBodies.flatMap((body) => [...body.querySelectorAll('.cell-content-wrapper')]).forEach((wrapper) => {
            const media = [...wrapper.children].filter(
                (ch) => ch.tagName === 'IMG' || ch.classList.contains('symbol-generic'),
            );
            if (!media.length) return;
            const gap = parseFloat(getComputedStyle(wrapper).columnGap) || 0;
            const width = media.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0) + gap * (media.length - 1);
            widest = Math.max(widest, width);
        });
        return widest;
    }

    /**
     * For export: give every participant column the same width — the widest symbol row plus a margin.
     * @returns {() => void} restores the original column/table widths
     */
    function applyExportColumnWidths() {
        const widest = measureWidestSymbolRow();
        const headers = [...table.querySelectorAll('thead th')].slice(0, -1);
        // The team table has no header: its first row's cells define the column widths
        const teamHeaders = [...(teamBody.rows[0]?.cells || [])].slice(0, -1);
        if (!headers.length) return () => {};
        const sample = tableBody.querySelector('td');
        const cs = sample ? getComputedStyle(sample) : null;
        const chrome = cs
            ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth)
            : 0;
        const colWidth = Math.ceil(Math.max(EXPORT_MIN_CELL_WIDTH, widest + chrome + EXPORT_CELL_MARGIN));
        const allHeaders = [...headers, ...teamHeaders];
        const saved = {
            tables: [table.style.width, teamTable.style.width],
            headers: allHeaders.map((th) => th.style.width),
        };
        allHeaders.forEach((th) => {
            th.style.width = `${colWidth}px`;
        });
        table.style.width = `${colWidth * headers.length}px`;
        teamTable.style.width = `${colWidth * headers.length}px`;
        return () => {
            [table.style.width, teamTable.style.width] = saved.tables;
            allHeaders.forEach((th, i) => {
                th.style.width = saved.headers[i];
            });
        };
    }

    exportBtn.addEventListener('click', async () => {
        const elementsToHide = [sidebar, controls, helpBtn, addSymbolBtn, addRowBtn].filter(Boolean);
        const actionsColumnCells = document.querySelectorAll('#editableTable tr > :last-child, #teamTable tr > :last-child');
        const nameInputs = [...teamBody.querySelectorAll('.member-name-input')];
        const visuals = collectVisualExportNodes();
        const originalSrc = new Map();

        const toDataURL = async (img) => {
            const response = await fetch(img.src);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        };

        // Main column normally scrolls inside a 100vh layout; let it grow to full height so the whole table is captured
        const mainContent = document.getElementById('main-content');
        const savedScroll = { mainTop: mainContent.scrollTop, mainLeft: mainContent.scrollLeft, x: window.scrollX, y: window.scrollY };
        document.body.classList.add('exporting');
        elementsToHide.forEach((el) => el.classList.add('export-hidden'));
        actionsColumnCells.forEach((cell) => cell.classList.add('export-hidden'));
        // Inputs don't rasterize reliably (html2canvas would also draw the placeholder): show names as plain text
        const nameCopies = nameInputs.map((input) => {
            const span = document.createElement('span');
            span.className = 'member-name-export';
            span.textContent = input.value;
            input.before(span);
            input.classList.add('export-hidden');
            return span;
        });
        // Measure before SVGs are swapped for raster copies
        const restoreColumnWidths = applyExportColumnWidths();

        try {
            for (const el of visuals) {
                if (el.tagName === 'IMG') {
                    originalSrc.set(el, el.src);
                    const dataUrl = await toDataURL(el);
                    el.src = dataUrl;
                } else if (el.tagName === 'svg' || el.namespaceURI?.includes('svg')) {
                    const img = document.createElement('img');
                    img.width = el.getBoundingClientRect().width || 50;
                    img.height = el.getBoundingClientRect().height || 50;
                    img.src = svgToDataUrl(el);
                    img.className = 'export-svg-raster';
                    el.parentNode.insertBefore(img, el);
                    el.classList.add('export-hidden');
                    originalSrc.set(el, { mode: 'svg', img });
                }
            }

            window.scrollTo(0, 0);
            const canvas = await html2canvas(mainContent, {
                scrollX: 0,
                scrollY: 0,
                windowWidth: document.documentElement.scrollWidth,
                windowHeight: document.documentElement.scrollHeight,
            });
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = 'table-export.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error exporting table:', error);
            alert('Не вдалося експортувати таблицю.');
        } finally {
            visuals.forEach((el) => {
                if (el.tagName === 'IMG' && originalSrc.has(el)) {
                    el.src = originalSrc.get(el);
                } else if (originalSrc.has(el)) {
                    const rec = originalSrc.get(el);
                    if (rec && rec.mode === 'svg' && rec.img) {
                        rec.img.remove();
                        el.classList.remove('export-hidden');
                    }
                }
            });
            restoreColumnWidths();
            nameCopies.forEach((span) => span.remove());
            nameInputs.forEach((input) => input.classList.remove('export-hidden'));
            elementsToHide.forEach((el) => el.classList.remove('export-hidden'));
            actionsColumnCells.forEach((cell) => cell.classList.remove('export-hidden'));
            document.body.classList.remove('exporting');
            mainContent.scrollTop = savedScroll.mainTop;
            mainContent.scrollLeft = savedScroll.mainLeft;
            window.scrollTo(savedScroll.x, savedScroll.y);
        }
    });

    /** Saved-file format marker; files from before the team table are a bare array of rows. */
    const SAVE_FORMAT = 'tactics-table';
    const SAVE_VERSION = 3;

    /**
     * @param {HTMLTableCellElement} cell
     * @returns {object} `{ type: 'text', content }` or `{ type: 'mixed', segments }`, plus `paintedBorders`
     */
    function serializeCell(cell) {
        const paintedBorders = {
            top: cell.classList.contains('painted-top'),
            right: cell.classList.contains('painted-right'),
            bottom: cell.classList.contains('painted-bottom'),
            left: cell.classList.contains('painted-left'),
        };
        const wrapper = cell.querySelector('.cell-content-wrapper');
        if (wrapper) {
            const segments = serializeMixedSegments(wrapper);
            if (segments.length) return { type: 'mixed', segments, paintedBorders };
            return { type: 'text', content: '', paintedBorders };
        }
        return { type: 'text', content: cell.textContent, paintedBorders };
    }

    /** Serialize a row's participant cells (skips the trailing actions cell). */
    function serializeRowCells(row) {
        return [...row.cells].slice(0, -1).map(serializeCell);
    }

    saveBtn.addEventListener('click', () => {
        const namesRow = teamBody.querySelector('.team-names-row');
        const startRow = teamBody.querySelector('.team-start-row');
        const saveData = {
            format: SAVE_FORMAT,
            version: SAVE_VERSION,
            team: {
                names: [...namesRow.querySelectorAll('.member-name-input')].map((input) => input.value),
                start: serializeRowCells(startRow),
            },
            rows: [...tableBody.rows].map(serializeRowCells),
        };
        const jsonData = JSON.stringify(saveData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'table-data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    openBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                rebuildTable(data).catch((err) => {
                    console.error(err);
                    alert('Не вдалося відкрити таблицю: невідомий формат файлу.');
                });
            } catch (error) {
                console.error('Error parsing JSON file:', error);
                alert('Некоректний файл JSON.');
            }
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    /**
     * Generic symbol element for a saved segment, or null if its template is gone.
     * @param {object} seg
     */
    async function buildSavedGeneric(seg) {
        const template = templateById.get(seg.templateId);
        if (!template) return null;
        const payload = {
            kind: 'generic',
            templateId: seg.templateId,
            values: seg.values || {},
            displayName: seg.displayName || template.name,
            customId: seg.customId,
        };
        try {
            const el = await buildGenericSymbolElement(template, payload.values, payload);
            el.removeAttribute('draggable');
            return el;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    /**
     * Render saved cell data into an empty cell. Accepts `text`, `mixed` and legacy `images` cells.
     * @param {HTMLTableCellElement} newCell
     * @param {object} cellData
     */
    async function fillCell(newCell, cellData) {
        if (cellData.type === 'mixed' && Array.isArray(cellData.segments)) {
            const wrapper = document.createElement('div');
            wrapper.className = 'cell-content-wrapper';
            for (const seg of cellData.segments) {
                if (seg.type === 'text') {
                    const s = document.createElement('span');
                    s.className = 'cell-text';
                    s.textContent = seg.text != null ? seg.text : '';
                    wrapper.appendChild(s);
                } else if (seg.type === 'img' && seg.src) {
                    const img = document.createElement('img');
                    img.src = seg.src;
                    wrapper.appendChild(img);
                } else if (seg && seg.kind === 'generic' && seg.templateId) {
                    const el = await buildSavedGeneric(seg);
                    if (el) wrapper.appendChild(el);
                }
            }
            newCell.appendChild(wrapper);
        } else if (cellData.type === 'images') {
            const wrapper = document.createElement('div');
            wrapper.className = 'cell-content-wrapper';
            for (const item of cellData.content) {
                if (typeof item === 'string') {
                    const img = document.createElement('img');
                    img.src = item;
                    wrapper.appendChild(img);
                } else if (item && item.kind === 'generic' && item.templateId) {
                    const el = await buildSavedGeneric(item);
                    if (el) wrapper.appendChild(el);
                }
            }
            const cap = document.createElement('span');
            cap.className = 'cell-text';
            cap.textContent = cellData.caption != null ? cellData.caption : '';
            wrapper.appendChild(cap);
            newCell.appendChild(wrapper);
        } else {
            newCell.textContent = cellData.content;
        }
        if (cellData.paintedBorders) {
            if (cellData.paintedBorders.top) newCell.classList.add('painted-top');
            if (cellData.paintedBorders.right) newCell.classList.add('painted-right');
            if (cellData.paintedBorders.bottom) newCell.classList.add('painted-bottom');
            if (cellData.paintedBorders.left) newCell.classList.add('painted-left');
        }
    }

    /**
     * Accepts the current object format and the older bare array of rows (no team table).
     * @returns {{ rows: object[][], team: { names?: string[], start?: object[] } }}
     */
    function normalizeSaveData(data) {
        if (Array.isArray(data)) return { rows: data, team: {} };
        if (data && typeof data === 'object' && Array.isArray(data.rows)) {
            return { rows: data.rows, team: data.team && typeof data.team === 'object' ? data.team : {} };
        }
        throw new Error('Unrecognized table file');
    }

    const rebuildTable = async (data) => {
        const { rows, team } = normalizeSaveData(data);
        const columnCount =
            (rows[0] && rows[0].length) ||
            (Array.isArray(team.names) && team.names.length) ||
            (Array.isArray(team.start) && team.start.length) ||
            getColumnCount();

        const tableHead = table.querySelector('thead');
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        const headerRow = tableHead.insertRow();
        for (let i = 0; i < columnCount; i++) {
            const newHeader = document.createElement('th');
            newHeader.textContent = i + 1;
            headerRow.appendChild(newHeader);
        }
        const actionsHeader = document.createElement('th');
        actionsHeader.textContent = 'Дія';
        headerRow.appendChild(actionsHeader);

        for (const rowData of rows) {
            const newRow = tableBody.insertRow();
            for (const cellData of rowData) {
                await fillCell(newRow.insertCell(), cellData);
            }
            addRemoveButton(newRow);
        }
        await buildTeamTable(columnCount, team);
    };
});
