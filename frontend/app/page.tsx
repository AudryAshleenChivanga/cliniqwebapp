"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LocaleCode, t } from "@/lib/i18n";

const STAT_TARGETS = [72, 97, 18];

export default function LandingPage() {
  const [lang, setLang] = useState<LocaleCode>("en-US");
  const [stats, setStats] = useState([0, 0, 0]);

  const tr = (key: string) => t(lang, key);

  const featureCards = useMemo(
    () => [
      { title: tr("landingFeature1Title"), text: tr("landingFeature1Text") },
      { title: tr("landingFeature2Title"), text: tr("landingFeature2Text") },
      { title: tr("landingFeature3Title"), text: tr("landingFeature3Text") },
    ],
    [lang]
  );

  const steps = useMemo(
    () => [tr("landingStep1"), tr("landingStep2"), tr("landingStep3"), tr("landingStep4"), tr("landingStep5")],
    [lang]
  );

  useEffect(() => {
    const saved = (localStorage.getItem("cliniq_lang") as LocaleCode | null) || "en-US";
    setLang(saved);
  }, []);

  useEffect(() => {
    const start = performance.now();
    const duration = 1200;

    const animate = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setStats(STAT_TARGETS.map((target) => Math.round(target * eased)));
      if (p < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, []);

  return (
    <main className="auth-shell px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1220px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-full border border-white/70 bg-white/80 px-5 py-3 shadow-[0_18px_38px_rgba(10,77,79,0.08)] backdrop-blur">
          <div>
            <p className="text-2xl font-semibold tracking-tight text-cliniq-slate">ClinIQ</p>
            <p className="text-xs text-slate-500">{tr("landingTagline")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a href="#features" className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
              Features
            </a>
            <a href="#workflow" className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
              Workflow
            </a>
            <select
              className="rounded-full border border-[#d6ecea] bg-white px-4 py-2 text-sm"
              value={lang}
              onChange={(e) => {
                const nextLang = e.target.value as LocaleCode;
                setLang(nextLang);
                localStorage.setItem("cliniq_lang", nextLang);
              }}
            >
              <option value="en-US">{tr("languageEnglish")}</option>
              <option value="rw-RW">{tr("languageKinyarwanda")}</option>
              <option value="fr-FR">{tr("languageFrench")}</option>
            </select>
            <Link href="/dashboard" className="rounded-full border border-[#8dcfcb] px-4 py-2 text-sm font-semibold text-cliniq-teal transition hover:bg-[#edf8f7]">
              Sign Up
            </Link>
            <Link href="/dashboard" className="dashboard-action px-5 py-2">
              Login
            </Link>
          </div>
        </header>

        <section className="auth-shell__frame overflow-hidden rounded-[34px] bg-white shadow-[0_35px_85px_rgba(10,77,79,0.14)]">
          <div className="grid lg:grid-cols-[1.02fr_1fr]">
            <section className="flex items-center px-6 py-8 md:px-12 md:py-12">
              <div className="w-full max-w-[480px]">
                <div className="inline-flex rounded-full bg-[#eef8f7] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#1a8a85]">
                  Connected CDSS
                </div>

                <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-tight text-cliniq-slate md:text-6xl">
                  Clinical decisions at the speed of care.
                </h1>
                <p className="mt-5 text-base leading-7 text-slate-600 md:text-lg">
                  {tr("landingDescription")}
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/dashboard" className="dashboard-action px-6 py-3">
                    {tr("landingStartSession")}
                  </Link>
                  <a href="#workflow" className="rounded-full border border-[#d6ecea] bg-white px-6 py-3 text-sm font-semibold text-slate-700">
                    {tr("landingSeeWorkflow")}
                  </a>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[24px] bg-[#f7fbfb] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Modules</p>
                    <p className="mt-2 text-3xl font-semibold text-cliniq-slate">{stats[0]}+</p>
                  </div>
                  <div className="rounded-[24px] bg-[#f7fbfb] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">AI Confidence</p>
                    <p className="mt-2 text-3xl font-semibold text-cliniq-slate">{stats[1]}%</p>
                  </div>
                  <div className="rounded-[24px] bg-[#f7fbfb] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Escalation</p>
                    <p className="mt-2 text-3xl font-semibold text-cliniq-slate">{stats[2]}m</p>
                  </div>
                </div>

                <div id="features" className="mt-8 grid gap-3">
                  {featureCards.map((feature) => (
                    <div key={feature.title} className="rounded-[24px] border border-[#e5f1f0] bg-white p-4 shadow-[0_12px_26px_rgba(10,77,79,0.05)]">
                      <p className="text-sm font-semibold text-cliniq-slate">{feature.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="auth-visual relative overflow-hidden">
              <div className="auth-visual__orb auth-visual__orb--one" />
              <div className="auth-visual__orb auth-visual__orb--two" />
              <div className="auth-visual__orb auth-visual__orb--three" />

              <div className="relative z-10 flex min-h-full flex-col justify-between p-7 text-white md:p-10">
                <div className="rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">Live Clinical Workspace</p>
                      <p className="text-xs text-cyan-100">Unified patient context and bedside support</p>
                    </div>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Active</span>
                  </div>

                  <div className="mt-5 rounded-[24px] bg-white/12 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
                        MA
                      </div>
                      <div>
                        <p className="font-semibold">Miriam Alvarez</p>
                        <p className="text-xs text-cyan-100">ER | Open patient record</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/12 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-100">HR</p>
                        <p className="mt-2 text-2xl font-semibold">128</p>
                      </div>
                      <div className="rounded-2xl bg-white/12 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-100">SpO2</p>
                        <p className="mt-2 text-2xl font-semibold">92%</p>
                      </div>
                      <div className="rounded-2xl bg-white/12 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-100">BP</p>
                        <p className="mt-2 text-2xl font-semibold">88/56</p>
                      </div>
                      <div className="rounded-2xl bg-white/12 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-100">Risk</p>
                        <p className="mt-2 text-2xl font-semibold">81%</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[24px] bg-white p-4 text-cliniq-slate">
                    <p className="text-sm font-semibold">MedGemma Advisory</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Review perfusion, capture lactate, and prepare escalation summary for supervising clinician.
                    </p>
                  </div>
                </div>

                <div id="workflow" className="rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">{tr("landingHowItWorks")}</p>
                  <div className="mt-4 space-y-3">
                    {steps.slice(0, 4).map((step, index) => (
                      <div key={step} className="flex items-start gap-3 rounded-2xl bg-white/10 px-3 py-3">
                        <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
                          {index + 1}
                        </span>
                        <p className="text-sm text-cyan-50">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
