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
            if (!confirm('Видалити цю власну позначку зі списку?')) return;
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
            t.setAttribute('font-family', 'system-ui, Segoe UI, sans-serif');
            t.setAttribute('font-size', String(st.fontSize || 16));
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

    function appendSidebarFrame(frame) {
        const img = document.createElement('img');
        img.src = frame.path;
        img.draggable = true;
        img.title = frame.name || '';
        img.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', frame.path);
            e.dataTransfer.setData('application/x-tactics-symbol', '');
        });
        sidebarSymbols.appendChild(img);
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
        manifest.frames.forEach((frame) => appendSidebarFrame(frame));
        const customs = loadCustomSymbols();
        for (const c of customs) {
            await appendSidebarCustom(c);
        }
    }

    promiseJson.then((raw) => {
        manifest = normalizeManifest(raw);
        manifest.genericTemplates.forEach((t) => templateById.set(t.id, t));
        fillSidebar();
        if (addSymbolTemplate) {
            addSymbolTemplate.innerHTML = '<option value="" disabled selected>Оберіть шаблон</option>';
            manifest.genericTemplates.forEach((t) => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.name || t.id;
                addSymbolTemplate.appendChild(opt);
            });
        }
    });

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
        if (addSymbolTemplate) addSymbolTemplate.selectedIndex = 0;
        if (addSymbolFields) addSymbolFields.innerHTML = '';
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
        addSymbolTemplate?.addEventListener('change', () => {
            renderAddSymbolFields(addSymbolTemplate.value);
        });
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
                alert('Оберіть шаблон.');
                return;
            }
            const template = templateById.get(templateId);
            if (!template) return;
            const values = {};
            addSymbolFields?.querySelectorAll('[data-add-up-id]').forEach((input) => {
                const id = input.dataset.addUpId;
                if (!id) return;
                if (input.type === 'checkbox') {
                    values[id] = input.checked ? '1' : '';
                } else {
                    values[id] = input.value || '';
                }
            });
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
    });

    const addRemoveButton = (row) => {
        const newCell = row.insertCell();
        const removeBtn = document.createElement('button');
        newCell.className = 'buttonRow';
        removeBtn.textContent = 'Видалити часову стадію';
        removeBtn.addEventListener('click', () => {
            row.remove();
        });
        newCell.appendChild(removeBtn);
    };

    const tableBody = table.querySelector('tbody');
    if (!tableBody) {
        console.error('Table body not found!');
        return;
    }

    tableBody.querySelectorAll('tr').forEach(addRemoveButton);

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

    tableBody.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    tableBody.addEventListener('drop', async (e) => {
        e.preventDefault();
        let targetCell = e.target;
        while (targetCell && targetCell.tagName !== 'TD') {
            targetCell = targetCell.parentElement;
        }
        if (!targetCell || targetCell.tagName !== 'TD') return;

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

    tableBody.addEventListener('contextmenu', (e) => {
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

    tableBody.addEventListener('click', (e) => {
        const cell = e.target.closest('td');
        if (!cell || cell.classList.contains('buttonRow')) return;

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
        const newRow = tableBody.insertRow();
        const columnCount = table.querySelector('thead tr').childElementCount - 1;
        for (let i = 0; i < columnCount; i++) {
            const newCell = newRow.insertCell();
            newCell.textContent = '-';
        }
        addRemoveButton(newRow);
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
    });

    removeColBtn.addEventListener('click', () => {
        const headerRow = table.querySelector('thead tr');
        const headerCells = headerRow.querySelectorAll('th');
        if (headerCells.length <= 2) {
            alert('Cannot remove the last column.');
            return;
        }
        headerCells[headerCells.length - 2].remove();
        tableBody.querySelectorAll('tr').forEach((row) => {
            row.deleteCell(row.cells.length - 2);
        });
    });

    function collectVisualExportNodes() {
        return tableBody.querySelectorAll('.cell-content-wrapper img, .cell-content-wrapper .symbol-generic svg');
    }

    function svgToDataUrl(svg) {
        const s = new XMLSerializer().serializeToString(svg);
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
    }

    exportBtn.addEventListener('click', async () => {
        const elementsToHide = [sidebar, controls, helpBtn, addSymbolBtn].filter(Boolean);
        const actionsColumnCells = table.querySelectorAll('tr > :last-child');
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

        elementsToHide.forEach((el) => el.classList.add('export-hidden'));
        actionsColumnCells.forEach((cell) => cell.classList.add('export-hidden'));

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

            const canvas = await html2canvas(document.getElementById('main-content'));
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = 'table-export.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error exporting table:', error);
            alert('Sorry, there was an error exporting the table.');
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
            elementsToHide.forEach((el) => el.classList.remove('export-hidden'));
            actionsColumnCells.forEach((cell) => cell.classList.remove('export-hidden'));
        }
    });

    saveBtn.addEventListener('click', () => {
        const tableData = [];
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach((row) => {
            const rowData = [];
            const cells = row.querySelectorAll('td');
            for (let i = 0; i < cells.length - 1; i++) {
                const cell = cells[i];
                const paintedBorders = {
                    top: cell.classList.contains('painted-top'),
                    right: cell.classList.contains('painted-right'),
                    bottom: cell.classList.contains('painted-bottom'),
                    left: cell.classList.contains('painted-left'),
                };
                const wrapper = cell.querySelector('.cell-content-wrapper');
                if (wrapper) {
                    const segments = serializeMixedSegments(wrapper);
                    if (segments.length) {
                        rowData.push({ type: 'mixed', segments, paintedBorders });
                    } else {
                        rowData.push({ type: 'text', content: '', paintedBorders });
                    }
                } else {
                    rowData.push({ type: 'text', content: cell.textContent, paintedBorders });
                }
            }
            tableData.push(rowData);
        });
        const jsonData = JSON.stringify(tableData, null, 2);
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
                rebuildTable(data).catch((err) => console.error(err));
            } catch (error) {
                console.error('Error parsing JSON file:', error);
                alert('Invalid JSON file.');
            }
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    const rebuildTable = async (data) => {
        const tableHead = table.querySelector('thead');
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';
        if (data.length === 0) return;

        const headerRow = tableHead.insertRow();
        const columnCount = data[0].length;
        for (let i = 0; i < columnCount; i++) {
            const newHeader = document.createElement('th');
            newHeader.textContent = i + 1;
            headerRow.appendChild(newHeader);
        }
        const actionsHeader = document.createElement('th');
        actionsHeader.textContent = 'Дія';
        headerRow.appendChild(actionsHeader);

        for (const rowData of data) {
            const newRow = tableBody.insertRow();
            for (const cellData of rowData) {
                const newCell = newRow.insertCell();
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
                            const template = templateById.get(seg.templateId);
                            if (template) {
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
                                    wrapper.appendChild(el);
                                } catch (err) {
                                    console.error(err);
                                }
                            }
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
                            const template = templateById.get(item.templateId);
                            if (template) {
                                const payload = {
                                    kind: 'generic',
                                    templateId: item.templateId,
                                    values: item.values || {},
                                    displayName: item.displayName || template.name,
                                    customId: item.customId,
                                };
                                try {
                                    const el = await buildGenericSymbolElement(template, payload.values, payload);
                                    el.removeAttribute('draggable');
                                    wrapper.appendChild(el);
                                } catch (err) {
                                    console.error(err);
                                }
                            }
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
            addRemoveButton(newRow);
        }
    };
});
