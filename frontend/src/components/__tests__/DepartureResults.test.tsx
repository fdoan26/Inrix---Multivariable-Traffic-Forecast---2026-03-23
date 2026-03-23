import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DepartureResults } from '@/components/DepartureResults';
import type { DepartureWindow } from '@/types/api';

const mockWindows: DepartureWindow[] = [
  {
    departure_at: '2026-03-25T23:30:00.000Z',
    estimated_travel_min: 32,
    p10_minutes: 26,
    p90_minutes: 40,
    congestion_risk: 'free_flow',
    reason: null,
  },
  {
    departure_at: '2026-03-25T23:00:00.000Z',
    estimated_travel_min: 36,
    p10_minutes: 28,
    p90_minutes: 44,
    congestion_risk: 'moderate',
    reason: 'Slow due to rain/fog forecast',
  },
  {
    departure_at: '2026-03-25T22:30:00.000Z',
    estimated_travel_min: 42,
    p10_minutes: 34,
    p90_minutes: 52,
    congestion_risk: 'heavy',
    reason: 'Slow due to Giants game',
  },
];

describe('DepartureResults', () => {
  it('renders departure-results container', () => {
    render(<DepartureResults windows={mockWindows} />);
    expect(screen.getByTestId('departure-results')).toBeInTheDocument();
  });

  it('renders each window as a list item with correct data-testid', () => {
    render(<DepartureResults windows={mockWindows} />);
    expect(screen.getByTestId('departure-window-0')).toBeInTheDocument();
    expect(screen.getByTestId('departure-window-1')).toBeInTheDocument();
    expect(screen.getByTestId('departure-window-2')).toBeInTheDocument();
  });

  it('first item has amber highlight classes', () => {
    render(<DepartureResults windows={mockWindows} />);
    const first = screen.getByTestId('departure-window-0');
    expect(first.className).toContain('bg-amber-900/30');
    expect(first.className).toContain('border-amber-700');
  });

  it('second and third items do NOT have amber highlight', () => {
    render(<DepartureResults windows={mockWindows} />);
    const second = screen.getByTestId('departure-window-1');
    const third = screen.getByTestId('departure-window-2');
    expect(second.className).not.toContain('bg-amber-900/30');
    expect(third.className).not.toContain('bg-amber-900/30');
  });

  it('shows travel time with confidence range', () => {
    render(<DepartureResults windows={mockWindows} />);
    expect(screen.getByText(/32 min/)).toBeInTheDocument();
    expect(screen.getByText(/26.*40/)).toBeInTheDocument();
    expect(screen.getByText(/36 min/)).toBeInTheDocument();
    expect(screen.getByText(/28.*44/)).toBeInTheDocument();
  });

  it('shows reason text for results with non-null reason', () => {
    render(<DepartureResults windows={mockWindows} />);
    expect(screen.getByText('Slow due to rain/fog forecast')).toBeInTheDocument();
    expect(screen.getByText('Slow due to Giants game')).toBeInTheDocument();
  });

  it('does not show reason text for results with null reason', () => {
    render(<DepartureResults windows={mockWindows} />);
    // First result has reason: null, so no italic reason paragraph inside it
    const firstItem = screen.getByTestId('departure-window-0');
    const italicElements = firstItem.querySelectorAll('.italic');
    expect(italicElements).toHaveLength(0);
  });

  it('congestion badge dots have correct background color', () => {
    render(<DepartureResults windows={mockWindows} />);
    const dot0 = screen.getByTestId('congestion-dot-0');
    const dot1 = screen.getByTestId('congestion-dot-1');
    const dot2 = screen.getByTestId('congestion-dot-2');
    // jsdom converts hex to rgb format
    expect(dot0.style.backgroundColor).toBe('rgb(16, 185, 129)');
    expect(dot1.style.backgroundColor).toBe('rgb(245, 158, 11)');
    expect(dot2.style.backgroundColor).toBe('rgb(239, 68, 68)');
  });

  it('shows "No departure windows found" for empty array', () => {
    render(<DepartureResults windows={[]} />);
    expect(screen.getByText('No departure windows found')).toBeInTheDocument();
  });
});
