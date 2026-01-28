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
let currentMode = "sand"; // "sand" | "shovel"

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

// Erase sand in a small brush around pointer (shovel / eraser).
function eraseSandAtCanvasPos(x, y) {
  const rect = canvas.getBoundingClientRect();
  const gx = Math.floor(((x - rect.left) / rect.width) * GRID_WIDTH);
  const gy = Math.floor(((y - rect.top) / rect.height) * GRID_HEIGHT);

  const radius = 3;
  for (let oy = -radius; oy <= radius; oy++) {
    for (let ox = -radius; ox <= radius; ox++) {
      const dx = gx + ox;
      const dy = gy + oy;
      if (!inBounds(dx, dy)) continue;
      if (ox * ox + oy * oy > radius * radius) continue;
      grid[dy][dx] = null;
    }
  }
}

// Granular-style falling sand rules – iterate from bottom upwards.
// This adds more realistic piling and avalanching behaviour while keeping
// the rules simple and fast enough for our grid size.
function stepSimulation() {
  for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
    // Randomise horizontal traversal a bit to avoid visible vertical artifacts.
    const xOffset = Math.floor(Math.random() * GRID_WIDTH);
    for (let i = 0; i < GRID_WIDTH; i++) {
      const x = (i + xOffset) % GRID_WIDTH;

      const cell = grid[y][x];
      if (!cell) continue;

      const belowY = y + 1;
      if (belowY >= GRID_HEIGHT) continue;

      const below = grid[belowY][x];

      // Treat the outermost columns as solid walls so sand cannot "escape"
      // off-screen. We only allow diagonal movement into interior columns.
      const belowLeft =
        inBounds(x - 1, belowY) &&
        x - 1 > 0 &&
        !grid[belowY][x - 1]
          ? true
          : false;
      const belowRight =
        inBounds(x + 1, belowY) &&
        x + 1 < GRID_WIDTH - 1 &&
        !grid[belowY][x + 1]
          ? true
          : false;

      // If there is empty space directly below, fall straight down.
      if (!below) {
        grid[belowY][x] = cell;
        grid[y][x] = null;
        continue;
      }

      // Try to slide diagonally down-left / down-right if those cells are free.
      if (belowLeft || belowRight) {
        // Choose a preferred diagonal direction randomly, but fall back to the other if blocked.
        const preferLeft = Math.random() < 0.5;
        if (preferLeft && belowLeft) {
          grid[belowY][x - 1] = cell;
          grid[y][x] = null;
          continue;
        }
        if (!preferLeft && belowRight) {
          grid[belowY][x + 1] = cell;
          grid[y][x] = null;
          continue;
        }
        if (belowLeft) {
          grid[belowY][x - 1] = cell;
          grid[y][x] = null;
          continue;
        }
        if (belowRight) {
          grid[belowY][x + 1] = cell;
          grid[y][x] = null;
          continue;
        }
      }

      // Local avalanching: if we are on a steep slope, allow sand to "flow"
      // sideways with some probability, which makes piles relax more naturally.
      const leftX = x - 1;
      const rightX = x + 1;
      const canMoveLeft =
        inBounds(leftX, y) &&
        leftX > 0 &&
        !grid[y][leftX] &&
        inBounds(leftX, belowY) &&
        !grid[belowY][leftX];
      const canMoveRight =
        inBounds(rightX, y) &&
        rightX < GRID_WIDTH - 1 &&
        !grid[y][rightX] &&
        inBounds(rightX, belowY) &&
        !grid[belowY][rightX];

      if ((canMoveLeft || canMoveRight) && Math.random() < 0.35) {
        const preferLeft = Math.random() < 0.5;
        if (preferLeft && canMoveLeft) {
          grid[y][leftX] = cell;
          grid[y][x] = null;
        } else if (!preferLeft && canMoveRight) {
          grid[y][rightX] = cell;
          grid[y][x] = null;
        } else if (canMoveLeft) {
          grid[y][leftX] = cell;
          grid[y][x] = null;
        } else if (canMoveRight) {
          grid[y][rightX] = cell;
          grid[y][x] = null;
        }
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
    if (currentMode === "sand") {
      spawnSandAtCanvasPos(pointerX, pointerY);
    } else if (currentMode === "shovel") {
      eraseSandAtCanvasPos(pointerX, pointerY);
    }
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

// Mode switching (Sand / Shovel).
document
  .querySelectorAll(".mode-btn[data-mode]")
  .forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode");
      if (!mode) return;

      currentMode = mode;

      document
        .querySelectorAll(".mode-btn")
        .forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
    });
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

