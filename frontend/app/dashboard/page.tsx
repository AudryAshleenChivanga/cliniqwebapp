"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { AlertBanner } from "@/components/AlertBanner";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { apiRequest, login } from "@/lib/api";
import { LocaleCode, t } from "@/lib/i18n";
import { transcribeOnce } from "@/lib/voice";

type SectionId =
  | "overview"
  | "registration"
  | "assessment"
  | "labs"
  | "advisor"
  | "escalation"
  | "team"
  | "profile"
  | "prescription"
  | "history"
  | "analytics";
type AuthMode = "signin" | "signup";

type PredictionOutput = {
  top_conditions: Array<{ condition: string; confidence: number }>;
  risk_score: number;
  triage: "low" | "medium" | "critical";
  recommended_next_steps: string[];
  advisor_summary: string;
  emergency_alert: boolean;
  explainability: Record<string, number>;
  referral_recommended: boolean;
  guideline_references: Array<{ source: string; note: string }>;
};

type RegisteredPatient = {
  id: number;
  national_id: string;
  full_name: string;
  age: number;
  sex: string;
  contact?: string;
  medical_history: string;
  department: string;
};

type EncounterOutput = {
  encounter_id: number;
  report: {
    report_text: string;
    referral_issued: boolean;
    ambulance_called: boolean;
    ambulance_eta_minutes: number | null;
  };
  prelab_assessment: PredictionOutput;
  postlab_assessment: PredictionOutput;
  ambulance_message: string | null;
};

type DoctorChatMessage = {
  id: number;
  sender_role: string;
  message: string;
  created_at: string;
};

type TeamChatMessage = {
  id: number;
  sender_user_id: number;
  sender_name: string;
  sender_role: string;
  sender_avatar_url?: string;
  message: string;
  created_at: string;
};

type AdvisorStatus = {
  provider: string;
  available: boolean;
  mode: string;
};

type ClinicianProfile = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  department: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
};

type QueueEntry = {
  id: string;
  name: string;
  room: string;
  mrn: string;
  acuity: "critical" | "watch" | "stable" | "high";
  note: string;
  unread: number;
};

const sectionLabels: Array<{ id: SectionId; key: string }> = [
  { id: "overview", key: "Dashboard Overview" },
  { id: "registration", key: "sidebarRegistration" },
  { id: "assessment", key: "sidebarAssessment" },
  { id: "labs", key: "sidebarLabs" },
  { id: "advisor", key: "sidebarAdvisor" },
  { id: "escalation", key: "sidebarEscalation" },
  { id: "team", key: "sidebarTeam" },
  { id: "profile", key: "sidebarProfile" },
  { id: "prescription", key: "sidebarPrescription" },
  { id: "history", key: "sidebarHistory" },
  { id: "analytics", key: "sidebarAnalytics" },
];

const defaultPatient = {
  national_id: "",
  full_name: "",
  age: 30,
  sex: "Female",
  contact: "",
  medical_history: "",
  department: "OPD",
};
const defaultAssessment = {
  symptoms: "",
  temperature: 37.5,
  systolic_bp: 120,
  diastolic_bp: 80,
  heart_rate: 82,
  oxygen_saturation: 98,
  wbc: "",
  lactate: "",
  hemoglobin: "",
  platelets: "",
  glucose: "",
  crp: "",
  target_facility: "District Hospital",
};

const queueSeed: QueueEntry[] = [
  { id: "seed-1", name: "Samuel Blake", room: "Room 508A", mrn: "009112", acuity: "watch", note: "Last vitals 45m ago", unread: 0 },
  { id: "seed-2", name: "Priya Kapoor", room: "Room 513C", mrn: "012334", acuity: "high", note: "Lab review pending", unread: 1 },
  { id: "seed-3", name: "Marcus Reed", room: "ER Bay", mrn: "017889", acuity: "stable", note: "Observation only", unread: 0 },
  { id: "seed-4", name: "Eleanor Shaw", room: "Room 501A", mrn: "002210", acuity: "high", note: "Escalation requested", unread: 3 },
];

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatSectionLabel(id: SectionId, tr: (key: string) => string) {
  const found = sectionLabels.find((section) => section.id === id);
  if (!found) return id;
  return found.id === "overview" ? found.key : tr(found.key);
}

function confidenceLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function DashboardPage() {
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("nurse@cliniq.app");
  const [password, setPassword] = useState("Nurse123!");
  const [fullName, setFullName] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [lang, setLang] = useState<LocaleCode>("en-US");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [patientForm, setPatientForm] = useState(defaultPatient);
  const [registeredPatient, setRegisteredPatient] = useState<RegisteredPatient | null>(null);
  const [assessmentForm, setAssessmentForm] = useState(defaultAssessment);
  const [prelab, setPrelab] = useState<PredictionOutput | null>(null);
  const [encounter, setEncounter] = useState<EncounterOutput | null>(null);
  const [advisorInput, setAdvisorInput] = useState("");
  const [advisorMessages, setAdvisorMessages] = useState<Array<{ role: "nurse" | "ai"; text: string }>>([]);
  const [doctorChatMessages, setDoctorChatMessages] = useState<DoctorChatMessage[]>([]);
  const [doctorChatText, setDoctorChatText] = useState("");
  const [teamMessages, setTeamMessages] = useState<TeamChatMessage[]>([]);
  const [teamMessageInput, setTeamMessageInput] = useState("");
  const [advisorStatus, setAdvisorStatus] = useState<AdvisorStatus | null>(null);
  const [currentUser, setCurrentUser] = useState<ClinicianProfile | null>(null);
  const [profileForm, setProfileForm] = useState({ full_name: "", department: "", phone: "", bio: "" });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [history, setHistory] = useState<Array<{ id: number; report_text: string; created_at: string }>>([]);
  const [prescriptions, setPrescriptions] = useState<
    Array<{ id: number; diagnosis: string; medications: string; clinician_name: string; electronic_signature: string }>
  >([]);
  const [analytics, setAnalytics] = useState<{ common_conditions: Array<{ condition: string; count: number }> }>({ common_conditions: [] });

  const [prescriptionForm, setPrescriptionForm] = useState({
    diagnosis: "",
    medications: "",
    instructions: "",
    insurer_name: "RAMA",
    policy_number: "",
    clinician_name: "",
    electronic_signature: "",
  });

  const tr = (key: string) => t(lang, key);
  const trackingId = useMemo(() => (registeredPatient ? `CLQ-${String(registeredPatient.id).padStart(6, "0")}` : "-"), [registeredPatient]);
  const criticalAlert = Boolean(prelab?.emergency_alert || encounter?.postlab_assessment?.emergency_alert);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLang((localStorage.getItem("cliniq_lang") as LocaleCode | null) || "en-US");
    if (localStorage.getItem("cliniq_token")) setLoggedIn(true);
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    void apiRequest("/analytics/summary").then((v) => setAnalytics(v as { common_conditions: Array<{ condition: string; count: number }> })).catch(() => undefined);
    void loadTeamMessages();
    void loadCurrentUser();
    void loadAdvisorStatus();
  }, [loggedIn]);

  useEffect(() => {
    if (!encounter) return;
    const doctorTimer = setInterval(() => void loadDoctorChat(encounter.encounter_id), 5000);
    return () => clearInterval(doctorTimer);
  }, [encounter?.encounter_id]);

  useEffect(() => {
    if (!loggedIn) return;
    const teamTimer = setInterval(() => void loadTeamMessages(), 6000);
    const advisorTimer = setInterval(() => void loadAdvisorStatus(), 10000);
    return () => {
      clearInterval(teamTimer);
      clearInterval(advisorTimer);
    };
  }, [loggedIn]);

  useEffect(() => {
    if (!criticalAlert) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 900;
    osc.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      void ctx.close();
    }, 280);
  }, [criticalAlert]);

  const loadPatientLinkedData = async (patientId: number) => {
    const [h, p] = await Promise.all([
      apiRequest(`/encounters/patient/${patientId}`).catch(() => []),
      apiRequest(`/prescriptions/patient/${patientId}`).catch(() => []),
    ]);
    setHistory(h as Array<{ id: number; report_text: string; created_at: string }>);
    setPrescriptions(
      p as Array<{ id: number; diagnosis: string; medications: string; clinician_name: string; electronic_signature: string }>
    );
  };

  const loadDoctorChat = async (encounterId: number) => {
    const msgs = await apiRequest(`/doctor-chat/${encounterId}`).catch(() => []);
    setDoctorChatMessages(msgs as DoctorChatMessage[]);
  };

  const loadTeamMessages = async () => {
    const msgs = await apiRequest("/team-chat").catch(() => []);
    setTeamMessages(msgs as TeamChatMessage[]);
  };

  const loadAdvisorStatus = async () => {
    const nextStatus = await apiRequest("/assistant/status").catch(() => null);
    setAdvisorStatus(nextStatus as AdvisorStatus | null);
  };

  const loadCurrentUser = async () => {
    const me = (await apiRequest("/users/me").catch(() => null)) as ClinicianProfile | null;
    if (!me) return;
    setCurrentUser(me);
    setProfileForm({
      full_name: me.full_name || "",
      department: me.department || "",
      phone: me.phone || "",
      bio: me.bio || "",
    });
  };

  const handleAuth = async () => {
    setLoading(true);
    setError("");
    try {
      if (authMode === "signup") {
        await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            full_name: fullName || email.split("@")[0],
            email,
            password,
            role: "nurse",
          }),
        });
      }
      const result = await login(email, password);
      localStorage.setItem("cliniq_token", result.access_token);
      setLoggedIn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("authFailed"));
    } finally {
      setLoading(false);
    }
  };

  const registerPatient = async () => {
    const patient = await apiRequest<RegisteredPatient>("/patients", {
      method: "POST",
      body: JSON.stringify({ ...patientForm, age: Number(patientForm.age) }),
    });
    setRegisteredPatient(patient);
    await loadPatientLinkedData(patient.id);
    setStatus(`${tr("statusPatientRegistered")} CLQ-${String(patient.id).padStart(6, "0")}`);
    setActiveSection("overview");
  };

  const findPatient = async () => {
    const list = (await apiRequest(`/patients?q=${encodeURIComponent(patientForm.national_id)}`)) as RegisteredPatient[];
    const found = list.find((p) => p.national_id === patientForm.national_id) || list[0];
    if (!found) {
      setStatus(tr("statusNoPatientFound"));
      return;
    }
    setRegisteredPatient(found);
    setPatientForm({
      national_id: found.national_id,
      full_name: found.full_name,
      age: found.age,
      sex: found.sex,
      contact: found.contact || "",
      medical_history: found.medical_history,
      department: found.department || "OPD",
    });
    await loadPatientLinkedData(found.id);
    setStatus(`${tr("statusPatientLoaded")} ${found.full_name}`);
    setActiveSection("overview");
  };

  const runPrelab = async () => {
    if (!registeredPatient) throw new Error(tr("statusPatientRequired"));
    const result = await apiRequest<PredictionOutput>("/predict", {
      method: "POST",
      body: JSON.stringify({
        symptoms: assessmentForm.symptoms,
        temperature: Number(assessmentForm.temperature),
        systolic_bp: Number(assessmentForm.systolic_bp),
        diastolic_bp: Number(assessmentForm.diastolic_bp),
        heart_rate: Number(assessmentForm.heart_rate),
        oxygen_saturation: Number(assessmentForm.oxygen_saturation),
        medical_history: registeredPatient.medical_history,
      }),
    });
    setPrelab(result);
    setActiveSection("overview");
  };

  const runPostLab = async () => {
    if (!registeredPatient) throw new Error(tr("statusPatientRequired"));
    const result = await apiRequest<EncounterOutput>("/encounters/workflow", {
      method: "POST",
      body: JSON.stringify({
        demographics: {
          national_id: registeredPatient.national_id,
          full_name: registeredPatient.full_name,
          age: registeredPatient.age,
          sex: registeredPatient.sex,
          contact: registeredPatient.contact,
        },
        medical_history: registeredPatient.medical_history,
        symptoms: assessmentForm.symptoms,
        vitals: {
          temperature: Number(assessmentForm.temperature),
          systolic_bp: Number(assessmentForm.systolic_bp),
          diastolic_bp: Number(assessmentForm.diastolic_bp),
          heart_rate: Number(assessmentForm.heart_rate),
          oxygen_saturation: Number(assessmentForm.oxygen_saturation),
        },
        labs: {
          wbc: assessmentForm.wbc ? Number(assessmentForm.wbc) : null,
          lactate: assessmentForm.lactate ? Number(assessmentForm.lactate) : null,
          hemoglobin: assessmentForm.hemoglobin ? Number(assessmentForm.hemoglobin) : null,
          platelets: assessmentForm.platelets ? Number(assessmentForm.platelets) : null,
          glucose: assessmentForm.glucose ? Number(assessmentForm.glucose) : null,
          crp: assessmentForm.crp ? Number(assessmentForm.crp) : null,
        },
        target_facility: assessmentForm.target_facility,
        call_ambulance_if_critical: true,
      }),
    });
    setEncounter(result);
    setPrelab(result.prelab_assessment);
    await loadPatientLinkedData(registeredPatient.id);
    await loadDoctorChat(result.encounter_id);
    setActiveSection("overview");
  };

  const askAdvisor = async () => {
    const prompt = advisorInput.trim();
    if (!prompt) return;
    setAdvisorInput("");
    setAdvisorMessages((prev) => [...prev, { role: "nurse", text: prompt }]);
    try {
      const answer = (await apiRequest("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          patient_context: {
            triage: encounter?.postlab_assessment.triage || prelab?.triage,
            risk_score: encounter?.postlab_assessment.risk_score || prelab?.risk_score,
            diagnosis: encounter?.postlab_assessment.top_conditions?.[0]?.condition || prelab?.top_conditions?.[0]?.condition,
          },
        }),
      })) as { answer: string };
      setAdvisorMessages((prev) => [...prev, { role: "ai", text: answer.answer }]);
    } catch (err) {
      const fallback = [
        "Clinical Summary:",
        `- Triage: ${encounter?.postlab_assessment.triage || prelab?.triage || "unknown"}`,
        `- Risk: ${encounter?.postlab_assessment.risk_score || prelab?.risk_score || "unknown"}`,
        `- Likely condition: ${encounter?.postlab_assessment.top_conditions?.[0]?.condition || prelab?.top_conditions?.[0]?.condition || "not provided"}`,
        "Advisor Steps:",
        "1. Reassess vitals and danger signs.",
        "2. Continue protocol-based treatment.",
        "3. Escalate to doctor if any deterioration.",
      ].join("\n");
      setAdvisorMessages((prev) => [...prev, { role: "ai", text: fallback }]);
      setStatus(err instanceof Error ? `${tr("statusAdvisorFallback")} (${err.message})` : tr("statusAdvisorFallback"));
    }
  };

  const sendDoctorMessage = async () => {
    if (!encounter || !doctorChatText.trim()) return;
    await apiRequest("/doctor-chat", {
      method: "POST",
      body: JSON.stringify({
        encounter_id: encounter.encounter_id,
        sender_role: "nurse",
        sender_name: "Nurse",
        message: doctorChatText.trim(),
      }),
    });
    setDoctorChatText("");
    await loadDoctorChat(encounter.encounter_id);
  };

  const sendTeamMessage = async () => {
    if (!teamMessageInput.trim()) return;
    await apiRequest("/team-chat", { method: "POST", body: JSON.stringify({ message: teamMessageInput.trim() }) });
    setTeamMessageInput("");
    await loadTeamMessages();
  };

  const updateProfile = async () => {
    const updated = (await apiRequest("/users/me", {
      method: "PATCH",
      body: JSON.stringify(profileForm),
    })) as ClinicianProfile;
    setCurrentUser(updated);
    setStatus(tr("statusProfileUpdated"));
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return;
    const token = localStorage.getItem("cliniq_token");
    const formData = new FormData();
    formData.append("file", avatarFile);
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/users/me/avatar`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!response.ok) throw new Error("Avatar upload failed");
    const user = (await response.json()) as ClinicianProfile;
    setCurrentUser(user);
    setStatus(tr("statusProfilePictureUpdated"));
  };

  const callAmbulance = async () => {
    if (!encounter) return;
    const res = (await apiRequest(`/encounters/${encounter.encounter_id}/call-ambulance`, { method: "POST" })) as {
      eta_minutes: number;
    };
    setEncounter((prev) =>
      prev
        ? {
            ...prev,
            ambulance_message: `${tr("ambulance")}: ETA ${res.eta_minutes} min`,
            report: { ...prev.report, ambulance_called: true, ambulance_eta_minutes: res.eta_minutes },
          }
        : prev
    );
  };

  const createPrescription = async () => {
    if (!registeredPatient) throw new Error(tr("statusPatientRequired"));
    const p = await apiRequest("/prescriptions", {
      method: "POST",
      body: JSON.stringify({ patient_id: registeredPatient.id, encounter_id: encounter?.encounter_id || null, ...prescriptionForm }),
    });
    setPrescriptions((prev) => [p as { id: number; diagnosis: string; medications: string; clinician_name: string; electronic_signature: string }, ...prev]);
    setStatus(tr("statusPrescriptionSaved"));
  };

  const currentPrediction = encounter?.postlab_assessment || prelab;
  const primaryCondition = currentPrediction?.top_conditions?.[0];
  const riskScore = currentPrediction?.risk_score ? Math.round(currentPrediction.risk_score * 100) : 0;
  const triageTone =
    currentPrediction?.triage === "critical"
      ? "bg-rose-100 text-rose-700"
      : currentPrediction?.triage === "medium"
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";

  const patientQueue = useMemo(() => {
    const liveEntry = registeredPatient
      ? {
          id: `patient-${registeredPatient.id}`,
          name: registeredPatient.full_name,
          room: registeredPatient.department || "OPD",
          mrn: registeredPatient.national_id,
          acuity: (currentPrediction?.triage === "critical"
            ? "critical"
            : currentPrediction?.triage === "medium"
              ? "high"
              : "stable") as QueueEntry["acuity"],
          note: encounter ? "Workflow completed recently" : "Open patient workspace",
          unread: doctorChatMessages.length,
        }
      : null;

    return [...(liveEntry ? [liveEntry] : []), ...queueSeed].slice(0, 5);
  }, [currentPrediction?.triage, doctorChatMessages.length, encounter, registeredPatient]);

  const vitalsTrend = useMemo(() => {
    const base = Number(assessmentForm.heart_rate) || 82;
    return Array.from({ length: 12 }, (_, index) => ({
      slot: `${index * 5}m`,
      reading: Math.max(60, Math.round(base - 8 + index * 1.7 + (index % 2 === 0 ? 2 : -1))),
    }));
  }, [assessmentForm.heart_rate]);

  const suggestionCards = useMemo(() => {
    const dynamic = currentPrediction?.top_conditions?.slice(0, 3).map((condition, index) => ({
      title: index === 0 ? `Consider ${condition.condition}` : `Review ${condition.condition}`,
      text:
        currentPrediction.recommended_next_steps[index] ||
        currentPrediction.advisor_summary ||
        "Confirm with bedside findings and current vitals.",
      confidence: confidenceLabel(condition.confidence),
      action: index === 0 ? "Add to Plan" : "Acknowledge",
    }));

    if (dynamic && dynamic.length > 0) return dynamic;

    return [
      {
        title: "Assess perfusion and airway",
        text: "Reconfirm danger signs, mental status, and oxygen trend before the next intervention.",
        confidence: "82%",
        action: "Acknowledge",
      },
      {
        title: "Review lactate and WBC",
        text: "Capture post-lab values so the advisor can refine the escalation path.",
        confidence: "74%",
        action: "Request Lab",
      },
      {
        title: "Prepare escalation summary",
        text: "Keep a doctor-ready handoff note with current vitals, symptoms, and interventions.",
        confidence: "68%",
        action: "Draft Note",
      },
    ];
  }, [currentPrediction]);

  const teamRoster = useMemo(() => {
    const seen = new Set<number>();
    const members = teamMessages.reduce<Array<{ id: number; name: string; role: string; avatarUrl?: string; lastSeen: string }>>((list, message) => {
      if (seen.has(message.sender_user_id)) return list;
      seen.add(message.sender_user_id);
      list.push({
        id: message.sender_user_id,
        name: message.sender_name,
        role: message.sender_role,
        avatarUrl: message.sender_avatar_url,
        lastSeen: new Date(message.created_at).toLocaleTimeString(),
      });
      return list;
    }, []);

    if (currentUser && !seen.has(currentUser.id)) {
      members.unshift({
        id: currentUser.id,
        name: currentUser.full_name,
        role: currentUser.role,
        avatarUrl: currentUser.avatar_url,
        lastSeen: "online",
      });
    }

    return members.slice(0, 6);
  }, [currentUser, teamMessages]);

  const outstandingTasks = useMemo(() => {
    const tasks = [
      {
        label: registeredPatient ? "Update patient registration details" : "Register or load a patient record",
        helper: registeredPatient ? "Keep demographics and history complete" : "Required to unlock prediction flow",
        action: registeredPatient ? "Review" : "Start",
        target: "registration" as SectionId,
      },
      {
        label: assessmentForm.symptoms ? "Refine symptom narrative" : "Capture bedside assessment",
        helper: "Include vitals and symptom changes",
        action: "Open",
        target: "assessment" as SectionId,
      },
      {
        label: encounter ? "Review escalation output" : "Run full AI workflow",
        helper: encounter ? "Doctor chat and ambulance tools are available" : "Submit labs to generate plan and report",
        action: encounter ? "Track" : "Run",
        target: encounter ? ("escalation" as SectionId) : ("labs" as SectionId),
      },
    ];

    return tasks;
  }, [assessmentForm.symptoms, encounter, registeredPatient]);

  const contextNotes = useMemo(() => {
    const notes: Array<{ author: string; age: string; text: string }> = [];

    if (advisorMessages.length > 0) {
      const lastAi = [...advisorMessages].reverse().find((message) => message.role === "ai");
      if (lastAi) {
        notes.push({ author: "AI Advisor", age: "just now", text: lastAi.text });
      }
    }

    if (doctorChatMessages[0]) {
      notes.push({
        author: doctorChatMessages[0].sender_role,
        age: new Date(doctorChatMessages[0].created_at).toLocaleTimeString(),
        text: doctorChatMessages[0].message,
      });
    }

    if (history[0]) {
      notes.push({
        author: "Encounter Log",
        age: new Date(history[0].created_at).toLocaleDateString(),
        text: history[0].report_text,
      });
    }

    if (notes.length === 0) {
      notes.push(
        { author: "Triage Desk", age: "12 min ago", text: "No patient chart selected yet. Start with registration or load an existing record." },
        { author: "Workflow Guidance", age: "Live", text: "Once vitals and labs are entered, this page will surface AI recommendations and escalation tasks." }
      );
    }

    return notes.slice(0, 3);
  }, [advisorMessages, doctorChatMessages, history]);

  const renderWorkspaceSection = () => {
    if (activeSection === "overview") {
      return (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <section className="dashboard-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#dff6f4,#b9ebe8)] text-xl font-bold text-cliniq-slate">
                    {(registeredPatient?.full_name || patientForm.full_name || "P").slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold tracking-tight text-cliniq-slate">
                        {registeredPatient?.full_name || patientForm.full_name || "No patient selected"}
                      </h2>
                      <span className={cn("rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]", triageTone)}>
                        {currentPrediction?.triage || "standby"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {registeredPatient ? `MRN ${registeredPatient.national_id} • ${registeredPatient.department}` : "Load a patient to activate the command center"}
                    </p>
                    <p className="mt-1 text-xs text-[#1a8a85]">
                      {primaryCondition ? `Likely focus: ${primaryCondition.condition} (${confidenceLabel(primaryCondition.confidence)})` : "AI advisor ready for bedside support"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button className="dashboard-action" onClick={() => setActiveSection("registration")}>
                    Open Patient Record
                  </button>
                  <button className="dashboard-action dashboard-action--soft" onClick={() => setActiveSection("assessment")}>
                    Capture Assessment
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="metric-tile">
                  <span className="metric-label">HR</span>
                  <strong>{Number(assessmentForm.heart_rate) || "--"}</strong>
                  <span className="metric-sub">bpm</span>
                </div>
                <div className="metric-tile">
                  <span className="metric-label">BP</span>
                  <strong>
                    {Number(assessmentForm.systolic_bp) || "--"}/{Number(assessmentForm.diastolic_bp) || "--"}
                  </strong>
                  <span className="metric-sub">mmHg</span>
                </div>
                <div className="metric-tile">
                  <span className="metric-label">SpO2</span>
                  <strong>{Number(assessmentForm.oxygen_saturation) || "--"}%</strong>
                  <span className="metric-sub">pulse oximetry</span>
                </div>
                <div className="metric-tile">
                  <span className="metric-label">Temp</span>
                  <strong>{Number(assessmentForm.temperature) || "--"}°C</strong>
                  <span className="metric-sub">oral</span>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
                <div className="rounded-[24px] border border-[#d9efed] bg-[#fbfefe] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-cliniq-slate">Vitals Trend</p>
                      <p className="text-xs text-slate-500">Heartbeat pattern over the last hour</p>
                    </div>
                    <span className="rounded-full bg-[#e7f8f6] px-3 py-1 text-xs font-medium text-[#1a8a85]">
                      Risk {riskScore}%
                    </span>
                  </div>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={vitalsTrend} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="#e5f3f2" vertical={false} />
                        <XAxis dataKey="slot" tick={{ fill: "#6d8487", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="reading" stroke="#0c8d86" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#d9efed] bg-white p-4">
                  <p className="text-sm font-semibold text-cliniq-slate">Recent Notes</p>
                  <div className="mt-3 space-y-3 text-sm text-slate-600">
                    {contextNotes.map((note, index) => (
                      <div key={`${note.author}-${index}`} className="rounded-2xl bg-[#f5fbfb] p-3">
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold uppercase tracking-[0.14em] text-[#1a8a85]">{note.author}</span>
                          <span>{note.age}</span>
                        </div>
                        <p className="line-clamp-5 whitespace-pre-wrap">{note.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="dashboard-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold text-cliniq-slate">AI Suggestions</p>
                    <p className="text-xs text-slate-500">Decision support aligned to live chart data</p>
                  </div>
                  <span className="rounded-full bg-[#ebf8f7] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1a8a85]">
                    {advisorStatus?.available ? "Live" : "Fallback"}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {suggestionCards.map((card) => (
                    <article key={card.title} className="rounded-[22px] border border-[#d9efed] bg-[#fbfefe] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-cliniq-slate">{card.title}</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{card.text}</p>
                        </div>
                        <span className="rounded-full bg-[#0c8d86] px-2.5 py-1 text-[11px] font-semibold text-white">{card.confidence}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button className="rounded-full bg-[#ebf8f7] px-3 py-1.5 text-xs font-semibold text-[#1a8a85]" onClick={() => setActiveSection("advisor")}>
                          {card.action}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="dashboard-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-cliniq-slate">Outstanding Tasks</p>
                  <span className="text-xs text-slate-500">{outstandingTasks.length} items</span>
                </div>
                <div className="mt-4 space-y-3">
                  {outstandingTasks.map((task) => (
                    <div key={task.label} className="flex items-start justify-between gap-3 rounded-[22px] border border-[#edf5f4] bg-white p-4">
                      <div className="flex gap-3">
                        <span className="mt-1 h-4 w-4 rounded-full border border-[#b2dbd8]" />
                        <div>
                          <p className="text-sm font-medium text-cliniq-slate">{task.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{task.helper}</p>
                        </div>
                      </div>
                      <button className="text-sm font-semibold text-[#1a8a85]" onClick={() => setActiveSection(task.target)}>
                        {task.action}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="dashboard-card p-5">
                <p className="text-sm font-semibold text-cliniq-slate">MedAssist Context</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Advisory outputs remain decision support. Validate with bedside assessment, local protocol, and escalation pathways when the patient condition changes.
                </p>
              </section>
            </aside>
          </div>
        </div>
      );
    }

    if (activeSection === "registration") {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input className="workspace-input" placeholder={tr("nationalId")} value={patientForm.national_id} onChange={(e) => setPatientForm((p) => ({ ...p, national_id: e.target.value }))} />
            <input className="workspace-input" placeholder={tr("fullName")} value={patientForm.full_name} onChange={(e) => setPatientForm((p) => ({ ...p, full_name: e.target.value }))} />
            <input className="workspace-input" type="number" placeholder={tr("age")} value={patientForm.age} onChange={(e) => setPatientForm((p) => ({ ...p, age: Number(e.target.value) }))} />
            <input className="workspace-input" placeholder={tr("sex")} value={patientForm.sex} onChange={(e) => setPatientForm((p) => ({ ...p, sex: e.target.value }))} />
            <input className="workspace-input" placeholder={tr("contact")} value={patientForm.contact} onChange={(e) => setPatientForm((p) => ({ ...p, contact: e.target.value }))} />
            <select className="workspace-input" value={patientForm.department} onChange={(e) => setPatientForm((p) => ({ ...p, department: e.target.value }))}>
              <option>OPD</option>
              <option>Emergency</option>
              <option>Pediatrics</option>
              <option>Maternity</option>
              <option>Surgery</option>
              <option>Internal Medicine</option>
            </select>
          </div>
          <textarea className="workspace-input min-h-24 w-full" placeholder={tr("ehrHistory")} value={patientForm.medical_history} onChange={(e) => setPatientForm((p) => ({ ...p, medical_history: e.target.value }))} />
          <div className="flex flex-wrap gap-2">
            <button onClick={registerPatient} className="dashboard-action">
              {tr("registerPatient")}
            </button>
            <button onClick={findPatient} className="dashboard-action dashboard-action--soft">
              {tr("loadExisting")}
            </button>
          </div>
        </div>
      );
    }

    if (activeSection === "assessment") {
      return (
        <div className="space-y-3">
          <textarea className="workspace-input min-h-28 w-full" placeholder={tr("symptoms")} value={assessmentForm.symptoms} onChange={(e) => setAssessmentForm((f) => ({ ...f, symptoms: e.target.value }))} />
          <div className="grid gap-3 md:grid-cols-3">
            <input className="workspace-input" placeholder={tr("temperature")} value={assessmentForm.temperature} onChange={(e) => setAssessmentForm((f) => ({ ...f, temperature: Number(e.target.value) }))} />
            <input className="workspace-input" placeholder={tr("systolicBp")} value={assessmentForm.systolic_bp} onChange={(e) => setAssessmentForm((f) => ({ ...f, systolic_bp: Number(e.target.value) }))} />
            <input className="workspace-input" placeholder={tr("diastolicBp")} value={assessmentForm.diastolic_bp} onChange={(e) => setAssessmentForm((f) => ({ ...f, diastolic_bp: Number(e.target.value) }))} />
            <input className="workspace-input" placeholder={tr("heartRate")} value={assessmentForm.heart_rate} onChange={(e) => setAssessmentForm((f) => ({ ...f, heart_rate: Number(e.target.value) }))} />
            <input className="workspace-input" placeholder={tr("oxygenSaturation")} value={assessmentForm.oxygen_saturation} onChange={(e) => setAssessmentForm((f) => ({ ...f, oxygen_saturation: Number(e.target.value) }))} />
            <input className="workspace-input" placeholder={tr("referralFacility")} value={assessmentForm.target_facility} onChange={(e) => setAssessmentForm((f) => ({ ...f, target_facility: e.target.value }))} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => transcribeOnce((txt) => setAssessmentForm((f) => ({ ...f, symptoms: `${f.symptoms} ${txt}`.trim() })), () => setStatus(tr("statusSpeechNotSupported")))}
              className="dashboard-action dashboard-action--soft"
            >
              {tr("voiceInput")}
            </button>
            <button onClick={runPrelab} className="dashboard-action">
              {tr("runPrelab")}
            </button>
          </div>
          {prelab ? <p className="rounded-2xl bg-[#f4fbfb] p-3 text-sm text-slate-600">{tr("risk")} {(prelab.risk_score * 100).toFixed(0)}% | {tr("triage")} {prelab.triage}</p> : null}
        </div>
      );
    }

    if (activeSection === "labs") {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <input className="workspace-input" placeholder={tr("wbc")} value={assessmentForm.wbc} onChange={(e) => setAssessmentForm((f) => ({ ...f, wbc: e.target.value }))} />
            <input className="workspace-input" placeholder={tr("lactate")} value={assessmentForm.lactate} onChange={(e) => setAssessmentForm((f) => ({ ...f, lactate: e.target.value }))} />
            <input className="workspace-input" placeholder={tr("hemoglobin")} value={assessmentForm.hemoglobin} onChange={(e) => setAssessmentForm((f) => ({ ...f, hemoglobin: e.target.value }))} />
            <input className="workspace-input" placeholder={tr("platelets")} value={assessmentForm.platelets} onChange={(e) => setAssessmentForm((f) => ({ ...f, platelets: e.target.value }))} />
            <input className="workspace-input" placeholder={tr("glucose")} value={assessmentForm.glucose} onChange={(e) => setAssessmentForm((f) => ({ ...f, glucose: e.target.value }))} />
            <input className="workspace-input" placeholder={tr("crp")} value={assessmentForm.crp} onChange={(e) => setAssessmentForm((f) => ({ ...f, crp: e.target.value }))} />
          </div>
          <button onClick={runPostLab} className="dashboard-action">
            {tr("runPostlab")}
          </button>
          {encounter ? <pre className="rounded-2xl bg-[#f4fbfb] p-4 text-sm whitespace-pre-wrap font-sans text-slate-600">{encounter.report.report_text}</pre> : null}
        </div>
      );
    }

    if (activeSection === "advisor") {
      return (
        <div className="space-y-3">
          {advisorStatus ? (
            <p className={cn("rounded-2xl p-3 text-xs", advisorStatus.available ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
              {tr("providerLabel")}: {advisorStatus.provider} | {tr("modeLabel")}: {advisorStatus.mode} | {tr("statusLabel")}: {advisorStatus.available ? tr("advisorConnected") : tr("advisorFallback")}
            </p>
          ) : null}
          <div className="max-h-72 space-y-2 overflow-auto rounded-[24px] border border-[#d9efed] p-3 text-sm">
            {advisorMessages.length === 0 ? <p className="text-slate-500">{tr("askAdvisorEmpty")}</p> : null}
            {advisorMessages.map((m, i) => (
              <pre key={i} className={cn("whitespace-pre-wrap rounded-2xl p-3", m.role === "ai" ? "bg-cyan-50" : "bg-slate-50")}>
                {m.role === "ai" ? `${tr("aiAdvisorPrefix")}:\n` : `${tr("nursePrefix")}:\n`}
                {m.text}
              </pre>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="workspace-input flex-1" value={advisorInput} onChange={(e) => setAdvisorInput(e.target.value)} placeholder={tr("askAiAdvisor")} />
            <button onClick={askAdvisor} className="dashboard-action">
              {tr("ask")}
            </button>
          </div>
        </div>
      );
    }

    if (activeSection === "escalation") {
      return (
        <div className="space-y-3">
          <button onClick={callAmbulance} disabled={!encounter} className="rounded-full bg-cliniq-red px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {tr("callAmbulance")}
          </button>
          <div className="max-h-56 space-y-2 overflow-auto rounded-[24px] border border-[#d9efed] p-3 text-sm">
            {doctorChatMessages.length === 0 ? <p className="text-slate-500">{tr("noDoctorMessages")}</p> : null}
            {doctorChatMessages.map((m) => (
              <p key={m.id} className="rounded-2xl bg-slate-50 p-3">
                <span className="font-semibold">{m.sender_role}</span>: {m.message}
              </p>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="workspace-input flex-1" value={doctorChatText} onChange={(e) => setDoctorChatText(e.target.value)} placeholder={tr("messageDoctor")} />
            <button onClick={sendDoctorMessage} className="dashboard-action dashboard-action--soft">
              {tr("send")}
            </button>
          </div>
        </div>
      );
    }

    if (activeSection === "team") {
      return (
        <div className="team-shell grid gap-0 overflow-hidden rounded-[30px] border border-[#d4ebe8] lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="team-shell__sidebar px-5 py-5">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1a8a85]">Clinical Group</p>
              <h3 className="mt-2 text-2xl font-semibold text-cliniq-slate">Care Coordination</h3>
              <p className="mt-2 text-sm text-slate-500">A focused room for nurses, doctors, and support staff to coordinate actions in real time.</p>
            </div>

            <div className="rounded-[24px] bg-white/80 p-4 shadow-[0_18px_40px_rgba(10,77,79,0.08)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-cliniq-slate">Team Members</p>
                <span className="rounded-full bg-[#e5f7f5] px-2.5 py-1 text-[11px] font-semibold text-[#1a8a85]">{teamRoster.length} online</span>
              </div>
              <div className="mt-4 space-y-3">
                {teamRoster.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 rounded-[20px] bg-[#f8fcfc] px-3 py-3">
                    {member.avatarUrl ? (
                      <img
                        src={`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}${member.avatarUrl}`}
                        width={42}
                        height={42}
                        alt={member.name}
                        className="h-[42px] w-[42px] rounded-full object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#d7f3f1,#b6e7e3)] text-sm font-bold text-cliniq-slate">
                        {member.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-cliniq-slate">{member.name}</p>
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{member.role}</p>
                    </div>
                    <span className="ml-auto text-[11px] text-slate-400">{member.lastSeen}</span>
                  </div>
                ))}
                {teamRoster.length === 0 ? <p className="text-sm text-slate-500">{tr("noTeamMessages")}</p> : null}
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-white/70 bg-white/50 p-4">
              <p className="text-sm font-semibold text-cliniq-slate">Room Notes</p>
              <p className="mt-2 text-sm text-slate-500">Use this space for concise handoffs, approvals, and next steps. Keep urgent escalation in the doctor channel.</p>
            </div>
          </aside>

          <section className="team-shell__main flex min-h-[560px] flex-col bg-white px-5 py-5">
            <div className="team-shell__hero mb-4 rounded-[28px] px-5 py-5 text-white">
              <div className="max-w-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">Shared Workspace</p>
                <h3 className="mt-2 text-3xl font-semibold">Group Chat</h3>
                <p className="mt-2 text-sm text-cyan-50">Fast communication for clinical decisions, updates, and support across the care team.</p>
              </div>
            </div>

            <div className="flex-1 overflow-auto rounded-[24px] bg-[#f7fbfb] p-4">
              <div className="space-y-3">
                {teamMessages.length === 0 ? <p className="text-slate-500">{tr("noTeamMessages")}</p> : null}
                {teamMessages.map((m) => {
                  const mine = currentUser?.id === m.sender_user_id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={cn("max-w-[85%] rounded-[24px] px-4 py-3 shadow-[0_14px_30px_rgba(10,77,79,0.08)]", mine ? "bg-[linear-gradient(135deg,#0c8d86,#11b1a9)] text-white" : "bg-white text-slate-800")}>
                        <div className="mb-2 flex items-center gap-2 text-xs">
                          {m.sender_avatar_url ? (
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}${m.sender_avatar_url}`}
                              width={22}
                              height={22}
                              alt="avatar"
                              className="h-[22px] w-[22px] rounded-full object-cover"
                            />
                          ) : (
                            <span className={cn("inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-bold", mine ? "bg-white/20 text-white" : "bg-[#dff3f1] text-cliniq-slate")}>
                              {m.sender_name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="font-semibold">{m.sender_name}</span>
                          <span className={mine ? "text-white/70" : "text-slate-400"}>{new Date(m.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-sm leading-6">{m.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-[24px] border border-[#d9efed] bg-white p-3 md:flex-row">
              <input className="workspace-input flex-1 border-0 bg-[#f8fcfc]" value={teamMessageInput} onChange={(e) => setTeamMessageInput(e.target.value)} placeholder={tr("messageTeam")} />
              <button onClick={sendTeamMessage} className="dashboard-action justify-center md:min-w-[140px]">
                {tr("send")}
              </button>
            </div>
          </section>
        </div>
      );
    }

    if (activeSection === "profile") {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {currentUser?.avatar_url ? (
              <img
                src={`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}${currentUser.avatar_url}`}
                width={72}
                height={72}
                alt="profile"
                className="h-[72px] w-[72px] rounded-full object-cover"
              />
            ) : (
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-slate-200 text-2xl font-bold text-slate-600">
                {(profileForm.full_name || "C").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} className="workspace-input w-full text-sm" />
              <button onClick={uploadAvatar} className="mt-2 rounded-full border border-[#8dcfcb] px-4 py-2 text-sm font-semibold text-[#1a8a85]">
                {tr("uploadProfilePicture")}
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="workspace-input" value={profileForm.full_name} onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))} placeholder={tr("fullName")} />
            <input className="workspace-input" value={profileForm.department} onChange={(e) => setProfileForm((p) => ({ ...p, department: e.target.value }))} placeholder={tr("department")} />
            <input className="workspace-input md:col-span-2" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} placeholder={tr("phone")} />
          </div>
          <textarea className="workspace-input min-h-24 w-full" value={profileForm.bio} onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))} placeholder={tr("professionalBio")} />
          <button onClick={updateProfile} className="dashboard-action">
            {tr("saveProfile")}
          </button>
        </div>
      );
    }

    if (activeSection === "prescription") {
      return (
        <div className="space-y-3">
          <input className="workspace-input w-full" placeholder={tr("diagnosis")} value={prescriptionForm.diagnosis} onChange={(e) => setPrescriptionForm((p) => ({ ...p, diagnosis: e.target.value }))} />
          <textarea className="workspace-input min-h-16 w-full" placeholder={tr("medications")} value={prescriptionForm.medications} onChange={(e) => setPrescriptionForm((p) => ({ ...p, medications: e.target.value }))} />
          <textarea className="workspace-input min-h-16 w-full" placeholder={tr("instructions")} value={prescriptionForm.instructions} onChange={(e) => setPrescriptionForm((p) => ({ ...p, instructions: e.target.value }))} />
          <div className="grid gap-3 md:grid-cols-2">
            <input className="workspace-input" placeholder={tr("insurer")} value={prescriptionForm.insurer_name} onChange={(e) => setPrescriptionForm((p) => ({ ...p, insurer_name: e.target.value }))} />
            <input className="workspace-input" placeholder={tr("policyNumber")} value={prescriptionForm.policy_number} onChange={(e) => setPrescriptionForm((p) => ({ ...p, policy_number: e.target.value }))} />
            <input className="workspace-input" placeholder={tr("clinicianName")} value={prescriptionForm.clinician_name} onChange={(e) => setPrescriptionForm((p) => ({ ...p, clinician_name: e.target.value }))} />
            <input className="workspace-input" placeholder={tr("electronicSignature")} value={prescriptionForm.electronic_signature} onChange={(e) => setPrescriptionForm((p) => ({ ...p, electronic_signature: e.target.value }))} />
          </div>
          <button onClick={createPrescription} className="dashboard-action">
            {tr("generatePrescription")}
          </button>
        </div>
      );
    }

    if (activeSection === "history") {
      return (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] border border-[#d9efed] p-4 text-sm">
            <p className="mb-2 font-semibold">{tr("encounterReports")}</p>
            {history.map((h) => (
              <pre key={h.id} className="mb-2 whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 font-sans">
                {h.report_text}
              </pre>
            ))}
          </div>
          <div className="rounded-[24px] border border-[#d9efed] p-4 text-sm">
            <p className="mb-2 font-semibold">{tr("prescriptions")}</p>
            {prescriptions.map((p) => (
              <p key={p.id} className="mb-2 rounded-2xl bg-slate-50 p-3">
                {p.diagnosis} - {p.medications} ({p.clinician_name})
              </p>
            ))}
          </div>
        </div>
      );
    }

    if (activeSection === "analytics") {
      return <AnalyticsPanel data={analytics.common_conditions} />;
    }

    return null;
  };

  if (!loggedIn) {
    return (
      <main className="auth-shell px-4 py-6 md:px-8">
        <div className="auth-shell__frame mx-auto grid min-h-[88vh] max-w-[1180px] overflow-hidden rounded-[34px] bg-white shadow-[0_35px_85px_rgba(10,77,79,0.14)] lg:grid-cols-[1.02fr_1fr]">
          <section className="flex items-center justify-center px-6 py-8 md:px-12">
            <div className="w-full max-w-[390px]">
              <div className="mb-8 flex items-center gap-3">
                <Image src="/icon-192.png" width={48} height={48} alt="ClinIQ logo" className="rounded-2xl" />
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-cliniq-slate">{authMode === "signin" ? tr("signIn") : tr("signUp")}</p>
                  <p className="text-sm text-slate-500">{tr("authHelper")}</p>
                </div>
              </div>

              <div className="mb-6 inline-flex rounded-full bg-[#eef8f7] p-1">
                <button onClick={() => setAuthMode("signin")} className={cn("rounded-full px-4 py-2 text-sm font-semibold transition", authMode === "signin" ? "bg-white text-cliniq-slate shadow-sm" : "text-slate-500")}>
                  {tr("signIn")}
                </button>
                <button onClick={() => setAuthMode("signup")} className={cn("rounded-full px-4 py-2 text-sm font-semibold transition", authMode === "signup" ? "bg-white text-cliniq-slate shadow-sm" : "text-slate-500")}>
                  {tr("signUp")}
                </button>
              </div>

              <div className="space-y-4">
                {authMode === "signup" ? <input className="workspace-input auth-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={tr("fullName")} /> : null}
                <input className="workspace-input auth-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tr("email")} />
                <input type="password" className="workspace-input auth-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tr("password")} />
                <p className="text-xs text-[#1a8a85]">{tr("strongPasswordHint")}</p>
                <button onClick={handleAuth} disabled={loading} className="dashboard-action auth-submit w-full justify-center">
                  {loading ? "..." : authMode === "signin" ? tr("signIn") : tr("createAccount")}
                </button>
                {error ? <p className="break-words text-sm text-red-600">{error}</p> : null}
              </div>

              <div className="mt-8 rounded-[22px] bg-[#f6fbfb] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#1a8a85]">Demo Access</p>
                <p className="mt-2 text-sm text-slate-600">Use the seeded nurse account to enter the clinical workspace quickly while we iterate page by page.</p>
                <p className="mt-2 text-sm font-semibold text-cliniq-slate">nurse@cliniq.app / Nurse123!</p>
              </div>
            </div>
          </section>

          <section className="auth-visual relative hidden overflow-hidden lg:flex">
            <div className="auth-visual__orb auth-visual__orb--one" />
            <div className="auth-visual__orb auth-visual__orb--two" />
            <div className="auth-visual__orb auth-visual__orb--three" />
            <div className="relative z-10 flex w-full flex-col justify-between p-10 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">ClinIQ Workspace</p>
                <h2 className="mt-4 max-w-md text-4xl font-semibold leading-tight">Connected care coordination with fast bedside decisions.</h2>
                <p className="mt-4 max-w-md text-sm leading-6 text-cyan-50">The command center stays calm, clinical, and collaborative while preserving the platform palette you already established.</p>
              </div>

              <div className="relative mx-auto flex h-[420px] w-full max-w-[420px] items-end justify-center">
                <div className="auth-visual__figure">
                  <div className="auth-visual__headset" />
                  <div className="auth-visual__head" />
                  <div className="auth-visual__body" />
                  <div className="auth-visual__device" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fcfc_0%,#eef8f7_100%)] px-3 py-4 md:px-5 md:py-5">
      <div className="mx-auto max-w-[1600px]">
        <header className="dashboard-card mb-4 flex flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center gap-3 rounded-[22px] border border-[#d6ecea] bg-white px-3 py-2">
              <Image src="/icon-192.png" width={42} height={42} alt="ClinIQ logo" className="rounded-xl" />
              <div>
                <p className="text-lg font-semibold tracking-tight text-cliniq-slate">MedAssist Pro</p>
                <p className="text-xs text-[#1a8a85]">{currentUser?.department || "Clinical Operations"} • Live command center</p>
              </div>
            </div>

            <div className="hidden rounded-[22px] border border-[#d6ecea] bg-[#f9fdfd] px-3 py-2 md:block">
              <p className="text-sm font-semibold text-cliniq-slate">{currentUser?.full_name || "Nurse Olivia Carter"}</p>
              <p className="text-xs text-slate-500">{currentUser?.role || "RN-BSN"} • Critical Care</p>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <div className="hidden min-w-[260px] flex-1 items-center rounded-full border border-[#d6ecea] bg-[#fbfefe] px-4 py-2 md:flex lg:max-w-[360px]">
              <span className="mr-2 text-slate-400">⌕</span>
              <input className="w-full bg-transparent text-sm outline-none" placeholder="Search patients by name, MRN, or room" />
            </div>
            {advisorStatus ? (
              <span className={cn("rounded-full px-3 py-2 text-xs font-semibold", advisorStatus.available ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                {advisorStatus.provider} • {advisorStatus.available ? tr("advisorConnected") : tr("advisorFallback")}
              </span>
            ) : null}
            <button className="dashboard-action dashboard-action--soft" onClick={() => setActiveSection("registration")}>
              + New Patient
            </button>
            <button className="dashboard-action dashboard-action--soft" onClick={() => setActiveSection("labs")}>
              Scan / Upload Vitals
            </button>
            <select
              className="workspace-input min-w-[110px] !rounded-full !px-4 !py-2 text-sm"
              value={lang}
              onChange={(e) => {
                const v = e.target.value as LocaleCode;
                setLang(v);
                localStorage.setItem("cliniq_lang", v);
              }}
            >
              <option value="en-US">{tr("languageEnglish")}</option>
              <option value="rw-RW">{tr("languageKinyarwanda")}</option>
              <option value="fr-FR">{tr("languageFrench")}</option>
            </select>
            <button
              className="rounded-full border border-[#d6ecea] px-4 py-2 text-sm font-semibold text-slate-600"
              onClick={() => {
                localStorage.removeItem("cliniq_token");
                setLoggedIn(false);
              }}
            >
              {tr("logout")}
            </button>
          </div>
        </header>

        <AlertBanner show={criticalAlert} />
        {status ? <p className="mb-4 rounded-[22px] bg-cyan-50 px-4 py-3 text-sm text-cyan-700">{status}</p> : null}

        <div className="grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="dashboard-card overflow-hidden">
            <div className="border-b border-[#e2f0ef] px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-cliniq-slate">Assigned Patients</p>
                  <p className="text-xs text-slate-500">{patientQueue.length} active charts</p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1a8a85]">Recent</span>
              </div>
            </div>

            <div className="space-y-3 px-3 py-3">
              {patientQueue.map((patient, index) => (
                <button
                  key={patient.id}
                  className={cn(
                    "w-full rounded-[24px] border px-3 py-3 text-left transition",
                    index === 0 ? "border-[#98d5d1] bg-[#f4fbfb]" : "border-transparent bg-white hover:border-[#d6ecea]"
                  )}
                  onClick={() => setActiveSection("overview")}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#dff6f4,#c7ece9)] text-sm font-semibold text-cliniq-slate">
                      {patient.name
                        .split(" ")
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-cliniq-slate">{patient.name}</p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                            patient.acuity === "critical" && "bg-rose-100 text-rose-700",
                            patient.acuity === "watch" && "bg-sky-100 text-sky-700",
                            patient.acuity === "high" && "bg-amber-100 text-amber-700",
                            patient.acuity === "stable" && "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {patient.acuity}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        MRN {patient.mrn} • {patient.room}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>{patient.note}</span>
                        <span>{patient.unread > 0 ? `${patient.unread} unread` : "Open"}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="border-t border-[#e2f0ef] px-3 py-3">
              <div className="rounded-[22px] bg-[#f7fbfb] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{tr("trackingId")}</p>
                <p className="mt-1 text-lg font-semibold text-cliniq-slate">{trackingId}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {registeredPatient ? `${tr("department")}: ${registeredPatient.department}` : tr("noPatientLoaded")}
                </p>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            {renderWorkspaceSection()}

            <section className="dashboard-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold tracking-tight text-cliniq-slate">Workflow Studio</p>
                  <p className="text-sm text-slate-500">Detailed forms and tools for the selected clinical step.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sectionLabels.map((section) => (
                    <button
                      key={section.id}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition",
                        activeSection === section.id ? "bg-cliniq-teal text-white" : "bg-[#eef8f7] text-slate-600 hover:bg-[#e1f1ef]"
                      )}
                      onClick={() => setActiveSection(section.id)}
                    >
                      {formatSectionLabel(section.id, tr)}
                    </button>
                  ))}
                </div>
              </div>

              {activeSection !== "overview" ? <div className="mt-5">{renderWorkspaceSection()}</div> : null}
              {activeSection === "overview" ? (
                <div className="mt-5 rounded-[24px] border border-dashed border-[#cbe6e3] bg-[#fbfefe] p-5">
                  <p className="text-sm font-semibold text-cliniq-slate">Open a workflow module</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Use the tabs above to move from patient intake to assessment, labs, advisor support, escalation, collaboration, and analytics.
                  </p>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
