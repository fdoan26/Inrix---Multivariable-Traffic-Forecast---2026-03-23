import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccuracyDashboard } from '@/components/AccuracyDashboard';

const mockUseAccuracyMetrics = vi.fn();
vi.mock('@/hooks/useAccuracyMetrics', () => ({
  useAccuracyMetrics: (...args: unknown[]) => mockUseAccuracyMetrics(...args),
}));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AccuracyDashboard />
    </QueryClientProvider>,
  );
}

describe('AccuracyDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state message when corridors array is empty', () => {
    mockUseAccuracyMetrics.mockReturnValue({
      data: { generated_at: '2026-03-20T12:00:00Z', corridors: [] },
      isPending: false,
      isError: false,
    });
    renderDashboard();
    expect(screen.getByTestId('accuracy-empty')).toBeInTheDocument();
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });

  it('shows empty state when all corridors have sample_count 0', () => {
    mockUseAccuracyMetrics.mockReturnValue({
      data: {
        generated_at: '2026-03-20T12:00:00Z',
        corridors: [
          { corridor_id: 'us-101', display_name: 'US-101', sample_count: 0, mae_minutes: null, mape_pct: null, trend: 'stable', by_day_of_week: [] },
        ],
      },
      isPending: false,
      isError: false,
    });
    renderDashboard();
    expect(screen.getByTestId('accuracy-empty')).toBeInTheDocument();
  });

  it('renders corridor rows with display name, MAE, MAPE, sample count, and trend badge', () => {
    mockUseAccuracyMetrics.mockReturnValue({
      data: {
        generated_at: '2026-03-20T12:00:00Z',
        corridors: [
          {
            corridor_id: 'us-101',
            display_name: 'US-101',
            sample_count: 42,
            mae_minutes: 3.2,
            mape_pct: 8.5,
            trend: 'improving',
            by_day_of_week: [
              { day: 1, day_name: 'Monday', mae_minutes: 2.8, mape_pct: 7.2, count: 6 },
            ],
          },
        ],
      },
      isPending: false,
      isError: false,
    });
    renderDashboard();
    expect(screen.getByText('US-101')).toBeInTheDocument();
    expect(screen.getByText('3.2 min')).toBeInTheDocument();
    expect(screen.getByText('8.5%')).toBeInTheDocument();
    expect(screen.getByText('42 samples')).toBeInTheDocument();
  });

  it('shows correct trend badges with colors', () => {
    mockUseAccuracyMetrics.mockReturnValue({
      data: {
        generated_at: '2026-03-20T12:00:00Z',
        corridors: [
          { corridor_id: 'us-101', display_name: 'US-101', sample_count: 10, mae_minutes: 3.0, mape_pct: 8.0, trend: 'improving', by_day_of_week: [] },
          { corridor_id: 'i-280', display_name: 'I-280', sample_count: 10, mae_minutes: 5.0, mape_pct: 12.0, trend: 'degrading', by_day_of_week: [] },
          { corridor_id: 'bay-bridge', display_name: 'Bay Bridge', sample_count: 10, mae_minutes: 4.0, mape_pct: 9.0, trend: 'stable', by_day_of_week: [] },
        ],
      },
      isPending: false,
      isError: false,
    });
    renderDashboard();

    const badges = screen.getAllByTestId('trend-badge');
    // Improving - green
    expect(badges[0].textContent).toContain('Improving');
    expect(badges[0].className).toContain('text-green-400');
    // Degrading - red
    expect(badges[1].textContent).toContain('Degrading');
    expect(badges[1].className).toContain('text-red-400');
    // Stable - gray
    expect(badges[2].textContent).toContain('Stable');
    expect(badges[2].className).toContain('text-gray-400');
  });

  it('expands day-of-week sub-table on corridor row click', () => {
    mockUseAccuracyMetrics.mockReturnValue({
      data: {
        generated_at: '2026-03-20T12:00:00Z',
        corridors: [
          {
            corridor_id: 'us-101',
            display_name: 'US-101',
            sample_count: 42,
            mae_minutes: 3.2,
            mape_pct: 8.5,
            trend: 'improving',
            by_day_of_week: [
              { day: 1, day_name: 'Monday', mae_minutes: 2.8, mape_pct: 7.2, count: 6 },
            ],
          },
        ],
      },
      isPending: false,
      isError: false,
    });
    renderDashboard();

    // Monday should not be visible before click
    expect(screen.queryByText('Monday')).not.toBeInTheDocument();

    // Click the corridor row
    fireEvent.click(screen.getByTestId('accuracy-row-us-101'));

    // Monday should now be visible
    expect(screen.getByText('Monday')).toBeInTheDocument();
  });
});
