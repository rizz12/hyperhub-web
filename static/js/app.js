// static/js/app.js
(() => {
  const API = {
    price: "/api/price",
    news: "/api/news",
    sentiment: "/api/sentiment",
    whales: "/api/whales",
    oi: "/api/oi",
    governance: "/api/governance",
    health: "/api/health"
  };

  // Utility
  function fmtUSD(v) {
    if (v === null || v === undefined) return "--";
    if (v >= 1e9) return "$" + (v/1e9).toFixed(2) + "B";
    if (v >= 1e6) return "$" + (v/1e6).toFixed(2) + "M";
    if (v >= 1e3) return "$" + (v/1e3).toFixed(2) + "K";
    return "$" + Number(v).toFixed(2);
  }
  function fmtNum(v) {
    if (v === null || v === undefined) return "--";
    return Number(v).toLocaleString();
  }

  // DOM refs
  const hypePriceEl = document.getElementById("hypePrice");
  const hypeChangeEl = document.getElementById("hypeChange");
  const cardPriceEl = document.getElementById("cardPrice");
  const cardVolumeEl = document.getElementById("cardVolume");
  const cardMarketCapEl = document.getElementById("cardMarketCap");
  const lastUpdatedEl = document.getElementById("lastUpdated");
  const newsListEl = document.getElementById("newsList");
  const whaleListEl = document.getElementById("whaleList");
  const oiLatestEl = document.getElementById("oiLatest");
  const govSnapshotEl = document.getElementById("govSnapshot");
  const sentimentScoreEl = document.getElementById("sentimentScore");

  // Charts
  let sentimentChart = null;
  let oiChart = null;
  let cbbiGauge = null;
  let sentimentPie = null;
  let whalesBar = null;
  let oiLine = null;
  let cbbiChart = null;

  // Initialize charts
  function initCharts() {
    const sCtx = document.getElementById("sentimentChart").getContext("2d");
    sentimentChart = new Chart(sCtx, {
      type: "doughnut",
      data: { labels: ["Bullish","Bearish"], datasets: [{ data: [50,50], backgroundColor: ["#00FF7F","#FF0033"] }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
    });

    const oiCtx = document.getElementById("oiChart").getContext("2d");
    oiChart = new Chart(oiCtx, {
      type: "bar",
      data: { labels: [], datasets: [{ label: "Longs", data: [], backgroundColor: "#00FF7F" }, { label: "Shorts", data: [], backgroundColor: "#FF0033" }] },
      options: { responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true}} }
    });

    // CBBI gauge as doughnut
    const cbbiCtx = document.getElementById("cbbiGauge").getContext("2d");
    cbbiGauge = new Chart(cbbiCtx, {
      type: "doughnut",
      data: { labels: ["Index","Remaining"], datasets: [{ data: [60,40], backgroundColor: ["#00FF7F","#222"] }] },
      options: { rotation: -90 * Math.PI/180, circumference: 180 * Math.PI/180, cutout: "70%", plugins:{legend:{display:false}} }
    });

    // Analytics charts
    const sentimentPieCtx = document.getElementById("sentimentPie").getContext("2d");
    sentimentPie = new Chart(sentimentPieCtx, {
      type: "pie",
      data: { labels: ["Positive","Negative"], datasets: [{ data: [60,40], backgroundColor: ["#00FF7F","#FF0033"] }] },
      options: { responsive:true, maintainAspectRatio:false }
    });

    const whalesBarCtx = document.getElementById("whalesBar").getContext("2d");
    whalesBar = new Chart(whalesBarCtx, {
      type: "bar",
      data: { labels: [], datasets: [{ label: "Whale USD", data: [], backgroundColor: "#00CC66" }] },
      options: { responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true}} }
    });

    const oiLineCtx = document.getElementById("oiLine").getContext("2d");
    oiLine = new Chart(oiLineCtx, {
      type: "line",
      data: { labels: [], datasets: [{ label: "OI", data: [], borderColor: "#00FF7F", fill:false }] },
      options: { responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true}} }
    });

    const cbbiChartCtx = document.getElementById("cbbiChart").getContext("2d");
    cbbiChart = new Chart(cbbiChartCtx, {
      type: "bar",
      data: { labels: ["Sentiment","Whales","OI"], datasets: [{ label: "Components", data: [50,50,50], backgroundColor: ["#00FF7F","#00CC66","#FF0033"] }] },
      options: { responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true, max:100}} }
    });
  }

  // Fetch and update functions
  async function fetchPrice() {
    try {
      const res = await fetch(API.price + "?id=hyperliquid");
      const data = await res.json();
      const price = data.price || data.current_price || 0;
      const change = data.change_24h || data.price_change_percentage_24h || 0;
      const vol = data.volume_24h || data.total_volume || 0;
      const mcap = data.market_cap || 0;
      hypePriceEl.textContent = price ? `$${Number(price).toFixed(4)}` : "--";
      cardPriceEl.textContent = price ? `$${Number(price).toFixed(4)}` : "--";
      cardVolumeEl.textContent = fmtUSD(vol);
      cardMarketCapEl.textContent = fmtUSD(mcap);
      hypeChangeEl.textContent = (change >= 0 ? "+" : "") + (change ? change.toFixed(2) + "%" : "--");
      hypeChangeEl.className = change >= 0 ? "tag-green" : "tag-red";
      lastUpdatedEl.textContent = new Date().toLocaleTimeString();
    } catch (e) {
      console.warn("fetchPrice error", e);
    }
  }

  async function fetchNews() {
    try {
      const res = await fetch(API.news);
      const data = await res.json();
      const items = data.items || [];
      newsListEl.innerHTML = "";
      if (items.length === 0) {
        newsListEl.innerHTML = '<div class="muted text-sm">No news available</div>';
        return;
      }
      items.slice(0,8).forEach(it => {
        const el = document.createElement("div");
        el.className = "mb-2";
        el.innerHTML = `<a href="${it.link}" target="_blank" class="text-sm text-[#00FF7F]">${it.title}</a><div class="muted text-xs">${it.source} · ${it.pubDate}</div>`;
        newsListEl.appendChild(el);
      });
    } catch (e) {
      console.warn("fetchNews error", e);
    }
  }

  async function fetchSentiment() {
    try {
      const res = await fetch(API.sentiment);
      const data = await res.json();
      const score = data.sentiment_score || 50;
      sentimentScoreEl.textContent = score;
      // Update sentiment chart (doughnut)
      const pos = Math.max(0, score);
      const neg = Math.max(0, 100 - score);
      if (sentimentChart) {
        sentimentChart.data.datasets[0].data = [pos, neg];
        sentimentChart.update();
      }
      if (sentimentPie) {
        sentimentPie.data.datasets[0].data = [pos, neg];
        sentimentPie.update();
      }
      // Update CBBI sentiment component
      document.getElementById("cbbiSent").textContent = score;
      // Recompute CBBI overall after fetching whales and oi
      computeCBBI();
    } catch (e) {
      console.warn("fetchSentiment error", e);
    }
  }

  async function fetchWhales() {
    try {
      const res = await fetch(API.whales);
      const data = await res.json();
      const whales = data.whales || [];
      whaleListEl.innerHTML = "";
      if (whales.length === 0) {
        whaleListEl.innerHTML = '<div class="muted text-sm">No whale activity</div>';
      } else {
        whales.slice(0,6).forEach(w => {
          const el = document.createElement("div");
          el.className = "mb-2";
          el.innerHTML = `<div class="flex justify-between"><div class="text-sm">${w.pair} · ${w.side}</div><div class="text-sm muted">${fmtUSD(w.size_usd)}</div></div><div class="muted text-xs">${new Date(w.time).toLocaleString()}</div>`;
          whaleListEl.appendChild(el);
        });
      }
      // Update whales bar chart
      if (whalesBar) {
        whalesBar.data.labels = whales.map(w => w.pair);
        whalesBar.data.datasets[0].data = whales.map(w => w.size_usd);
        whalesBar.update();
      }
      // Update CBBI whales component (simple normalized)
      const totalWhaleVol = whales.reduce((s,w)=>s+(w.size_usd||0),0);
      const whalesScore = Math.max(0, Math.min(100, Math.round(100 - Math.log10(1 + totalWhaleVol) * 10))); // heuristic
      document.getElementById("cbbiWhales").textContent = whalesScore;
      computeCBBI();
    } catch (e) {
      console.warn("fetchWhales error", e);
    }
  }

  async function fetchOI() {
    try {
      const res = await fetch(API.oi);
      const data = await res.json();
      const series = data.series || [];
      if (series.length > 0) {
        const labels = series.map(s => new Date(s.ts * 1000).toLocaleTimeString());
        const longs = series.map(s => s.longs);
        const shorts = series.map(s => s.shorts);
        const oi = series.map(s => s.oi);
        if (oiChart) {
          oiChart.data.labels = labels;
          oiChart.data.datasets[0].data = longs;
          oiChart.data.datasets[1].data = shorts;
          oiChart.update();
        }
        if (oiLine) {
          oiLine.data.labels = labels;
          oiLine.data.datasets[0].data = oi;
          oiLine.update();
        }
        oiLatestEl.textContent = fmtUSD(series[series.length-1].oi);
        // Update CBBI OI component (normalize)
        const latest = series[series.length-1];
        const ratio = latest.longs / Math.max(1, latest.shorts);
        const oiScore = Math.max(0, Math.min(100, Math.round((ratio / 2) * 100))); // heuristic
        document.getElementById("cbbiOI").textContent = oiScore;
        computeCBBI();
      }
    } catch (e) {
      console.warn("fetchOI error", e);
    }
  }

  async function fetchGovernance() {
    try {
      const res = await fetch(API.governance);
      const data = await res.json();
      const hips = data.hips || [];
      govSnapshotEl.innerHTML = "";
      const hipsListEl = document.getElementById("hipsList");
      hipsListEl.innerHTML = "";
      if (hips.length === 0) {
        govSnapshotEl.innerHTML = '<div class="muted text-sm">No HIPs</div>';
        hipsListEl.innerHTML = '<div class="muted text-sm">No HIPs</div>';
        return;
      }
      hips.forEach(h => {
        // snapshot
        const s = document.createElement("div");
        s.className = "mb-2";
        s.innerHTML = `<div class="text-sm"><strong>${h.id}</strong> · ${h.title}</div>`;
        govSnapshotEl.appendChild(s);

        // full HIP card
        const card = document.createElement("div");
        card.className = "p-3 glass rounded";
        card.innerHTML = `<div class="flex justify-between items-center"><div><strong>${h.id}</strong> · ${h.title}</div><div class="muted">${h.status}</div></div>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <div>
              <div class="font-semibold">Aye</div>
              <div class="mt-1" id="aye-${h.id}"></div>
            </div>
            <div>
              <div class="font-semibold">Nay</div>
              <div class="mt-1" id="nay-${h.id}"></div>
            </div>
          </div>`;
        hipsListEl.appendChild(card);

        const ayeEl = document.getElementById(`aye-${h.id}`);
        const nayEl = document.getElementById(`nay-${h.id}`);
        (h.aye || []).forEach(v => {
          const el = document.createElement("div");
          el.className = "text-sm";
          el.textContent = `${v.validator} · ${fmtNum(v.stake)}`;
          ayeEl.appendChild(el);
        });
        (h.nay || []).forEach(v => {
          const el = document.createElement("div");
          el.className = "text-sm";
          el.textContent = `${v.validator} · ${fmtNum(v.stake)}`;
          nayEl.appendChild(el);
        });
      });
    } catch (e) {
      console.warn("fetchGovernance error", e);
    }
  }

  // Compute CBBI overall index (simple average of components)
  function computeCBBI() {
    const s = Number(document.getElementById("cbbiSent").textContent) || 50;
    const w = Number(document.getElementById("cbbiWhales").textContent) || 50;
    const o = Number(document.getElementById("cbbiOI").textContent) || 50;
    const overall = Math.round((s + w + o) / 3);
    // update gauge
    if (cbbiGauge) {
      cbbiGauge.data.datasets[0].data = [overall, 100 - overall];
      cbbiGauge.update();
    }
    if (cbbiChart) {
      cbbiChart.data.datasets[0].data = [s, w, o];
      cbbiChart.update();
    }
  }

  // Tabs
  function initTabs() {
    document.querySelectorAll(".tabBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tabPanel").forEach(p => p.classList.add("hidden"));
        document.querySelectorAll(".tabBtn").forEach(b => b.classList.remove("bg-white/10"));
        const t = btn.dataset.tab;
        document.getElementById(t).classList.remove("hidden");
        btn.classList.add("bg-white/10");
      });
    });
    // activate first
    const first = document.querySelector(".tabBtn");
    if (first) first.click();
  }

  // Mobile menu
  function initMobileMenu() {
    const mobileBtn = document.getElementById("mobileMenuBtn");
    const mobileMenu = document.getElementById("mobileMenu");
    const mobileClose = document.getElementById("mobileClose");
    mobileBtn.addEventListener("click", () => mobileMenu.classList.remove("hidden"));
    mobileClose.addEventListener("click", () => mobileMenu.classList.add("hidden"));
    // close on link click
    mobileMenu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => mobileMenu.classList.add("hidden")));
  }

  // Theme toggle (dark only for now)
  function initTheme() {
    const btn = document.getElementById("themeToggle");
    btn.addEventListener("click", () => {
      const html = document.documentElement;
      if (html.classList.contains("light")) {
        html.classList.remove("light");
        btn.textContent = "Dark";
      } else {
        html.classList.add("light");
        btn.textContent = "Light";
      }
    });
  }

  // Initialize everything
  function init() {
    initCharts();
    initTabs();
    initMobileMenu();
    initTheme();
    // initial fetch
    fetchAll();
    // periodic updates every 60s
    setInterval(fetchAll, 60 * 1000);
  }

  function fetchAll() {
    fetchPrice();
    fetchNews();
    fetchSentiment();
    fetchWhales();
    fetchOI();
    fetchGovernance();
  }

  // Start
  document.addEventListener("DOMContentLoaded", init);
})();

