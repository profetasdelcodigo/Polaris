import type { Session } from '@supabase/supabase-js';

import { apiRequest, streamChat, type SseEvent } from './api';

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  status: 'pending' | 'streaming' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
};

export type MemoryCategory = 'PERSONAL' | 'PREFERENCE' | 'PROJECT' | 'CONTEXT' | 'FACT' | 'GOAL';

export type Memory = {
  id: string;
  category: MemoryCategory;
  content: string;
  importance: number;
  source: string;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  language: 'es' | 'en';
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type Preferences = {
  user_id: string;
  language: 'es' | 'en';
  theme: 'dark' | 'light' | 'system';
  tone: string;
  response_style: string;
  voice_settings: Record<string, unknown>;
  notifications: Record<string, unknown>;
  privacy_settings: Record<string, unknown>;
};

export type Device = {
  id: string;
  client_id: string | null;
  name: string;
  type: 'WEB' | 'ANDROID' | 'DESKTOP' | 'ROBOT';
  platform: string;
  status: 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR';
  last_seen: string | null;
  created_at: string;
};

function token(session: Session): string {
  return session.access_token;
}

export const polarisApi = {
  listConversations: (session: Session) => apiRequest<Conversation[]>('/conversations', token(session)),
  createConversation: (session: Session, title = 'Nueva conversación') =>
    apiRequest<Conversation>('/conversations', token(session), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    }),
  deleteConversation: (session: Session, id: string) =>
    apiRequest<void>(`/conversations/${encodeURIComponent(id)}`, token(session), { method: 'DELETE' }),
  listMessages: (session: Session, conversationId: string) =>
    apiRequest<Message[]>(`/conversations/${encodeURIComponent(conversationId)}/messages`, token(session)),
  listMemories: (session: Session, query?: string) =>
    apiRequest<Memory[]>(
      `/memories${query ? `?q=${encodeURIComponent(query)}` : ''}`,
      token(session),
    ),
  createMemory: (session: Session, memory: Pick<Memory, 'category' | 'content' | 'importance'>) =>
    apiRequest<Memory>('/memories', token(session), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(memory),
    }),
  updateMemory: (session: Session, id: string, memory: Partial<Pick<Memory, 'category' | 'content' | 'importance'>>) =>
    apiRequest<Memory>(`/memories/${encodeURIComponent(id)}`, token(session), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(memory),
    }),
  deleteMemory: (session: Session, id: string) =>
    apiRequest<void>(`/memories/${encodeURIComponent(id)}`, token(session), { method: 'DELETE' }),
  getProfile: (session: Session) => apiRequest<Profile>('/profile', token(session)),
  updateProfile: (session: Session, input: Partial<Pick<Profile, 'display_name' | 'avatar_url' | 'language' | 'timezone'>>) =>
    apiRequest<Profile>('/profile', token(session), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  getPreferences: (session: Session) => apiRequest<Preferences>('/preferences', token(session)),
  updatePreferences: (session: Session, input: Partial<Preferences>) =>
    apiRequest<Preferences>('/preferences', token(session), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  listDevices: (session: Session) => apiRequest<Device[]>('/devices', token(session)),
  registerDevice: (
    session: Session,
    input: {
      clientId: string;
      name: string;
      type: Device['type'];
      platform: string;
      status: Device['status'];
      metadata?: Record<string, unknown>;
    },
  ) =>
    apiRequest<Device>('/devices', token(session), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  streamChat: (
    session: Session,
    input: { conversationId?: string; message: string },
    signal: AbortSignal,
    onEvent: (event: SseEvent) => void,
  ) =>
    streamChat(
      {
        ...input,
        client: {
          platform: 'WEB',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
      token(session),
      signal,
      onEvent,
    ),
};
