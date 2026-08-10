/**
 * Hotel Partner — the public, token-authenticated hotel registration surface.
 *
 * A FOURTH realm alongside staff / console / traveler-portal. The visitor is a hotel owner with no
 * CRM account: no login, no stored token, no permissions. The invite token in the URL is the whole
 * credential, and it is re-verified by the backend on every call.
 *
 * Its route must stay a TOP-LEVEL sibling of `/q/:publicId` in router.jsx — anything nested under
 * `/` renders <Layout/>, which redirects an unauthenticated visitor to /login.
 */
export { default as HotelPartnerRegister } from "./pages/HotelPartnerRegister";
