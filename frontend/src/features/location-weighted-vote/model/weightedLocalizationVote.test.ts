import type { LocalizationCandidateResponse } from '@/shared/api';
import {
  appendLocalizationCandidate,
  selectWeightedLocalization,
} from './weightedLocalizationVote';

function candidate(
  floorId: number,
  mapX: number,
  mapY: number,
  confidenceScore: number,
  startNodeId: number,
): LocalizationCandidateResponse {
  return {
    startNodeId,
    confidenceScore,
    position: {
      floorId,
      floorCode: floorId === 2 ? 'B2' : 'B3',
      mapX,
      mapY,
      mapZ: 0,
      accuracyM: 1,
    },
  };
}

describe('weighted localization vote', () => {
  it('selects the strongest representative when nearby weak candidates agree', () => {
    const first = candidate(2, 10, 10, 0.58, 101);
    const strongest = candidate(2, 11, 9.5, 0.68, 102);

    expect(selectWeightedLocalization([first])).toBeNull();
    expect(selectWeightedLocalization([first, strongest])).toBe(strongest);
  });

  it('does not combine candidates from different floors or distant positions', () => {
    const base = candidate(2, 10, 10, 0.7, 101);

    expect(selectWeightedLocalization([base, candidate(3, 10, 10, 0.7, 201)])).toBeNull();
    expect(selectWeightedLocalization([base, candidate(2, 20, 10, 0.7, 102)])).toBeNull();
  });

  it('ignores invalid weights and bounds the frame buffer', () => {
    const invalid = candidate(2, 10, 10, 1.01, 101);
    expect(appendLocalizationCandidate([], invalid)).toEqual([]);

    const buffered = Array.from({ length: 10 }, (_, index) =>
      candidate(2, index, 0, 0.6, index),
    ).reduce(appendLocalizationCandidate, [] as LocalizationCandidateResponse[]);
    expect(buffered).toHaveLength(8);
    expect(buffered[0]?.startNodeId).toBe(2);
  });

  it('accepts the maximum confidence score declared by the API contract', () => {
    const strongest = candidate(2, 10, 10, 1, 101);
    const supporting = candidate(2, 11, 10, 0.5, 102);

    expect(selectWeightedLocalization([strongest, supporting])).toBe(strongest);
  });
});
