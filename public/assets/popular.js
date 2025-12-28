// public/assets/popular.js
// =========================================================
// [UI] Popüler Maçlar
// - /api/popular endpoint’inden 5 maç çeker
// - 30 sn’de bir yeniler
// - Canlıysa skor + dakika, değilse saat gösterir
// =========================================================

(function () {
  const root = document.getElementById("popularList");
  const meta = document.getElementById("popularMeta");

  if (!root) return;

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function pillText(m) {
    if (m.isLive) return `${m.minute ?? ""}'`;
    return m.timeTR || "";
  }

  function scoreText(m) {
    const h = m?.score?.home;
    const a = m?.score?.away;
    if (typeof h === "number" && typeof a === "number") return `${h} - ${a}`;
    return "VS";
  }

  function logoImg(url, alt) {
    // logo yoksa küçük placeholder (CSS ile de destekleyebilirsin)
    const safe = esc(url || "");
    if (!safe) {
      return `<span class="pm-logo pm-logo--empty" aria-label="${esc(alt)}"></span>`;
    }
    return `<img class="pm-logo" src="${safe}" alt="${esc(alt)}" loading="lazy" />`;
  }

  function render(list) {
    root.innerHTML = list.map((m) => {
      const league = esc(m.league || "");
      const homeName = esc(m.home?.name || "");
      const awayName = esc(m.away?.name || "");
      const score = esc(scoreText(m));
      const pill = esc(pillText(m));

      return `
        <!-- [POPULAR_MATCH_ITEM] Tek maç satırı -->
        <div class="pm-item">
          <div class="pm-left">
            <div class="pm-league">${league}</div>

            <div class="pm-teams">
              <div class="pm-team">
                ${logoImg(m.home?.crest, homeName)}
                <span class="pm-name">${homeName}</span>
              </div>

              <div class="pm-mid">
                <span class="pm-score">${score}</span>
              </div>

              <div class="pm-team pm-team--right">
                <span class="pm-name">${awayName}</span>
                ${logoImg(m.away?.crest, awayName)}
              </div>
            </div>
          </div>

          <div class="pm-right">
            <span class="pm-pill ${m.isLive ? "pm-pill--live" : ""}">${pill}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  async function load() {
    try {
      if (meta) meta.textContent = "Güncelleniyor…";
      const r = await fetch("/api/popular", { cache: "no-store" });
      const j = await r.json();

      if (!j.ok) throw new Error(j.error || "API hata");

      render(Array.isArray(j.matches) ? j.matches : []);

      if (meta) {
        const t = new Date(j.updatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        meta.textContent = `Canlı / popüler • ${t}`;
      }
    } catch (e) {
      if (meta) meta.textContent = "Şu an veri yok";
      // UI’yi bozmayalım
      root.innerHTML = `
        <div class="pm-empty">
          Popüler maçlar yüklenemedi.
        </div>
      `;
    }
  }

  load();
  setInterval(load, 30000);
})();
