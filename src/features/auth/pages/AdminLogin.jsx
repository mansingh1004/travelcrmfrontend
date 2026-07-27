






import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Lock, Mail, MapPin, Check, AlertCircle,
  ShieldCheck, ArrowRight, ChevronLeft, ChevronRight,
  Megaphone, Globe, ServerCog,
} from 'lucide-react';
import {
  motion, AnimatePresence, MotionConfig, useReducedMotion,
} from 'framer-motion';

// 👉 Same service imports as before — AUTH LOGIC 100% UNTOUCHED
import { authService } from "../api/LoginService";
import { loadMyPermissions, loadMyEntitlements } from "@shared/lib/access";

// No role switcher. It never chose the endpoint — LoginService always tries superadmin
// first and falls back to the user login — and the backend returns the real role, which is
// what gets persisted. Platform operators sign in at /superadmin/login.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EASE = [0.16, 1, 0.3, 1];

/* ------------------------------------------------------------------ *
 * Slide illustrations — self-contained SVG, one shared visual language
 * (ground glow, dark-blue palette, a single amber accent).
 * ------------------------------------------------------------------ */
const IlloFunnel = () => (
  <svg viewBox="0 0 220 200" className="tlc-illoSvg" role="img" aria-label="Leads flowing into a pipeline">
    <defs>
      <linearGradient id="tlcFnlBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#1E3A8A" /></linearGradient>
      <linearGradient id="tlcFnlMouth" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#93C5FD" /><stop offset="1" stopColor="#2563EB" /></linearGradient>
      <radialGradient id="tlcFnlGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#3B82F6" stopOpacity=".5" /><stop offset="1" stopColor="#3B82F6" stopOpacity="0" /></radialGradient>
      <radialGradient id="tlcSphA" cx="35%" cy="30%" r="72%"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#BFDBFE" /></radialGradient>
      <radialGradient id="tlcSphB" cx="35%" cy="30%" r="72%"><stop offset="0" stopColor="#93C5FD" /><stop offset="1" stopColor="#2563EB" /></radialGradient>
      <radialGradient id="tlcSphC" cx="35%" cy="30%" r="72%"><stop offset="0" stopColor="#C4B5FD" /><stop offset="1" stopColor="#7C3AED" /></radialGradient>
    </defs>
    <ellipse cx="110" cy="170" rx="72" ry="18" fill="url(#tlcFnlGlow)" />
    <ellipse cx="110" cy="88" rx="98" ry="34" fill="none" stroke="#3B4B66" strokeWidth="1.3" strokeDasharray="2 7" transform="rotate(-12 110 88)" />
    <ellipse cx="110" cy="92" rx="86" ry="28" fill="none" stroke="#38507A" strokeWidth="1.2" strokeDasharray="1 8" opacity=".7" transform="rotate(9 110 92)" />
    <path d="M64 74 H156 L124 128 V150 L110 164 L96 150 V128 Z" fill="url(#tlcFnlBody)" />
    <path d="M64 74 H156 L150 84 H70 Z" fill="#BFDBFE" opacity=".55" />
    <path d="M96 128 L110 164 L124 128 Z" fill="#1E40AF" opacity=".5" />
    <ellipse cx="110" cy="74" rx="46" ry="11" fill="url(#tlcFnlMouth)" />
    <ellipse cx="110" cy="72" rx="34" ry="7" fill="#0F172A" opacity=".22" />
    <circle cx="92" cy="50" r="14" fill="url(#tlcSphA)" />
    <circle cx="120" cy="42" r="11" fill="url(#tlcSphB)" />
    <circle cx="140" cy="56" r="8" fill="url(#tlcSphC)" />
    <circle cx="74" cy="60" r="7" fill="url(#tlcSphB)" />
    <circle cx="108" cy="62" r="6" fill="url(#tlcSphA)" />
    <rect x="96" y="166" width="28" height="28" rx="8" fill="#F59E0B" />
    <rect x="96" y="166" width="28" height="28" rx="8" fill="none" stroke="#FCD34D" strokeWidth="1" opacity=".6" />
    <circle cx="105" cy="178" r="2.6" fill="#fff" /><circle cx="115" cy="178" r="2.6" fill="#fff" />
    <path d="M101 186 q5 -6 10 0" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
    <circle cx="170" cy="70" r="2" fill="#93C5FD" />
    <circle cx="52" cy="96" r="1.6" fill="#A78BFA" />
    <circle cx="178" cy="106" r="1.6" fill="#BFDBFE" />
    <circle cx="46" cy="70" r="1.4" fill="#F59E0B" />
  </svg>
);

