const STORAGE_KEY = "telefonos_calificador_v2";

const DEFAULT_CATEGORIES = [
  { id: "estetica", name: "🎨 Estética" },
  { id: "ubicacion", name: "📍 Ubicación particular" },
  { id: "vandalismo", name: "⚡ Vandalismo" },
  { id: "mensaje", name: "💬 Mensaje" },
];

let photos = [];
let rateOrder = [];
let state = {
  categories: [...DEFAULT_CATEGORIES],
  stars: {},
  rankingSort: "global",
};

// Optional imported collaborator ratings: { name: string, starsByFilename: { [filename]: { [catId]: number } } }
let collabData = null;
let useCollabCombined = true;

let rateIndex = 0;
let focusedCatIndex = 0;
let rankingFilter = "all";
let lightboxPhotoId = null;

// DOM
const viewRate = document.getElementById("view-rate");
const viewRanking = document.getElementById("view-ranking");
const tabRate = document.getElementById("tab-rate");
const tabRanking = document.getElementById("tab-ranking");

const statRated = document.getElementById("stat-rated");
const statAvg = document.getElementById("stat-avg");
const coveragePct = document.getElementById("coverage-pct");
const coverageFill = document.getElementById("coverage-fill");
const autoNextCheckbox = document.getElementById("auto-next");
const btnNextUnrated = document.getElementById("btn-next-unrated");
const btnShuffle = document.getElementById("btn-shuffle");
const btnAddCat = document.getElementById("btn-add-cat");

const rateImg = document.getElementById("rate-img");
const ratePhotoMeta = document.getElementById("rate-photo-meta");
const ratePhotoScore = document.getElementById("rate-photo-score");
const rateCounter = document.getElementById("rate-counter");
const rateSliders = document.getElementById("rate-sliders");
const btnRatePrev = document.getElementById("btn-rate-prev");
const btnRateNext = document.getElementById("btn-rate-next");

const rankingSortCats = document.getElementById("ranking-sort-cats");
const rankingGrid = document.getElementById("ranking-grid");
const rankingCount = document.getElementById("ranking-count");
const btnImport = document.getElementById("btn-import");
const csvImportInput = document.getElementById("csv-import-input");
const collabBanner = document.getElementById("collab-banner");
const collabLabel = document.getElementById("collab-label");
const btnToggleCollab = document.getElementById("btn-toggle-collab");
const btnClearCollab = document.getElementById("btn-clear-collab");
const btnExport = document.getElementById("btn-export");
const btnReset = document.getElementById("btn-reset");

const lightbox = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbInfo = document.getElementById("lb-info");
const lbClose = document.getElementById("lb-close");
const lbEdit = document.getElementById("lb-edit");

async function init() {
  const res = await fetch("photos.json");
  photos = await res.json();
  rankingCount.textContent = photos.length;

  rateOrder = photos.map((_, i) => i);
  shuffleArray(rateOrder);

  loadState();
  bindEvents();
  updateStats();
  renderRatePhoto();
  renderRankingSortButtons();
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) state = { ...state, ...parsed };
    }
  } catch (e) {
    console.warn("Could not load state:", e);
  }
  if (!Array.isArray(state.categories) || state.categories.length === 0) {
    state.categories = [...DEFAULT_CATEGORIES];
  } else {
    // Ensure core default categories can never stay missing
    for (const def of DEFAULT_CATEGORIES) {
      if (!state.categories.some((c) => c.id === def.id)) {
        state.categories.push({ ...def });
      }
    }
  }
  if (!state.stars) state.stars = {};
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save state:", e);
  }
}

function getEffectiveCatScore(photo, catId) {
  const mine = state.stars[photo.id]?.[catId];
  const hasMine = typeof mine === "number" && mine > 0;

  if (collabData && useCollabCombined) {
    const theirs = collabData.starsByFilename[photo.filename]?.[catId];
    const hasTheirs = typeof theirs === "number" && theirs > 0;
    if (hasMine && hasTheirs) return (mine + theirs) / 2;
    if (hasMine) return mine;
    if (hasTheirs) return theirs;
    return null;
  }
  return hasMine ? mine : null;
}

