"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { AlertBanner } from "@/components/AlertBanner";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { apiRequest, login } from "@/lib/api";
import { LocaleCode, t } from "@/lib/i18n";
import { transcribeOnce } from "@/lib/voice";

type SectionId = "registration" | "assessment" | "labs" | "advisor" | "escalation" | "team" | "profile" | "prescription" | "history" | "analytics";
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

const sectionLabels: Array<{ id: SectionId; key: string }> = [
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

const defaultPatient = { national_id: "", full_name: "", age: 30, sex: "Female", contact: "", medical_history: "", department: "OPD" };
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

export default function DashboardPage() {
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("nurse@cliniq.app");
  const [password, setPassword] = useState("Nurse123!");
  const [fullName, setFullName] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("registration");
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
  const [prescriptions, setPrescriptions] = useState<Array<{ id: number; diagnosis: string; medications: string; clinician_name: string; electronic_signature: string }>>([]);
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
    void apiRequest("/analytics/summary").then((v) => setAnalytics(v as any)).catch(() => undefined);
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
    setHistory(h as any);
    setPrescriptions(p as any);
  };

  const loadDoctorChat = async (encounterId: number) => {
    const msgs = await apiRequest(`/doctor-chat/${encounterId}`).catch(() => []);
    setDoctorChatMessages(msgs as any);
  };

  const loadTeamMessages = async () => {
    const msgs = await apiRequest("/team-chat").catch(() => []);
    setTeamMessages(msgs as any);
  };

  const loadAdvisorStatus = async () => {
    const status = await apiRequest("/assistant/status").catch(() => null);
    setAdvisorStatus(status as any);
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
    setActiveSection("labs");
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
    setActiveSection("advisor");
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
    const res = (await apiRequest(`/encounters/${encounter.encounter_id}/call-ambulance`, { method: "POST" })) as { eta_minutes: number };
    setEncounter((prev) => (prev ? { ...prev, ambulance_message: `${tr("ambulance")}: ETA ${res.eta_minutes} min`, report: { ...prev.report, ambulance_called: true, ambulance_eta_minutes: res.eta_minutes } } : prev));
  };

  const createPrescription = async () => {
    if (!registeredPatient) throw new Error(tr("statusPatientRequired"));
    const p = await apiRequest("/prescriptions", {
      method: "POST",
      body: JSON.stringify({ patient_id: registeredPatient.id, encounter_id: encounter?.encounter_id || null, ...prescriptionForm }),
    });
    setPrescriptions((prev) => [p as any, ...prev]);
    setStatus(tr("statusPrescriptionSaved"));
  };

  if (!loggedIn) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <div className="card space-y-4 p-6">
          <div className="flex items-center gap-3">
            <Image src="/icon-192.png" width={44} height={44} alt="ClinIQ logo" className="rounded-lg" />
            <div>
              <h1 className="text-2xl font-bold">{authMode === "signin" ? tr("signIn") : tr("signUp")}</h1>
              <p className="text-sm text-slate-600">{tr("authHelper")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAuthMode("signin")} className={`rounded-lg px-3 py-2 text-sm ${authMode === "signin" ? "bg-cliniq-teal text-white" : "bg-slate-100"}`}>{tr("signIn")}</button>
            <button onClick={() => setAuthMode("signup")} className={`rounded-lg px-3 py-2 text-sm ${authMode === "signup" ? "bg-cliniq-teal text-white" : "bg-slate-100"}`}>{tr("signUp")}</button>
          </div>
          {authMode === "signup" ? <input className="rounded-lg border p-2" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={tr("fullName")} /> : null}
          <input className="rounded-lg border p-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tr("email")} />
          <input type="password" className="rounded-lg border p-2" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tr("password")} />
          <p className="text-xs text-slate-500">{tr("strongPasswordHint")}</p>
          <button onClick={handleAuth} disabled={loading} className="rounded-lg bg-cliniq-teal px-4 py-2 font-semibold text-white">{loading ? "..." : authMode === "signin" ? tr("signIn") : tr("createAccount")}</button>
          {error ? <p className="text-sm text-red-600 break-words">{error}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-4 md:px-6">
      <header className="card mb-4 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-cliniq-slate to-cliniq-teal p-4 text-white">
        <div className="flex items-center gap-3">
          <Image src="/icon-192.png" width={52} height={52} alt="ClinIQ logo" className="rounded-xl bg-white p-1" />
          <div>
            <h1 className="text-xl font-bold md:text-2xl">{tr("appTitle")}</h1>
            <p className="text-xs text-cyan-100 md:text-sm">{tr("appSubtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {advisorStatus ? (
            <span
              className={`inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold ${
                advisorStatus.available ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {tr("advisorLabel")}: {advisorStatus.provider} ({advisorStatus.available ? tr("advisorConnected") : tr("advisorFallback")})
            </span>
          ) : null}
          <select className="rounded-lg bg-white px-3 py-2 text-slate-800" value={lang} onChange={(e) => { const v = e.target.value as LocaleCode; setLang(v); localStorage.setItem("cliniq_lang", v); }}>
            <option value="en-US">{tr("languageEnglish")}</option>
            <option value="rw-RW">{tr("languageKinyarwanda")}</option>
            <option value="fr-FR">{tr("languageFrench")}</option>
          </select>
          <button className="rounded-lg border border-white/40 px-3 py-2" onClick={() => { localStorage.removeItem("cliniq_token"); setLoggedIn(false); }}>{tr("logout")}</button>
        </div>
      </header>

      <AlertBanner show={criticalAlert} />
      {status ? <p className="mt-2 rounded-lg bg-cyan-50 p-2 text-sm text-cyan-700">{status}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="card p-3">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("sidebarModules")}</p>
          <div className="space-y-1">
            {sectionLabels.map((s) => (
              <button key={s.id} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${activeSection === s.id ? "bg-cliniq-teal text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`} onClick={() => setActiveSection(s.id)}>{tr(s.key)}</button>
            ))}
          </div>
          <div className="mt-4 rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
            <p>{tr("trackingId")}</p>
            <p className="font-semibold text-slate-800">{trackingId}</p>
            {registeredPatient ? <p className="mt-1">{tr("department")}: {registeredPatient.department}</p> : <p className="mt-1">{tr("noPatientLoaded")}</p>}
          </div>
        </aside>

        <section className="card p-5">
          {activeSection === "registration" ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input className="rounded-lg border p-2" placeholder={tr("nationalId")} value={patientForm.national_id} onChange={(e) => setPatientForm((p) => ({ ...p, national_id: e.target.value }))} />
                <input className="rounded-lg border p-2" placeholder={tr("fullName")} value={patientForm.full_name} onChange={(e) => setPatientForm((p) => ({ ...p, full_name: e.target.value }))} />
                <input className="rounded-lg border p-2" type="number" placeholder={tr("age")} value={patientForm.age} onChange={(e) => setPatientForm((p) => ({ ...p, age: Number(e.target.value) }))} />
                <input className="rounded-lg border p-2" placeholder={tr("sex")} value={patientForm.sex} onChange={(e) => setPatientForm((p) => ({ ...p, sex: e.target.value }))} />
                <input className="rounded-lg border p-2" placeholder={tr("contact")} value={patientForm.contact} onChange={(e) => setPatientForm((p) => ({ ...p, contact: e.target.value }))} />
                <select className="rounded-lg border p-2" value={patientForm.department} onChange={(e) => setPatientForm((p) => ({ ...p, department: e.target.value }))}>
                  <option>OPD</option><option>Emergency</option><option>Pediatrics</option><option>Maternity</option><option>Surgery</option><option>Internal Medicine</option>
                </select>
              </div>
              <textarea className="min-h-20 w-full rounded-lg border p-2" placeholder={tr("ehrHistory")} value={patientForm.medical_history} onChange={(e) => setPatientForm((p) => ({ ...p, medical_history: e.target.value }))} />
              <div className="flex gap-2">
                <button onClick={registerPatient} className="rounded-lg bg-cliniq-teal px-4 py-2 font-semibold text-white">{tr("registerPatient")}</button>
                <button onClick={findPatient} className="rounded-lg border px-4 py-2">{tr("loadExisting")}</button>
              </div>
            </div>
          ) : null}

          {activeSection === "assessment" ? (
            <div className="space-y-3">
              <textarea className="min-h-24 w-full rounded-lg border p-2" placeholder={tr("symptoms")} value={assessmentForm.symptoms} onChange={(e) => setAssessmentForm((f) => ({ ...f, symptoms: e.target.value }))} />
              <div className="grid gap-3 md:grid-cols-3">
                <input className="rounded-lg border p-2" placeholder={tr("temperature")} value={assessmentForm.temperature} onChange={(e) => setAssessmentForm((f) => ({ ...f, temperature: Number(e.target.value) }))} />
                <input className="rounded-lg border p-2" placeholder={tr("systolicBp")} value={assessmentForm.systolic_bp} onChange={(e) => setAssessmentForm((f) => ({ ...f, systolic_bp: Number(e.target.value) }))} />
                <input className="rounded-lg border p-2" placeholder={tr("diastolicBp")} value={assessmentForm.diastolic_bp} onChange={(e) => setAssessmentForm((f) => ({ ...f, diastolic_bp: Number(e.target.value) }))} />
                <input className="rounded-lg border p-2" placeholder={tr("heartRate")} value={assessmentForm.heart_rate} onChange={(e) => setAssessmentForm((f) => ({ ...f, heart_rate: Number(e.target.value) }))} />
                <input className="rounded-lg border p-2" placeholder={tr("oxygenSaturation")} value={assessmentForm.oxygen_saturation} onChange={(e) => setAssessmentForm((f) => ({ ...f, oxygen_saturation: Number(e.target.value) }))} />
                <input className="rounded-lg border p-2" placeholder={tr("referralFacility")} value={assessmentForm.target_facility} onChange={(e) => setAssessmentForm((f) => ({ ...f, target_facility: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => transcribeOnce((txt) => setAssessmentForm((f) => ({ ...f, symptoms: `${f.symptoms} ${txt}`.trim() })), () => setStatus(tr("statusSpeechNotSupported")))} className="rounded-lg border border-cliniq-teal px-4 py-2 text-cliniq-teal">{tr("voiceInput")}</button>
                <button onClick={runPrelab} className="rounded-lg bg-cliniq-teal px-4 py-2 font-semibold text-white">{tr("runPrelab")}</button>
              </div>
              {prelab ? <p className="rounded-lg bg-slate-50 p-3 text-sm">{tr("risk")} {(prelab.risk_score * 100).toFixed(0)}% | {tr("triage")} {prelab.triage}</p> : null}
            </div>
          ) : null}

          {activeSection === "labs" ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <input className="rounded-lg border p-2" placeholder={tr("wbc")} value={assessmentForm.wbc} onChange={(e) => setAssessmentForm((f) => ({ ...f, wbc: e.target.value }))} />
                <input className="rounded-lg border p-2" placeholder={tr("lactate")} value={assessmentForm.lactate} onChange={(e) => setAssessmentForm((f) => ({ ...f, lactate: e.target.value }))} />
                <input className="rounded-lg border p-2" placeholder={tr("hemoglobin")} value={assessmentForm.hemoglobin} onChange={(e) => setAssessmentForm((f) => ({ ...f, hemoglobin: e.target.value }))} />
                <input className="rounded-lg border p-2" placeholder={tr("platelets")} value={assessmentForm.platelets} onChange={(e) => setAssessmentForm((f) => ({ ...f, platelets: e.target.value }))} />
                <input className="rounded-lg border p-2" placeholder={tr("glucose")} value={assessmentForm.glucose} onChange={(e) => setAssessmentForm((f) => ({ ...f, glucose: e.target.value }))} />
                <input className="rounded-lg border p-2" placeholder={tr("crp")} value={assessmentForm.crp} onChange={(e) => setAssessmentForm((f) => ({ ...f, crp: e.target.value }))} />
              </div>
              <button onClick={runPostLab} className="rounded-lg bg-cliniq-teal px-4 py-2 font-semibold text-white">{tr("runPostlab")}</button>
              {encounter ? <pre className="rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap font-sans">{encounter.report.report_text}</pre> : null}
            </div>
          ) : null}

          {activeSection === "advisor" ? (
            <div className="space-y-3">
              {advisorStatus ? (
                <p className={`rounded-lg p-2 text-xs ${advisorStatus.available ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {tr("providerLabel")}: {advisorStatus.provider} | {tr("modeLabel")}: {advisorStatus.mode} | {tr("statusLabel")}: {advisorStatus.available ? tr("advisorConnected") : tr("advisorFallback")}
                </p>
              ) : null}
              <div className="max-h-72 space-y-2 overflow-auto rounded-lg border p-3 text-sm">
                {advisorMessages.length === 0 ? <p className="text-slate-500">{tr("askAdvisorEmpty")}</p> : null}
                {advisorMessages.map((m, i) => <pre key={i} className={`whitespace-pre-wrap rounded p-2 ${m.role === "ai" ? "bg-cyan-50" : "bg-slate-50"}`}>{m.role === "ai" ? `${tr("aiAdvisorPrefix")}:\n` : `${tr("nursePrefix")}:\n`}{m.text}</pre>)}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 rounded-lg border p-2" value={advisorInput} onChange={(e) => setAdvisorInput(e.target.value)} placeholder={tr("askAiAdvisor")} />
                <button onClick={askAdvisor} className="rounded-lg bg-cliniq-teal px-4 py-2 font-semibold text-white">{tr("ask")}</button>
              </div>
            </div>
          ) : null}

          {activeSection === "escalation" ? (
            <div className="space-y-3">
              <button onClick={callAmbulance} disabled={!encounter} className="rounded-lg bg-cliniq-red px-4 py-2 font-semibold text-white disabled:opacity-50">{tr("callAmbulance")}</button>
              <div className="max-h-56 space-y-2 overflow-auto rounded-lg border p-3 text-sm">
                {doctorChatMessages.length === 0 ? <p className="text-slate-500">{tr("noDoctorMessages")}</p> : null}
                {doctorChatMessages.map((m) => <p key={m.id} className="rounded bg-slate-50 p-2"><span className="font-semibold">{m.sender_role}</span>: {m.message}</p>)}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 rounded-lg border p-2" value={doctorChatText} onChange={(e) => setDoctorChatText(e.target.value)} placeholder={tr("messageDoctor")} />
                <button onClick={sendDoctorMessage} className="rounded-lg border px-4">{tr("send")}</button>
              </div>
            </div>
          ) : null}

          {activeSection === "team" ? (
            <div className="space-y-3">
              <div className="max-h-64 space-y-2 overflow-auto rounded-lg border p-3 text-sm">
                {teamMessages.length === 0 ? <p className="text-slate-500">{tr("noTeamMessages")}</p> : null}
                {teamMessages.map((m) => {
                  const mine = currentUser?.id === m.sender_user_id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "bg-cliniq-teal text-white" : "bg-slate-100 text-slate-800"}`}>
                        <div className="mb-1 flex items-center gap-2 text-xs">
                          {m.sender_avatar_url ? (
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}${m.sender_avatar_url}`}
                              width={18}
                              height={18}
                              alt="avatar"
                              className="h-[18px] w-[18px] rounded-full object-cover"
                            />
                          ) : (
                            <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white/30 text-[10px] font-bold">
                              {m.sender_name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="font-semibold">{m.sender_name}</span>
                          <span className="opacity-70">{new Date(m.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p>{m.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 rounded-lg border p-2" value={teamMessageInput} onChange={(e) => setTeamMessageInput(e.target.value)} placeholder={tr("messageTeam")} />
                <button onClick={sendTeamMessage} className="rounded-lg bg-cliniq-teal px-4 py-2 font-semibold text-white">{tr("send")}</button>
              </div>
            </div>
          ) : null}

          {activeSection === "profile" ? (
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
                  <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} className="w-full rounded-lg border p-2 text-sm" />
                  <button onClick={uploadAvatar} className="mt-2 rounded-lg border border-cliniq-teal px-3 py-2 text-sm font-semibold text-cliniq-teal">
                    {tr("uploadProfilePicture")}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input className="rounded-lg border p-2" value={profileForm.full_name} onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))} placeholder={tr("fullName")} />
                <input className="rounded-lg border p-2" value={profileForm.department} onChange={(e) => setProfileForm((p) => ({ ...p, department: e.target.value }))} placeholder={tr("department")} />
                <input className="rounded-lg border p-2 md:col-span-2" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} placeholder={tr("phone")} />
              </div>
              <textarea className="min-h-20 w-full rounded-lg border p-2" value={profileForm.bio} onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))} placeholder={tr("professionalBio")} />
              <button onClick={updateProfile} className="rounded-lg bg-cliniq-teal px-4 py-2 font-semibold text-white">
                {tr("saveProfile")}
              </button>
            </div>
          ) : null}

          {activeSection === "prescription" ? (
            <div className="space-y-3">
              <input className="w-full rounded-lg border p-2" placeholder={tr("diagnosis")} value={prescriptionForm.diagnosis} onChange={(e) => setPrescriptionForm((p) => ({ ...p, diagnosis: e.target.value }))} />
              <textarea className="min-h-16 w-full rounded-lg border p-2" placeholder={tr("medications")} value={prescriptionForm.medications} onChange={(e) => setPrescriptionForm((p) => ({ ...p, medications: e.target.value }))} />
              <textarea className="min-h-16 w-full rounded-lg border p-2" placeholder={tr("instructions")} value={prescriptionForm.instructions} onChange={(e) => setPrescriptionForm((p) => ({ ...p, instructions: e.target.value }))} />
              <div className="grid gap-3 md:grid-cols-2">
                <input className="rounded-lg border p-2" placeholder={tr("insurer")} value={prescriptionForm.insurer_name} onChange={(e) => setPrescriptionForm((p) => ({ ...p, insurer_name: e.target.value }))} />
                <input className="rounded-lg border p-2" placeholder={tr("policyNumber")} value={prescriptionForm.policy_number} onChange={(e) => setPrescriptionForm((p) => ({ ...p, policy_number: e.target.value }))} />
                <input className="rounded-lg border p-2" placeholder={tr("clinicianName")} value={prescriptionForm.clinician_name} onChange={(e) => setPrescriptionForm((p) => ({ ...p, clinician_name: e.target.value }))} />
                <input className="rounded-lg border p-2" placeholder={tr("electronicSignature")} value={prescriptionForm.electronic_signature} onChange={(e) => setPrescriptionForm((p) => ({ ...p, electronic_signature: e.target.value }))} />
              </div>
              <button onClick={createPrescription} className="rounded-lg bg-cliniq-teal px-4 py-2 font-semibold text-white">{tr("generatePrescription")}</button>
            </div>
          ) : null}

          {activeSection === "history" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-3 text-sm">
                <p className="mb-2 font-semibold">{tr("encounterReports")}</p>
                {history.map((h) => <pre key={h.id} className="mb-2 whitespace-pre-wrap rounded bg-slate-50 p-2 font-sans">{h.report_text}</pre>)}
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <p className="mb-2 font-semibold">{tr("prescriptions")}</p>
                {prescriptions.map((p) => <p key={p.id} className="mb-2 rounded bg-slate-50 p-2">{p.diagnosis} - {p.medications} ({p.clinician_name})</p>)}
              </div>
            </div>
          ) : null}

          {activeSection === "analytics" ? <AnalyticsPanel data={analytics.common_conditions} /> : null}
        </section>
      </div>
    </main>
  );
}
