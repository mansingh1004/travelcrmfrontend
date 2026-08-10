// src/app/chrome/AppCommandPalette.jsx
// Tenant-realm binding for the shared palette: feeds it this user's permitted
// destinations, their quick actions and their recents, and turns record search on
// (the console has no CRM records to search, so it leaves that off).

import { useNavigate } from "react-router-dom";

import CommandPalette from "@shared/nav/CommandPalette";
import { useNav } from "../nav/NavProvider";

export default function AppCommandPalette() {
  const navigate = useNavigate();
  const { paletteOpen, setPaletteOpen, destinations, quickActions, recentDestinations } = useNav();

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
      placeholder="Search leads, customers, bookings…"
    />
  );
}
