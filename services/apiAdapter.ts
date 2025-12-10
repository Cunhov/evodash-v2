
import { EvoConfig, MessageType } from '../types';

export const getApiClient = (config: EvoConfig) => {
  const headers = {
    'apikey': config.apiKey,
    'Content-Type': 'application/json'
  };

  const getUrl = (path: string, instance?: string) => {
    // Clean base URL
    const base = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;

    // UazApi sometimes uses different base paths or versioning, adjust here if needed.
    // For now, we assume standard Evolution-like paths as UazApi is a fork.

    if (config.provider === 'uazapi') {
      // Example: If UazApi uses /message/text instead of /message/sendText
      // You can add specific overrides here.
      // if (path.includes('sendText')) return `${base}/message/text/${instance}`;
    }

    return instance
      ? `${base}${path}/${instance}`
      : `${base}${path}`;
  };

  return {
    // --- Instance Methods ---
    fetchInstances: async () => {
      const res = await fetch(getUrl('/instance/fetchInstances'), { headers });
      return res.json();
    },

    createInstance: async (name: string) => {
      const payload = {
        instanceName: name,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      };

      const res = await fetch(getUrl('/instance/create'), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      return res;
    },

    connectInstance: async (instance: string) => {
      const res = await fetch(getUrl('/instance/connect', instance), { headers });
      return res.json();
    },

    logoutInstance: async (instance: string) => {
      return fetch(getUrl('/instance/logout', instance), { method: 'DELETE', headers });
    },

    deleteInstance: async (instance: string) => {
      return fetch(getUrl('/instance/delete', instance), { method: 'DELETE', headers });
    },

    fetchConnectionState: async (instance: string) => {
      const res = await fetch(getUrl('/instance/connectionState', instance), { headers });
      return res.json();
    },

    // --- Message Methods ---
    sendMessage: async (instance: string, type: MessageType, data: any) => {
      let endpoint = '';
      let body: any = {
        number: data.number
      };

      if (config.provider === 'uazapi') {
        body.options = {
          delay: data.delay || 1200,
          mentionsEveryOne: data.mentionsEveryOne || false
        };
      } else {
        // Standard Evolution v2 (based on user docs)
        body.delay = data.delay || 1200;
        if (data.mentionsEveryOne) body.mentionsEveryOne = true;
      }

      switch (type) {
        case 'text':
          endpoint = '/message/sendText';
          // Payload differences handled here
          if (config.provider === 'uazapi') {
            // Some UazApi versions prefer { textMessage: { text: ... } }
            // But most modern forks match Evo v2 flat structure. 
            // We use the flat structure as default for both.
            body.text = data.text;
          } else {
            body.text = data.text;
          }
          break;

        case 'media':
          endpoint = '/message/sendMedia';
          body = {
            ...body,
            mediatype: data.mediatype,
            mimetype: data.mimetype,
            caption: data.caption,
            media: data.media ? data.media.replace(/^data:.*,/, '') : '',
            fileName: data.fileName
          };
          break;

        case 'audio':
          endpoint = '/message/sendWhatsAppAudio';
          body = { ...body, audio: data.audio ? data.audio.replace(/^data:.*,/, '') : '' };
          break;

        case 'poll':
          endpoint = '/message/sendPoll';
          // Spread pollMessage properties to root for standard Evo v2
          body = {
            ...body,
            ...data.pollMessage,
          };
          break;

        case 'location':
          endpoint = '/message/sendLocation';
          body = { ...body, locationMessage: data.locationMessage };
          break;

        case 'contact':
          endpoint = '/message/sendContact';
          body = { ...body, contactMessage: data.contactMessage };
          break;

        case 'pix':
          endpoint = '/message/sendPix';
          body = { ...body, pixMessage: data.pixMessage };
          break;
      }

      console.log(`[API] calling ${endpoint} with body:`, JSON.stringify(body, null, 2));
      return fetch(getUrl(endpoint, instance), {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
    },

    // --- Group Methods ---

    // 10. Buscar Todos os Grupos (Updated to /group/findAll)
    fetchGroups: async (instance: string) => {
      const res = await fetch(getUrl('/group/fetchAllGroups', instance) + '?getParticipants=false', { headers });
      return res.json();
    },

    // 1. Criar Grupo
    createGroup: async (instance: string, subject: string, participants: string[]) => {
      const res = await fetch(getUrl('/group/create', instance), {
        method: 'POST',
        headers,
        body: JSON.stringify({ subject, participants, description: "" })
      });
      return res;
    },

    // 2. Atualizar Foto do Grupo
    updateGroupPicture: async (instance: string, groupJid: string, imageBase64: string) => {
      const res = await fetch(getUrl('/group/updateGroupPicture', instance), {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupJid, image: imageBase64 })
      });
      return res;
    },

    // 3. Atualizar Assunto do Grupo
    updateGroupSubject: async (instance: string, groupJid: string, subject: string) => {
      const res = await fetch(getUrl('/group/updateGroupSubject', instance), {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupJid, subject })
      });
      return res;
    },

    // 4. Atualizar Descrição do Grupo
    updateGroupDescription: async (instance: string, groupJid: string, description: string) => {
      const res = await fetch(getUrl('/group/updateGroupDescription', instance), {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupJid, description })
      });
      return res;
    },

    // 5. Buscar Código de Convite
    getInviteCode: async (instance: string, groupJid: string) => {
      const res = await fetch(getUrl(`/group/inviteCode/${instance}?groupJid=${groupJid}`), { headers });
      return res.json();
    },

    // 6. Revogar Código de Convite
    revokeInviteCode: async (instance: string, groupJid: string) => {
      const res = await fetch(getUrl('/group/revokeInviteCode', instance), {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupJid })
      });
      return res;
    },

    // 7. Enviar Convite para Número(s)
    sendInvite: async (instance: string, groupJid: string, numbers: string[]) => {
      const res = await fetch(getUrl('/group/sendInvite', instance), {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupJid, numbers })
      });
      return res;
    },

    // 8. Encontrar Grupo pelo Código de Convite
    getInviteInfo: async (instance: string, inviteCode: string) => {
      const res = await fetch(getUrl(`/group/inviteInfo/${instance}?inviteCode=${inviteCode}`), { headers });
      return res.json();
    },

    // 9. Encontrar Grupo pelo JID
    getGroupInfo: async (instance: string, groupJid: string) => {
      const res = await fetch(getUrl(`/group/jidInfo/${instance}?groupJid=${groupJid}`), { headers });
      return res.json();
    },

    // 11. Buscar Membros do Grupo
    fetchGroupParticipants: async (instance: string, groupJid: string) => {
      const res = await fetch(getUrl(`/group/participants/${instance}?groupJid=${groupJid}`), { headers });
      return res.json();
    },

    // 12. Atualizar Participantes
    updateParticipant: async (instance: string, groupJid: string, action: 'add' | 'remove' | 'promote' | 'demote', participants: string[]) => {
      const res = await fetch(getUrl('/group/updateParticipant', instance), {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupJid, action, participants })
      });
      return res;
    },

    // 13. Atualizar Configurações do Grupo
    updateGroupSetting: async (instance: string, groupJid: string, action: 'announcement' | 'not_announcement' | 'locked' | 'unlocked') => {
      const res = await fetch(getUrl(`/group/updateSetting/${instance}?groupJid=${groupJid}`), {
        method: 'POST',
        headers,
        body: JSON.stringify({ action })
      });
      return res;
    },

    // 14. Alternar Mensagens Temporárias (Ephemeral)
    toggleEphemeral: async (instance: string, groupJid: string, expiration: number) => { // 0 to disable, or seconds 86400, 604800, 7776000
      const res = await fetch(getUrl('/group/toggleEphemeral', instance), {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupJid, expiration })
      });
      return res;
    },

    // 15. Sair do Grupo
    leaveGroup: async (instance: string, groupId: string) => {
      const res = await fetch(getUrl('/group/leaveGroup', instance), {
        method: 'DELETE', // CHANGED TO DELETE
        headers,
        body: JSON.stringify({ groupJid: groupId })
      });
      return res;
    },

    // Legacy method map (optional, can keep for backward compat or remove)
    getInviteLink: async (instance: string, groupId: string) => {
      // Mapped to getInviteCode for compatibility
      return fetch(getUrl(`/group/inviteCode/${instance}?groupJid=${groupId}`), { headers }).then(r => r.json());
    },

    // --- Chat Tools ---
    checkNumber: async (instance: string, number: string) => {
      const res = await fetch(getUrl('/chat/checkNumber', instance), {
        method: 'POST',
        headers,
        body: JSON.stringify({ numbers: [number] })
      });
      return res.json();
    },

    getProfilePic: async (instance: string, number: string) => {
      const res = await fetch(getUrl('/chat/fetchProfilePictureUrl', instance), {
        method: 'POST',
        headers,
        body: JSON.stringify({ number })
      });
      return res.json();
    },

    archiveChat: async (instance: string, number: string) => {
      const res = await fetch(getUrl('/chat/archiveChat', instance), {
        method: 'POST',
        headers,
        body: JSON.stringify({ number })
      });
      return res.json();
    },

    blockContact: async (instance: string, number: string) => {
      const res = await fetch(getUrl('/chat/blockContact', instance), {
        method: 'POST',
        headers,
        body: JSON.stringify({ number })
      });
      return res.json();
    }
  };
};
