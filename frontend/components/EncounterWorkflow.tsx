"use client";

import { useState } from "react";
import { transcribeOnce } from "@/lib/voice";
import { EncounterWorkflowOutput, PredictionOutput } from "@/lib/types";

type WorkflowInput = {
  demographics: {
    national_id: string;
    full_name: string;
    age: number;
    sex: string;
    contact: string;
  };
  medical_history: string;
  symptoms: string;
  vitals: {
    temperature: number;
    systolic_bp: number;
    diastolic_bp: number;
    heart_rate: number;
    oxygen_saturation: number;
  };
  labs: {
    wbc?: number;
    lactate?: number;
    hemoglobin?: number;
    platelets?: number;
    glucose?: number;
    crp?: number;
  };
  target_facility: string;
  call_ambulance_if_critical: boolean;
};

const initial: WorkflowInput = {
  demographics: {
    national_id: "",
    full_name: "",
    age: 30,
    sex: "Female",
    contact: "",
  },
  medical_history: "",
  symptoms: "",
  vitals: {
    temperature: 37.5,
    systolic_bp: 120,
    diastolic_bp: 80,
    heart_rate: 82,
    oxygen_saturation: 98,
  },
  labs: {},
  target_facility: "District Hospital",
  call_ambulance_if_critical: true,
};

