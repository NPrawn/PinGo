import { describe, expect, it } from 'vitest';
import { readForwardMap } from './anchorForward';

describe('readForwardMap', () => {
  it('reads only the canonical VPS forwardMap field', () => {
    expect(readForwardMap({ forwardMap: { x: 0.6, y: 0.8 } })).toEqual({ x: 0.6, y: 0.8 });
    expect(readForwardMap({ forward: [0.6, 0.8] })).toBeNull();
    expect(readForwardMap({ forward_map: { x: 0.6, y: 0.8 } })).toBeNull();
  });

  it('rejects missing, malformed, and non-finite values', () => {
    expect(readForwardMap(null)).toBeNull();
    expect(readForwardMap({})).toBeNull();
    expect(readForwardMap({ forwardMap: { x: '0.6', y: 0.8 } })).toBeNull();
    expect(readForwardMap({ forwardMap: { x: Number.NaN, y: 0.8 } })).toBeNull();
  });
});
