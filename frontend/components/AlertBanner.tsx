"use client";

import { useMemo } from "react";

export function AlertBanner({ show }: { show: boolean }) {
  const className = useMemo(
    () =>
      show
        ? "card border-2 border-cliniq-red bg-red-100 p-4 text-cliniq-red animate-pulsecritical"
        : "card border border-emerald-200 bg-emerald-50 p-4 text-emerald-700",
    [show]
  );

  return <div className={className}>{show ? "Critical Patient Alert: Immediate escalation required." : "No active critical alerts."}</div>;
}
