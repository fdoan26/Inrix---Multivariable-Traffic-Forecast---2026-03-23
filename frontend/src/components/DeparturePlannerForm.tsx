import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { format, addDays } from 'date-fns';
import { useMapStore } from '@/store/mapStore';
import { useDepartureWindows } from '@/hooks/useDepartureWindows';
import { DepartureResults } from '@/components/DepartureResults';
import { CORRIDOR_IDS, CORRIDOR_DISPLAY_NAMES } from '@/data/corridors';

const departureFormSchema = z.object({
  corridorId: z.string().min(1, 'Select a corridor'),
  date: z.string().min(1, 'Select a date'),
  time: z.string().min(1, 'Select a time'),
});

function validateArrivalRange(date: string, time: string): string | null {
  const arrival = new Date(`${date}T${time}`);
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (arrival < now || arrival > sevenDays) {
    return 'Arrival must be within the next 7 days';
  }
  return null;
}

export function DeparturePlannerForm() {
  const storeCorridorId = useMapStore((s) => s.selectedCorridorId);

  const [corridorId, setCorridorId] = useState(storeCorridorId ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [submittedArrival, setSubmittedArrival] = useState<string | null>(null);
  const [submittedCorridor, setSubmittedCorridor] = useState<string | null>(null);

  const { data, isPending, isError } = useDepartureWindows(submittedCorridor, submittedArrival);

  const today = format(new Date(), 'yyyy-MM-dd');
  const maxDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors([]);

    const result = departureFormSchema.safeParse({ corridorId, date, time });
    if (!result.success) {
      setErrors(result.error.issues.map((e) => e.message));
      return;
    }

    const rangeError = validateArrivalRange(date, time);
    if (rangeError) {
      setErrors([rangeError]);
      return;
    }

    const arrivalISO = new Date(`${date}T${time}`).toISOString();
    setSubmittedCorridor(corridorId);
    setSubmittedArrival(arrivalISO);
  }

  return (
    <div className="px-4 py-4" data-testid="departure-planner">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1" htmlFor="corridor-select">Corridor</label>
          <select
            id="corridor-select"
            data-testid="corridor-select"
            value={corridorId}
            onChange={(e) => setCorridorId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100"
          >
            <option value="">Select corridor...</option>
            {CORRIDOR_IDS.map((id) => (
              <option key={id} value={id}>{CORRIDOR_DISPLAY_NAMES[id]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1" htmlFor="arrival-date">Arrival Date</label>
          <input
            id="arrival-date"
            data-testid="arrival-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={today}
            max={maxDate}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1" htmlFor="arrival-time">Arrival Time</label>
          <input
            id="arrival-time"
            data-testid="arrival-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            step="1800"
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100"
          />
        </div>

        {errors.length > 0 && (
          <div className="text-red-400 text-xs space-y-1" data-testid="form-errors">
            {errors.map((err, i) => <p key={i}>{err}</p>)}
          </div>
        )}

        <button
          type="submit"
          data-testid="submit-btn"
          className="w-full bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded px-3 py-2 transition-colors"
        >
          Find Best Times
        </button>
      </form>

      {/* Results area */}
      {isPending && submittedArrival && (
        <div data-testid="results-loading" className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isError && submittedArrival && (
        <p className="text-red-400 text-sm px-2 py-4" data-testid="results-error">
          No forecast data available for this corridor and time
        </p>
      )}

      {data && data.windows && (
        <DepartureResults windows={data.windows} />
      )}
    </div>
  );
}