const IlloDoc = () => (
  <svg viewBox="0 0 220 200" className="tlc-illoSvg" role="img" aria-label="Branded quotation as a PDF">
    <defs>
      <linearGradient id="tlcDoc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#4F46E5" /></linearGradient>
      <radialGradient id="tlcDocGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#4F46E5" stopOpacity=".5" /><stop offset="1" stopColor="#4F46E5" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="110" cy="168" rx="60" ry="20" fill="url(#tlcDocGlow)" />
    <rect x="76" y="42" width="90" height="120" rx="10" fill="#1E293B" stroke="#334155" />
    <rect x="58" y="32" width="96" height="128" rx="11" fill="#0F172A" stroke="#3B82F6" strokeOpacity=".45" />
    <path d="M58 43 Q58 32 69 32 H143 Q154 32 154 43 V62 H58 Z" fill="url(#tlcDoc)" />
    <circle cx="76" cy="49" r="8" fill="#fff" opacity=".92" />
    <rect x="90" y="45" width="42" height="4" rx="2" fill="#fff" opacity=".85" />
    <rect x="90" y="53" width="28" height="3" rx="1.5" fill="#fff" opacity=".5" />
    <rect x="72" y="80" width="68" height="4" rx="2" fill="#475569" />
    <rect x="72" y="92" width="52" height="4" rx="2" fill="#334155" />
    <rect x="72" y="108" width="68" height="4" rx="2" fill="#475569" />
    <rect x="72" y="120" width="44" height="4" rx="2" fill="#334155" />
    <rect x="72" y="138" width="40" height="9" rx="3" fill="#F59E0B" opacity=".92" />
    <rect x="120" y="138" width="22" height="9" rx="3" fill="#334155" />
    <circle cx="150" cy="148" r="18" fill="#F59E0B" />
    <path d="M150 140 V155 M143 149 L150 156 L157 149" stroke="#0F172A" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IlloChat = () => (
  <svg viewBox="0 0 220 200" className="tlc-illoSvg" role="img" aria-label="WhatsApp conversation">
    <defs>
      <linearGradient id="tlcChat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22C55E" /><stop offset="1" stopColor="#15803D" /></linearGradient>
      <radialGradient id="tlcChatGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#22C55E" stopOpacity=".42" /><stop offset="1" stopColor="#22C55E" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="110" cy="172" rx="60" ry="20" fill="url(#tlcChatGlow)" />
    <path d="M56 44 H160 Q172 44 172 56 V92 Q172 104 160 104 H96 L80 118 V104 H68 Q56 104 56 92 Z" fill="#1E293B" stroke="#334155" />
    <rect x="72" y="62" width="70" height="4" rx="2" fill="#475569" />
    <rect x="72" y="74" width="50" height="4" rx="2" fill="#334155" />
    <path d="M74 100 H160 Q172 100 172 112 V140 Q172 152 160 152 H106 L92 164 V152 H86 Q74 152 74 140 Z" fill="url(#tlcChat)" />
    <rect x="88" y="116" width="60" height="4" rx="2" fill="#fff" opacity=".9" />
    <rect x="88" y="128" width="40" height="4" rx="2" fill="#fff" opacity=".6" />
    <path d="M147 134 l4 4 l9 -10" stroke="#DCFCE7" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M154 134 l4 4 l9 -10" stroke="#BBF7D0" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="160" cy="54" r="4" fill="#F59E0B" />
  </svg>
);

const IlloAI = () => (
  <svg viewBox="0 0 220 200" className="tlc-illoSvg" role="img" aria-label="Disha AI assistant">
    <defs>
      <radialGradient id="tlcOrb" cx="38%" cy="34%" r="70%"><stop offset="0" stopColor="#A5B4FC" /><stop offset="55%" stopColor="#4F46E5" /><stop offset="1" stopColor="#312E81" /></radialGradient>
      <radialGradient id="tlcOrbGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#6366F1" stopOpacity=".55" /><stop offset="1" stopColor="#6366F1" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="110" cy="166" rx="58" ry="20" fill="url(#tlcOrbGlow)" />
    <ellipse cx="110" cy="96" rx="82" ry="30" fill="none" stroke="#3B4B66" strokeWidth="1.3" strokeDasharray="2 6" transform="rotate(-16 110 96)" />
    <ellipse cx="110" cy="96" rx="82" ry="30" fill="none" stroke="#3B4B66" strokeWidth="1.3" strokeDasharray="2 6" transform="rotate(20 110 96)" />
    <circle cx="110" cy="96" r="42" fill="url(#tlcOrb)" />
    <ellipse cx="97" cy="80" rx="15" ry="9" fill="#fff" opacity=".28" />
    <path d="M164 58 l2.6 6.2 l6.2 2.6 l-6.2 2.6 l-2.6 6.2 l-2.6 -6.2 l-6.2 -2.6 l6.2 -2.6 Z" fill="#F59E0B" />
    <path d="M56 66 l1.9 4.6 l4.6 1.9 l-4.6 1.9 l-1.9 4.6 l-1.9 -4.6 l-4.6 -1.9 l4.6 -1.9 Z" fill="#FBBF24" />
    <circle cx="162" cy="128" r="3.5" fill="#93C5FD" />
    <circle cx="62" cy="130" r="2.6" fill="#A78BFA" />
  </svg>
);

/* Exact funnel artwork (from the design), edges feathered so it melts into the card. */
const FUNNEL_IMG = "data:image/webp;base64,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";
const IlloFunnelImg = () => (
  <img src={FUNNEL_IMG} alt="Leads flowing into a pipeline" className="tlc-illoImg" />
);

/* Exact right-panel artwork (dark navy + wave + dots) — kept for the stacked mobile layout;
   on desktop the full-width curve canvas below paints the scene. */
const PANEL_BG = "data:image/webp;base64,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";

/* Feature carousel content — a real sequence, so numbering carries meaning. */
const SLIDES = [
  { n: '01', title: 'Leads & pipeline', copy: 'Capture every enquiry, assign it to an agent, and never lose a follow-up.', Illo: IlloFunnelImg },
  { n: '02', title: 'Quotations → branded PDF', copy: 'Build a multi-day itinerary and send a polished, branded quote in minutes.', Illo: IlloDoc },
  { n: '03', title: 'WhatsApp follow-ups', copy: 'Reach travellers on the channel where they actually reply.', Illo: IlloChat },
  { n: '04', title: 'Disha AI', copy: 'Drafts itineraries and replies, so your team spends its day selling.', Illo: IlloAI },
];

const SERVICES = [
  { Icon: Megaphone, label: 'Digital Marketing' },
  { Icon: Globe, label: 'Website Development' },
  { Icon: ServerCog, label: 'IT Services' },
];

/* ---------- Mini white car (orbits inside the logo — motion PRESERVED) ---------- */
const MiniCar = () => (
  <svg className="tlc-minicar" viewBox="0 0 40 20" width="21" height="10.5" aria-hidden="true">
    <path d="M3 13 L3 10 Q3 7 8 7 L13 7 L16.5 3 Q17 2.5 18.5 2.5 L26 2.5 Q27.5 2.5 28 3.5 L31 7 Q37 7 37 11 L37 13 Q37 14.5 35.5 14.5 L4.5 14.5 Q3 14.5 3 13 Z" fill="#fff" />
    <path d="M18 4 L15.5 7 L21.5 7 L21.5 4 Z" fill="#93C5FD" />
    <path d="M23.5 4 L23.5 7 L29 7 L26.8 4 Z" fill="#93C5FD" />
    <circle cx="36" cy="10" r="1" fill="#FDE68A" />
    <g className="tlc-wheel"><circle cx="10.5" cy="14.5" r="3.4" fill="#0F172A" /><circle cx="10.5" cy="14.5" r="1.3" fill="#E2E8F0" /><line x1="10.5" y1="11.6" x2="10.5" y2="14.5" stroke="#94A3B8" strokeWidth="1" /></g>
    <g className="tlc-wheel"><circle cx="29.5" cy="14.5" r="3.4" fill="#0F172A" /><circle cx="29.5" cy="14.5" r="1.3" fill="#E2E8F0" /><line x1="29.5" y1="11.6" x2="29.5" y2="14.5" stroke="#94A3B8" strokeWidth="1" /></g>
  </svg>
);

/* ---------- Animated logo (car orbit preserved, richer aura/float via Framer) ---------- */
const AnimatedLogo = () => (
  <motion.div
    className="tlc-logo mx-auto mb-6"
    initial={{ opacity: 0, scale: 0.6 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.7, ease: EASE }}
  >
    <div className="tlc-ring" />
    <MapPin size={20} className="tlc-pin" aria-hidden="true" />
    <div className="tlc-orbit"><MiniCar /></div>
  </motion.div>
);

/* ---------- Reusable glass card (bottom services) ---------- */
const GlassCard = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.4 }}
    transition={{ duration: 0.55, delay, ease: EASE }}
    whileHover={{ y: -5, scale: 1.035 }}
    className="group rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-center backdrop-blur-md
      transition-shadow hover:border-white/20 hover:bg-white/[0.07] hover:shadow-[0_18px_40px_-18px_rgba(37,99,235,0.55)]"
  >
    {children}
  </motion.div>
);

