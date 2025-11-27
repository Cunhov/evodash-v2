
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
        number: data.number,
        options: { delay: data.delay || 1200 }
      };

      // Add "mentionsEveryOne" if requested
      if (data.mentionsEveryOne) {
          if (config.provider === 'uazapi') {
               // UazApi often expects this inside "options"
               body.options.mentionsEveryOne = true; 
          } else {
               // Evolution v2 often expects this at root or options depending on version
               body.mentionsEveryOne = true; 
          }
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
            media: data.media,
            fileName: data.fileName
          };
          break;

        case 'audio':
          endpoint = '/message/sendWhatsAppAudio';
          body = { ...body, audio: data.audio };
          break;
          
        case 'poll':
          endpoint = '/message/sendPoll';
          body = {
             ...body,
             pollMessage: data.pollMessage,
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

      return fetch(getUrl(endpoint, instance), {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
    },

    // --- Group Methods ---
    fetchGroups: async (instance: string) => {
       // UazApi might use /group/fetchAllGroups/{instance} just like Evo
       const res = await fetch(getUrl('/group/fetchAllGroups', instance) + '?getParticipants=false', { headers });
       return res.json();
    },

    createGroup: async (instance: string, subject: string, participants: string[]) => {
       const res = await fetch(getUrl('/group/create', instance), {
           method: 'POST',
           headers,
           body: JSON.stringify({ subject, participants })
       });
       return res;
    },

    leaveGroup: async (instance: string, groupId: string) => {
       const res = await fetch(getUrl('/group/leaveGroup', instance), {
           method: 'POST',
           headers,
           body: JSON.stringify({ groupId })
       });
       return res;
    },

    getInviteLink: async (instance: string, groupId: string) => {
        const res = await fetch(getUrl(`/group/inviteLink/${instance}/${groupId}`), { headers });
        return res.json();
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
