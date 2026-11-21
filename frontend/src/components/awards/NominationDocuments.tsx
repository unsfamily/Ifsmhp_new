import { useState, type Dispatch, type SetStateAction } from 'react';
import { AlertCircle, CheckCircle2, FileText, RefreshCw, Trash2, Upload } from 'lucide-react';
import Button from '../common/Button';
import {
  removeRegistrationDocument,
  uploadRegistrationDocument,
  type RegistrationDocumentUpload,
} from '../../api/auth';
import { normalizeError } from '../../api/client';
import { formatBytes } from '../../utils/formatBytes';

export type NominationDocumentKind = 'cv' | 'photo';

type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'removing' | 'failed';

export type NominationDocumentState = {
  status: UploadStatus;
  uploaded: RegistrationDocumentUpload | null;
  error: string | null;
};

const slots: Array<{ kind: NominationDocumentKind; label: string; accept: string; hint: string }> = [
  { kind: 'cv', label: 'Upload your CV', accept: '.pdf,.doc,.docx', hint: 'PDF, DOC, DOCX (max 5MB)' },
  { kind: 'photo', label: 'Upload your recent photo', accept: '.jpg,.jpeg,.png', hint: 'JPG or PNG (max 5MB)' },
];

const cvExtensions = new Set(['pdf', 'doc', 'docx']);
const photoExtensions = new Set(['jpg', 'jpeg', 'png']);

export const emptyNominationDocuments = (): Record<NominationDocumentKind, NominationDocumentState> => ({
  cv: { status: 'idle', uploaded: null, error: null },
  photo: { status: 'idle', uploaded: null, error: null },
});

function extensionOf(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function clientFileError(kind: NominationDocumentKind, file: File) {
  if (file.size <= 0) return 'Choose a non-empty file.';
  if (file.size > 5 * 1024 * 1024) return 'Upload a file under 5 MB.';
  const extension = extensionOf(file.name);
  if (kind === 'cv' && !cvExtensions.has(extension)) return 'Upload a PDF, DOC, or DOCX CV.';
  if (kind === 'photo' && !photoExtensions.has(extension)) return 'Upload a JPG or PNG photograph.';
  return null;
}

type NominationDocumentsProps = {
  documents: Record<NominationDocumentKind, NominationDocumentState>;
  setDocuments: Dispatch<SetStateAction<Record<NominationDocumentKind, NominationDocumentState>>>;
  errors: Record<string, string>;
  disabled: boolean;
};

export default function NominationDocuments({ documents, setDocuments, errors, disabled }: NominationDocumentsProps) {
  const [busy, setBusy] = useState(false);

  const selectFile = async (kind: NominationDocumentKind, file: File | null) => {
    if (!file || busy) return;
    const localError = clientFileError(kind, file);
    if (localError) {
      setDocuments((current) => ({ ...current, [kind]: { status: 'failed', uploaded: null, error: localError } }));
      return;
    }
    const previous = documents[kind].uploaded;
    setBusy(true);
    setDocuments((current) => ({ ...current, [kind]: { status: 'uploading', uploaded: null, error: null } }));
    try {
      const uploaded = await uploadRegistrationDocument(file);
      setDocuments((current) => ({ ...current, [kind]: { status: 'uploaded', uploaded, error: null } }));
      if (previous) {
        await removeRegistrationDocument({ id: previous.id, claimToken: previous.claimToken }).catch(() => undefined);
      }
    } catch (error) {
      const normalized = normalizeError(error);
      setDocuments((current) => ({
        ...current,
        [kind]: { status: 'failed', uploaded: null, error: normalized.fieldErrors.file ?? normalized.message },
      }));
    } finally {
      setBusy(false);
    }
  };

  const removeFile = async (kind: NominationDocumentKind) => {
    const current = documents[kind];
    if (!current.uploaded) {
      setDocuments((all) => ({ ...all, [kind]: { status: 'idle', uploaded: null, error: null } }));
      return;
    }
    setBusy(true);
    setDocuments((all) => ({ ...all, [kind]: { ...all[kind], status: 'removing', error: null } }));
    try {
      await removeRegistrationDocument({ id: current.uploaded.id, claimToken: current.uploaded.claimToken });
      setDocuments((all) => ({ ...all, [kind]: { status: 'idle', uploaded: null, error: null } }));
    } catch (error) {
      setDocuments((all) => ({
        ...all,
        [kind]: { ...all[kind], status: 'uploaded', error: normalizeError(error).message },
      }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className="space-y-4">
      <legend className="font-display text-xl font-semibold text-forum-900">Document Upload</legend>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {slots.map((slot) => {
          const state = documents[slot.kind];
          const uploaded = state.uploaded;
          const error = state.error ?? errors[slot.kind];
          const statusText = state.status === 'uploading' ? 'Uploading...' : state.status === 'removing' ? 'Removing...' : state.status === 'uploaded' ? 'Uploaded' : state.status === 'failed' ? 'Upload failed' : 'Required';
          const statusClass = state.status === 'uploaded'
            ? 'bg-success-100 text-success-600'
            : state.status === 'failed'
              ? 'bg-danger-100 text-danger-600'
              : state.status === 'uploading' || state.status === 'removing'
                ? 'bg-forum-50 text-forum-700'
                : 'bg-warning-100 text-warning-600';
          return (
            <div key={slot.kind} className="flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-3">
                <label className="min-w-0 text-sm font-medium leading-5 text-ink">
                  {slot.label}
                  <span className="ml-1 text-danger-600">*</span>
                </label>
                <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}>
                  {(state.status === 'uploading' || state.status === 'removing') && <RefreshCw className="h-3 w-3 animate-spin" />}
                  {state.status === 'failed' && <AlertCircle className="h-3 w-3" />}
                  {state.status === 'uploaded' && <CheckCircle2 className="h-3 w-3" />}
                  {statusText}
                </span>
              </div>
              <div className={`flex h-full flex-col justify-center rounded-lg border p-4 ${error ? 'border-danger-600/40 bg-danger-100/20' : uploaded ? 'border-success-600/25 bg-success-100/20' : 'border-dashed border-paper-border bg-paper'}`}>
                {uploaded ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-paper-raised text-forum-700 ring-1 ring-paper-border">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-forum-900">{uploaded.name}</p>
                        <p className="mt-1 text-xs text-ink-subtle">{formatBytes(uploaded.sizeBytes)} · Saved for submission</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => { void removeFile(slot.kind); }} disabled={disabled || state.status === 'removing'}>
                        {state.status === 'removing' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Remove
                      </Button>
                      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-forum-600 bg-transparent px-3 py-1.5 text-sm font-medium text-forum-700 transition-colors hover:bg-forum-50">
                        <Upload className="h-3.5 w-3.5" />
                        Replace
                        <input type="file" accept={slot.accept} className="sr-only" disabled={disabled || busy} onChange={(event) => { void selectFile(slot.kind, event.currentTarget.files?.[0] ?? null); event.currentTarget.value = ''; }} />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-9 w-9 text-ink-subtle" />
                    <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-lg bg-forum-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forum-700">
                      {state.status === 'uploading' ? 'Uploading...' : 'Upload file'}
                      <input id={`nomination-${slot.kind}`} type="file" accept={slot.accept} className="sr-only" disabled={disabled || state.status === 'uploading'} onChange={(event) => { void selectFile(slot.kind, event.currentTarget.files?.[0] ?? null); event.currentTarget.value = ''; }} />
                    </label>
                    <p className="mt-2 text-xs text-ink-subtle">{slot.hint}</p>
                  </div>
                )}
                {error && <p role="alert" className="mt-2 text-xs text-danger-600">{error}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
