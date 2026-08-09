import type { PlanarVector } from '../lib/mapAlignment';

/** Reads the canonical `position.forwardMap` field from a VPS response. */
export function readForwardMap(candidate: unknown): PlanarVector | null {
  if (typeof candidate !== 'object' || candidate === null) return null;

  const value = (candidate as Record<string, unknown>).forwardMap;
  if (typeof value !== 'object' || value === null) return null;

  const { x, y } = value as Record<string, unknown>;
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return { x, y };
}
