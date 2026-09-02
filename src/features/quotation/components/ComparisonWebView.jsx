/* ════════════════════════════════════════════════════════════════════════════════════════════════
   COMPARISON WEB VIEW — the customer-facing page for a multi-option quotation.

   Rendered by QuotationWebView when the public DTO carries templateStyle === "COMPARISON".

   • Receives the already-fetched PUBLIC DTO as `data` (never fetches, never sees markup).
   • Self-contained: own <style> block, no UI kits — same posture as ModernWebView.

   ── The layout rule, and it is the whole design ────────────────────────────────────────────────
   Anything the options SHARE is shown ONCE. Only what differs goes in the comparison. The server
   already answered which is which: `comparisonSections` lists the sections that vary, computed in
   QuotationMapper.comparisonSectionKeys. A section absent from it is identical in every option, so
   repeating it per column would be three copies of one paragraph.

   ── Degrades rather than fails ─────────────────────────────────────────────────────────────────
   The server never publishes `options` unless there are two or more, but this guards anyway: with
   fewer than two it renders the single package from the top-level sections, which carry the
   RECOMMENDED option. That is also what every OTHER design's web view shows for this quotation, so
   the three of them cannot disagree.
   ════════════════════════════════════════════════════════════════════════════════════════════════ */

const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

const inr = (v) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return String(d); }
};

/* Tolerant image chain, copied from the other views deliberately: the field has been called four
   different things across the builders and a customer-facing page is the wrong place to find out. */
const hotelImg = (h) => h?.imagePath || h?.imageUrl || h?.image || h?.photo || h?.coverImage || null;

const cloudinaryThumb = (url, w = 640, h = 400) =>
  (url && url.includes("/upload/")
    ? url.replace("/upload/", `/upload/c_fill,w_${w},h_${h},g_auto,f_auto,q_auto/`)
    : url);

const travellers = (c) => {
  if (!c) return "—";
  const bits = [];
  if (c.adults > 0) bits.push(`${c.adults} Adult${c.adults === 1 ? "" : "s"}`);
  if (c.children > 0) bits.push(`${c.children} Child${c.children === 1 ? "" : "ren"}`);
  if (c.infants > 0) bits.push(`${c.infants} Infant${c.infants === 1 ? "" : "s"}`);
  return bits.length ? bits.join(", ") : "—";
};

