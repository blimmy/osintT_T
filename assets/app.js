(function () {
  'use strict';

  const flowData = window.OSINT_FLOW_DATA;
  const toolData = window.OSINT_TOOL_DATA;
  const challenges = window.OSINT_CHALLENGES || [];
  if (!flowData || !toolData) throw new Error('Data files did not load. Serve the repository root with a static web server.');

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const flowMap = new Map(flowData.flows.map(item => [item.id, item]));
  const toolMap = new Map(toolData.tools.map(item => [item.id, item]));
  const defaultFlow = '00-MASTER-01-DECISION-ENGINE';
  const categoryOrder = ['OSINT', 'Cryptography', 'Digital Forensics'];
  const groupTools = {
    OSINT: new Set(['exiftool','ripgrep','python','qgis','openstreetmap','diff','hash','shell','curl','dig','host','whois','rdap','pdfinfo','pdftotext','pdftoppm','unzip','jq','file','strings','xxd','zbarimg','ffprobe','ffmpeg','tesseract','imagemagick','openssl']),
    Cryptography: new Set(['python','openssl','xxd','file','strings','sympy','sagemath','rsactftool','cyberchef','john','hashcat']),
    'Digital Forensics': new Set(['exiftool','ripgrep','python','hash','shell','pdfinfo','pdftotext','pdftoppm','unzip','jq','file','strings','xxd','zbarimg','ffprobe','ffmpeg','tesseract','imagemagick','cyberchef','john','hashcat','tshark','wireshark','tcpdump','zeek','volatility3','sleuthkit','autopsy','bulk_extractor','foremost','binwalk','sqlite3','plaso','evtx','zsteg','steghide','audacity'])
  };
  let flowZoom = 1;
  let lightZoom = 1;
  let lastFlow = '';
  let searchCursor = -1;
  let toastTimer;
  let suppressImageClickUntil = 0;
  let activeToolCategory = 'All';

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  }
  function hashState() { return Object.fromEntries(new URLSearchParams(location.hash.replace(/^#/, '')).entries()); }
  function resolvedView(hash = hashState()) { return hash.view || (hash.flow ? 'flow' : hash.tool ? 'tools' : 'gallery'); }
  function navigate(changes, replace = false) {
    const next = { ...hashState(), ...changes };
    Object.keys(next).forEach(key => (next[key] === null || next[key] === undefined || next[key] === '') && delete next[key]);
    if (next.view === 'flow' && !next.flow) next.flow = defaultFlow;
    const value = `#${new URLSearchParams(next).toString()}`;
    if (replace) { history.replaceState(null, '', value); renderFromHash(); }
    else location.hash = value;
  }
  function showToast(message) {
    const node = $('#toast');
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 1800);
  }

  function renderGalleryFilters() {
    const categories = [...new Set(challenges.map(item => item.category))].sort();
    const evidence = [...new Set(challenges.map(item => item.evidence))].sort();
    $('#categoryFilter').innerHTML = '<option value="">ทั้งหมด</option>' + categories.map(item => `<option>${esc(item)}</option>`).join('');
    $('#evidenceFilter').innerHTML = '<option value="">ทุกชนิด</option>' + evidence.map(item => `<option>${esc(item)}</option>`).join('');
  }
  function renderGallery() {
    const category = $('#categoryFilter').value;
    const evidence = $('#evidenceFilter').value;
    const filtered = challenges.filter(item => (!category || item.category === category) && (!evidence || item.evidence === evidence));
    $('#challengeCount').textContent = challenges.length;
    $('#galleryFlowCount').textContent = flowData.flows.length;
    $('#galleryToolCount').textContent = toolData.tools.length;
    $('#galleryStatus').textContent = `แสดง ${filtered.length} จาก ${challenges.length}`;
    $('#challengeGrid').innerHTML = filtered.length ? filtered.map((item, itemIndex) => `<button class="challenge-card" style="--accent:${esc(item.accent)}" data-challenge="${esc(item.id)}" aria-label="${esc(item.title)}: ${esc(item.question)} — เปิด flowchart">
      <span class="challenge-cover"><img src="${esc(item.cover)}" alt="Synthetic ${esc(item.title)} challenge example" loading="${itemIndex < 3 ? 'eager' : 'lazy'}"></span>
      <span class="challenge-body"><span class="challenge-meta"><span class="challenge-category">${esc(item.category)}</span><span class="challenge-evidence">${esc(item.evidence)}</span></span><h3>${esc(item.title)}</h3><p class="challenge-question">${esc(item.question)}</p><span class="challenge-tags">${item.tags.slice(0, 4).map(tag => `<span>${esc(tag)}</span>`).join('')}</span><span class="challenge-open"><span>OPEN INTERACTIVE FLOW</span><span>→</span></span></span>
    </button>`).join('') : '<div class="no-results">ไม่พบการ์ดที่ตรงตัวกรอง ลองล้างตัวกรองหรือค้นด้วยคำสั้นลง</div>';
    $$('[data-challenge]').forEach(button => button.addEventListener('click', () => {
      const item = challenges.find(candidate => candidate.id === button.dataset.challenge);
      navigate({ view: 'flow', flow: item.flow, tool: null, task: null });
    }));
  }

  function buildFlowNav(current) {
    $('#flowCount').textContent = `${flowData.flows.length} charts`;
    $('#flowNav').innerHTML = flowData.categories.map(([category, label]) => {
      const flows = flowData.flows.filter(item => item.category === category);
      return `<details class="flow-group" ${flows.some(item => item.id === current) ? 'open' : ''}><summary>${esc(label)} · ${flows.length}</summary><div class="flow-list">${flows.map(flow => `<button class="flow-link ${flow.id === current ? 'active' : ''}" data-flow="${esc(flow.id)}">${esc(flow.title)}</button>`).join('')}</div></details>`;
    }).join('');
    $$('.flow-link').forEach(button => button.addEventListener('click', () => {
      navigate({ view: 'flow', flow: button.dataset.flow, tool: null, task: null });
      closeFlowNav();
    }));
  }
  function renderFlow(flow) {
    buildFlowNav(flow.id);
    $('#flowCategory').textContent = flow.categoryLabel;
    $('#flowTitle').textContent = flow.title;
    $('#breadcrumbs').textContent = `CTF T_T / ${flow.categoryLabel} / ${flow.id}`;
    $('#flowImage').src = flow.svg;
    $('#flowImage').alt = `${flow.title} branching CTF decision flowchart`;
    $('#downloadSvg').href = flow.svg;
    $('#downloadSvg').download = `${flow.id}.svg`;
    $('#downloadPng').href = flow.png;
    $('#downloadPng').download = `${flow.id}.png`;
    $('#nodeDock').innerHTML = flow.tools.length ? `<span class="eyebrow">OPEN IN COMMAND REFERENCE</span>${flow.tools.map(item => `<button class="tool-chip" data-tool="${esc(item.tool)}" data-task="${esc(item.task)}">${esc(item.label)}</button>`).join('')}` : '';
    $$('.tool-chip').forEach(button => button.addEventListener('click', () => navigate({ view: 'tools', flow: null, tool: button.dataset.tool, task: button.dataset.task })));
    const peers = flowData.flows.filter(item => item.category === flow.category);
    const index = peers.findIndex(item => item.id === flow.id);
    const related = [peers[index - 1], peers[index + 1]].filter(Boolean);
    $('#relatedFlows').innerHTML = related.map((item, relatedIndex) => `<button data-related-flow="${esc(item.id)}">${relatedIndex === 0 && index > 0 ? '← ' : ''}${esc(item.title)}${relatedIndex === related.length - 1 && index < peers.length - 1 ? ' →' : ''}</button>`).join('');
    $$('[data-related-flow]').forEach(button => button.addEventListener('click', () => navigate({ view: 'flow', flow: button.dataset.relatedFlow, tool: null, task: null })));
    if (flow.id !== lastFlow) {
      lastFlow = flow.id;
      $('#flowImage').addEventListener('load', fitFlow, { once: true });
    }
  }

  function toolGroups(tool) { return categoryOrder.filter(category => groupTools[category].has(tool.id)); }
  function exampleFile(tool, recipe) {
    const examples = {
      tshark:'capture.pcap', wireshark:'capture.pcap', tcpdump:'capture.pcap', zeek:'capture.pcap', volatility3:'memory.raw',
      sleuthkit:'disk.img', autopsy:'disk.img', bulk_extractor:'disk.img', foremost:'disk.img', plaso:'disk.img', evtx:'security.evtx',
      sqlite3:'history.db', pdfinfo:'document.pdf', pdftotext:'document.pdf', pdftoppm:'document.pdf', ffprobe:'video.mp4', ffmpeg:'video.mp4',
      audacity:'audio.wav', steghide:'evidence.jpg', zsteg:'evidence.png', unzip:'document.docx', binwalk:'evidence.bin', strings:'evidence.bin',
      xxd:'evidence.bin', file:'evidence.bin', hashcat:'hashes.txt', john:'hashes.txt', rsactftool:'public.pem', openssl:'cipher.bin'
    };
    if (tool.id === 'exiftool' && recipe?.id === 'document') return 'document.pdf';
    return examples[tool.id] || 'photo.jpg';
  }
  function commandData(entry) {
    return typeof entry === 'string' ? { label: '', command: entry } : entry;
  }
  function commandFrom(entry, tool, recipe) { return commandData(entry).command.replaceAll('{{file}}', `'${exampleFile(tool, recipe)}'`); }
  function commandCard(entry, tool, recipe) {
    const command = commandData(entry);
    return `<div class="command-card">${command.label ? `<span class="command-label">${esc(command.label)}</span>` : ''}<pre><code>${esc(commandFrom(entry, tool, recipe))}</code></pre><button class="copy-btn" data-copy aria-label="Copy command${command.label ? ` for ${esc(command.label)}` : ''}">Copy</button></div>`;
  }
  function recipeHTML(tool, recipe, selected = false) {
    return `<details class="recipe" data-recipe="${esc(recipe.id)}" ${selected ? 'open' : ''}><summary><span class="recipe-title">${esc(recipe.title)}</span><span aria-hidden="true">＋</span></summary><div class="recipe-body">
      <div class="section-label">What am I trying to find?</div><p>${esc(recipe.goal)}</p>
      <div class="section-label">Question keywords</div><div class="keyword-list">${recipe.keywords.map(keyword => `<span class="keyword">${esc(keyword)}</span>`).join('')}</div>
      <div class="section-label">Exact command</div>${recipe.commands.map(command => commandCard(command, tool, recipe)).join('')}
    </div></details>`;
  }
  function toolHaystack(tool, recipe) {
    return `${tool.name} ${tool.purpose} ${tool.categories.join(' ')} ${tool.formats.join(' ')} ${recipe.title} ${recipe.goal} ${recipe.keywords.join(' ')} ${recipe.commands.map(command => `${commandData(command).label} ${commandData(command).command}`).join(' ')}`.toLowerCase();
  }
  function matchesQuery(haystack, query) {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return tokens.every(token => haystack.includes(token));
  }
  function bindCopyButtons(scope = document) {
    scope.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
      const text = button.parentElement.querySelector('code').textContent;
      try { await navigator.clipboard.writeText(text); }
      catch (_) {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = 'Copy'; }, 1000);
      showToast('คัดลอกคำสั่งแล้ว');
    }));
  }
  function renderToolTabs() {
    $('#toolCategoryTabs').innerHTML = ['All', ...categoryOrder].map(category => `<button class="tool-tab ${activeToolCategory === category ? 'active' : ''}" data-tool-category="${esc(category)}" aria-pressed="${activeToolCategory === category}">${esc(category)}</button>`).join('');
    $$('[data-tool-category]').forEach(button => button.addEventListener('click', () => {
      navigate({ view: 'tools', flow: null, tool: null, task: null, category: button.dataset.toolCategory === 'All' ? null : button.dataset.toolCategory });
    }));
  }
  function renderToolDirectory(query = '') {
    const directory = $('#toolDirectory');
    directory.hidden = false;
    $('#toolDetail').hidden = true;
    const eligible = toolData.tools.filter(tool => activeToolCategory === 'All' || toolGroups(tool).includes(activeToolCategory));
    if (query.trim()) {
      const matches = eligible.flatMap(tool => tool.recipes.filter(recipe => matchesQuery(toolHaystack(tool, recipe), query)).map(recipe => ({ tool, recipe })));
      directory.className = 'tool-directory task-results';
      directory.innerHTML = matches.length ? `<div class="tool-result-summary">พบ ${matches.length} command tasks</div>${matches.map(({ tool, recipe }) => `<button class="task-result" data-directory-tool="${esc(tool.id)}" data-directory-task="${esc(recipe.id)}"><span>${esc(tool.name)}</span><strong>${esc(recipe.title)}</strong><small>${esc(recipe.goal)}</small><span class="keyword-list">${recipe.keywords.slice(0, 5).map(keyword => `<span class="keyword">${esc(keyword)}</span>`).join('')}</span></button>`).join('')}` : '<div class="no-results">ไม่พบคำสั่งที่ตรงกัน ลองคำสั้นลง เช่น GPS, POST, RSA, PDF หรือ process</div>';
    } else {
      directory.className = 'tool-directory';
      const groups = activeToolCategory === 'All' ? categoryOrder : [activeToolCategory];
      directory.innerHTML = groups.map(category => {
        const tools = eligible.filter(tool => toolGroups(tool).includes(category)).sort((a, b) => a.name.localeCompare(b.name));
        const slug = category.replace(/\s/g, '-');
        return `<section class="tool-group" aria-labelledby="tool-group-${slug}"><div class="tool-group-head"><h2 id="tool-group-${slug}">${esc(category)}</h2><span>${tools.length} tools</span></div><div class="tool-grid">${tools.map(tool => `<button class="tool-card" data-directory-tool="${esc(tool.id)}"><h3>${esc(tool.name)}</h3><p>${esc(tool.purpose)}</p><span>${tool.recipes.length} COMMAND TASK${tool.recipes.length === 1 ? '' : 'S'} →</span></button>`).join('')}</div></section>`;
      }).join('');
    }
    $$('[data-directory-tool]').forEach(button => button.addEventListener('click', () => navigate({ view: 'tools', flow: null, tool: button.dataset.directoryTool, task: button.dataset.directoryTask || null })));
  }
  function renderToolDetail(tool, taskId, query = '') {
    $('#toolDirectory').hidden = true;
    const detail = $('#toolDetail');
    detail.hidden = false;
    const recipes = query.trim() ? tool.recipes.filter(recipe => matchesQuery(toolHaystack(tool, recipe), query)) : tool.recipes;
    const selected = tool.recipes.find(recipe => recipe.id === taskId);
    detail.innerHTML = `<div class="tool-detail-head"><button class="secondary-btn" data-all-tools>← All tools</button><div><p class="eyebrow">COMMAND REFERENCE</p><h2>${esc(tool.name)}</h2><p>${esc(tool.purpose)}</p></div><a href="${esc(tool.homepage)}" target="_blank" rel="noopener noreferrer">Official docs ↗</a></div><div class="recipe-list">${recipes.length ? recipes.map(recipe => recipeHTML(tool, recipe, recipe === selected || (query.trim() && recipes.length === 1))).join('') : '<div class="no-results">ไม่พบ task ใน tool นี้ ลองคำสั้นลง</div>'}</div>`;
    $('[data-all-tools]').addEventListener('click', () => navigate({ view: 'tools', flow: null, tool: null, task: null }));
    bindCopyButtons(detail);
    if (selected) requestAnimationFrame(() => detail.querySelector(`[data-recipe="${CSS.escape(selected.id)}"]`)?.scrollIntoView({ block: 'start' }));
  }
  function renderTools(hash = hashState()) {
    activeToolCategory = categoryOrder.includes(hash.category) ? hash.category : 'All';
    renderToolTabs();
    const query = $('#toolSearch').value;
    const tool = toolMap.get(hash.tool);
    if (tool) renderToolDetail(tool, hash.task, query);
    else renderToolDirectory(query);
  }

  function searchIndex() {
    const challengeItems = challenges.map(item => ({ title:item.title, subtitle:item.question, flow:item.flow, haystack:`${item.title} ${item.category} ${item.evidence} ${item.question} ${item.tags.join(' ')}`.toLowerCase() }));
    const flows = flowData.flows.map(flow => ({ title:flow.title, subtitle:`${flow.categoryLabel} · ${flow.id}`, flow:flow.id, haystack:`${flow.title} ${flow.id} ${flow.categoryLabel} ${flow.tools.map(item => item.label).join(' ')}`.toLowerCase() }));
    const recipes = toolData.tools.flatMap(tool => tool.recipes.map(recipe => ({ title:`${tool.name} · ${recipe.title}`, subtitle:recipe.goal, tool:tool.id, task:recipe.id, haystack:toolHaystack(tool, recipe) })));
    return { challengeItems, flows, recipes };
  }
  const index = searchIndex();
  function renderSearch(query) {
    const match = item => matchesQuery(item.haystack, query);
    const challengeMatches = index.challengeItems.filter(match).slice(0, 5);
    const recipeMatches = index.recipes.filter(match).slice(0, 7);
    const flowMatches = index.flows.filter(match).slice(0, 5);
    const result = $('#searchResults');
    searchCursor = -1;
    const section = (title, list, render) => list.length ? `<div class="search-section">${title}</div>${list.map(render).join('')}` : '';
    result.innerHTML = section('CHALLENGE QUESTIONS', challengeMatches, item => `<button class="search-result" data-search-flow="${item.flow}"><strong>${esc(item.title)}</strong><span>${esc(item.subtitle)}</span></button>`) + section('COMMAND TASKS', recipeMatches, item => `<button class="search-result" data-search-tool="${item.tool}" data-search-task="${item.task}"><strong>${esc(item.title)}</strong><span>${esc(item.subtitle)}</span></button>`) + section('FLOWCHARTS', flowMatches, item => `<button class="search-result" data-search-flow="${item.flow}"><strong>${esc(item.title)}</strong><span>${esc(item.subtitle)}</span></button>`) || '<div class="search-empty">ไม่พบผลลัพธ์ ลองคำสั้นลง เช่น GPS, POST, RSA, EVTX</div>';
    result.hidden = false;
    $$('[data-search-tool]').forEach(button => button.addEventListener('click', () => { navigate({ view:'tools', flow:null, tool:button.dataset.searchTool, task:button.dataset.searchTask }); closeSearch(); }));
    $$('[data-search-flow]').forEach(button => button.addEventListener('click', () => { navigate({ view:'flow', flow:button.dataset.searchFlow, tool:null, task:null }); closeSearch(); }));
  }
  function closeSearch() { $('#searchResults').hidden = true; searchCursor = -1; }
  function moveSearchCursor(delta) {
    const results = $$('.search-result');
    if (!results.length) return;
    searchCursor = (searchCursor + delta + results.length) % results.length;
    results.forEach((item, itemIndex) => item.classList.toggle('active', itemIndex === searchCursor));
    results[searchCursor].scrollIntoView({ block:'nearest' });
  }

  function updateFlowZoom() { $('#flowImage').style.width = `${Math.round(1800 * flowZoom)}px`; $('#zoomReset').textContent = `${Math.round(flowZoom * 100)}%`; }
  function fitFlow() {
    const viewport = $('#diagramViewport');
    if (!viewport.clientWidth || !viewport.clientHeight) return;
    flowZoom = Math.max(.25, Math.min((viewport.clientWidth - 28) / 1800, (viewport.clientHeight - 28) / 2200, 1));
    updateFlowZoom();
    viewport.scrollTo(0, 0);
  }
  function updateLightZoom() { $('#lightboxImage').style.width = `${Math.round(1800 * lightZoom)}px`; $('#lightZoomReset').textContent = `${Math.round(lightZoom * 100)}%`; }
  function fitLightbox() {
    const viewport = $('#lightboxViewport');
    lightZoom = Math.max(.2, Math.min((viewport.clientWidth - 24) / 1800, (viewport.clientHeight - 24) / 2200, 1));
    updateLightZoom();
    viewport.scrollTo(0, 0);
  }
  function openLightbox() {
    if (Date.now() < suppressImageClickUntil) return;
    const flow = flowMap.get(hashState().flow) || flowMap.get(defaultFlow);
    $('#lightboxTitle').textContent = flow.title;
    $('#lightboxImage').src = flow.svg;
    $('#lightboxImage').alt = `${flow.title} enlarged flowchart`;
    $('#lightbox').hidden = false;
    document.body.dataset.modal = 'true';
    requestAnimationFrame(fitLightbox);
    $('#closeLightbox').focus();
  }
  function closeLightbox() {
    $('#lightbox').hidden = true;
    delete document.body.dataset.modal;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    $('#expandFlow').focus();
  }
  function bindPan(viewport) {
    let active = false, startX = 0, startY = 0, left = 0, top = 0, moved = false;
    viewport.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button,a,input,select')) return;
      active = true; moved = false; startX = event.clientX; startY = event.clientY; left = viewport.scrollLeft; top = viewport.scrollTop;
      viewport.setPointerCapture?.(event.pointerId); viewport.classList.add('dragging');
    });
    viewport.addEventListener('pointermove', event => {
      if (!active) return;
      const deltaX = event.clientX - startX, deltaY = event.clientY - startY;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 6) moved = true;
      viewport.scrollLeft = left - deltaX; viewport.scrollTop = top - deltaY;
    });
    const stop = () => { if (!active) return; active = false; viewport.classList.remove('dragging'); if (moved) suppressImageClickUntil = Date.now() + 250; };
    viewport.addEventListener('pointerup', stop);
    viewport.addEventListener('pointercancel', stop);
  }

  function openFlowNav() { $('#leftSidebar').classList.add('open'); $('#flowBackdrop').hidden = false; $('#navToggle').setAttribute('aria-expanded', 'true'); }
  function closeFlowNav() { $('#leftSidebar').classList.remove('open'); $('#flowBackdrop').hidden = true; $('#navToggle').setAttribute('aria-expanded', 'false'); }
  function renderFromHash() {
    const hash = hashState();
    const view = resolvedView(hash);
    $('#galleryView').hidden = view !== 'gallery';
    $('#flowView').hidden = view !== 'flow';
    $('#toolsView').hidden = view !== 'tools';
    $$('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === view));
    document.body.dataset.view = view;
    if (view === 'gallery') renderGallery();
    if (view === 'flow') renderFlow(flowMap.get(hash.flow) || flowMap.get(defaultFlow));
    if (view === 'tools') renderTools(hash);
    $('#mobileMenu').hidden = true;
    $('#mobileMenuToggle').setAttribute('aria-expanded', 'false');
  }

  function bindGlobalEvents() {
    $('#categoryFilter').addEventListener('change', renderGallery);
    $('#evidenceFilter').addEventListener('change', renderGallery);
    $('#clearFilters').addEventListener('click', () => { $('#categoryFilter').value = ''; $('#evidenceFilter').value = ''; renderGallery(); });
    $('#backGallery').addEventListener('click', () => navigate({ view:'gallery', flow:null, tool:null, task:null }));
    $('#navToggle').addEventListener('click', () => $('#leftSidebar').classList.contains('open') ? closeFlowNav() : openFlowNav());
    $('#flowBackdrop').addEventListener('click', closeFlowNav);
    $('#flowImage').addEventListener('click', openLightbox);
    $('#expandFlow').addEventListener('click', openLightbox);
    $('#closeLightbox').addEventListener('click', closeLightbox);
    $('#zoomIn').addEventListener('click', () => { flowZoom = Math.min(2.5, flowZoom + .15); updateFlowZoom(); });
    $('#zoomOut').addEventListener('click', () => { flowZoom = Math.max(.2, flowZoom - .15); updateFlowZoom(); });
    $('#zoomReset').addEventListener('click', fitFlow);
    $('#lightZoomIn').addEventListener('click', () => { lightZoom = Math.min(4, lightZoom + .2); updateLightZoom(); });
    $('#lightZoomOut').addEventListener('click', () => { lightZoom = Math.max(.2, lightZoom - .2); updateLightZoom(); });
    $('#lightZoomReset').addEventListener('click', fitLightbox);
    $('#browserFullscreen').addEventListener('click', () => $('#lightbox').requestFullscreen?.());
    $('#mobileMenuToggle').addEventListener('click', () => { const menu = $('#mobileMenu'); menu.hidden = !menu.hidden; $('#mobileMenuToggle').setAttribute('aria-expanded', String(!menu.hidden)); });
    $('#toolSearch').addEventListener('input', () => renderTools(hashState()));
    $('#globalSearch').addEventListener('focus', event => renderSearch(event.target.value));
    $('#globalSearch').addEventListener('input', event => renderSearch(event.target.value));
    $('#globalSearch').addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); moveSearchCursor(1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); moveSearchCursor(-1); }
      else if (event.key === 'Enter' && searchCursor >= 0) { event.preventDefault(); $$('.search-result')[searchCursor].click(); }
      else if (event.key === 'Escape') closeSearch();
    });
    document.addEventListener('click', event => { if (!event.target.closest('.global-search-wrap')) closeSearch(); });
    document.addEventListener('keydown', event => {
      if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { event.preventDefault(); $('#globalSearch').focus(); }
      if (event.key === 'Escape') { if (!$('#lightbox').hidden) closeLightbox(); else { closeSearch(); closeFlowNav(); } }
    });
    addEventListener('hashchange', renderFromHash);
    addEventListener('resize', () => { if (resolvedView() === 'flow') fitFlow(); });
    bindPan($('#diagramViewport'));
    bindPan($('#lightboxViewport'));
  }

  renderGalleryFilters();
  renderToolTabs();
  renderToolDirectory();
  bindGlobalEvents();
  if (!location.hash) navigate({ view:'gallery' }, true);
  else renderFromHash();
}());
