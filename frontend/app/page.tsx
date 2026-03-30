"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LocaleCode, t } from "@/lib/i18n";

const STAT_TARGETS = [72, 97, 18];

export default function LandingPage() {
  const [lang, setLang] = useState<LocaleCode>("en-US");
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
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
    const featureTimer = window.setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 3);
    }, 2800);
    const stepTimer = window.setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 5);
    }, 2200);

    return () => {
      window.clearInterval(featureTimer);
      window.clearInterval(stepTimer);
    };
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
    <main className="relative min-h-screen overflow-hidden bg-[#f7fffe]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(12,141,134,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(12,141,134,0.06)_1px,transparent_1px)] bg-[size:38px_38px]" />
      <div className="pointer-events-none absolute -left-28 top-8 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl orb-float" />
      <div className="pointer-events-none absolute right-0 top-1/4 h-80 w-80 rounded-full bg-teal-200/40 blur-3xl orb-float-delayed" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl orb-float-slow" />

      <div className="relative mx-auto max-w-7xl px-6 py-8">
        <header className="sticky top-3 z-20 glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
          <div>
            <h1 className="text-2xl font-bold text-cliniq-slate">ClinIQ</h1>
            <p className="text-xs text-slate-600">{tr("landingTagline")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a href="#features" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              Features
            </a>
            <a href="#workflow" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              Workflow
            </a>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
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
            <Link href="/dashboard" className="rounded-lg border border-cliniq-teal px-4 py-2 text-sm font-semibold text-cliniq-teal transition hover:bg-cyan-50">
              Sign Up
            </Link>
            <Link href="/dashboard" className="rounded-lg bg-cliniq-teal px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-cliniq-cyan">
              Login
            </Link>
          </div>
        </header>

        <section className="mt-8 hero-panel rounded-3xl p-8 text-white shadow-2xl">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-200">Connected CDSS</p>
          <h2 className="mt-3 max-w-4xl text-4xl font-bold leading-tight md:text-6xl">{tr("landingHero")}</h2>
          <p className="mt-4 max-w-3xl text-cyan-100">{tr("landingDescription")}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="metric-card rounded-xl p-3">
              <p className="text-xs text-cyan-100">Active Modules</p>
              <p className="text-xl font-bold">{stats[0]}+</p>
            </div>
            <div className="metric-card rounded-xl p-3">
              <p className="text-xs text-cyan-100">AI Confidence Band</p>
              <p className="text-xl font-bold">{stats[1]}%</p>
            </div>
            <div className="metric-card rounded-xl p-3">
              <p className="text-xs text-cyan-100">Escalation Median</p>
              <p className="text-xl font-bold">{stats[2]}m</p>
            </div>
          </div>
        </section>

        <section id="features" className="mt-10 grid gap-4 md:grid-cols-3">
          {featureCards.map((feature, idx) => (
            <article
              key={feature.title}
              className={`rounded-2xl bg-white p-5 shadow-md transition-all duration-300 ${
                activeFeature === idx ? "-translate-y-1 ring-2 ring-cliniq-teal/30" : ""
              }`}
            >
              <div className="mb-3 inline-flex rounded-lg bg-cyan-50 p-2 text-cliniq-teal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  {idx === 0 ? (
                    <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  ) : idx === 1 ? (
                    <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  ) : (
                    <path d="M12 2l3 7h7l-5.5 4.2L18.5 21 12 16.8 5.5 21l2-7.8L2 9h7l3-7z" stroke="currentColor" strokeWidth="1.6" fill="none" />
                  )}
                </svg>
              </div>
              <h3 className="text-lg font-bold text-cliniq-slate">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.text}</p>
            </article>
          ))}
        </section>

        <section id="workflow" className="mt-10 rounded-3xl bg-white p-6 shadow-lg">
          <h3 className="text-2xl font-bold text-cliniq-slate">{tr("landingHowItWorks")}</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {steps.map((step, idx) => (
              <div
                key={step}
                className={`rounded-xl border border-slate-100 p-3 text-sm transition-all duration-300 ${
                  activeStep === idx ? "bg-cyan-50 ring-2 ring-cyan-200" : "bg-slate-50"
                }`}
              >
                <p className="mb-1 text-xs font-semibold text-cliniq-teal">Step {idx + 1}</p>
                <p>{step}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard" className="rounded-lg bg-cliniq-teal px-5 py-2 font-semibold text-white transition hover:bg-cliniq-cyan">
              Login to Clinical Workspace
            </Link>
            <Link href="/dashboard" className="rounded-lg border border-slate-300 px-5 py-2 font-semibold text-slate-700 transition hover:bg-slate-50">
              Open Dashboard
            </Link>
          </div>
        </section>
      </div>

      <style jsx>{`
        .glass-panel {
          background: rgba(255, 255, 255, 0.88);
          box-shadow: 0 18px 45px rgba(10, 77, 79, 0.12);
          backdrop-filter: blur(8px);
        }

        .hero-panel {
          background: linear-gradient(135deg, #12343b 0%, #0c8d86 56%, #0fb7b0 100%);
          position: relative;
          overflow: hidden;
        }

        .hero-panel::before {
          content: "";
          position: absolute;
          inset: -80px -50px auto auto;
          width: 220px;
          height: 220px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.12);
          filter: blur(4px);
        }

        .metric-card {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .orb-float {
          animation: orb1 9s ease-in-out infinite;
        }

        .orb-float-delayed {
          animation: orb2 11s ease-in-out infinite;
        }

        .orb-float-slow {
          animation: orb3 13s ease-in-out infinite;
        }

        @keyframes orb1 {
          0%,
          100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(-22px) translateX(12px);
          }
        }

        @keyframes orb2 {
          0%,
          100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(18px) translateX(-18px);
          }
        }

        @keyframes orb3 {
          0%,
          100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(-14px) translateX(20px);
          }
        }
      `}</style>
    </main>
  );
}
