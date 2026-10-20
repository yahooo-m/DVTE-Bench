(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const number = n => Number(n).toLocaleString('en-US');
  const titleCase = s => String(s).replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const languages = { en: 'English', zh: 'Chinese', ko: 'Korean', ja: 'Japanese', th: 'Thai', it: 'Italian', mixed: 'Mixed', es: 'Spanish', pt: 'Portuguese', pl: 'Polish', cy: 'Welsh' };
  const mediaUrl = (path, original = false) => {
    if (typeof path !== 'string' || !/^assets\/[\w/.-]+$/.test(path) || path.includes('..')) return '';
    return (original ? '../' : '') + path;
  };
  const menu = $('nav-links');
  const closeMenu = () => { menu.classList.remove('is-open'); $('menu-toggle').setAttribute('aria-expanded', 'false'); $('menu-toggle').setAttribute('aria-label', 'Open navigation'); $('menu-toggle').textContent = '☰'; };
  $('menu-toggle').addEventListener('click', () => { const open = menu.classList.toggle('is-open'); $('menu-toggle').setAttribute('aria-expanded', String(open)); $('menu-toggle').setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); $('menu-toggle').textContent = open ? '×' : '☰'; });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('is-open')) { closeMenu(); $('menu-toggle').focus(); } });
  const navLinks = [...menu.querySelectorAll('a')];
  const navSections = navLinks.map(a => document.querySelector(a.hash));
  let scrollScheduled = false;
  const updateNav = () => {
    scrollScheduled = false;
    let active = 0; navSections.forEach((s, i) => { if (s.getBoundingClientRect().top <= 160) active = i; });
    navLinks.forEach((a, i) => { if (i === active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    const total = document.documentElement.scrollHeight - innerHeight;
    document.querySelector('.reading-progress').style.width = `${total > 0 ? Math.min(100, scrollY / total * 100) : 0}%`;
  };
  addEventListener('scroll', () => { if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(updateNav); } }, { passive: true });
  addEventListener('resize', updateNav); updateNav();

  // This wipe compares a saved model prediction with its source, at a shared clock.
  const heroVideos = [$('hero-source'), $('hero-output')];
  let heroPaused = reduced.matches, heroVisible = true, heroTouched = false, heroFrame = 0, heroEpoch = 0;
  const setWipe = value => { const v = Math.max(0, Math.min(100, value)); $('hero-wipe').style.setProperty('--wipe', `${v}%`); $('hero-compare').value = v; $('hero-compare').setAttribute('aria-valuetext', `${Math.round(v)} percent recorded Ours output`); };
  const animateWipe = time => { if (!heroEpoch) heroEpoch = time; if (!heroTouched) setWipe(50 + Math.sin((time - heroEpoch) / 1900) * 25); heroFrame = requestAnimationFrame(animateWipe); };
  const updateHero = () => {
    cancelAnimationFrame(heroFrame);
    const stopped = heroPaused || !heroVisible || document.hidden;
    heroVideos.forEach(v => { if (stopped) v.pause(); else v.play().catch(() => {}); });
    if (!stopped && !heroTouched) heroFrame = requestAnimationFrame(animateWipe);
    $('hero-motion').textContent = heroPaused ? '▶' : 'Ⅱ';
    $('hero-motion').setAttribute('aria-label', heroPaused ? 'Play hero animation' : 'Pause hero animation');
  };
  heroVideos.forEach(v => { v.loop = true; });
  heroVideos[0].addEventListener('timeupdate', () => { if (Math.abs(heroVideos[0].currentTime - heroVideos[1].currentTime) > .09 && heroVideos[1].readyState >= 1) heroVideos[1].currentTime = heroVideos[0].currentTime; });
  $('hero-compare').addEventListener('input', () => { heroTouched = true; cancelAnimationFrame(heroFrame); setWipe(Number($('hero-compare').value)); });
  $('hero-motion').addEventListener('click', () => { heroPaused = !heroPaused; updateHero(); });
  reduced.addEventListener('change', () => { heroPaused = reduced.matches; updateHero(); });
  document.addEventListener('visibilitychange', updateHero);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { heroVisible = entries[0].isIntersecting; updateHero(); }).observe(document.querySelector('.hero-art'));
  updateHero();

  let data, modelData = { cases: [], methods: [] }, active, activeFilter = 'all', view = 'prediction', methodId = 'ours', generation = 0;
  const source = $('source-video'), output = $('output-video'), pair = [source, output];
  let wantedPlaying = false, outputSeek = null, sourceSeek = null, catalogPage = 1;
  const categoryOf = item => data.categories.find(c => c.id === item.type);
  const modelsFor = item => modelData.cases.filter(c => c.previewId === item.previewId && c.sampleId === item.id);
  const methodOf = id => modelData.methods.find(m => m.id === id);
  const commonDuration = () => { const known = pair.map(v => v.duration).filter(d => Number.isFinite(d) && d > 0); return known.length ? Math.min(...known) : active?.duration || Infinity; };
  const updateTransport = () => { $('case-play').textContent = wantedPlaying ? 'Ⅱ' : '▶'; $('case-play').setAttribute('aria-label', wantedPlaying ? 'Pause synchronized preview' : 'Play synchronized preview'); };
  const pausePair = () => { wantedPlaying = false; pair.forEach(v => v.pause()); updateTransport(); };
  const playPair = async () => {
    const currentGeneration = generation;
    wantedPlaying = true; updateTransport();
    const results = await Promise.allSettled(pair.map(v => v.play()));
    if (generation !== currentGeneration || !wantedPlaying) return;
    if (results.some(r => r.status === 'rejected')) { pausePair(); $('comparison-note').textContent = 'Playback was interrupted. Select Play to try the synchronized preview again.'; }
  };
  const seekPair = time => {
    const duration = commonDuration(); const t = Math.max(0, Math.min(Number(time) || 0, Number.isFinite(duration) ? Math.max(0, duration - .001) : Number(time) || 0));
    if (source.readyState >= 1) source.currentTime = t; else sourceSeek = t;
    if (output.readyState >= 1) output.currentTime = t; else outputSeek = t;
    $('current-time').textContent = `${t.toFixed(1)} s`;
    $('case-timeline').value = Number.isFinite(duration) && duration > 0 ? t / duration * 1000 : 0;
    $('case-timeline').setAttribute('aria-valuetext', `${t.toFixed(1)} seconds of ${Number.isFinite(duration) ? duration.toFixed(1) : '0.0'} seconds`);
  };
  const updateDuration = () => { const d = commonDuration(); if (Number.isFinite(d)) { $('case-duration').textContent = `${d.toFixed(1)} s`; if (source.currentTime > d) seekPair(Math.max(0, d - .001)); } };
  source.addEventListener('loadedmetadata', () => { if (sourceSeek !== null) { source.currentTime = sourceSeek; sourceSeek = null; } updateDuration(); });
  output.addEventListener('loadedmetadata', () => { if (outputSeek !== null) { output.currentTime = Math.min(outputSeek, Math.max(0, output.duration - .001)); outputSeek = null; } updateDuration(); });
  source.addEventListener('timeupdate', () => {
    if (!active) return;
    const duration = commonDuration();
    if (wantedPlaying && Number.isFinite(duration) && source.currentTime >= duration - .04) { pausePair(); seekPair(0); return; }
    if (output.readyState >= 1 && Math.abs(source.currentTime - output.currentTime) > .09) output.currentTime = Math.min(source.currentTime, Math.max(0, output.duration - .001));
    const t = source.currentTime; $('current-time').textContent = `${t.toFixed(1)} s`;
    if (Number.isFinite(duration) && duration > 0) $('case-timeline').value = t / duration * 1000;
    $('case-timeline').setAttribute('aria-valuetext', `${t.toFixed(1)} seconds of ${Number.isFinite(duration) ? duration.toFixed(1) : '0.0'} seconds`);
  });
  pair.forEach(v => v.addEventListener('ended', () => { if (wantedPlaying) { pausePair(); seekPair(0); } }));
  source.addEventListener('error', () => { $('source-error').hidden = false; pausePair(); });
  output.addEventListener('error', () => { $('output-error').hidden = false; pausePair(); });
  $('case-play').addEventListener('click', () => { if (wantedPlaying) pausePair(); else playPair(); });
  $('case-restart').addEventListener('click', () => { seekPair(0); playPair(); });
  $('case-timeline').addEventListener('input', () => { const d = commonDuration(); if (Number.isFinite(d)) seekPair(Number($('case-timeline').value) / 1000 * d); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pausePair(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { if (!entries[0].isIntersecting) pausePair(); }).observe($('comparison-pair'));

  const renderDetails = () => {
    const holder = $('case-details-content'); holder.replaceChildren();
    const id = make('p'); id.append(make('strong', '', 'Original sample ID: '), make('code', '', active.id)); holder.append(id);
    holder.append(make('p', '', `Text overlay: ${active.text || 'No transcript attached.'}`));
    holder.append(make('p', '', `Dataset: ${active.frames} frames at ${active.fps.toFixed(2)} fps; ${active.width} × ${active.height}. Web previews use the complete clip from frame zero, resampled to 18 fps and a maximum 720-pixel long side. Web previews are silent.`));
    const entry = modelsFor(active).find(m => m.method === methodId);
    if (entry) {
      holder.append(make('p', '', `${methodOf(entry.method)?.label || entry.method}: ${methodOf(entry.method)?.configuration || 'Recorded model prediction'}. Source and output are synchronized over their shortest shared duration.`));
      if (entry.previewFrameDeltaFromSource) holder.append(make('p', '', 'This saved output has one fewer terminal frame than the source web preview because of frame-rate rounding. No start offset or crop is applied.'));
      const link = make('a', '', 'Recorded-output provenance JSON ↗'); link.href = 'model-previews.json'; link.target = '_blank'; link.rel = 'noopener noreferrer'; holder.append(link);
    }
    if (active.seen || active.track === 'seen_regression' || active.type === 'asr_subtitle') holder.append(make('p', '', 'Seen ASR regression track: this sample has known training overlap. It is included in the full benchmark aggregate.'));
  };
  const setOutput = (preserve = true) => {
    generation++;
    const time = preserve ? source.currentTime : 0; const playing = preserve && wantedPlaying;
    output.pause(); $('output-error').hidden = true; outputSeek = time;
    const entries = modelsFor(active); const entry = entries.find(e => e.method === methodId) || entries.find(e => e.method === 'ours') || entries[0];
    if (entry) methodId = entry.method;
    if (view === 'prediction' && !entry) view = 'reference';
    document.querySelectorAll('[data-view]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.view === view)); if (b.dataset.view === 'prediction') b.disabled = !entries.length; });
    $('model-select').parentElement.hidden = view !== 'prediction';
    $('model-select').value = methodId;
    if (view === 'prediction') {
      output.src = mediaUrl(entry.video); output.poster = mediaUrl(entry.poster);
      $('output-label').textContent = (methodOf(entry.method)?.label || entry.method).toUpperCase(); $('output-detail').textContent = 'recorded output';
      $('comparison-note').textContent = methodOf(entry.method)?.configuration || 'Saved model prediction.';
      output.setAttribute('aria-label', `${methodOf(entry.method)?.label || entry.method} recorded prediction`);
    } else {
      const kind = view === 'reference' ? 'target' : 'mask'; output.src = mediaUrl(active[kind], true); output.poster = mediaUrl(active[`${kind}Poster`], true);
      $('output-label').textContent = view === 'reference' ? 'CLEAN REFERENCE' : 'TEXT MASK'; $('output-detail').textContent = 'dataset annotation';
      $('comparison-note').textContent = view === 'reference' ? 'Paired clean benchmark reference. This view is ground truth, not a model prediction.' : 'Frame-aligned alpha mask from the benchmark. White marks the overlaid text regions.';
      output.setAttribute('aria-label', view === 'reference' ? 'Paired clean reference video' : 'Frame-aligned text alpha mask');
    }
    output.load(); renderDetails();
    if (playing) playPair();
  };
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; setOutput(); }));
  $('model-select').addEventListener('change', () => { methodId = $('model-select').value; setOutput(); });

  const renderCaseList = () => {
    const holder = $('case-list'); const oldScroll = { top: holder.scrollTop, left: holder.scrollLeft }; holder.replaceChildren();
    const visible = data.previews.filter(p => activeFilter === 'all' || p.type === activeFilter); $('case-count').textContent = visible.length;
    visible.forEach(p => {
      const button = make('button', 'case-card'); button.type = 'button'; button.setAttribute('aria-pressed', String(p === active)); button.setAttribute('aria-controls', 'case-title'); button.setAttribute('aria-label', `View ${p.label}, ${titleCase(p.orientation)}, ${(languages[p.language] || p.language)}`); button.dataset.caseId = p.previewId;
      const image = make('img'); image.src = mediaUrl(p.poster, true); image.alt = ''; image.width = 320; image.height = 180; image.loading = 'lazy';
      button.append(image, make('strong', '', p.label), make('small', '', `${titleCase(p.orientation)} · ${p.language.toUpperCase()} · ${p.duration.toFixed(1)} s`));
      button.addEventListener('click', () => { const focused = document.activeElement === button; setCase(p); if (focused) holder.querySelector(`[data-case-id="${p.previewId}"]`)?.focus({ preventScroll: true }); }); holder.append(button);
    });
    holder.scrollTop = oldScroll.top; holder.scrollLeft = oldScroll.left;
    const selected = holder.querySelector('[aria-pressed="true"]');
    if (selected) {
      const box = holder.getBoundingClientRect(), item = selected.getBoundingClientRect();
      if (innerWidth > 640 && (item.top < box.top || item.bottom > box.bottom)) holder.scrollTop += item.top - box.top - 10;
      if (innerWidth <= 640 && (item.left < box.left || item.right > box.right)) holder.scrollLeft += item.left - box.left - 10;
    }
  };
  const caseDescriptions = { standard_subtitle: 'Conventional captions, with timing and style variation.', artistic_title: 'Large display lettering, outline, glow, and a scene behind it.', moving_text: 'The text changes position. Compare the affected regions across frames.', vertical_text: 'Vertical writing over the scene, with fine details near the text.', non_bottom_layout: 'An overlay outside the usual bottom subtitle region.', multi_region: 'Several separate text regions share the same scene.', persistent_watermark: 'A small persistent mark, close to the edge of the frame.', asr_subtitle: 'Speech-aligned captions from the seen ASR regression track.' };
  const setCase = p => {
    if (!p) return; generation++; pausePair(); active = p; sourceSeek = 0; outputSeek = 0;
    $('source-error').hidden = true; source.src = mediaUrl(p.source, true); source.poster = mediaUrl(p.sourcePoster, true); source.load();
    $('case-title').textContent = `${p.label}, frame by frame.`;
    $('case-description').textContent = caseDescriptions[p.type] || categoryOf(p).description;
    $('case-kicker').textContent = `${titleCase(p.orientation).toUpperCase()} / ${p.language.toUpperCase()} / ${categoryOf(p).short}`;
    $('case-index').textContent = `${String(data.previews.indexOf(p) + 1).padStart(2, '0')} / ${data.previews.length}`;
    $('comparison-pair').classList.toggle('is-portrait', p.orientation === 'portrait');
    const entries = modelsFor(p); const methods = modelData.methods.filter(m => entries.some(e => e.method === m.id));
    $('model-select').replaceChildren(...methods.map(m => { const option = make('option', '', m.label); option.value = m.id; return option; }));
    if (!entries.some(e => e.method === methodId)) methodId = entries.some(e => e.method === 'ours') ? 'ours' : entries[0]?.method || '';
    if (!entries.length) view = 'reference';
    setOutput(false); $('case-timeline').value = 0; $('current-time').textContent = '0.0 s'; $('case-duration').textContent = `${p.duration.toFixed(1)} s`;
    $('case-meta').replaceChildren(...[['LANGUAGE', languages[p.language] || p.language.toUpperCase()], ['SOURCE FORMAT', `${p.width} × ${p.height}`], ['TEXT REGIONS', p.overlays], ['TARGET OCR AUDIT', titleCase(p.ocrStatus)]].map(([label, value]) => { const e = make('div'); e.append(make('span', '', label), make('strong', '', value)); return e; }));
    renderCaseList();
  };
  const setFilter = (type, scroll = false) => {
    activeFilter = type; $('case-filters').querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === type)));
    const matching = data.previews.filter(p => type === 'all' || p.type === type);
    if (!matching.includes(active)) setCase(matching[0]); else renderCaseList();
    if (scroll) $('explorer').scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
  };
  let playingCard;
  const stopCard = () => { if (playingCard) { const v = playingCard.querySelector('video'); v.pause(); playingCard.classList.remove('is-playing'); playingCard = null; } };
  const renderTaxonomy = () => {
    data.categories.forEach((c, i) => {
      const preview = data.previews.find(p => p.type === c.id && p.orientation === 'landscape') || data.previews.find(p => p.type === c.id);
      const b = make('button', 'type-card'); b.type = 'button'; b.setAttribute('aria-label', `Explore ${c.label}, ${c.count} clips`);
      const media = make('span', 'type-media'); const im = make('img'); im.src = mediaUrl(preview.sourcePoster, true); im.alt = ''; im.width = 320; im.height = 180; im.loading = 'lazy';
      const v = make('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.setAttribute('aria-hidden', 'true');
      media.append(im, v, make('span', 'type-code', `${String(i + 1).padStart(2, '0')} / ${c.short}`), make('span', 'type-cta', '↗'));
      const copy = make('span', 'type-copy'); copy.append(make('strong', '', c.label), make('p', '', c.description), make('small', '', `${number(c.count)} CLIPS`)); b.append(media, copy);
      const start = () => { if (reduced.matches || document.hidden) return; stopCard(); playingCard = b; if (!v.getAttribute('src')) v.src = mediaUrl(preview.source, true); v.play().then(() => { if (playingCard === b) b.classList.add('is-playing'); else v.pause(); }).catch(() => {}); };
      b.addEventListener('pointerenter', start); b.addEventListener('focus', start); b.addEventListener('pointerleave', () => { if (playingCard === b) stopCard(); }); b.addEventListener('blur', () => { if (playingCard === b) stopCard(); });
      b.addEventListener('click', () => { stopCard(); setFilter(c.id, true); }); $('taxonomy-grid').append(b);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopCard(); });
  };
  const renderComposition = () => {
    data.categories.forEach(c => { const row = make('div', 'composition-row'); const track = make('span', 'composition-track'); const fill = make('span', 'composition-fill'); fill.style.width = `${c.count / 232 * 100}%`; track.append(fill); row.append(make('span', '', c.label), track, make('span', '', c.count)); $('composition-bars').append(row); });
  };
  const renderCatalog = () => {
    if (!data) return;
    const q = $('catalog-search').value.trim().toLowerCase(); const type = $('catalog-type').value; const orientation = $('catalog-orientation').value;
    const rows = data.items.filter(i => (!q || `${i.id} ${i.text} ${i.language} ${languages[i.language] || ''} ${i.type}`.toLowerCase().includes(q)) && (type === 'all' || type === i.type) && (orientation === 'all' || orientation === i.orientation));
    const pages = Math.max(1, Math.ceil(rows.length / 12)); catalogPage = Math.min(catalogPage, pages); const body = $('catalog-body'); body.replaceChildren();
    rows.slice((catalogPage - 1) * 12, catalogPage * 12).forEach(i => { const tr = make('tr'); [i.id, categoryOf(i).label, i.language.toUpperCase(), `${titleCase(i.orientation)} · ${i.width}×${i.height}`, `${i.duration.toFixed(2)} s`, i.overlays].forEach(value => tr.append(make('td', '', value))); body.append(tr); });
    if (!rows.length) { const tr = make('tr'); const td = make('td', '', 'No records match these filters.'); td.colSpan = 6; tr.append(td); body.append(tr); }
    $('catalog-count').textContent = `${number(rows.length)} matching records`; $('catalog-page').textContent = `Page ${catalogPage} of ${pages}`; $('catalog-prev').disabled = catalogPage <= 1; $('catalog-next').disabled = catalogPage >= pages;
  };
  ['catalog-search', 'catalog-type', 'catalog-orientation'].forEach(id => $(id).addEventListener(id === 'catalog-search' ? 'input' : 'change', () => { catalogPage = 1; renderCatalog(); }));
  $('catalog-prev').addEventListener('click', () => { catalogPage--; renderCatalog(); }); $('catalog-next').addEventListener('click', () => { catalogPage++; renderCatalog(); });
  const reveal = () => { if (reduced.matches || !('IntersectionObserver' in window)) return; const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); observer.unobserve(e.target); } }), { threshold: .06 }); document.querySelectorAll('.section-heading,.protocol-grid,.composition,.download-panel').forEach(e => { e.classList.add('reveal'); observer.observe(e); }); };
  Promise.all([fetch('../data/benchmark.json?v=20261020').then(r => { if (!r.ok) throw new Error('Manifest unavailable'); return r.json(); }), fetch('model-previews.json?v=20261020').then(r => { if (!r.ok) throw new Error('Prediction manifest unavailable'); return r.json(); })]).then(([benchmark, predictions]) => {
    data = benchmark; modelData = predictions; if (!Array.isArray(data.previews) || !Array.isArray(modelData.cases)) throw new Error('Invalid manifest');
    renderTaxonomy(); renderComposition();
    [['all', 'All examples'], ...data.categories.map(c => [c.id, c.label])].forEach(([id, label]) => { const b = make('button', '', label); b.type = 'button'; b.dataset.filter = id; b.setAttribute('aria-pressed', String(id === 'all')); b.addEventListener('click', () => setFilter(id)); $('case-filters').append(b); });
    data.categories.forEach(c => { const o = make('option', '', c.label); o.value = c.id; $('catalog-type').append(o); });
    setCase(data.previews.find(p => p.previewId === 'case-11') || data.previews[0]); renderCatalog(); reveal(); $('load-status').hidden = true;
  }).catch(() => { $('load-status').replaceChildren(document.createTextNode('The interactive examples could not be loaded. ')); const a = make('a', '', 'Open the original page ↗'); a.href = '../original.html#explorer'; a.style.textDecoration = 'underline'; $('load-status').append(a); });
})();
