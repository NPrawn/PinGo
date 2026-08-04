import type { LocalizationCandidateResponse } from '@/shared/api';

const CLUSTER_RADIUS_M = 5;
const MIN_CLUSTER_VOTES = 2;
const MIN_CLUSTER_WEIGHT = 1.2;
const MAX_BUFFERED_CANDIDATES = 8;

type Cluster = {
  candidates: LocalizationCandidateResponse[];
  totalWeight: number;
  centerX: number;
  centerY: number;
};

function validCandidate(candidate: LocalizationCandidateResponse): boolean {
  const { position, confidenceScore } = candidate;
  return (
    candidate.startNodeId != null &&
    position.floorId != null &&
    Number.isFinite(position.mapX) &&
    Number.isFinite(position.mapY) &&
    Number.isFinite(confidenceScore) &&
    confidenceScore > 0 &&
    confidenceScore <= 1
  );
}

function distanceToCluster(candidate: LocalizationCandidateResponse, cluster: Cluster): number {
  return Math.hypot(
    candidate.position.mapX - cluster.centerX,
    candidate.position.mapY - cluster.centerY,
  );
}

function addToCluster(cluster: Cluster, candidate: LocalizationCandidateResponse): void {
  const nextWeight = cluster.totalWeight + candidate.confidenceScore;
  cluster.centerX =
    (cluster.centerX * cluster.totalWeight + candidate.position.mapX * candidate.confidenceScore) /
    nextWeight;
  cluster.centerY =
    (cluster.centerY * cluster.totalWeight + candidate.position.mapY * candidate.confidenceScore) /
    nextWeight;
  cluster.totalWeight = nextWeight;
  cluster.candidates.push(candidate);
}

/** 새 약한 후보를 제한된 프레임 버퍼에 추가한다. */
export function appendLocalizationCandidate(
  current: LocalizationCandidateResponse[],
  candidate: LocalizationCandidateResponse,
): LocalizationCandidateResponse[] {
  if (!validCandidate(candidate)) return current;
  return [...current, candidate].slice(-MAX_BUFFERED_CANDIDATES);
}

/** 같은 층·인접 좌표의 약한 결과가 충분히 모이면 가장 강한 후보를 대표 위치로 고른다. */
export function selectWeightedLocalization(
  candidates: LocalizationCandidateResponse[],
): LocalizationCandidateResponse | null {
  const clusters: Cluster[] = [];

  for (const candidate of candidates.filter(validCandidate)) {
    const cluster = clusters.find(
      (item) =>
        item.candidates[0]?.position.floorId === candidate.position.floorId &&
        distanceToCluster(candidate, item) <= CLUSTER_RADIUS_M,
    );
    if (cluster) {
      addToCluster(cluster, candidate);
    } else {
      clusters.push({
        candidates: [candidate],
        totalWeight: candidate.confidenceScore,
        centerX: candidate.position.mapX,
        centerY: candidate.position.mapY,
      });
    }
  }

  const winner = clusters
    .filter(
      (cluster) =>
        cluster.candidates.length >= MIN_CLUSTER_VOTES && cluster.totalWeight >= MIN_CLUSTER_WEIGHT,
    )
    .sort((left, right) => right.totalWeight - left.totalWeight)[0];

  if (!winner) return null;
  return winner.candidates.reduce((strongest, candidate) =>
    candidate.confidenceScore > strongest.confidenceScore ? candidate : strongest,
  );
}
