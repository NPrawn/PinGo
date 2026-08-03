package com.pingo.backend.route.service;

import com.pingo.backend.route.domain.RouteMoveType;
import com.pingo.backend.route.domain.RouteNode;
import com.pingo.backend.route.service.RouteFinder.Segment;
import com.pingo.backend.usersession.domain.Language;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 경로 단계의 안내 문장을 쓴다(FR-U-010 "단계별 안내 문장").
 *
 * <p>이동 수단만 보면 통로 구간이 전부 "직진하세요" 가 된다. 역삼역 간선 205개 중 180개가
 * 통로라 실제로 그랬고, 꺾이는 지점을 알 수 없어 안내로 쓸 수 없었다. 이전 구간과의 각도를
 * 함께 보아 회전을 붙이고, 층 이동에는 올라가는지 내려가는지를 붙인다.
 */
@Component
public class RouteInstructionWriter {

    /**
     * 직진으로 볼 각도(도). 이보다 크게 꺾이면 좌우 안내를 붙인다.
     *
     * <p>경로 노드는 통로의 굽이를 따라 놓여 있어 실제로 걷는 사람이 회전이라고 느끼지 않는
     * 완만한 꺾임이 많다. 그런 곳마다 "왼쪽으로 도세요" 가 나오면 안내가 오히려 헷갈린다.
     *
     * <p>역삼역 B3 승강장에서 3번 출구까지의 실제 경로로 재어 정했다.
     *
     * <pre>
     *   42.7도  왼쪽   완만한 굽이. 걷는 사람은 꺾었다고 느끼지 않는다
     *  102.0도  왼쪽   거의 직각
     *   46.9도  왼쪽   꺾었다고 느낀다
     *    2.1도         곧게 간다
     *   84.8도  왼쪽
     *   70.1도  오른쪽
     *   18.8도         곧게 간다
     * </pre>
     *
     * <p>30도로 두면 42.7도까지 잡아 왼쪽이 세 번 연달아 나온다. 60도로 올리면 46.9도를 놓쳐
     * 진짜 회전을 빠뜨린다. 42.7과 46.9 사이가 경계이고 45도가 그 사이에 든다.
     *
     * <p><b>표본이 이 경로 하나뿐이다.</b> 현장에서 걸어 보고 어색하면 조정한다.
     */
    private static final double STRAIGHT_MAX_DEGREES = 45.0;

    /** 이보다 크게 꺾이면 좌우가 아니라 되돌아가는 것으로 본다. */
    private static final double TURN_MAX_DEGREES = 150.0;

    /**
     * 한 안내로 합칠 구간들이 처음 방향에서 벗어날 수 있는 최대 각도(도).
     *
     * <p>{@link #STRAIGHT_MAX_DEGREES} 는 <b>인접한 두 구간</b>만 본다. 그것만으로 이어 붙이면
     * 45도 미만으로 조금씩 꺾이는 구간이 끝없이 합쳐진다. 42도씩 세 번 꺾여도 매번 직진으로
     * 판정되므로 126도를 돈 길이 "직진하세요" 한 문장이 된다.
     *
     * <p>그래서 <b>구간의 첫 방향과도</b> 견준다. 역삼역 시드로 B3 출발 노드 43개 × 출구 9곳의
     * 경로를 모두 뽑아, 합쳐지는 구간 938개의 첫 방향 대비 마지막 방향 차이를 재었다.
     *
     * <pre>
     *   중앙 18.8도   90%분위 33.9도   최대 69.9도
     *
     *   상한 30도 -> 938개 중 150개(16.0%)가 더 쪼개진다
     *   상한 45도 -> 71개(7.6%)
     *   상한 60도 -> 45개(4.8%)
     *   상한 90도 -> 0개 (상한이 없는 것과 같다)
     * </pre>
     *
     * <p>{@link #STRAIGHT_MAX_DEGREES} 와 같은 45도로 둔다. "한 걸음을 직진으로 느끼는 한계" 와
     * "여러 걸음을 합쳐 직진이라 부를 한계" 가 같은 값이면 설명할 것이 하나로 줄어든다. 가장
     * 많이 휘는 곳은 GFC몰 연결통로(B1)로, 70도를 도는 세 구간이 여기서 끊긴다.
     */
    private static final double MAX_RUN_DRIFT_DEGREES = 45.0;

