// public/assets/standings.js
// =========================================================
// [UI] Puan Durumu Widget
// - /api/standings?code=PL üzerinden puan tablosunu çeker
// - Üstten lig seçimi
// - İlk başta ilk 5 takım
// - Ok tıklanınca tam tablo (expanded)
// =========================================================

(function () {
  const card = document.getElementById("standingsCard");
  const meta = document.getElementById("standingsMeta");
  const sel  = document.getElementById("leagueSelect");
  const tbl  = document.getElementById("standingsTable");
  const tog  = document.getElementById("standingsToggle");

  if (!card || !sel || !tbl || !tog) return;

  // Lig listesi (football-data free listene göre)
  // Not: Süper Lig kodu token paketinde olmayabilir, hata mesajı gösterilecek.
  const LEAGUES = [
    { code: "PL",  name: "İngiltere • Premier League" },
    { code: "SA",  name: "İtalya • Serie A" },
    { code: "PD",  name: "İspanya • LaLiga" },
    { code: "BL1", name: "Almanya • Bundesliga" },
    { code: "FL1", name: "Fransa • Ligue 1" },
    { code: "PPL", name: "Portekiz • Primeira Liga" },
    { code: "DED", name: "Hollanda • Eredivisie" },

    // Türkiye (plan izin vermezse “pakette yok” mesajı çıkar)
    { code: "TSL", name: "Türkiye • Süper Lig" }
  ];

  // Persist (son seçilen lig + açık/kapalı)
  const LS_KEY_LEAGUE = "hopgoal_league_code";
  const LS_KEY_EXPAND = "hopgoal_standings_expand";

  function esc(s){
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function setExpanded(expanded){
    card.classList.toggle("expanded", !!expanded);
    localStorage.setItem(LS_KEY_EXPAND, expanded ? "1" : "0");
    renderCurrent(); // aynı veriyi farklı sayıda satırla bas
  }

  let current = null; // son gelen API datası

  function renderTable(rows){
    const expanded = card.classList.contains("expanded");
    const showRows = expanded ? rows : rows.slice(0, 5);

    // Başlık + satırlar
    let html = `
      <thead>
        <tr>
          <th>#</th>
          <th>Takım</th>
          <th>O</th>
          <th>G</th>
          <th>B</th>
          <th>M</th>
          <th>AV</th>
          <th>P</th>
        </tr>
      </thead>
      <tbody>
    `;

    for (const r of showRows) {
      const crest = r.crest ? `<img class="standings-crest" src="${esc(r.crest)}" alt="${esc(r.team)}" loading="lazy">` : "";
      html += `
        <tr>
          <td>${esc(r.pos)}</td>
          <td>
            <div class="standings-team">
              ${crest}
              <span>${esc(r.team)}</span>
            </div>
          </td>
          <td>${esc(r.played)}</td>
          <td>${esc(r.won)}</td>
          <td>${esc(r.draw)}</td>
          <td>${esc(r.lost)}</td>
          <td>${esc(r.gd)}</td>
          <td><b>${esc(r.pts)}</b></td>
        </tr>
      `;
    }

    html += `</tbody>`;
    tbl.innerHTML = html;
  }

  function renderError(msg){
    tbl.innerHTML = `
      <tbody>
        <tr>
          <td style="padding:10px;color:rgba(255,255,255,.75)">
            ${esc(msg)}
          </td>
        </tr>
      </tbody>
    `;
  }

  function renderCurrent(){
    if (!current) return;
    if (!current.ok) {
      renderError(current.error || "Puan durumu alınamadı.");
      return;
    }
    renderTable(Array.isArray(current.rows) ? current.rows : []);
  }

  async function loadStandings(code){
    try{
      if (meta) meta.textContent = "Güncelleniyor…";
      const r = await fetch(`/api/standings?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const j = await r.json();

      current = j;

      if (!j.ok) {
        if (meta) meta.textContent = "Şu an veri yok";
        renderCurrent();
        return;
      }

      const t = new Date(j.updatedAt).toLocaleTimeString("tr-TR", { hour:"2-digit", minute:"2-digit" });
      if (meta) meta.textContent = `${j.competition?.name || code} • ${t}`;

      renderCurrent();
    } catch(e){
      current = { ok:false, error:"Puan durumu yüklenemedi (network)." };
      if (meta) meta.textContent = "Şu an veri yok";
      renderCurrent();
    }
  }

  // Dropdown doldur
  function initSelect(){
    sel.innerHTML = LEAGUES.map(l => `<option value="${esc(l.code)}">${esc(l.name)}</option>`).join("");

    const saved = localStorage.getItem(LS_KEY_LEAGUE);
    const startCode = saved || "PL";
    sel.value = startCode;

    sel.addEventListener("change", () => {
      localStorage.setItem(LS_KEY_LEAGUE, sel.value);
      loadStandings(sel.value);
    });
  }

  // Toggle
  tog.addEventListener("click", () => {
    const expanded = !card.classList.contains("expanded");
    setExpanded(expanded);
  });

  initSelect();

  // Başlangıç expanded durumu
  const savedExpand = localStorage.getItem(LS_KEY_EXPAND);
  setExpanded(savedExpand === "1");

  // İlk yükleme
  loadStandings(sel.value);

  // 60 sn’de bir yenile (istersen 30 yaparsın)
  setInterval(() => loadStandings(sel.value), 60000);
})();
