// public/assets/standings.js
// =========================================================
// [UI] Puan Durumu Widget
// - /api/standings?code=PL üzerinden puan tablosunu çeker
// - Üstten lig seçimi
// - İlk başta ilk 5 takım
// - Ok tıklanınca tam tablo
// =========================================================

(function () {
  const card = document.getElementById("standingsCard");
  const meta = document.getElementById("standingsMeta");
  const sel  = document.getElementById("leagueSelect");
  const tbl  = document.getElementById("standingsTable");
  const tog  = document.getElementById("standingsToggle");

  if (!card || !sel || !tbl) return;

  const LEAGUES = [
    { code: "TR",  name: "Türkiye • Süper Lig" },

    { code: "PL",  name: "İngiltere • Premier League" },
    { code: "PD",  name: "İspanya • LaLiga" },
    { code: "SA",  name: "İtalya • Serie A" },
    { code: "BL1", name: "Almanya • Bundesliga" },
    { code: "FL1", name: "Fransa • Ligue 1" },
    { code: "PPL", name: "Portekiz • Primeira Liga" },
    { code: "DED", name: "Hollanda • Eredivisie" },
  ];

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
    renderCurrent();
  }

  let current = null;

  function renderTable(rows){
    const expanded = card.classList.contains("expanded");
    const showRows = expanded ? rows : rows.slice(0, 5);

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
      const crest = esc(r.crest || "");
      const team  = esc(r.team || "");
      html += `
        <tr>
          <td class="st-pos">${esc(r.pos)}</td>
          <td class="st-team">
            ${crest ? `<img class="st-crest" src="${crest}" alt="${team}" loading="lazy">` : `<span class="st-crest st-crest--empty"></span>`}
            <span class="st-teamname">${team}</span>
          </td>
          <td>${esc(r.played)}</td>
          <td>${esc(r.won)}</td>
          <td>${esc(r.draw)}</td>
          <td>${esc(r.lost)}</td>
          <td>${esc(r.gd)}</td>
          <td class="st-pts">${esc(r.pts)}</td>
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
          <td class="st-error">${esc(msg)}</td>
        </tr>
      </tbody>
    `;
  }

  function renderCurrent(){
    if (!current || !current.ok) {
      renderError(current?.error || "Şu an veri yok");
      return;
    }
    renderTable(Array.isArray(current.rows) ? current.rows : []);
  }

  async function loadStandings(code){
    try{
      if (meta) meta.textContent = "Güncelleniyor…";

      // 1) API dene
      const apiUrl = `/api/standings?code=${encodeURIComponent(code)}`;
      let r = await fetch(apiUrl, { cache: "no-store" });
      let j = await r.json();
      current = j;

      // 2) TR için API boşsa local fallback
      if ((!j.ok || !Array.isArray(j.rows) || j.rows.length === 0) && code === "TR") {
        try {
          const r2 = await fetch(`/data/standings-tr.json`, { cache: "no-store" });
          const j2 = await r2.json();
          if (j2 && j2.ok) current = j2;
        } catch(_) {}
      }

      if (!current.ok) {
        if (meta) meta.textContent = "Şu an veri yok";
        renderCurrent();
        return;
      }

      const t = new Date(current.updatedAt).toLocaleTimeString("tr-TR", { hour:"2-digit", minute:"2-digit" });
      if (meta) meta.textContent = `${current.competition?.name || code} • ${t}`;

      renderCurrent();
    } catch(e){
      current = { ok:false, error:"Puan durumu yüklenemedi (network)." };
      if (meta) meta.textContent = "Şu an veri yok";
      renderCurrent();
    }
  }

  function initSelect(){
    sel.innerHTML = LEAGUES.map(l => `<option value="${esc(l.code)}">${esc(l.name)}</option>`).join("");

    const saved = localStorage.getItem(LS_KEY_LEAGUE);
    const startCode = saved || "TR";
    if (LEAGUES.some(l => l.code === startCode)) sel.value = startCode;

    sel.addEventListener("change", () => {
      localStorage.setItem(LS_KEY_LEAGUE, sel.value);
      loadStandings(sel.value);
    });
  }

  if (tog) {
    tog.addEventListener("click", () => {
      const expanded = card.classList.contains("expanded");
      setExpanded(!expanded);
    });
  }

  initSelect();

  const savedExpand = localStorage.getItem(LS_KEY_EXPAND);
  setExpanded(savedExpand === "1");

  loadStandings(sel.value);
  setInterval(() => loadStandings(sel.value), 60000);
})();
