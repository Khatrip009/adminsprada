// src/pages/ErrorPage.jsx
import React from "react";
import { Link } from "react-router-dom";
import LOGO from "../assets/SPRADA_LOGO.png";

/**
 * ErrorPage.jsx
 *
 * Usage:
 *   <ErrorPage status={404} title="Page not found" message="We couldn't find that page." />
 *
 * This component is a polished, responsive error page tailored for an import-export company.
 * It includes a stylized animated doodle (ship, plane, container box) and handy actions.
 *
 * Drop into src/pages and import in your router for 404 / error routes.
 */

export default function ErrorPage({
  status = 404,
  title = "Page not found",
  message = "Sorry — the page you are looking for doesn't exist or has been moved.",
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-sprada1/30 p-6">
      <style>{`
        /* Page-specific styles and lightweight animations */
        .err-card {
          max-width: 1100px;
          width: 100%;
          border-radius: 18px;
          box-shadow: 0 20px 50px rgba(8,15,22,0.08);
          overflow: hidden;
        }

        .doodle-wrap {
          background: linear-gradient(180deg, rgba(15,107,90,0.04), rgba(15,107,90,0.02));
          padding: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .doodle {
          width: 420px;
          max-width: 88%;
          height: auto;
        }

        /* floating animations */
        @keyframes floaty {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        @keyframes slow-rotate {
          0% { transform: rotate(-6deg); }
          50% { transform: rotate(6deg); }
          100% { transform: rotate(-6deg); }
        }
        .float { animation: floaty 4.5s ease-in-out infinite; }
        .slow-rotate { animation: slow-rotate 8s ease-in-out infinite; transform-origin: center; }

        /* pulsing shadow under moving elements */
        .shadow-pulse {
          filter: blur(6px);
          opacity: 0.12;
          transition: opacity .3s;
        }

        /* text block */
        .err-body {
          padding: 34px;
          background: white;
        }

        .brand {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .cta-btn {
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .cta-btn:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(15,107,90,0.12); }

        /* responsive tweaks */
        @media (max-width: 900px) {
          .doodle { width: 320px; }
          .err-body { padding: 20px; }
        }
      `}</style>

      <div className="err-card bg-transparent grid grid-cols-2 md:grid-cols-3 gap-0">
        {/* Left: Illustration / doodle */}
        <div className="doodle-wrap md:col-span-1 col-span-2 flex items-center justify-center">
          <svg className="doodle" viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Import export doodle">
            {/* background soft globe */}
            <g transform="translate(450,220)">
              <circle cx="0" cy="-20" r="190" fill="url(#ggrad)" opacity="0.08" className="slow-rotate" />
            </g>

            <defs>
              <linearGradient id="ggrad" x1="0" x2="1">
                <stop offset="0" stopColor="#0f6b5a" stopOpacity="0.16" />
                <stop offset="1" stopColor="#1b8f73" stopOpacity="0.06" />
              </linearGradient>
            </defs>

            {/* Ship (left) */}
            <g transform="translate(130,360)" className="float" >
              <g transform="translate(-40, -20)">
                <rect x="0" y="20" width="220" height="30" rx="6" fill="#0f6b5a" opacity="0.95" />
                <rect x="20" y="-10" width="180" height="30" rx="4" fill="#ffffff" opacity="0.96" />
                <g transform="translate(30,-6)">
                  <rect x="0" y="-10" width="40" height="20" rx="3" fill="#e6f6f2" />
                  <rect x="52" y="-10" width="40" height="20" rx="3" fill="#e6f6f2" />
                  <rect x="104" y="-10" width="40" height="20" rx="3" fill="#e6f6f2" />
                </g>
                <ellipse cx="110" cy="60" rx="110" ry="18" fill="#0f6b5a" opacity="0.08" className="shadow-pulse" />
              </g>
            </g>

            {/* Plane (top-right) */}
            <g transform="translate(700,90) scale(0.9)" className="float" style={{ animationDelay: "0.2s" }}>
              <g transform="translate(-60, -20)">
                <polygon points="0,12 90,36 0,60 18,36" fill="#1b3937" opacity="0.95" />
                <rect x="24" y="28" width="70" height="6" rx="3" fill="#e6f6f2" />
                <ellipse cx="40" cy="70" rx="40" ry="8" fill="#1b3937" opacity="0.08" className="shadow-pulse" />
              </g>
            </g>

            {/* Container stack (center) */}
            <g transform="translate(360,320)" className="slow-rotate" style={{ animationDelay: "0.6s" }}>
              <g transform="translate(-60,-60)">
                <rect x="0" y="0" width="120" height="70" rx="6" fill="#e6a85a" />
                <rect x="0" y="-86" width="120" height="70" rx="6" fill="#bb7521" />
                <rect x="0" y="86" width="120" height="70" rx="6" fill="#1a6560" />
                <rect x="140" y="-18" width="120" height="70" rx="6" fill="#1b3937" />
                <ellipse cx="100" cy="160" rx="150" ry="22" fill="#0f6b5a" opacity="0.06" className="shadow-pulse" />
              </g>
            </g>

            {/* Cargo box rolling (bottom-right) */}
            <g transform="translate(640,380)" className="float" style={{ animationDelay: "0.1s" }}>
              <g transform="translate(-20,-20)">
                <rect x="0" y="0" width="80" height="60" rx="8" fill="#fff" stroke="#0f6b5a" strokeWidth="3"/>
                <line x1="10" y1="12" x2="70" y2="12" stroke="#0f6b5a" strokeWidth="2" strokeLinecap="round" />
                <line x1="10" y1="30" x2="70" y2="30" stroke="#0f6b5a" strokeWidth="2" strokeLinecap="round" />
                <ellipse cx="40" cy="84" rx="46" ry="8" fill="#0f6b5a" opacity="0.06" className="shadow-pulse" />
              </g>
            </g>

            {/* small decorative waves & routes */}
            <g transform="translate(0,0)" fill="none" stroke="#0f6b5a" strokeOpacity="0.18" strokeWidth="2">
              <path d="M40 420 q120 -40 240 0 t240 0" strokeDasharray="6 6" />
              <path d="M40 460 q120 -40 240 0 t240 0" strokeDasharray="6 8" />
            </g>
          </svg>
        </div>

        {/* Right: Text + actions */}
        <div className="err-body md:col-span-2 col-span-2 bg-white">
          <div className="flex items-start justify-between mb-4">
            <div className="brand">
              <img src={LOGO} alt="Company logo" className="w-20 h-20 object-contain" />
              <div>
                <div className="text-sm text-slate-500">Sprada Exports</div>
                <div className="text-2xl font-semibold text-sprada2">Import · Export · Logistics</div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-4xl font-bold text-slate-800">{status}</div>
              <div className="text-xs text-slate-500">Error code</div>
            </div>
          </div>

          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-slate-800">{title}</h2>
            <p className="text-sm text-slate-500 mt-2">{message}</p>

            <ul className="mt-4 ml-5 text-sm text-slate-600 list-disc space-y-2">
              <li>Check the URL for typos or missing parts.</li>
              <li>If you followed a link, it may be outdated — try returning to the dashboard.</li>
              <li>For urgent matters, contact our export support at <a href="mailto:support@exotech.co.in" className="text-sprada3 underline">support@exotech.co.in</a>.</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 items-center">
            <Link to="/dashboard" className="cta-btn inline-flex items-center gap-2 px-5 py-3 bg-[color:var(--sprada-accent)] text-white rounded-lg shadow">
              Go to Dashboard
            </Link>

            <Link to="/" className="inline-flex items-center gap-2 px-4 py-3 border rounded-lg text-sm text-slate-700">
              Home
            </Link>

            <a href="mailto:support@exotech.co.in" className="inline-flex items-center gap-2 px-4 py-3 border rounded-lg text-sm text-sprada3">
              Contact Support
            </a>

            <div className="ml-auto text-sm text-slate-500">Ref: {Math.random().toString(36).slice(2, 9).toUpperCase()}</div>
          </div>

          <div className="mt-6 border-t pt-4 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Need immediate assistance? Call us at <strong className="text-slate-700">+91 98765 43210</strong>
            </div>

            <div className="text-xs text-slate-400">
              © {new Date().getFullYear()} Sprada Exports — All rights reserved
            </div>
          </div>

          <div className="mt-4 text-center text-xs text-slate-400">
            Design and Managed by <strong>EXOTECH Developers</strong>. For more, visit{" "}
            <a href="https://www.exotech.co.in" target="_blank" rel="noreferrer" className="text-sprada3 underline">www.exotech.co.in</a>
          </div>
        </div>
      </div>
    </div>
  );
}
