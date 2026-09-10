import { useState } from 'react';
import { normalizeError } from '../api/client';
import type { UploadedFile } from '../api/member';
import { formatBytes } from '../utils/formatBytes';

/** Matches MAX_UPLOAD_MB on the server; re-checked there with magic bytes. */
export const MAX_UPLOAD_MB = 25;

/** The server's own allowlist, minus the types it accepts but nobody sends. */
export const CHAT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp', 'txt', 'csv'];
export const CHAT_ACCEPT = CHAT_EXTENSIONS.map((e) => `.${e}`).join(',');

/** A URL queued to ride along with the next message. */
export interface PendingLink {
  key: string;
  url: string;
  label?: string;
}

/** One attachment as the UI tracks it, from selection through to an id. */
export interface Attachment {
  /** Stable key; survives retry so React does not remount the row. */
  key: string;
  name: string;
  sizeBytes: number;
  status: 'uploading' | 'uploaded' | 'failed';
  uploaded: UploadedFile | null;
  error: string | null;
  file: File;
}

function extensionOf(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/**
 * Catches the obvious rejections before spending a round trip. The server still
 * re-validates, including magic bytes, so this is convenience and not the gate.
 */
export function localFileError(file: File, allowed: string[] = CHAT_EXTENSIONS) {
  if (file.size <= 0) return 'That file is empty.';
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `That file is ${formatBytes(file.size)}. The limit is ${MAX_UPLOAD_MB} MB.`;
  }
  if (!allowed.includes(extensionOf(file.name))) {
    return `${extensionOf(file.name).toUpperCase() || 'That file type'} is not accepted.`;
  }
  return null;
}

/**
 * Owns a set of chat attachments: local validation, upload, retry and removal.
 *
 * `POST /files/upload` takes one file per request, so a multi-select becomes N
 * sequential calls, each tracked independently — one failure must not discard
 * the rest.
 */
export function useAttachments(options: { maxFiles?: number; upload: (file: File) => Promise<UploadedFile> }) {
  const maxFiles = options.maxFiles ?? 5;
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const busy = attachments.some((a) => a.status === 'uploading');
  const failed = attachments.some((a) => a.status === 'failed');

  /** Uploads one file, threading its progress back into the right row. */
  const runUpload = async (attachment: Attachment) => {
    // Re-finds the row by key in current state rather than closing over a stale
    // array, so concurrent uploads do not overwrite each other.
    const patch = (next: Partial<Attachment>) =>
      setAttachments((current) => current.map((a) => (a.key === attachment.key ? { ...a, ...next } : a)));
    try {
      const uploaded = await options.upload(attachment.file);
      patch({ status: 'uploaded', uploaded, error: null });
    } catch (error) {
      const normalized = normalizeError(error);
      patch({ status: 'failed', uploaded: null, error: normalized.fieldErrors.file ?? normalized.message });
    }
  };

  const addFiles = (fileList: FileList) => {
    setFileError(null);
    const chosen = Array.from(fileList);

    if (attachments.length + chosen.length > maxFiles) {
      setFileError(`Attach no more than ${maxFiles} files.`);
      return;
    }

    for (const file of chosen) {
      const invalid = localFileError(file);
      // Skip the bad one and keep going rather than dropping the whole batch.
      if (invalid) { setFileError(`${file.name}: ${invalid}`); continue; }

      const attachment: Attachment = {
        key: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        sizeBytes: file.size,
        status: 'uploading',
        uploaded: null,
        error: null,
        file,
      };
      setAttachments((current) => [...current, attachment]);
      void runUpload(attachment);
    }
  };

  const remove = (key: string) => {
    setFileError(null);
    setAttachments((current) => current.filter((a) => a.key !== key));
  };

  const retry = (attachment: Attachment) => {
    const retrying = { ...attachment, status: 'uploading' as const, error: null };
    setAttachments((current) => current.map((a) => (a.key === attachment.key ? retrying : a)));
    void runUpload(retrying);
  };

  const [links, setLinks] = useState<PendingLink[]>([]);

  /**
   * Mirrors the server's rule: a valid URL that is http or https. `new URL`
   * alone accepts javascript: and data:, which is exactly what must not end up
   * in a chip the recipient clicks. Returns an error string, or null on success.
   */
  const addLink = (url: string, label?: string): string | null => {
    if (links.length >= maxFiles) return `Add no more than ${maxFiles} links.`;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return 'Enter a valid URL, including https://';
    }
    if (!/^https?:$/i.test(parsed.protocol)) return 'Use an HTTP or HTTPS URL.';
    if (links.some((l) => l.url === url)) return 'That link is already attached.';
    setLinks((current) => [...current, { key: `${url}-${Date.now()}`, url, label }]);
    return null;
  };

  const removeLink = (key: string) => setLinks((current) => current.filter((l) => l.key !== key));

  const reset = () => {
    setAttachments([]);
    setLinks([]);
    setFileError(null);
  };

  /** Ids to send with the message. Only completed uploads have one. */
  const fileIds = () => attachments.filter((a) => a.uploaded).map((a) => a.uploaded!.id);
  const linkPayload = () => links.map(({ url, label }) => ({ url, ...(label ? { label } : {}) }));

  return {
    attachments, fileError, setFileError, busy, failed, addFiles, remove, retry,
    links, addLink, removeLink,
    reset, fileIds, linkPayload,
    /** True when there is something attached that is not ready to send. */
    blocked: busy || failed,
  };
}