const STYLE = `
.cw{font-family:${FONT};color:#16233a;background:#f6f8fb;min-height:100vh;margin:0}
.cw *{box-sizing:border-box}
.cw-wrap{max-width:1180px;margin:0 auto;padding:0 20px 72px}

.cw-hero{background:linear-gradient(135deg,#12395f 0%,#1d4f80 100%);color:#fff;padding:44px 0 88px}
.cw-hero-in{max-width:1180px;margin:0 auto;padding:0 20px}
.cw-brand{font-size:12px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:#a9c6e2}
.cw-title{font-size:34px;font-weight:800;line-height:1.15;margin:12px 0 6px}
.cw-dest{font-size:16px;color:#cfe0ef}
.cw-meta{display:flex;flex-wrap:wrap;gap:26px;margin-top:26px}
.cw-meta-l{font-size:10.5px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:#8fb2d2}
.cw-meta-v{font-size:15px;font-weight:700;margin-top:3px}

.cw-lead{margin:-56px 0 0;background:#fff;border-radius:16px;padding:22px 24px;
  box-shadow:0 12px 34px rgba(16,42,74,.13)}
.cw-lead h2{font-size:19px;font-weight:800;margin:0 0 4px}
.cw-lead p{margin:0;font-size:13.5px;color:#5b6b82;line-height:1.6}

.cw-sec{margin-top:38px}
.cw-kicker{font-size:10.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#7c8aa0}
.cw-h{font-size:23px;font-weight:800;margin:5px 0 16px}

/* The comparison. Grid on desktop, one column on a phone — a table would force a sideways scroll
   on the device most customers open the link on. */
.cw-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.cw-card{background:#fff;border:1px solid #dfe6ee;border-radius:16px;overflow:hidden;display:flex;
  flex-direction:column;transition:box-shadow .18s ease,transform .18s ease}
.cw-card:hover{box-shadow:0 10px 26px rgba(16,42,74,.11);transform:translateY(-2px)}
.cw-card.pick{border-color:#e0b34f;box-shadow:0 8px 24px rgba(224,179,79,.22)}
.cw-card-top{padding:16px 18px 14px;border-bottom:1px solid #eef2f7}
.cw-card.pick .cw-card-top{background:#fdf7e8}
.cw-flag{display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;
  color:#8a6410;background:#f5d98b;border-radius:999px;padding:3px 9px;margin-bottom:8px}
.cw-label{font-size:20px;font-weight:800;line-height:1.2}
.cw-sub{font-size:12.5px;color:#6b7b91;margin-top:3px}
.cw-body{padding:14px 18px;flex:1}
.cw-row{padding:11px 0;border-bottom:1px dashed #e7edf4}
.cw-row:last-child{border-bottom:0}
.cw-row-l{font-size:9.5px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#93a1b4}
.cw-hotel{display:flex;gap:10px;align-items:flex-start;margin-top:7px}
.cw-thumb{width:74px;height:52px;border-radius:8px;object-fit:cover;flex:0 0 auto;background:#eef2f7}
.cw-name{font-size:14px;font-weight:700;line-height:1.3}
.cw-fine{font-size:11.5px;color:#6b7b91;margin-top:2px;line-height:1.45}
.cw-none{font-size:12.5px;color:#9aa7b8;font-style:italic;margin-top:6px}
.cw-foot{padding:15px 18px;background:#f7fafc;border-top:1px solid #eef2f7}
.cw-card.pick .cw-foot{background:#fdf7e8}
.cw-price{font-size:26px;font-weight:800;letter-spacing:-.5px}
.cw-per{font-size:11.5px;color:#6b7b91;margin-top:2px}

.cw-panel{background:#fff;border:1px solid #e3e9f0;border-radius:14px;padding:20px 22px}
.cw-day{padding:14px 0;border-bottom:1px solid #eef2f7}
.cw-day:last-child{border-bottom:0}
.cw-daynum{font-size:10px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#12395f}
.cw-daytitle{font-size:15.5px;font-weight:700;margin-top:3px}
.cw-two{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.cw-list{margin:8px 0 0;padding-left:18px}
.cw-list li{font-size:13px;color:#44546b;margin-bottom:6px;line-height:1.5}
.cw-sub-h{font-size:13.5px;font-weight:800;margin-bottom:2px}

.cw-cta{display:inline-flex;align-items:center;gap:8px;margin-top:22px;background:#12395f;color:#fff;
  border-radius:11px;padding:12px 20px;font-size:14px;font-weight:800;text-decoration:none}
.cw-cta:hover{background:#0d2b48}
.cw-note{font-size:12px;color:#8593a6;margin-top:14px;line-height:1.6}

@media print{
  .cw-hero{background:#12395f !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .cw-cta{display:none}
  .cw-card{break-inside:avoid}
}
`;

/* One column. Only the sections in `comparisonSections` are drawn — the rest are identical across
   options and live in the shared body below the grid. */
