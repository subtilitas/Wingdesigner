// 2D canvas with pan and zoom for mouse, pen and touch.
// One pointer: drag a handle when one is hit, otherwise pan. Two pointers: pinch zoom and pan.
// Mouse wheel zooms about the cursor. World coordinates use y up unless flipY is false.

export class PanZoomCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{draw: (ctx, view) => void, hitTest?: (wx, wy, tolWorld) => any, onDrag?: (handle, wx, wy, phase) => void, onTap?: (wx, wy) => void, flipY?: boolean}} opts
   */
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.opts = opts;
    this.flipY = opts.flipY ?? true;
    this.scale = 1; // pixels per world unit (CSS pixels)
    this.ox = 0; // screen x of world origin
    this.oy = 0;
    this.pointers = new Map();
    this.drag = null;
    this.pinch = null;
    this.pending = false;
    this.fitted = false;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    canvas.addEventListener('dblclick', () => this.fit());
    this.resizeObserver = new ResizeObserver(() => this.redraw());
    this.resizeObserver.observe(canvas);
  }

  toScreen(wx, wy) {
    return [this.ox + wx * this.scale, this.oy + (this.flipY ? -wy : wy) * this.scale];
  }

  toWorld(sx, sy) {
    const wy = (sy - this.oy) / this.scale;
    return [(sx - this.ox) / this.scale, this.flipY ? -wy : wy];
  }

  /** Fit a world rectangle into the canvas with a margin in pixels. */
  fitBounds(xmin, ymin, xmax, ymax, margin = 24) {
    const w = this.canvas.clientWidth || 300;
    const hgt = this.canvas.clientHeight || 200;
    const bw = Math.max(xmax - xmin, 1e-9);
    const bh = Math.max(ymax - ymin, 1e-9);
    this.scale = Math.min((w - 2 * margin) / bw, (hgt - 2 * margin) / bh);
    const cx = (xmin + xmax) / 2;
    const cy = (ymin + ymax) / 2;
    this.ox = w / 2 - cx * this.scale;
    this.oy = hgt / 2 - (this.flipY ? -cy : cy) * this.scale;
    this.fitted = true;
    this.redraw();
  }

  fit() {
    if (this.opts.bounds) {
      const b = this.opts.bounds();
      if (b) this.fitBounds(b[0], b[1], b[2], b[3]);
    }
  }

  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  down(e) {
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      const [wx, wy] = this.toWorld(p[0], p[1]);
      const tol = (e.pointerType === 'touch' ? 18 : 9) / this.scale;
      const hit = this.opts.hitTest ? this.opts.hitTest(wx, wy, tol) : null;
      this.drag = hit ? { handle: hit, moved: false } : { pan: true, start: p, ox: this.ox, oy: this.oy, moved: false };
      if (hit && this.opts.onDrag) this.opts.onDrag(hit, wx, wy, 'start');
    } else if (this.pointers.size === 2) {
      if (this.drag?.handle && this.opts.onDrag) this.opts.onDrag(this.drag.handle, NaN, NaN, 'cancel');
      this.drag = null;
      const [a, b] = [...this.pointers.values()];
      this.pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 };
    }
  }

  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const cx = (a[0] + b[0]) / 2;
      const cy = (a[1] + b[1]) / 2;
      const f = dist / Math.max(this.pinch.dist, 1);
      this.zoomAt(this.pinch.cx, this.pinch.cy, f);
      this.ox += cx - this.pinch.cx;
      this.oy += cy - this.pinch.cy;
      this.pinch = { dist, cx, cy };
      this.redraw();
      return;
    }
    if (!this.drag) return;
    if (this.drag.pan) {
      if (Math.hypot(p[0] - this.drag.start[0], p[1] - this.drag.start[1]) > 3) this.drag.moved = true;
      this.ox = this.drag.ox + p[0] - this.drag.start[0];
      this.oy = this.drag.oy + p[1] - this.drag.start[1];
      this.redraw();
    } else if (this.drag.handle && this.opts.onDrag) {
      this.drag.moved = true;
      const [wx, wy] = this.toWorld(p[0], p[1]);
      this.opts.onDrag(this.drag.handle, wx, wy, 'move');
    }
  }

  up(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0 && this.drag) {
      const [wx, wy] = this.toWorld(p[0], p[1]);
      if (this.drag.handle && this.opts.onDrag) this.opts.onDrag(this.drag.handle, wx, wy, 'end');
      else if (this.drag.pan && !this.drag.moved && this.opts.onTap) this.opts.onTap(wx, wy);
      this.drag = null;
    }
  }

  wheel(e) {
    e.preventDefault();
    const [sx, sy] = this.local(e);
    this.zoomAt(sx, sy, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
    this.redraw();
  }

  zoomAt(sx, sy, f) {
    const s = Math.min(Math.max(this.scale * f, 1e-4), 1e5);
    const k = s / this.scale;
    this.ox = sx - (sx - this.ox) * k;
    this.oy = sy - (sy - this.oy) * k;
    this.scale = s;
  }

  zoomBy(f) {
    this.zoomAt(this.canvas.clientWidth / 2, this.canvas.clientHeight / 2, f);
    this.redraw();
  }

  redraw() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.paint();
    });
  }

  paint() {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const hgt = c.clientHeight;
    if (!w || !hgt) return;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(hgt * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(hgt * dpr);
    }
    if (!this.fitted) this.fit();
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    this.opts.draw(ctx, this, w, hgt);
  }

  /** Grid step in world units giving roughly `px` pixels between lines (1-2-5 series). */
  gridStep(px = 60) {
    const raw = px / this.scale;
    const e = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / e;
    return (m < 2 ? 2 : m < 5 ? 5 : 10) * e;
  }

  drawGrid(ctx, w, hgt, color, axisColor) {
    const step = this.gridStep();
    const [x0, y0] = this.toWorld(0, hgt);
    const [x1, y1] = this.toWorld(w, 0);
    const ymin = Math.min(y0, y1);
    const ymax = Math.max(y0, y1);
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
      const [sx] = this.toScreen(x, 0);
      ctx.moveTo(Math.round(sx) + 0.5, 0);
      ctx.lineTo(Math.round(sx) + 0.5, hgt);
    }
    for (let y = Math.ceil(ymin / step) * step; y <= ymax; y += step) {
      const [, sy] = this.toScreen(0, y);
      ctx.moveTo(0, Math.round(sy) + 0.5);
      ctx.lineTo(w, Math.round(sy) + 0.5);
    }
    ctx.stroke();
    ctx.strokeStyle = axisColor;
    ctx.beginPath();
    const [ax, ay] = this.toScreen(0, 0);
    ctx.moveTo(Math.round(ax) + 0.5, 0);
    ctx.lineTo(Math.round(ax) + 0.5, hgt);
    ctx.moveTo(0, Math.round(ay) + 0.5);
    ctx.lineTo(w, Math.round(ay) + 0.5);
    ctx.stroke();
    return step;
  }

  destroy() {
    this.resizeObserver.disconnect();
  }
}

/** Read a CSS custom property from the document root. */
export function cssVar(name, fallback = '#888') {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
