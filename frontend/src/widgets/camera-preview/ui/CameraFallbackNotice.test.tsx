import { render, screen } from '@testing-library/react';
import { CameraFallbackNotice } from './CameraFallbackNotice';

describe('CameraFallbackNotice', () => {
  /**
   * 실기기 확인 때 LAN 주소로 접속하면 보안 컨텍스트가 아니어서 `getUserMedia`가 막힌다.
   * 그 경우와 권한 거부는 대응이 다르므로 문구도 달라야 한다.
   */
  it('보안 컨텍스트가 아니면 접속 방법을 알려 준다', () => {
    render(<CameraFallbackNotice status="unsupported" />);

    expect(screen.getByText(/HTTPS 또는 localhost로 접속해 주세요/)).toBeInTheDocument();
  });

  it('권한 거부는 권한 문제로 알려 준다', () => {
    render(<CameraFallbackNotice status="denied" />);

    expect(screen.getByText(/카메라 권한이 거부되어/)).toBeInTheDocument();
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
