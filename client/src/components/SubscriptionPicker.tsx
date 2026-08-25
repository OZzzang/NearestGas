/**
 * SubscriptionPicker — lets the user check off which fuel loyalty programs they belong
 * to. The selection itself (`selectedIds`) lives in App, not here — this component only
 * fetches the list of available programs and reports toggles up. Keeping selection in
 * App means it's already in the right place to be sent along with the Phase 5 chatbot
 * request, without prop-drilling it back up out of this component later.
 */
import { useEffect, useState } from "react";
import { ApiError, fetchPrograms } from "../lib/api";
import type { Program } from "../types";

interface SubscriptionPickerProps {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

export function SubscriptionPicker({ selectedIds, onToggle }: SubscriptionPickerProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchPrograms()
      .then((result) => {
        if (!cancelled) setPrograms(result.programs);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load fuel programs");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="subscription-picker__error">{error}</p>;
  if (programs.length === 0) return null;

  return (
    <fieldset className="subscription-picker">
      <legend>Your fuel programs</legend>
      <div className="subscription-picker__list">
        {programs.map((program) => (
          <label key={program.id} className="subscription-picker__item" title={program.description}>
            <input
              type="checkbox"
              checked={selectedIds.has(program.id)}
              onChange={() => onToggle(program.id)}
            />
            <span className="subscription-picker__name">{program.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
