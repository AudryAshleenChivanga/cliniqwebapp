export type PredictionOutput = {
  top_conditions: Array<{ condition: string; confidence: number }>;
  risk_score: number;
  triage: "low" | "medium" | "critical";
  recommended_next_steps: string[];
  emergency_alert: boolean;
  explainability: Record<string, number>;
  referral_recommended: boolean;
};

export type EncounterWorkflowOutput = {
  encounter_id: number;
  patient_id: number;
  prelab_assessment: PredictionOutput;
  postlab_assessment: PredictionOutput;
  report: {
    id: number;
    patient_id: number;
    report_text: string;
    escalated_to_doctor: boolean;
    referral_issued: boolean;
    referral_id: number | null;
    ambulance_called: boolean;
    ambulance_eta_minutes: number | null;
    created_at: string;
  };
  ambulance_message: string | null;
};
