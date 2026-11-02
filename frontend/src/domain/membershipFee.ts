/** Keep in sync with backend/domain/membership.ts APPLICATION_FEE_EXEMPT_TYPE. */
export const APPLICATION_FEE_EXEMPT_TYPE = 'Student';
export const isApplicationFeeExempt = (professionalType: string) => professionalType.trim() === APPLICATION_FEE_EXEMPT_TYPE;
