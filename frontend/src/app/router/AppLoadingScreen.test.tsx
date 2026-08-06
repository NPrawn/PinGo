import { render, screen } from '@testing-library/react';
import { AppLoadingScreen } from './AppLoadingScreen';

describe('AppLoadingScreen', () => {
  it('라우트를 준비하는 동안 스피너와 접근성 상태를 보여 준다', () => {
    render(<AppLoadingScreen />);

    expect(screen.getByLabelText('PinGo 페이지 준비')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('페이지를 준비하고 있습니다.');
    expect(screen.queryByText('불러오는 중…')).not.toBeInTheDocument();
  });
});
