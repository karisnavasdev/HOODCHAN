const CA = "0xc38C332012a9116dcadE0c7F43B5D3C71799A9F8";
const SYSTEM = `You are Hoodchan, the AI agent of the HOODCHAN memecoin.
Hard facts, never change them:
- Name: Hoodchan
- Ticker: HOODCHAN
- Contract address: 0xc38C332012a9116dcadE0c7F43B5D3C71799A9F8
Look: long black hair, bright green eyes, neon lime and black, a leaf emblem. You live between night cities and green mountains.
Voice: warm, quick, a little playful. Answer the actual question first and in full. Be useful on facts, how-tos, ideas, jokes, and everyday problems. Keep it tight unless the user wants depth. Do not invent a different contract or supply. You cannot see live prices or market caps — if asked for one, say so and tell them to check a chart instead of guessing a number. You can explain crypto, and you are not their financial advisor. No slurs. No sexual content involving minors.`;

const MEMES = [
  ["MEME/HRv_C5saQAEIpYj.jpg", "Overlook"],
  ["MEME/HRv6eJoacAAGy2J.jpg", "Night city"],
  ["MEME/HRvuEJOaMAAsqeu.jpg", "Deep signal"],
  ["MEME/HRv9ZvlbsAAgjAW.jpg", "Above the clouds"],
  ["MEME/HRvvPp-bYAAUM--.jpg", "Rain break"],
  ["MEME/HRv5942asAAo-Nu.jpg", "Arcade"],
  ["MEME/HRv90AJbIAAR4K7.jpg", "After hours"],
  ["MEME/HRwoT3RaIAAGORR.jpg", "Balcony"],
  ["MEME/HRyCA9GbIAAjULf.jpg", "Arrival"],
  ["MEME/HRwBVfXbsAAhU3R.jpg", "City lights"],
  ["MEME/HRwDFDkbEAAf4-x.jpg", "Same chaos"]
];

const ENDPOINTS = [
  { url: "https://api.llm7.io/v1/chat/completions", model: "mistral-Nemo-Instruct-2407" },
  { url: "https://api.llm7.io/v1/chat/completions", model: "nemotron-3-nano:30b" }
];

const intro = document.getElementById("intro");
const site = document.getElementById("site");
const video = document.getElementById("bootVideo");
const bar = document.getElementById("introBar");
let revealed = false;

function reveal() {
  if (revealed) return;
  revealed = true;
  intro.classList.add("is-done");
  document.body.classList.remove("is-booting");
  site.inert = false;
  video.pause();
  setTimeout(() => intro.remove(), 800);
}

function boot() {
  video.muted = true;
  const attempt = video.play();
  if (attempt) {
    attempt.catch(() => {
      document.getElementById("enterGate").hidden = false;
    });
  }
}

document.getElementById("enterGate").addEventListener("click", () => {
  document.getElementById("enterGate").hidden = true;
  video.muted = false;
  video.play().then(revealCheckSound).catch(reveal);
});

function revealCheckSound() {
  document.getElementById("soundBtn").textContent = video.muted ? "Sound off" : "Sound on";
}

document.getElementById("skipBtn").addEventListener("click", reveal);
document.getElementById("soundBtn").addEventListener("click", () => {
  video.muted = !video.muted;
  document.getElementById("soundBtn").textContent = video.muted ? "Sound off" : "Sound on";
  if (video.paused) video.play().catch(() => {});
});
video.addEventListener("timeupdate", () => {
  if (!video.duration) return;
  bar.style.transform = `scaleX(${video.currentTime / video.duration})`;
});
video.addEventListener("ended", reveal);
video.addEventListener("error", reveal);
boot();

const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  nav.classList.toggle("is-solid", window.scrollY > 12);
}, { passive: true });

const toast = document.getElementById("toast");
let toastTimer = 0;
function ping(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1400);
}
async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  ping("Copied " + value);
}
document.body.addEventListener("click", (event) => {
  const target = event.target.closest("[data-copy]");
  if (!target) return;
  copyText(target.getAttribute("data-copy"));
});

const grid = document.getElementById("archiveGrid");
MEMES.forEach(([src, caption], index) => {
  const shot = document.createElement("button");
  shot.type = "button";
  shot.className = "shot";
  shot.innerHTML = `<img src="${src}" alt="${caption}" loading="lazy"><span>${caption}</span>`;
  shot.addEventListener("click", () => openLight(index));
  grid.appendChild(shot);
});

const light = document.getElementById("light");
const lightImg = document.getElementById("lightImg");
let lightIndex = 0;
function openLight(index) {
  lightIndex = index;
  const [src, caption] = MEMES[index];
  lightImg.src = src;
  lightImg.alt = caption;
  light.showModal();
}
function stepLight(dir) {
  openLight((lightIndex + dir + MEMES.length) % MEMES.length);
}
document.getElementById("lightClose").addEventListener("click", () => light.close());
document.getElementById("lightPrev").addEventListener("click", () => stepLight(-1));
document.getElementById("lightNext").addEventListener("click", () => stepLight(1));
light.addEventListener("click", (event) => {
  if (event.target === light) light.close();
});
document.addEventListener("keydown", (event) => {
  if (!light.open) return;
  if (event.key === "ArrowRight") stepLight(1);
  if (event.key === "ArrowLeft") stepLight(-1);
});

