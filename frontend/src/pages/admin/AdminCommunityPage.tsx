import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Check,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import Button from '../../components/common/Button';
import {
  communityActions,
  type CommunityGroup,
  useCommunityStore,
} from '../../api/communityStore';

const card =
  'rounded-xl border border-paper-border bg-paper-raised shadow-[0_1px_0_rgba(1,37,89,0.04),0_10px_25px_-12px_rgba(1,37,89,0.08)]';
type Tab = 'groups' | 'connections' | 'discussions';

export default function AdminCommunityPage() {
  const state = useCommunityStore();
  const [tab, setTab] = useState<Tab>('groups');
  const [editor, setEditor] = useState<CommunityGroup | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const filteredGroups = useMemo(
    () =>
      state.groups.filter((group) =>
        group.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [state.groups, search],
  );
  const pending = state.connections.filter((item) => item.status === 'pending');

  return (
    <div className="min-h-screen space-y-6 bg-paper p-4 text-forum-900 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-forum-900 sm:text-3xl">
            Community Management
          </h1>
          <p className="mt-1 text-sm text-forum-900/70">
            Create groups, assign people and moderate conversations
          </p>
        </div>
        <Button onClick={() => setEditor('new')}>
          <Plus className="h-4 w-4" />
          Create Group
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Users} value={state.groups.length} label="Groups" />
        <Stat
          icon={Check}
          value={state.connections.filter((c) => c.status === 'accepted').length}
          label="Connected pairs"
        />
        <Stat icon={MessageCircle} value={state.discussions.length} label="Discussions" />
      </div>

      <nav className="flex gap-2 overflow-x-auto border-b border-paper-border">
        {(
          [
            ['groups', 'Groups'],
            ['connections', `Connections (${pending.length} pending)`],
            ['discussions', 'Discussions'],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === value
                ? 'border-brass-500 text-forum-900'
                : 'border-transparent text-forum-900/55 hover:text-forum-900/80'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'groups' && (
        <section className={card}>
          <div className="flex flex-wrap justify-between gap-3 border-b border-paper-border p-5">
            <div>
              <h2 className="font-display text-lg font-semibold text-forum-900">
                Interest Groups
              </h2>
              <p className="mt-1 text-xs text-forum-900/60">
                Only active groups appear in the member dashboard
              </p>
            </div>
            <label className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forum-900/45" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-paper-border bg-paper py-2 pl-9 pr-3 text-sm text-forum-900 placeholder:text-forum-900/40 focus:border-forum-500 focus:outline-none focus:ring-2 focus:ring-forum-500/15"
                placeholder="Search groups..."
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-forum-50/60 text-xs uppercase tracking-wider text-forum-900/55">
                <tr>
                  <th className="p-4">Group</th>
                  <th className="p-4">Members</th>
                  <th className="p-4">Moderators</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-border">
                {filteredGroups.map((group) => (
                  <tr key={group.id} className="align-top">
                    <td className="p-4">
                      <strong className="text-forum-900">{group.name}</strong>
                      <p className="max-w-md text-xs text-forum-900/60">{group.description}</p>
                    </td>
                    <td className="p-4 tabular-nums">{group.memberIds.length}</td>
                    <td className="p-4">
                      {group.moderatorIds
                        .map((id) => state.members.find((m) => m.id === id)?.name)
                        .filter(Boolean)
                        .join(', ') || (
                        <span className="text-forum-900/50">Not assigned</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={
                          group.status === 'active'
                            ? 'inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700 ring-1 ring-inset ring-success-500/20'
                            : 'inline-flex items-center gap-1.5 rounded-full bg-forum-50 px-2.5 py-1 text-[11px] font-semibold text-forum-900/60 ring-1 ring-inset ring-forum-500/15'
                        }
                      >
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                        {group.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditor(group)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          title={group.status === 'active' ? 'Archive group' : 'Reactivate group'}
                          onClick={() =>
                            communityActions.updateGroup(group.id, {
                              status: group.status === 'active' ? 'archived' : 'active',
                            })
                          }
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-danger-600/30 text-danger-600 hover:bg-danger-100"
                          onClick={() => {
                            const ok = window.confirm(
                              `Delete ${group.name}? This will also remove every discussion posted inside it and cannot be undone.`,
                            );
                            if (ok) communityActions.deleteGroup(group.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'connections' && (
        <section className={card}>
          <div className="border-b border-paper-border p-5">
            <h2 className="font-display text-lg font-semibold text-forum-900">
              Member Connections
            </h2>
            <p className="mt-1 text-xs text-forum-900/60">
              Admin can view how members are connected and resolve pending requests
            </p>
          </div>
          <div className="divide-y divide-paper-border">
            {state.connections.length === 0 ? (
              <Empty text="No connection activity yet." />
            ) : (
              state.connections.map((item) => {
                const from = state.members.find((m) => m.id === item.requesterId);
                const to = state.members.find((m) => m.id === item.recipientId);
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-5"
                  >
                    <div>
                      <strong className="text-forum-900">{from?.name ?? 'Unknown member'}</strong>
                      <span className="mx-2 text-forum-900/35">→</span>
                      <strong className="text-forum-900">{to?.name ?? 'Unknown member'}</strong>
                      <p className="text-xs text-forum-900/55">
                        Requested {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs capitalize ${
                          item.status === 'accepted'
                            ? 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-500/20'
                            : item.status === 'pending'
                              ? 'bg-brass-50 text-brass-700 ring-1 ring-inset ring-brass-500/20'
                              : 'bg-forum-50 text-forum-900/60 ring-1 ring-inset ring-forum-500/15'
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              communityActions.decideConnection(item.id, 'accepted')
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              communityActions.decideConnection(item.id, 'rejected')
                            }
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {tab === 'discussions' && (
        <section className={card}>
          <div className="border-b border-paper-border p-5">
            <h2 className="font-display text-lg font-semibold text-forum-900">
              Discussion Moderation
            </h2>
            <p className="mt-1 text-xs text-forum-900/60">
              Replies happen in the member discussion popup; admin can hide or close threads here
            </p>
          </div>
          <div className="divide-y divide-paper-border">
            {state.discussions.length === 0 ? (
              <Empty text="No discussions yet." />
            ) : (
              state.discussions.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center"
                >
                  <div className="min-w-0">
                    <p className="inline-flex items-center rounded-full bg-brass-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brass-700 ring-1 ring-inset ring-brass-500/15">
                      {state.groups.find((g) => g.id === item.groupId)?.name}
                    </p>
                    <h3 className="mt-2 font-semibold text-forum-900">{item.title}</h3>
                    <p className="text-xs text-forum-900/55">
                      {state.members.find((m) => m.id === item.authorId)?.name} ·{' '}
                      {item.replies.length} replies
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="rounded-lg border border-paper-border bg-paper px-3 py-2 text-sm text-forum-900 focus:border-forum-500 focus:outline-none focus:ring-2 focus:ring-forum-500/15"
                      value={item.status}
                      onChange={(e) =>
                        communityActions.moderateDiscussion(
                          item.id,
                          e.target.value as (typeof item)['status'],
                        )
                      }
                    >
                      <option value="published">Published</option>
                      <option value="hidden">Hidden</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {editor && <GroupEditor source={editor} close={() => setEditor(null)} />}
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users;
  value: number;
  label: string;
}) {
  return (
    <div className={`${card} p-5`}>
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brass-50 text-brass-700 ring-1 ring-inset ring-brass-500/15">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 font-display text-2xl font-semibold text-forum-900">{value}</p>
      <p className="mt-0.5 text-xs uppercase tracking-wider text-forum-900/55">{label}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="p-10 text-center text-sm text-forum-900/60">{text}</p>;
}

function GroupEditor({
  source,
  close,
}: {
  source: CommunityGroup | 'new';
  close: () => void;
}) {
  const state = useCommunityStore();
  const current = source === 'new' ? null : source;
  const [form, setForm] = useState({
    name: current?.name ?? '',
    description: current?.description ?? '',
    category: current?.category ?? '',
    memberIds: current?.memberIds ?? [],
    moderatorIds: current?.moderatorIds ?? [],
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const toggle = (field: 'memberIds' | 'moderatorIds', memberId: string) =>
    setForm((value) => ({
      ...value,
      [field]: value[field].includes(memberId)
        ? value[field].filter((id) => id !== memberId)
        : [...value[field], memberId],
      ...(field === 'moderatorIds' && !value.memberIds.includes(memberId)
        ? { memberIds: [...value.memberIds, memberId] }
        : {}),
    }));

  const save = () => {
    if (!form.name.trim() || !form.description.trim()) return;
    if (current) communityActions.updateGroup(current.id, form);
    else communityActions.createGroup(form);
    close();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-forum-900/55 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-paper p-6 shadow-2xl ring-1 ring-inset ring-paper-border sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-forum-900">
              {current ? 'Edit Group' : 'Create Interest Group'}
            </h2>
            <p className="mt-1 text-xs text-forum-900/60">
              Select members who can see and participate in this group
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-lg p-1.5 text-forum-900/60 transition-colors hover:bg-forum-50 hover:text-forum-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-forum-900">
            Group name
            <input
              className="mt-1 w-full rounded-lg border border-paper-border bg-paper p-3 text-sm font-normal text-forum-900 placeholder:text-forum-900/40 focus:border-forum-500 focus:outline-none focus:ring-2 focus:ring-forum-500/15"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium text-forum-900">
            Category
            <input
              className="mt-1 w-full rounded-lg border border-paper-border bg-paper p-3 text-sm font-normal text-forum-900 placeholder:text-forum-900/40 focus:border-forum-500 focus:outline-none focus:ring-2 focus:ring-forum-500/15"
              value={form.category}
              placeholder="Research, Practice, Policy..."
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
        </div>
        <label className="mt-4 block text-sm font-medium text-forum-900">
          Description
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-paper-border bg-paper p-3 text-sm font-normal text-forum-900 placeholder:text-forum-900/40 focus:border-forum-500 focus:outline-none focus:ring-2 focus:ring-forum-500/15"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <div className="mt-5">
          <h3 className="font-semibold text-forum-900">Assign members and moderators</h3>
          <div className="mt-2 max-h-64 divide-y divide-paper-border overflow-auto rounded-xl border border-paper-border bg-paper">
            {state.members.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <strong className="text-sm text-forum-900">{member.name}</strong>
                  <p className="text-xs text-forum-900/60">
                    {member.title} · {member.institution}
                  </p>
                </div>
                <div className="flex gap-4 text-xs text-forum-900/80">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={form.memberIds.includes(member.id)}
                      onChange={() => toggle('memberIds', member.id)}
                      className="h-4 w-4 rounded border-paper-border text-forum-700 focus:ring-forum-500/30"
                    />
                    Member
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={form.moderatorIds.includes(member.id)}
                      onChange={() => toggle('moderatorIds', member.id)}
                      className="h-4 w-4 rounded border-paper-border text-brass-600 focus:ring-brass-500/30"
                    />
                    Moderator
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!form.name.trim() || !form.description.trim()}
            onClick={save}
          >
            Save Group
          </Button>
        </div>
      </div>
    </div>
  );
}
