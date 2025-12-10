(() => {
  // Feature flags
  const HAS_CHART = typeof Chart !== "undefined";
  const ENABLE_CHARTS = false; // <- až bude vše OK, přepni na true

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

  // Chart.js defaults – pouze pokud je knihovna a chceme grafy
  if (HAS_CHART && ENABLE_CHARTS) {
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
  function

