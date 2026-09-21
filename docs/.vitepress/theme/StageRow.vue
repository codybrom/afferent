<template>
  <div class="stage-row">
    <svg class="stage-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <pattern
          id="stage-hatch"
          width="5"
          height="5"
          patternTransform="rotate(45 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="5" stroke="#fff3e5" stroke-width="1.5" />
        </pattern>
      </defs>
    </svg>

    <!-- 01 Columns: text density projected onto x; the scan finds the empty gutter -->
    <figure class="stage">
      <canvas ref="columnsCanvas" :width="W" :height="H" aria-hidden="true"></canvas>
      <figcaption><span>01</span> Columns</figcaption>
    </figure>

    <!-- 02 Baselines: a ray leaves each label and locks onto the value on its baseline -->
    <figure class="stage">
      <svg viewBox="0 0 200 260" aria-hidden="true">
        <g v-for="(row, i) in baselines" :key="i" :style="{ '--d': `${i * 0.5}s` }">
          <rect x="24" :y="row.y" :width="row.label" height="6" />
          <line :x1="row.from" :y1="row.y + 3" :x2="row.to" :y2="row.y + 3" class="ray" />
          <rect
            :x="row.from"
            :y="row.y"
            width="6"
            height="6"
            class="packet"
            :style="{ '--dx': `${row.to - row.from - 6}px` }"
          />
          <rect :x="176 - row.value" :y="row.y" :width="row.value" height="6" class="target" />
        </g>
      </svg>
      <figcaption><span>02</span> Baselines</figcaption>
    </figure>

    <!-- 03 Lines: growing proximity halos merge wrapped lines into blocks -->
    <figure class="stage">
      <canvas ref="linesCanvas" :width="W" :height="H" aria-hidden="true"></canvas>
      <figcaption><span>03</span> Lines</figcaption>
    </figure>

    <!-- 04 Continuation: score a page break on three axes -->
    <figure class="stage">
      <svg viewBox="0 0 200 260" aria-hidden="true">
        <circle
          v-for="r in [20, 40, 60, 80]"
          :key="r"
          :cx="RADAR.x"
          :cy="RADAR.y"
          :r="r"
          class="ring"
        />
        <line
          v-for="(a, i) in axes"
          :key="`axis${i}`"
          :x1="RADAR.x"
          :y1="RADAR.y"
          :x2="a.x"
          :y2="a.y"
          class="axis"
        />
        <polygon :points="outline" class="outline" />
        <polygon :points="scorePoints" fill="url(#stage-hatch)" class="score-fill" />
        <polygon :points="scorePoints" class="score-edge" />
        <circle
          v-for="(p, i) in scoreVertices"
          :key="`dot${i}`"
          :cx="p.x"
          :cy="p.y"
          r="3.5"
          class="vertex"
        />
        <text v-for="a in axes" :key="a.label" :x="a.labelX" :y="a.labelY" class="axis-label">
          {{ a.label }}
        </text>
      </svg>
      <figcaption><span>04</span> Continuation</figcaption>
    </figure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

/* ---------- Bayer-dithered density fields (cards 01 and 03) ---------- */

const W = 100;
const H = 130;
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const BG = [21, 47, 33];
const FG = [255, 243, 229];

type Field = (x: number, y: number, t: number) => number;

const columnsCanvas = ref<HTMLCanvasElement | null>(null);
const linesCanvas = ref<HTMLCanvasElement | null>(null);

