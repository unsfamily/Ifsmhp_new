import { describe, expect, it } from 'vitest';
import { legacyMembershipPolicy, isApplicationFeeExempt, isCvOptional, isSchoolStudent, SCHOOL_STUDENT_TYPE, STEM_COLLEGE_STUDENT_TYPE } from '../domain/membership';
import { evidenceKinds } from '../services/membership-policy.service';

const required = { ...legacyMembershipPolicy, requireProfile: true, requireCredential: true };

describe('student registration evidence', () => {
  it('keeps CV and credentials required for a professional applicant', () => {
    expect(evidenceKinds(required, 'Psychologist')).toEqual(['CV', 'CREDENTIAL']);
    expect(isApplicationFeeExempt('Psychologist')).toBe(false);
  });

  it('drops the CV for every fee-exempt student type and the credentials document for school students', () => {
    expect(isApplicationFeeExempt('Student')).toBe(true);
    expect(isCvOptional(STEM_COLLEGE_STUDENT_TYPE)).toBe(true);
    expect(evidenceKinds(required, 'Student')).toEqual(['CREDENTIAL']);
    expect(evidenceKinds(required, STEM_COLLEGE_STUDENT_TYPE)).toEqual(['CREDENTIAL']);
    expect(isSchoolStudent(SCHOOL_STUDENT_TYPE)).toBe(true);
    expect(evidenceKinds(required, SCHOOL_STUDENT_TYPE)).toEqual([]);
    expect(isSchoolStudent('Student')).toBe(false);
  });
});
