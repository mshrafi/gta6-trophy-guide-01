// Leonida Trophy Guide — tracker logic. Offline: the only fetch is the app's own data/trophies.json.
// Progress lives in localStorage; export/import move it as a JSON file. No network at run time.
const STORAGE_KEY = 'leonida-trophy-progress-v1';
const SPOILER_KEY = 'leonida-trophy-spoilers-v1';

const $ = (id) => document.getElementById(id);
const cardsEl = $('cards');
const stagesEl = $('stages');
const sourceListEl = $('sourceList');
const gradeChipsEl = $('gradeChips');
const kindChipsEl = $('kindChips');
const resultCountEl = $('resultCount');
const emptyStateEl = $('emptyState');

const KINDS = [
  ['all', 'All kinds'],
  ['story', 'Story'],
  ['collectible', 'Collectibles'],
  ['activity', 'Activities'],
  ['crime', 'Crime'],
  ['money', 'Money'],
];
const STAGE_INFO = [
  { n: 1, title: 'Play the story', text: 'Chapters 1–4 and the finale. Story trophies pop as the missions end — nothing here can be missed. But start Positive Mental Attitude now: meditate at every spot you find in Chapter 1, because one spot is only there.' },
  { n: 2, title: 'Strangers & side missions', text: 'The stranger strands: Andy, Kenton, Billy, Randy, Tyrone and more. Finish eight full strands for Strangers & Freaks — the five stranger-final trophies count toward it.' },
  { n: 3, title: 'Activities & the open world', text: 'Stunts, the shooting range, drone races, fishing, arcade, bowling, hunting and the beach. Most of these are long grinds — chip away at them while you explore.' },
  { n: 4, title: 'Crime & chaos', text: 'Robberies, wanted levels, Combat Focus and the airport. Bring a plan and a fast car; every one of these can be retried, so none of them is missable.' },
  { n: 5, title: 'Collectibles, money & mop-up', text: 'Cards, WAiNK tags, vehicles, garages, laundering and spending. Pick these up as you go and finish the sets after the story.' },
  { n: 6, title: '100% & the Platinum', text: 'Finish the story, then work the in-game 100% checklist until it reads 100% — that pops A Long Road, and the Platinum, Vice Got a Price!, follows at once.' },
];

let doc = null;
let earned = new Set();
let spoilersHidden = true;
let activeKind = 'all';

