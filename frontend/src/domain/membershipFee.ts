/** Keep in sync with backend/domain/membership.ts applicant category helpers. */
export const APPLICATION_FEE_EXEMPT_TYPE = 'Student';
export const SCHOOL_STUDENT_TYPE = 'School Student';
export const STEM_COLLEGE_STUDENT_TYPE = 'STEM Student (joining college)';
const FEE_EXEMPT_TYPES = new Set([APPLICATION_FEE_EXEMPT_TYPE, SCHOOL_STUDENT_TYPE, STEM_COLLEGE_STUDENT_TYPE]);
export const isApplicationFeeExempt = (professionalType: string) => FEE_EXEMPT_TYPES.has(professionalType.trim());
export const isSchoolStudent = (professionalType: string) => professionalType.trim() === SCHOOL_STUDENT_TYPE;
export const isCvOptional = (professionalType: string) => FEE_EXEMPT_TYPES.has(professionalType.trim());
