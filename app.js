const CONFIG = {
  SUBSCRIPTION_DAYS: 30,
  BINANCE_PAY_URL: "PASTE_YOUR_REAL_BINANCE_PAY_MERCHANT_LINK_HERE",
  CONTACT_WHATSAPP: "https://wa.me/15551234567",
  CONTACT_FACEBOOK: "https://facebook.com/yourpage",
  CONTACT_GMAIL: "mailto:support@ebargaai.com",
  AI_CHAT_ENDPOINT: "/api/chat",
  PAYMENT_VERIFY_ENDPOINT: "/api/payment/verify"
};

function money(n) {
  const value = Number(n);
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function nowMs() {
  return Date.now();
}

function storageGetNumber(key) {
  const value = localStorage.getItem(key);
  return value ? Number(value) : null;
}

function isSubscriptionActive() {
  const end = storageGetNumber("subscriptionEnd");
  return end !== null && nowMs() < end;
}

function setSubscription(startMs = nowMs()) {
  const endMs = startMs + CONFIG.SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem("subscriptionStart", String(startMs));
  localStorage.setItem("subscriptionEnd", String(endMs));
  localStorage.setItem("paid", "true");
}

function clearSubscription() {
  localStorage.removeItem("subscriptionStart");
  localStorage.removeItem("subscriptionEnd");
  localStorage.removeItem("paid");
}

function routeIfPaid() {
  if (isSubscriptionActive()) {
    window.location.href = "dashboard.html";
  }
}

function goToPayment() {
  window.location.href = "payment.html";
}

function goToContact() {
  window.location.href = "contact.html";
}

function goToSupport() {
  window.location.href = "contact.html";
}

function goToFeatures() {
  window.location.href = "features.html";
}

function startDemo() {
  if (localStorage.getItem("demoUsed") === "true") {
    alert("Demo already used.");
    return;
  }
  localStorage.setItem("demoUsed", "true");
  window.location.href = "dashboard.html?demo=1";
}

function openBinancePay() {
  if (!CONFIG.BINANCE_PAY_URL || CONFIG.BINANCE_PAY_URL.includes("PASTE_YOUR_REAL_BINANCE_PAY_MERCHANT_LINK_HERE")) {
    alert("Add your real Binance Pay merchant link in app.js first.");
    return;
  }
  window.open(CONFIG.BINANCE_PAY_URL, "_blank", "noopener,noreferrer");
}

async function verifyPaymentWithBackend(txReference) {
  const res = await fetch(CONFIG.PAYMENT_VERIFY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference: txReference })
  });

  if (!res.ok) {
    throw new Error("Payment verification failed.");
  }

  const data = await res.json();
  if (data && data.verified) {
    setSubscription(data.startMs || nowMs());
    return true;
  }
  return false;
}

async function sendPaymentProof() {
  const ref = prompt("Enter your Binance payment reference / transaction ID:");
  if (!ref) return;

  try {
    const verified = await verifyPaymentWithBackend(ref);
    if (verified) {
      alert("Payment verified. Your 30-day access is active.");
      window.location.href = "dashboard.html";
      return;
    }
    alert("Payment proof received. Waiting for verification.");
    window.location.href = "contact.html";
  } catch (err) {
    console.warn(err);
    alert("Payment proof received. Please contact support to complete verification.");
    window.location.href = "contact.html";
  }
}

function checkSubscription() {
  if (!localStorage.getItem("paid")) return;
  if (isSubscriptionActive()) return;
  clearSubscription();
  alert("Your monthly subscription has expired.");
  window.location.href = "payment.html";
}

function bootHome() {
  routeIfPaid();
}

function bootPayment() {
  checkSubscription();
}

function bootContact() {
  checkSubscription();
}

function bootDashboard() {
  checkSubscription();
  if (!isSubscriptionActive()) {
    const demoMode = new URLSearchParams(window.location.search).get("demo") === "1";
    if (!demoMode) {
      window.location.href = "payment.html";
      return;
    }
  }

  const badge = document.getElementById("subscriptionBadge");
  if (badge) {
    badge.textContent = isSubscriptionActive() ? "Subscription active" : "Demo mode";
  }

  refreshSignals();
  renderDashboardUIState();
}

function renderDashboardUIState() {
  const premiumLinks = document.querySelectorAll('[data-premium="true"]');
  premiumLinks.forEach((el) => el.classList.remove("hidden"));
}

function riskManager() {
  const capital = Number(document.getElementById("capitalInput")?.value);
  const risk = Number(document.getElementById("riskInput")?.value);
  const result = document.getElementById("riskResult");

  if (!Number.isFinite(capital) || !Number.isFinite(risk)) {
    if (result) result.textContent = "Please enter capital and risk %.";
    return;
  }

  const maxRisk = capital * (risk / 100);
  if (result) result.textContent = `Maximum risk per trade: $${money(maxRisk)}`;
}

