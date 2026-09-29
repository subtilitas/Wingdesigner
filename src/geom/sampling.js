// Span samples for drawing: the 3D view and the planform evaluate the surface at the same bounded
// set of span parameters.

/** The parameters with r - 1 evenly spaced values inserted in every interval. */
export function refine(params, r) {
  const out = [];
  for (let i = 0; i < params.length - 1; i++) for (let k = 0; k < r; k++) out.push(params[i] + ((params[i + 1] - params[i]) * k) / r);
  out.push(params[params.length - 1]);
  return out;
}

/** At most maxLen of the sorted parameters, evenly picked, first and last kept. */
export function thinParams(params, maxLen) {
  if (params.length <= maxLen) return params;
  return Array.from({ length: maxLen }, (_, i) => params[Math.round((i * (params.length - 1)) / (maxLen - 1))]);
}

/** Largest span samples per drawn edge line (3D edges, planform outline). */
export const MAX_EDGE_SAMPLES = 20_000;

/** Span parameters of drawn edge lines: 4 samples per station interval within MAX_EDGE_SAMPLES. */
export function edgeParams(paramsV) {
  return refine(thinParams(paramsV, Math.floor((MAX_EDGE_SAMPLES - 1) / 4) + 1), 4);
}
