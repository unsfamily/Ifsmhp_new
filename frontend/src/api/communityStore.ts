import { useEffect, useState } from 'react';

export type MemberRole = 'Scientist' | 'Mental Health Professional';
export type ConnectionStatus = 'none' | 'pending' | 'connected';

export interface CommunityMember {
  id: string;
  name: string;
  title: string;
  institution: string;
  country: string;
  role: MemberRole;
  interests: string[];
  online: boolean;
}

export interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  category: string;
  memberIds: string[];
  moderatorIds: string[];
  status: 'active' | 'archived';
  createdAt: string;
}

export interface Connection {
  id: string;
  requesterId: string;
  recipientId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Reply {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Discussion {
  id: string;
  groupId: string;
  authorId: string;
  title: string;
  body: string;
  status: 'published' | 'hidden' | 'closed';
  replies: Reply[];
  createdAt: string;
}

export interface CommunityState {
  members: CommunityMember[];
  groups: CommunityGroup[];
  connections: Connection[];
  discussions: Discussion[];
}

const STORAGE_KEY = 'ifsmhp-community-frontend-v1';
const CHANGE_EVENT = 'ifsmhp-community-change';

const now = new Date().toISOString();
const seed: CommunityState = {
  members: [
    { id: 'm1', name: 'Dr. Jane Researcher', title: 'Clinical Researcher', institution: 'IFSMHP', country: 'India', role: 'Scientist', interests: ['Clinical Research', 'Mental Health'], online: true },
    { id: 'm2', name: 'Dr. Maya Chen', title: 'Neuroscience Researcher', institution: 'Global Brain Institute', country: 'Singapore', role: 'Scientist', interests: ['Neuroscience', 'AI in Health'], online: true },
    { id: 'm3', name: 'Prof. David Wilson', title: 'Clinical Psychologist', institution: 'Wellbeing University', country: 'United Kingdom', role: 'Mental Health Professional', interests: ['Clinical Practice', 'Youth Mental Health'], online: false },
    { id: 'm4', name: 'Dr. Asha Rao', title: 'Public Health Specialist', institution: 'Community Health Centre', country: 'India', role: 'Mental Health Professional', interests: ['Public Health', 'Research Ethics'], online: true },
  ],
  groups: [
    { id: 'g1', name: 'Clinical Research Network', description: 'Research methods, ethics, collaboration and publication support.', category: 'Research', memberIds: ['m1', 'm2', 'm4'], moderatorIds: ['m2'], status: 'active', createdAt: now },
    { id: 'g2', name: 'Mental Health Practice', description: 'Professional exchange for evidence-based mental-health practice.', category: 'Practice', memberIds: ['m1', 'm3'], moderatorIds: ['m3'], status: 'active', createdAt: now },
  ],
  connections: [
    { id: 'c1', requesterId: 'm2', recipientId: 'm1', status: 'pending', createdAt: now },
  ],
  discussions: [
    { id: 'd1', groupId: 'g1', authorId: 'm2', title: 'How can we improve multi-country research collaboration?', body: 'Please share practical approaches for coordinating protocols, ethics and authorship.', status: 'published', createdAt: now, replies: [] },
  ],
};

function copySeed(): CommunityState {
  return JSON.parse(JSON.stringify(seed)) as CommunityState;
}

export function readCommunity(): CommunityState {
  if (typeof window === 'undefined') return copySeed();
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return copySeed();
  }
  try { return JSON.parse(saved) as CommunityState; }
  catch { return copySeed(); }
}

function writeCommunity(next: CommunityState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function updateCommunity(change: (current: CommunityState) => CommunityState) {
  const next = change(readCommunity());
  writeCommunity(next);
  return next;
}

export function useCommunityStore() {
  const [state, setState] = useState<CommunityState>(() => readCommunity());
  useEffect(() => {
    const sync = () => setState(readCommunity());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return state;
}

const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const communityActions = {
  reset: () => writeCommunity(copySeed()),

  createGroup(input: Pick<CommunityGroup, 'name' | 'description' | 'category' | 'memberIds' | 'moderatorIds'>) {
    updateCommunity((state) => ({ ...state, groups: [{ ...input, id: id('group'), status: 'active', createdAt: new Date().toISOString() }, ...state.groups] }));
  },

  updateGroup(groupId: string, patch: Partial<CommunityGroup>) {
    updateCommunity((state) => ({ ...state, groups: state.groups.map((group) => group.id === groupId ? { ...group, ...patch, id: group.id } : group) }));
  },

  deleteGroup(groupId: string) {
    updateCommunity((state) => ({ ...state, groups: state.groups.filter((group) => group.id !== groupId), discussions: state.discussions.filter((discussion) => discussion.groupId !== groupId) }));
  },

  joinGroup(groupId: string, memberId: string) {
    updateCommunity((state) => ({ ...state, groups: state.groups.map((group) => group.id === groupId && !group.memberIds.includes(memberId) ? { ...group, memberIds: [...group.memberIds, memberId] } : group) }));
  },

  leaveGroup(groupId: string, memberId: string) {
    updateCommunity((state) => ({ ...state, groups: state.groups.map((group) => group.id === groupId ? { ...group, memberIds: group.memberIds.filter((value) => value !== memberId), moderatorIds: group.moderatorIds.filter((value) => value !== memberId) } : group) }));
  },

  requestConnection(requesterId: string, recipientId: string) {
    updateCommunity((state) => {
      const exists = state.connections.some((item) => [item.requesterId, item.recipientId].includes(requesterId) && [item.requesterId, item.recipientId].includes(recipientId));
      if (exists) return state;
      return { ...state, connections: [{ id: id('connection'), requesterId, recipientId, status: 'pending', createdAt: new Date().toISOString() }, ...state.connections] };
    });
  },

  decideConnection(connectionId: string, status: 'accepted' | 'rejected') {
    updateCommunity((state) => ({ ...state, connections: state.connections.map((item) => item.id === connectionId ? { ...item, status } : item) }));
  },

  createDiscussion(input: Pick<Discussion, 'groupId' | 'authorId' | 'title' | 'body'>) {
    updateCommunity((state) => ({ ...state, discussions: [{ ...input, id: id('discussion'), status: 'published', replies: [], createdAt: new Date().toISOString() }, ...state.discussions] }));
  },

  reply(discussionId: string, authorId: string, body: string) {
    updateCommunity((state) => ({ ...state, discussions: state.discussions.map((discussion) => discussion.id === discussionId ? { ...discussion, replies: [...discussion.replies, { id: id('reply'), authorId, body, createdAt: new Date().toISOString() }] } : discussion) }));
  },

  moderateDiscussion(discussionId: string, status: Discussion['status']) {
    updateCommunity((state) => ({ ...state, discussions: state.discussions.map((discussion) => discussion.id === discussionId ? { ...discussion, status } : discussion) }));
  },
};

export function connectionStatus(state: CommunityState, currentUserId: string, otherId: string): ConnectionStatus {
  const connection = state.connections.find((item) => [item.requesterId, item.recipientId].includes(currentUserId) && [item.requesterId, item.recipientId].includes(otherId));
  if (!connection || connection.status === 'rejected') return 'none';
  return connection.status === 'accepted' ? 'connected' : 'pending';
}
