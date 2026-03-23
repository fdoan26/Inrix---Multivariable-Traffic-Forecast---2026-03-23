import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeparturePlannerForm } from '@/components/DeparturePlannerForm';
import { useMapStore } from '@/store/mapStore';

let mockQueryResult = { data: undefined as any, isPending: false, isError: false };

vi.mock('@/hooks/useDepartureWindows', () => ({
  useDepartureWindows: () => mockQueryResult,
}));

vi.mock('@/components/DepartureResults', () => ({
  DepartureResults: ({ windows }: any) => (
    <div data-testid="results-stub">{windows.length} results</div>
  ),
}));

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DeparturePlannerForm />
    </QueryClientProvider>,
  );
}

function submitForm(date: string, time: string) {
  fireEvent.change(screen.getByTestId('arrival-date'), {
    target: { value: date },
  });
  fireEvent.change(screen.getByTestId('arrival-time'), {
    target: { value: time },
  });
  const form = screen.getByTestId('departure-planner').querySelector('form')!;
  fireEvent.submit(form);
}

describe('DeparturePlannerForm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T12:00:00'));
    mockQueryResult = { data: undefined, isPending: false, isError: false };
    useMapStore.setState({ selectedCorridorId: 'us-101' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders corridor dropdown with 6 options plus placeholder', () => {
    renderForm();
    const select = screen.getByTestId('corridor-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    // 6 corridors + 1 placeholder
    expect(select.options).toHaveLength(7);
  });

  it('renders date input with type="date"', () => {
    renderForm();
    const dateInput = screen.getByTestId('arrival-date') as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();
    expect(dateInput.type).toBe('date');
  });

  it('renders time input with type="time"', () => {
    renderForm();
    const timeInput = screen.getByTestId('arrival-time') as HTMLInputElement;
    expect(timeInput).toBeInTheDocument();
    expect(timeInput.type).toBe('time');
  });

  it('renders submit button with text "Find Best Times"', () => {
    renderForm();
    const btn = screen.getByTestId('submit-btn');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toBe('Find Best Times');
  });

  it('corridor dropdown defaults to selectedCorridorId from store', () => {
    renderForm();
    const select = screen.getByTestId('corridor-select') as HTMLSelectElement;
    expect(select.value).toBe('us-101');
  });

  it('shows "Select a corridor" error when corridor not selected', () => {
    useMapStore.setState({ selectedCorridorId: null });
    renderForm();
    const form = screen.getByTestId('departure-planner').querySelector('form')!;
    fireEvent.submit(form);
    expect(screen.getByText('Select a corridor')).toBeInTheDocument();
  });

  it('shows validation error when date is more than 7 days out', () => {
    renderForm();
    submitForm('2026-03-30', '09:00');
    expect(
      screen.getByText('Arrival must be within the next 7 days'),
    ).toBeInTheDocument();
  });

  it('renders results on valid submit when query returns data', () => {
    mockQueryResult = {
      data: {
        corridor_id: 'us-101',
        arrival_target: '',
        windows: [
          {
            departure_at: '',
            estimated_travel_min: 30,
            p10_minutes: 25,
            p90_minutes: 35,
            congestion_risk: 'free_flow',
            reason: null,
          },
        ],
      },
      isPending: false,
      isError: false,
    };
    renderForm();
    submitForm('2026-03-22', '09:00');
    expect(screen.getByTestId('results-stub')).toBeInTheDocument();
    expect(screen.getByTestId('results-stub').textContent).toBe('1 results');
  });

  it('shows loading spinner when isPending and query is enabled', () => {
    mockQueryResult = { data: undefined, isPending: true, isError: false };
    renderForm();
    submitForm('2026-03-22', '09:00');
    expect(screen.getByTestId('results-loading')).toBeInTheDocument();
  });

  it('shows error message on API error', () => {
    mockQueryResult = { data: undefined, isPending: false, isError: true };
    renderForm();
    submitForm('2026-03-22', '09:00');
    expect(
      screen.getByText('No forecast data available for this corridor and time'),
    ).toBeInTheDocument();
  });
});
