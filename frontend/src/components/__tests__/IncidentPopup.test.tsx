import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IncidentPopup } from '@/components/IncidentPopup';
import type { Incident } from '@/types/api';

// Mock Popup from react-map-gl/mapbox to just render children
vi.mock('react-map-gl/mapbox', () => ({
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-popup">{children}</div>
  ),
}));

function createIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    incident_id: 'inc-001',
    incident_type: 4,
    severity: 3,
    latitude: 37.78,
    longitude: -122.42,
    short_desc: 'Vehicle collision on US-101 NB',
    long_desc: null,
    delay_from_typical_min: 12.5,
    recorded_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    status: 'Active',
    ...overrides,
  };
}

describe('IncidentPopup', () => {
  it('renders incident type label based on incident_type number', () => {
    // type 4 = crash -> "Crash"
    render(<IncidentPopup incident={createIncident({ incident_type: 4 })} onClose={vi.fn()} />);
    expect(screen.getByTestId('incident-type-label')).toHaveTextContent('Crash');
  });

  it('renders construction label for incident_type 1', () => {
    render(<IncidentPopup incident={createIncident({ incident_type: 1 })} onClose={vi.fn()} />);
    expect(screen.getByTestId('incident-type-label')).toHaveTextContent('Construction');
  });

  it('renders congestion label for incident_type 3', () => {
    render(<IncidentPopup incident={createIncident({ incident_type: 3 })} onClose={vi.fn()} />);
    expect(screen.getByTestId('incident-type-label')).toHaveTextContent('Congestion');
  });

  it('renders short_desc text', () => {
    render(<IncidentPopup incident={createIncident()} onClose={vi.fn()} />);
    expect(screen.getByTestId('incident-description')).toHaveTextContent(
      'Vehicle collision on US-101 NB',
    );
  });

  it('renders delay when delay_from_typical_min is provided', () => {
    render(
      <IncidentPopup
        incident={createIncident({ delay_from_typical_min: 12.5 })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('incident-delay')).toHaveTextContent('Delay: 13 min');
  });

  it('does NOT render delay section when delay_from_typical_min is null', () => {
    render(
      <IncidentPopup
        incident={createIncident({ delay_from_typical_min: null })}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('incident-delay')).not.toBeInTheDocument();
  });

  it('renders relative time from recorded_at', () => {
    render(<IncidentPopup incident={createIncident()} onClose={vi.fn()} />);
    const timeEl = screen.getByTestId('incident-time');
    // Should contain "ago" from formatDistanceToNow
    expect(timeEl.textContent).toMatch(/ago/);
  });
});
