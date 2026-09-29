// three.js viewport: wing surface with analytic normals, caps, section outlines, leading and
// trailing edge lines, optional control net, and touch-friendly orbit controls
// (one finger rotates, two fingers pinch-zoom and pan). Renders on demand.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { surfaceDerivatives1, surfacePoint } from '../geom/nurbs.js';
import { stripTriangulate } from '../geom/triangulate.js';

function refine(params, r) {
  const out = [];
  for (let i = 0; i < params.length - 1; i++) for (let k = 0; k < r; k++) out.push(params[i] + ((params[i + 1] - params[i]) * k) / r);
  out.push(params[params.length - 1]);
  return out;
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Largest display mesh in vertices; cubic lofts are refined 3 times in v while they fit. */
const MAX_DISPLAY_VERTICES = 100_000;

/** Display geometry of the half wing (duplicated edge vertices for crisp creases). */
export function displayGeometry(build) {
  const S = build.surface;
  const us = build.paramsU;
  const fit = Math.floor(MAX_DISPLAY_VERTICES / (us.length * build.paramsV.length));
  const vs = refine(build.paramsV, S.degreeV === 1 ? 1 : Math.max(1, Math.min(3, fit)));
  const M = us.length;
  const V = vs.length;
  const pos = new Float32Array(M * V * 3);
  const nrm = new Float32Array(M * V * 3);
  const grid = [];
  for (let k = 0; k < V; k++) {
    const row = [];
    for (let j = 0; j < M; j++) {
      const { point, du, dv } = surfaceDerivatives1(S, us[j], vs[k]);
      let n = cross(dv, du);
      let l = Math.hypot(n[0], n[1], n[2]);
      if (l < 1e-12) {
        // Degenerate derivative (e.g. exactly at a sharp trailing edge): fall back to a neighbour.
        const u2 = us[j] + (j === M - 1 ? -1e-4 : 1e-4);
        const d2 = surfaceDerivatives1(S, u2, vs[k]);
        n = cross(d2.dv, d2.du);
        l = Math.hypot(n[0], n[1], n[2]) || 1;
      }
      const o = (k * M + j) * 3;
      pos[o] = point[0];
      pos[o + 1] = point[1];
      pos[o + 2] = point[2];
      nrm[o] = n[0] / l;
      nrm[o + 1] = n[1] / l;
      nrm[o + 2] = n[2] / l;
      row.push(point);
    }
    grid.push(row);
  }
  const idx = [];
  for (let k = 0; k < V - 1; k++) {
    for (let j = 0; j < M - 1; j++) {
      const a = k * M + j;
      const b = a + 1;
      const c = a + M + 1;
      const d = a + M;
      idx.push(a, c, b, a, d, c);
    }
  }
  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  surface.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  surface.setIndex(idx);

  // Caps and trailing-edge strip as flat-shaded geometry.
  const flat = [];
  const tri = (a, b, c) => flat.push(...a, ...b, ...c);
  const cap = (row, flip) => {
    const ring = build.closedTE ? row.slice(0, -1) : row;
    const poly = ring.map((P) => [P[0], P[2]]);
    for (const [a, b, c] of stripTriangulate(poly, build.leIndex)) {
      if (flip) tri(ring[a], ring[c], ring[b]);
      else tri(ring[a], ring[b], ring[c]);
    }
  };
  cap(grid[0], false);
  cap(grid[V - 1], true);
  if (!build.closedTE) {
    for (let k = 0; k < V - 1; k++) {
      const a = grid[k][M - 1];
      const b = grid[k][0];
      const c = grid[k + 1][0];
      const d = grid[k + 1][M - 1];
      tri(a, c, b);
      tri(a, d, c);
    }
  }
  const caps = new THREE.BufferGeometry();
  caps.setAttribute('position', new THREE.BufferAttribute(new Float32Array(flat), 3));
  caps.computeVertexNormals();
  return { surface, caps };
}

function polyline(points) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points.flat()), 3));
  return g;
}

