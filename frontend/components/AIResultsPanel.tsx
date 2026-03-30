"use client";

import { PredictionOutput } from "@/lib/types";

function triageClass(level: PredictionOutput["triage"]) {
  if (level === "critical") return "bg-red-100 text-red-700 border-red-400 animate-pulsecritical";
  if (level === "medium") return "bg-amber-100 text-amber-700 border-amber-400";
  return "bg-emerald-100 text-emerald-700 border-emerald-400";
}

export function AIResultsPanel({ data }: { data: PredictionOutput | null }) {
  if (!data) {
    return <div className="card p-5 text-slate-500">Run AI assessment to see results.</div>;
  }

  return (
    <div className="card space-y-4 p-5">
      <div className={`rounded-xl border px-3 py-2 text-sm font-semibold uppercase ${triageClass(data.triage)}`}>
        Triage: {data.triage}
      </div>
      <div>
        <p className="text-sm font-semibold">Top Conditions</p>
        <div className="mt-2 space-y-2">
          {data.top_conditions.map((item) => (
            <div key={item.condition} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="font-medium">{item.condition}</span>
              <span className="text-sm text-slate-600">{Math.round(item.confidence * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">Risk Score: {(data.risk_score * 100).toFixed(0)}%</p>
        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-cliniq-teal" style={{ width: `${Math.min(100, data.risk_score * 100)}%` }} />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">Recommended Next Steps</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {data.recommended_next_steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-sm font-semibold">Explainability (Feature Importance)</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          {Object.entries(data.explainability).map(([feature, score]) => (
            <div key={feature} className="rounded-lg bg-slate-50 px-2 py-1">
              {feature}: {score.toFixed(3)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
