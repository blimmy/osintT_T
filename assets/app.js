(function () {
  'use strict';

  const flowData = window.OSINT_FLOW_DATA;
  const toolData = window.OSINT_TOOL_DATA;
  const challenges = window.OSINT_CHALLENGES || [];
  if (!flowData || !toolData) throw new Error('Data files did not load. Serve the repository root with a static web server.');

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const flowMap = new Map(flowData.flows.map(x => [x.id, x]));
  const toolMap = new Map(toolData.tools.map(x => [x.id, x]));
  const defaultFlow = '00-MASTER-01-DECISION-ENGINE';
  const storageKey = 'osintTT.investigation.v2';
  const CHEATSHEET = 'https://docs.google.com/document/d/1hOVwwnS4tmyR0zHeR4cTShBcFx2EQA-lS-fnt1hjmiI/edit?usp=sharing';
  const sessionPaths = new Map();
  let flowZoom = 1;
  let lightZoom = 1;
  let lastFlow = '';
  let searchCursor = -1;
  let toastTimer;
  let suppressImageClickUntil = 0;

  function freshState() {
    const id = `session-${Date.now().toString(36)}`;
    return { active: id, sessions: { [id]: { label: 'Challenge 1', checks: {} } } };
  }
  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey));
      if (parsed && parsed.sessions && parsed.active && parsed.sessions[parsed.active]) return parsed;
    } catch (_) { /* localStorage may be disabled */ }
    return freshState();
  }
  let state = loadState();
  function saveState() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch (_) { showToast('Browser ปิด localStorage — progress จะไม่อยู่หลัง refresh'); }
  }
  function session() { return state.sessions[state.active]; }
  function currentPath() { return sessionPaths.get(state.active) || 'photo.jpg'; }
  function esc(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]); }
  function posixQuote(value) { return `'${String(value || 'photo.jpg').replace(/'/g, `'"'"'`)}'`; }
  function commandFrom(template) { return template.replaceAll('{{file}}', posixQuote(currentPath())); }
  function hashState() { return Object.fromEntries(new URLSearchParams(location.hash.replace(/^#/, '')).entries()); }
  function resolvedView(hash = hashState()) { return hash.view || (hash.flow ? 'flow' : hash.tool ? 'tools' : 'gallery'); }
  function navigate(changes, replace = false) {
    const next = { ...hashState(), ...changes, session: state.active };
    Object.keys(next).forEach(key => (next[key] === null || next[key] === undefined || next[key] === '') && delete next[key]);
    if (next.view === 'flow' && !next.flow) next.flow = defaultFlow;
    const value = `#${new URLSearchParams(next).toString()}`;
    if (replace) { history.replaceState(null, '', value); renderFromHash(); }
    else location.hash = value;
  }
  function showToast(message) {
    const node = $('#toast');
    node.textContent = message; node.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 2300);
  }

  function populateSessions() {
    $('#sessionSelect').innerHTML = Object.entries(state.sessions).map(([id, item]) => `<option value="${esc(id)}" ${id === state.active ? 'selected' : ''}>${esc(item.label)}</option>`).join('');
  }
  function createSession() {
    const label = prompt('ชื่อ investigation session ใหม่', `Challenge ${Object.keys(state.sessions).length + 1}`);
    if (!label) return;
    const id = `session-${Date.now().toString(36)}`;
    state.sessions[id] = { label: label.trim().slice(0, 60), checks: {} };
    state.active = id; saveState(); populateSessions(); navigate({ session: id }, true); showToast('สร้าง session ใหม่แล้ว');
  }
  function resetAllProgress() {
    if (!confirm('ลบ checklist และ session ทั้งหมดใน browser นี้?')) return;
    localStorage.removeItem(storageKey); state = freshState(); saveState(); populateSessions(); navigate({ session: state.active, tool: null, task: null }, true); showToast('ล้าง progress ทั้งหมดแล้ว');
  }

  function renderGalleryFilters() {
    const categories = [...new Set(challenges.map(x => x.category))].sort();
    const evidence = [...new Set(challenges.map(x => x.evidence))].sort();
    $('#categoryFilter').innerHTML = '<option value="">ทั้งหมด</option>' + categories.map(x => `<option>${esc(x)}</option>`).join('');
    $('#evidenceFilter').innerHTML = '<option value="">ทุกชนิด</option>' + evidence.map(x => `<option>${esc(x)}</option>`).join('');
  }
  function renderGallery() {
    const category = $('#categoryFilter').value;
    const evidence = $('#evidenceFilter').value;
    const filtered = challenges.filter(x => (!category || x.category === category) && (!evidence || x.evidence === evidence));
    $('#challengeCount').textContent = challenges.length;
    $('#galleryFlowCount').textContent = flowData.flows.length;
    $('#galleryToolCount').textContent = toolData.tools.length;
    $('#galleryStatus').textContent = `แสดง ${filtered.length} จาก ${challenges.length} เส้นทาง`;
    $('#challengeGrid').innerHTML = filtered.length ? filtered.map(item => `<button class="challenge-card" style="--accent:${esc(item.accent)}" data-challenge="${esc(item.id)}" aria-label="${esc(item.title)}: ${esc(item.question)} — เปิด flowchart">
      <span class="challenge-cover"><img src="${esc(item.cover)}" alt="Synthetic ${esc(item.title)} challenge example" loading="lazy"></span>
      <span class="challenge-body"><span class="challenge-meta"><span class="challenge-category">${esc(item.category)}</span><span class="challenge-evidence">${esc(item.evidence)}</span></span><h3>${esc(item.title)}</h3><p class="challenge-question">${esc(item.question)}</p><span class="challenge-tags">${item.tags.slice(0, 4).map(tag => `<span>${esc(tag)}</span>`).join('')}</span><span class="challenge-open"><span>OPEN INTERACTIVE FLOW</span><span>→</span></span></span>
    </button>`).join('') : '<div class="no-results">ไม่พบการ์ดที่ตรงตัวกรอง ลองล้างตัวกรองหรือค้นด้วยคำสั้นลง</div>';
    $$('[data-challenge]').forEach(button => button.addEventListener('click', () => {
      const item = challenges.find(x => x.id === button.dataset.challenge);
      navigate({ view: 'flow', flow: item.flow, tool: null, task: null });
    }));
  }

  function buildFlowNav(current) {
    $('#flowCount').textContent = `${flowData.flows.length} charts`;
    $('#flowNav').innerHTML = flowData.categories.map(([category, label]) => {
      const flows = flowData.flows.filter(x => x.category === category);
      return `<details class="flow-group" data-category="${esc(category)}" ${flows.some(x => x.id === current) ? 'open' : ''}><summary>${esc(label)} · ${flows.length}</summary><div class="flow-list">${flows.map(flow => `<button class="flow-link ${flow.id === current ? 'active' : ''}" data-flow="${esc(flow.id)}">${esc(flow.title)}</button>`).join('')}</div></details>`;
    }).join('');
    $$('.flow-link').forEach(button => button.addEventListener('click', () => { navigate({ view: 'flow', flow: button.dataset.flow, tool: null, task: null }); closeFlowNav(); }));
  }
  function renderFlow(flow) {
    buildFlowNav(flow.id);
    $('#flowCategory').textContent = flow.categoryLabel;
    $('#flowTitle').textContent = flow.title;
    $('#breadcrumbs').textContent = `CTF T_T / ${flow.categoryLabel} / ${flow.id}`;
    $('#flowImage').src = flow.svg;
    $('#flowImage').alt = `${flow.title} branching CTF decision flowchart`;
    $('#downloadSvg').href = flow.svg; $('#downloadSvg').download = `${flow.id}.svg`;
    $('#downloadPng').href = flow.png; $('#downloadPng').download = `${flow.id}.png`;
    $('#nodeDock').innerHTML = `<span class="eyebrow">CLICKABLE TOOL NODES</span>${flow.tools.map(x => `<button class="tool-chip" data-tool="${esc(x.tool)}" data-task="${esc(x.task)}">${esc(x.label)}</button>`).join('')}`;
    $$('.tool-chip').forEach(button => button.addEventListener('click', () => navigate({ view: 'flow', tool: button.dataset.tool, task: button.dataset.task })));
    const peers = flowData.flows.filter(x => x.category === flow.category);
    const index = peers.findIndex(x => x.id === flow.id);
    const related = [peers[index - 1], peers[index + 1]].filter(Boolean);
    $('#relatedFlows').innerHTML = related.map((item, i) => `<button data-related-flow="${esc(item.id)}">${i === 0 && index > 0 ? '← ' : ''}${esc(item.title)}${i === related.length - 1 && index < peers.length - 1 ? ' →' : ''}</button>`).join('');
    $$('[data-related-flow]').forEach(button => button.addEventListener('click', () => navigate({ view: 'flow', flow: button.dataset.relatedFlow, tool: null, task: null })));
    if (flow.id !== lastFlow) { lastFlow = flow.id; $('#flowImage').addEventListener('load', fitFlow, { once: true }); }
  }

  function recipeKey(toolId, recipeId, index) { return `${toolId}.${recipeId}.${index}`; }
  function recipeProgress(toolId, recipe) {
    const total = recipe.checklist.length;
    const done = recipe.checklist.filter((_, i) => session().checks[recipeKey(toolId, recipe.id, i)]).length;
    return { done, total, percent: total ? Math.round(done / total * 100) : 0 };
  }
  function actionAttrs(action) { return esc(JSON.stringify(action || {})); }
  function commandCard(template) { return `<div class="command-card"><pre><code data-command-template="${esc(template)}">${esc(commandFrom(template))}</code></pre><button class="copy-btn" data-copy>Copy</button></div>`; }
  function recipeHTML(tool, recipe, selected) {
    const progress = recipeProgress(tool.id, recipe);
    const decisions = [['yes','YES',recipe.decision.yes],['no','NO',recipe.decision.no],['uncertain','UNCERTAIN',recipe.decision.uncertain]].filter(x => x[2]);
    return `<details class="recipe" data-recipe="${esc(recipe.id)}" ${selected ? 'open' : ''}><summary><span class="recipe-title">${esc(recipe.title)}</span><span class="recipe-progress" data-progress-label="${tool.id}.${recipe.id}">${progress.done}/${progress.total}</span></summary><div class="recipe-body">
      <div class="section-label">What am I trying to find?</div><p>${esc(recipe.goal)}</p>
      <div class="section-label">Question keywords</div><div class="keyword-list">${recipe.keywords.map(x => `<span class="keyword">${esc(x)}</span>`).join('')}</div>
      <div class="section-label">Exact command</div>${recipe.commands.map(commandCard).join('')}
      <div class="section-label">Expected output</div><p class="expected">${esc(recipe.expected)}</p>
      <div class="section-label">Interpretation</div><p class="interpret">${esc(recipe.interpretation)}</p>
      <div class="section-label checklist-head"><span>Checklist · ไม่ใช่หลักฐานว่าคำตอบถูก</span><button class="reset-current" data-reset-recipe="${esc(recipe.id)}">Reset current</button></div>
      <div class="progress-track"><div class="progress-bar" data-progress-bar="${tool.id}.${recipe.id}" style="width:${progress.percent}%"></div></div>
      <div class="checklist">${recipe.checklist.map((item, i) => `<label class="check-item"><input type="checkbox" data-check="${recipeKey(tool.id, recipe.id, i)}" ${session().checks[recipeKey(tool.id, recipe.id, i)] ? 'checked' : ''}><span>${esc(item)}</span></label>`).join('')}</div>
      <div class="decision"><strong>${esc(recipe.decision.question)}</strong><div class="decision-actions">${decisions.map(([kind,label,action]) => `<button class="decision-btn ${kind}" data-action="${actionAttrs(action)}"><b>${label}</b> · ${esc(action.text)}</button>`).join('')}</div></div>
      <div class="section-label">Related flowcharts</div><div class="relation-links">${recipe.relatedFlows.filter(flowMap.has.bind(flowMap)).map(id => `<button data-flow-link="${esc(id)}">${esc(id)}</button>`).join('')}</div>
    </div></details>`;
  }
  function renderTool(tool, taskId) {
    const selected = tool.recipes.find(x => x.id === taskId) || tool.recipes[0];
    $('#toolEmpty').hidden = true; $('#toolContent').hidden = false;
    $('#toolContent').innerHTML = `<div class="tool-content-head"><button class="back-flow" data-close-tool>← Close tool panel</button><div class="tool-head-row"><div><p class="eyebrow">TOOL PLAYBOOK</p><h2>${esc(tool.name)}</h2></div><div class="tool-head-actions"><a href="${esc(tool.homepage)}" target="_blank" rel="noopener noreferrer">Official docs ↗</a><a href="${CHEATSHEET}" target="_blank" rel="noopener noreferrer">CTF Cheatsheet ↗</a></div></div><p class="tool-purpose">${esc(tool.purpose)}</p></div>
      <div class="tool-meta"><div class="meta-row"><strong>Categories:</strong> ${esc(tool.categories.join(' · '))}</div><div class="meta-row"><strong>Formats:</strong> ${esc(tool.formats.join(', '))}</div><div class="meta-row"><strong>License:</strong> ${esc(tool.license)}</div><div class="install-grid"><div class="mini-command"><span>macOS</span><code>${esc(tool.install.mac)}</code></div><div class="mini-command"><span>Kali / Ubuntu</span><code>${esc(tool.install.linux)}</code></div></div><div class="meta-row"><strong>Common errors:</strong> ${esc(tool.errors.join(' · '))}</div><div class="meta-row"><strong>Alternatives / pivots:</strong> ${esc(tool.alternatives.join(', '))}</div></div>
      <div class="path-control"><label for="pathInput">Local filename / path <span>memory only</span></label><input id="pathInput" value="${esc(currentPath())}" spellcheck="false" autocomplete="off"><p class="path-help">POSIX single-argument quoting รองรับ space และ apostrophe เว็บไม่รันคำสั่งและไม่บันทึก path ลง localStorage</p></div>
      <div class="recipe-list">${tool.recipes.map(recipe => recipeHTML(tool, recipe, recipe.id === selected.id)).join('')}</div>
      <div class="tool-relations"><div class="section-label">Related tools</div><div class="relation-links">${[...new Set(tool.recipes.flatMap(r => r.relatedTools))].filter(toolMap.has.bind(toolMap)).map(id => `<button data-tool-link="${esc(id)}">${esc(toolMap.get(id).name)}</button>`).join('')}</div></div>`;
    bindToolEvents(tool);
    openToolPanel();
    requestAnimationFrame(() => $(`.recipe[data-recipe="${CSS.escape(selected.id)}"]`)?.scrollIntoView({ block: 'start' }));
  }
  function bindToolEvents(tool) {
    $('[data-close-tool]').addEventListener('click', closeToolPanelAndHash);
    $('#pathInput').addEventListener('input', event => {
      sessionPaths.set(state.active, event.target.value || 'photo.jpg');
      $$('[data-command-template]').forEach(code => { code.textContent = commandFrom(code.dataset.commandTemplate); });
    });
    $$('[data-copy]').forEach(button => button.addEventListener('click', async () => {
      const text = button.parentElement.querySelector('code').textContent;
      try { await navigator.clipboard.writeText(text); }
      catch (_) { const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); }
      button.textContent = 'Copied'; setTimeout(() => { button.textContent = 'Copy'; }, 1000); showToast('คัดลอกแล้ว — นำไปรันใน Terminal ของคุณ');
    }));
    $$('[data-check]').forEach(box => box.addEventListener('change', () => {
      session().checks[box.dataset.check] = box.checked; saveState();
      const recipeId = box.dataset.check.slice(tool.id.length + 1).replace(/\.\d+$/, ''); updateRecipeProgress(tool.id, recipeId);
    }));
    $$('[data-reset-recipe]').forEach(button => button.addEventListener('click', () => {
      const recipe = tool.recipes.find(x => x.id === button.dataset.resetRecipe);
      recipe.checklist.forEach((_, i) => delete session().checks[recipeKey(tool.id, recipe.id, i)]);
      saveState(); renderTool(tool, recipe.id); showToast('Reset checklist นี้แล้ว');
    }));
    $$('[data-action]').forEach(button => button.addEventListener('click', () => performAction(JSON.parse(button.dataset.action), tool.id)));
    $$('[data-flow-link]').forEach(button => button.addEventListener('click', () => navigate({ view: 'flow', flow: button.dataset.flowLink })));
    $$('[data-tool-link]').forEach(button => button.addEventListener('click', () => navigate({ tool: button.dataset.toolLink, task: toolMap.get(button.dataset.toolLink).recipes[0].id })));
  }
  function updateRecipeProgress(toolId, recipeId) {
    const tool = toolMap.get(toolId); const recipe = tool?.recipes.find(x => x.id === recipeId); if (!recipe) return;
    const p = recipeProgress(toolId, recipe);
    const label = $(`[data-progress-label="${toolId}.${recipeId}"]`); const bar = $(`[data-progress-bar="${toolId}.${recipeId}"]`);
    if (label) label.textContent = `${p.done}/${p.total}`; if (bar) bar.style.width = `${p.percent}%`;
  }
  function performAction(action, currentTool) {
    const changes = {};
    if (action.flow) { changes.view = 'flow'; changes.flow = action.flow; }
    if (action.tool) { changes.tool = action.tool; changes.task = action.task || toolMap.get(action.tool)?.recipes[0]?.id; }
    else if (action.task) { changes.tool = currentTool; changes.task = action.task; }
    navigate(changes);
  }
  function renderToolDirectory() {
    $('#toolDirectory').innerHTML = [...toolData.tools].sort((a,b) => a.name.localeCompare(b.name)).map(tool => `<button class="tool-card" data-directory-tool="${esc(tool.id)}"><h2>${esc(tool.name)}</h2><p>${esc(tool.purpose)}</p><span>${tool.recipes.length} TASK PLAYBOOK${tool.recipes.length === 1 ? '' : 'S'} →</span></button>`).join('');
    $$('[data-directory-tool]').forEach(button => button.addEventListener('click', () => { const tool = toolMap.get(button.dataset.directoryTool); navigate({ view: 'tools', tool: tool.id, task: tool.recipes[0].id }); }));
  }

  function searchIndex() {
    const challengeItems = challenges.map(item => ({ type:'challenge', title:item.title, subtitle:item.question, flow:item.flow, haystack:`${item.title} ${item.category} ${item.evidence} ${item.question} ${item.tags.join(' ')}`.toLowerCase() }));
    const flows = flowData.flows.map(flow => ({ type:'flow', title:flow.title, subtitle:`${flow.categoryLabel} · ${flow.id}`, flow:flow.id, haystack:`${flow.title} ${flow.id} ${flow.categoryLabel} ${flow.tools.map(x=>x.label).join(' ')}`.toLowerCase() }));
    const recipes = toolData.tools.flatMap(tool => tool.recipes.map(recipe => ({ type:'tool', title:`${tool.name} · ${recipe.title}`, subtitle:recipe.goal, tool:tool.id, task:recipe.id, haystack:`${tool.name} ${tool.purpose} ${tool.categories.join(' ')} ${tool.formats.join(' ')} ${recipe.title} ${recipe.goal} ${recipe.keywords.join(' ')} ${recipe.expected} ${recipe.commands.join(' ')}`.toLowerCase() })));
    return { challengeItems, flows, recipes };
  }
  const index = searchIndex();
  function renderSearch(query) {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const match = item => !tokens.length || tokens.every(token => item.haystack.includes(token));
    const challengeMatches = index.challengeItems.filter(match).slice(0,5);
    const recipeMatches = index.recipes.filter(match).slice(0,7);
    const flowMatches = index.flows.filter(match).slice(0,5);
    const result = $('#searchResults'); searchCursor = -1;
    const section = (title, list, render) => list.length ? `<div class="search-section">${title}</div>${list.map(render).join('')}` : '';
    result.innerHTML = section('CHALLENGE QUESTIONS', challengeMatches, x => `<button class="search-result" data-search-flow="${x.flow}"><strong>${esc(x.title)}</strong><span>${esc(x.subtitle)}</span></button>`) + section('TOOL RECIPES', recipeMatches, x => `<button class="search-result" data-search-tool="${x.tool}" data-search-task="${x.task}"><strong>${esc(x.title)}</strong><span>${esc(x.subtitle)}</span></button>`) + section('FLOWCHARTS', flowMatches, x => `<button class="search-result" data-search-flow="${x.flow}"><strong>${esc(x.title)}</strong><span>${esc(x.subtitle)}</span></button>`) || '<div class="search-empty">ไม่พบผลลัพธ์ ลองคำสั้นลง เช่น GPS, POST, RSA, EVTX</div>';
    result.hidden = false;
    $$('[data-search-tool]').forEach(button => button.addEventListener('click', () => { navigate({ tool:button.dataset.searchTool, task:button.dataset.searchTask }); closeSearch(); }));
    $$('[data-search-flow]').forEach(button => button.addEventListener('click', () => { navigate({ view:'flow', flow:button.dataset.searchFlow, tool:null, task:null }); closeSearch(); }));
  }
  function closeSearch() { $('#searchResults').hidden = true; searchCursor = -1; }
  function moveSearchCursor(delta) {
    const results = $$('.search-result'); if (!results.length) return;
    searchCursor = (searchCursor + delta + results.length) % results.length;
    results.forEach((item,i) => item.classList.toggle('active', i === searchCursor)); results[searchCursor].scrollIntoView({ block:'nearest' });
  }

  function updateFlowZoom() { $('#flowImage').style.width = `${Math.round(1800 * flowZoom)}px`; $('#zoomReset').textContent = `${Math.round(flowZoom * 100)}%`; }
  function fitFlow() {
    const viewport = $('#diagramViewport'); if (!viewport.clientWidth || !viewport.clientHeight) return;
    flowZoom = Math.min((viewport.clientWidth - 28) / 1800, (viewport.clientHeight - 28) / 2200, 1);
    flowZoom = Math.max(.25, flowZoom); updateFlowZoom(); viewport.scrollTo(0,0);
  }
  function updateLightZoom() { $('#lightboxImage').style.width = `${Math.round(1800 * lightZoom)}px`; $('#lightZoomReset').textContent = `${Math.round(lightZoom * 100)}%`; }
  function fitLightbox() {
    const viewport = $('#lightboxViewport');
    lightZoom = Math.max(.2, Math.min((viewport.clientWidth - 24) / 1800, (viewport.clientHeight - 24) / 2200, 1)); updateLightZoom(); viewport.scrollTo(0,0);
  }
  function openLightbox() {
    if (Date.now() < suppressImageClickUntil) return;
    const flow = flowMap.get(hashState().flow) || flowMap.get(defaultFlow);
    $('#lightboxTitle').textContent = flow.title; $('#lightboxImage').src = flow.svg; $('#lightboxImage').alt = `${flow.title} enlarged flowchart`;
    $('#lightbox').hidden = false; document.body.dataset.modal = 'true'; requestAnimationFrame(fitLightbox); $('#closeLightbox').focus();
  }
  function closeLightbox() { $('#lightbox').hidden = true; delete document.body.dataset.modal; if (document.fullscreenElement) document.exitFullscreen().catch(()=>{}); $('#expandFlow').focus(); }
  function bindPan(viewport) {
    let active = false, startX = 0, startY = 0, left = 0, top = 0, moved = false;
    viewport.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button,a,input,select')) return;
      active = true; moved = false; startX = event.clientX; startY = event.clientY; left = viewport.scrollLeft; top = viewport.scrollTop;
      viewport.setPointerCapture?.(event.pointerId); viewport.classList.add('dragging');
    });
    viewport.addEventListener('pointermove', event => { if (!active) return; const dx=event.clientX-startX,dy=event.clientY-startY; if (Math.abs(dx)+Math.abs(dy)>6) moved=true; viewport.scrollLeft=left-dx; viewport.scrollTop=top-dy; });
    const stop = () => { if (!active) return; active=false; viewport.classList.remove('dragging'); if (moved) suppressImageClickUntil=Date.now()+250; };
    viewport.addEventListener('pointerup', stop); viewport.addEventListener('pointercancel', stop);
  }

  function openFlowNav() { $('#leftSidebar').classList.add('open'); $('#flowBackdrop').hidden = false; $('#navToggle').setAttribute('aria-expanded','true'); }
  function closeFlowNav() { $('#leftSidebar').classList.remove('open'); $('#flowBackdrop').hidden = true; $('#navToggle').setAttribute('aria-expanded','false'); }
  function openToolPanel() { $('#toolPanel').classList.add('open'); $('#toolPanel').setAttribute('aria-hidden','false'); $('#toolBackdrop').hidden = false; }
  function closeToolPanel() { $('#toolPanel').classList.remove('open'); $('#toolPanel').setAttribute('aria-hidden','true'); $('#toolBackdrop').hidden = true; }
  function closeToolPanelAndHash() { closeToolPanel(); navigate({ tool:null, task:null }, true); }

  function renderFromHash() {
    const hash = hashState();
    if (hash.session && state.sessions[hash.session]) { state.active = hash.session; saveState(); populateSessions(); }
    const view = resolvedView(hash);
    $('#galleryView').hidden = view !== 'gallery'; $('#flowView').hidden = view !== 'flow'; $('#toolsView').hidden = view !== 'tools';
    $$('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === view));
    document.body.dataset.view = view;
    if (view === 'gallery') renderGallery();
    if (view === 'flow') renderFlow(flowMap.get(hash.flow) || flowMap.get(defaultFlow));
    if (view === 'tools') renderToolDirectory();
    if (hash.tool && toolMap.has(hash.tool)) renderTool(toolMap.get(hash.tool), hash.task);
    else closeToolPanel();
    $('#mobileMenu').hidden = true; $('#mobileMenuToggle').setAttribute('aria-expanded','false');
  }

  function bindGlobalEvents() {
    $('#categoryFilter').addEventListener('change', renderGallery); $('#evidenceFilter').addEventListener('change', renderGallery);
    $('#clearFilters').addEventListener('click', () => { $('#categoryFilter').value=''; $('#evidenceFilter').value=''; renderGallery(); });
    $('#backGallery').addEventListener('click', () => navigate({ view:'gallery', tool:null, task:null }));
    $('#navToggle').addEventListener('click', () => $('#leftSidebar').classList.contains('open') ? closeFlowNav() : openFlowNav());
    $('#flowBackdrop').addEventListener('click', closeFlowNav); $('#toolBackdrop').addEventListener('click', closeToolPanelAndHash);
    $('#flowImage').addEventListener('click', openLightbox); $('#expandFlow').addEventListener('click', openLightbox); $('#closeLightbox').addEventListener('click', closeLightbox);
    $('#zoomIn').addEventListener('click', () => { flowZoom=Math.min(2.5,flowZoom+.15);updateFlowZoom(); });
    $('#zoomOut').addEventListener('click', () => { flowZoom=Math.max(.2,flowZoom-.15);updateFlowZoom(); });
    $('#zoomReset').addEventListener('click', fitFlow);
    $('#lightZoomIn').addEventListener('click', () => { lightZoom=Math.min(4,lightZoom+.2);updateLightZoom(); });
    $('#lightZoomOut').addEventListener('click', () => { lightZoom=Math.max(.2,lightZoom-.2);updateLightZoom(); });
    $('#lightZoomReset').addEventListener('click', fitLightbox);
    $('#browserFullscreen').addEventListener('click', () => $('#lightbox').requestFullscreen?.());
    $('#mobileMenuToggle').addEventListener('click', () => { const menu=$('#mobileMenu');menu.hidden=!menu.hidden;$('#mobileMenuToggle').setAttribute('aria-expanded',String(!menu.hidden)); });
    const changeSession = event => { state.active=event.target.value;saveState();populateSessions();navigate({session:state.active},true); };
    $('#sessionSelect').addEventListener('change', changeSession); $('#newSession').addEventListener('click', createSession); $('#resetAll').addEventListener('click', resetAllProgress);
    $('#globalSearch').addEventListener('focus', event => renderSearch(event.target.value)); $('#globalSearch').addEventListener('input', event => renderSearch(event.target.value));
    $('#globalSearch').addEventListener('keydown', event => { if(event.key==='ArrowDown'){event.preventDefault();moveSearchCursor(1);}else if(event.key==='ArrowUp'){event.preventDefault();moveSearchCursor(-1);}else if(event.key==='Enter'&&searchCursor>=0){event.preventDefault();$$('.search-result')[searchCursor].click();}else if(event.key==='Escape')closeSearch(); });
    document.addEventListener('click', event => { if(!event.target.closest('.global-search-wrap'))closeSearch(); });
    document.addEventListener('keydown', event => {
      if(event.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){event.preventDefault();$('#globalSearch').focus();}
      if(event.key==='Escape'){if(!$('#lightbox').hidden)closeLightbox();else if($('#toolPanel').classList.contains('open'))closeToolPanelAndHash();else{closeSearch();closeFlowNav();}}
    });
    addEventListener('hashchange', renderFromHash); addEventListener('resize', () => { if(resolvedView()==='flow') fitFlow(); });
    bindPan($('#diagramViewport')); bindPan($('#lightboxViewport'));
  }

  renderGalleryFilters(); populateSessions(); renderToolDirectory(); bindGlobalEvents();
  if (!location.hash) navigate({ view:'gallery' }, true); else renderFromHash();
}());
