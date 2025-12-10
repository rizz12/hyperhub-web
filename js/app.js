(() => {
  // Direct API endpoints for static site (no backend)
  const API = {
    price: "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=hyperliquid&order=market_cap_desc&per_page=1&page=1&sparkline=false",

    newsFeeds: [
      "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://www.reddit.com/r/Hyperliquid/.rss"),
      "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://cointelegraph.com/rss"),
      "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://www.theblock.co/rss")
    ],

    whalesDemo: [
      { pair: "HYPE/USDC", side: "long", size_usd: 250000, time: Date.now() },
      { pair: "HYPE/ETH", side: "short", size_usd: 180000, time: Date.now() - 3600_000 },
      { pair: "BTC/USDC", side: "long", size_usd: 500000, time: Date.now() - 7200_000 }
    ],

    oiDemo: (() => {
      const now = Math.floor(Date.now() / 1000);
      const series = [];
      for (let i = 0; i < 12; i++) {
        const ts = now - (11 - i) * 3600;
        const longs = 1000000 + (i * 20000) + ((i % 3) * 50000);
        const shorts = 800000 + (i * 15000) + (((i + 1) % 4) * 30000);
        const oi = longs + shorts;
        const ratio = longs / Math.max(1, shorts);
        series.push({ ts, longs, shorts, oi, long_short_ratio: Number(ratio.toFixed(3)) });
      }
      return series;
    })(),

    governanceDemo: [
      { id: "HIP-1", title: "Increase beHYPE staking rewards", status: "active", proposer: "0xabc", aye: [{ validator: "val1", stake: 12000 }, { validator: "val2", stake: 8000 }], nay: [{ validator: "val3", stake: 2000 }] },
      { id: "HIP-2", title: "Adjust fee structure", status: "closed", proposer: "0xdef", aye: [{ validator: "val2", stake: 5000 }], nay: [{ validator: "val1", stake: 3000 }, { validator: "val4", stake: 1000 }] }
    ]
  };

  // Utils
  function fmtUSD(v) {
    if (v === null || v === undefined) return "--";
    if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return "$" + (v / 1e3).toFixed(2) + "K";
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

  // Chart variables
  let sentimentChart = null;
  let oiChart = null;
  let HSIGauge = null;
  let sentimentPie = null;
  let whalesBar = null;
  let oiLine = null;
  let HSIChart = null;
  let giypChart = null;
  let cclbChart = null;

  // Chart.js defaults
  if (typeof Chart !== "undefined") {
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation = false;
    Chart.defaults.plugins.legend.display = false;
  }

  // HSI + GIYP Mock
  function loadGiypMock() {
    const el = document.getElementById("giypIndicator");
    if (!el) return;
    el.textContent = "HIP-3: +1% beHYPE yield (Positive)";
  }
  function loadCclbMock() {
    const el = document.getElementById("cclbIndicator");
    if (!el) return;
    el.textContent = "HL:950ms  Aster:1150ms  Lighter:1200ms → Hyperliquid faster";
  }

  // INIT CHARTS
  function initCharts() {
    const sCanvas = document.getElementById("sentimentChart");
    if (sCanvas) {
      sentimentChart = new Chart(sCanvas.getContext("2d"), {
        type: "doughnut",
        data: { labels: ["Bullish", "Bearish"], datasets: [{ data: [50, 50], backgroundColor: ["#00FF7F", "#FF0033"] }] }
      });
    }

    const oiCanvas = document.getElementById("oiChart");
    if (oiCanvas) {
      oiChart = new Chart(oiCanvas.getContext("2d"), {
        type: "bar",
        data: { labels: [], datasets: [{ label: "Longs", data: [], backgroundColor: "#00FF7F" }, { label: "Shorts", data: [], backgroundColor: "#FF0033" }] }
      });
    }

    const HSICanvas = document.getElementById("HSIGauge");
    if (HSICanvas) {
      HSIGauge = new Chart(HSICanvas.getContext("2d"), {
        type: "doughnut",
        data: { labels: ["Index", "Remaining"], datasets: [{ data: [60, 40], backgroundColor: ["#00FF7F", "#222"] }] },
        options: { rotation: -Math.PI, circumference: Math.PI, cutout: "70%" }
      });
    }

    const sentimentPieCanvas = document.getElementById("sentimentPie");
    if (sentimentPieCanvas) {
      sentimentPie = new Chart(sentimentPieCanvas.getContext("2d"), {
        type: "pie",
        data: { labels: ["Positive", "Negative"], datasets: [{ data: [60, 40], backgroundColor: ["#00FF7F", "#FF0033"] }] }
      });
    }
  }

  // PRICE FETCH
  async function fetchPrice() {
    try {
      const res = await fetch(API.price);
      const data = await res.json();
      const item = data[0] || {};

      const price = item.current_price || 0;
      const vol = item.total_volume || 0;
      const mcap = item.market_cap || 0;
      const change = item.price_change_percentage_24h || 0;

      hypePriceEl.textContent = `$${Number(price).toFixed(4)}`;
      cardPriceEl.textContent = `$${Number(price).toFixed(4)}`;
      cardVolumeEl.textContent = fmtUSD(vol);
      cardMarketCapEl.textContent = fmtUSD(mcap);
      hypeChangeEl.textContent = (change >= 0 ? "+" : "") + change.toFixed(2) + "%";

      lastUpdatedEl.textContent = new Date().toLocaleTimeString();
    } catch (e) {
      console.warn("fetchPrice error", e);
    }
  }

  // NEWS FETCH
  async function fetchNews() {
    try {
      newsListEl.innerHTML = '<div class="text-sm muted">Loading news...</div>';

      const responses = await Promise.all(
        API.newsFeeds.map(url => fetch(url).then(r => r.text()).catch(() => ""))
      );

      let items = [];
      responses.forEach((xml, i) => {
        if (xml.includes("<title>")) {
          const titles = [...xml.matchAll(/<title>([^<]+)<\/title>/g)]
            .slice(1, 4)
            .map(m => m[1].trim());
          items.push(...titles.map(t => ({ title: t, source: "RSS" })));
        }
      });

      if (!items.length) {
        newsListEl.innerHTML = '<div class="text-sm muted">No news available</div>';
        return;
      }

      newsListEl.innerHTML = "";
      items.slice(0, 8).forEach(n => {
        const el = document.createElement("div");
        el.className = "mb-2 p-2 glass rounded text-sm";
        el.innerHTML = `<a href="#" class="hover:underline">${n.title}</a>`;
        newsListEl.appendChild(el);
      });
    } catch (e) {
      console.error("fetchNews ERROR:", e);
    }
  }

  // SENTIMENT
  async function fetchSentiment() {
    try {
      const titles = Array.from(newsListEl.querySelectorAll("a")).map(a => a.textContent.toLowerCase());

      const positive = ["gain", "up", "bull", "moon", "pump", "surge"];
      const negative = ["drop", "down", "bear", "dump", "crash", "fall"];

      let score = 0, pos = 0, neg = 0;

      titles.forEach(t => {
        positive.forEach(p => t.includes(p) && (score++, pos++));
        negative.forEach(n => t.includes(n) && (score--, neg++));
      });

      const total = pos + neg;
      const sentimentIndex = total === 0 ? 50 : Math.max(0, Math.min(100, Math.round(50 + (score / total) * 50)));
      sentimentScoreEl.textContent = sentimentIndex;

      if (sentimentChart) {
        sentimentChart.data.datasets[0].data = [sentimentIndex, 100 - sentimentIndex];
        sentimentChart.update();
      }

    } catch (e) {
      console.warn("fetchSentiment error", e);
    }
  }

  // WHALES
  async function fetchWhales() {
    try {
      whaleListEl.innerHTML = "";
      API.whalesDemo.forEach(w => {
        const el = document.createElement("div");
        el.className = "mb-2";
        el.innerHTML = `<div class="flex justify-between"><div>${w.pair} · ${w.side}</div><div>${fmtUSD(w.size_usd)}</div></div>`;
        whaleListEl.appendChild(el);
      });
    } catch (e) {
      console.warn("fetchWhales error", e);
    }
  }

  // OI
  async function fetchOI() {
    try {
      const series = API.oiDemo;
      if (series.length === 0) return;

      const labels = series.map(s => new Date(s.ts * 1000).toLocaleTimeString());
      const longs = series.map(s => s.longs);
      const shorts = series.map(s => s.shorts);

      oiLatestEl.textContent = fmtUSD(series[series.length - 1].oi);

      if (oiChart) {
        oiChart.data.labels = labels;
        oiChart.data.datasets[0].data = longs;
        oiChart.data.datasets[1].data = shorts;
        oiChart.update();
      }
    } catch (e) {
      console.warn("fetchOI error", e);
    }
  }

  // GOVERNANCE
  function fetchGovernanceDemo() {
    const hips = API.governanceDemo;
    govSnapshotEl.innerHTML = "";

    hips.forEach(h => {
      const s = document.createElement("div");
      s.className = "mb-2";
      s.innerHTML = `<strong>${h.id}</strong> · ${h.title}`;
      govSnapshotEl.appendChild(s);
    });
  }

  // MOBILE MENU
  function initMobileMenu() {
    const btn = document.getElementById("mobileMenuBtn");
    const menu = document.getElementById("mobileMenu");
    const close = document.getElementById("mobileClose");

    if (!btn || !menu || !close) return;

    btn.addEventListener("click", () => menu.classList.remove("hidden"));
    close.addEventListener("click", () => menu.classList.add("hidden"));
    menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => menu.classList.add("hidden")));
  }

  // TABS
  function initTabs() {
    const btns = document.querySelectorAll(".tabBtn");
    const panels = document.querySelectorAll(".tabPanel");
    if (!btns.length) return;

    btns.forEach(btn => {
      btn.addEventListener("click", () => {
        panels.forEach(p => p.classList.add("hidden"));
        btns.forEach(b => b.classList.remove("bg-white/10"));
        document.getElementById(btn.dataset.tab).classList.remove("hidden");
        btn.classList.add("bg-white/10");
      });
    });

    btns[0].click();
  }

  // THEME
  function initTheme() {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;

    const html = document.documentElement;
    const saved = localStorage.getItem("hyperhub-theme");

    if (saved === "light") html.classList.add("light");
    btn.textContent = saved === "light" ? "Light" : "Dark";

    btn.addEventListener("click", () => {
      html.classList.toggle("light");
      localStorage.setItem("hyperhub-theme", html.classList.contains("light") ? "light" : "dark");
      btn.textContent = html.classList.contains("light") ? "Light" : "Dark";
    });
  }

  // FETCH ALL
  async function fetchAll() {
    fetchPrice();
    await fetchNews();
    await fetchSentiment();
    fetchWhales();
    fetchOI();
    fetchGovernanceDemo();
    loadGiypMock();
    loadCclbMock();
  }

  // INIT (correct version – NO looping)
  function init() {
    console.log("HyperHub INIT");
    initCharts();
    initTabs();
    initMobileMenu();
    initTheme();
    fetchAll();

    // refresh data only, no DOM clearing
    setInterval(fetchAll, 60 * 1000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();

