// ---------- Config ----------
// Local testing: "http://localhost:8080"
// After deploying the backend, change this to your Render URL,
// e.g. "https://number-guess-api.onrender.com"
const API_BASE = "https://number-guess-game-ne2u.onrender.com".replace(/\/+$/, "");

// Every browser tab gets its own game on the server
const gameId = crypto.randomUUID();

const MIN = 0;
const MAX = 99;

const $ = (id) => document.getElementById(id);
const game = $("game");
const form = $("guessForm");
const input = $("guessInput");
const guessBtn = $("guessBtn");
const message = $("message");
const attemptsEl = $("attempts");
const historyEl = $("history");
const giveUpBtn = $("giveUpBtn");
const againBtn = $("againBtn");
const windowEl = $("window");
const track = $("track");

let low = MIN;
let high = MAX;
let finished = false;

const canvas = $("confetti");
const ctx = canvas.getContext("2d");
const CONFETTI_COLORS = ["#f4c430", "#fff3c4", "#f5f1e8", "#ff6b6b", "#7dd3fc"];
let pieces = [];
let rafId = null;

function burst(count, spread) {
  const rect = game.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height * 0.3;
  for (let i = 0; i < count; i++) {
    pieces.push({
      x: originX,
      y: originY,
      vx: (Math.random() - 0.5) * spread,
      vy: -Math.random() * 15 - 4,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.4,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    });
  }
}

function drawConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of pieces) {
    p.vy += 0.35;      // gravity
    p.vx *= 0.99;      // air drag
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  pieces = pieces.filter((p) => p.y < canvas.height + 40);
  if (pieces.length) {
    rafId = requestAnimationFrame(drawConfetti);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function launchConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  burst(140, 18);
  setTimeout(() => burst(90, 24), 300);
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(drawConfetti);
}

function stopConfetti() {
  pieces = [];
  cancelAnimationFrame(rafId);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function pct(n) {
  return (n / MAX) * 100;
}

function renderRange() {
  $("lo").textContent = low;
  $("hi").textContent = high;
  windowEl.style.left = pct(low) + "%";
  windowEl.style.width = Math.max(pct(high - low), 3) + "%";
}

function setMessage(text, kind = "") {
  message.textContent = text;
  message.className = "message " + kind;
}

function addHistory(n, kind) {
  const li = document.createElement("li");
  li.className = kind;
  li.textContent = n;
  historyEl.appendChild(li);

  const tick = document.createElement("div");
  tick.className = "tick";
  tick.style.left = pct(n) + "%";
  track.appendChild(tick);
}

function shake() {
  form.classList.remove("shake");
  void form.offsetWidth; // restart animation
  form.classList.add("shake");
}

function lockGame() {
  finished = true;
  input.disabled = true;
  guessBtn.disabled = true;
  giveUpBtn.hidden = true;
  againBtn.hidden = false;
  againBtn.focus();
}

async function startNewGame() {
  setMessage("Connecting to the server...");
  try {
    await fetch(`${API_BASE}/api/new?id=${gameId}`, { method: "POST" });
  } catch (e) {
    setMessage("Can't reach the server. If it was idle, wait about 30 seconds and try again.", "error");
    return;
  }
  low = MIN;
  high = MAX;
  finished = false;
  game.classList.remove("won");
  stopConfetti();
  historyEl.innerHTML = "";
  track.querySelectorAll(".tick").forEach((t) => t.remove());
  attemptsEl.textContent = "0";
  input.disabled = false;
  guessBtn.disabled = false;
  giveUpBtn.hidden = false;
  againBtn.hidden = true;
  input.value = "";
  setMessage("Type a number and press Guess.");
  renderRange();
  input.focus();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (finished) return;

  const n = Number(input.value);
  if (!Number.isInteger(n) || n < MIN || n > MAX) {
    setMessage(`Enter a whole number from ${MIN} to ${MAX}.`, "error");
    shake();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/guess?id=${gameId}&n=${n}`, { method: "POST" });
    if (!res.ok) throw new Error("Bad response");
    const data = await res.json();

    attemptsEl.textContent = data.attempts;

    if (data.result === "win") {
      low = high = n;
      addHistory(n, "win");
      game.classList.add("won");
      setMessage(`You got it in ${data.attempts} ${data.attempts === 1 ? "attempt" : "attempts"}!`, "win");
      lockGame();
      launchConfetti();
    } else if (data.result === "high") {
      high = Math.min(high, n - 1);
      addHistory(n, "high");
      setMessage(`${n} is too high. Go lower.`, "high");
    } else {
      low = Math.max(low, n + 1);
      addHistory(n, "low");
      setMessage(`${n} is too low. Go higher.`, "low");
    }

    renderRange();
    input.value = "";
    if (!finished) input.focus();
  } catch (err) {
    setMessage("Can't reach the server. If it was idle, wait about 30 seconds and try again.", "error");
  }
});

giveUpBtn.addEventListener("click", async () => {
  if (finished) return;
  try {
    const res = await fetch(`${API_BASE}/api/giveup?id=${gameId}`, { method: "POST" });
    const data = await res.json();
    low = high = data.secret;
    renderRange();
    setMessage(`My number was ${data.secret}.`, "high");
    lockGame();
  } catch (err) {
    setMessage("Can't reach the server. If it was idle, wait about 30 seconds and try again.", "error");
  }
});

againBtn.addEventListener("click", startNewGame);

startNewGame();
