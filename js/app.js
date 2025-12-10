(() => {
  // 1) Global feature flags
  const ENABLE_CHARTS = true;
  const HAS_CHART = typeof Chart !== "undefined";

  // 2) Direct API endpoints for static site (no backend yet)
  const API = {
    // real data (CoinGecko)
    price:
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=hyperliquid&order=market_cap_desc&per_page=1&page=1&sparkline=false",

    // future backend / Hyperliquid endpoints (placeholder)
    hyperliquidInfo: null,
    hyperliquidStats: null,

    // MOCK DATA LAYER – everything except price runs on this for now
    newsDemo: [
      {
        title: "Hyperliquid open interest hits new weekly high",
        source: "Community",
        ts: Date.now() - 15 * 60 * 1000,
      },
      {
        title: "HYPE funding turns positive across majors",
        source: "Derivatives",
        ts: Date.now() - 45 * 60 * 1000,
      },
      {
        title: "Top trader rotates size into HYPE/USDC",
        source: "On‑chain",
        ts: Date.now() - 2 * 60 * 60 * 1000,
      },
      {
        title: "Basis normalizes after sharp unwind",
        source: "Futures",
        ts: Date.now() - 3 * 60 * 60 * 1000,
      },
      {
        title: "BTC range compresses while perps stay elevated",
        source: "Market",
        ts: Date.now() - 5 * 60 * 60 * 1000,
      },
    ],

    whalesDemo: [
      {
        pair: "HYPE/USDC",
        side: "long",
        size_usd: 250000,
        time: Date.now() - 3 * 60 * 1000,
      },
      {
        pair: "HYPE/ETH",
        side: "short",
        size_usd: 180000,
        time: Date.now() - 40 * 60 * 1000,
      },
      {
        pair: "BTC/USDC",
        side: "long",
        size_usd: 500000,
                time: Date.now() - 2 * 60 * 60 * 1000,
      },
      {
        pair: "ETH/USDC",
        side: "short",
        size_usd: 320000,
        time: Date.now() - 3 * 60 * 60 * 1000,
      },
      {
        pair: "SOL/USDC",
        side: "long",
        size_usd: 210000,
        time: Date.now() - 6 * 60 * 60 * 1000,
      },
    ],

    oiDemo: (() => {
      const now = Math.floor(Date.now() / 1000);
      const series = [];
      for (let i = 0; i < 12; i++) {
        const ts = now - (11 - i) * 3600;
        const longs = 1000000 + i * 20000 + ((i % 3) * 50000);
        const shorts = 800000 + i * 15000 + (((i + 1) % 4) * 30000);
        const oi = longs + shorts;
        const ratio = longs / Math.max(1, shorts);
        series.push({
          ts,
          longs,
          shorts,
          oi,
          long_short_ratio: Number(ratio.toFixed(3)),
        });
      }
      return series;
    })(),

    governanceDemo: [
      {
        id: "HIP-1",
        title: "Increase beHYPE staking rewards",
        status: "active",
        proposer: "0xabc",
        aye: [
          { validator: "val1", stake: 12000 },
          { validator: "val2", stake: 8000 },
        ],
        nay: [{ validator: "val3", stake: 2000 }],
      },
      {
        id: "HIP-2",
        title: "Adjust fee structure",
        status: "closed",
        proposer: "0xdef",
        aye: [{ validator: "val2", stake: 5000 }],
        nay: [
          { validator: "val1", stake: 3000 },
          { validator: "val4", stake: 1000 },
        ],
      },
    ],
  };

  // 3) Utils
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

  // small helper for “x min ago”
  function fmtAgo(tsMs) {
    const diff = Date.now() - tsMs;
    const mins = Math.round(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hours = Math.round(mins / 60);
    return hours + "h ago";
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

  // Chart.js defaults – only if loaded and enabled
  if (HAS_CHART && ENABLE_CHARTS) {
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation = false;
    Chart.defaults.plugins.legend.display = false;
  }

  // HSI + GIYP Mock text
  function loadGiypMock() {
    const el = document.getElementById("giypIndicator");
    if (!el) return;
    el.textContent = "HIP-3: +1% beHYPE yield (Positive)";
  }
  function loadCclbMock() {
    const el = document.getElementById("cclbIndicator");
    if (!el) return;
    el.textContent =
      "HL:950ms  Aster:1150ms  Lighter:1200ms → Hyperliquid faster";
  }

  // PRICE FETCH (CoinGecko)
  async function fetchPrice() {
    try {
      const res = await fetch(API.price, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        console.warn("fetchPrice: HTTP error", res.status, res.statusText);
        hypePriceEl.textContent = "API error";
        cardPriceEl.textContent = "API error";
        return;
      }

      const data = await res.json();
      console.log("CoinGecko response:", data);

      const item = Array.isArray(data) ? data[0] || {} : {};

      const price = item.current_price ?? null;
      const vol = item.total_volume ?? null;
      const mcap = item.market_cap ?? null;
      const change = item.price_change_percentage_24h ?? null;

      if (price == null) {
        hypePriceEl.textContent = "No price";
        cardPriceEl.textContent = "No price";
      } else {
        const pStr = "$" + Number(price).toFixed(4);
        hypePriceEl.textContent = pStr;
        cardPriceEl.textContent = pStr;
      }

      cardVolumeEl.textContent = vol == null ? "--" : fmtUSD(vol);
      cardMarketCapEl.textContent = mcap == null ? "--" : fmtUSD(mcap);

      if (change == null) {
        hypeChangeEl.textContent = "--";
      } else {
        const chStr = (change >= 0 ? "+" : "") + change.toFixed(2) + "%";
        hypeChangeEl.textContent = chStr;
      }

      if (lastUpdatedEl) {
        lastUpdatedEl.textContent = new Date().toLocaleTimeString();
      }
    } catch (e) {
      console.warn("fetchPrice error", e);
      hypePriceEl.textContent = "API error";
      cardPriceEl.textContent = "API error";
      cardVolumeEl.textContent = "--";
      cardMarketCapEl.textContent = "--";
      hypeChangeEl.textContent = "--";
    }
  }

  // INIT CHARTS wired to mock data
  function initCharts() {
    if (!ENABLE_CHARTS || !HAS_CHART) return;

    const sCanvas = document.getElementById("sentimentChart");
    if (sCanvas) {
      sentimentChart = new Chart(sCanvas.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: ["Bullish", "Bearish"],
          datasets: [
            {
              data: [50, 50], // will be updated later
              backgroundColor: ["#00FF7F", "#FF0033"],
            },
          ],
        },
      });
    }

    const oiCanvas = document.getElementById("oiChart");
    if (oiCanvas) {
      const series = API.oiDemo;
      const labels = series.map((s) =>
        new Date(s.ts * 1000).toLocaleTimeString()
      );
      const longs = series.map((s) => s.longs);
      const shorts = series.map((s) => s.shorts);

      oiChart = new Chart(oiCanvas.getContext("2d"), {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label: "Longs", data: longs, backgroundColor: "#00FF7F" },
            { label: "Shorts", data: shorts, backgroundColor: "#FF0033" },
          ],
        },
        options: {
          scales: {
            x: { ticks: { maxTicksLimit: 4 } },
          },
        },
      });
    }

    const HSICanvas = document.getElementById("HSIGauge");
    if (HSICanvas) {
      HSIGauge = new Chart(HSICanvas.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: ["Index", "Remaining"],
          datasets: [
            {
              data: [60, 40],
              backgroundColor: ["#00FF7F", "#222"],
            },
          ],
        },
        options: { rotation: -Math.PI, circumference: Math.PI, cutout: "70%" },
      });
    }

    const sentimentPieCanvas = document.getElementById("sentimentPie");
    if (sentimentPieCanvas) {
      sentimentPie = new Chart(sentimentPieCanvas.getContext("2d"), {
        type: "pie",
        data: {
          labels: ["Positive", "Negative"],
          datasets: [
            {
              data: [60, 40],
              backgroundColor: ["#00FF7F", "#FF0033"],
            },
          ],
        },
      });
    }
  }

  // Simple NEWS from mock
  function fetchNewsDemo() {
    if (!newsListEl) return;
    newsListEl.innerHTML = "";
    API.newsDemo.forEach((n) => {
      const el = document.createElement("div");
      el.className = "mb-2 p-2 glass rounded text-sm";
      el.innerHTML = `<div class="flex justify-between"><span>${n.title}</span><span class="text-xs text-gray-500">${fmtAgo(
        n.ts
      )}</span></div>`;
      newsListEl.appendChild(el);
    });
  }

  // WHALES from mock
  function fetchWhalesDemo() {
    if (!whaleListEl) return;
    whaleListEl.innerHTML = "";
    API.whalesDemo.forEach((w) => {
      const el = document.createElement("div");
      el.className = "mb-2";
      el.innerHTML = `<div class="flex justify-between text-sm"><div>${w.pair} · ${w.side}</div><div>${fmtUSD(
        w.size_usd
      )}</div></div><div class="text-xs text-gray-500">${fmtAgo(
        w.time
      )}</div>`;
      whaleListEl.appendChild(el);
    });
  }

  // OI from mock (text + update chart)
  function fetchOIDemo() {
    const series = API.oiDemo;
    if (!series.length) return;
    const latest = series[series.length - 1];
    if (oiLatestEl) oiLatestEl.textContent = fmtUSD(latest.oi);

    if (oiChart) {
      oiChart.data.datasets[0].data = series.map((s) => s.longs);
      oiChart.data.datasets[1].data = series.map((s) => s.shorts);
      oiChart.update();
    }
  }

  // GOVERNANCE from mock
  function fetchGovernanceDemo() {
    if (!govSnapshotEl) return;
    govSnapshotEl.innerHTML = "";
    API.governanceDemo.forEach((h) => {
      const s = document.createElement("div");
      s.className = "mb-2 text-sm";
      s.innerHTML = `<strong>${h.id}</strong> · ${h.title} <span class="text-xs text-gray-500">(${h.status})</span>`;
      govSnapshotEl.appendChild(s);
    });
  }

  // Very naive sentiment from news titles
  function fetchSentimentDemo() {
    try {
      const titles = API.newsDemo.map((n) => n.title.toLowerCase());
      const positive = ["gain", "up", "bull", "moon", "pump", "surge", "high"];
      const negative = ["drop", "down", "bear", "dump", "crash", "fall", "low"];

      let score = 0,
        pos = 0,
        neg = 0;

      titles.forEach((t) => {
        positive.forEach((p) => t.includes(p) && (score++, pos++));
        negative.forEach((n) => t.includes(n) && (score--, neg++));
      });

      const total = pos + neg;
      const sentimentIndex =
        total === 0
          ? 50
          : Math.max(
              0,
              Math.min(100, Math.round(50 + (score / total) * 50))
            );

      if (sentimentScoreEl) sentimentScoreEl.textContent = sentimentIndex;

      if (sentimentChart) {
        sentimentChart.data.datasets[0].data = [
          sentimentIndex,
          100 - sentimentIndex,
        ];
        sentimentChart.update();
      }
    } catch (e) {
      console.warn("fetchSentimentDemo error", e);
    }
  }

  // FETCH ALL (current static version)
  async function fetchAll() {
    fetchPrice();
    fetchNewsDemo();
    fetchWhalesDemo();
    fetchOIDemo();
    fetchGovernanceDemo();
    fetchSentimentDemo();
    loadGiypMock();
    loadCclbMock();
  }

  // INIT
  function init() {
    console.log("HyperHub INIT");
    initCharts();
    // pokud máš taby / mobile menu / theme, můžeš je sem doplnit
    // initTabs();
    // initMobileMenu();
    // initTheme();
    fetchAll();
    setInterval(fetchAll, 60 * 1000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();

