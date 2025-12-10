import React from 'react';

// EvolutionAPI specific types
export interface EvolutionInstance {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
    owner: string;
    profileName: string;
    profilePictureUrl?: string;
  };
  hash?: {
    apikey: string;
  };
}

export interface GroupParticipant {
  id: string;
  admin?: boolean;
  superadmin?: boolean;
}

export interface Group {
  id: string;
  subject: string;
  subjectOwner?: string;
  subjectTime?: number;
  size?: number;
  creation?: number;
  owner?: string;
  desc?: string;
  restrict?: boolean;
  announce?: boolean;
  ephemeral?: number;
  participants?: GroupParticipant[];
  pictureUrl?: string;
  inviteCode?: string;
}

export interface InstanceState {
  instance: string;
  state: 'open' | 'close' | 'connecting' | 'qrcode';
}

export type MessageType = 'text' | 'media' | 'audio' | 'poll' | 'pix' | 'contact' | 'location' | 'group_action';

export interface ProxyConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  username?: string;
  password?: string;
}

// Flat Payload Structures for EvolutionAPI v2
export interface TextMessagePayload {
  number: string;
  text: string;
  delay: number;
  linkPreview: boolean;
  mentionsEveryOne?: boolean;
}

export interface MediaMessagePayload {
  number: string;
  mediatype: 'image' | 'video' | 'document';
  mimetype: string;
  caption?: string;
  media: string; // Base64 or URL
  fileName: string;
  delay: number;
}

export interface AudioMessagePayload {
  number: string;
  audio: string; // Base64 or URL
  delay: number;
}

export interface BatchPayload {
  batchId?: string;
  masterText?: string;
  chunkIndex?: number;
  totalChunks?: number;
}

// App Configuration Types

export interface Contact {
  id: string;
  user_id?: string;
  phone: string;
  name?: string;
  email?: string;
  tags?: string[];
  notes?: string;
  created_at?: string;
}

export interface EvoConfig {
  baseUrl: string;
  apiKey: string; // Unified key (Global Key or Instance Token)
  mode?: 'instance' | 'global';
  instanceName?: string; // Required if mode === 'instance'
  provider?: 'evolution' | 'uazapi';
}

export interface SidebarItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

export interface Schedule {
  id?: number;
  text: string;
  enviar_em: string;
  instance: string;
  api_key: string;
  group_filter: string;
  min_size_group: number;
  mention_everyone: boolean;
  status: 'pending' | 'sent' | 'failed' | 'cancelled' | 'draft';
  enviado_em?: string;
  midia?: string;
  error_message?: string;
  type: MessageType;
  payload?: any;
  recurrence_rule?: string; // 'daily' | 'weekly' | 'monthly'
  parent_schedule_id?: number | null;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  type: string;
  created_at: string;
}