export function EncounterWorkflowForm({
  onRunPrelab,
  onRunFullWorkflow,
  loading,
}: {
  onRunPrelab: (payload: Record<string, unknown>) => Promise<void>;
  onRunFullWorkflow: (payload: WorkflowInput) => Promise<void>;
  loading: boolean;
}) {
  const [form, setForm] = useState<WorkflowInput>(initial);
  const [error, setError] = useState("");

  const setDemo = (key: keyof WorkflowInput["demographics"], value: string) => {
    setForm((prev) => ({
      ...prev,
      demographics: {
        ...prev.demographics,
        [key]: key === "age" ? Number(value) : value,
      },
    }));
  };

  const setVital = (key: keyof WorkflowInput["vitals"], value: string) => {
    setForm((prev) => ({ ...prev, vitals: { ...prev.vitals, [key]: Number(value) } }));
  };

  const setLab = (key: keyof WorkflowInput["labs"], value: string) => {
    setForm((prev) => ({ ...prev, labs: { ...prev.labs, [key]: value ? Number(value) : undefined } }));
  };

  const addVoice = () => {
    transcribeOnce(
      (text) => setForm((prev) => ({ ...prev, symptoms: `${prev.symptoms} ${text}`.trim() })),
      (message) => setError(message)
    );
  };

  const prelabPayload = {
    symptoms: form.symptoms,
    temperature: form.vitals.temperature,
    systolic_bp: form.vitals.systolic_bp,
    diastolic_bp: form.vitals.diastolic_bp,
    heart_rate: form.vitals.heart_rate,
    oxygen_saturation: form.vitals.oxygen_saturation,
    medical_history: form.medical_history,
  };

  return (
    <div className="card space-y-4 p-5">
      <p className="section-title">Clinical Workflow Intake</p>
      <div className="grid gap-3 md:grid-cols-2">
        <input className="rounded-lg border p-2" placeholder="National ID" value={form.demographics.national_id} onChange={(e) => setDemo("national_id", e.target.value)} />
        <input className="rounded-lg border p-2" placeholder="Full Name" value={form.demographics.full_name} onChange={(e) => setDemo("full_name", e.target.value)} />
        <input className="rounded-lg border p-2" placeholder="Age" type="number" value={form.demographics.age} onChange={(e) => setDemo("age", e.target.value)} />
        <input className="rounded-lg border p-2" placeholder="Sex" value={form.demographics.sex} onChange={(e) => setDemo("sex", e.target.value)} />
        <input className="rounded-lg border p-2 md:col-span-2" placeholder="Contact" value={form.demographics.contact} onChange={(e) => setDemo("contact", e.target.value)} />
      </div>

      <textarea className="min-h-20 w-full rounded-lg border p-2" placeholder="EHR / medical history" value={form.medical_history} onChange={(e) => setForm((prev) => ({ ...prev, medical_history: e.target.value }))} />
      <textarea className="min-h-24 w-full rounded-lg border p-2" placeholder="Symptoms and clinical notes" value={form.symptoms} onChange={(e) => setForm((prev) => ({ ...prev, symptoms: e.target.value }))} />

      <div className="grid gap-3 md:grid-cols-2">
        <input className="rounded-lg border p-2" placeholder="Temp (C)" value={form.vitals.temperature} onChange={(e) => setVital("temperature", e.target.value)} />
        <input className="rounded-lg border p-2" placeholder="Systolic BP" value={form.vitals.systolic_bp} onChange={(e) => setVital("systolic_bp", e.target.value)} />
        <input className="rounded-lg border p-2" placeholder="Diastolic BP" value={form.vitals.diastolic_bp} onChange={(e) => setVital("diastolic_bp", e.target.value)} />
        <input className="rounded-lg border p-2" placeholder="Heart Rate" value={form.vitals.heart_rate} onChange={(e) => setVital("heart_rate", e.target.value)} />
        <input className="rounded-lg border p-2 md:col-span-2" placeholder="SpO2" value={form.vitals.oxygen_saturation} onChange={(e) => setVital("oxygen_saturation", e.target.value)} />
      </div>

      <p className="text-sm font-semibold text-slate-700">Lab Tests (optional initially, then reassess)</p>
      <div className="grid gap-3 md:grid-cols-3">
        <input className="rounded-lg border p-2" placeholder="WBC" onChange={(e) => setLab("wbc", e.target.value)} />
        <input className="rounded-lg border p-2" placeholder="Lactate" onChange={(e) => setLab("lactate", e.target.value)} />
        <input className="rounded-lg border p-2" placeholder="Hemoglobin" onChange={(e) => setLab("hemoglobin", e.target.value)} />
        <input className="rounded-lg border p-2" placeholder="Platelets" onChange={(e) => setLab("platelets", e.target.value)} />
        <input className="rounded-lg border p-2" placeholder="Glucose" onChange={(e) => setLab("glucose", e.target.value)} />
        <input className="rounded-lg border p-2" placeholder="CRP" onChange={(e) => setLab("crp", e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={addVoice} className="rounded-lg border border-cliniq-teal px-3 py-2 text-sm font-semibold text-cliniq-teal">
          Voice Input
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setError("");
            try {
              await onRunPrelab(prelabPayload);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed pre-lab assessment");
            }
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
        >
          Run Pre-Lab Risk
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setError("");
            try {
              await onRunFullWorkflow(form);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed full workflow");
            }
          }}
          className="rounded-lg bg-cliniq-teal px-4 py-2 font-semibold text-white"
        >
          Save Report + Post-Lab AI
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function DualAssessmentPanel({
  prelab,
  workflow,
  onCallAmbulance,
}: {
  prelab: PredictionOutput | null;
  workflow: EncounterWorkflowOutput | null;
  onCallAmbulance: () => Promise<void>;
}) {
  const renderAssessment = (label: string, data: PredictionOutput | null) => {
    if (!data) return <p className="text-sm text-slate-500">{label}: not run yet.</p>;
    return (
      <div className="rounded-lg border p-3">
        <p className="font-semibold">{label}</p>
        <p className="text-sm">Triage: {data.triage}</p>
        <p className="text-sm">Risk: {(data.risk_score * 100).toFixed(0)}%</p>
        <p className="text-sm">Top Condition: {data.top_conditions[0]?.condition || "n/a"}</p>
      </div>
    );
  };

  return (
    <div className="card space-y-3 p-5">
      <p className="section-title">AI Assessment and Actions</p>
      {renderAssessment("Before Labs", prelab)}
      {renderAssessment("After Labs", workflow?.postlab_assessment || null)}

      {workflow?.report ? (
        <div className="rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-line">
          {workflow.report.report_text}
        </div>
      ) : null}

      {workflow?.ambulance_message ? <p className="rounded-lg bg-red-100 p-2 text-sm text-red-700">{workflow.ambulance_message}</p> : null}

      {workflow && !workflow.report.ambulance_called ? (
        <button onClick={onCallAmbulance} className="rounded-lg bg-cliniq-red px-4 py-2 font-semibold text-white">
          Call Ambulance Now
        </button>
      ) : null}
    </div>
  );
}