    /** 방향을 판단하기에 너무 짧은 구간(m). 좌표 오차가 각도를 지배한다. */
    private static final double MIN_TURN_BASELINE_M = 0.5;

    private static final char HANGUL_FIRST = '가';
    private static final char HANGUL_LAST = '힣';
    private static final int HANGUL_FINAL_COUNT = 28;

    /**
     * 한 단계의 안내.
     *
     * <p><b>문장과 구조를 함께 준다.</b> 클라이언트가 문장을 그대로 써도 되고, {@code turn}·
     * {@code floorDelta} 를 보고 자기 문구와 아이콘을 만들어도 된다. 문장만 주면 언어가 서버에
     * 묶여 일본어·중국어를 넣을 수 없고, 구조만 주면 지금 문장을 쓰고 있는 클라이언트가 깨진다.
     *
     * @param previous 직전 구간. 첫 단계면 {@code null} 이라 회전을 판단하지 않는다
     * @param current  이 단계
     * @param nodes    좌표와 층을 읽을 노드들
     * @param floorOrders 층 ID 에서 {@code floor_order} 로. 층수를 세는 데 쓴다
     * @param language 문장 언어
     */
    public Guidance write(
            Segment previous,
            Segment current,
            Map<Long, RouteNode> nodes,
            Map<Long, Integer> floorOrders,
            Language language
    ) {
        RouteMoveType moveType = current.moveType();
        if (moveType == null) {
            Turn turn = turnOf(previous, current, nodes);
            return new Guidance(move(turn, current.distanceM(), language), turn.code, null);
        }

        return switch (moveType) {
            case WALKWAY -> {
                Turn turn = turnOf(previous, current, nodes);
                yield new Guidance(walkway(turn, current.distanceM(), language), turn.code, null);
            }
            case STAIR, ESCALATOR, ELEVATOR -> {
                Integer floorDelta = floorDelta(current, nodes, floorOrders);
                yield new Guidance(
                        vertical(moveType, floorDelta, language),
                        turnOf(previous, current, nodes).code,
                        floorDelta);
            }
            case GATE -> new Guidance(
                    language == Language.KO ? "개찰구를 통과하세요." : "Go through the fare gate.",
                    turnOf(previous, current, nodes).code,
                    null);
        };
    }

    /**
     * 한 단계의 안내. 문장과 그 문장을 만든 근거를 함께 담는다.
     *
     * @param instruction 사람이 읽을 문장
     * @param turn        {@code straight} · {@code left} · {@code right} · {@code around}.
     *                    첫 단계이거나 구간이 너무 짧아 판단할 수 없으면 {@code null}
     * @param floorDelta  오르내리는 층수. 위로 가면 양수다. 층 이동이 아니거나 층을 모르면
     *                    {@code null}. 같은 층 안의 계단이면 0 이다
     */
    public record Guidance(String instruction, String turn, Integer floorDelta) {
    }

