import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { CounselorConsultation, CounselorConsultationPage } from '@/shared/api';
import { HistoryPage } from './HistoryPage';

const mocks = vi.hoisted(() => ({
  useCounselorConsultations: vi.fn(),
  getCounselorMe: vi.fn().mockResolvedValue({ accountId: 7, name: '내 상담자' }),
  getConsultationSummary: vi.fn().mockResolvedValue(null),
  submitConsultationTranscript: vi.fn(),
}));

vi.mock('@/entities/consult', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/consult')>()),
  useCounselorConsultations: mocks.useCounselorConsultations,
}));

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  getCounselorMe: mocks.getCounselorMe,
  getConsultationSummary: mocks.getConsultationSummary,
  submitConsultationTranscript: mocks.submitConsultationTranscript,
}));

vi.mock('@/widgets/counselor-console', () => ({
  CounselorConsoleShell: ({ children }: { children: ReactNode }) => children,
}));

function consultation(
  consultationId: string,
  counselorId: number,
  currentLocationLabel: string,
): CounselorConsultation {
  return {
    consultationId,
    counselorId,
    currentLocationLabel,
    destinationLabel: '3번 출구',
    problemType: 'CANNOT_FIND_EXIT',
    status: 'ENDED',
    requestedAt: '2026-08-06T10:25:00+09:00',
  };
}

function historyPage(): CounselorConsultationPage {
  const content = [
    consultation('cs_mine_ABC123', 7, 'B2 개찰구 앞'),
    consultation('cs_other_DEF456', 8, '1호선 승강장'),
  ];
  return {
    content,
    page: 0,
    size: 2_000,
    totalElements: content.length,
    totalPages: 1,
    first: true,
    last: true,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCounselorMe.mockResolvedValue({ accountId: 7, name: '내 상담자' });
    mocks.getConsultationSummary.mockResolvedValue(null);
    mocks.useCounselorConsultations.mockReturnValue({
      data: historyPage(),
      isPending: false,
      isError: false,
      isFetching: false,
    });
  });

  it('전체 이력을 기본 표시하고 내 상담만 필터링한다', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '상담 이력' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전체 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('button', { name: '내 상담만 1' })).toBeInTheDocument();
    expect(screen.getByTitle('cs_mine_ABC123')).toBeInTheDocument();
    expect(screen.getByTitle('cs_other_DEF456')).toBeInTheDocument();
    expect(screen.getAllByText('내 상담')).toHaveLength(1);
    expect(mocks.useCounselorConsultations).toHaveBeenCalledWith({
      status: 'ENDED',
      page: 0,
      size: 2_000,
      sort: 'requestedAt,desc',
    });

    fireEvent.click(screen.getByRole('button', { name: '내 상담만 1' }));

    expect(screen.getByTitle('cs_mine_ABC123')).toBeInTheDocument();
    expect(screen.queryByTitle('cs_other_DEF456')).not.toBeInTheDocument();
  });

  it('접힌 카드에서는 요약을 조회하지 않고 상세를 열 때만 조회한다', async () => {
    renderPage();

    await screen.findByRole('button', { name: '내 상담만 1' });
    expect(mocks.getConsultationSummary).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: '상세 보기' })[0]);

    await waitFor(() =>
      expect(mocks.getConsultationSummary).toHaveBeenCalledWith('cs_mine_ABC123'),
    );
    expect(
      await screen.findByText('저장된 상담 내용이 없어 AI 요약을 제공하지 않습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'AI 요약' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '상담 전문' })).toBeInTheDocument();
  });
});
