"use client";

import { useState } from "react";
import { transcribeOnce } from "@/lib/voice";

export type IntakePayload = {
  patient_id: number;
  symptoms: string;
  temperature: number;
  systolic_bp: number;
  diastolic_bp: number;
  heart_rate: number;
  oxygen_saturation: number;
};

const initial: IntakePayload = {
  patient_id: 1,
  symptoms: "",
  temperature: 37.5,
  systolic_bp: 120,
  diastolic_bp: 80,
  heart_rate: 82,
  oxygen_saturation: 98,
};

export function PatientIntakeForm({ onSubmit }: { onSubmit: (payload: IntakePayload) => Promise<void> }) {
  const [form, setForm] = useState<IntakePayload>(initial);
  const [error, setError] = useState("");

  const update = (key: keyof IntakePayload, value: string) => {
    const numericKeys: Array<keyof IntakePayload> = ["patient_id", "temperature", "systolic_bp", "diastolic_bp", "heart_rate", "oxygen_saturation"];
    setForm((prev) => ({ ...prev, [key]: numericKeys.includes(key) ? Number(value) : value }));
  };

  const addVoice = () => {
    transcribeOnce(
      (text) => setForm((prev) => ({ ...prev, symptoms: `${prev.symptoms} ${text}`.trim() })),
      (message) => setError(message)
    );
  };

  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await onSubmit(form);
          setForm(initial);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not submit intake");
        }
      }}
    >
      <p className="section-title">Patient Intake</p>
      <div className="grid gap-3 md:grid-cols-2">
        <input className="rounded-lg border p-2" placeholder="Patient ID" value={form.patient_id} onChange={(e) => update("patient_id", e.target.value)} required />
        <input className="rounded-lg border p-2" placeholder="Temperature (C)" value={form.temperature} onChange={(e) => update("temperature", e.target.value)} required />
        <input className="rounded-lg border p-2" placeholder="Systolic BP" value={form.systolic_bp} onChange={(e) => update("systolic_bp", e.target.value)} required />
        <input className="rounded-lg border p-2" placeholder="Diastolic BP" value={form.diastolic_bp} onChange={(e) => update("diastolic_bp", e.target.value)} required />
        <input className="rounded-lg border p-2" placeholder="Heart Rate" value={form.heart_rate} onChange={(e) => update("heart_rate", e.target.value)} required />
        <input className="rounded-lg border p-2" placeholder="SpO2" value={form.oxygen_saturation} onChange={(e) => update("oxygen_saturation", e.target.value)} required />
      </div>
      <textarea
        className="min-h-24 w-full rounded-lg border p-2"
        placeholder="Symptoms and clinical notes"
        value={form.symptoms}
        onChange={(e) => update("symptoms", e.target.value)}
        required
      />
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={addVoice} className="rounded-lg border border-cliniq-teal px-3 py-2 text-sm font-semibold text-cliniq-teal">
          Voice Input
        </button>
        <button type="submit" className="rounded-lg bg-cliniq-teal px-4 py-2 font-semibold text-white">
          Analyze + Save Visit
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