    /**
     * 앞 구간에 이어 붙여 한 안내로 합칠 수 있는지.
     *
     * <p>간선 하나가 안내 하나가 되면 긴 통로에서 같은 문장이 되풀이된다. 역삼역 승강장은 복도
     * 노드가 평균 7.7m 마다 있어 B3 서쪽 끝에서 8번 출구까지 "직진하세요" 가 11번 연달아 나왔다.
     * 노드가 있다는 것은 지도에 선을 그릴 꼭짓점이 있다는 뜻일 뿐, 사용자가 거기서 무엇을 하지
     * 않는다. 그러면 한 번의 행동이므로 한 문장이어야 한다. (S15P11A206-339)
     *
     * <p>네 조건을 모두 만족할 때만 합친다.
     *
     * <ol>
     *   <li>양쪽 다 통로다 — 계단·엘리베이터·개찰구는 각각 할 행동이 있다</li>
     *   <li>직전 구간에서 꺾이지 않는다({@link #STRAIGHT_MAX_DEGREES})</li>
     *   <li>구간의 첫 방향에서도 벗어나지 않는다({@link #MAX_RUN_DRIFT_DEGREES})</li>
     *   <li>높이가 같다 — 역삼역 B1 은 개찰구 위 중간층이 별도 층이 아니라 같은 {@code floorId}
     *       안의 {@code map_z=7.5} 노드로 돼 있어, 층만 보면 바닥과 중간층을 한 구간으로 합친다</li>
     * </ol>
     *
     * <p>방향을 판단할 수 없으면({@link Turn#UNKNOWN}) 합치지 않는다. 모르는 것을 직진으로
     * 취급하면 실제로 꺾이는 구간이 조용히 흡수된다.
     *
     * @param runStart  지금 묶고 있는 구간의 첫 간선
     * @param previous  지금까지 묶은 마지막 간선
     * @param candidate 이어 붙일지 판단할 간선
     */
    public boolean continuesStraightRun(
            Segment runStart,
            Segment previous,
            Segment candidate,
            Map<Long, RouteNode> nodes
    ) {
        if (previous.moveType() != RouteMoveType.WALKWAY || candidate.moveType() != RouteMoveType.WALKWAY) {
            return false;
        }
        if (!sameHeight(runStart.fromNodeId(), candidate.toNodeId(), nodes)) {
            return false;
        }
        if (turnOf(previous, candidate, nodes) != Turn.STRAIGHT) {
            return false;
        }

        Double drift = deviationDegrees(runStart, candidate, nodes);
        return drift != null && drift <= MAX_RUN_DRIFT_DEGREES;
    }

    /**
     * 두 노드의 캐노니컬 높이가 같은지.
     *
     * <p>높이를 모르는 노드가 섞이면 합치지 않는다 — 관리자가 높이를 넣지 않은 노드가 중간층일
     * 수도 있어서다. 둘 다 모르면 층 정보가 아예 없는 역이므로 같은 높이로 본다.
     */
    private boolean sameHeight(long fromNodeId, long toNodeId, Map<Long, RouteNode> nodes) {
        RouteNode from = nodes.get(fromNodeId);
        RouteNode to = nodes.get(toNodeId);
        if (from == null || to == null) {
            return false;
        }

        BigDecimal fromZ = from.getMapZ();
        BigDecimal toZ = to.getMapZ();
        if (fromZ == null || toZ == null) {
            return fromZ == null && toZ == null;
        }
        return fromZ.compareTo(toZ) == 0;
    }

    /**
     * 이전 구간에서 이 구간으로 얼마나 꺾이는지.
     *
     * <p><b>외적이 양수면 오른쪽이다.</b> 캐노니컬 프레임은 +y 가 남쪽이라 이미지 좌표처럼
     * 뒤집혀 있고, 그래서 표준 수학 좌표와 손잡이가 반대다. 역삼역 출구의 실측 GPS 로 확인했다
     * — 출구 6(캐노 y −39.9)이 출구 2(캐노 y +48.5)보다 북쪽이다. 동쪽(+x)에서 남쪽(+y)으로
     * 도는 것이 우회전이고 그때 외적이 양수다.
     */
    private Turn turnOf(Segment previous, Segment current, Map<Long, RouteNode> nodes) {
        if (previous == null) {
            return Turn.UNKNOWN;
        }

        Double degrees = deviationDegrees(previous, current, nodes);
        if (degrees == null) {
            return Turn.UNKNOWN;
        }
        if (degrees <= STRAIGHT_MAX_DEGREES) {
            return Turn.STRAIGHT;
        }
        if (degrees >= TURN_MAX_DEGREES) {
            return Turn.AROUND;
        }

        double[] before = direction(previous, nodes);
        double[] after = direction(current, nodes);
        double cross = before[0] * after[1] - before[1] * after[0];
        return cross > 0 ? Turn.RIGHT : Turn.LEFT;
    }

