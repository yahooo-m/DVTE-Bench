(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const themeToggle = document.querySelector("[data-theme-toggle]");
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const navLinks = document.querySelector("[data-nav-links]");
  const loadingStatus = document.querySelector("[data-loading-status]");
  const videos = Array.from(document.querySelectorAll("[data-preview-video]"));
  const sourceVideo = document.querySelector('[data-preview-video="source"]');
  const playToggle = document.querySelector("[data-play-toggle]");
  const restartButton = document.querySelector("[data-restart]");
  const timeline = document.querySelector("[data-timeline]");
  const currentTime = document.querySelector("[data-current-time]");
  const durationLabel = document.querySelector("[data-duration]");
  const PAGE_SIZE = 12;

  let benchmark;
  let activeCase;
  let previewFilter = "all";
  let resultTrack = "main";
  let resultType = "standard_subtitle";
  let catalogPage = 1;
  let filteredCatalog = [];
  let scrubbing = false;

  const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value);
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  };
  const titleCase = (value) => value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
  const refreshIcons = () => {
    if (window.lucide) window.lucide.createIcons();
  };
  const getTheme = () => {
    try {
      return localStorage.getItem("dvte-bench-theme");
    } catch {
      return null;
    }
  };
  const applyTheme = (theme) => {
    const dark = theme === "dark";
    root.dataset.theme = theme;
    themeToggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    themeToggle.setAttribute("title", dark ? "Use light theme" : "Use dark theme");
    themeToggle.querySelector("[data-lucide]").setAttribute("data-lucide", dark ? "sun" : "moon");
    document.querySelector('meta[name="theme-color"]').content = dark ? "#101317" : "#f4f6f8";
    refreshIcons();
  };

  applyTheme(getTheme() || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  themeToggle.addEventListener("click", () => {
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(theme);
    try {
      localStorage.setItem("dvte-bench-theme", theme);
    } catch {
      // Local storage may be unavailable in restricted browsing contexts.
    }
  });
  menuToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    body.classList.toggle("menu-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.querySelector("[data-lucide]").setAttribute("data-lucide", open ? "x" : "menu");
    refreshIcons();
  });
  navLinks.addEventListener("click", () => {
    navLinks.classList.remove("is-open");
    body.classList.remove("menu-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.querySelector("[data-lucide]").setAttribute("data-lucide", "menu");
    refreshIcons();
  });

  const setupReveal = () => {
    const revealItems = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    revealItems.forEach((item) => observer.observe(item));
  };

  const renderStats = () => {
    Object.entries(benchmark.stats).forEach(([key, value]) => {
      const element = document.querySelector(`[data-stat="${key}"]`);
      if (!element) return;
      element.textContent = typeof value === "number" && Number.isInteger(value)
        ? formatNumber(value)
        : value;
    });
    document.querySelector("[data-metadata-hash]").textContent = benchmark.integrity.metadataSha256;
  };

  const renderTaxonomy = () => {
    document.querySelector("[data-taxonomy-grid]").innerHTML = benchmark.categories
      .map((category) => `
        <article class="taxonomy-item">
          <span class="taxonomy-code">${category.short}</span>
          <h3>${category.label}</h3>
          <p>${category.description}</p>
          <span class="taxonomy-count">${formatNumber(category.count)} clips</span>
        </article>
      `).join("");
  };

  const formatMetric = (value, digits) => Number(value).toFixed(digits);
  const formatMaskPsnr = (metrics) => {
    const infinite = metrics.mask_psnr_infinite_samples;
    const suffix = infinite ? "†" : "";
    return `<span title="${infinite} infinite Mask-PSNR video${infinite === 1 ? "" : "s"}">${formatMetric(metrics.mask_psnr, 2)}${suffix}</span>`;
  };
  const bestValue = (records, field, direction) => (
    Math[direction](...records.map((record) => record.metrics[field]))
  );
  const metricCells = (metrics, best) => `
    <td class="${metrics.mask_psnr === best.mask_psnr ? "result-best" : ""}">${formatMaskPsnr(metrics)}</td>
    <td class="${metrics.mask_mae === best.mask_mae ? "result-best" : ""}">${formatMetric(metrics.mask_mae, 2)}</td>
    <td class="${metrics.mask_mse === best.mask_mse ? "result-best" : ""}">${formatMetric(metrics.mask_mse, 2)}</td>
    <td class="${metrics.mask_crop_ssim === best.mask_crop_ssim ? "result-best" : ""}">${formatMetric(metrics.mask_crop_ssim, 4)}</td>
  `;
  const renderResultTable = (target, records) => {
    const best = {
      mask_psnr: bestValue(records, "mask_psnr", "max"),
      mask_mae: bestValue(records, "mask_mae", "min"),
      mask_mse: bestValue(records, "mask_mse", "min"),
      mask_crop_ssim: bestValue(records, "mask_crop_ssim", "max"),
    };
    target.innerHTML = records
      .map(({ method, metrics }) => {
        return `
          <tr class="${method.id === "ours" ? "is-ours" : ""}">
            <td class="${method.id === "ours" ? "result-method" : ""}">${method.label}</td>
            <td>${formatNumber(metrics.samples)}</td>
            ${metricCells(metrics, best)}
          </tr>
        `;
      }).join("");
  };
  const updateResultTables = () => {
    const methods = benchmark.results.methods;
    const trackRecords = methods.map((method) => ({
      method,
      metrics: method.tracks[resultTrack],
    }));
    const typeRecords = methods.map((method) => ({
      method,
      metrics: method.byType[resultType],
    }));
    renderResultTable(document.querySelector("[data-results-overall]"), trackRecords);
    renderResultTable(document.querySelector("[data-results-by-type]"), typeRecords);
    const track = methods[0].tracks[resultTrack];
    document.querySelector("[data-result-configuration]").textContent =
      `${methods.length} completed methods · ${formatNumber(track.samples)} videos · GT mask region`;
  };
  const renderResults = () => {
    const methods = benchmark.results.methods;
    const trackSelect = document.querySelector("[data-results-track]");
    const typeSelect = document.querySelector("[data-results-type]");
    trackSelect.innerHTML = ["main", "seen"].map((trackId) => {
      const track = methods[0].tracks[trackId];
      return `<option value="${trackId}">${track.label} · ${track.samples}</option>`;
    }).join("");
    typeSelect.innerHTML = benchmark.categories.map((category) => {
      const count = methods[0].byType[category.id].samples;
      const suffix = category.id === "asr_subtitle" ? " · seen" : "";
      return `<option value="${category.id}">${category.label}${suffix} · ${count}</option>`;
    }).join("");
    trackSelect.value = resultTrack;
    typeSelect.value = resultType;
    trackSelect.addEventListener("change", () => {
      resultTrack = trackSelect.value;
      updateResultTables();
    });
    typeSelect.addEventListener("change", () => {
      resultType = typeSelect.value;
      updateResultTables();
    });
    updateResultTables();
  };

  const renderComposition = () => {
    const maximum = Math.max(...benchmark.categories.map((category) => category.count));
    document.querySelector("[data-category-bars]").innerHTML = benchmark.categories
      .map((category) => `
        <div class="bar-row">
          <span class="bar-label">${category.label}</span>
          <span class="bar-track">
            <span class="bar-fill" style="--bar-width:${(category.count / maximum) * 100}%"></span>
          </span>
          <span class="bar-value">${category.count}</span>
        </div>
      `).join("");
  };

  const renderFilterControls = () => {
    const container = document.querySelector("[data-preview-filters]");
    container.insertAdjacentHTML("beforeend", benchmark.categories.map((category) => `
      <button class="filter-button" type="button" role="tab" aria-selected="false"
        data-filter="${category.id}">${category.label}</button>
    `).join(""));
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      previewFilter = button.dataset.filter;
      container.querySelectorAll("[data-filter]").forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-selected", String(active));
      });
      renderPreviewGrid();
      const visible = benchmark.previews.filter((item) => (
        previewFilter === "all" || item.type === previewFilter
      ));
      if (!visible.includes(activeCase)) setActiveCase(visible[0]);
    });
  };

  const renderPreviewGrid = () => {
    const visible = benchmark.previews.filter((item) => (
      previewFilter === "all" || item.type === previewFilter
    ));
    document.querySelector("[data-preview-count]").textContent = visible.length;
    document.querySelector("[data-preview-grid]").innerHTML = visible.map((item) => {
      const index = benchmark.previews.indexOf(item) + 1;
      return `
        <button class="preview-card ${activeCase?.id === item.id ? "is-active" : ""}"
          type="button" data-preview-id="${item.id}">
          <span class="preview-thumb">
            <img src="${item.poster}" alt="" loading="lazy">
            <span class="preview-number">${String(index).padStart(2, "0")}</span>
          </span>
          <span class="preview-card-copy">
            <strong>${item.label}</strong>
            <span>${titleCase(item.orientation)} · ${item.language.toUpperCase()} · ${item.duration.toFixed(1)}s</span>
          </span>
        </button>
      `;
    }).join("");
  };

  document.querySelector("[data-preview-grid]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-preview-id]");
    if (!button) return;
    setActiveCase(benchmark.previews.find((item) => item.id === button.dataset.previewId));
    document.querySelector("[data-comparison-tool]").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const categoryFor = (item) => benchmark.categories.find((category) => category.id === item.type);
  const updatePlayIcon = () => {
    const playing = !sourceVideo.paused;
    const icon = playToggle.querySelector("[data-lucide]");
    icon.setAttribute("data-lucide", playing ? "pause" : "play");
    playToggle.setAttribute("aria-label", playing ? "Pause synchronized preview" : "Play synchronized preview");
    playToggle.setAttribute("title", playing ? "Pause" : "Play");
    refreshIcons();
  };
  const pauseAll = () => videos.forEach((video) => video.pause());
  const playAll = async () => {
    await Promise.all(videos.map((video) => video.play().catch(() => undefined)));
    updatePlayIcon();
  };
  const seekAll = (time) => videos.forEach((video) => {
    if (Number.isFinite(video.duration)) video.currentTime = Math.min(time, video.duration);
  });
  const setActiveCase = (item) => {
    if (!item) return;
    activeCase = item;
    pauseAll();
    videos.forEach((video) => {
      const kind = video.dataset.previewVideo;
      video.src = item[kind];
      video.poster = item[`${kind}Poster`];
      video.load();
    });
    const category = categoryFor(item);
    document.querySelector("[data-case-kicker]").textContent =
      `${category.label} · ${titleCase(item.orientation)} · ${item.language.toUpperCase()}`;
    document.querySelector("[data-case-title]").textContent = item.id;
    document.querySelector("[data-case-text]").textContent =
      item.text || "No transcript text is attached to this record.";
    document.querySelector("[data-case-meta]").innerHTML = `
      <div><dt>Resolution</dt><dd>${item.width} × ${item.height}</dd></div>
      <div><dt>Duration</dt><dd>${item.duration.toFixed(2)} s</dd></div>
      <div><dt>Frame rate</dt><dd>${item.fps.toFixed(2)} fps</dd></div>
      <div><dt>Text regions</dt><dd>${item.overlays}</dd></div>
      <div><dt>Track</dt><dd>${item.seen ? "ASR seen regression" : "Main synthetic"}</dd></div>
      <div><dt>Target audit</dt><dd>${titleCase(item.ocrStatus)}</dd></div>
    `;
    const index = benchmark.previews.indexOf(item) + 1;
    document.querySelector("[data-active-index]").textContent =
      `${String(index).padStart(2, "0")} / ${benchmark.previews.length}`;
    timeline.value = 0;
    currentTime.textContent = "0:00";
    durationLabel.textContent = formatTime(item.duration);
    renderPreviewGrid();
    updatePlayIcon();
  };

  playToggle.addEventListener("click", () => {
    if (sourceVideo.paused) playAll();
    else {
      pauseAll();
      updatePlayIcon();
    }
  });
  restartButton.addEventListener("click", () => {
    seekAll(0);
    timeline.value = 0;
    currentTime.textContent = "0:00";
    playAll();
  });
  timeline.addEventListener("pointerdown", () => { scrubbing = true; });
  timeline.addEventListener("pointerup", () => { scrubbing = false; });
  timeline.addEventListener("input", () => {
    const duration = Number.isFinite(sourceVideo.duration) ? sourceVideo.duration : activeCase.duration;
    const time = (Number(timeline.value) / 1000) * duration;
    seekAll(time);
    currentTime.textContent = formatTime(time);
  });
  sourceVideo.addEventListener("loadedmetadata", () => {
    durationLabel.textContent = formatTime(sourceVideo.duration);
  });
  sourceVideo.addEventListener("timeupdate", () => {
    if (scrubbing || !Number.isFinite(sourceVideo.duration)) return;
    timeline.value = Math.round((sourceVideo.currentTime / sourceVideo.duration) * 1000);
    currentTime.textContent = formatTime(sourceVideo.currentTime);
    videos.slice(1).forEach((video) => {
      if (Math.abs(video.currentTime - sourceVideo.currentTime) > 0.12) {
        video.currentTime = sourceVideo.currentTime;
      }
    });
  });
  sourceVideo.addEventListener("play", updatePlayIcon);
  sourceVideo.addEventListener("pause", updatePlayIcon);
  sourceVideo.addEventListener("ended", () => {
    seekAll(0);
    playAll();
  });

  const catalogSearch = document.querySelector("[data-catalog-search]");
  const catalogType = document.querySelector("[data-catalog-type]");
  const catalogOrientation = document.querySelector("[data-catalog-orientation]");
  const catalogTrack = document.querySelector("[data-catalog-track]");
  const previousPage = document.querySelector("[data-page-prev]");
  const nextPage = document.querySelector("[data-page-next]");
  const renderCatalog = () => {
    const query = catalogSearch.value.trim().toLocaleLowerCase();
    filteredCatalog = benchmark.items.filter((item) => {
      const searchText = `${item.id} ${item.type} ${item.language} ${item.text}`.toLocaleLowerCase();
      return (!query || searchText.includes(query))
        && (catalogType.value === "all" || item.type === catalogType.value)
        && (catalogOrientation.value === "all" || item.orientation === catalogOrientation.value)
        && (catalogTrack.value === "all" || item.track === catalogTrack.value);
    });
    const pages = Math.max(1, Math.ceil(filteredCatalog.length / PAGE_SIZE));
    catalogPage = Math.min(catalogPage, pages);
    const start = (catalogPage - 1) * PAGE_SIZE;
    const pageItems = filteredCatalog.slice(start, start + PAGE_SIZE);
    document.querySelector("[data-catalog-body]").innerHTML = pageItems.map((item) => `
      <tr>
        <td title="${item.id}">${item.id}</td>
        <td>${categoryFor(item).label}</td>
        <td>${item.language.toUpperCase()}</td>
        <td>${titleCase(item.orientation)} · ${item.width}×${item.height}</td>
        <td>${item.duration.toFixed(2)} s</td>
        <td>${item.overlays}</td>
        <td><span class="track-chip ${item.seen ? "seen" : ""}">${item.seen ? "Seen regression" : "Main"}</span></td>
      </tr>
    `).join("");
    document.querySelector("[data-catalog-count]").textContent =
      `${formatNumber(filteredCatalog.length)} records`;
    document.querySelector("[data-page-label]").textContent = `Page ${catalogPage} of ${pages}`;
    previousPage.disabled = catalogPage <= 1;
    nextPage.disabled = catalogPage >= pages;
  };

  const resetAndRenderCatalog = () => {
    catalogPage = 1;
    renderCatalog();
  };
  catalogSearch.addEventListener("input", resetAndRenderCatalog);
  [catalogType, catalogOrientation, catalogTrack].forEach((select) => {
    select.addEventListener("change", resetAndRenderCatalog);
  });
  previousPage.addEventListener("click", () => {
    if (catalogPage > 1) {
      catalogPage -= 1;
      renderCatalog();
    }
  });
  nextPage.addEventListener("click", () => {
    const pages = Math.ceil(filteredCatalog.length / PAGE_SIZE);
    if (catalogPage < pages) {
      catalogPage += 1;
      renderCatalog();
    }
  });

  const populateCatalogTypes = () => {
    catalogType.insertAdjacentHTML("beforeend", benchmark.categories.map((category) => (
      `<option value="${category.id}">${category.label}</option>`
    )).join(""));
  };

  const setupActiveNavigation = () => {
    const sections = Array.from(document.querySelectorAll("main section[id]"));
    const links = Array.from(navLinks.querySelectorAll("a"));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => {
        link.classList.toggle("is-active", link.hash === `#${visible.target.id}`);
      });
    }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.2, 0.6] });
    sections.forEach((section) => observer.observe(section));
  };

  const initialize = async () => {
    try {
      const response = await fetch("data/benchmark.json");
      if (!response.ok) throw new Error(`Manifest request failed: ${response.status}`);
      benchmark = await response.json();
      renderStats();
      renderTaxonomy();
      renderResults();
      renderComposition();
      renderFilterControls();
      populateCatalogTypes();
      setActiveCase(benchmark.previews[0]);
      renderCatalog();
      setupReveal();
      setupActiveNavigation();
      refreshIcons();
      loadingStatus.hidden = true;
    } catch (error) {
      loadingStatus.textContent = "Could not load the benchmark manifest.";
      loadingStatus.title = error.message;
      document.querySelectorAll(".reveal").forEach((item) => item.classList.add("is-visible"));
    }
  };

  initialize();
})();