function signalScore(changePct, quoteVolume) {
  const momentum = Number(changePct) || 0;
  const vol = Math.log10((Number(quoteVolume) || 1) + 1);
  return momentum * 2 + vol;
}

function rowHtml(symbol, changePct, score) {
  const change = Number(changePct) || 0;
  const direction = change >= 0 ? "▲" : "▼";
  return `
    <div class="signal-row">
      <div>
        <div class="name">${symbol}</div>
        <div class="meta">24h change: ${direction} ${Math.abs(change).toFixed(2)}%</div>
      </div>
      <div class="score">Score ${money(score)}</div>
    </div>
  `;
}

async function refreshSignals() {
  const bullishBox = document.getElementById("bullishList");
  const bearishBox = document.getElementById("bearishList");
  if (!bullishBox || !bearishBox) return;

  bullishBox.classList.add("loading");
  bearishBox.classList.add("loading");
  bullishBox.textContent = "Loading live data...";
  bearishBox.textContent = "Loading live data...";

  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr");
    const data = await res.json();

    const filtered = data
      .filter((x) => x && x.symbol && x.symbol.endsWith("USDT") && Number.isFinite(Number(x.priceChangePercent)))
      .map((x) => ({
        symbol: x.symbol.replace("USDT", ""),
        change: Number(x.priceChangePercent),
        volume: Number(x.quoteVolume) || 0,
        score: signalScore(x.priceChangePercent, x.quoteVolume)
      }))
      .sort((a, b) => b.score - a.score);

    const bullish = filtered.filter((x) => x.change > 0).slice(0, 3);
    const bearish = filtered.filter((x) => x.change < 0).sort((a, b) => a.score - b.score).slice(0, 3);

    bullishBox.innerHTML = bullish.length
      ? bullish.map((x) => rowHtml(x.symbol, x.change, x.score)).join("")
      : `<div class="signal-row"><div><div class="name">No data</div><div class="meta">Try again soon.</div></div></div>`;

    bearishBox.innerHTML = bearish.length
      ? bearish.map((x) => rowHtml(x.symbol, x.change, x.score)).join("")
      : `<div class="signal-row"><div><div class="name">No data</div><div class="meta">Try again soon.</div></div></div>`;
  } catch (err) {
    console.warn(err);
    bullishBox.innerHTML = `
      <div class="signal-row"><div><div class="name">BTC</div><div class="meta">Fallback example</div></div><div class="score">Score 0.00</div></div>
      <div class="signal-row"><div><div class="name">ETH</div><div class="meta">Fallback example</div></div><div class="score">Score 0.00</div></div>
      <div class="signal-row"><div><div class="name">SOL</div><div class="meta">Fallback example</div></div><div class="score">Score 0.00</div></div>
    `;
    bearishBox.innerHTML = `
      <div class="signal-row"><div><div class="name">DOGE</div><div class="meta">Fallback example</div></div><div class="score">Score 0.00</div></div>
      <div class="signal-row"><div><div class="name">XRP</div><div class="meta">Fallback example</div></div><div class="score">Score 0.00</div></div>
      <div class="signal-row"><div><div class="name">SHIB</div><div class="meta">Fallback example</div></div><div class="score">Score 0.00</div></div>
    `;
  } finally {
    bullishBox.classList.remove("loading");
    bearishBox.classList.remove("loading");
  }
}

async function askAI() {
  const input = document.getElementById("msg");
  const output = document.getElementById("response");
  if (!input || !output) return;

  const message = input.value.trim();
  if (!message) {
    output.textContent = "Type a question first.";
    return;
  }

  output.textContent = "Thinking...";

  try {
    const res = await fetch(CONFIG.AI_CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, assistant: "eBarga" })
    });

    if (!res.ok) throw new Error("AI endpoint unavailable");
    const data = await res.json();
    output.textContent = data.reply || "No reply returned.";
  } catch (err) {
    const lower = message.toLowerCase();
    let fallback = "eBarga is not connected yet. Add your AI backend to enable live replies.";
    if (lower.includes("btc")) fallback = "BTC is a high-volatility asset. Check trend, support, and volume before entering.";
    else if (lower.includes("eth")) fallback = "ETH often follows broader market momentum. Watch volatility and confirmation candles.";
    else if (lower.includes("risk")) fallback = "Keep risk small per trade and avoid oversized positions.";
    output.textContent = fallback;
  }
}

function goToHome() {
  window.location.href = "index.html";
}

// Expose functions for inline handlers
window.goToPayment = goToPayment;
window.goToContact = goToContact;
window.goToSupport = goToSupport;
window.goToFeatures = goToFeatures;
window.startDemo = startDemo;
window.openBinancePay = openBinancePay;
window.sendPaymentProof = sendPaymentProof;
window.checkSubscription = checkSubscription;
window.bootHome = bootHome;
window.bootPayment = bootPayment;
window.bootContact = bootContact;
window.bootDashboard = bootDashboard;
window.refreshSignals = refreshSignals;
window.riskManager = riskManager;
window.askAI = askAI;
window.goToHome = goToHome;