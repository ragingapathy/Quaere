"use client";

import { STAGES } from "@/lib/state";

export function StepNav({
  stage,
  maxStage,
  onGo,
}: {
  stage: number;
  maxStage: number;
  onGo: (n: number) => void;
}) {
  return (
    <ol className="steps">
      {STAGES.map((label, i) => (
        <li key={label}>
          <button
            type="button"
            disabled={i > maxStage}
            aria-current={i === stage ? "step" : undefined}
            className={i < maxStage ? "done" : ""}
            onClick={() => onGo(i)}
          >
            <span className="n">{i + 1}</span>
            {label}
          </button>
        </li>
      ))}
    </ol>
  );
}
