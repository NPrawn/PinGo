import { render, screen, waitFor } from '@testing-library/react';
import { ArDirectionArrow } from './ArDirectionArrow';

/**
 * 안내 화면과 상담 화면이 함께 쓰는 화살표. (S15P11A206-382)
 *
 * 두 화면에서 같은 방향을 가리켜야 하므로, 기울기 상수와 방향 보정이 한 곳에 있다는 것 자체가
 * 검사 대상이다. CSS 변수로 나가는 값을 직접 읽어 확인한다.
 */
describe('ArDirectionArrow', () => {
  it('방향을 모르면 그리지 않는다', () => {
    render(<ArDirectionArrow relativeDeg={null} label="" />);

    // 위를 향한 화살표를 두면 방향을 모르는데 "정면"이라고 말하는 셈이다.
    expect(screen.queryByRole('img')).toBeNull();
  });

  /**
   * 눕힌 평면은 앞뒤 축이 `cos(기울기)`만큼 눌려 보인다. 방향각을 그대로 걸면 화살표가 지도와
   * 다른 곳을 가리킨다 — 45°를 45° 돌리면 화면에서는 28°로 보인다.
   */
  it('눕힌 평면에서도 같은 방향을 가리키도록 각도를 보정한다', async () => {
    render(<ArDirectionArrow relativeDeg={45} label="Turn right" />);

    const arrow = await screen.findByRole('img', { name: 'Turn right' });

    expect(arrow.style.getPropertyValue('--arrow-tilt')).toBe('58deg');
    // atan2(cos58° · sin45°, cos45°) = atan(cos58°) = 27.91°
    expect(Number.parseFloat(arrow.style.getPropertyValue('--arrow-deg'))).toBeCloseTo(27.9, 1);
  });

  /**
   * 경로 반대쪽을 보고 좌우로 조금씩 돌리면 방향각이 `+179°`와 `-179°` 사이를 넘나든다. 접힌
   * 값을 그대로 CSS에 넣으면 358° 회전으로 그려져 화살표가 의미 없이 한 바퀴 돈다.
   */
  it('경계를 넘어도 한 바퀴 돌지 않는다', async () => {
    const { rerender } = render(<ArDirectionArrow relativeDeg={179} label="Turn around" />);

    const arrow = await screen.findByRole('img', { name: 'Turn around' });
    const before = Number.parseFloat(arrow.style.getPropertyValue('--arrow-deg'));

    rerender(<ArDirectionArrow relativeDeg={-179} label="Turn around" />);
    await waitFor(() => {
      expect(Number.parseFloat(arrow.style.getPropertyValue('--arrow-deg'))).not.toBe(before);
    });

    // 실제로 사용자가 돈 것은 2°다. 이어 붙이지 않으면 358°가 나온다.
    const after = Number.parseFloat(arrow.style.getPropertyValue('--arrow-deg'));
    expect(Math.abs(after - before)).toBeLessThan(10);
  });
});
