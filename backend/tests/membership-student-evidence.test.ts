import { describe, expect, it } from 'vitest';
import { legacyMembershipPolicy, hidesAcademicBackground, isApplicationFeeExempt, isCvOptional, isSchoolStudent, SCHOOL_STUDENT_TYPE, STEM_COLLEGE_STUDENT_TYPE } from '../domain/membership';
import { evidenceKinds } from '../services/membership-policy.service';

const required = { ...legacyMembershipPolicy, requireProfile: true, requireCredential: true };

describe('student registration evidence', () => {
  it('keeps credentials required for a professional applicant and does not require a CV', () => {
    expect(evidenceKinds(required, 'Psychologist')).toEqual(['CREDENTIAL']);
    expect(isApplicationFeeExempt('Psychologist')).toBe(false);
  });

  it('keeps credentials for college students and drops them for school students', () => {
    expect(isApplicationFeeExempt('Student')).toBe(true);
    expect(isCvOptional(STEM_COLLEGE_STUDENT_TYPE)).toBe(true);
    expect(evidenceKinds(required, 'Student')).toEqual(['CREDENTIAL']);
    expect(evidenceKinds(required, STEM_COLLEGE_STUDENT_TYPE)).toEqual(['CREDENTIAL']);
    expect(isSchoolStudent(SCHOOL_STUDENT_TYPE)).toBe(true);
    expect(evidenceKinds(required, SCHOOL_STUDENT_TYPE)).toEqual([]);
    expect(isSchoolStudent('Student')).toBe(false);
    expect(hidesAcademicBackground('Student')).toBe(true);
    expect(hidesAcademicBackground(SCHOOL_STUDENT_TYPE)).toBe(true);
    expect(hidesAcademicBackground(STEM_COLLEGE_STUDENT_TYPE)).toBe(false);
    expect(hidesAcademicBackground('Psychologist')).toBe(false);
  });
});
