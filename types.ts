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
  participants?: any[];
  pictureUrl?: string;
}

export interface InstanceState {
  instance: string;
  state: 'open' | 'close' | 'connecting' | 'qrcode';
}

export type MessageType = 'text' | 'media' | 'audio' | 'poll' | 'pix' | 'contact' | 'location';

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

// App Configuration Types
export interface EvoConfig {
  baseUrl: string;
  apiKey: string; // Unified key (Global Key or Instance Token)
  mode: 'global' | 'instance';
  instanceName?: string; // Required if mode === 'instance'
  provider: 'evolution' | 'uazapi';
}

export interface SidebarItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}