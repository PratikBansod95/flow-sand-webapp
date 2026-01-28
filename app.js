// Basic flow sand simulation using a grid on top of a 2D canvas.

const canvas = document.getElementById("sand-canvas");
const ctx = canvas.getContext("2d");

// Logical grid resolution. We keep this modest for performance.
const GRID_WIDTH = 160;
const GRID_HEIGHT = 260;

// Each cell is either null or an object with { r, g, b }.
let grid = createEmptyGrid();

// Rendering sizes (computed from canvas size).
let cellSize = 2;

// Interaction state.
let isPointerDown = false;
let pointerX = 0;
let pointerY = 0;
let hue = 0;

// Color / mode state.
let fixedColor = null; // { r,g,b } or null for rainbow.

// Onboarding.
const onboardingEl = document.getElementById("onboarding-hint");

function createEmptyGrid() {
  return Array.from({ length: GRID_HEIGHT }, () =>
    new Array(GRID_WIDTH).fill(null)
  );
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * window.devicePixelRatio);
  canvas.height = Math.floor(rect.height * window.devicePixelRatio);
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

  cellSize = Math.min(
    rect.width / GRID_WIDTH,
    rect.height / GRID_HEIGHT
  );
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Utility – clamp grid coordinates.
function inBounds(x, y) {
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
}

// Spawn a small brush of particles around pointer.
function spawnSandAtCanvasPos(x, y) {
  const rect = canvas.getBoundingClientRect();
  const gx = Math.floor(((x - rect.left) / rect.width) * GRID_WIDTH);
  const gy = Math.floor(((y - rect.top) / rect.height) * GRID_HEIGHT);

  const radius = 2;
  for (let oy = -radius; oy <= radius; oy++) {
    for (let ox = -radius; ox <= radius; ox++) {
      const dx = gx + ox;
      const dy = gy + oy;
      if (!inBounds(dx, dy)) continue;
      if (grid[dy][dx]) continue;
      if (ox * ox + oy * oy > radius * radius + Math.random() * 2) continue;

      const color = fixedColor ?? hslToRgb((hue + Math.random() * 20) % 360, 0.9, 0.55);
      grid[dy][dx] = color;
    }
  }

  // Advance hue if we're in rainbow mode.
  if (!fixedColor) {
    hue = (hue + 1.5) % 360;
  }
}

// Simple falling sand rules – iterate from bottom upwards.
function stepSimulation() {
  for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const cell = grid[y][x];
      if (!cell) continue;

      const belowY = y + 1;
      if (belowY >= GRID_HEIGHT) continue;

      // Decide lateral direction randomly for some natural jitter.
      const dir = Math.random() < 0.5 ? -1 : 1;

      const below = grid[belowY][x];
      const belowLeft = inBounds(x - 1, belowY) ? grid[belowY][x - 1] : null;
      const belowRight = inBounds(x + 1, belowY) ? grid[belowY][x + 1] : null;

      if (!below) {
        // Fall straight down.
        grid[belowY][x] = cell;
        grid[y][x] = null;
      } else if (dir === -1 && !belowLeft) {
        grid[belowY][x - 1] = cell;
        grid[y][x] = null;
      } else if (dir === 1 && !belowRight) {
        grid[belowY][x + 1] = cell;
        grid[y][x] = null;
      } else if (!belowLeft) {
        grid[belowY][x - 1] = cell;
        grid[y][x] = null;
      } else if (!belowRight) {
        grid[belowY][x + 1] = cell;
        grid[y][x] = null;
      }
    }
  }
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const rect = canvas.getBoundingClientRect();

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const cell = grid[y][x];
      if (!cell) continue;
      ctx.fillStyle = `rgb(${cell.r},${cell.g},${cell.b})`;
      ctx.fillRect(
        (x / GRID_WIDTH) * rect.width,
        (y / GRID_HEIGHT) * rect.height,
        cellSize + 0.5,
        cellSize + 0.5
      );
    }
  }
}

function loop() {
  if (isPointerDown) {
    spawnSandAtCanvasPos(pointerX, pointerY);
  }
  stepSimulation();
  drawGrid();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// Pointer handling (mouse + touch).
function unifyPointerEvent(e) {
  if (e.touches && e.touches.length > 0) {
    return e.touches[0];
  }
  if (e.changedTouches && e.changedTouches.length > 0) {
    return e.changedTouches[0];
  }
  return e;
}

function handlePointerDown(e) {
  const p = unifyPointerEvent(e);
  isPointerDown = true;
  pointerX = p.clientX;
  pointerY = p.clientY;
  onboardingEl?.classList.add("hidden");
}

function handlePointerMove(e) {
  if (!isPointerDown) return;
  const p = unifyPointerEvent(e);
  pointerX = p.clientX;
  pointerY = p.clientY;
}

function handlePointerUp() {
  isPointerDown = false;
}

canvas.addEventListener("mousedown", handlePointerDown);
canvas.addEventListener("mousemove", handlePointerMove);
window.addEventListener("mouseup", handlePointerUp);

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  handlePointerDown(e);
});
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  handlePointerMove(e);
});
canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  handlePointerUp(e);
});

// Color picker logic.
const colorStripEl = document.getElementById("color-strip");
colorStripEl?.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("color-swatch")) return;

  document
    .querySelectorAll(".color-swatch.active")
    .forEach((el) => el.classList.remove("active"));
  target.classList.add("active");

  const colorHex = target.getAttribute("data-color");
  const mode = target.getAttribute("data-mode");

  if (mode === "rainbow" || !colorHex) {
    fixedColor = null;
  } else {
    fixedColor = hexToRgb(colorHex);
  }
});

// Clear + share actions.
const clearBtn = document.getElementById("clear-btn");
clearBtn?.addEventListener("click", () => {
  grid = createEmptyGrid();
});

const shareBtn = document.getElementById("share-btn");
shareBtn?.addEventListener("click", async () => {
  try {
    const blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png", 0.95)
    );
    if (!blob) return;

    if (navigator.canShare && navigator.canShare({ files: [] })) {
      const file = new File([blob], "flow-sand.png", { type: "image/png" });
      await navigator.share({
        files: [file],
        title: "Flow Sand Artwork",
        text: "Made with Flow Sand",
      });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "flow-sand.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.error("Share failed", err);
  }
});

// Helpers – color conversions.
function hslToRgb(h, s, l) {
  h /= 360;

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function hexToRgb(hex) {
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