    /** 두 구간의 방향 차이(도). 좌우는 구분하지 않는다. 방향을 알 수 없으면 {@code null}. */
    private Double deviationDegrees(Segment before, Segment after, Map<Long, RouteNode> nodes) {
        double[] first = direction(before, nodes);
        double[] second = direction(after, nodes);
        if (first == null || second == null) {
            return null;
        }

        double cross = first[0] * second[1] - first[1] * second[0];
        double dot = first[0] * second[0] + first[1] * second[1];
        return Math.toDegrees(Math.atan2(Math.abs(cross), dot));
    }

    /** 구간의 단위 방향. 노드가 없거나 너무 짧으면 {@code null}. */
    private double[] direction(Segment segment, Map<Long, RouteNode> nodes) {
        RouteNode from = nodes.get(segment.fromNodeId());
        RouteNode to = nodes.get(segment.toNodeId());
        if (from == null || to == null) {
            return null;
        }

        double dx = to.getMapX().doubleValue() - from.getMapX().doubleValue();
        double dy = to.getMapY().doubleValue() - from.getMapY().doubleValue();
        double length = Math.hypot(dx, dy);
        if (length < MIN_TURN_BASELINE_M) {
            return null;
        }
        return new double[] {dx / length, dy / length};
    }

    private String walkway(Turn turn, BigDecimal distanceM, Language language) {
        String distance = formatDistance(distanceM);
        if (!turn.isTurning()) {
            return language == Language.KO
                    ? "%s 직진하세요.".formatted(distance)
                    : "Go straight for %s.".formatted(distance);
        }
        return language == Language.KO
                ? "%s %s 이동하세요.".formatted(turn.ko, distance)
                : "%s and go %s.".formatted(turn.en, distance);
    }

    /** 이동 수단을 모르는 간선. 방향만 붙이고 수단은 말하지 않는다. */
    private String move(Turn turn, BigDecimal distanceM, Language language) {
        String distance = formatDistance(distanceM);
        if (!turn.isTurning()) {
            return language == Language.KO
                    ? "%s 이동하세요.".formatted(distance)
                    : "Go %s.".formatted(distance);
        }
        return language == Language.KO
                ? "%s %s 이동하세요.".formatted(turn.ko, distance)
                : "%s and go %s.".formatted(turn.en, distance);
    }

    /**
     * 층 이동 안내.
     *
     * <p>층수는 {@code map_z} 가 아니라 {@code station_floor.floor_order} 로 센다. 높이 차를
     * 층고로 나누면 층고를 가정하게 되는데, 역 by 역으로 다르고 역삼역 B1 처럼 한 층 안에 높이가
     * 다른 구간(중간층 {@code map_z=7.5})이 있으면 틀린다. 층 순서는 그런 가정이 필요 없다.
     *
     * <p>층 정보를 못 찾거나 같은 층 안의 이동이면 방향 없이 수단만 말한다. 실제로 역삼역
     * B1 개찰구 위 중간층으로 오르내리는 계단이 여기 해당한다.
     */
    private String vertical(RouteMoveType moveType, Integer floors, Language language) {
        String means = meansOf(moveType, language);

        if (floors == null || floors == 0) {
            return language == Language.KO
                    ? "%s%s 이용해 이동하세요.".formatted(means, objectParticle(means))
                    : "Take the %s.".formatted(means);
        }

        int count = Math.abs(floors);
        boolean up = floors > 0;
        if (language == Language.KO) {
            return "%s%s %s %s.".formatted(means, directionParticle(means),
                    count == 1 ? "한 층" : count + "개 층",
                    up ? "올라가세요" : "내려가세요");
        }
        return "Take the %s %s %s.".formatted(means, up ? "up" : "down",
                count == 1 ? "one floor" : count + " floors");
    }

