// src/app/chrome/AppCommandPalette.jsx
// Tenant-realm binding for the shared palette: feeds it this user's permitted
// destinations, their quick actions and their recents, and turns record search on
// (the console has no CRM records to search, so it leaves that off).
//
// Currency is on for the same reason: a travel desk prices trips in AED and THB all
// day, the platform console does not.

import { useNavigate } from "react-router-dom";

import CommandPalette from "@shared/nav/CommandPalette";
import { useNav } from "../nav/NavProvider";

export default function AppCommandPalette() {
  const navigate = useNavigate();
  const {
    paletteOpen,
    setPaletteOpen,
    destinations,
    quickActions,
    recentDestinations,
    openConverter,
  } = useNav();

  return (
    <CommandPalette
      open={paletteOpen}
      onClose={() => setPaletteOpen(false)}
      destinations={destinations}
      actions={quickActions}
      recents={recentDestinations}
      onNavigate={navigate}
      theme="app"
      enableRecordSearch
      enableCurrency
      onOpenConverter={openConverter}
      placeholder="Search, jump to, or convert (100 usd to inr)…"
    />
  );
}
