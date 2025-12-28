/* =========================================================
   [POPULAR MATCHES]
   - Sağ panelde “Popüler Maçlar” şeridini doldurur
   - Varsayılan kaynak: /popular.json  (public/popular.json)
   - İstersen sonra /api/popular gibi bir endpoint’e çevirirsin
   ========================================================= */
(() => {
  const ROOT_ID = "popularMatches";
  const STATUS_ID = "popularStatus";

  // 1) En kolay: statik dosya
  const FALLBACK_URL = "/popular.json";

  // 2) Sonradan API’ye bağlamak istersen aç:
  const API_URL = "/api/popular"; // yoksa otomatik fallback'e düşer

  // Kaç saniyede bir yenilensin (30sn iyi)
  const REFRESH_MS = 30_000;

  // Logo yoksa kırık gözükmesin diye küçük placeholder
  const LOGO_PH =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Crect width='100%25' height='100%25' rx='6' ry='6' fill='rgba(255,255,255,0.10)'/%3E%3C/svg%3E";

  const $ = (id) => document.getElementById(id);

  function fmtMinute(m) {
    if (m === null || m === undefined || m === "") return "";
    const n = Number(m);
    if (Number.isFinite(n)) return `${n}'`;
    return String(m);
  }

  async function tryFetch(url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function fetchPopularMatches() {
    // Önce API dene (varsa)
    const api = await tryFetch(API_URL);
    if (api) {
      // { matches: [...] } veya direkt [...]
      const arr = Array.isArray(api.matches) ? api.matches : (Array.isArray(api) ? api : []);
      if (arr.length) return arr;
    }

    // Sonra statik dosyaya düş
    const fb = await tryFetch(FALLBACK_URL);
    if (!fb) return [];
    return Array.isArray(fb.matches) ? fb.matches : (Array.isArray(fb) ? fb : []);
  }

  function render(matches) {
    const root = $(ROOT_ID);
    if (!root) return;

    root.innerHTML = "";

    if (!matches || matches.length === 0) {
      root.innerHTML = `<div class="popular-empty">Şu an gösterilecek maç yok.</div>`;
      return;
    }

    matches.slice(0, 10).forEach((m) => {
      const homeName = m?.home?.name || m?.homeName || "Home";
      const awayName = m?.away?.name || m?.awayName || "Away";
      const homeLogo = m?.home?.logo || m?.homeLogo || LOGO_PH;
      const awayLogo = m?.away?.logo || m?.awayLogo || LOGO_PH;

      const sh = (m?.score?.home ?? m?.homeScore ?? "");
      const sa = (m?.score?.away ?? m?.awayScore ?? "");

      // Skor yoksa status yaz
      const scoreText =
        (sh !== "" && sa !== "") ? `${sh} - ${sa}` : (m?.status || "LIVE");

      const minuteText = fmtMinute(m?.minute ?? m?.elapsed ?? "");

      const url = m?.url || "#";

      const card = document.createElement("a");
      card.className = "pop-card";
      card.href = url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";

      card.innerHTML = `
        <!-- Üst: Takımlar -->
        <div class="pop-teams">
          <div class="pop-team">
            <img class="pop-logo" src="${homeLogo}" alt="" onerror="this.src='${LOGO_PH}'">
            <span class="pop-name" title="${homeName}">${homeName}</span>
          </div>

          <span class="pop-vs">vs</span>

          <div class="pop-team">
            <img class="pop-logo" src="${awayLogo}" alt="" onerror="this.src='${LOGO_PH}'">
            <span class="pop-name" title="${awayName}">${awayName}</span>
          </div>
        </div>

        <!-- Alt: Skor + Dakika -->
        <div class="pop-bottom">
          <span class="pop-score">${scoreText}</span>
          ${minuteText ? `<span class="pop-minute">${minuteText}</span>` : ``}
        </div>
      `;

      root.appendChild(card);
    });
  }

  async function tick() {
    const s = $(STATUS_ID);
    if (s) s.textContent = "Güncelleniyor…";

    const matches = await fetchPopularMatches();
    render(matches);

    if (s) s.textContent = matches.length ? "Canlı / popüler" : "Veri yok";
  }

  document.addEventListener("DOMContentLoaded", () => {
    tick();
    setInterval(tick, REFRESH_MS);
  });
})();

