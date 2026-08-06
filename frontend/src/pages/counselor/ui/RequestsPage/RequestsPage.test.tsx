import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type {
  CounselorConsultation,
  CounselorConsultationListParams,
  CounselorConsultationPage,
} from '@/shared/api';
import { RequestsPage } from './RequestsPage';
import styles from './RequestsPage.module.css';

const mocks = vi.hoisted(() => ({
  useCounselorConsultations: vi.fn(),
}));

vi.mock('@/entities/consult', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/consult')>()),
  useCounselorConsultations: mocks.useCounselorConsultations,
}));

vi.mock('@/widgets/counselor-console', () => ({
  CounselorConsoleShell: ({ children }: { children: ReactNode }) => children,
}));

function consultation(
  consultationId: string,
  status: CounselorConsultation['status'],
  counselorId: number | undefined,
  currentLocationLabel: string,
): CounselorConsultation {
  return {
    consultationId,
    status,
    counselorId,
    currentLocationLabel,
    requestedAt: '2026-08-06T00:00:00Z',
  };
}

function page(
  content: CounselorConsultation[],
  pageNumber: number,
  last: boolean,
): CounselorConsultationPage {
  return {
    content,
    page: pageNumber,
    size: 10,
    totalElements: last ? content.length : 11,
    totalPages: last ? pageNumber + 1 : pageNumber + 2,
    first: pageNumber === 0,
    last,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RequestsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RequestsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCounselorConsultations.mockImplementation(
      (params: CounselorConsultationListParams) => {
        if (params.scope === 'ALL') {
          return {
            data: page(
              [consultation('cs_waiting', 'WAITING', undefined, '대기 상담 위치')],
              params.page ?? 0,
              true,
            ),
            isPending: false,
            isError: false,
            isFetching: false,
          };
        }

        return {
          data: page(
            [
              consultation('cs_mine_accepted', 'ACCEPTED', 7, '내 수락 상담 위치'),
              consultation('cs_mine_progress', 'IN_PROGRESS', 7, '내 진행 상담 위치'),
            ],
            params.page ?? 0,
            true,
          ),
          isPending: false,
          isError: false,
          isFetching: false,
        };
      },
    );
  });

  it('전체 상담 대기에서 미배정 대기 요청만 보여 준다', async () => {
    renderPage();

    expect(await screen.findAllByText('대기 상담 위치')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: '전체 상담 대기' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(mocks.useCounselorConsultations).toHaveBeenLastCalledWith({
      status: 'WAITING',
      scope: 'ALL',
      page: 0,
      size: 10,
      sort: 'requestedAt,asc',
    });
  });

  it('내 상담에서 서버가 페이지 처리한 수락·진행 상담을 보여 준다', async () => {
    renderPage();

    const mineButton = await screen.findByRole('button', { name: '내 상담' });
    expect(mineButton).toBeEnabled();
    fireEvent.click(mineButton);

    expect(await screen.findAllByText('내 수락 상담 위치')).not.toHaveLength(0);
    expect(screen.getAllByText('내 진행 상담 위치')).not.toHaveLength(0);
    expect(mocks.useCounselorConsultations).toHaveBeenLastCalledWith({
      statuses: ['ACCEPTED', 'IN_PROGRESS'],
      scope: 'MINE',
      page: 0,
      size: 10,
      sort: 'requestedAt,asc',
    });
  });

  it('전체 상담 대기는 서버 페이지를 이동한다', async () => {
    mocks.useCounselorConsultations.mockImplementation(
      (params: CounselorConsultationListParams) => ({
        data: page(
          [
            consultation(
              `cs_waiting_${params.page ?? 0}`,
              'WAITING',
              undefined,
              `대기 상담 ${params.page ?? 0}페이지`,
            ),
          ],
          params.page ?? 0,
          (params.page ?? 0) === 1,
        ),
        isPending: false,
        isError: false,
        isFetching: false,
      }),
    );
    renderPage();

    expect(await screen.findAllByText('대기 상담 0페이지')).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findAllByText('대기 상담 1페이지')).not.toHaveLength(0);
    expect(mocks.useCounselorConsultations).toHaveBeenLastCalledWith({
      status: 'WAITING',
      scope: 'ALL',
      page: 1,
      size: 10,
      sort: 'requestedAt,asc',
    });
  });

  it('빈 상담 안내 문구에만 목록 안쪽 여백을 적용한다', () => {
    mocks.useCounselorConsultations.mockReturnValue({
      data: page([], 0, true),
      isPending: false,
      isError: false,
      isFetching: false,
    });
    renderPage();

    expect(screen.getByText('대기 중인 상담이 없습니다.')).toHaveClass(styles.stateMessage);
  });

  it('상담 요청을 불러오는 동안 페이지 내부 로더를 중복 표시하지 않는다', () => {
    mocks.useCounselorConsultations.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      isFetching: true,
    });
    renderPage();

    expect(screen.getByLabelText('상담 요청 목록')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('상담 요청 상세')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('왼쪽 목록에서 상담 요청을 선택해 주세요.')).not.toBeInTheDocument();
  });
});
