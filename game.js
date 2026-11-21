const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const levelText = document.getElementById("levelText");
const lightText = document.getElementById("lightText");
const distText = document.getElementById("distText");
const statusText = document.getElementById("statusText");

const backBtn = document.getElementById("backBtn");
const walkBtn = document.getElementById("walkBtn");
const runBtn = document.getElementById("runBtn");
const restartBtn = document.getElementById("restartBtn");

const FIREFLY_LIGHT_SECONDS = 15; // একটি জোনাকিতে কত সেকেন্ড আলো থাকবে
const MAX_LIGHT_SECONDS = 30;     // হেরিকেনে সর্বোচ্চ কত সেকেন্ড আলো জমতে পারে

let currentLevel = 1;
let gameState = "playing"; // "playing" | "won" | "lost"
let lastTime = performance.now();
let catchFlashTimer = 0;

const input = {
  back: false,
  walk: false,
  run: false
};

const player = {
  x: 70,
  y: 350,
  radius: 16,
  walkSpeed: 65,
  runSpeed: 125,
  lightLeft: 12 // শুরুতে সামান্য আলো
};

let goalX = 740;
let fireflies = [];
let trees = [];

function buildEnvironment(level) {
  trees = [];
  for (let i = 0; i < 16; i++) {
    trees.push({
      x: 40 + i * 52 + (Math.random() * 14 - 7),
      topY: 40 + Math.random() * 60,
      width: 14 + Math.random() * 10
    });
  }

  fireflies = [];
  const count = Math.max(5, 10 - Math.floor((level - 1) / 5));
  for (let i = 0; i < count; i++) {
    fireflies.push({
      x: 160 + i * ((goalX - 220) / count) + Math.random() * 45,
      y: 230 + Math.random() * 130,
      baseY: 250 + Math.random() * 100,
      phase: Math.random() * Math.PI * 2,
      respawnTimer: 0,
      active: true
    });
  }
}

function startLevel(level) {
  currentLevel = level;
  gameState = "playing";
  player.x = 70;
  player.y = 350;
  player.lightLeft = 12;
  goalX = canvas.width - 70;
  catchFlashTimer = 0;
  buildEnvironment(level);
  statusText.textContent = "জোনাকি ধরে হেরিকেন জ্বালাও!";
}

function bindHoldButton(btn, keyName) {
  const press = (e) => {
    e.preventDefault();
    input[keyName] = true;
    btn.classList.add("active");
  };
  const release = (e) => {
    e.preventDefault();
    input[keyName] = false;
    btn.classList.remove("active");
  };

  btn.addEventListener("mousedown", press);
  btn.addEventListener("mouseup", release);
  btn.addEventListener("mouseleave", release);
  btn.addEventListener("touchstart", press, { passive: false });
  btn.addEventListener("touchend", release, { passive: false });
  btn.addEventListener("touchcancel", release, { passive: false });
}

bindHoldButton(backBtn, "back");
bindHoldButton(walkBtn, "walk");
bindHoldButton(runBtn, "run");

restartBtn.addEventListener("click", () => {
  startLevel(currentLevel);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
    if (e.shiftKey) input.run = true;
    else input.walk = true;
  }
  if (e.key === "Shift") {
    input.run = true;
  }
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
    input.back = true;
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
    input.walk = false;
    input.run = false;
  }
  if (e.key === "Shift") {
    input.run = false;
  }
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
    input.back = false;
  }
});