export class Viewer3D {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.setAttribute('aria-label', '3D wing view. Drag to rotate, pinch or scroll to zoom, two fingers or right mouse button to pan.');
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 1e6);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(-900, -1300, 800);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.screenSpacePanning = true;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.addEventListener('change', () => this.render());

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    this.key = new THREE.DirectionalLight(0xffffff, 1.6);
    this.key.position.set(-0.5, -1, 1.2);
    this.camera.add(this.key);
    this.scene.add(this.camera);

    this.wingGroup = new THREE.Group();
    this.overlay = new THREE.Group();
    this.scene.add(this.wingGroup, this.overlay);
    this.material = new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.55, metalness: 0.05, side: THREE.FrontSide });
    this.capMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c2d0, roughness: 0.7, metalness: 0.0 });
    this.lineMaterial = new THREE.LineBasicMaterial({ color: 0x2f6fdf });
    this.edgeMaterial = new THREE.LineBasicMaterial({ color: 0x555555 });
    this.selMaterial = new THREE.LineBasicMaterial({ color: 0xe0522c });
    this.netMaterial = new THREE.LineBasicMaterial({ color: 0x9a6bd8, transparent: true, opacity: 0.6 });
    this.options = { mirror: true, controlNet: false, sections: true };
    this.grid = null;
    this.hasFitted = false;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  render() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.renderer.render(this.scene, this.camera);
    });
  }

  clearGroup(g) {
    for (const obj of [...g.children]) {
      g.remove(obj);
      obj.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
  }

  /** Show a build result. selectedV: span fraction of the selected section (highlighted). */
  setBuild(build, { mirror = true, selectedV = null } = {}) {
    this.build = build;
    this.selectedV = selectedV;
    this.options.mirror = mirror;
    this.clearGroup(this.wingGroup);
    this.clearGroup(this.overlay);
    if (!build || !build.surface) {
      this.render();
      return;
    }
    const { surface, caps } = displayGeometry(build);
    const half = new THREE.Group();
    half.add(new THREE.Mesh(surface, this.material), new THREE.Mesh(caps, this.capMaterial));

    const S = build.surface;
    const us = refine(build.paramsU, 1);
    const lines = new THREE.Group();
    if (this.options.sections) {
      const sectionVs = build.sections.map((s) => (build.tipY > build.rootY ? (s.y - build.rootY) / (build.tipY - build.rootY) : 0));
      for (const v of sectionVs) {
        const pts = us.map((u) => surfacePoint(S, u, v));
        if (!build.closedTE) pts.push(pts[0]);
        const sel = selectedV !== null && Math.abs(v - selectedV) < 1e-9;
        lines.add(new THREE.Line(polyline(pts), sel ? this.selMaterial : this.lineMaterial));
      }
    }
    const vs = refine(build.paramsV, 4);
    for (const u of [0, build.uLE, 1]) lines.add(new THREE.Line(polyline(vs.map((v) => surfacePoint(S, u, v))), this.edgeMaterial));
    if (this.options.controlNet) {
      const segs = [];
      const P = S.points;
      for (let i = 0; i < P.length; i++) for (let j = 0; j < P[i].length; j++) {
        if (i + 1 < P.length) segs.push(...P[i][j], ...P[i + 1][j]);
        if (j + 1 < P[i].length) segs.push(...P[i][j], ...P[i][j + 1]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
      lines.add(new THREE.LineSegments(g, this.netMaterial));
    }
    half.add(lines);
    this.wingGroup.add(half);
    if (mirror) {
      const left = half.clone();
      left.scale.set(1, -1, 1);
      this.wingGroup.add(left);
    }
    this.updateGrid(build);
    if (!this.hasFitted) {
      this.fit();
      this.hasFitted = true;
    }
    this.render();
  }

  updateGrid(build) {
    const span = Math.max(build.tipY, 100);
    const size = Math.pow(10, Math.ceil(Math.log10(span * 2.2)));
    if (this.grid && this.grid.userData.size === size) return;
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
    }
    this.grid = new THREE.GridHelper(size, 20, 0x8899aa, 0xc5ccd6);
    this.grid.rotation.x = Math.PI / 2;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.35;
    this.grid.userData.size = size;
    this.scene.add(this.grid);
  }

  boundingSphere() {
    const box = new THREE.Box3().setFromObject(this.wingGroup);
    if (box.isEmpty()) return new THREE.Sphere(new THREE.Vector3(), 500);
    return box.getBoundingSphere(new THREE.Sphere());
  }

  /** Frame the wing. dir: camera direction from target (default isometric). */
  fit(dir = new THREE.Vector3(-0.75, -0.55, 0.62)) {
    const s = this.boundingSphere();
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    // Fit the sphere into the smaller of the vertical and horizontal field of view.
    const fovMin = Math.min(halfFov, Math.atan(Math.tan(halfFov) * this.camera.aspect));
    const d = (s.radius / Math.sin(fovMin)) * 1.02;
    this.controls.target.copy(s.center);
    this.camera.position.copy(s.center).add(dir.clone().normalize().multiplyScalar(d));
    this.camera.near = d / 100;
    this.camera.far = d * 100;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.render();
  }

  view(name) {
    const dirs = {
      top: new THREE.Vector3(0.0001, 0, 1),
      front: new THREE.Vector3(-1, 0, 0.0001),
      side: new THREE.Vector3(0, -1, 0.0001),
      iso: new THREE.Vector3(-0.75, -0.55, 0.62),
    };
    this.fit(dirs[name] ?? dirs.iso);
  }

  setOption(key, value) {
    this.options[key] = value;
    if (this.build) this.setBuild(this.build, { mirror: this.options.mirror, selectedV: this.selectedV });
  }

  screenshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
