(() => {
  // 1) Global feature flags
  const ENABLE_CHARTS = true;
  const HAS_CHART = typeof Chart !== "undefined";

  // 2) Direct API endpoints for static site (no backend yet)
  const API = {
    // real data
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
              data: [50, 50], // will be updated by fetchSentiment()
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

  // ... dál můžeš nechat svoje fetchPrice/fetchNews atd.,
  // jen v nich postupně přepojíme News/Whales/OI na API.newsDemo / whalesDemo / oiDemo.
})();