function OptionCard({ option, varies }) {
  const pick = option.recommended === true;
  const t = option.totals || {};

  const hotels = option.hotel?.hotels || [];
  const vehicles = option.vehicle?.vehicles || [];
  const flights = option.flight?.segments || [];
  const cruises = option.cruise?.cruises || [];
  const addons = (option.addons?.items || []).filter((a) => a.included !== false);
  const days = option.sightseeing?.days || [];

  const off = (section) => option[section] && option[section].included === false;

  return (
    <article className={`cw-card${pick ? " pick" : ""}`}>
      <header className="cw-card-top">
        {pick && <span className="cw-flag">Our recommendation</span>}
        <div className="cw-label">{option.label || "Option"}</div>
        {option.subtitle ? <div className="cw-sub">{option.subtitle}</div> : null}
      </header>

      <div className="cw-body">
        {varies.includes("hotel") && (
          <div className="cw-row">
            <div className="cw-row-l">Where you stay</div>
            {off("hotel") ? <div className="cw-none">Not included</div>
              : hotels.length === 0 ? <div className="cw-none">To be confirmed</div>
              : hotels.map((h, i) => {
                  const img = cloudinaryThumb(hotelImg(h), 300, 210);
                  return (
                    <div className="cw-hotel" key={`${h.name}-${i}`}>
                      {img ? <img className="cw-thumb" src={img} alt="" loading="lazy" /> : null}
                      <div>
                        <div className="cw-name">{h.name || "Hotel"}</div>
                        <div className="cw-fine">
                          {[h.city, h.stars > 0 ? `${h.stars}-star` : null].filter(Boolean).join(" · ")}
                        </div>
                        <div className="cw-fine">
                          {[h.roomType || "Room to be confirmed", h.mealPlan,
                            h.rooms ? `${h.rooms} room${h.rooms === 1 ? "" : "s"}` : null]
                            .filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        )}

        {varies.includes("vehicle") && (
          <div className="cw-row">
            <div className="cw-row-l">Getting around</div>
            {off("vehicle") ? <div className="cw-none">Not included</div>
              : vehicles.length === 0 ? <div className="cw-none">To be confirmed</div>
              : vehicles.map((v, i) => (
                  <div key={`${v.model || v.type}-${i}`} style={{ marginTop: 7 }}>
                    <div className="cw-name">{v.model || v.type || "Vehicle"}</div>
                    <div className="cw-fine">
                      {[v.model && v.type ? v.type : null,
                        v.qty ? `Qty ${v.qty}` : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                ))}
          </div>
        )}

        {varies.includes("flight") && (
          <div className="cw-row">
            <div className="cw-row-l">Flights</div>
            {off("flight") ? <div className="cw-none">Not included</div>
              : flights.length === 0 ? <div className="cw-none">To be confirmed</div>
              : flights.map((s, i) => (
                  <div key={`${s.from}-${s.to}-${i}`} style={{ marginTop: 7 }}>
                    <div className="cw-name">{s.from || "—"} → {s.to || "—"}</div>
                    <div className="cw-fine">{[s.airline, s.depDate].filter(Boolean).join(" · ")}</div>
                  </div>
                ))}
          </div>
        )}

        {varies.includes("sightseeing") && (
          <div className="cw-row">
            <div className="cw-row-l">Sightseeing</div>
            {off("sightseeing") ? <div className="cw-none">Not included</div>
              : <div className="cw-fine" style={{ marginTop: 6 }}>
                  {days.length} day{days.length === 1 ? "" : "s"} planned
                </div>}
          </div>
        )}

        {varies.includes("cruise") && (
          <div className="cw-row">
            <div className="cw-row-l">Cruise</div>
            {off("cruise") ? <div className="cw-none">Not included</div>
              : cruises.length === 0 ? <div className="cw-none">To be confirmed</div>
              : cruises.map((c, i) => (
                  <div key={`${c.name}-${i}`} style={{ marginTop: 7 }}>
                    <div className="cw-name">{c.name || "Cruise"}</div>
                    <div className="cw-fine">
                      {[c.cabin, c.nights ? `${c.nights} nights` : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                ))}
          </div>
        )}

        {varies.includes("addons") && (
          <div className="cw-row">
            <div className="cw-row-l">Add-ons</div>
            {off("addons") || addons.length === 0 ? <div className="cw-none">Not included</div>
              : addons.map((a, i) => (
                  <div className="cw-fine" key={`${a.serviceType}-${i}`} style={{ marginTop: 5 }}>
                    {a.serviceType}{a.quantity > 1 ? ` × ${a.quantity}` : ""}
                  </div>
                ))}
          </div>
        )}
      </div>

      <footer className="cw-foot">
        <div className="cw-price">
          {t.grandTotal > 0 ? inr(t.grandTotal) : "On request"}
        </div>
        {t.perAdult != null && <div className="cw-per">{inr(t.perAdult)} per adult</div>}
      </footer>
    </article>
  );
}

export default function ComparisonWebView({ data, pdfUrl }) {
  const q = data || {};
  const c = q.customer || {};
  const options = Array.isArray(q.options) ? q.options : [];
  /* The server sends this already computed. Falling back to "hotel" alone rather than to every
     section keeps a malformed payload from printing the whole trip N times. */
  const varies = Array.isArray(q.comparisonSections) && q.comparisonSections.length
    ? q.comparisonSections
    : ["hotel"];

  // Shared sections come from the TOP LEVEL, which carries the recommended option — so a section
  // that does not vary reads identically here and inside every card.
  const days = q.sightseeing?.days || [];
  const showDays = days.length > 0 && !varies.includes("sightseeing");
  const inclusions = q.inclusions || [];
  const exclusions = q.exclusions || [];
  const payment = q.paymentPolicies || [];
  const cancellation = q.cancellationPolicies || [];
  const terms = q.bookingTerms || [];

  return (
    <div className="cw">
      <style>{STYLE}</style>

      <header className="cw-hero">
        <div className="cw-hero-in">
          <div className="cw-brand">{q.companyName || "Your travel proposal"}</div>
          <h1 className="cw-title">{q.title || "Your Journey"}</h1>
          {c.destination ? <div className="cw-dest">{c.destination}</div> : null}

          <div className="cw-meta">
            {c.name ? (
              <div><div className="cw-meta-l">Prepared for</div><div className="cw-meta-v">{c.name}</div></div>
            ) : null}
            {c.travelDate ? (
              <div><div className="cw-meta-l">Travel date</div><div className="cw-meta-v">{fmtDate(c.travelDate)}</div></div>
            ) : null}
            <div><div className="cw-meta-l">Travellers</div><div className="cw-meta-v">{travellers(c)}</div></div>
            {q.nights != null ? (
              <div>
                <div className="cw-meta-l">Duration</div>
                <div className="cw-meta-v">
                  {q.nights} Nights{q.days != null ? ` / ${q.days} Days` : ""}
                </div>
              </div>
            ) : null}
            {q.quoteNo != null ? (
              <div>
                <div className="cw-meta-l">Quote</div>
                <div className="cw-meta-v">#{q.quoteNo}{q.version ? ` ${q.version}` : ""}</div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="cw-wrap">
        <section className="cw-lead">
          <h2>
            {options.length >= 2
              ? `${options.length} ways to do this trip`
              : "Your package"}
          </h2>
          <p>
            {options.length >= 2
              ? "The itinerary, the sightseeing and the terms are the same in every option — they are set out in full below. Only what changes between them is shown side by side."
              : "Everything included in your trip is set out below."}
          </p>
        </section>

        {options.length >= 2 && (
          <section className="cw-sec">
            <div className="cw-kicker">Compare</div>
            <h3 className="cw-h">Choose the one that suits you</h3>
            <div className="cw-grid">
              {options.map((option) => (
                <OptionCard key={option.publicId || option.label} option={option} varies={varies} />
              ))}
            </div>
          </section>
        )}

        {/* Single-package fallback: fewer than two options means there is nothing to compare, so the
            top-level sections — which carry the recommended option — are shown on their own. */}
        {options.length < 2 && (q.hotel?.hotels?.length > 0 || q.vehicle?.vehicles?.length > 0) && (
          <section className="cw-sec">
            <div className="cw-kicker">Your package</div>
            <h3 className="cw-h">What is included</h3>
            <div className="cw-panel">
              {(q.hotel?.hotels || []).map((h, i) => (
                <div className="cw-day" key={`h-${i}`}>
                  <div className="cw-daytitle">{h.name || "Hotel"}</div>
                  <div className="cw-fine">
                    {[h.city, h.stars > 0 ? `${h.stars}-star` : null, h.roomType, h.mealPlan]
                      .filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))}
              {(q.vehicle?.vehicles || []).map((v, i) => (
                <div className="cw-day" key={`v-${i}`}>
                  <div className="cw-daytitle">{v.model || v.type || "Vehicle"}</div>
                  <div className="cw-fine">{[v.pickup, v.drop].filter(Boolean).join(" → ")}</div>
                </div>
              ))}
              {q.totals?.grandTotal > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="cw-price">{inr(q.totals.grandTotal)}</div>
                  {q.totals.perAdult != null && (
                    <div className="cw-per">{inr(q.totals.perAdult)} per adult</div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {showDays && (
          <section className="cw-sec">
            <div className="cw-kicker">Same in every option</div>
            <h3 className="cw-h">Your day-by-day plan</h3>
            <div className="cw-panel">
              {days.map((d, i) => (
                <div className="cw-day" key={`d-${d.day ?? i}`}>
                  <div className="cw-daynum">
                    Day {d.day ?? i + 1}{d.date ? ` · ${d.date}` : ""}
                  </div>
                  {(d.activities || []).map((a, j) => (
                    <div key={`a-${j}`}>
                      <div className="cw-daytitle">{a.attraction || "Sightseeing"}</div>
                      {a.description ? <div className="cw-fine">{a.description}</div> : null}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {(inclusions.length > 0 || exclusions.length > 0) && (
          <section className="cw-sec">
            <div className="cw-kicker">Same in every option</div>
            <h3 className="cw-h">Inclusions &amp; exclusions</h3>
            <div className="cw-two">
              {inclusions.length > 0 && (
                <div className="cw-panel">
                  <div className="cw-sub-h">What is included</div>
                  <ul className="cw-list">
                    {inclusions.map((x, i) => <li key={`i-${i}`}>{x}</li>)}
                  </ul>
                </div>
              )}
              {exclusions.length > 0 && (
                <div className="cw-panel">
                  <div className="cw-sub-h">What is not included</div>
                  <ul className="cw-list">
                    {exclusions.map((x, i) => <li key={`e-${i}`}>{x}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {(payment.length > 0 || cancellation.length > 0 || terms.length > 0) && (
          <section className="cw-sec">
            <div className="cw-kicker">Before you book</div>
            <h3 className="cw-h">Payment, cancellation &amp; terms</h3>
            <div className="cw-panel">
              {payment.length > 0 && (
                <>
                  <div className="cw-sub-h">Payment</div>
                  <ul className="cw-list">{payment.map((x, i) => <li key={`p-${i}`}>{x}</li>)}</ul>
                </>
              )}
              {cancellation.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="cw-sub-h">Cancellation</div>
                  <ul className="cw-list">{cancellation.map((x, i) => <li key={`c-${i}`}>{x}</li>)}</ul>
                </div>
              )}
              {terms.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="cw-sub-h">Booking terms</div>
                  <ul className="cw-list">{terms.map((x, i) => <li key={`t-${i}`}>{x}</li>)}</ul>
                </div>
              )}
            </div>
          </section>
        )}

        {pdfUrl ? (
          <a className="cw-cta" href={pdfUrl} target="_blank" rel="noopener noreferrer">
            Download this proposal (PDF)
          </a>
        ) : null}

        <p className="cw-note">
          Prices are inclusive of the taxes shown against each option and exclude anything listed
          under exclusions. Rates and availability are confirmed at the time of booking.
        </p>
      </div>
    </div>
  );
}
