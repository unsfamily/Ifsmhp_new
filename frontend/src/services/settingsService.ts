import { apiClient } from '../api/client';
import type { SettingsSnapshot, SettingsSection, PublicSettings } from '../../../backend/domain/settings';
export type { SettingsSnapshot, SettingsSection, SettingsValues, PublicSettings } from '../../../backend/domain/settings';
export const settingsService = {
  get: async (signal?: AbortSignal) => (await apiClient.get<{ data: SettingsSnapshot }>('/admin/settings', { signal })).data.data,
  save: async (section: SettingsSection, expectedRevision: number, values: Record<string, unknown>, signal?: AbortSignal) => (await apiClient.patch<{ data: SettingsSnapshot }>(`/admin/settings/${section}`, { expectedRevision, values }, { signal })).data.data,
  public: async (signal?: AbortSignal) => (await apiClient.get<{ data: PublicSettings }>('/public/settings', { signal })).data.data,
};
export const settingsChanged = () => { window.dispatchEvent(new Event('settings-changed')); };
