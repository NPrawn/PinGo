import { render, screen } from '@testing-library/react';
import { CameraFallbackNotice } from './CameraFallbackNotice';

describe('CameraFallbackNotice', () => {
  /** 권한 거부는 사용자가 되돌릴 수 있는 유일한 경우다. 그때만 행동을 안내한다. */
  it('권한 거부에는 허용하라는 안내를 준다', () => {
    render(<CameraFallbackNotice status="denied" />);

    expect(screen.getByText(/카메라 권한을 허용하면/)).toBeInTheDocument();
  });

  /**
   * **기술적 원인을 사용자에게 노출하지 않는다.** 보안 컨텍스트·프로토콜은 지하철에서 앱을 쓰는
   * 사람이 손댈 수 있는 것이 아니다. 그 구분은 개발 빌드의 콘솔 경고가 맡는다.
   */
  it.each(['unsupported', 'error'] as const)('%s 문구에 기술 용어를 담지 않는다', (status) => {
    const { container } = render(<CameraFallbackNotice status={status} />);
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/HTTPS|localhost|보안 컨텍스트|getUserMedia|http:/);
    expect(text.length).toBeGreaterThan(0);
  });

  /**
   * 사라지지 않는 설명이라 live region으로 두지 않는다. 이 저장소에서 `status`는 로딩처럼
   * 일시적인 알림의 자리이고, 화면 테스트가 그것이 비워지는 것을 기다린다.
   */
  it('live region 역할을 갖지 않는다', () => {
    render(<CameraFallbackNotice status="denied" />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  /** 여는 중에 문구를 띄우면 대부분 수백 ms 뒤에 사라져 깜빡이는 것으로만 보인다. */
  it.each(['idle', 'starting', 'live'] as const)(
    '%s 상태에서는 아무것도 그리지 않는다',
    (status) => {
      const { container } = render(<CameraFallbackNotice status={status} />);

      expect(container).toBeEmptyDOMElement();
    },
  );
});
