/**
 * 形状点阵 — 心形边框 + 字母实心采样
 */

const SHAPE_CANVAS_SIZE = 400;

/** 沿折线等距重采样 */
function resampleOutlinePoints(dense, desiredCount, spacing) {
  if (!dense.length) return [];

  let perimeter = 0;
  for (let i = 1; i < dense.length; i++) {
    perimeter += Math.hypot(
      dense[i].x - dense[i - 1].x,
      dense[i].y - dense[i - 1].y
    );
  }

  const count = Math.max(28, desiredCount || Math.round(perimeter / spacing));
  if (count <= 1) return [dense[0]];

  const stepLen = perimeter / count;
  const points = [{ x: dense[0].x, y: dense[0].y }];
  let walked = 0;

  for (let i = 1; i < dense.length; i++) {
    const seg = Math.hypot(
      dense[i].x - dense[i - 1].x,
      dense[i].y - dense[i - 1].y
    );
    walked += seg;
    while (walked >= stepLen && points.length < count) {
      walked -= stepLen;
      points.push({ x: dense[i].x, y: dense[i].y });
    }
  }

  return points;
}

/** 从 canvas 像素提取轮廓边缘点（兜底使用） */
function extractEdgePoints(ctx, size) {
  const data = ctx.getImageData(0, 0, size, size).data;
  const alphaAt = (x, y) => data[(y * size + x) * 4 + 3];
  const edges = [];

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      if (alphaAt(x, y) < 128) continue;
      const isEdge = (
        alphaAt(x - 1, y) < 128 ||
        alphaAt(x + 1, y) < 128 ||
        alphaAt(x, y - 1) < 128 ||
        alphaAt(x, y + 1) < 128
      );
      if (isEdge) edges.push({ x, y });
    }
  }

  return edges;
}

/** 在离屏 canvas 上绘制字母（描边或填充） */
function drawLetterToCanvas(ctx, letter, useFill) {
  const size = SHAPE_CANVAS_SIZE;
  ctx.clearRect(0, 0, size, size);
  ctx.font = '900 280px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (useFill) {
    ctx.fillStyle = '#000';
    ctx.fillText(letter, size / 2, size / 2 + 8);
  } else {
    ctx.lineWidth = 52;
    ctx.strokeStyle = '#000';
    ctx.strokeText(letter, size / 2, size / 2 + 8);
  }
}

/** 从 canvas 中按网格提取字母实心点 */
function extractFilledPoints(ctx, size, step) {
  const data = ctx.getImageData(0, 0, size, size).data;
  const alphaAt = (x, y) => data[(y * size + x) * 4 + 3];
  const points = [];

  for (let y = step; y < size - step; y += step) {
    // 交错采样，避免规则栅格感
    const offset = (Math.floor(y / step) % 2) * Math.floor(step / 2);
    for (let x = step + offset; x < size - step; x += step) {
      if (alphaAt(x, y) > 120) points.push({ x, y });
    }
  }
  return points;
}

/** 有种子的轻量洗牌，保证分布更均匀且可复现 */
function sortFilledPoints(points) {
  if (points.length < 2) return points;
  const rowH = 4;
  const rows = new Map();
  points.forEach((p) => {
    const row = Math.floor(p.y / rowH);
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row).push(p);
  });

  const sortedRows = Array.from(rows.keys()).sort((a, b) => a - b);
  const result = [];
  sortedRows.forEach((row, idx) => {
    const arr = rows.get(row).slice().sort((a, b) => a.x - b.x);
    if (idx % 2 === 1) arr.reverse();
    result.push(...arr);
  });
  return result;
}

function sampleByStride(points, count) {
  if (points.length <= count) return points;
  const sampled = [];
  const step = points.length / count;
  for (let i = 0; i < count; i++) {
    sampled.push(points[Math.floor(i * step)]);
  }
  return sampled;
}

/** 画布坐标映射到屏幕，字母宽约 viewport 48% */
function mapToScreen(points, layout) {
  if (!points.length) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  points.forEach((p) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });

  const letterW = maxX - minX || 1;
  const letterH = maxY - minY || 1;
  const targetW = window.innerWidth * 0.56;
  const targetH = window.innerHeight * 0.62;
  const mapScale = Math.min(targetW / letterW, targetH / letterH);
  const letterCx = (minX + maxX) / 2;
  const letterCy = (minY + maxY) / 2;

  return points.map((p) => ({
    x: layout.cx + (p.x - letterCx) * mapScale,
    y: layout.cy + (p.y - letterCy) * mapScale,
  }));
}

/**
 * 生成字母/数字实心目标点
 * @param {string} letter - A-Z or 0-9
 * @param {number} desiredCount - 期望点数
 * @param {{ cx: number, cy: number }} layout - 屏幕布局中心
 * @param {number} spacing - 照片间距
 */
function generateLetterOutlinePoints(letter, desiredCount, layout, spacing) {
  const char = String(letter).toUpperCase();
  if (!/^[A-Z0-9]$/.test(char)) return [];

  const canvas = document.createElement('canvas');
  const size = SHAPE_CANVAS_SIZE;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const desired = Math.max(36, desiredCount || 0);
  // 目标越多，采样步长越细，保证字形完整
  let step = 7;
  if (desired > 160) step = 5;
  else if (desired > 90) step = 6;

  // 主路径：实心填充采样
  drawLetterToCanvas(ctx, char, true);
  let filled = extractFilledPoints(ctx, size, step);

  // 点太少时加密采样
  if (filled.length < 48) {
    filled = extractFilledPoints(ctx, size, 4);
  }

  // 兜底：极端字体环境使用描边边缘
  if (filled.length < 12) {
    drawLetterToCanvas(ctx, char, false);
    filled = extractEdgePoints(ctx, size);
  }
  if (filled.length < 12) return [];

  const minCount = Math.max(48, Math.round(240 / Math.max(spacing, 1)));
  const targetCount = Math.max(minCount, desired);
  const ordered = sortFilledPoints(filled);
  const sampled = sampleByStride(ordered, targetCount);
  return mapToScreen(sampled, layout);
}
