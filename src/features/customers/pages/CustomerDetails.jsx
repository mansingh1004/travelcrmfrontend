import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  CircleUserRound, FileCheck2, History,
  IndianRupee, Megaphone, MessageSquarePlus, Plane,
} from "lucide-react";

import { useToast } from "@shared/ui/toast";
import Tabs from "@shared/ui/Tabs";
import { getErrorMessage } from "@shared/api/apiError";
import { hasPermission, P } from "@shared/lib/access";

import customerService from "../api/customerService";
import { FONT } from "../components/profile/profileUi";
import { CommandBar, IdentityFacts } from "../components/profile/CommandBand";
import { MoneyBand } from "../components/profile/MoneyBand";
import { AlertRail } from "../components/profile/AlertRail";
import ProfileActions from "../components/profile/ProfileActions";
import CustomerUnavailable from "../components/profile/CustomerUnavailable";
import { LoadingBlock, LoadingPage } from "../components/profile/profileSkeletons";
import { useCustomerProfile } from "../components/profile/useCustomerProfile";
import { useCustomerMutations } from "../components/profile/useCustomerMutations";
import OverviewTab from "../components/profile/OverviewTab";
import BookingsTab from "../components/profile/BookingsTab";
import EnquiriesTab from "../components/profile/EnquiriesTab";
import TimelineTab from "../components/profile/TimelineTab";
import MoneyTab from "../components/profile/MoneyTab";
import DocumentsTab from "../components/profile/DocumentsTab";
import MarketingTab from "../components/profile/MarketingTab";

const unwrap = (response) => response?.data?.data ?? response?.data;

/**
 * Customer 360.
 *
 * ── Load strategy ────────────────────────────────────────────────────────────────────────────
 *   • `getSummary` is the spine and the only call that gates first paint. It supplies the command
 *     band, the money band, the alert rail and every tab's count badge — so a badge is right
 *     before its tab has ever been opened.
 *   • `getById` fires alongside it, because Overview is the landing tab and needs the full record
 *     (address, identity, notes) the summary deliberately does not carry. A landing therefore
 *     costs TWO requests, not one; an earlier comment here claimed one, and it was wrong.
 *   • Every other tab loads on its FIRST open and is then cached (see useCustomerProfile).
 *     Switching tabs afterwards is free. Do not "helpfully" prefetch — that undoes the whole point.
 *   • The active tab lives in the URL (?tab=), and the open enquiry in ?lead=, so both are
 *     linkable and survive a refresh.
 *
 * ── Layout ───────────────────────────────────────────────────────────────────────────────────
 * The top of the page belongs to the operator, who needs to call, WhatsApp and read the balance
 * within five seconds of landing: a sticky command band, the contact facts, then six exact money
 * figures. Depth lives behind the tabs, for the owner.
 *
 * Every "start the next workflow" button carries the customer with it (`?customerId=`). Previously
 * they all navigated to an empty form, so the clerk re-keyed the phone number of the person they
 * were already looking at.
 */
const TAB_ICON = "h-4 w-4";

/**

 *
 * AlertRail raises exactly two actionable alerts and they deep-link to Documents and MONEY —
 * never to Enquiries. The band above ends on Outstanding, and the drill-down for that figure is
 * Money, so it sits third, adjacent to the number that sends people there. Enquiries and Timeline
 * are sales-side depth and follow. Overview stays first: it is the only tab whose data is already
 * in flight when the page mounts.
 */
const TABS = [
  { key: "overview",  label: "Overview",  icon: <CircleUserRound className={TAB_ICON} /> },
  { key: "bookings",  label: "Bookings",  icon: <Plane className={TAB_ICON} />,             countKey: "activeBookingCount" },
  { key: "money",     label: "Money",     icon: <IndianRupee className={TAB_ICON} />,       countKey: "invoiceCount" },
  { key: "enquiries", label: "Enquiries", icon: <MessageSquarePlus className={TAB_ICON} />, countKey: "leadCount" },
  { key: "timeline",  label: "Timeline",  icon: <History className={TAB_ICON} /> },
  { key: "documents", label: "Documents", icon: <FileCheck2 className={TAB_ICON} />,        countKey: "documentCount" },
  { key: "marketing", label: "Marketing", icon: <Megaphone className={TAB_ICON} />,         countKey: "marketingTouchCount" },
];