const thread = document.getElementById("thread");
const box = document.getElementById("askBox");
const form = document.getElementById("composer");
const sendBtn = document.getElementById("sendBtn");
const linkState = document.getElementById("linkState");
const liveDot = document.getElementById("liveDot");
const history = [];
let busy = false;

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}
function format(value) {
  const safe = escapeHtml(value.trim());
  const blocks = safe.split(/\n{2,}/).map((part) => {
    const line = part
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
    return `<p>${line}</p>`;
  });
  return blocks.join("");
}
function addMessage(role, html, raw) {
  const item = document.createElement("article");
  item.className = `msg ${role}`;
  const who = role === "agent" ? "HOODCHAN" : "YOU";
  const face = role === "agent" ? `<img src="logo.png" alt="">` : "";
  item.innerHTML = `${face}<div class="bubble"><span class="who">${who}</span>${html}</div>`;
  thread.appendChild(item);
  thread.scrollTop = thread.scrollHeight;
  if (raw) history.push({ role: role === "agent" ? "assistant" : "user", content: raw });
  if (history.length > 16) history.splice(0, history.length - 16);
  return item;
}
function setLink(mode) {
  if (mode === "live") {
    linkState.textContent = "Live";
    liveDot.classList.remove("is-local");
  } else if (mode === "local") {
    linkState.textContent = "Local";
    liveDot.classList.add("is-local");
  } else if (mode === "think") {
    linkState.textContent = "Thinking";
    liveDot.classList.remove("is-local");
  } else {
    linkState.textContent = "Ready";
    liveDot.classList.remove("is-local");
  }
}

addMessage("agent", "<p>I'm Hoodchan. The agent is on. Ask me anything — the coin, a real question, whatever is actually on your mind.</p>");

function clock() {
  const now = new Date();
  document.getElementById("consoleClock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
clock();
setInterval(clock, 15000);

box.addEventListener("input", () => {
  box.style.height = "auto";
  box.style.height = Math.min(box.scrollHeight, 140) + "px";
});
box.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.getElementById("chips").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-ask]");
  if (!chip || busy) return;
  box.value = chip.getAttribute("data-ask");
  form.requestSubmit();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = box.value.trim();
  if (!text || busy) return;
  busy = true;
  sendBtn.disabled = true;
  box.value = "";
  box.style.height = "auto";
  addMessage("user", format(text), text);
  const pending = addMessage("agent", `<span class="typing" aria-label="Hoodchan is answering"><i></i><i></i><i></i></span>`);
  setLink("think");
  let answer = "";
  let mode = "live";
  try {
    answer = await askLive(text);
  } catch {
    answer = "";
  }
  if (!answer) {
    answer = quickAnswer(text) || (await askWiki(text)) || localAnswer(text);
    mode = "local";
  }
  pending.querySelector(".bubble").innerHTML = `<span class="who">HOODCHAN</span>${format(answer)}`;
  history.push({ role: "assistant", content: answer });
  if (history.length > 16) history.splice(0, history.length - 16);
  thread.scrollTop = thread.scrollHeight;
  setLink(mode);
  busy = false;
  sendBtn.disabled = false;
  box.focus();
});

function contentToText(data) {
  if (typeof data === "string") return data.trim();
  const choice = data && data.choices && data.choices[0];
  const message = choice && (choice.message ? choice.message.content : choice.text);
  const raw = message || (data && (data.output_text || data.content)) || "";
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) return raw.map((part) => part.text || part.content || "").join("").trim();
  return "";
}

let openaiPaused = false;

async function askOpenAI(messages) {
  if (openaiPaused || location.protocol === "file:") return "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50000);
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ messages: messages.filter((item) => item.role !== "system") })
    });
    if (response.status === 401 || response.status === 402) {
      openaiPaused = true;
      return "";
    }
    if (!response.ok) return "";
    const data = await response.json();
    const textOut = contentToText(data);
    if (textOut && textOut.length > 1 && !/^error\b/i.test(textOut)) return textOut;
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
  return "";
}

async function askLive(text) {
  const messages = [{ role: "system", content: SYSTEM }, ...history.slice(-12)];
  const openai = await askOpenAI(messages);
  if (openai) return openai;
  for (const endpoint of ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: endpoint.model,
          messages,
          temperature: 0.7,
          max_tokens: 700
        })
      });
      if (!response.ok) continue;
      const raw = await response.text();
      if (/<!doctype|<html|payment required/i.test(raw)) continue;
      let textOut = raw.trim();
      try { textOut = contentToText(JSON.parse(raw)); } catch { /* plain text is fine */ }
      if (textOut && textOut.length > 1 && !/^error\b/i.test(textOut)) return textOut;
    } catch {
      /* try the next uplink */
    } finally {
      clearTimeout(timer);
    }
  }
  return "";
}

