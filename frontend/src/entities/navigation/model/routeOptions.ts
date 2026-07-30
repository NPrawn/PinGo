export type RouteOptionId = 'fast' | 'elev';

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
    name: '최단 경로',
    caption: '목적지에서 가장 가까운 출입구까지 안내해요.',
  },
  {
    id: 'elev',
    name: '엘리베이터 우선',
    caption: '엘리베이터를 이용할 수 있는 출입구까지 안내해요.',
  },
];

export function findRouteOption(id: RouteOptionId): RouteOption {
  return ROUTE_OPTIONS.find((option) => option.id === id) ?? ROUTE_OPTIONS[0];
}
