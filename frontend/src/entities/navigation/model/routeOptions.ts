export type RouteOptionId = 'fast' | 'nostair' | 'elev';

export type RouteOption = {
  id: RouteOptionId;
  name: string;
  /** One-line summary shown on the navigation screen. */
  caption: string;
};

/**
 * The three route strategies offered on the route-option screen.
 *
 * TODO: Replace with the routing API's option list once that contract is
 * agreed. Names and captions are carried over from the prototype.
 */
export const ROUTE_OPTIONS: readonly RouteOption[] = [
  {
    id: 'fast',
    name: '빠른 경로',
    caption: '가장 빠르게 갈 수 있는 최단 경로 · 3번 출구로 안내해요.',
  },
  {
    id: 'nostair',
    name: '계단 없는 경로',
    caption: '가장 빠르게 갈 수 있는 최단 경로 · 3번 출구로 안내해요.',
  },
  {
    id: 'elev',
    name: '엘리베이터 중심',
    caption: '엘리베이터로만 이동 · 엘리베이터와 연결된 2번 출구로 안내해요.',
  },
];

export function findRouteOption(id: RouteOptionId): RouteOption {
  return ROUTE_OPTIONS.find((option) => option.id === id) ?? ROUTE_OPTIONS[0];
}
