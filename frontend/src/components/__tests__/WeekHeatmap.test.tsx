import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WeekHeatmap } from '@/components/WeekHeatmap';
import type { ForecastResponse } from '@/types/api';

// Create mock forecast at a known local time
function localISOString(year: number, month: number, day: number, hour: number): string {
  return new Date(year, month, day, hour, 0, 0).toISOString();
}

const mockForecastData: ForecastResponse = {
  corridor_id: 'us-101',
  horizon_hours: 168,
  forecasts: [
    {
      forecast_for: localISOString(2026, 2, 20, 15), // 3pm today
      predicted_minutes: 36,
      p10_minutes: 28,
      p50_minutes: 36,
      p90_minutes: 44,
      model_version: 'baseline_v1',
      weather_modifier: 1.0,
      event_modifier: null,
      school_modifier: 1.05,
    },
    {
      forecast_for: localISOString(2026, 2, 21, 8), // 8am tomorrow
      predicted_minutes: 20,
      p10_minutes: 18,
      p50_minutes: 20,
      p90_minutes: 24,
      model_version: 'baseline_v1',
      weather_modifier: 1.0,
      event_modifier: null,
      school_modifier: null,
    },
  ],
};

const mockUseCorridorForecast = vi.fn();

vi.mock('@/hooks/useCorridorForecast', () => ({
  useCorridorForecast: (...args: unknown[]) => mockUseCorridorForecast(...args),
}));

function renderHeatmap(corridorId = 'us-101') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WeekHeatmap corridorId={corridorId} />
    </QueryClientProvider>,
  );
}

describe('WeekHeatmap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 20, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows skeleton when loading', () => {
    mockUseCorridorForecast.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderHeatmap();
    expect(screen.getByTestId('heatmap-skeleton')).toBeInTheDocument();
  });

  it('shows error message when query errors', () => {
    mockUseCorridorForecast.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    renderHeatmap();
    expect(screen.getByText('Failed to load forecast')).toBeInTheDocument();
  });

  it('renders week-heatmap root element on success', () => {
    mockUseCorridorForecast.mockReturnValue({
      data: mockForecastData,
      isPending: false,
      isError: false,
    });
    renderHeatmap();
    expect(screen.getByTestId('week-heatmap')).toBeInTheDocument();
  });

  it('renders 7 day column headers in "EEE M/d" format', () => {
    mockUseCorridorForecast.mockReturnValue({
      data: mockForecastData,
      isPending: false,
      isError: false,
    });
    renderHeatmap();
    expect(screen.getByText('Fri 3/20')).toBeInTheDocument();
    expect(screen.getByText('Sat 3/21')).toBeInTheDocument();
    expect(screen.getByText('Thu 3/26')).toBeInTheDocument();
  });

  it('renders 17 hour row labels from 6am to 10pm', () => {
    mockUseCorridorForecast.mockReturnValue({
      data: mockForecastData,
      isPending: false,
      isError: false,
    });
    renderHeatmap();
    expect(screen.getByText('6am')).toBeInTheDocument();
    expect(screen.getByText('12pm')).toBeInTheDocument();
    expect(screen.getByText('10pm')).toBeInTheDocument();
  });

  it('renders cell text with p50 value followed by "m"', () => {
    mockUseCorridorForecast.mockReturnValue({
      data: mockForecastData,
      isPending: false,
      isError: false,
    });
    renderHeatmap();
    expect(screen.getByText('36m')).toBeInTheDocument();
    expect(screen.getByText('20m')).toBeInTheDocument();
  });

  it('renders "-" for cells with no forecast data', () => {
    mockUseCorridorForecast.mockReturnValue({
      data: mockForecastData,
      isPending: false,
      isError: false,
    });
    renderHeatmap();
    // Most cells should be "-" since we only have 2 forecasts
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('has title tooltip with p10/p50/p90 values', () => {
    mockUseCorridorForecast.mockReturnValue({
      data: mockForecastData,
      isPending: false,
      isError: false,
    });
    renderHeatmap();
    expect(screen.getByTitle('p10: 28m | p50: 36m | p90: 44m')).toBeInTheDocument();
    expect(screen.getByTitle('p10: 18m | p50: 20m | p90: 24m')).toBeInTheDocument();
  });
});
