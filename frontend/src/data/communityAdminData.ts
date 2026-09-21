import type { CommunityAdminSampleData } from '../types/community';
import raw from './community-admin-data.json';

/**
 * Sample dataset powering the admin community pages while the
 * /admin/community/* routes are still unbuilt. Replace these reads with
 * communityAdminService calls once the backend endpoints exist.
 */
export const communityAdminData = raw as unknown as CommunityAdminSampleData;

/** Platform admin used as the acting user for local mutations on the sample data. */
export const SAMPLE_ADMIN = {
  id: 'usr_admin_01',
  name: 'Dr. Elaine Porter',
} as const;
