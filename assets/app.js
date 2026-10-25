(function () {
  'use strict';

  const flowData = window.OSINT_FLOW_DATA;
  const toolData = window.OSINT_TOOL_DATA;
  if (!flowData || !toolData) throw new Error('OSINT data files did not load. Serve the repository root with a static web server.');

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const flowMap = new Map(flowData.flows.map(x => [x.id, x]));
  const toolMap = new Map(toolData.tools.map(x => [x.id, x]));
  const defaultFlow = '00-MASTER-01-DECISION-ENGINE';
  const storageKey = 'osintTT.investigation.v2';
  let flowZoom = 1;
  let lightZoom = 1;
  let lastFlow = '';
  let searchCursor = -1;
  let toastTimer;
  const sessionPaths = new Map();

  function freshState() {
    const id = `session-${Date.now().toString(36)}`;
    return { active: id, sessions: { [id]: { label: 'Challenge 1', checks: {} } } };
  }
  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey));
      if (parsed && parsed.sessions && parsed.active && parsed.sessions[parsed.active]) return parsed;
    } catch (_) { /* local storage may be disabled */ }
    return freshState();
  }
  let state = loadState();
  function saveState() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (_) { showToast('Browser ปิด localStorage — progress จะไม่อยู่หลัง refresh'); }
  }
  function session() { return state.sessions[state.active]; }
  function currentPath() { return sessionPaths.get(state.active) || 'photo.jpg'; }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
  }
  function posixQuote(value) {
    const path = String(value || 'photo.jpg');
    return `'${path.replace(/'/g, `'"'"'`)}'`;
  }
  function commandFrom(template) { return template.replaceAll('{{file}}', posixQuote(currentPath())); }
  function hashState() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    return Object.fromEntries(params.entries());
  }
  function navigate(changes, replace = false) {
    const next = { ...hashState(), ...changes, session: state.active };
    Object.keys(next).forEach(k => (next[k] === null || next[k] === undefined || next[k] === '') && delete next[k]);
    if (!next.flow) next.flow = defaultFlow;
    const value = `#${new URLSearchParams(next).toString()}`;
    if (replace) history.replaceState(null, '', value); else location.hash = value;
    if (replace) renderFromHash();
  }
  function showToast(message) {
    const node = $('#toast');
    node.textContent = message; node.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 2200);
  }

  function populateSessions() {
    const options = Object.entries(state.sessions).map(([id, s]) => `<option value="${esc(id)}" ${id === state.active ? 'selected' : ''}>${esc(s.label)}</option>`).join('');
    $('#sessionSelect').innerHTML = options;
    $('#mobileSessionSelect').innerHTML = options;
  }
  function createSession() {
    const label = prompt('ชื่อ investigation session ใหม่', `Challenge ${Object.keys(state.sessions).length + 1}`);
    if (!label) return;
    const id = `session-${Date.now().toString(36)}`;
    state.sessions[id] = { label: label.trim().slice(0, 60), checks: {} };
    state.active = id; saveState(); populateSessions(); navigate({ session: id }, true); showToast('สร้าง session ใหม่แล้ว');
  }
  function resetAllProgress() {
    if (!confirm('ลบ checklist และ session ทั้งหมดใน browser นี้? การกระทำนี้ย้อนกลับไม่ได้')) return;
    localStorage.removeItem(storageKey); state = freshState(); saveState(); populateSessions(); navigate({ session: state.active, tool: null, task: null }, true); showToast('ล้าง progress ทั้งหมดแล้ว');
  }

  function buildFlowNav() {
    const current = hashState().flow || defaultFlow;
    $('#flowCount').textContent = `${flowData.flows.length} charts`;
    $('#flowNav').innerHTML = flowData.categories.map(([category, label]) => {
      const flows = flowData.flows.filter(x => x.category === category);
      const open = flows.some(x => x.id === current) ? 'open' : '';
      return `<details class="flow-group" data-category="${category}" ${open}><summary>${esc(label)} · ${flows.length}</summary><div class="flow-list">${flows.map(flow => `<button class="flow-link ${flow.id === current ? 'active' : ''}" data-flow="${flow.id}">${esc(flow.title)}</button>`).join('')}</div></details>`;
    }).join('');
    $$('.flow-link').forEach(button => button.addEventListener('click', () => {
      navigate({ flow: button.dataset.flow, tool: null, task: null }); closeDrawers();
    }));
  }

  function renderFlow(flow) {
    $('#flowCategory').textContent = flow.categoryLabel;
    $('#flowTitle').textContent = flow.title;
    $('#breadcrumbs').textContent = `OSINT T_T / ${flow.category} / ${flow.id}`;
    $('#flowImage').src = flow.svg;
    $('#flowImage').alt = `${flow.title} OSINT decision flowchart`;
    $('#downloadSvg').href = flow.svg;
    $('#downloadSvg').download = `${flow.id}.svg`;
    $('#downloadPng').href = flow.png;
    $('#downloadPng').download = `${flow.id}.png`;
    $('#contextToolLinks').innerHTML = flow.tools.map(x => `<button class="tool-chip" data-tool="${x.tool}" data-task="${x.task}">${esc(x.label)}</button>`).join('');
    $$('.tool-chip').forEach(button => button.addEventListener('click', () => {
      navigate({ tool: button.dataset.tool, task: button.dataset.task });
      if (matchMedia('(max-width:1050px)').matches) openDrawer('tool');
    }));
    if (flow.id !== lastFlow) { flowZoom = 1; updateFlowZoom(); lastFlow = flow.id; }
    $$('.flow-link').forEach(b => b.classList.toggle('active', b.dataset.flow === flow.id));
    const group = $(`.flow-group[data-category="${flow.category}"]`); if (group) group.open = true;
  }

  function recipeKey(toolId, recipeId, index) { return `${toolId}.${recipeId}.${index}`; }
  function recipeProgress(toolId, recipe) {
    const total = recipe.checklist.length;
    const done = recipe.checklist.filter((_, i) => session().checks[recipeKey(toolId, recipe.id, i)]).length;
    return { done, total, percent: total ? Math.round(done / total * 100) : 0 };
  }
  function actionAttrs(action) { return esc(JSON.stringify(action || {})); }
  function commandCard(template) {
    return `<div class="command-card"><pre><code data-command-template="${esc(template)}">${esc(commandFrom(template))}</code></pre><button class="copy-btn" data-copy>Copy</button></div>`;
  }
  function recipeHTML(tool, recipe, selected) {
    const progress = recipeProgress(tool.id, recipe);
    const decisions = [['yes', 'YES', recipe.decision.yes], ['no', 'NO', recipe.decision.no], ['uncertain', 'UNCERTAIN', recipe.decision.uncertain]].filter(x => x[2]);
    return `<details class="recipe" data-recipe="${recipe.id}" ${selected ? 'open' : ''}>
      <summary><span class="recipe-title">${esc(recipe.title)}</span><span class="recipe-progress" data-progress-label="${tool.id}.${recipe.id}">${progress.done}/${progress.total}</span></summary>
      <div class="recipe-body">
        <div class="section-label">What am I trying to find?</div><p>${esc(recipe.goal)}</p>
        <div class="section-label">Question keywords</div><div class="keyword-list">${recipe.keywords.map(k => `<span class="keyword">${esc(k)}</span>`).join('')}</div>
        <div class="section-label">Exact command</div>${recipe.commands.map(commandCard).join('')}
        <div class="section-label">Expected output</div><p class="expected">${esc(recipe.expected)}</p>
        <div class="section-label">Interpretation</div><p class="interpret">${esc(recipe.interpretation)}</p>
        <div class="section-label checklist-head"><span>Checklist · ไม่ใช่หลักฐานว่าคำตอบถูก</span><button class="reset-current" data-reset-recipe="${recipe.id}">Reset current</button></div>
        <div class="progress-track"><div class="progress-bar" data-progress-bar="${tool.id}.${recipe.id}" style="width:${progress.percent}%"></div></div>
        <div class="checklist">${recipe.checklist.map((item, i) => `<label class="check-item"><input type="checkbox" data-check="${recipeKey(tool.id, recipe.id, i)}" ${session().checks[recipeKey(tool.id, recipe.id, i)] ? 'checked' : ''}><span>${esc(item)}</span></label>`).join('')}</div>
        <div class="decision"><strong>${esc(recipe.decision.question)}</strong><div class="decision-actions">${decisions.map(([kind, label, action]) => `<button class="decision-btn ${kind}" data-action="${actionAttrs(action)}"><b>${label}</b> · ${esc(action.text)}</button>`).join('')}</div></div>
        <div class="section-label">Related flowcharts</div><div class="relation-links">${recipe.relatedFlows.map(id => `<button data-flow-link="${id}">${esc(id)}</button>`).join('')}</div>
      </div>
    </details>`;
  }

  function renderTool(tool, taskId) {
    const selected = tool.recipes.find(x => x.id === taskId) || tool.recipes[0];
    $('#toolEmpty').hidden = true; $('#toolContent').hidden = false;
    $('#toolContent').innerHTML = `<div class="tool-content-head"><button class="back-flow" data-back-flow>← Back to flowchart</button><div class="tool-head-row"><div><p class="eyebrow">TOOL LIBRARY</p><h2>${esc(tool.name)}</h2></div><a href="${esc(tool.homepage)}" target="_blank" rel="noopener noreferrer" title="External official documentation">Official docs ↗</a></div><p class="tool-purpose">${esc(tool.purpose)}</p></div>
      <div class="tool-meta"><div class="meta-row"><strong>Categories:</strong> ${esc(tool.categories.join(' · '))}</div><div class="meta-row"><strong>Formats:</strong> ${esc(tool.formats.join(', '))}</div><div class="meta-row"><strong>License:</strong> ${esc(tool.license)}</div><div class="install-grid"><div class="mini-command"><span>macOS</span><code>${esc(tool.install.mac)}</code></div><div class="mini-command"><span>Kali / Ubuntu</span><code>${esc(tool.install.linux)}</code></div></div><div class="meta-row"><strong>Common errors:</strong> ${esc(tool.errors.join(' · '))}</div><div class="meta-row"><strong>Open-source alternatives / pivots:</strong> ${esc(tool.alternatives.join(', '))}</div></div>
      <div class="path-control"><label for="pathInput">Local filename / path <span>memory only · cleared on refresh</span></label><input id="pathInput" value="${esc(currentPath())}" spellcheck="false" autocomplete="off"><p class="path-help">ระบบ quote path แบบ POSIX single-argument รวมถึงช่องว่างและ apostrophe แต่จะไม่ execute command และไม่บันทึก path ลง localStorage</p></div>
      <div class="recipe-list">${tool.recipes.map(recipe => recipeHTML(tool, recipe, recipe.id === selected.id)).join('')}</div>
      <div class="tool-relations"><div class="section-label">Related tools</div><div class="relation-links">${[...new Set(tool.recipes.flatMap(r => r.relatedTools))].filter(toolMap.has.bind(toolMap)).map(id => `<button data-tool-link="${id}">${esc(toolMap.get(id).name)}</button>`).join('')}</div></div>`;
    bindToolEvents(tool);
    requestAnimationFrame(() => {
      const node = $(`.recipe[data-recipe="${CSS.escape(selected.id)}"]`);
      if (node) node.scrollIntoView({ block: 'start' });
    });
  }

  function bindToolEvents(tool) {
    $('[data-back-flow]').addEventListener('click', () => { navigate({ tool: null, task: null }); closeDrawers(); });
    $('#pathInput').addEventListener('input', event => {
      sessionPaths.set(state.active, event.target.value || 'photo.jpg');
      $$('[data-command-template]').forEach(code => { code.textContent = commandFrom(code.dataset.commandTemplate); });
    });
    $$('[data-copy]').forEach(button => button.addEventListener('click', async () => {
      const text = button.parentElement.querySelector('code').textContent;
      try { await navigator.clipboard.writeText(text); }
      catch (_) { const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); }
      button.textContent = 'Copied'; setTimeout(() => { button.textContent = 'Copy'; }, 1200); showToast('คัดลอกคำสั่งแล้ว — นำไปรันใน Terminal ของคุณ');
    }));
    $$('[data-check]').forEach(box => box.addEventListener('change', () => {
      session().checks[box.dataset.check] = box.checked; saveState();
      const [, recipeId] = box.dataset.check.split('.'); updateRecipeProgress(tool.id, recipeId);
    }));
    $$('[data-reset-recipe]').forEach(button => button.addEventListener('click', () => {
      const recipe = tool.recipes.find(x => x.id === button.dataset.resetRecipe);
      recipe.checklist.forEach((_, i) => delete session().checks[recipeKey(tool.id, recipe.id, i)]);
      saveState(); renderTool(tool, recipe.id); showToast('Reset checklist นี้แล้ว');
    }));
    $$('[data-action]').forEach(button => button.addEventListener('click', () => performAction(JSON.parse(button.dataset.action), tool.id)));
    $$('[data-flow-link]').forEach(button => button.addEventListener('click', () => navigate({ flow: button.dataset.flowLink })));
    $$('[data-tool-link]').forEach(button => button.addEventListener('click', () => navigate({ tool: button.dataset.toolLink, task: toolMap.get(button.dataset.toolLink).recipes[0].id })));
  }
  function updateRecipeProgress(toolId, recipeId) {
    const tool = toolMap.get(toolId), recipe = tool.recipes.find(x => x.id === recipeId), p = recipeProgress(toolId, recipe);
    const label = $(`[data-progress-label="${toolId}.${recipeId}"]`), bar = $(`[data-progress-bar="${toolId}.${recipeId}"]`);
    if (label) label.textContent = `${p.done}/${p.total}`; if (bar) bar.style.width = `${p.percent}%`;
  }
  function performAction(action, currentTool) {
    const changes = {};
    if (action.flow) changes.flow = action.flow;
    if (action.tool) { changes.tool = action.tool; changes.task = action.task || toolMap.get(action.tool)?.recipes[0]?.id; }
    else if (action.task) { changes.tool = currentTool; changes.task = action.task; }
    navigate(changes);
    if (action.flow && matchMedia('(max-width:1050px)').matches) closeDrawers();
  }

  function renderFromHash() {
    const hash = hashState();
    if (hash.session && state.sessions[hash.session]) { state.active = hash.session; saveState(); populateSessions(); }
    const flow = flowMap.get(hash.flow) || flowMap.get(defaultFlow);
    buildFlowNav(); renderFlow(flow);
    if (hash.tool && toolMap.has(hash.tool)) renderTool(toolMap.get(hash.tool), hash.task);
    else { $('#toolEmpty').hidden = false; $('#toolContent').hidden = true; }
  }

  function searchIndex() {
    const flows = flowData.flows.map(flow => ({ type: 'flow', title: flow.title, subtitle: `${flow.categoryLabel} · ${flow.id}`, flow: flow.id, haystack: `${flow.title} ${flow.id} ${flow.categoryLabel} ${flow.tools.map(x => x.label).join(' ')}`.toLowerCase() }));
    const recipes = toolData.tools.flatMap(tool => tool.recipes.map(recipe => ({ type: 'tool', title: `${tool.name} · ${recipe.title}`, subtitle: recipe.goal, tool: tool.id, task: recipe.id, haystack: `${tool.name} ${tool.purpose} ${tool.categories.join(' ')} ${tool.formats.join(' ')} ${tool.license} ${tool.install.mac} ${tool.install.linux} ${tool.errors.join(' ')} ${recipe.title} ${recipe.goal} ${recipe.keywords.join(' ')} ${recipe.expected} ${recipe.commands.join(' ')}`.toLowerCase() })));
    return { flows, recipes };
  }
  const index = searchIndex();
  function renderSearch(query) {
    const q = query.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    const match = item => !tokens.length || tokens.every(t => item.haystack.includes(t));
    const tools = index.recipes.filter(match).slice(0, 8), flows = index.flows.filter(match).slice(0, 6);
    const result = $('#searchResults'); searchCursor = -1;
    if (!tools.length && !flows.length) result.innerHTML = '<div class="search-empty">ไม่พบผลลัพธ์ ลองคำสั้นลง เช่น GPS, PDF, timestamp</div>';
    else result.innerHTML = `${tools.length ? '<div class="search-section">TOOL RECIPES</div>' + tools.map(x => `<button class="search-result" data-search-tool="${x.tool}" data-search-task="${x.task}"><strong>${esc(x.title)}</strong><span>${esc(x.subtitle)}</span></button>`).join('') : ''}${flows.length ? '<div class="search-section">FLOWCHARTS</div>' + flows.map(x => `<button class="search-result" data-search-flow="${x.flow}"><strong>${esc(x.title)}</strong><span>${esc(x.subtitle)}</span></button>`).join('') : ''}`;
    result.hidden = false;
    $$('[data-search-tool]').forEach(b => b.addEventListener('click', () => { navigate({ tool: b.dataset.searchTool, task: b.dataset.searchTask }); closeSearch(); if (matchMedia('(max-width:1050px)').matches) openDrawer('tool'); }));
    $$('[data-search-flow]').forEach(b => b.addEventListener('click', () => { navigate({ flow: b.dataset.searchFlow, tool: null, task: null }); closeSearch(); }));
  }
  function closeSearch() { $('#searchResults').hidden = true; searchCursor = -1; }
  function moveSearchCursor(delta) {
    const results = $$('.search-result'); if (!results.length) return;
    searchCursor = (searchCursor + delta + results.length) % results.length;
    results.forEach((x, i) => x.classList.toggle('active', i === searchCursor)); results[searchCursor].scrollIntoView({ block: 'nearest' });
  }

  function updateFlowZoom() {
    $('#flowImage').style.width = `${Math.round(900 * flowZoom)}px`;
    $('#zoomReset').textContent = `${Math.round(flowZoom * 100)}%`;
  }
  function openLightbox() {
    const flow = flowMap.get(hashState().flow) || flowMap.get(defaultFlow);
    $('#lightboxTitle').textContent = flow.title; $('#lightboxImage').src = flow.svg; $('#lightboxImage').alt = `${flow.title} enlarged flowchart`;
    lightZoom = 1; updateLightZoom(); $('#lightbox').hidden = false; document.body.dataset.modal = 'true'; $('#closeLightbox').focus();
  }
  function closeLightbox() { $('#lightbox').hidden = true; delete document.body.dataset.modal; $('#diagramButton').focus(); }
  function updateLightZoom() { $('#lightboxImage').style.width = `${Math.round(lightZoom * 100)}%`; $('#lightZoomReset').textContent = lightZoom === 1 ? 'Fit' : `${Math.round(lightZoom * 100)}%`; }

  function openDrawer(which) {
    closeDrawers(); const node = which === 'nav' ? $('#leftSidebar') : $('#toolPanel'); node.classList.add('open'); $('#drawerBackdrop').hidden = false;
    $(`#${which === 'nav' ? 'navToggle' : 'toolToggle'}`).setAttribute('aria-expanded', 'true');
  }
  function closeDrawers() { $('#leftSidebar').classList.remove('open'); $('#toolPanel').classList.remove('open'); $('#drawerBackdrop').hidden = true; $('#navToggle').setAttribute('aria-expanded', 'false'); $('#toolToggle').setAttribute('aria-expanded', 'false'); }

  function bindGlobalEvents() {
    const changeSession = e => { state.active = e.target.value; saveState(); populateSessions(); navigate({ session: state.active }, true); };
    $('#sessionSelect').addEventListener('change', changeSession); $('#mobileSessionSelect').addEventListener('change', changeSession);
    $('#newSession').addEventListener('click', createSession); $('#mobileNewSession').addEventListener('click', createSession);
    $('#resetAll').addEventListener('click', resetAllProgress); $('#mobileResetAll').addEventListener('click', resetAllProgress);
    $('#browseTools').addEventListener('click', () => navigate({ tool: 'exiftool', task: 'all' }));
    $('#globalSearch').addEventListener('focus', e => renderSearch(e.target.value));
    $('#globalSearch').addEventListener('input', e => renderSearch(e.target.value));
    $('#globalSearch').addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); moveSearchCursor(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); moveSearchCursor(-1); } else if (e.key === 'Enter' && searchCursor >= 0) { e.preventDefault(); $$('.search-result')[searchCursor].click(); } else if (e.key === 'Escape') closeSearch(); });
    document.addEventListener('click', e => { if (!e.target.closest('.global-search-wrap')) closeSearch(); });
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#globalSearch').focus(); }
      if (e.key === 'Escape') { if (!$('#lightbox').hidden) closeLightbox(); else { closeSearch(); closeDrawers(); } }
    });
    $('#zoomIn').addEventListener('click', () => { flowZoom = Math.min(2.5, flowZoom + .2); updateFlowZoom(); });
    $('#zoomOut').addEventListener('click', () => { flowZoom = Math.max(.6, flowZoom - .2); updateFlowZoom(); });
    $('#zoomReset').addEventListener('click', () => { flowZoom = 1; updateFlowZoom(); $('#diagramViewport').scrollTo(0, 0); });
    $('#diagramButton').addEventListener('click', openLightbox); $('#expandFlow').addEventListener('click', openLightbox); $('#closeLightbox').addEventListener('click', closeLightbox);
    $('#lightZoomIn').addEventListener('click', () => { lightZoom = Math.min(4, lightZoom + .25); updateLightZoom(); });
    $('#lightZoomOut').addEventListener('click', () => { lightZoom = Math.max(.5, lightZoom - .25); updateLightZoom(); });
    $('#lightZoomReset').addEventListener('click', () => { lightZoom = 1; updateLightZoom(); $('#lightboxViewport').scrollTo(0, 0); });
    $('#navToggle').addEventListener('click', () => $('#leftSidebar').classList.contains('open') ? closeDrawers() : openDrawer('nav'));
    $('#toolToggle').addEventListener('click', () => $('#toolPanel').classList.contains('open') ? closeDrawers() : openDrawer('tool'));
    $('#drawerBackdrop').addEventListener('click', closeDrawers);
    addEventListener('hashchange', renderFromHash);
  }

  populateSessions(); bindGlobalEvents();
  if (!location.hash) navigate({ flow: defaultFlow }, true); else renderFromHash();
}());
