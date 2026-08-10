// src/app/NotFound.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Catch-all for unmatched URLs.
//
// Before this existed the router had no `path="*"`, so an unmatched URL matched
// no branch at all and React Router rendered null — a bare white document with
// no sidebar, no navbar, and no error boundary (the boundary catches throws, not
// non-matches). Several in-app links landed there, including the redirect after
// a SUCCESSFUL password change.
//
// Rendered inside <Layout/>, so the chrome stays put and the rail/⌘K remain
// usable — a wrong address should never look like the app crashed.
// ─────────────────────────────────────────────────────────────────────────────

import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiHome, FiSearch } from "react-icons/fi";

export default function NotFound() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div
      className="min-h-[70vh] flex items-center justify-center px-4"
      style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}
    >
      <div className="w-full max-w-lg text-center">
        <p className="text-6xl font-extrabold tracking-tight text-slate-200 select-none">404</p>

        <h1 className="mt-2 text-xl font-extrabold text-slate-800">
          This page doesn&rsquo;t exist
        </h1>

        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          Nothing is mapped to{" "}
          <code className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-mono break-all">
            {pathname}
          </code>
          . The link may be out of date, or the address may have a typo.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200
              bg-white hover:bg-slate-50 text-slate-600 text-sm font-bold transition-all shadow-sm"
          >
            <FiArrowLeft className="w-4 h-4" /> Go back
          </button>

          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white
              bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600
              shadow-md shadow-blue-200 transition-all"
          >
            <FiHome className="w-4 h-4" /> Back to dashboard
          </Link>
        </div>

        <p className="mt-6 text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <FiSearch className="w-3.5 h-3.5" />
          Press <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 font-mono">Ctrl</kbd>
          <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 font-mono">K</kbd>
          to jump to any screen
        </p>
      </div>
    </div>
  );
}