function getPhotoAvg(photo, useCollab = true) {
  const vals = state.categories
    .map((c) => (useCollab ? getEffectiveCatScore(photo, c.id) : state.stars[photo.id]?.[c.id]))
    .filter((v) => typeof v === "number" && v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function isPhotoFullyRated(photoId) {
  const photoStars = state.stars[photoId] || {};
  return state.categories.every((c) => photoStars[c.id] > 0);
}

function isPhotoRatedAny(photoId) {
  const photoStars = state.stars[photoId] || {};
  return state.categories.some((c) => photoStars[c.id] > 0);
}

function updateStats() {
  const ratedPhotos = photos.filter((p) => isPhotoRatedAny(p.id));
  statRated.textContent = ratedPhotos.length;

  const avgs = ratedPhotos.map((p) => getPhotoAvg(p, false)).filter((v) => v !== null);
  statAvg.textContent = avgs.length ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2) : "–";

  const pct = photos.length ? Math.round((ratedPhotos.length / photos.length) * 100) : 0;
  coveragePct.textContent = `${pct}%`;
  coverageFill.style.width = `${pct}%`;
}

function renderRatePhoto() {
  if (!photos.length) return;
  const p = photos[rateOrder[rateIndex]];
  rateImg.src = p.thumb;
  ratePhotoMeta.textContent = p.date ? `${p.filename} · ${p.date}` : p.filename;
  rateCounter.textContent = `${rateIndex + 1} / ${photos.length}`;

  const avg = getPhotoAvg(p, false);
  ratePhotoScore.textContent = avg !== null ? avg.toFixed(1) : "–";

  if (focusedCatIndex >= state.categories.length) focusedCatIndex = 0;
  const photoStars = state.stars[p.id] || {};

  rateSliders.innerHTML = state.categories
    .map((cat, idx) => {
      const val = photoStars[cat.id] || 0;
      const starsHtml = [1, 2, 3, 4, 5]
        .map(
          (n) =>
            `<button class="star-btn ${n <= val ? "active" : ""}" data-cat="${cat.id}" data-val="${n}" aria-label="${n} estrellas">★</button>`
        )
        .join("");
      return `
        <div class="rate-row ${idx === focusedCatIndex ? "focused" : ""}" data-cat-idx="${idx}">
          <div class="rate-row-left">
            <span class="rate-row-name">${cat.name}</span>
          </div>
          <div class="stars">${starsHtml}</div>
        </div>
      `;
    })
    .join("");
}

function setRating(catId, val) {
  const p = photos[rateOrder[rateIndex]];
  if (!state.stars[p.id]) state.stars[p.id] = {};

  const currentVal = state.stars[p.id][catId] || 0;
  if (val === 0 || currentVal === val) {
    delete state.stars[p.id][catId];
    saveState();
    updateStats();
    renderRatePhoto();
    return;
  }

  state.stars[p.id][catId] = val;
  saveState();
  updateStats();

  const catIdx = state.categories.findIndex((c) => c.id === catId);
  if (catIdx >= 0 && catIdx < state.categories.length - 1) {
    focusedCatIndex = catIdx + 1;
    renderRatePhoto();
  } else if (autoNextCheckbox.checked && isPhotoFullyRated(p.id)) {
    renderRatePhoto();
    setTimeout(() => {
      rateIndex = (rateIndex + 1) % photos.length;
      focusedCatIndex = 0;
      renderRatePhoto();
    }, 180);
  } else {
    renderRatePhoto();
  }
}

function jumpToNextUnrated() {
  for (let offset = 1; offset <= photos.length; offset++) {
    const idx = (rateIndex + offset) % photos.length;
    if (!isPhotoFullyRated(photos[rateOrder[idx]].id)) {
      rateIndex = idx;
      focusedCatIndex = 0;
      renderRatePhoto();
      return;
    }
  }
  alert("¡Ya calificaste las 204 fotos en todas las categorías!");
}

function renderRankingSortButtons() {
  rankingSortCats.innerHTML = [
    `<button class="btn btn-chip ${state.rankingSort === "global" ? "active" : ""}" data-sort="global">🌟 Promedio</button>`,
    ...state.categories.map(
      (cat) => `
        <button class="btn btn-chip ${state.rankingSort === cat.id ? "active" : ""}" data-sort="${cat.id}">
          ${cat.name}
        </button>
      `
    ),
  ].join("");
}

function getSortedRanking() {
  return [...photos]
    .map((p) => {
      const avg = getPhotoAvg(p, true);
      const sortScore =
        state.rankingSort === "global" ? avg : getEffectiveCatScore(p, state.rankingSort);
      const ratedCount = state.categories.filter((c) => getEffectiveCatScore(p, c.id) !== null).length;
      return { ...p, avg, sortScore, ratedCount };
    })
    .sort((a, b) => {
      const sa = a.sortScore ?? -1;
      const sb = b.sortScore ?? -1;
      if (sb !== sa) return sb - sa;
      const aa = a.avg ?? -1;
      const ab = b.avg ?? -1;
      if (ab !== aa) return ab - aa;
      return a.id - b.id;
    });
}

function renderRanking() {
  let list = getSortedRanking();
  if (rankingFilter === "rated") {
    list = list.filter((item) => item.avg !== null);
  } else if (rankingFilter !== "all") {
    list = list.slice(0, Number(rankingFilter));
  }

  rankingGrid.innerHTML = list
    .map((item, idx) => {
      const rank = idx + 1;
      const topClass = rank === 1 ? "top1" : rank === 2 ? "top2" : rank === 3 ? "top3" : "";
      const hasScore = item.sortScore !== null;
      return `
        <div class="rank-card" data-id="${item.id}">
          <div class="rank-thumb">
            <img src="${item.thumb}" alt="${item.filename}" loading="lazy" />
            <span class="rank-pos ${topClass}">#${rank}</span>
            <span class="rank-score ${hasScore ? "" : "unrated"}">
              ${hasScore ? `★ ${item.sortScore.toFixed(1)}` : "Sin nota"}
            </span>
          </div>
          <div class="rank-body">
            <div class="rank-title" title="${item.filename}">${item.filename}</div>
            <div class="rank-sub">
              <span>${item.date || "Sin fecha"}</span>
              <span>${item.ratedCount}/${state.categories.length} cat.</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function parseCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function handleCsvImport(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return;

    const headers = parseCsvLine(lines[0]);
    const fileIdx = headers.indexOf("Archivo");
    if (fileIdx === -1) {
      alert("El CSV no tiene la columna 'Archivo'. Asegúrate de usar un CSV exportado desde esta página.");
      return;
    }

    const catColMap = {};
    state.categories.forEach((c) => {
      const idx = headers.findIndex((h) => h.trim() === c.name.trim());
      if (idx >= 0) catColMap[c.id] = idx;
    });

    const starsByFilename = {};
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const fname = cols[fileIdx]?.trim();
      if (!fname) continue;
      starsByFilename[fname] = {};
      for (const [catId, colIdx] of Object.entries(catColMap)) {
        const val = parseFloat(cols[colIdx]);
        if (!isNaN(val) && val > 0) starsByFilename[fname][catId] = val;
      }
    }

    collabData = { name: file.name, starsByFilename };
    useCollabCombined = true;
    collabBanner.classList.remove("hidden");
    collabLabel.textContent = `👥 + ${file.name}`;
    btnToggleCollab.classList.add("active");
    btnToggleCollab.textContent = "Combinado";
    renderRanking();
  };
  reader.readAsText(file, "utf-8");
}

function exportCsv() {
  const sorted = getSortedRanking();
  const catHeaders = state.categories.map((c) => `"${c.name.replace(/"/g, '""')}"`);
  const header = ["Rank", "Archivo", "Fecha", "Promedio_Global", ...catHeaders];

  const rows = sorted.map((item, idx) => {
    const catScores = state.categories.map((c) => {
      const v = getEffectiveCatScore(item, c.id);
      return v !== null ? Number(v.toFixed(2)) : "";
    });
    return [
      idx + 1,
      `"${item.filename.replace(/"/g, '""')}"`,
      item.date || "",
      item.avg !== null ? item.avg.toFixed(2) : "",
      ...catScores,
    ];
  });

  const csvContent = "\uFEFF" + [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = collabData && useCollabCombined ? "Telefonos_Ranking_Combinado.csv" : "Telefonos_Calificaciones.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function switchView(viewName) {
  const isRate = viewName === "rate";
  viewRate.classList.toggle("active", isRate);
  viewRanking.classList.toggle("active", !isRate);
  tabRate.classList.toggle("active", isRate);
  tabRanking.classList.toggle("active", !isRate);

  if (isRate) {
    renderRatePhoto();
  } else {
    renderRankingSortButtons();
    renderRanking();
  }
}

function bindEvents() {
  tabRate.addEventListener("click", () => switchView("rate"));
  tabRanking.addEventListener("click", () => switchView("ranking"));

  btnNextUnrated.addEventListener("click", jumpToNextUnrated);
  btnShuffle.addEventListener("click", () => {
    shuffleArray(rateOrder);
    rateIndex = 0;
    focusedCatIndex = 0;
    renderRatePhoto();
  });

  btnAddCat.addEventListener("click", () => {
    const name = prompt("Nombre de la nueva categoría:");
    if (!name || !name.trim()) return;
    state.categories.push({ id: "cat_" + Date.now(), name: name.trim() });
    saveState();
    renderRatePhoto();
    renderRankingSortButtons();
  });

  rateSliders.addEventListener("click", (e) => {
    const delBtn = e.target.closest("[data-del-cat]");
    if (delBtn) {
      e.stopPropagation();
      const catId = delBtn.dataset.delCat;
      state.categories = state.categories.filter((c) => c.id !== catId);
      if (state.rankingSort === catId) state.rankingSort = "global";
      saveState();
      updateStats();
      renderRatePhoto();
      renderRankingSortButtons();
      return;
    }

    const starBtn = e.target.closest(".star-btn");
    if (starBtn) {
      setRating(starBtn.dataset.cat, Number(starBtn.dataset.val));
      return;
    }

    const row = e.target.closest(".rate-row");
    if (row) {
      focusedCatIndex = Number(row.dataset.catIdx);
      renderRatePhoto();
    }
  });

  btnRatePrev.addEventListener("click", () => {
    rateIndex = (rateIndex - 1 + photos.length) % photos.length;
    focusedCatIndex = 0;
    renderRatePhoto();
  });

  btnRateNext.addEventListener("click", () => {
    rateIndex = (rateIndex + 1) % photos.length;
    focusedCatIndex = 0;
    renderRatePhoto();
  });

  rankingSortCats.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sort]");
    if (!btn) return;
    state.rankingSort = btn.dataset.sort;
    saveState();
    renderRankingSortButtons();
    renderRanking();
  });

  document.querySelectorAll("[data-limit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-limit]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      rankingFilter = btn.dataset.limit;
      renderRanking();
    });
  });

  btnImport.addEventListener("click", () => csvImportInput.click());
  csvImportInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleCsvImport(file);
    csvImportInput.value = "";
  });

  btnToggleCollab.addEventListener("click", () => {
    useCollabCombined = !useCollabCombined;
    btnToggleCollab.classList.toggle("active", useCollabCombined);
    btnToggleCollab.textContent = useCollabCombined ? "Combinado" : "Solo mis notas";
    renderRanking();
  });

  btnClearCollab.addEventListener("click", () => {
    collabData = null;
    collabBanner.classList.add("hidden");
    renderRanking();
  });

  btnExport.addEventListener("click", exportCsv);
  btnReset.addEventListener("click", () => {
    if (confirm("¿Seguro que quieres borrar todas tus calificaciones y empezar desde cero?")) {
      state.stars = {};
      saveState();
      updateStats();
      renderRatePhoto();
      renderRanking();
    }
  });

  rankingGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".rank-card");
    if (!card) return;
    const id = Number(card.dataset.id);
    const sorted = getSortedRanking();
    const rankIdx = sorted.findIndex((p) => p.id === id);
    const item = sorted[rankIdx];
    if (!item) return;

    const catBreakdown = state.categories
      .map((c) => {
        const v = getEffectiveCatScore(item, c.id);
        return `${c.name}: ${v !== null ? v.toFixed(1) : "–"}`;
      })
      .join(" · ");

    lightboxPhotoId = item.id;
    lbImg.src = item.thumb;
    lbInfo.textContent = `#${rankIdx + 1} · ${item.filename}${item.date ? " (" + item.date + ")" : ""} · Promedio: ${item.avg !== null ? item.avg.toFixed(1) : "–"} | ${catBreakdown}`;
    lightbox.classList.remove("hidden");
  });

  lbEdit.addEventListener("click", () => {
    if (lightboxPhotoId === null) return;
    const idx = photos.findIndex((p) => p.id === lightboxPhotoId);
    if (idx >= 0) {
      const orderPos = rateOrder.indexOf(idx);
      rateIndex = orderPos >= 0 ? orderPos : 0;
      focusedCatIndex = 0;
    }
    lightbox.classList.add("hidden");
    switchView("rate");
  });

  lbClose.addEventListener("click", () => lightbox.classList.add("hidden"));
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) lightbox.classList.add("hidden");
  });

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("hidden")) {
      if (e.key === "Escape") lightbox.classList.add("hidden");
      return;
    }
    if (!viewRate.classList.contains("active")) return;

    if (e.key === "0" || e.key === "Backspace") {
      e.preventDefault();
      const cat = state.categories[focusedCatIndex];
      if (cat) setRating(cat.id, 0);
    } else if (e.key >= "1" && e.key <= "5") {
      e.preventDefault();
      const cat = state.categories[focusedCatIndex];
      if (cat) setRating(cat.id, Number(e.key));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusedCatIndex = (focusedCatIndex - 1 + state.categories.length) % state.categories.length;
      renderRatePhoto();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusedCatIndex = (focusedCatIndex + 1) % state.categories.length;
      renderRatePhoto();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      rateIndex = (rateIndex - 1 + photos.length) % photos.length;
      focusedCatIndex = 0;
      renderRatePhoto();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      rateIndex = (rateIndex + 1) % photos.length;
      focusedCatIndex = 0;
      renderRatePhoto();
    }
  });
}

init();