function update(dt) {
  if (gameState !== "playing") return;

  if (catchFlashTimer > 0) {
    catchFlashTimer = Math.max(0, catchFlashTimer - dt);
  }

  // হেরিকেনের আলো ধীরে ধীরে কমে যাওয়া (পরের লেভেলগুলোতে সামান্য দ্রুত)
  const drainRate = 1 + (currentLevel - 1) * 0.04;
  player.lightLeft = Math.max(0, player.lightLeft - dt * drainRate);

  if (player.lightLeft <= 0) {
    gameState = "lost";
    statusText.textContent = "আলো নিভে গেছে! অন্ধকারে হামলা হয়েছে!";
    return;
  }

  // হাঁটা / দৌড়ানো / পেছনে যাওয়া
  let vx = 0;
  if (input.run) vx = player.runSpeed;
  else if (input.walk) vx = player.walkSpeed;
  else if (input.back) vx = -player.walkSpeed;

  player.x = Math.max(30, Math.min(goalX, player.x + vx * dt));

  // জোনাকির ওড়া ও অটো-ক্যাচ
  for (const f of fireflies) {
    if (!f.active) {
      f.respawnTimer -= dt;
      if (f.respawnTimer <= 0) {
        f.active = true;
      }
      continue;
    }

    f.phase += dt * 3.2;
    f.y = f.baseY + Math.sin(f.phase) * 24;

    const dx = f.x - player.x;
    const dy = f.y - player.y;
    const dist = Math.hypot(dx, dy);

    // বাচ্চা জোনাকির কাছে এলেই অটোমেটিক ধরে হেরিকেনে ভরে নেবে
    if (dist <= 36) {
      f.active = false;
      f.respawnTimer = 8;
      player.lightLeft = Math.min(MAX_LIGHT_SECONDS, player.lightLeft + FIREFLY_LIGHT_SECONDS);
      catchFlashTimer = 0.35;
      statusText.textContent = "জোনাকি ধরে হেরিকেনে ভরা হয়েছে! (+15s আলো)";
    }
  }

  // গ্রামে পৌঁছানো
  if (player.x >= goalX - 10) {
    gameState = "won";
    statusText.textContent = `অভিনন্দন! লেভেল ${currentLevel} পার হয়ে গ্রামে ফিরেছ!`;
  }

  // HUD আপডেট
  lightText.textContent = `${player.lightLeft.toFixed(1)}s`;
  const remainingMeters = Math.max(0, Math.round((goalX - player.x) / 10));
  distText.textContent = `${remainingMeters}m`;
  levelText.textContent = currentLevel;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // রাতের আকাশ ও মাটি
  ctx.fillStyle = "#090d14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 366, canvas.width, canvas.height - 366);

  // দূরের গাছপালা
  ctx.fillStyle = "#0d1520";
  for (const t of trees) {
    ctx.fillRect(t.x, t.topY, t.width, 366 - t.topY);
  }

  // গ্রামের সীমানা (ডান প্রান্তে উষ্ণ আলো)
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(goalX, 345, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fde68a";
  ctx.font = "13px sans-serif";
  ctx.fillText("গ্রাম", goalX - 13, 318);

  // জোনাকি পোকাগুলো
  for (const f of fireflies) {
    if (!f.active) continue;
    const glow = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 14);
    glow.addColorStop(0, "rgba(190, 242, 100, 0.95)");
    glow.addColorStop(1, "rgba(190, 242, 100, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ecfccb";
    ctx.beginPath();
    ctx.arc(f.x, f.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // বাচ্চা ও তার হেরিকেন
  ctx.fillStyle = "#60a5fa";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  const lanternX = player.x + 18;
  const lanternY = player.y + 2;
  const lightRadius = Math.max(18, player.lightLeft * 4.2);

  if (player.lightLeft > 0) {
    const lanternGlow = ctx.createRadialGradient(lanternX, lanternY, 2, lanternX, lanternY, lightRadius);
    lanternGlow.addColorStop(0, "rgba(251, 191, 36, 0.65)");
    lanternGlow.addColorStop(0.5, "rgba(245, 158, 11, 0.18)");
    lanternGlow.addColorStop(1, "rgba(245, 158, 11, 0)");
    ctx.fillStyle = lanternGlow;
    ctx.beginPath();
    ctx.arc(lanternX, lanternY, lightRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // হেরিকেনের ছোট প্রতীক
  ctx.fillStyle = player.lightLeft > 0 ? "#fbbf24" : "#4b5563";
  ctx.fillRect(lanternX - 4, lanternY - 5, 8, 10);

  if (catchFlashTimer > 0) {
    ctx.strokeStyle = "rgba(190, 242, 100, 0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 26, 0, Math.PI * 2);
    ctx.stroke();
  }

  // জয় বা পরাজয়ের মেসেজ
  if (gameState !== "playing") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = gameState === "won" ? "#86efac" : "#fca5a5";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      gameState === "won" ? `লেভেল ${currentLevel} সম্পন্ন!` : "আলো নিভে গিয়েছিল—আবার চেষ্টা করো!",
      canvas.width / 2,
      canvas.height / 2 - 8
    );
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "15px sans-serif";
    ctx.fillText("নিচের 'আবার শুরু' বাটন চাপো", canvas.width / 2, canvas.height / 2 + 24);
    ctx.textAlign = "left";
  }
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

startLevel(1);
requestAnimationFrame(loop);
