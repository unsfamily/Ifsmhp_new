import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  Mail,
  IdCard,
  Briefcase,
  GraduationCap,
  Lightbulb,
  FileText,
  Phone,
  MapPin,
  Link as LinkIcon,
  Edit3,
  Upload,
  Award,
  Download,
  Eye,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { apiClient, normalizeError } from '../../api/client';
import { memberApi, type MemberProfileData, type MemberCredentialDocument } from '../../api/member';
import { useApiData } from '../../hooks/useApiData';
import { useAuth } from '../../context/AuthContext';
import EditProfileDialog from './EditProfileDialog';

function safeUrl(value: string | null | undefined) {
  try {
    const url = new URL(value ?? '');
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  try {
    return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
  } catch {
    return 'Not provided';
  }
}

export default function MemberProfilePage() {
  const { user } = useAuth();
  return user ? <ScientistProfile key={user.id} /> : null;
}

function ScientistProfile() {
  const [revision, setRevision] = useState(0);
  const { data, loading: credentialsLoading, error: credentialsError, setData } = useApiData<MemberProfileData>(
    () => memberApi.profile(),
    [revision],
  );
  const profile = credentialsLoading || credentialsError ? null : data;
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [openingDocument, setOpeningDocument] = useState<string | null>(null);
  const documentUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = documentUrls.current;
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);

  const openCredentialDocument = async (credential: Pick<MemberCredentialDocument, 'id' | 'fileId' | 'fileName' | 'title'>, mode: 'preview' | 'download') => {
    if (!credential.fileId) return;
    setOpeningDocument(`${mode}:${credential.id}`);
    setDocumentError(null);
    const preview = mode === 'preview' ? window.open('about:blank', '_blank') : null;
    if (preview) preview.opener = null;
    try {
      const response = await apiClient.get(`/files/${credential.fileId}/download`, { responseType: 'blob' });
      const blob = response.data as Blob;
      const url = URL.createObjectURL(blob);
      documentUrls.current.add(url);
      const revoke = () => { URL.revokeObjectURL(url); documentUrls.current.delete(url); };
      if (mode === 'preview') {
        if (!preview) {
          revoke();
          setDocumentError('Preview was blocked by your browser. Allow pop-ups or download the document.');
          return;
        }
        preview.location.replace(url);
        window.setTimeout(revoke, 60_000);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = credential.fileName ?? credential.title;
        document.body.appendChild(link);
        link.click();
        link.remove();
        revoke();
      }
    } catch (error) {
      preview?.close();
      setDocumentError(isAxiosError(error) && error.response?.status === 404
        ? 'This document is no longer available.' : normalizeError(error).message);
    } finally {
      setOpeningDocument(null);
    }
  };

  const credentials = profile?.credentials ?? [];
  const education = profile?.education ?? [];
  const publications = profile?.publications ?? [];
  const display = (value: string | null | undefined) => credentialsLoading ? 'Loading...' : credentialsError ? 'Unavailable' : value?.trim() || 'Not provided';
  const initials = profile?.fullName.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '';
  const verified = profile?.status === 'ACTIVE' && profile.applicationStatus === 'APPROVED' && !!profile.approvedAt;
  const links = [
    { label: 'Google Scholar', url: safeUrl(profile?.scholarUrl) },
    { label: 'ORCID', url: profile?.orcid && /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(profile.orcid) ? `https://orcid.org/${profile.orcid}` : null },
    { label: 'Institutional Profile', url: safeUrl(profile?.websiteUrl) },
  ].filter((link): link is { label: string; url: string } => !!link.url);
  const emptyText = (message: string) => credentialsLoading ? 'Loading...' : credentialsError ? 'Unable to load profile.' : message;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-forum-100 ring-4 ring-brass-500/20 text-forum-700">
                <span className="font-display text-3xl font-bold">{initials}</span>
              </div>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-forum-600 text-white shadow-md hover:bg-forum-700 transition-colors"
                aria-label="Upload photo"
                aria-disabled="true"
                title="Photo upload is unavailable"
              >
                <Upload className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div style={{ overflowWrap: 'anywhere' }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl font-semibold text-forum-900">
                      {display(profile?.fullName)}
                    </h2>
                    <Badge variant="brass">
                      <Award className="h-2.5 w-2.5 mr-1" />
                      {verified ? 'Verified Member' : display(profile?.status)}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4 text-forum-600" />
                      {display(profile?.professionalTitle || profile?.professionalType)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <IdCard className="h-4 w-4 text-brass-700 font-bold" />
                      <span className="font-mono font-semibold text-brass-700">{display(profile?.memberId)}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 text-slateteal-500" />
                      {display(profile?.institution)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4" />
                      {display(profile?.email)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      {display(profile?.phone)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {display(profile?.country)}
                    </span>
                  </div>
                </div>
                <Button variant="primary" disabled={!profile} onClick={() => { setSaved(false); setEditing(true); }}>
                  <Edit3 className="h-4 w-4" />
                  Edit Profile
                </Button>
              </div>

              {credentialsError && <div role="alert" className="mt-3 text-sm text-danger-600">
                {credentialsError}
                <Button variant="ghost" size="sm" onClick={() => setRevision((value) => value + 1)}><RefreshCw className="h-4 w-4" />Retry</Button>
              </div>}
              {credentialsLoading && <p role="status" className="mt-3 text-sm text-ink-muted">Loading profile...</p>}
              {saved && <p role="status" className="mt-3 text-sm text-forum-700">Profile saved successfully.</p>}

              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                {[
                  { label: 'Member Since', value: display(profile?.approvedAt ? formatDate(profile.approvedAt, { month: 'short', year: 'numeric' }) : null) },
                  { label: 'Projects', value: display(profile?.stats.projects.toString()) },
                  { label: 'Publications', value: display(profile?.stats.publications.toString()) },
                  { label: 'Support Requests', value: display(profile?.stats.supportRequests.toString()) },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-paper-border bg-paper p-4">
                    <p className="text-xs text-ink-subtle uppercase tracking-wide">{s.label}</p>
                    <p className="mt-1 font-display text-xl font-semibold text-forum-900">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-forum-600" />
              Education & Qualifications
            </h3>
          </CardHeader>
          <CardContent className="pt-0 space-y-5">
            {education.length === 0 && <p className="text-sm text-ink-muted">{emptyText('No education or qualifications provided.')}</p>}
            {education.map((ed, i) => (
              <div key={ed.id} className="flex gap-4">
                <div className="relative">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forum-50 text-forum-700 ring-4 ring-paper-raised z-10">
                    <Award className="h-4 w-4" />
                  </div>
                  {i < education.length - 1 && <div className="absolute left-1/2 top-9 h-full w-px -translate-x-1/2 bg-paper-border" />}
                </div>
                <div className="flex-1 pb-2" style={{ overflowWrap: 'anywhere' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-forum-900">{ed.degree}</p>
                      <p className="text-sm text-ink-muted">{display(ed.institution)}</p>
                    </div>
                    <Badge variant="brass">{display(ed.endYear)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-subtle">{display(ed.detail)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-slateteal-500" />
              Research Interests
            </h3>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {!profile?.researchInterests.length && <p className="text-sm text-ink-muted">{emptyText('No research interests provided.')}</p>}
              {(profile?.researchInterests ?? []).map((t, index) => (
                <span
                  key={`${index}:${t}`}
                  style={{ overflowWrap: 'anywhere' }}
                  className="inline-flex items-center rounded-full bg-slateteal-100 px-3 py-1 text-xs font-medium text-slateteal-700"
                >
                  {t}
                </span>
              ))}
            </div>

            <h4 className="mt-6 mb-3 font-semibold text-forum-900 flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-forum-600" />
              Professional Links
            </h4>
            <div className="space-y-2">
              {links.length === 0 && <p className="text-sm text-ink-muted">{emptyText('No professional links provided.')}</p>}
              {links.map((l) => (
                <div
                  key={l.label}
                  className="flex items-center justify-between rounded-lg border border-paper-border bg-paper px-4 py-2.5 hover:border-forum-200 transition-colors"
                >
                  <span className="text-sm font-medium text-forum-900">{l.label}</span>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-forum-700 hover:text-forum-900 truncate max-w-[180px]">
                    {l.url}
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-forum-600" />
              Credential Documents
            </h3>
            <p className="text-xs text-ink-subtle mt-0.5">Documents submitted with your IFSMHP application</p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {documentError && (
            <div className="mb-4 rounded-lg border border-danger-600/20 bg-danger-100 p-3 text-sm text-danger-600">
              {documentError}
            </div>
          )}
          {credentialsLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-paper-border bg-paper p-4 text-sm text-ink-muted">
              <RefreshCw className="h-4 w-4 animate-spin text-forum-600" />
              Loading credential documents...
            </div>
          ) : credentialsError ? (
            <div className="flex items-center gap-2 rounded-lg border border-danger-600/20 bg-danger-100 p-4 text-sm text-danger-600">
              <AlertCircle className="h-4 w-4" />
              {credentialsError}
            </div>
          ) : credentials.length === 0 ? (
            <div className="rounded-lg border border-paper-border bg-paper p-4 text-sm text-ink-muted">
              No credential documents are attached to this profile yet.
            </div>
          ) : (
            <div className="divide-y divide-paper-border rounded-lg border border-paper-border">
              {credentials.map((credential) => {
                const previewing = openingDocument === `preview:${credential.id}`;
                const downloading = openingDocument === `download:${credential.id}`;
                const canPreview = credential.mimeType === 'application/pdf' || credential.mimeType?.startsWith('image/');
                return (
                  <div key={credential.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-forum-50 text-forum-700">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-forum-900">{credential.fileName ?? credential.title}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-subtle">
                          <span>{credential.type}</span>
                          <span>{credential.fileSize}</span>
                          <span>Uploaded {formatDate(credential.uploadedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canPreview && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void openCredentialDocument(credential, 'preview')}
                          disabled={previewing || !credential.fileId}
                        >
                          {previewing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                          Preview
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void openCredentialDocument(credential, 'download')}
                        disabled={downloading || !credential.fileId}
                      >
                        {downloading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Download
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-forum-600" />
              Publications List
            </h3>
            <p className="text-xs text-ink-subtle mt-0.5">Your IFSMHP-hosted and external publications</p>
          </div>
          <Button variant="outline" size="sm" aria-disabled="true" title="Publication creation is unavailable">
            <Upload className="h-4 w-4" />
            Add Publication
          </Button>
        </CardHeader>
        <CardContent className="pt-0 divide-y divide-paper-border">
          {publications.length === 0 && <p className="text-sm text-ink-muted">{emptyText('No published works yet.')}</p>}
          {publications.map((p) => (
            <div key={p.id} className="py-4 first:pt-0 last:pb-0 flex items-start gap-4">
              <Badge variant="brass">{p.publishedAt && !Number.isNaN(Date.parse(p.publishedAt)) ? new Date(p.publishedAt).getFullYear() : 'Not provided'}</Badge>
              <div className="flex-1 min-w-0" style={{ overflowWrap: 'anywhere' }}>
                <p className="font-medium text-forum-900 leading-snug">{p.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{display(p.venue)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" aria-label="View publication" disabled={openingDocument?.endsWith(`:${p.id}`)} aria-disabled={!p.fileId && !p.doi}
                  title={!p.fileId && !p.doi ? 'No publication file or DOI available' : 'View publication'}
                  onClick={() => {
                    if (p.fileId) void openCredentialDocument(p, p.mimeType === 'application/pdf' || p.mimeType?.startsWith('image/') ? 'preview' : 'download');
                    else if (p.doi) window.open(`https://doi.org/${encodeURI(p.doi)}`, '_blank', 'noopener,noreferrer');
                  }}>
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">View</span>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      {editing && profile && <EditProfileDialog profile={profile} onClose={() => setEditing(false)} onSaved={(updated) => {
        setData(updated);
        setEditing(false);
        setSaved(true);
        setRevision((value) => value + 1);
      }} />}
    </div>
  );
}
