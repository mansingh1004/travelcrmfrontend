// src/app/chrome/AppLauncher.jsx
// Tenant-realm binding for the shared "All apps" grid. Everything the rail does
// not carry lives here — already filtered to what this user may reach, because
// the registry resolves its `can()` gates before the launcher ever sees it.

import LauncherSheet from "@shared/nav/AppLauncher";

import { useNav } from "../nav/NavProvider";
import { TONE_TEXT } from "../nav/navConfig";

// Tiles sit on white, so the rail's dark-surface `-400` ramp would read washed
// out; this is the same tone vocabulary one step darker.
const TILE_TONE = Object.fromEntries(
  Object.entries(TONE_TEXT).map(([k, v]) => [k, v.replace("-400", "-500")]),
);

export default function AppLauncher() {
  const { launcherOpen, setLauncherOpen, launcherAnchor, sections, isPinned, togglePin, activeDestination } =
    useNav();

  return (
    <LauncherSheet
      open={launcherOpen}
      onClose={() => setLauncherOpen(false)}
      sections={sections}
      isPinned={isPinned}
      togglePin={togglePin}
      // Tenant-only: NavProvider resolves pins against destinations + flattenGroups,
      // so a module pinned whole comes back as a real sidebar row. The console has
      // no such resolution — see the prop's note in the shared sheet.
      allowGroupPins
      activeId={activeDestination?.id}
      anchor={launcherAnchor}
      tone={TILE_TONE}
      theme="app"
    />
  );
}
