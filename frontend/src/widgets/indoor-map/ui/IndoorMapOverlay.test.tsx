import { render, screen } from '@testing-library/react';
import type { PixelPoint } from '@/entities/floor-map';
import type { IndoorPoint, RoutePathNode } from '@/entities/navigation';
import { IndoorMapOverlay } from './IndoorMapOverlay';

const FLOOR_B2 = 1;
const FLOOR_B3 = 2;

/**
 * 변환은 주입받으므로 테스트에서는 미터 프레임 대신 항등 변환을 쓴다.
 * 실제 미터→픽셀 계산은 entities/floor-map의 coordinates 테스트가 검증한다.
 */
function identityProject(mapX: number, mapY: number): PixelPoint | null {
  if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) return null;
  return { px: mapX, py: mapY };
}

function renderOverlay(props: {
  floorId?: number;
  currentLocation?: IndoorPoint | null;
  destination?: IndoorPoint | null;
  pathNodes?: readonly RoutePathNode[];
  project?: (mapX: number, mapY: number) => PixelPoint | null;
}) {
  return render(
    <IndoorMapOverlay
      floorId={props.floorId ?? FLOOR_B2}
      imageWidth={1624}
      imageHeight={969}
      project={props.project ?? identityProject}
      currentLocation={props.currentLocation}
      destination={props.destination}
      pathNodes={props.pathNodes}
    />,
  );
}

function routeLine(): SVGPolylineElement {
  return screen.getByRole('img', { name: '이동 경로' }) as unknown as SVGPolylineElement;
}

