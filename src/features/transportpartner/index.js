/**
 * Transport Partner — the public, token-authenticated fleet registration surface.
 *
 * A realm of its own alongside staff / console / traveler-portal, and a sibling of hotel-partner.
 * The visitor is a coach or cab operator with no CRM account: no login, no stored token, no
 * permissions, no redirect on 401. The invite token in the URL is the whole credential, and it is
 * re-verified by the backend on every call.
 *
 * Its route must stay a TOP-LEVEL sibling of `/q/:publicId` and `/hotel-partner/:token` in
 * router.jsx — anything nested under `/` renders <Layout/>, which redirects an unauthenticated
 * visitor to /login. An operator who follows their invitation link would land on a staff login
 * screen and never see the form.
 */
export { default as TransportPartnerRegister } from "./pages/TransportPartnerRegister";
