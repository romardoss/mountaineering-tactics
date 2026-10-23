/**
 * Standalone editor for genericTemplates in image.json.
 * Preview matches static/script.js buildGenericSymbolElement overlay rules.
 */
(function () {
    const IMAGE_JSON = '/images/image.json';
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const MAX_ADD_UPS = 3;
    const SAMPLE_SESSION_KEY = 'tactics_generic_editor_sample_values_v1';

    /** @type {{ genericTemplates: object[], frames: object[] }} */
    let manifest = { genericTemplates: [], frames: [] };
    let selectedIndex = 0;
    const templateSvgCache = new Map();

    /** @type {Record<string, Record<string, string>>} template id -> add-up id -> value (checkbox: letter or "") */
    let sampleValuesByTemplateId = {};

    /** Last committed template id (for migrating session when renaming id in the form). */
    let lastSampleTemplateId = null;

    function loadSampleSession() {
        try {
            const raw = sessionStorage.getItem(SAMPLE_SESSION_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    function saveSampleSession() {
        try {
            sessionStorage.setItem(SAMPLE_SESSION_KEY, JSON.stringify(sampleValuesByTemplateId));
        } catch {
            /* ignore quota / private mode */
        }
    }

    /** Normalize sampleValues into storable strings. */
    function snapshotSampleValues(values) {
        const out = {};
        Object.entries(values).forEach(([k, v]) => {
            if (v === true) out[k] = '1';
            else if (v === false) out[k] = '';
            else out[k] = v != null ? String(v) : '';
        });
        return out;
    }

    function commitSampleValuesToStorage(templateId) {
        if (!templateId) return;
        sampleValuesByTemplateId[templateId] = snapshotSampleValues(sampleValues);
        saveSampleSession();
    }

    function migrateSampleSessionOnTemplateIdChange(oldId, newId) {
        if (!oldId || !newId || oldId === newId) return;
        if (!sampleValuesByTemplateId[oldId]) return;
        sampleValuesByTemplateId[newId] = sampleValuesByTemplateId[oldId];
        delete sampleValuesByTemplateId[oldId];
        saveSampleSession();
    }

    /**
     * @param {object} template
     * @returns {Record<string, string|boolean>}
     */
    function sampleValuesFromStorageForTemplate(template) {
        const stored = sampleValuesByTemplateId[template.id] || {};
        const out = {};
        (template.addUps || []).forEach((au) => {
            const id = au.id || 'field';
            if (au.control === 'checkbox') {
                const letter = au.checkedText != null ? String(au.checkedText) : 'с';
                const s = stored[id];
                out[id] = s === letter || s === '1' || s === 'true' ? letter : '';
            } else {
                out[id] = stored[id] !== undefined ? stored[id] : au.placeholder || '';
            }
        });
        return out;
    }

    const banner = document.getElementById('banner');
    const templateList = document.getElementById('templateList');
    const fieldId = document.getElementById('fieldId');
    const fieldName = document.getElementById('fieldName');
    const fieldSvg = document.getElementById('fieldSvg');
    const addUpsRoot = document.getElementById('addUpsRoot');
    const sampleFields = document.getElementById('sampleFields');
    const previewBox = document.getElementById('previewBox');
    const previewPlaceholder = document.getElementById('previewPlaceholder');

    function showBanner(message, isError) {
        if (!banner) return;
        banner.textContent = message;
        banner.classList.toggle('error', !!isError);
        banner.hidden = false;
    }

    function normalizeManifest(raw) {
        if (Array.isArray(raw)) {
            return { frames: raw, genericTemplates: [] };
        }
        return {
            frames: raw.frames || [],
            genericTemplates: raw.genericTemplates || [],
        };
    }

    async function getTemplateSvgString(svgPath) {
        if (templateSvgCache.has(svgPath)) {
            return templateSvgCache.get(svgPath);
        }
        const url = svgPath.startsWith('/') ? svgPath : `/${svgPath.replace(/^\//, '')}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Не вдалося завантажити SVG: ${url}`);
        const text = await res.text();
        templateSvgCache.set(svgPath, text);
        return text;
    }

    /**
     * @param {object} template
     * @param {Record<string, string|boolean>} values
     * @returns {Promise<SVGSVGElement>}
     */
    async function buildPreviewSvg(template, values) {
        const svgText = await getTemplateSvgString(template.svg);
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const srcSvg = doc.documentElement;
        if (srcSvg.querySelector('parsererror')) {
            throw new Error('Некоректний SVG');
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

        return svg;
    }

    function getSelectedTemplate() {
        const list = manifest.genericTemplates;
        if (!list.length) return null;
        const i = Math.min(Math.max(0, selectedIndex), list.length - 1);
        return list[i];
    }

    function syncFormFromTemplate() {
        const t = getSelectedTemplate();
        if (!t) {
            fieldId.value = '';
            fieldName.value = '';
            fieldSvg.value = '';
            addUpsRoot.innerHTML = '';
            return;
        }
        fieldId.value = t.id || '';
        fieldName.value = t.name || '';
        fieldSvg.value = t.svg || '';
        renderAddUpsEditor(t);
    }

    function renderAddUpsEditor(template) {
        addUpsRoot.innerHTML = '';
        const addUps = template.addUps || [];
        addUps.forEach((au, idx) => {
            const block = document.createElement('div');
            block.className = 'addup-block';
            block.dataset.index = String(idx);
            const st = au.svgText || { x: 0, y: 0, fontSize: 16, textAnchor: 'middle' };
            block.innerHTML = `
                <h3>Add-up ${idx + 1}</h3>
                <label class="row"><span>id</span><input type="text" data-field="id" value="${escapeAttr(au.id || '')}" autocomplete="off"></label>
                <label class="row"><span>label</span><input type="text" data-field="label" value="${escapeAttr(au.label || '')}" autocomplete="off"></label>
                <label class="row"><span>placeholder</span><input type="text" data-field="placeholder" value="${escapeAttr(au.placeholder || '')}" autocomplete="off"></label>
                <label class="row inline"><span>control</span>
                    <select data-field="control">
                        <option value="">текст</option>
                        <option value="checkbox"${au.control === 'checkbox' ? ' selected' : ''}>checkbox</option>
                    </select>
                </label>
                <label class="row"><span>checkedText (для checkbox)</span><input type="text" data-field="checkedText" value="${escapeAttr(au.checkedText != null ? String(au.checkedText) : '')}" placeholder="с" autocomplete="off"></label>
                <p class="hint" style="margin:0 0 8px;">Позиція тексту (svgText)</p>
                <div class="grid2">
                    <label class="row"><span>x</span><input type="number" data-st="x" step="any" value="${num(st.x)}"></label>
                    <label class="row"><span>y</span><input type="number" data-st="y" step="any" value="${num(st.y)}"></label>
                    <label class="row"><span>fontSize</span><input type="number" data-st="fontSize" step="any" value="${num(st.fontSize)}"></label>
                    <label class="row"><span>textAnchor</span>
                        <select data-st="textAnchor">
                            <option value="">(за замовч.)</option>
                            <option value="start"${st.textAnchor === 'start' ? ' selected' : ''}>start</option>
                            <option value="middle"${st.textAnchor === 'middle' ? ' selected' : ''}>middle</option>
                            <option value="end"${st.textAnchor === 'end' ? ' selected' : ''}>end</option>
                        </select>
                    </label>
                </div>
            `;
            addUpsRoot.appendChild(block);
            block.querySelectorAll('[data-field]').forEach((el) => {
                el.addEventListener('input', onAddUpFieldChange);
                el.addEventListener('change', onAddUpFieldChange);
            });
            block.querySelectorAll('[data-st]').forEach((el) => {
                el.addEventListener('input', onAddUpFieldChange);
                el.addEventListener('change', onAddUpFieldChange);
            });
        });
    }

    function escapeAttr(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function num(v) {
        if (v == null || v === '') return '';
        const n = Number(v);
        return Number.isFinite(n) ? String(n) : '';
    }

    function onAddUpFieldChange() {
        const t = getSelectedTemplate();
        if (!t) return;
        const prevIds = (t.addUps || []).map((au) => au.id || 'field');
        commitSampleValuesToStorage(t.id);
        const prevSamples = { ...sampleValues };
        readAddUpsFromDom(t);
        const store = { ...(sampleValuesByTemplateId[t.id] || {}) };
        (t.addUps || []).forEach((au, i) => {
            const nid = au.id || 'field';
            if (store[nid] === undefined && prevIds[i] !== undefined && prevSamples[prevIds[i]] !== undefined) {
                const pv = prevSamples[prevIds[i]];
                store[nid] = typeof pv === 'string' ? pv : pv ? '1' : '';
            }
        });
        sampleValuesByTemplateId[t.id] = store;
        saveSampleSession();
        renderSampleFields(t);
        schedulePreview();
    }

    function readAddUpsFromDom(template) {
        const blocks = addUpsRoot.querySelectorAll('.addup-block');
        const addUps = [];
        blocks.forEach((block) => {
            const idx = Number(block.dataset.index);
            const prev = (template.addUps || [])[idx] || {};
            const au = { ...prev };
            block.querySelectorAll('[data-field]').forEach((el) => {
                const key = el.getAttribute('data-field');
                if (key === 'control') {
                    au.control = el.value === 'checkbox' ? 'checkbox' : undefined;
                    if (!au.control) delete au.control;
                } else if (key === 'checkedText') {
                    const v = el.value.trim();
                    if (v) au.checkedText = v;
                    else delete au.checkedText;
                } else {
                    au[key] = el.value;
                }
            });
            const st = { ...(prev.svgText || {}) };
            block.querySelectorAll('[data-st]').forEach((el) => {
                const key = el.getAttribute('data-st');
                if (key === 'textAnchor') {
                    if (el.value) st.textAnchor = el.value;
                    else delete st.textAnchor;
                } else {
                    const n = parseFloat(el.value);
                    st[key] = Number.isFinite(n) ? n : 0;
                }
            });
            au.svgText = st;
            addUps.push(au);
        });
        template.addUps = addUps;
    }

    /** @type {Record<string, string|boolean>} */
    let sampleValues = {};

    let sampleCommitTimer = null;
    function scheduleCommitSamplesToStorage() {
        const t = getSelectedTemplate();
        if (!t) return;
        if (sampleCommitTimer) clearTimeout(sampleCommitTimer);
        sampleCommitTimer = setTimeout(() => {
            sampleCommitTimer = null;
            commitSampleValuesToStorage(t.id);
        }, 200);
    }

    function renderSampleFields(template) {
        sampleFields.innerHTML = '';
        sampleValues = sampleValuesFromStorageForTemplate(template);
        (template.addUps || []).forEach((au) => {
            const id = au.id || 'field';
            const row = document.createElement('div');
            row.className = 'sample-row';
            if (au.control === 'checkbox') {
                const letter = au.checkedText != null ? String(au.checkedText) : 'с';
                const on =
                    sampleValues[id] === letter ||
                    sampleValues[id] === '1' ||
                    sampleValues[id] === 'true';
                sampleValues[id] = on ? letter : '';
                row.innerHTML = `
                    <label><input type="checkbox" data-sample-id="${escapeAttr(id)}"${on ? ' checked' : ''}> ${escapeHtml(au.label || id)} (${letter})</label>
                `;
                const cb = row.querySelector('input[type="checkbox"]');
                cb.addEventListener('change', () => {
                    sampleValues[id] = cb.checked ? letter : '';
                    scheduleCommitSamplesToStorage();
                    schedulePreview();
                });
            } else {
                const val = sampleValues[id] != null ? String(sampleValues[id]) : '';
                row.innerHTML = `
                    <label>${escapeHtml(au.label || id)}</label>
                    <input type="text" data-sample-id="${escapeAttr(id)}" value="${escapeAttr(val)}" autocomplete="off">
                `;
                const inp = row.querySelector('input[type="text"]');
                inp.addEventListener('input', () => {
                    sampleValues[id] = inp.value;
                    scheduleCommitSamplesToStorage();
                    schedulePreview();
                });
            }
            sampleFields.appendChild(row);
        });
    }

    function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    let previewTimer = null;
    function schedulePreview() {
        if (previewTimer) clearTimeout(previewTimer);
        previewTimer = setTimeout(() => {
            previewTimer = null;
            runPreview();
        }, 120);
    }

    async function runPreview() {
        const t = getSelectedTemplate();
        if (!t || !t.svg) {
            if (previewPlaceholder) {
                previewPlaceholder.hidden = false;
                previewPlaceholder.textContent = 'Немає шаблону';
            }
            previewBox.querySelectorAll('svg').forEach((n) => n.remove());
            return;
        }
        readAddUpsFromDom(t);
        if (previewPlaceholder) previewPlaceholder.hidden = true;
        previewBox.querySelectorAll('svg').forEach((n) => n.remove());
        try {
            const svg = await buildPreviewSvg(t, sampleValues);
            previewBox.appendChild(svg);
        } catch (e) {
            if (previewPlaceholder) {
                previewPlaceholder.hidden = false;
                previewPlaceholder.textContent = e.message || String(e);
            }
            console.error(e);
        }
    }

    function populateTemplateList() {
        templateList.innerHTML = '';
        manifest.genericTemplates.forEach((t, i) => {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = `${t.name || t.id || `template_${i}`} (${t.id || '?'})`;
            templateList.appendChild(opt);
        });
        templateList.selectedIndex = Math.min(selectedIndex, Math.max(0, manifest.genericTemplates.length - 1));
    }

    function applyFieldInputsToTemplate() {
        const t = getSelectedTemplate();
        if (!t) return;
        t.id = fieldId.value.trim() || t.id;
        t.name = fieldName.value.trim();
        t.svg = fieldSvg.value.trim();
        readAddUpsFromDom(t);
    }

    function init() {
        fetch(IMAGE_JSON)
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((raw) => {
                sampleValuesByTemplateId = loadSampleSession();
                manifest = normalizeManifest(raw);
                if (!manifest.genericTemplates.length) {
                    manifest.genericTemplates.push({
                        id: 'new_template',
                        name: 'Новий шаблон',
                        svg: 'images/generic/generic_rope.svg',
                        addUps: [],
                    });
                }
                selectedIndex = 0;
                populateTemplateList();
                syncFormFromTemplate();
                const t = getSelectedTemplate();
                lastSampleTemplateId = t?.id ?? null;
                if (t) renderSampleFields(t);
                runPreview();
            })
            .catch((e) => {
                showBanner(
                    'Не вдалося завантажити image.json. Запустіть з кореня репо: npm start (або npm run generic) і відкрийте /tools/generic-template-editor/ (порт може бути не 8000).',
                    true
                );
                if (previewPlaceholder) {
                    previewPlaceholder.hidden = false;
                    previewPlaceholder.textContent = 'Помилка завантаження';
                }
                console.error(e);
            });

        templateList.addEventListener('change', () => {
            const prev = getSelectedTemplate();
            if (prev) commitSampleValuesToStorage(prev.id);
            selectedIndex = Number(templateList.value) || 0;
            const t = getSelectedTemplate();
            lastSampleTemplateId = t?.id ?? null;
            syncFormFromTemplate();
            if (t) renderSampleFields(t);
            runPreview();
        });

        [fieldId, fieldName, fieldSvg].forEach((el) => {
            el.addEventListener('input', () => {
                const oldId = lastSampleTemplateId;
                applyFieldInputsToTemplate();
                const t = getSelectedTemplate();
                if (el === fieldId && oldId && t && t.id !== oldId) {
                    migrateSampleSessionOnTemplateIdChange(oldId, t.id);
                }
                lastSampleTemplateId = t?.id ?? null;
                populateTemplateList();
                schedulePreview();
            });
        });

        document.getElementById('btnNew').addEventListener('click', () => {
            const prev = getSelectedTemplate();
            if (prev) commitSampleValuesToStorage(prev.id);
            manifest.genericTemplates.push({
                id: `template_${Date.now()}`,
                name: 'Новий шаблон',
                svg: 'images/generic/generic_rope.svg',
                addUps: [],
            });
            selectedIndex = manifest.genericTemplates.length - 1;
            templateSvgCache.clear();
            populateTemplateList();
            syncFormFromTemplate();
            const t = getSelectedTemplate();
            lastSampleTemplateId = t?.id ?? null;
            if (t) renderSampleFields(t);
            runPreview();
        });

        document.getElementById('btnDelete').addEventListener('click', () => {
            if (manifest.genericTemplates.length <= 1) {
                showBanner('Залиште хоча б один шаблон.', true);
                return;
            }
            if (!confirm('Видалити цей шаблон?')) return;
            const doomed = getSelectedTemplate();
            if (doomed) {
                commitSampleValuesToStorage(doomed.id);
                delete sampleValuesByTemplateId[doomed.id];
                saveSampleSession();
            }
            manifest.genericTemplates.splice(selectedIndex, 1);
            selectedIndex = Math.min(selectedIndex, manifest.genericTemplates.length - 1);
            templateSvgCache.clear();
            populateTemplateList();
            syncFormFromTemplate();
            const t = getSelectedTemplate();
            lastSampleTemplateId = t?.id ?? null;
            if (t) renderSampleFields(t);
            runPreview();
        });

        document.getElementById('btnAddUp').addEventListener('click', () => {
            const t = getSelectedTemplate();
            if (!t) return;
            commitSampleValuesToStorage(t.id);
            applyFieldInputsToTemplate();
            if ((t.addUps || []).length >= MAX_ADD_UPS) {
                showBanner(`Максимум ${MAX_ADD_UPS} add-ups.`, true);
                return;
            }
            if (!t.addUps) t.addUps = [];
            t.addUps.push({
                id: `field_${t.addUps.length + 1}`,
                label: 'Поле',
                placeholder: '',
                svgText: { x: 200, y: 100, fontSize: 16, textAnchor: 'middle' },
            });
            renderAddUpsEditor(t);
            renderSampleFields(t);
            schedulePreview();
        });

        document.getElementById('btnRemoveUp').addEventListener('click', () => {
            const t = getSelectedTemplate();
            if (!t || !(t.addUps || []).length) return;
            commitSampleValuesToStorage(t.id);
            applyFieldInputsToTemplate();
            t.addUps.pop();
            renderAddUpsEditor(t);
            renderSampleFields(t);
            schedulePreview();
        });

        document.getElementById('btnDownload').addEventListener('click', () => {
            const t = getSelectedTemplate();
            if (t) commitSampleValuesToStorage(t.id);
            applyFieldInputsToTemplate();
            const body = JSON.stringify(manifest, null, 2) + '\n';
            const blob = new Blob([body], { type: 'application/json;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'image.json';
            a.click();
            URL.revokeObjectURL(a.href);
        });
    }

    init();
})();