describe('IndoorMapOverlay', () => {
  it('현재 위치와 목적지 마커를 그린다', () => {
    renderOverlay({
      currentLocation: { floorId: FLOOR_B2, mapX: 100, mapY: 200 },
      destination: { floorId: FLOOR_B2, mapX: 400, mapY: 500 },
    });

    expect(screen.getByRole('img', { name: '현재 위치' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '목적지' })).toBeInTheDocument();
  });

  it('경로 노드를 순서대로 이은 선을 그린다', () => {
    renderOverlay({
      pathNodes: [
        { nodeId: 1, floorId: FLOOR_B2, mapX: 10, mapY: 20 },
        { nodeId: 2, floorId: FLOOR_B2, mapX: 30, mapY: 40 },
        { nodeId: 3, floorId: FLOOR_B2, mapX: 50, mapY: 60 },
      ],
    });

    expect(routeLine()).toHaveAttribute('points', '10,20 30,40 50,60');
  });

  it('원본 이미지 크기를 viewBox로 삼는다', () => {
    const { container } = renderOverlay({
      currentLocation: { floorId: FLOOR_B2, mapX: 100, mapY: 200 },
    });

    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 1624 969');
  });

  describe('층 필터링', () => {
    it('다른 층의 현재 위치·목적지는 그리지 않는다', () => {
      renderOverlay({
        floorId: FLOOR_B2,
        currentLocation: { floorId: FLOOR_B3, mapX: 100, mapY: 200 },
        destination: { floorId: FLOOR_B2, mapX: 400, mapY: 500 },
      });

      expect(screen.queryByRole('img', { name: '현재 위치' })).not.toBeInTheDocument();
      expect(screen.getByRole('img', { name: '목적지' })).toBeInTheDocument();
    });

    it('경로는 표시 중인 층의 구간만 잇는다', () => {
      const pathNodes: RoutePathNode[] = [
        { nodeId: 1, floorId: FLOOR_B3, mapX: 10, mapY: 10 },
        { nodeId: 2, floorId: FLOOR_B3, mapX: 20, mapY: 20 },
        { nodeId: 3, floorId: FLOOR_B2, mapX: 30, mapY: 30 },
        { nodeId: 4, floorId: FLOOR_B2, mapX: 40, mapY: 40 },
      ];

      renderOverlay({ floorId: FLOOR_B2, pathNodes });
      expect(routeLine()).toHaveAttribute('points', '30,30 40,40');
    });
  });

  describe('빈 경로 상태', () => {
    it('pathNodes가 없으면 경로선을 그리지 않는다', () => {
      renderOverlay({ currentLocation: { floorId: FLOOR_B2, mapX: 1, mapY: 1 } });
      expect(screen.queryByRole('img', { name: '이동 경로' })).not.toBeInTheDocument();
    });

    it('빈 배열이어도 경로선을 그리지 않는다', () => {
      renderOverlay({
        pathNodes: [],
        currentLocation: { floorId: FLOOR_B2, mapX: 1, mapY: 1 },
      });
      expect(screen.queryByRole('img', { name: '이동 경로' })).not.toBeInTheDocument();
    });

    it('표시 층에 노드가 하나뿐이면 이을 선이 없어 그리지 않는다', () => {
      renderOverlay({
        floorId: FLOOR_B2,
        pathNodes: [
          { nodeId: 1, floorId: FLOOR_B2, mapX: 30, mapY: 30 },
          { nodeId: 2, floorId: FLOOR_B3, mapX: 40, mapY: 40 },
        ],
        currentLocation: { floorId: FLOOR_B2, mapX: 1, mapY: 1 },
      });
      expect(screen.queryByRole('img', { name: '이동 경로' })).not.toBeInTheDocument();
    });

    it('그릴 것이 하나도 없으면 오버레이를 만들지 않는다', () => {
      const { container } = renderOverlay({ pathNodes: [] });
      expect(container.querySelector('svg')).toBeNull();
    });
  });

  describe('잘못된 좌표 처리', () => {
    it('변환할 수 없는 좌표의 마커는 건너뛴다', () => {
      renderOverlay({
        currentLocation: { floorId: FLOOR_B2, mapX: Number.NaN, mapY: 200 },
        destination: { floorId: FLOOR_B2, mapX: 400, mapY: 500 },
      });

      expect(screen.queryByRole('img', { name: '현재 위치' })).not.toBeInTheDocument();
      expect(screen.getByRole('img', { name: '목적지' })).toBeInTheDocument();
    });

    it('잘못된 좌표의 노드만 경로에서 빼고 나머지는 잇는다', () => {
      renderOverlay({
        pathNodes: [
          { nodeId: 1, floorId: FLOOR_B2, mapX: 10, mapY: 20 },
          { nodeId: 2, floorId: FLOOR_B2, mapX: Number.NaN, mapY: 40 },
          { nodeId: 3, floorId: FLOOR_B2, mapX: 50, mapY: 60 },
        ],
      });

      expect(routeLine()).toHaveAttribute('points', '10,20 50,60');
    });

    it('null·undefined 좌표가 섞여 들어와도 터지지 않는다', () => {
      // 백엔드 BigDecimal이 null로 내려오는 경우. 타입은 number지만 런타임 값은 보장되지 않는다.
      const brokenNodes = [
        { nodeId: 1, floorId: FLOOR_B2, mapX: null, mapY: 20 },
        { nodeId: 2, floorId: FLOOR_B2, mapX: 30, mapY: undefined },
      ] as unknown as RoutePathNode[];

      const { container } = renderOverlay({
        pathNodes: brokenNodes,
        project: (mapX, mapY) =>
          typeof mapX === 'number' && typeof mapY === 'number' && Number.isFinite(mapX)
            ? { px: mapX, py: mapY }
            : null,
      });

      expect(container.querySelector('svg')).toBeNull();
    });
  });

  it('데이터가 바뀌면 오버레이를 다시 그린다', () => {
    const { rerender } = renderOverlay({
      pathNodes: [
        { nodeId: 1, floorId: FLOOR_B2, mapX: 10, mapY: 20 },
        { nodeId: 2, floorId: FLOOR_B2, mapX: 30, mapY: 40 },
      ],
    });
    expect(routeLine()).toHaveAttribute('points', '10,20 30,40');

    rerender(
      <IndoorMapOverlay
        floorId={FLOOR_B2}
        imageWidth={1624}
        imageHeight={969}
        project={identityProject}
        pathNodes={[
          { nodeId: 1, floorId: FLOOR_B2, mapX: 70, mapY: 80 },
          { nodeId: 2, floorId: FLOOR_B2, mapX: 90, mapY: 100 },
        ]}
      />,
    );
    expect(routeLine()).toHaveAttribute('points', '70,80 90,100');
  });
});
