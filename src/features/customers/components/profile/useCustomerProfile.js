import { useCallback, useMemo } from "react";

import customerService from "../../api/customerService";
import { useCustomerSection } from "./useCustomerSection";

const unwrap = (response) => response?.data?.data ?? response?.data;

/**
 * Every lazily-loaded section of the customer profile, and the tab-bar state derived from them.
 *
 * One hook rather than eight scattered calls in the page, because the LOAD POLICY is the thing
 * worth keeping in one place: each section is gated on its own tab being active, so opening the
 * profile costs the summary and nothing else, and a tab that is never opened is never fetched.
 * Spreading these back across the page is how a well-meant prefetch gets added and the policy
 * quietly dies.
 *
 * `quotations` is the one section not gated on its own tab: quotations render nested inside the
 * enquiry rows, so it loads with them — and is skipped entirely without QUOTATION_READ rather than
 * being allowed to 403.
 */
export function useCustomerProfile({ id, activeTab, tabs, summary, canReadQuotation }) {
  // A change of customer invalidates every cached section.
  const deps = useMemo(() => [id], [id]);

  // Written out one by one rather than through a loop or a local wrapper: these are hook calls, so
  // the sequence has to be fixed and visible to the rules-of-hooks lint.
  const overview = useCustomerSection(
    useCallback(() => customerService.getById(id).then(unwrap), [id]),
    { enabled: activeTab === "overview", deps },
  );
  const bookings = useCustomerSection(
    useCallback(() => customerService.getBookingHistory(id).then(unwrap), [id]),
    { enabled: activeTab === "bookings", deps },
  );
  const leads = useCustomerSection(
    useCallback(() => customerService.getLeads(id).then(unwrap), [id]),
    { enabled: activeTab === "enquiries", deps },
  );
  const quotations = useCustomerSection(
    useCallback(() => customerService.getQuotations(id).then(unwrap), [id]),
    { enabled: activeTab === "enquiries" && canReadQuotation, deps },
  );
  const timeline = useCustomerSection(
    useCallback(() => customerService.getTimeline(id).then(unwrap), [id]),
    { enabled: activeTab === "timeline", deps },
  );
  const money = useCustomerSection(
    useCallback(() => customerService.getMoney(id).then(unwrap), [id]),
    { enabled: activeTab === "money", deps },
  );
  const documents = useCustomerSection(
    useCallback(() => customerService.getDocuments(id).then(unwrap), [id]),
    { enabled: activeTab === "documents", deps },
  );
  const marketing = useCustomerSection(
    useCallback(() => customerService.getMarketing(id).then(unwrap), [id]),
    { enabled: activeTab === "marketing", deps },
  );

  // Counts come off the summary, so a badge is correct before its tab has ever been opened.
  const tabItems = useMemo(
    () => tabs.map((tab) => ({
      key: tab.key,
      label: tab.label,
      icon: tab.icon,
      count: tab.countKey ? Number(summary?.[tab.countKey] || 0) : 0,
    })),
    [tabs, summary],
  );

  // Drives the spinner inside the active tab's own button while its section is in flight.
  const loadingTabKey = useMemo(() => {
    const byTab = {
      overview: overview.loading,
      bookings: bookings.loading,
      enquiries: leads.loading,
      timeline: timeline.loading,
      money: money.loading,
      documents: documents.loading,
      marketing: marketing.loading,
    };
    return byTab[activeTab] ? activeTab : null;
  }, [activeTab, overview.loading, bookings.loading, leads.loading, timeline.loading,
      money.loading, documents.loading, marketing.loading]);

  return {
    overview, bookings, leads, quotations, timeline, money, documents, marketing,
    tabItems, loadingTabKey,
  };
}
