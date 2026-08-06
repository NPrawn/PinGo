import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type {
  CounselorConsultation,
  CounselorConsultationListParams,
  CounselorConsultationPage,
} from '@/shared/api';
import { RequestsPage } from './RequestsPage';

const mocks = vi.hoisted(() => ({
  useCounselorConsultations: vi.fn(),
  getCounselorMe: vi.fn().mockResolvedValue({ accountId: 7, name: '내 상담자' }),
}));

vi.mock('@/entities/consult', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/consult')>()),
  useCounselorConsultations: mocks.useCounselorConsultations,
}));

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  getCounselorMe: mocks.getCounselorMe,
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
        if (params.status === 'WAITING') {
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
              consultation('cs_mine', params.status ?? 'ACCEPTED', 7, '내 상담 위치'),
              consultation('cs_other', params.status ?? 'ACCEPTED', 8, '남의 상담 위치'),
            ],
            params.page ?? 0,
            (params.page ?? 0) > 0,
          ),
          isPending: false,
          isError: false,
          isFetching: false,
        };
      },
    );
  });

  it('상태와 페이지 조건으로 조회하고 다른 상담자의 배정 건은 숨긴다', async () => {
    renderPage();

    expect(await screen.findAllByText('대기 상담 위치')).not.toHaveLength(0);
    expect(mocks.useCounselorConsultations).toHaveBeenLastCalledWith({
      status: 'WAITING',
      page: 0,
      size: 10,
      sort: 'requestedAt,asc',
    });

    fireEvent.change(screen.getByLabelText('상담 상태 필터'), {
      target: { value: 'ACCEPTED' },
    });

    expect(await screen.findAllByText('내 상담 위치')).not.toHaveLength(0);
    expect(screen.queryByText('남의 상담 위치')).not.toBeInTheDocument();
    expect(mocks.useCounselorConsultations).toHaveBeenLastCalledWith({
      status: 'ACCEPTED',
      page: 0,
      size: 10,
      sort: 'requestedAt,asc',
    });

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() =>
      expect(mocks.useCounselorConsultations).toHaveBeenLastCalledWith({
        status: 'ACCEPTED',
        page: 1,
        size: 10,
        sort: 'requestedAt,asc',
      }),
    );
  });
});