function paint(canvas: HTMLCanvasElement | null, field: Field, t: number) {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = field(x, y, t) > (BAYER[y % 4][x % 4] + 0.5) / 16 ? FG : BG;
      const i = (y * W + x) * 4;
      img.data[i] = px[0];
      img.data[i + 1] = px[1];
      img.data[i + 2] = px[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Two ragged text columns; how far each line runs, as a fraction of the column.
const RAGGED = [
  0.9, 0.6, 1, 0.7, 0.85, 0.5, 0.95, 0.65, 0.8, 1, 0.55, 0.9, 0.75, 0.6, 0.95, 0.7, 0.85, 0.65,
];
const MID = 50;

const scanX = (t: number) => ((t * 0.7) % 130) - 15;

const columns: Field = (x, y, t) => {
  const gutter = 6 + 2 * Math.sin(t * 0.05);
  const sx = scanX(t);
  let v = 0;

  if (y >= 12 && y < 118) {
    const row = Math.floor((y - 12) / 6);
    const onLine = (y - 12) % 6 < 3;
    if (x >= 10 && x < MID - gutter) {
      v = onLine && x < 10 + RAGGED[row] * (MID - gutter - 10) ? 0.92 : 0.14;
    } else if (x > MID + gutter && x <= 90) {
      const run = RAGGED[(row + 7) % RAGGED.length];
      v = onLine && x < MID + gutter + run * (90 - MID - gutter) ? 0.92 : 0.14;
    }
  }

  if (y >= 6 && y < 124) v += 0.55 * Math.exp(-(((x - sx) / 3) ** 2));

  // Once the scan has crossed it, mark the gutter edges.
  const atEdge = Math.abs(x - (MID - gutter)) < 0.75 || Math.abs(x - (MID + gutter)) < 0.75;
  if (sx > MID + gutter && sx < 96 && y >= 8 && y < 122 && y % 3 === 0 && atEdge) v = 1;

  return v;
};

// Text lines as 2px segments: [x0, y, length]. Lines 7px apart merge; groups 23px+ apart don't.
const SEGMENTS = (
  [
    [14, 22, 68],
    [14, 29, 60],
    [14, 36, 38],
    [14, 62, 66],
    [14, 69, 42],
    [14, 92, 64],
    [14, 99, 70],
    [14, 106, 58],
    [14, 113, 34],
  ] as const
).map(([x0, y, len]) => ({ x0, x1: x0 + len, y }));

const lines: Field = (x, y, t) => {
  const sigma = 1.5 + 6.5 * (0.5 - 0.5 * Math.cos(t * 0.045));
  let nearest = Infinity;
  for (const s of SEGMENTS) {
    const dx = x < s.x0 ? s.x0 - x : x > s.x1 ? x - s.x1 : 0;
    const dy = Math.max(0, Math.abs(y - s.y - 0.5) - 1);
    nearest = Math.min(nearest, dx * dx + dy * dy);
  }
  return Math.exp(-nearest / (sigma * sigma));
};

/* ---------- Baseline rays (card 02) ---------- */

const baselines = [
  { y: 48, label: 70, value: 28 },
  { y: 78, label: 54, value: 22 },
  { y: 108, label: 64, value: 28 },
  { y: 138, label: 48, value: 20 },
  { y: 168, label: 60, value: 28 },
  { y: 198, label: 40, value: 24 },
].map((row) => ({ ...row, from: 24 + row.label + 8, to: 176 - row.value - 8 }));

/* ---------- Continuation radar (card 04) ---------- */

const RADAR = { x: 100, y: 128, r: 80 };
const AXIS_LABELS = ["gap", "align", "sys1"];
const ANGLES = [-90, 30, 150].map((deg) => (deg * Math.PI) / 180);

const at = (i: number, radius: number) => ({
  x: RADAR.x + radius * Math.cos(ANGLES[i]),
  y: RADAR.y + radius * Math.sin(ANGLES[i]),
});

const axes = ANGLES.map((_, i) => {
  const end = at(i, RADAR.r);
  return {
    label: AXIS_LABELS[i],
    ...end,
    labelX: end.x,
    labelY: i === 0 ? end.y - 12 : end.y + 22,
  };
});
const outline = axes.map((a) => `${a.x.toFixed(1)},${a.y.toFixed(1)}`).join(" ");

const OMEGA = [0.031, 0.043, 0.037];
const PHASE = [0, 2.1, 4.2];
const scoreAt = (t: number) =>
  OMEGA.map((w, i) => 0.3 + 0.62 * (0.5 + 0.5 * Math.sin(t * w + PHASE[i])));

const scores = ref(scoreAt(100));
const scoreVertices = computed(() => scores.value.map((s, i) => at(i, RADAR.r * s)));
const scorePoints = computed(() =>
  scoreVertices.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
);

/* ---------- Animation loop ---------- */

const STILL_FRAME = 100;
const FRAME_MS = 1000 / 30;

let raf: number | null = null;
let last = 0;
let t = 0;

function render(frame: number) {
  paint(columnsCanvas.value, columns, frame);
  paint(linesCanvas.value, lines, frame);
  scores.value = scoreAt(frame);
}

function tick(now: number) {
  raf = requestAnimationFrame(tick);
  if (now - last < FRAME_MS) return;
  last = now;
  render(++t);
}

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    render(STILL_FRAME);
  } else {
    t = STILL_FRAME;
    raf = requestAnimationFrame(tick);
  }
});

onUnmounted(() => {
  if (raf !== null) cancelAnimationFrame(raf);
});
</script>

<style scoped>
.stage-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 860px) {
  .stage-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stage-defs {
  position: absolute;
}

.stage {
  margin: 0;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  transition: border-color 0.15s ease;
}

.stage:hover {
  border-color: var(--fg);
}

.stage svg,
.stage canvas {
  display: block;
  width: 100%;
  height: auto;
}

.stage canvas {
  image-rendering: pixelated;
}

.stage rect {
  fill: var(--fg);
}

figcaption {
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  font-family: var(--font-family-mono);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

figcaption span {
  margin-right: 8px;
  color: var(--fg-65);
}

/* 02 Baselines */
.ray {
  stroke: var(--fg);
  stroke-width: 1.5;
  stroke-dasharray: 0.1 4;
  stroke-linecap: round;
  opacity: 0.6;
}

.packet {
  animation: packet 4.5s ease-in-out infinite backwards;
  animation-delay: var(--d);
}

.target {
  opacity: 0.4;
  animation: lock 4.5s ease-in-out infinite backwards;
  animation-delay: var(--d);
}

@keyframes packet {
  0%,
  12% {
    transform: translateX(0);
    opacity: 1;
  }
  55% {
    transform: translateX(var(--dx));
    opacity: 1;
  }
  60%,
  100% {
    transform: translateX(var(--dx));
    opacity: 0;
  }
}

@keyframes lock {
  0%,
  52% {
    opacity: 0.4;
  }
  60%,
  85% {
    opacity: 1;
  }
  100% {
    opacity: 0.4;
  }
}

/* 04 Continuation */
.ring,
.axis {
  fill: none;
  stroke: var(--fg);
  stroke-width: 1.5;
  stroke-dasharray: 0.1 5;
  stroke-linecap: round;
  opacity: 0.55;
}

.outline,
.score-edge {
  fill: none;
  stroke: var(--fg);
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.score-fill {
  stroke: none;
  opacity: 0.4;
}

.vertex {
  fill: var(--fg);
}

.axis-label {
  fill: var(--fg);
  font-family: var(--font-family-mono);
  font-size: 11px;
  font-weight: 800;
  text-anchor: middle;
}

@media (prefers-reduced-motion: reduce) {
  .packet {
    display: none;
  }

  .packet,
  .target {
    animation: none;
  }

  .target {
    opacity: 1;
  }
}
</style>