const STATUS_OPTIONS = ["Active", "Inactive", "Blocked"];
const TIER_OPTIONS = ["Bronze", "Silver", "Gold", "Platinum"];

/** Option lists with the record's current value folded in — see OverviewTab's ProfileSelect. */
const withCurrent = (options, current) =>
  current && !options.some((option) => option.toLowerCase() === String(current).toLowerCase())
    ? [current, ...options]
    : options;

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState(id ? "" : "Customer link is invalid.");
  const [notFound, setNotFound] = useState(false);

  const can = {
    edit: hasPermission(P.CUSTOMER_UPDATE),
    delete: hasPermission(P.CUSTOMER_DELETE),
    createLead: hasPermission(P.LEAD_CREATE),
    createBooking: hasPermission(P.BOOKING_CREATE),
    readBooking: hasPermission(P.BOOKING_READ),
    readQuotation: hasPermission(P.QUOTATION_READ),
    // The same gate the payments screen uses — a button that lands on a 403 is worse than no button.
    managePayments: hasPermission(P.PAYMENT_MANAGE),
    viewTrash: hasPermission(P.TRASH_VIEW),
  };

  /* ── URL state ─────────────────────────────────────────────────────────── */

  const activeTab = TABS.some((tab) => tab.key === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "overview";

  const setActiveTab = useCallback((tabKey) => {
    // `replace` so tab switching does not fill the back button with intermediate states. Changing
    // tab drops ?lead= too — it only means anything on Enquiries.
    setSearchParams(tabKey === "overview" ? {} : { tab: tabKey }, { replace: true });
  }, [setSearchParams]);

  // Which enquiry is expanded. In the URL rather than in the tab, because the tab unmounts on every
  // switch — component state lost the expansion the moment anyone glanced at Money and came back.
  const expandedLeadId = searchParams.get("lead") || null;

  const setExpandedLeadId = useCallback((leadId) => {
    setSearchParams(
      leadId ? { tab: "enquiries", lead: leadId } : { tab: "enquiries" },
      { replace: true },
    );
  }, [setSearchParams]);

  /* ── The call that gates first paint ───────────────────────────────────── */

  useEffect(() => {
    if (!id) return undefined;
    let active = true;

    setLoading(true);
    customerService.getSummary(id)
      .then((response) => {
        if (!active) return;
        const data = unwrap(response);
        if (!data) throw new Error("Customer response was empty");
        setSummary(data);
        setLoadError("");
        setNotFound(false);
      })
      .catch((error) => {
        if (!active) return;
        setNotFound(error?.response?.status === 404);
        setLoadError(getErrorMessage(error, "Customer details could not be loaded."));
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [id]);

  /* ── Sections, each loading on its tab's first open ────────────────────── */

  const sections = useCustomerProfile({
    id,
    activeTab,
    tabs: TABS,
    summary,
    canReadQuotation: can.readQuotation,
  });

  /* ── Mutations ─────────────────────────────────────────────────────────── */

  const { updating, updateStatus, updateTier, moveToTrash } = useCustomerMutations({
    id,
    summary,
    setSummary,
    overviewSection: sections.overview,
    canEdit: can.edit,
    showToast,
    onDeleted: () => navigate("/AllCustomers", { replace: true }),
  });

  /* ── Navigation that carries the customer ──────────────────────────────── */

  const newEnquiry = () => navigate(`/createlead?customerId=${id}`);
  const newBooking = () => navigate(`/CreateBooking?customerId=${id}`);
  const openBooking = (bookingId) => navigate(`/BookingDetails/${bookingId}`);
  const openLead = (leadId) => navigate(`/EditLead/${leadId}`);
  const openQuotation = (quotationId) => navigate(`/q/${quotationId}`);
  const openRef = (refType, refPublicId) => {
    if (!refPublicId) return;
    if (refType === "BOOKING") openBooking(refPublicId);
    else if (refType === "LEAD") openLead(refPublicId);
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  if (loading) return <LoadingPage />;

  if (loadError || !summary) {
    return (
      <CustomerUnavailable
        message={loadError}
        notFound={notFound}
        canViewTrash={can.viewTrash}
        onBack={() => navigate("/AllCustomers")}
        onOpenTrash={() => navigate("/trash")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: FONT }}>
      <CommandBar summary={summary} onBack={() => navigate("/AllCustomers")}>
        <ProfileActions
          customerId={id}
          summary={summary}
          can={can}
          updating={updating}
          onRecordPayment={(bookingId) => navigate(`/BookingPayments/${bookingId}`)}
          onNewBooking={newBooking}
          onNewEnquiry={newEnquiry}
          onEdit={() => navigate(`/EditCustomer/${id}`)}
          onMoveToTrash={moveToTrash}
          onToast={showToast}
        />
      </CommandBar>

      <main className="mx-auto max-w-[1440px] space-y-4 px-4 py-4 sm:px-6">
        <IdentityFacts summary={summary} />
        <AlertRail
          summary={summary}
          onOpenDocuments={() => setActiveTab("documents")}
          onOpenMoney={() => setActiveTab("money")}
        />
        <MoneyBand summary={summary} />

        <Tabs
          tabs={sections.tabItems}
          activeKey={activeTab}
          loadingKey={sections.loadingTabKey}
          onChange={setActiveTab}
          tone="blue"
          size="md"
          label="Customer sections"
        />

        {/* Every panel is paired to its tab by id — without this the tablist's ARIA is decorative. */}
        <Panel tabKey="overview" activeTab={activeTab} busy={sections.overview.loading}>
          {sections.overview.loading || !sections.overview.data
            ? <LoadingBlock />
            : (
              <OverviewTab
                customer={sections.overview.data}
                canEdit={can.edit}
                updating={updating}
                onStatusChange={updateStatus}
                onTierChange={updateTier}
                statusOptions={withCurrent(STATUS_OPTIONS, sections.overview.data.status)}
                tierOptions={withCurrent(TIER_OPTIONS, sections.overview.data.tier)}
              />
            )}
        </Panel>

        <Panel tabKey="bookings" activeTab={activeTab} busy={sections.bookings.loading}>
          <BookingsTab
            state={sections.bookings}
            canCreate={can.createBooking}
            canRead={can.readBooking}
            onNewBooking={newBooking}
            onOpenBooking={openBooking}
          />
        </Panel>

        <Panel tabKey="money" activeTab={activeTab} busy={sections.money.loading}>
          <MoneyTab state={sections.money} />
        </Panel>

        <Panel tabKey="enquiries" activeTab={activeTab} busy={sections.leads.loading}>
          <EnquiriesTab
            leadsState={sections.leads}
            quotationsState={sections.quotations}
            canCreateLead={can.createLead}
            canReadQuotation={can.readQuotation}
            expandedLeadId={expandedLeadId}
            onToggleLead={setExpandedLeadId}
            onNewEnquiry={newEnquiry}
            onOpenLead={openLead}
            onOpenQuotation={openQuotation}
          />
        </Panel>

        <Panel tabKey="timeline" activeTab={activeTab} busy={sections.timeline.loading}>
          <TimelineTab state={sections.timeline} onOpenRef={openRef} />
        </Panel>

        <Panel tabKey="documents" activeTab={activeTab} busy={sections.documents.loading}>
          <DocumentsTab state={sections.documents} />
        </Panel>

        <Panel tabKey="marketing" activeTab={activeTab} busy={sections.marketing.loading}>
          <MarketingTab state={sections.marketing} />
        </Panel>
      </main>
    </div>
  );
}

/**
 * One tab panel, wired to its tab button.
 *
 * Renders nothing when inactive — the sections are lazy and unmounting them is what keeps a tab
 * switch free. `aria-busy` lets a screen reader announce the wait instead of reading a skeleton.
 */
function Panel({ tabKey, activeTab, busy, children }) {
  if (activeTab !== tabKey) return null;
  return (
    <div id={`panel-${tabKey}`} role="tabpanel" aria-labelledby={`tab-${tabKey}`} aria-busy={busy || undefined}>
      {children}
    </div>
  );
}