    /**
     * 받침에 맞는 목적격 조사.
     *
     * <p>{@code 계단을(를)} 같은 표기가 사용자에게 그대로 보이면 안 된다. 한글 음절은
     * {@code (코드 - 0xAC00) % 28} 이 0 이면 받침이 없다.
     */
    private String objectParticle(String word) {
        return hasFinalConsonant(word) ? "을" : "를";
    }

    /** 받침에 맞는 방향 조사. 받침이 없으면 {@code 로}, 있으면 {@code 으로}. */
    private String directionParticle(String word) {
        return hasFinalConsonant(word) ? "으로" : "로";
    }

    private boolean hasFinalConsonant(String word) {
        char last = word.charAt(word.length() - 1);
        if (last < HANGUL_FIRST || last > HANGUL_LAST) {
            return false;
        }
        return (last - HANGUL_FIRST) % HANGUL_FINAL_COUNT != 0;
    }

    /**
     * 몇 층 오르내리는지. 위로 가면 양수다. 판단할 수 없으면 {@code null}.
     *
     * <p>{@code floor_order} 는 위층이 작은 값이다(B1 이 B2 보다 작다). 사용자에게는 위로
     * 가는 것이 양수인 편이 읽기 쉬우므로 부호를 뒤집는다.
     */
    private Integer floorDelta(Segment segment, Map<Long, RouteNode> nodes, Map<Long, Integer> floorOrders) {
        RouteNode from = nodes.get(segment.fromNodeId());
        RouteNode to = nodes.get(segment.toNodeId());
        if (from == null || to == null) {
            return null;
        }

        Integer fromOrder = floorOrders.get(from.getFloorId());
        Integer toOrder = floorOrders.get(to.getFloorId());
        if (fromOrder == null || toOrder == null) {
            return null;
        }
        return fromOrder - toOrder;
    }

    private String meansOf(RouteMoveType moveType, Language language) {
        boolean korean = language == Language.KO;
        return switch (moveType) {
            case STAIR -> korean ? "계단" : "stairs";
            case ESCALATOR -> korean ? "에스컬레이터" : "escalator";
            case ELEVATOR -> korean ? "엘리베이터" : "elevator";
            default -> korean ? "통로" : "passage";
        };
    }

    private String formatDistance(BigDecimal distanceM) {
        return distanceM.setScale(0, RoundingMode.HALF_UP).toPlainString() + "m";
    }

    /**
     * 회전.
     *
     * <p>{@link #UNKNOWN} 과 {@link #STRAIGHT} 는 문장은 같지만 뜻이 다르다. 앞은 판단할 근거가
     * 없는 것이고(첫 단계이거나 구간이 너무 짧다) 뒤는 재어 보니 곧게 간다는 것이다. 클라이언트가
     * 화살표를 그릴 때 "모름"과 "직진"을 다르게 다룰 수 있어야 해서 코드를 나눈다.
     */
    private enum Turn {
        UNKNOWN(null, null, null),
        STRAIGHT("straight", null, null),
        LEFT("left", "왼쪽으로 돌아", "Turn left"),
        RIGHT("right", "오른쪽으로 돌아", "Turn right"),
        AROUND("around", "뒤로 돌아", "Turn around");

        private final String code;
        private final String ko;
        private final String en;

        Turn(String code, String ko, String en) {
            this.code = code;
            this.ko = ko;
            this.en = en;
        }

        private boolean isTurning() {
            return ko != null;
        }
    }
}