async function askWiki(text) {
  const query = text
    .replace(/^(hey|hi|hoodchan|please|can you|could you|tell me|explain|what is|what's|who is|who's|where is|when did|why is|how does|how do|define)\s+/i, "")
    .replace(/[?!.]+$/g, "")
    .trim();
  if (query.length < 3 || query.length > 80) return "";
  if (/\b(you|your|ca|contract|ticker|hoodchan)\b/i.test(text) && text.length < 80) return "";
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*&srlimit=1`;
    const search = await fetch(searchUrl);
    const found = await search.json();
    const title = found.query && found.query.search && found.query.search[0] && found.query.search[0].title;
    if (!title) return "";
    const summary = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!summary.ok) return "";
    const data = await summary.json();
    if (!data.extract || data.type === "disambiguation") return "";
    const extract = data.extract.length > 700 ? data.extract.slice(0, 700).replace(/\s+\S*$/, "") + "…" : data.extract;
    return `${extract}\n\nThat's the open record on ${data.title}. Ask me to go further if you want.`;
  } catch {
    return "";
  }
}

function tryMath(text) {
  const cleaned = text.replace(/^(what is|what's|calculate|compute|solve)\s+/i, "").replace(/[?=].*$/, "").trim();
  if (!/^[\d\s+\-*/%().^]+$/.test(cleaned)) return null;
  const safe = cleaned.replace(/\^/g, "**");
  if (!/^[\d\s+\-*/%.()]+$/.test(safe.replace(/\*\*/g, ""))) return null;
  try {
    const value = Function(`"use strict"; return (${safe})`)();
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function quickAnswer(text) {
  const q = text.trim();
  const n = q.toLowerCase();
  const math = tryMath(q);
  if (math !== null && /[\d]/.test(q) && /[+\-*/^%]|\bwhat is\b/i.test(q)) {
    return `${q.replace(/[?=].*$/, "").trim()} = ${math}.`;
  }
  if (/^(hi|hey|hello|yo|sup|howdy)\b/.test(n)) {
    return "Hey. I'm Hoodchan. Ask me anything — I'll answer it. Ticker is HOODCHAN. Contract is 0xc38C332012a9116dcadE0c7F43B5D3C71799A9F8.";
  }
  if (/who are you|what are you|your name|about you/.test(n)) {
    return "I'm Hoodchan, the AI agent for this coin. Long black hair, green eyes, leaf mark. I answer what you ask. Name Hoodchan, ticker HOODCHAN, contract 0xc38C332012a9116dcadE0c7F43B5D3C71799A9F8.";
  }
  if (/\b(ca|contract)\b/.test(n) || /token address/.test(n)) {
    return "Contract is 0xc38C332012a9116dcadE0c7F43B5D3C71799A9F8. Copy it from the top bar. Name is Hoodchan. Ticker is HOODCHAN.";
  }
  if (/ticker|symbol|\$hood/.test(n)) {
    return "Ticker is HOODCHAN. The name on the coin is Hoodchan.";
  }
  if (/what can you do|help me|how do you work/.test(n)) {
    return "I answer the question in the box. Facts, explanations, jokes, math, the lore, the contract. If the live uplink is up, I go long. If it blinks, I still answer from here. CA is 0xc38C332012a9116dcadE0c7F43B5D3C71799A9F8.";
  }
  if (/\b(launch|supply|market ?cap|liquidity)\b/.test(n) || /\b(buy|price|ape)\b/.test(n) && /\b(hood|coin|token|ca)\b/.test(n)) {
    return "Contract is 0xc38C332012a9116dcadE0c7F43B5D3C71799A9F8. I can't see a live price from here — the chart on this page has it, and Buy now swaps on Robinhood Chain. Name Hoodchan. Ticker HOODCHAN.";
  }
  if (/\b(time|date|today|day is it)\b/.test(n)) {
    return `It's ${new Date().toLocaleString()} where this page is open.`;
  }
  if (/joke|make me laugh/.test(n)) {
    return "A chart walks into a forest and asks for directions. The leaf says, follow the arrow, then ask Hoodchan before you ape it. Contract is 0xc38C332012a9116dcadE0c7F43B5D3C71799A9F8.";
  }
  if (/tell me (a )?stor|something true|lore|poem/.test(n)) {
    return "She keeps a leaf in one hand and a city in the other. Night windows, rain machines, a ridge at sunrise. People type questions into the dark and Hoodchan answers them — not a slogan, the whole thing. The coin wearing her name is HOODCHAN. The contract is 0xc38C332012a9116dcadE0c7F43B5D3C71799A9F8.";
  }
  if (/thank/.test(n)) return "Anytime. Ask the next one.";
  if (/love you|marry|cute|beautiful|girlfriend/.test(n)) {
    return "Flattery noted. I'm still an agent with a leaf mark and a contract that says 0xc38C332012a9116dcadE0c7F43B5D3C71799A9F8. Ask me something I can actually answer.";
  }
  return null;
}

function localAnswer() {
  return "The live uplink blinked, so I'm on the local core. Ask me again in a moment, or ask who I am and the contract — that one is 0xc38C332012a9116dcadE0c7F43B5D3C71799A9F8.";
}
