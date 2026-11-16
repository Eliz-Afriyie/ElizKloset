// Temporarily disabled while the backend's development sign-in issues a full
// staff session without MFA. Set to true when backend MFA is enabled again.
// This flag changes the flow only; auth/me still verifies every staff sign-in.
export const ADMIN_MFA_ENABLED: boolean = false;