/* ---------- Feature carousel (glass card, fade + scale + image zoom) ---------- */
const FeatureCarousel = () => {
  const reduce = useReducedMotion();
  const [[slide, dir], setSlide] = useState([0, 0]);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);

  const paginate = (d) => setSlide(([s]) => [(s + d + SLIDES.length) % SLIDES.length, d]);
  const goTo = (i) => setSlide(([s]) => [i, i > s ? 1 : -1]);

  useEffect(() => {
    if (paused || reduce) return;
    const t = setTimeout(() => paginate(1), 5000);
    return () => clearTimeout(t);
  }, [slide, paused, reduce]);

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx > 40) paginate(-1);
    else if (dx < -40) paginate(1);
    touchX.current = null;
  };

  const s = SLIDES[slide];
  const variants = {
    enter: (d) => ({ opacity: 0, scale: 0.94, x: d > 0 ? 46 : -46 }),
    center: { opacity: 1, scale: 1, x: 0 },
    exit: (d) => ({ opacity: 0, scale: 0.94, x: d > 0 ? -46 : 46 }),
  };

  return (
    <div className="relative mt-8" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* glass stage */}
      <div
        className="relative overflow-hidden rounded-[32px] border border-white/10
          bg-gradient-to-br from-[#08265F]/85 via-[#05184A]/85 to-[#03102C]/94 backdrop-blur-xl
          shadow-[0_30px_80px_-40px_rgba(2,6,23,0.9)]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-roledescription="carousel"
      >
        <span className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-blue-600/15 blur-2xl" />
        <div className="relative min-h-[248px] px-6 py-6 sm:px-8">
          <AnimatePresence custom={dir} mode="wait">
            <motion.div
              key={slide}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.45, ease: EASE }}
              className="flex h-full flex-col"
            >
              <span className="mb-4 inline-flex w-fit items-center rounded-[10px] border border-blue-400/30 bg-blue-500/15 px-3 py-1.5 text-[13px] font-extrabold tracking-[0.04em] text-blue-300">
                {s.n}
              </span>
              <div className="flex flex-1 flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[20px] font-extrabold leading-tight tracking-tight text-white">{s.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-slate-400">{s.copy}</p>
                </div>
                <motion.div
                  className="tlc-illoStage mx-auto flex shrink-0 items-center justify-center sm:mx-0"
                  initial={{ scale: 1.14, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6, ease: EASE }}
                >
                  <s.Illo />
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* arrows */}
      <button
        type="button" onClick={() => paginate(-1)} aria-label="Previous slide"
        className="absolute left-[-14px] top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full
          border border-white/15 bg-slate-950/70 text-slate-200 backdrop-blur transition hover:scale-110 hover:border-blue-400 hover:text-white
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button" onClick={() => paginate(1)} aria-label="Next slide"
        className="absolute right-[-14px] top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full
          border border-white/15 bg-slate-950/70 text-slate-200 backdrop-blur transition hover:scale-110 hover:border-blue-400 hover:text-white
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <ChevronRight size={18} />
      </button>

      {/* dots */}
      <div className="mt-5 flex justify-center gap-2" role="tablist" aria-label="Choose slide">
        {SLIDES.map((sl, i) => (
          <button
            key={sl.title} type="button" onClick={() => goTo(i)} role="tab" aria-selected={i === slide}
            aria-label={`Slide ${i + 1}: ${sl.title}`}
            className={`h-2 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
              i === slide ? 'w-6 bg-gradient-to-r from-blue-500 to-indigo-500' : 'w-2 bg-white/25 hover:bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

/* ---------- Right-hand showcase (dark, decorated, mouse-parallax) ---------- */
const Showcase = () => (
  <aside className="relative flex flex-col justify-center overflow-hidden bg-[#030B22] px-6 py-14 sm:px-10 lg:bg-transparent lg:px-14 lg:pb-16 lg:pt-24 xl:px-20">
    {/* mobile keeps the flat artwork; on desktop the full-width curved canvas paints the scene */}
    <div
      className="pointer-events-none absolute inset-0 lg:hidden"
      style={{ backgroundImage: `url("${PANEL_BG}")`, backgroundSize: 'cover', backgroundPosition: 'top right', backgroundRepeat: 'no-repeat' }}
      aria-hidden="true"
    />
    {/* subtle left fade so text over the artwork stays crisp */}
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#030B22]/55 via-transparent to-transparent" />

    <div className="relative z-10 mx-auto w-full max-w-[480px] xl:max-w-[560px]">
      <motion.p
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
        className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-300/85"
      >
        Why agencies run TravelCRM
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.24, ease: EASE }}
        className="mt-3 text-[29px] font-extrabold leading-[1.2] tracking-tight text-white xl:text-[33px]"
      >
        Everything between a lead and a{' '}
        <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">boarding pass.</span>
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.34, ease: EASE }}
      >
        <FeatureCarousel />
      </motion.div>

      <div className="mt-9 flex items-center gap-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-slate-500">Also from Veto Tech</span>
        <motion.span
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, delay: 0.9, ease: EASE }}
          className="h-px flex-1 origin-left bg-white/10"
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {SERVICES.map(({ Icon, label }, i) => (
          <GlassCard key={label} delay={0.1 + i * 0.08}>
            <Icon size={17} className="mx-auto text-amber-400 transition-transform duration-300 group-hover:scale-110" aria-hidden="true" />
            <p className="mt-2 text-[11.5px] font-medium leading-tight text-slate-300">{label}</p>
          </GlassCard>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
        className="mt-8 flex items-center gap-2 text-[12.5px] text-slate-400"
      >
        <ArrowRight size={14} className="tlc-nudge shrink-0 text-amber-400" aria-hidden="true" />
        Need a website, campaign or custom build?{' '}
        <a href="mailto:vetotechit@gmail.com" className="font-semibold text-slate-200 underline-offset-2 hover:text-amber-400 hover:underline">
          Talk to us
        </a>
      </motion.p>
    </div>
  </aside>
);

/* ================================================================== *
 * MAIN — all auth state + handleSubmit are IDENTICAL to the original.
 * ================================================================== */
const Login = ({ setIsAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Validation UI states
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [pwInvalid, setPwInvalid] = useState(false);
  const [emailShake, setEmailShake] = useState(false);
  const [pwShake, setPwShake] = useState(false);
  const [bannerShake, setBannerShake] = useState(false);

  const navigate = useNavigate();

  const emailValid = EMAIL_RE.test(email);
  const pwValid = password.length >= 6;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Client-side validation with shake feedback
    let bad = false;
    if (!emailValid) {
      setEmailInvalid(true);
      setEmailShake(true);
      bad = true;
    }
    if (!password.trim()) {
      setPwInvalid(true);
      setPwShake(true);
      bad = true;
    }
    if (bad) return;

    setLoading(true);
    setErrorMessage('');

    try {
      // 1. API call (unchanged)
      const response = await authService.login(email, password);

      // 2. Extract token (unchanged)
      const responseData = response.data;
      const token = responseData?.token || responseData?.jwt || responseData;

      if (token && typeof token === 'string') {
        // 3. Persist session (unchanged)
        localStorage.setItem('token', token);
        // LoginService always stamps a role (real tenant role, or "super_admin"), so this
        // fallback is defensive only — default to the least-privileged value.
        const roleToSave = responseData?.role || 'user';
        localStorage.setItem('userRole', roleToSave);
        localStorage.setItem('userEmail', email);

        // Effective permissions + plan module entitlements (both cached for the UI to gate/hide).
        await Promise.all([loadMyPermissions(), loadMyEntitlements()]);

        // 4. Success beat (animated checkmark), then redirect
        setLoading(false);
        setSuccess(true);
        setTimeout(() => {
          setIsAuthenticated(true);
          navigate('/');
        }, 900);
        return;
      } else {
        setErrorMessage("Login failed. No security token received from the server.");
        setBannerShake(true);
      }
    } catch (error) {
      console.error("Login Error:", error);
      if (error.response) {
        if (error.response.status === 401 || error.response.status === 403) {
          setErrorMessage("Invalid email or password! Please check your credentials.");
        } else {
          setErrorMessage(error.response.data?.message || "Server Error. Please try again later.");
        }
      } else if (error.request) {
        setErrorMessage("Cannot connect to the server. Ensure the backend is running.");
      } else {
        setErrorMessage("Something went wrong during login.");
      }
      setBannerShake(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="relative min-h-screen w-full bg-[#030B22] selection:bg-blue-600 selection:text-white lg:grid lg:grid-cols-[2fr_3fr]"
        style={{ fontFamily: "'Plus Jakarta Sans','Inter',system-ui,sans-serif" }}
      >
        <style>{styles}</style>

        {/* Full-bleed dark canvas glows behind both halves (desktop only) */}
        <div className="tlc-canvas" aria-hidden="true" />

        {/* ── Sign-in half (LEFT, 40%) ─────────────────────────────── */}
        <div className="relative z-10 flex min-h-screen items-center justify-center bg-white px-6 py-12 sm:px-10 lg:bg-transparent">
          {/* soft radial blue glow behind the logo */}
          <div className="pointer-events-none absolute left-1/2 top-[16%] h-80 w-80 -translate-x-1/2 rounded-full bg-blue-500/15 blur-[90px]" />

          <div className="relative w-full max-w-[400px]">
            <AnimatedLogo />

            <motion.h1
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
              className="text-center text-[25px] font-extrabold tracking-tight text-slate-900 sm:text-[28px]"
            >
              Travel CRM
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              className="mb-2 mt-2 text-center text-[13.5px] text-slate-500"
            >
              Sign in to manage your CRM account
            </motion.p>

            {/* Backend error banner */}
            {errorMessage && (
              <div
                className={`mt-5 flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-center text-[13px] font-medium text-red-600 ${bannerShake ? 'tlc-shakeb' : ''}`}
                onAnimationEnd={() => setBannerShake(false)}
                role="alert"
                aria-live="assertive"
              >
                <AlertCircle size={15} className="shrink-0" />
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-5">
              {/* Email — floating label + live validation */}
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.34, ease: EASE }}
                className={`tlc-field mb-4 ${emailValid ? 'valid' : ''} ${emailInvalid ? 'invalid' : ''} ${emailShake ? 'shake' : ''}`}
                onAnimationEnd={() => setEmailShake(false)}
              >
                <div className="tlc-control">
                  <Mail size={19} className="tlc-ico" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    autoComplete="email"
                    spellCheck="false"
                    placeholder=" "
                    aria-invalid={emailInvalid}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEmail(v);
                      setEmailInvalid(v.length > 0 && !EMAIL_RE.test(v));
                    }}
                    className="tlc-input"
                  />
                  <label htmlFor="login-email">Email address</label>
                  <Check size={19} className="tlc-vcheck" aria-hidden="true" />
                </div>
                <div className="tlc-err"><AlertCircle size={13} /> Enter a valid email address</div>
              </motion.div>

              {/* Password — floating label + visibility toggle */}
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.42, ease: EASE }}
                className={`tlc-field mb-5 ${pwValid ? 'valid' : ''} ${pwInvalid ? 'invalid' : ''} ${pwShake ? 'shake' : ''}`}
                onAnimationEnd={() => setPwShake(false)}
              >
                <div className="tlc-control">
                  <Lock size={19} className="tlc-ico" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    autoComplete="current-password"
                    placeholder=" "
                    aria-invalid={pwInvalid}
                    onChange={(e) => { setPassword(e.target.value); setPwInvalid(false); }}
                    className="tlc-input pr-12"
                  />
                  <label htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="tlc-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
                <div className="tlc-err"><AlertCircle size={13} /> Password is required</div>
              </motion.div>

              {/* Submit — gradient blue→indigo→purple, lift + glow + tap */}
              <motion.button
                type="submit"
                disabled={loading || success}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.5, ease: EASE }}
                whileHover={!(loading || success) ? { y: -2, scale: 1.01 } : undefined}
                whileTap={!(loading || success) ? { scale: 0.98 } : undefined}
                className={`tlc-btn w-full ${success ? 'success' : ''}`}
              >
                {loading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-white/40 border-t-white" />
                    Signing in…
                  </>
                ) : success ? (
                  <>
                    <Check size={20} className="tlc-pop" />
                    Success
                  </>
                ) : (
                  'Log In'
                )}
              </motion.button>
            </form>

            {/* Quiet bridge to the platform realm */}
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.6, ease: EASE }}
              className="mt-8 text-center text-[12.5px] text-slate-400"
            >
              <ShieldCheck size={13} className="-mt-0.5 mr-1 inline-block" aria-hidden="true" />
              Platform operator?{' '}
              <Link to="/superadmin/login" className="rounded font-semibold text-slate-500 underline-offset-2 hover:text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                Sign in to the console
              </Link>
            </motion.p>
          </div>
        </div>

        {/* ── Showcase half (RIGHT, 60%) ───────────────────────────── */}
        <Showcase />

        {/* Curved organic canvas (desktop only) — navy wave across the whole top, one big
            smooth white sweep, and a gradient ribbon hugging its shoulder. */}
        <svg className="tlc-seam" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="tlcSeamWave" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#101A40" />
              <stop offset="0.32" stopColor="#1C2657" />
              <stop offset="0.62" stopColor="#2B356F" />
              <stop offset="1" stopColor="#131E48" />
            </linearGradient>
            <linearGradient id="tlcSeamEdge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#60A5FA" />
              <stop offset="0.4" stopColor="#6366F1" />
              <stop offset="1" stopColor="#8B5CF6" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="tlcSeamRibbon" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#C4CCFB" />
              <stop offset="0.18" stopColor="#8E9CF6" />
              <stop offset="0.45" stopColor="#5E68EC" />
              <stop offset="0.75" stopColor="#4747DF" />
              <stop offset="1" stopColor="#4038C8" />
            </linearGradient>
          </defs>
          {/* navy wave sweeping the whole top */}
          <path d="M233 0 C280 48 312 90 350 96 C425 107 480 55 545 40 C625 24 700 26 770 38 C850 52 930 58 1000 52 L1000 0 Z" fill="url(#tlcSeamWave)" />
          {/* white sweep — one big smooth bulge */}
          <path d="M0 0 L239 0 C245 55 280 100 341 117 C382 128 392 330 392 480 C392 610 380 700 362 776 C344 852 320 926 299 1000 L0 1000 Z" fill="#ffffff" />
          {/* gradient rim light hugging the sweep, like the reference */}
          <path d="M239 0 C245 55 280 100 341 117 C382 128 392 330 392 480 C392 610 380 700 362 776 C344 852 320 926 299 1000" fill="none" stroke="url(#tlcSeamEdge)" strokeWidth="9" strokeOpacity="0.16" vectorEffect="non-scaling-stroke" />
          <path d="M239 0 C245 55 280 100 341 117 C382 128 392 330 392 480 C392 610 380 700 362 776 C344 852 320 926 299 1000" fill="none" stroke="url(#tlcSeamEdge)" strokeWidth="2.4" strokeOpacity="0.75" vectorEffect="non-scaling-stroke" />
          {/* gradient ribbon riding the white shoulder */}
          <path d="M256 51 C282 78 312 98 346 103 C420 115 470 60 545 44 C606 29 668 28 726 37 C793 47 850 56 1000 62 L1000 96 C860 92 800 80 726 68 C664 60 620 58 560 78 C500 98 452 146 372 150 C324 152 288 116 256 51 Z" fill="url(#tlcSeamRibbon)" />
          {/* sparkles on the dark side */}
          <circle cx="545" cy="130" r="1.8" fill="#F59E0B" opacity=".85" />
          <circle cx="742" cy="118" r="2.2" fill="#93C5FD" opacity=".8" />
          <circle cx="920" cy="140" r="1.7" fill="#A78BFA" opacity=".75" />
        </svg>
      </div>
    </MotionConfig>
  );
};

/* ------------------------- Component styles ------------------------- *
 * Only what Tailwind/Framer can't express cleanly lives here:
 *  • the logo + orbiting car (motion PRESERVED, byte-for-byte)
 *  • the floating-label input system (needs :placeholder-shown states)
 *  • the dark-panel grid + curved canvas positioning
 * ------------------------------------------------------------------- */
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

/* ---- Animated logo + orbiting car (unchanged motion) ---- */
.tlc-logo{width:84px;height:84px;border-radius:50%;background:linear-gradient(135deg,#2563EB,#4F46E5);position:relative;box-shadow:0 14px 30px -6px rgba(37,99,235,.55);animation:tlcFloat 4.5s ease-in-out infinite}
.tlc-logo::after{content:'';position:absolute;inset:-10px;border-radius:50%;background:linear-gradient(135deg,#2563EB,#6366F1);filter:blur(18px);opacity:.4;z-index:-1;animation:tlcGlowP 3.2s ease-in-out infinite}
@keyframes tlcGlowP{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.55;transform:scale(1.12)}}
@keyframes tlcFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.tlc-ring{position:absolute;inset:12px;border:2px dashed rgba(255,255,255,.42);border-radius:50%}
.tlc-pin{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff}
.tlc-orbit{position:absolute;inset:0;animation:tlcOrbit 3.4s linear infinite}
@keyframes tlcOrbit{to{transform:rotate(360deg)}}
.tlc-minicar{position:absolute;top:3px;left:50%;transform:translateX(-50%);display:block}
.tlc-minicar .tlc-wheel{animation:tlcWheel .35s linear infinite}
.tlc-wheel{transform-box:fill-box;transform-origin:center}
@keyframes tlcWheel{to{transform:rotate(360deg)}}

/* ---- Contact arrow nudge ---- */
.tlc-nudge{animation:tlcNudge 1.9s ease-in-out infinite}
@keyframes tlcNudge{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}

/* ---- Floating-label inputs (rounded-2xl, soft shadow, focus glow, success check) ---- */
.tlc-control{position:relative;height:54px}
.tlc-ico{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:#94A3B8;pointer-events:none;transition:color .25s}
.tlc-input{width:100%;height:54px;border-radius:16px;border:1.6px solid #E5E9F1;background:#fff;padding:0 46px;font-size:15px;color:#0F172A;outline:none;box-shadow:0 1px 2px rgba(15,23,42,.05);transition:border-color .25s,box-shadow .25s;font-family:inherit}
.tlc-input:focus{border-color:#2563EB;box-shadow:0 0 0 4px rgba(37,99,235,.14),0 10px 24px -12px rgba(37,99,235,.45)}
.tlc-field label{position:absolute;left:44px;top:50%;transform:translateY(-50%);color:#94A3B8;font-size:15px;pointer-events:none;padding:0 5px;transition:all .2s ease;white-space:nowrap}
.tlc-input:focus + label,.tlc-input:not(:placeholder-shown) + label{top:0;left:40px;transform:translateY(-50%) scale(.8);color:#2563EB;background:#fff;border-radius:4px}
.tlc-field.valid .tlc-input{border-color:#22C55E}
.tlc-field.valid .tlc-ico{color:#22C55E}
.tlc-vcheck{position:absolute;right:16px;top:50%;transform:translateY(-50%) scale(0);color:#22C55E;transition:transform .3s cubic-bezier(.68,-.55,.27,1.55)}
.tlc-field.valid .tlc-vcheck{transform:translateY(-50%) scale(1)}
.tlc-field.invalid .tlc-input{border-color:#EF4444;box-shadow:0 0 0 4px rgba(239,68,68,.13)}
.tlc-field.invalid .tlc-ico{color:#EF4444}
.tlc-field.invalid .tlc-vcheck{transform:translateY(-50%) scale(0)}
.tlc-err{color:#EF4444;font-size:12px;margin:6px 4px 0;display:flex;align-items:center;gap:5px;opacity:0;max-height:0;overflow:hidden;transition:opacity .2s}
.tlc-field.invalid .tlc-err{opacity:1;max-height:24px}
.tlc-field.shake .tlc-control{animation:tlcShake .45s}
.tlc-shakeb{animation:tlcShake .45s}
@keyframes tlcShake{0%,100%{transform:translateX(0)}18%,58%{transform:translateX(-6px)}38%,78%{transform:translateX(6px)}}
.tlc-toggle{position:absolute;right:10px;top:50%;transform:translateY(-50%);border:none;background:transparent;color:#94A3B8;cursor:pointer;padding:8px;border-radius:9px;display:flex;transition:color .2s,background .2s;font-family:inherit}
.tlc-toggle:hover{color:#475569;background:rgba(15,23,42,.05)}
.tlc-toggle:focus-visible{outline:2px solid #2563EB;outline-offset:1px}

/* ---- Gradient login button (blue → indigo → purple) ---- */
.tlc-btn{position:relative;overflow:hidden;height:54px;border:none;border-radius:16px;background:linear-gradient(120deg,#2563EB,#4F46E5 55%,#7C3AED);color:#fff;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 12px 26px -8px rgba(79,70,229,.55);transition:box-shadow .25s,filter .2s;font-family:inherit}
.tlc-btn::after{content:'';position:absolute;top:0;bottom:0;left:-60%;width:45%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.3),transparent);transform:skewX(-20deg);opacity:0}
.tlc-btn:hover:not(:disabled)::after{animation:tlcSheen .85s ease-out}
@keyframes tlcSheen{0%{left:-60%;opacity:1}100%{left:120%;opacity:0}}
.tlc-btn:hover:not(:disabled){box-shadow:0 18px 34px -8px rgba(79,70,229,.65);filter:brightness(1.06)}
.tlc-btn:focus-visible{outline:2px solid #4F46E5;outline-offset:3px}
.tlc-btn:disabled{cursor:not-allowed}
.tlc-btn.success{background:linear-gradient(120deg,#16A34A,#15803D);box-shadow:0 12px 26px -8px rgba(22,163,74,.5)}
.tlc-pop{animation:tlcPop .45s cubic-bezier(.68,-.55,.27,1.55)}
@keyframes tlcPop{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}

/* ---- Illustration sizing — one fixed stage so EVERY slide's art is the same size ---- */
.tlc-illoStage{width:220px;height:192px}
.tlc-illoSvg{width:100%;height:100%;display:block;filter:drop-shadow(0 14px 26px rgba(0,0,0,.5))}
.tlc-illoImg{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 18px 34px rgba(0,0,0,.5))}
@media (max-width:640px){ .tlc-illoStage{width:186px;height:162px} }

/* ---- Dark-panel grid ---- */
.tlc-grid{background-image:linear-gradient(rgba(148,163,184,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.02) 1px,transparent 1px);background-size:46px 46px;-webkit-mask-image:radial-gradient(120% 95% at 80% 15%,#000,transparent 68%);mask-image:radial-gradient(120% 95% at 80% 15%,#000,transparent 68%)}

/* ---- Curved canvas (desktop only; full-width wave + white sweep + ribbon) ---- */
.tlc-canvas{display:none}
.tlc-seam{display:none}
@media (min-width:1024px){
  .tlc-canvas{display:block;position:absolute;inset:0;pointer-events:none;background:radial-gradient(52% 46% at 74% 26%,rgba(37,99,235,.13),transparent 70%),radial-gradient(40% 38% at 92% 80%,rgba(79,70,229,.11),transparent 72%),radial-gradient(46% 40% at 56% 90%,rgba(30,58,138,.16),transparent 75%)}
  .tlc-seam{display:block;position:absolute;inset:0;width:100%;height:100%;z-index:5;pointer-events:none;filter:drop-shadow(10px 0 28px rgba(2,8,35,.55)) drop-shadow(0 4px 14px rgba(2,8,35,.3))}
}

@media (prefers-reduced-motion:reduce){
  .tlc-logo,.tlc-logo::after,.tlc-orbit,.tlc-minicar .tlc-wheel,.tlc-nudge,.tlc-pop,.tlc-btn:hover:not(:disabled)::after{animation:none!important}
}
`;

export default Login;