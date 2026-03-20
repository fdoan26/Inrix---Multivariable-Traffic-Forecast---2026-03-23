import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CorridorPanel } from '@/components/CorridorPanel';
import { useMapStore } from '@/store/mapStore';
import type { CorridorCurrentResponse } from '@/types/api';

// Mock useCorridorSpeeds
const mockCorridorData: CorridorCurrentResponse[] = [
  {
    corridor_id: 'us-101',
    display_name: 'US-101',
    congestion_level: 'free_flow',
    avg_travel_time_min: 12.5,
    segments: [],
  },
  {
    corridor_id: 'i-280',
    display_name: 'I-280',
    congestion_level: 'moderate',
    avg_travel_time_min: 15.0,
    segments: [],
  },
  {
    corridor_id: 'bay-bridge',
    display_name: 'Bay Bridge Approach',
    congestion_level: 'heavy',
    avg_travel_time_min: 25.0,
    segments: [],
  },
  {
    corridor_id: 'van-ness',
    display_name: 'Van Ness Ave',
    congestion_level: 'free_flow',
    avg_travel_time_min: 8.0,
    segments: [],
  },
  {
    corridor_id: '19th-ave',
    display_name: '19th Ave',
    congestion_level: 'unknown',
    avg_travel_time_min: 10.0,
    segments: [],
  },
  {
    corridor_id: 'market-st',
    display_name: 'Market St',
    congestion_level: 'moderate',
    avg_travel_time_min: 18.0,
    segments: [],
  },
];

vi.mock('@/hooks/useCorridorSpeeds', () => ({
  useCorridorSpeeds: () =>
    mockCorridorData.map((data) => ({
      data,
      isSuccess: true,
      isError: false,
      isFetching: false,
      isPending: false,
    })),
}));

vi.mock('@/components/WeekHeatmap', () => ({
  WeekHeatmap: ({ corridorId }: { corridorId: string }) => (
    <div data-testid="week-heatmap-stub">{corridorId}</div>
  ),
}));

vi.mock('@/hooks/useDepartureWindows', () => ({
  useDepartureWindows: () => ({ data: undefined, isPending: false, isError: false }),
}));

vi.mock('@/components/DepartureResults', () => ({
  DepartureResults: () => <div data-testid="results-stub" />,
}));

vi.mock('@/components/AccuracyDashboard', () => ({
  AccuracyDashboard: () => <div data-testid="accuracy-dashboard-stub" />,
}));

vi.mock('@/hooks/useAccuracyMetrics', () => ({
  useAccuracyMetrics: () => ({ data: undefined, isPending: false, isError: false }),
}));

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CorridorPanel />
    </QueryClientProvider>,
  );
}

describe('CorridorPanel', () => {
  beforeEach(() => {
    useMapStore.setState({
      selectedCorridorId: null,
      incidentsVisible: true,
      lastUpdated: new Date('2026-03-20T07:00:00Z'),
    });
  });

  it('renders all 6 corridor names', () => {
    renderPanel();
    expect(screen.getByText('US-101')).toBeInTheDocument();
    expect(screen.getByText('I-280')).toBeInTheDocument();
    expect(screen.getByText('Bay Bridge Approach')).toBeInTheDocument();
    expect(screen.getByText('Van Ness Ave')).toBeInTheDocument();
    expect(screen.getByText('19th Ave')).toBeInTheDocument();
    expect(screen.getByText('Market St')).toBeInTheDocument();
  });

  it('shows congestion badge for each corridor', () => {
    renderPanel();
    expect(screen.getByTestId('congestion-badge-us-101')).toBeInTheDocument();
    expect(screen.getByTestId('congestion-badge-i-280')).toBeInTheDocument();
    expect(
      screen.getByTestId('congestion-badge-bay-bridge'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('congestion-badge-van-ness'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('congestion-badge-19th-ave'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('congestion-badge-market-st'),
    ).toBeInTheDocument();
  });

  it('clicking a corridor calls selectCorridor with correct ID', () => {
    renderPanel();
    const row = screen.getByTestId('corridor-row-i-280');
    fireEvent.click(row);
    expect(useMapStore.getState().selectedCorridorId).toBe('i-280');
  });

  it('shows "Updated X ago" timestamp text when lastUpdated is set', () => {
    renderPanel();
    expect(screen.getByTestId('last-updated')).toBeInTheDocument();
    expect(screen.getByTestId('last-updated').textContent).toMatch(
      /Updated .+ ago/,
    );
  });

  it('renders incident toggle checkbox', () => {
    renderPanel();
    const toggle = screen.getByTestId('incidents-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });

  it('renders Live and Plan tab buttons', () => {
    renderPanel();
    expect(screen.getByTestId('tab-live')).toBeInTheDocument();
    expect(screen.getByTestId('tab-plan')).toBeInTheDocument();
  });

  it('Live tab is active by default', () => {
    renderPanel();
    const liveTab = screen.getByTestId('tab-live');
    expect(liveTab.className).toContain('border-amber-400');
  });

  it('clicking Plan tab switches to Plan view', () => {
    renderPanel();
    const planTab = screen.getByTestId('tab-plan');
    fireEvent.click(planTab);
    expect(screen.getByTestId('departure-planner')).toBeInTheDocument();
  });

  it('Plan tab renders departure planner form with corridor dropdown', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('tab-plan'));
    expect(screen.getByTestId('corridor-select')).toBeInTheDocument();
    expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
  });

  it('shows WeekHeatmap when corridor is selected in Live tab', () => {
    useMapStore.setState({ selectedCorridorId: 'us-101' });
    renderPanel();
    expect(screen.getByTestId('week-heatmap-stub')).toBeInTheDocument();
    expect(screen.getByTestId('week-heatmap-stub').textContent).toBe('us-101');
  });

  it('corridor list remains visible in Live tab', () => {
    renderPanel();
    expect(screen.getByTestId('corridor-row-us-101')).toBeInTheDocument();
    expect(screen.getByTestId('tab-live').className).toContain('border-amber-400');
  });

  it('renders Accuracy tab button', () => {
    renderPanel();
    expect(screen.getByTestId('tab-accuracy')).toBeInTheDocument();
  });

  it('clicking Accuracy tab shows AccuracyDashboard', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('tab-accuracy'));
    expect(screen.getByTestId('accuracy-dashboard-stub')).toBeInTheDocument();
  });
});
