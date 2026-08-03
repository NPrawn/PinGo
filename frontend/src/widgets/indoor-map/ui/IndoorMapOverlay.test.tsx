import { cleanup, render, screen } from '@testing-library/react';
import type { Facility } from '@/entities/facility';
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
  currentHeadingImageDeg?: number | null;
  destination?: IndoorPoint | null;
  destinationLabel?: string | null;
  facilities?: readonly Facility[];
  selectedFacilityId?: number | null;
  onSelectFacility?: (facility: Facility) => void;
  viewScale?: number;
  pathNodes?: readonly RoutePathNode[];
  waypointNodeIds?: readonly number[];
  project?: (mapX: number, mapY: number) => PixelPoint | null;
}) {
  return render(
    <IndoorMapOverlay
      floorId={props.floorId ?? FLOOR_B2}
      imageWidth={1624}
      imageHeight={969}
      project={props.project ?? identityProject}
      currentLocation={props.currentLocation}
      currentHeadingImageDeg={props.currentHeadingImageDeg}
      destination={props.destination}
      destinationLabel={props.destinationLabel}
      facilities={props.facilities}
      selectedFacilityId={props.selectedFacilityId}
      onSelectFacility={props.onSelectFacility}
      viewScale={props.viewScale}
      pathNodes={props.pathNodes}
      waypointNodeIds={props.waypointNodeIds}
    />,
  );
}

/** 경로 구간별 points 문자열. 구간이 나뉘면 원소가 여러 개다. */
/**
 * 경로 본선의 좌표. 아래 깔리는 테두리(`aria-hidden`)는 세지 않는다.
 *
 * 구간마다 폴리라인이 둘 그려진다 — 도면의 벽·해칭 선에서 경로를 떼어 놓는 테두리와, 그 위의
 * 본선이다. 경로가 어디를 지나는지는 본선 하나로 결정된다.
 */
function routeSegments(): string[] {
  const group = screen.getByRole('img', { name: '이동 경로' });
  return Array.from(group.querySelectorAll('polyline:not([aria-hidden])')).map(
    (line) => line.getAttribute('points') ?? '',
  );
}

/**
 * 경로 본선의 stroke 색. 경유지가 있으면 다리마다 달라진다.
 *
 * CSS 모듈 클래스 이름을 그대로 본다 — 어느 단계가 걸렸는지는 클래스가 결정한다.
 */
function routeToneClasses(): string[] {
  const group = screen.getByRole('img', { name: '이동 경로' });
  return Array.from(group.querySelectorAll('polyline:not([aria-hidden])')).map(
    (line) => line.getAttribute('class') ?? '',
  );
}

