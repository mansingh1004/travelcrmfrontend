/**
 * Local Vite development follows the backend's non-production SuperAdmin bypass: password login
 * and every step-up action can be exercised without an authenticator code. `import.meta.env.DEV`
 * is compile-time false in production builds, so this cannot be enabled by a browser/runtime flag.
 */
export const isLocalSuperAdminMfaDisabled = () => import.meta.env.DEV;