try {
  earned = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'));
} catch {
  earned = new Set();
}
try {
  spoilersHidden = localStorage.getItem(SPOILER_KEY) !== 'off';
} catch {
  spoilersHidden = true;
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...earned]));
}
function saveSpoilerPref() {
  localStorage.setItem(SPOILER_KEY, spoilersHidden ? 'on' : 'off');
}
function isEarned(t) { return earned.has(t.id); }
function isSpoilerHidden(t) {
  return spoilersHidden && t.kind === 'story' && !isEarned(t);
}
function gradeLabel(g) {
  return g.charAt(0).toUpperCase() + g.slice(1);
}
function sourceLinks(t) {
  if (!t.src || !doc.sources) return '';
  return t.src
    .map((k) => doc.sources[k])
    .filter(Boolean)
    .map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.name}</a>`)
    .join(' · ');
}

function renderProgress() {
  const total = doc.trophies.length;
  const n = earned.size;
  const pct = Math.round((n / total) * 100);
  $('earnedCount').textContent = String(n);
  $('earnedPct').textContent = `${pct}%`;
  $('progressFill').style.width = `${pct}%`;
  const byGrade = {};
  for (const t of doc.trophies) {
    byGrade[t.grade] = byGrade[t.grade] ?? { total: 0, got: 0 };
    byGrade[t.grade].total += 1;
    if (isEarned(t)) byGrade[t.grade].got += 1;
  }
  gradeChipsEl.replaceChildren();
  for (const g of ['platinum', 'gold', 'silver', 'bronze']) {
    const c = byGrade[g];
    if (!c) continue;
    const chip = document.createElement('span');
    chip.className = 'grade-chip';
    chip.innerHTML = `<b>${gradeLabel(g)}</b> ${c.got}/${c.total}`;
    gradeChipsEl.append(chip);
  }
}

function renderRoadmap() {
  stagesEl.replaceChildren();
  for (const s of STAGE_INFO) {
    const items = doc.trophies.filter((t) => t.stage === s.n);
    const got = items.filter(isEarned).length;
    const li = document.createElement('li');
    li.className = 'stage';
    const h = document.createElement('h3');
    h.textContent = s.title;
    const p = document.createElement('p');
    p.textContent = s.text;
    const count = document.createElement('p');
    count.className = 'stage-count';
    count.textContent = `${got} of ${items.length} earned in this stage`;
    const chips = document.createElement('div');
    chips.className = 'stage-trophies';
    for (const t of items) {
      const chip = document.createElement('span');
      chip.className = 'stage-trophy' + (isEarned(t) ? ' earned' : '') + (t.missable ? ' missable' : '');
      chip.textContent = (isSpoilerHidden(t) ? '???' : t.name) + (t.missable ? ' ⚠' : '');
      chip.title = t.missable ? 'Possibly missable' : t.name;
      chips.append(chip);
    }
    li.append(h, p, count, chips);
    stagesEl.append(li);
  }
}

function cardFor(t) {
  const article = document.createElement('article');
  article.className = 'card' + (isEarned(t) ? ' earned' : '') + (isSpoilerHidden(t) ? ' spoiler-hidden' : '');
  article.id = `trophy-${t.id}`;
  const hidden = isSpoilerHidden(t);
  const name = hidden ? 'Hidden story trophy — earn it to reveal' : t.name;
  const desc = hidden ? 'Its name and description stay hidden until you earn it.' : t.description;

  const head = document.createElement('div');
  head.className = 'card-head';
  const label = document.createElement('label');
  label.className = 'card-check';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = isEarned(t);
  box.setAttribute('aria-label', `Mark ${t.name} as earned`);
  box.addEventListener('change', () => {
    if (box.checked) earned.add(t.id);
    else earned.delete(t.id);
    saveProgress();
    renderAll();
  });
  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = name;
  label.append(box, title);
  const badge = document.createElement('span');
  badge.className = `grade-badge grade-${t.grade}`;
  badge.textContent = t.grade;
  head.append(label, badge);

  const d = document.createElement('p');
  d.className = 'card-desc';
  d.textContent = desc;

  const tags = document.createElement('div');
  tags.className = 'card-tags';
  const kindTag = document.createElement('span');
  kindTag.className = 'tag';
  kindTag.textContent = t.kind;
  tags.append(kindTag);
  const stageTag = document.createElement('span');
  stageTag.className = 'tag';
  stageTag.textContent = `Roadmap stage ${t.stage}`;
  tags.append(stageTag);
  if (t.hidden) {
    const h = document.createElement('span');
    h.className = 'tag hidden-tag';
    h.textContent = 'Hidden on PSN';
    tags.append(h);
  }
  if (t.missable) {
    const m = document.createElement('span');
    m.className = 'tag missable';
    m.textContent = '⚠ Possibly missable';
    tags.append(m);
  }

  const guide = document.createElement('p');
  guide.className = 'card-guide';
  const gl = document.createElement('span');
  gl.className = 'guide-label';
  gl.textContent = 'How to earn it — ';
  guide.append(gl, document.createTextNode(hidden ? 'Reveal this trophy by earning it, then read its guide here.' : t.guide));

  const src = document.createElement('p');
  src.className = 'card-source';
  src.innerHTML = hidden ? 'Source: the official trophy list.' : `Source: ${sourceLinks(t)}`;

  article.append(head, d, tags, guide, src);
  return article;
}

function currentFilters() {
  return {
    q: $('search').value.trim().toLowerCase(),
    grade: $('gradeFilter').value,
    kind: activeKind,
    missableOnly: $('missableOnly').checked,
    hideEarned: $('hideEarned').checked,
  };
}
function matches(t, f) {
  if (f.grade !== 'all' && t.grade !== f.grade) return false;
  if (f.kind !== 'all' && t.kind !== f.kind) return false;
  if (f.missableOnly && !t.missable) return false;
  if (f.hideEarned && isEarned(t)) return false;
  if (f.q) {
    const hay = `${t.name} ${t.description} ${t.guide} ${t.kind}`.toLowerCase();
    if (!hay.includes(f.q)) return false;
  }
  return true;
}

function renderCards() {
  const f = currentFilters();
  const shown = doc.trophies.filter((t) => matches(t, f));
  cardsEl.replaceChildren();
  for (const t of shown) cardsEl.append(cardFor(t));
  resultCountEl.textContent = `Showing ${shown.length} of ${doc.trophies.length} trophies`;
  emptyStateEl.hidden = shown.length > 0;
}

function renderSources() {
  sourceListEl.replaceChildren();
  for (const s of Object.values(doc.sources)) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = s.name;
    li.append(a);
    sourceListEl.append(li);
  }
}

function renderAll() {
  renderProgress();
  renderRoadmap();
  renderCards();
}

function renderKindChips() {
  kindChipsEl.replaceChildren();
  for (const [value, label] of KINDS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (activeKind === value ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      activeKind = value;
      renderKindChips();
      renderCards();
    });
    kindChipsEl.append(b);
  }
}

function applyUrlParams() {
  const p = new URLSearchParams(location.search);
  if (p.get('grade')) $('gradeFilter').value = p.get('grade');
  if (p.get('kind') && KINDS.some(([v]) => v === p.get('kind'))) activeKind = p.get('kind');
  if (p.get('missable') === '1') $('missableOnly').checked = true;
  if (p.get('spoilers') === 'off') {
    spoilersHidden = false;
    $('spoilerToggle').checked = false;
  }
  if (p.get('q')) $('search').value = p.get('q');
  const open = Number(p.get('open'));
  if (open) {
    requestAnimationFrame(() => {
      const el = $(`trophy-${open}`);
      if (el) el.scrollIntoView({ block: 'center' });
    });
  }
  if (p.get('view') === 'roadmap') {
    requestAnimationFrame(() => $('roadmap').scrollIntoView());
  }
}

async function init() {
  const res = await fetch('data/trophies.json');
  doc = await res.json();
  $('spoilerToggle').checked = spoilersHidden;
  $('spoilerToggle').addEventListener('change', (e) => {
    spoilersHidden = e.target.checked;
    saveSpoilerPref();
    renderAll();
  });
  $('search').addEventListener('input', renderCards);
  $('gradeFilter').addEventListener('change', renderCards);
  $('missableOnly').addEventListener('change', renderCards);
  $('hideEarned').addEventListener('change', renderCards);
  $('clearFilters').addEventListener('click', () => {
    $('search').value = '';
    $('gradeFilter').value = 'all';
    $('missableOnly').checked = false;
    $('hideEarned').checked = false;
    activeKind = 'all';
    renderKindChips();
    renderCards();
  });
  $('exportBtn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ game: 'GTA VI', earned: [...earned].sort((x, y) => x - y) }, null, 2)], { type: 'application/json' }));
    a.download = 'gta6-trophy-progress.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const ids = Array.isArray(data) ? data : data.earned;
      const valid = new Set(doc.trophies.map((t) => t.id));
      earned = new Set(ids.filter((id) => valid.has(id)));
      saveProgress();
      renderAll();
    } catch {
      alert('That file is not a valid progress export.');
    }
    e.target.value = '';
  });
  $('resetBtn').addEventListener('click', () => {
    if (confirm('Clear all earned trophies?')) {
      earned = new Set();
      saveProgress();
      renderAll();
    }
  });
  renderKindChips();
  applyUrlParams();
  renderSources();
  renderAll();
}

init();