/** 진행 방향 화살촉의 회전각. 경로가 향하는 쪽을 가리켜야 한다. */
function directionAngles(): number[] {
  const group = screen.getByRole('img', { name: '이동 경로' });
  return Array.from(group.querySelectorAll('path')).map((mark) => {
    const rotate = /rotate\((-?[\d.]+)\)/.exec(mark.getAttribute('transform') ?? '');
    return Number(rotate?.[1]);
  });
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

  /**
   * 이름이 마커와 떨어져 있으면 안 된다. 프로토타입은 라벨을 화면 비율로 고정해 뒀는데,
   * 그 방식은 목적지가 바뀌거나 층을 옮기면 점과 라벨이 서로 다른 곳을 가리킨다.
   */
  it('목적지 이름을 마커 위에 붙여 그린다', () => {
    renderOverlay({
      destination: { floorId: FLOOR_B2, mapX: 400, mapY: 500 },
      destinationLabel: '3번 출구',
    });

    const marker = screen.getByRole('img', { name: '목적지' });
    const label = marker.querySelector('text');
    const pin = marker.querySelector('circle');

    expect(label).toHaveTextContent('3번 출구');
    expect(label).toHaveAttribute('x', '400');
    expect(pin).toHaveAttribute('cx', '400');
    // 점 위쪽이므로 y가 더 작다.
    expect(Number(label?.getAttribute('y'))).toBeLessThan(500);
  });

  it('목적지 이름을 넘기지 않으면 점만 그린다', () => {
    renderOverlay({ destination: { floorId: FLOOR_B2, mapX: 400, mapY: 500 } });

    expect(screen.getByRole('img', { name: '목적지' }).querySelector('text')).toBeNull();
  });

  describe('시설 마커', () => {
    const RESTROOM: Facility = {
      facilityId: 59,
      stationId: 1,
      floorId: FLOOR_B2,
      facilityType: 'restroom',
      nameKo: '화장실',
      nameEn: 'Restroom',
      mapX: 300,
      mapY: 400,
      linkedNodeId: 130,
      isAccessible: true,
    };
    const OTHER_FLOOR: Facility = { ...RESTROOM, facilityId: 60, floorId: FLOOR_B3 };

    it('표시 층의 시설만 그린다', () => {
      renderOverlay({ facilities: [RESTROOM, OTHER_FLOOR] });

      expect(screen.getAllByRole('img', { name: '화장실' })).toHaveLength(1);
    });

    it('유형에 맞는 아이콘 심볼을 참조한다', () => {
      renderOverlay({ facilities: [RESTROOM] });

      const marker = screen.getByRole('img', { name: '화장실' });

      expect(marker.querySelector('use')).toHaveAttribute('href', '#i-restroom');
      expect(marker.querySelector('circle')).toHaveAttribute('cx', '300');
    });

    /** 층당 30여 개에 모두 이름을 붙이면 도면이 글자로 덮인다. */
    it('이름은 고른 시설에만 붙인다', () => {
      const { rerender } = renderOverlay({ facilities: [RESTROOM] });

      expect(screen.getByRole('img', { name: '화장실' }).querySelector('text')).toBeNull();

      rerender(
        <IndoorMapOverlay
          floorId={FLOOR_B2}
          imageWidth={1624}
          imageHeight={969}
          project={identityProject}
          facilities={[RESTROOM]}
          selectedFacilityId={RESTROOM.facilityId}
        />,
      );

      expect(screen.getByRole('img', { name: '화장실' }).querySelector('text')).toHaveTextContent(
        '화장실',
      );
    });

    it('콜백을 넘기면 마커가 탭을 받는다', () => {
      const onSelect = vi.fn();
      renderOverlay({ facilities: [RESTROOM], onSelectFacility: onSelect });

      const marker = screen.getByRole('button', { name: '화장실' });
      marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onSelect).toHaveBeenCalledWith(RESTROOM);
    });

    /** 시설만 있어도 오버레이를 만들어야 한다. 필터만 켠 상태가 그렇다. */
    it('시설만 있어도 오버레이를 그린다', () => {
      const { container } = renderOverlay({ facilities: [RESTROOM] });

      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  /**
   * 확대해도 마커는 화면상 크기가 그대로여야 한다. 지도와 같이 커지면 도면을 크게 보려고 한
   * 조작인데 마커가 가리는 면적만 늘어난다.
   */
  describe('확대 배율 상쇄', () => {
    const AT: IndoorPoint = { floorId: FLOOR_B2, mapX: 300, mapY: 400 };

    function markerRadius(scale: number): number {
      const { container } = renderOverlay({ currentLocation: AT, viewScale: scale });
      const dot = container.querySelector('g[role="img"] circle:last-of-type');
      return Number(dot?.getAttribute('r'));
    }

    it('배율이 2배면 마커 반지름은 절반이 된다', () => {
      const base = markerRadius(1);
      cleanup();
      const zoomed = markerRadius(2);

      expect(zoomed).toBeCloseTo(base / 2);
    });

    it('좌표는 배율과 무관하게 그대로다', () => {
      const { container } = renderOverlay({ currentLocation: AT, viewScale: 3 });
      const dot = container.querySelector('g[role="img"] circle:last-of-type');

      expect(dot).toHaveAttribute('cx', '300');
      expect(dot).toHaveAttribute('cy', '400');
    });
  });

  it('경로 노드를 순서대로 이은 선을 그린다', () => {
    renderOverlay({
      pathNodes: [
        { nodeId: 1, floorId: FLOOR_B2, mapX: 10, mapY: 20 },
        { nodeId: 2, floorId: FLOOR_B2, mapX: 30, mapY: 40 },
        { nodeId: 3, floorId: FLOOR_B2, mapX: 50, mapY: 60 },
      ],
    });

    expect(routeSegments()).toEqual(['10,20 30,40 50,60']);
  });

  /**
   * 진행 방향.
   *
   * 선만으로는 어느 쪽으로 걸어야 하는지 알 수 없다. 층을 넘나드는 구간에서는 선이 끊겨
   * 출발점·도착점도 함께 사라지므로, 이 층에서의 방향은 선 위에 직접 적혀 있어야 한다.
   */
  it('경로 위에 진행 방향을 일정 간격으로 얹는다', () => {
    renderOverlay({
      pathNodes: [
        { nodeId: 1, floorId: FLOOR_B2, mapX: 0, mapY: 0 },
        { nodeId: 2, floorId: FLOOR_B2, mapX: 2000, mapY: 0 },
      ],
    });

    const angles = directionAngles();

    // 오른쪽으로 곧게 가는 경로다. 화살촉도 모두 그쪽을 가리킨다(0도).
    expect(angles).not.toHaveLength(0);
    angles.forEach((angle) => expect(angle).toBeCloseTo(0));
  });

  /** 방향이 꺾이면 화살촉도 그 구간의 방향을 따른다. 노드마다가 아니라 거리마다 놓인다. */
  it('꺾이는 구간에서는 그 구간의 방향을 가리킨다', () => {
    renderOverlay({
      pathNodes: [
        { nodeId: 1, floorId: FLOOR_B2, mapX: 0, mapY: 0 },
        { nodeId: 2, floorId: FLOOR_B2, mapX: 1000, mapY: 0 },
        { nodeId: 3, floorId: FLOOR_B2, mapX: 1000, mapY: 1000 },
      ],
    });

    const angles = directionAngles();

    // 오른쪽(0도)으로 가다 아래(90도)로 꺾인다. 이미지 좌표계는 y가 아래로 증가한다.
    expect(angles).toContain(0);
    expect(angles).toContain(90);
  });

  /**
   * 경유지가 있는 경로. (S15P11A206-83)
   *
   * 같은 복도를 두 번 지나면 어느 쪽이 먼저인지 알 수 없다. 다리마다 명도를 달리하고 경유지에
   * 번호를 붙여 순서를 남긴다.
   */
  describe('경유지', () => {
    const throughWaypoint = [
      { nodeId: 1, floorId: FLOOR_B2, mapX: 0, mapY: 0 },
      { nodeId: 2, floorId: FLOOR_B2, mapX: 500, mapY: 0 },
      { nodeId: 3, floorId: FLOOR_B2, mapX: 1000, mapY: 0 },
    ];

    /**
     * 그리는 순서가 뒤집혀 있다 — 먼 다리를 먼저, 지금 걷는 다리를 마지막에.
     *
     * 같은 복도를 두 번 지나면 나중에 그린 것이 위에 남는다. 순서를 그대로 두면 연한 먼 다리가
     * 진한 현재 다리를 덮어, 정작 지금 필요한 화살표가 사라진다.
     */
    it('먼 다리를 먼저 그리고 지금 걷는 다리를 위에 얹는다', () => {
      renderOverlay({ pathNodes: throughWaypoint, waypointNodeIds: [2] });

      // 경유지 노드는 두 다리가 공유한다. 한쪽에만 넣으면 그 자리에 틈이 생긴다.
      // 그린 순서대로 나오므로 먼 다리(500→1000)가 앞이다.
      expect(routeSegments()).toEqual(['500,0 1000,0', '0,0 500,0']);

      const [far, near] = routeToneClasses();
      expect(far).toContain('routeFar');
      expect(near).toContain('routeNear');
    });

    it('경유지가 없으면 한 색으로 그린다', () => {
      renderOverlay({ pathNodes: throughWaypoint });

      expect(routeSegments()).toEqual(['0,0 500,0 1000,0']);
      // 단계를 매길 순서가 없다. 기본 색 그대로다.
      expect(routeToneClasses()[0]).not.toContain('routeNear');
      expect(routeToneClasses()[0]).not.toContain('routeFar');
    });

    it('경유지에 번호를 붙인다', () => {
      renderOverlay({
        pathNodes: [
          ...throughWaypoint,
          { nodeId: 4, floorId: FLOOR_B2, mapX: 1500, mapY: 0 },
          { nodeId: 5, floorId: FLOOR_B2, mapX: 2000, mapY: 0 },
        ],
        waypointNodeIds: [2, 4],
      });

      expect(screen.getByRole('img', { name: '경유 1' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: '경유 2' })).toBeInTheDocument();
    });

    it('다른 층의 경유지는 번호를 그리지 않는다', () => {
      renderOverlay({
        pathNodes: [
          { nodeId: 1, floorId: FLOOR_B2, mapX: 0, mapY: 0 },
          { nodeId: 2, floorId: FLOOR_B3, mapX: 500, mapY: 0 },
          { nodeId: 3, floorId: FLOOR_B2, mapX: 1000, mapY: 0 },
        ],
        waypointNodeIds: [2],
      });

      expect(screen.queryByRole('img', { name: '경유 1' })).not.toBeInTheDocument();
    });

    /** 왕복 경로에서 같은 노드를 두 번 지난다. 두 번째 통과를 또 경계로 삼으면 다리가 늘어난다. */
    it('같은 노드를 다시 지나도 다리를 한 번만 나눈다', () => {
      renderOverlay({
        pathNodes: [
          { nodeId: 1, floorId: FLOOR_B2, mapX: 0, mapY: 0 },
          { nodeId: 2, floorId: FLOOR_B2, mapX: 500, mapY: 0 },
          { nodeId: 3, floorId: FLOOR_B2, mapX: 1000, mapY: 0 },
          { nodeId: 2, floorId: FLOOR_B2, mapX: 500, mapY: 0 },
        ],
        waypointNodeIds: [2],
      });

      // 먼 다리가 먼저 그려진다.
      expect(routeSegments()).toEqual(['500,0 1000,0 500,0', '0,0 500,0']);
    });
  });

  /** 너무 짧은 구간에는 놓지 않는다. 마커에 가려 방향은 읽히지 않고 어수선함만 남는다. */
  it('간격의 절반보다 짧은 구간에는 방향을 놓지 않는다', () => {
    renderOverlay({
      pathNodes: [
        { nodeId: 1, floorId: FLOOR_B2, mapX: 0, mapY: 0 },
        { nodeId: 2, floorId: FLOOR_B2, mapX: 10, mapY: 0 },
      ],
    });

    expect(directionAngles()).toHaveLength(0);
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
      expect(routeSegments()).toEqual(['30,30 40,40']);
    });

    it('다른 층을 거쳐 돌아오면 구간을 끊어 그린다', () => {
      // B2에서 출발해 B3를 경유하고 B2로 돌아오는 경로. 두 B2 구간은 이 층에서
      // 이어져 있지 않으므로 한 선으로 이으면 벽을 통과하는 것처럼 보인다.
      const pathNodes: RoutePathNode[] = [
        { nodeId: 1, floorId: FLOOR_B2, mapX: 10, mapY: 10 },
        { nodeId: 2, floorId: FLOOR_B2, mapX: 20, mapY: 20 },
        { nodeId: 3, floorId: FLOOR_B3, mapX: 30, mapY: 30 },
        { nodeId: 4, floorId: FLOOR_B3, mapX: 40, mapY: 40 },
        { nodeId: 5, floorId: FLOOR_B2, mapX: 50, mapY: 50 },
        { nodeId: 6, floorId: FLOOR_B2, mapX: 60, mapY: 60 },
      ];

      renderOverlay({ floorId: FLOOR_B2, pathNodes });
      expect(routeSegments()).toEqual(['10,10 20,20', '50,50 60,60']);
    });

    it('돌아온 구간에 노드가 하나뿐이면 그 구간은 그리지 않는다', () => {
      const pathNodes: RoutePathNode[] = [
        { nodeId: 1, floorId: FLOOR_B2, mapX: 10, mapY: 10 },
        { nodeId: 2, floorId: FLOOR_B2, mapX: 20, mapY: 20 },
        { nodeId: 3, floorId: FLOOR_B3, mapX: 30, mapY: 30 },
        { nodeId: 4, floorId: FLOOR_B2, mapX: 50, mapY: 50 },
      ];

      renderOverlay({ floorId: FLOOR_B2, pathNodes });
      expect(routeSegments()).toEqual(['10,10 20,20']);
    });

    it('층을 여러 번 오가면 구간도 그만큼 나뉜다', () => {
      const pathNodes: RoutePathNode[] = [
        { nodeId: 1, floorId: FLOOR_B2, mapX: 1, mapY: 1 },
        { nodeId: 2, floorId: FLOOR_B2, mapX: 2, mapY: 2 },
        { nodeId: 3, floorId: FLOOR_B3, mapX: 3, mapY: 3 },
        { nodeId: 4, floorId: FLOOR_B2, mapX: 4, mapY: 4 },
        { nodeId: 5, floorId: FLOOR_B2, mapX: 5, mapY: 5 },
        { nodeId: 6, floorId: FLOOR_B3, mapX: 6, mapY: 6 },
        { nodeId: 7, floorId: FLOOR_B2, mapX: 7, mapY: 7 },
        { nodeId: 8, floorId: FLOOR_B2, mapX: 8, mapY: 8 },
      ];

      renderOverlay({ floorId: FLOOR_B2, pathNodes });
      expect(routeSegments()).toEqual(['1,1 2,2', '4,4 5,5', '7,7 8,8']);
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

    it('잘못된 좌표는 구간을 끊지 않고 건너뛴다', () => {
      // 좌표를 모르는 것과 이 층에서 이어져 있지 않은 것은 다르다.
      // 앞뒤 노드는 여전히 그 지점을 지나 연결돼 있으므로 한 구간으로 남긴다.
      renderOverlay({
        pathNodes: [
          { nodeId: 1, floorId: FLOOR_B2, mapX: 10, mapY: 20 },
          { nodeId: 2, floorId: FLOOR_B2, mapX: Number.NaN, mapY: 40 },
          { nodeId: 3, floorId: FLOOR_B2, mapX: 50, mapY: 60 },
        ],
      });

      expect(routeSegments()).toEqual(['10,20 50,60']);
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
    expect(routeSegments()).toEqual(['10,20 30,40']);

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
    expect(routeSegments()).toEqual(['70,80 90,100']);
  });
});

/**
 * 바라보는 방향 표시. (S15P11A206-141)
 *
 * 이미지 픽셀 기준 각도를 받아 마커에 부채꼴을 얹는다. 미터→이미지 각도 변환은 IndoorMapView가
 * 하며 `IndoorMapView.test.tsx`가 검사한다.
 */
describe('IndoorMapOverlay 방향 표시', () => {
  function beam(): SVGPathElement | null {
    const group = screen.queryByRole('img', { name: '현재 위치' });

    return group?.querySelector('path') ?? null;
  }

  it('방향을 받으면 마커에 부채꼴을 얹는다', () => {
    renderOverlay({
      currentLocation: { floorId: FLOOR_B2, mapX: 100, mapY: 200 },
      currentHeadingImageDeg: 45,
    });

    expect(beam()).toHaveAttribute('transform', 'rotate(45 100 200)');
  });

  /**
   * 방향을 모르는 것과 오른쪽(0도)을 보는 것은 다르다. 0으로 채우면 그 차이가 화면에서 사라진다.
   */
  it('방향이 없으면 부채꼴을 그리지 않는다', () => {
    renderOverlay({ currentLocation: { floorId: FLOOR_B2, mapX: 100, mapY: 200 } });

    expect(beam()).toBeNull();
  });

  it('0도도 방향으로 다룬다', () => {
    renderOverlay({
      currentLocation: { floorId: FLOOR_B2, mapX: 100, mapY: 200 },
      currentHeadingImageDeg: 0,
    });

    expect(beam()).toHaveAttribute('transform', 'rotate(0 100 200)');
  });

  it('현재 위치가 없으면 방향만으로는 아무것도 그리지 않는다', () => {
    renderOverlay({ currentHeadingImageDeg: 90 });

    expect(screen.queryByRole('img', { name: '현재 위치' })).not.toBeInTheDocument();
  });
});
