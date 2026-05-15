async function refreshSignals() {
  const bullishBox = document.getElementById("bullishList");
  const bearishBox = document.getElementById("bearishList");

  if (!bullishBox || !bearishBox) return;

  bullishBox.classList.add("loading");
  bearishBox.classList.add("loading");

  bullishBox.textContent = "Loading live AI predictions...";
  bearishBox.textContent = "Loading live AI predictions...";

  const formatScore = (val) => {
    if (typeof money === "function") return money(val);
    return Number(val).toFixed(2);
  };

  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr");
    const data = await res.json();

    const filtered = data
      .filter((x) =>
        x &&
        x.symbol &&
        x.symbol.endsWith("USDT") &&
        !x.symbol.includes("UP") &&
        !x.symbol.includes("DOWN") &&
        Number(x.quoteVolume) > 10000000 &&
        Number.isFinite(Number(x.priceChangePercent))
      )
      .map((x) => ({
        symbol: x.symbol.replace("USDT", ""),
        change: Number(x.priceChangePercent),
        volume: Number(x.quoteVolume),
        trades: Number(x.count),
        score:
          Number(x.priceChangePercent) * 2 +
          Math.log10(Number(x.quoteVolume) + 1) +
          Math.log10(Number(x.count) + 1)
      }));

    const bullish = filtered
      .filter((x) => x.change > 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const bearish = filtered
      .filter((x) => x.change < -1)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    bullishBox.innerHTML = bullish.length
      ? bullish.map((x) => `
        <div class="signal-row">
          <div>
            <div class="name">${x.symbol}</div>
            <div class="meta">Bullish momentum • ▲ ${x.change.toFixed(2)}%</div>
          </div>
          <div class="score">AI Score ${formatScore(x.score)}</div>
        </div>
      `).join("")
      : `<div class="signal-row"><div class="name">No bullish setups</div></div>`;

    bearishBox.innerHTML = bearish.length
      ? bearish.map((x) => `
        <div class="signal-row">
          <div>
            <div class="name">${x.symbol}</div>
            <div class="meta">Bearish pressure • ▼ ${Math.abs(x.change).toFixed(2)}%</div>
          </div>
          <div class="score">AI Score ${formatScore(x.score)}</div>
        </div>
      `).join("")
      : `<div class="signal-row"><div class="name">No bearish setups</div></div>`;

  } catch (err) {
    console.warn("Signal fetch error:", err);

    bullishBox.innerHTML = `
      <div class="signal-row"><div class="name">BTC</div></div>
      <div class="signal-row"><div class="name">ETH</div></div>
      <div class="signal-row"><div class="name">SOL</div></div>
    `;

    bearishBox.innerHTML = `
      <div class="signal-row"><div class="name">DOGE</div></div>
      <div class="signal-row"><div class="name">XRP</div></div>
      <div class="signal-row"><div class="name">SHIB</div></div>
    `;
  } finally {
    bullishBox.classList.remove("loading");
    bearishBox.classList.remove("loading");
  }
}

/* ✅ FIXED RISK MANAGER (المهم) */
function riskManager() {
  const capitalEl = document.getElementById("capitalInput");
  const riskEl = document.getElementById("riskInput");
  const resultEl = document.getElementById("riskResult");

  if (!capitalEl || !riskEl || !resultEl) return;

  const capital = Number(capitalEl.value);
  const riskPercent = Number(riskEl.value);

  if (!isFinite(capital) || !isFinite(riskPercent)) {
    resultEl.textContent = "Please enter valid numbers.";
    return;
  }

  const tradeAmount = (capital * riskPercent) / 100;

  resultEl.textContent =
    `You should trade with $${tradeAmount.toFixed(2)} (${riskPercent}% of $${capital})`;
}