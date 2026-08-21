// import { useState, Suspense } from 'react';
// import { Outlet } from 'react-router-dom'; // 1. Ye naya import add karna hai
// import Sidebar from '@app/chrome/Sidebar';
// import Navbar from '@app/chrome/Navbar';
// import AppFooter from '@app/chrome/AppFooter';
// import PageLoader from '@app/PageLoader';
// import ImpersonationBanner from '@app/chrome/ImpersonationBanner';
// import MaintenanceOverlay from '@app/chrome/MaintenanceOverlay';
// // import DishaWidget from '../features/assistant/DishaWidget';

// const Layout = () => { // 2. Yahan se { children } hata diya gaya hai
//   // Default state ko ab false rakha hai taaki mobile par pehle se open na mile
//   const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

//   const toggleSidebar = () => {
//     setIsSidebarExpanded(!isSidebarExpanded);
//   };

//   return (
//     <div className="flex h-screen flex-col overflow-hidden">
//       <MaintenanceOverlay />
//       <ImpersonationBanner />
//       <div className="flex flex-1 overflow-hidden bg-gray-50 relative">

//       {/* --- MOBILE OVERLAY START --- */}
//       {/* Yeh sirf mobile (md:hidden) par dikhega jab sidebar open hoga. Ispe click karne se sidebar band ho jayega */}
//       {isSidebarExpanded && (
//         <div 
//           className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
//           onClick={() => setIsSidebarExpanded(false)}
//         ></div>
//       )}
//       {/* --- MOBILE OVERLAY END --- */}

//       <Sidebar isExpanded={isSidebarExpanded} />
      
//       <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
//         <Navbar toggleSidebar={toggleSidebar} />
        
//         <main className="flex-1 overflow-y-auto bg-[#f4f6f9] p-4">
          
//           {/* Page chunks load inside the chrome — navbar/sidebar stay visible
//               while a lazy route downloads (Phase 5b). */}
//           <Suspense fallback={<PageLoader />}>
//             <Outlet />
//           </Suspense>
// <AppFooter/>
//         </main>
//       </div>
//       </div>

//       {/* Floating internal AI assistant — available on every authenticated page.
//           Parked: the AI assistant is not part of this sprint's release, and the backend
//           ships with disha.enabled=false, so /ai/chat 404s.

//           When re-enabling, do NOT just uncomment — gate it on the server flag, so the
//           widget can never come back before the backend that answers it:
//             const { disha } = await getFeatures();   // GET /api/me/features
//             {disha && <DishaWidget />}
//           The same disha.enabled property drives both that response and whether the
//           backend's ChatController exists at all, so the two cannot drift. */}
//       {/* <DishaWidget /> */}
//     </div>
//   );
// };

// export default Layout;


import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@app/chrome/Sidebar';
import Navbar from '@app/chrome/Navbar';
import AppFooter from '@app/chrome/AppFooter';
import PageLoader from '@app/PageLoader';
import ImpersonationBanner from '@app/chrome/ImpersonationBanner';
import MaintenanceOverlay from '@app/chrome/MaintenanceOverlay';
// import DishaWidget from '../features/assistant/DishaWidget';

import { ReminderPopupCenter } from "@features/reminders";
import { hasPermission, P } from "@shared/lib/access";

// Navigation. One provider owns the permitted nav tree, pins/recents, the rail's
// collapsed state and the palette/launcher/drawer flags — the rail, the header,
// the launcher and the mobile tab bar are all views over it, so they can never
// disagree about what is open or where you are.
import NavProvider from '@app/nav/NavProvider';
import AppCommandPalette from '@app/chrome/AppCommandPalette';
import AppLauncher from '@app/chrome/AppLauncher';
import MobileTabBar from '@app/chrome/MobileTabBar';
import CurrencyConverter from '@app/chrome/CurrencyConverter';

// Claim window. The PROVIDER wraps the whole chrome so the single SSE subscription lives above both
// consumers — the always-mounted toast host and the leads page that mounts on navigation. Two
// subscriptions would mean two connections per tab and two toasts per lead.
import { LeadAlertProvider } from "@features/leads";
import LeadAlertHost from "@app/chrome/LeadAlertHost";

const Layout = () => {
  return (
    <LeadAlertProvider>
    <NavProvider>
    <div className="flex h-screen flex-col overflow-hidden">
      <MaintenanceOverlay />
      <ImpersonationBanner />
      <div className="flex flex-1 overflow-hidden bg-gray-50 relative">

      {/* The rail owns its own mobile drawer + scrim now (it needs them to animate
          together), so there is no overlay to render from here. */}
      <Sidebar />

   
   
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar />

        {/* pb-20 on phones clears the fixed bottom tab bar — without it the last
            row of every table sits underneath it and cannot be tapped. */}
        <main
        id="main-scroll-container"
        
        className="flex-1 overflow-y-auto bg-[#f4f6f9] p-4 pb-20 md:pb-4">

          {/* Page chunks load inside the chrome — navbar/sidebar stay visible
              while a lazy route downloads (Phase 5b). */}
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
<AppFooter/>
        </main>
      </div>
      </div>




      {/* Thumb-reach navigation, phones only. */}
      <MobileTabBar />

      {/* ⌘K search + the "All apps" grid. Mounted at the shell so they open over
          any page, from any trigger. */}
      <AppCommandPalette />
      <AppLauncher />

      {/* Currency converter — Alt+C, or from ⌘K. Mounted here for the same reason
          as the two above: a travel desk prices a trip from whatever screen it is
          on, and a converter you have to navigate to is a converter nobody uses. */}
      <CurrencyConverter />

       {/* Global reminder popup — visible on every authenticated CRM page.
           Gated on REMINDER_READ: it fetches on mount, on a 60s interval, on window focus AND on
           visibilitychange, so for a user without the permission (an accountant has none) it fired
           a 403 on every page and roughly every minute, each one toasted by the interceptor. */}
      {hasPermission(P.REMINDER_READ) && <ReminderPopupCenter />}

      {/* New-lead broadcast popup — every user of the tenant, every page. A lead that arrives while
          someone is deep in a booking form is exactly the one this exists to surface. */}
      <LeadAlertHost />

      {/* Floating internal AI assistant — available on every authenticated page.
          Parked: the AI assistant is not part of this sprint's release, and the backend
          ships with disha.enabled=false, so /ai/chat 404s.

          When re-enabling, do NOT just uncomment — gate it on the server flag, so the
          widget can never come back before the backend that answers it:
            const { disha } = await getFeatures();   // GET /api/me/features
            {disha && <DishaWidget />}
          The same disha.enabled property drives both that response and whether the
          backend's ChatController exists at all, so the two cannot drift. */}
      {/* <DishaWidget /> */}
    </div>
    </NavProvider>
    </LeadAlertProvider>
  );
};

export default Layout;
