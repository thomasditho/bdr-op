import axios from 'axios';

const callApi = async (path: string, method: string = 'GET', data?: any) => {
   const res = await axios({
      url: `/api/proxy?path=${encodeURIComponent(path)}`,
      method,
      data
   });
   return res.data;
};

export const evolutionApi = {
  getInstances: () => callApi('/instance/fetchInstances'),
  
  // These reads won't be used by UI anymore since Supabase takes over, but kept for Fallback
  getChats: (instance: string) => callApi(`/chat/findChats/${instance}`, 'POST', {}),
  getContacts: (instance: string) => callApi(`/chat/findContacts/${instance}`, 'POST', {}),
  
  getMessages: (instance: string, remoteJid: string, page = 1) => 
     callApi(`/chat/findMessages/${instance}`, 'POST', { where: { remoteJid }, page, limit: 50 }),

  sendText: (instance: string, number: string, text: string) => 
     callApi(`/message/sendText/${instance}`, 'POST', { number, text }),

  sendMedia: (instance: string, number: string, mediaType: string, mediaBase64: string, fileName?: string, caption?: string) => 
     callApi(`/message/sendMedia/${instance}`, 'POST', {
         number,
         mediatype: mediaType,
         mimetype: 'application/octet-stream',
         media: mediaBase64,
         fileName,
         caption
     }),

  connectInstance: (instance: string) => callApi(`/instance/connect/${instance}`),
  deleteInstance: (instance: string) => callApi(`/instance/delete/${instance}`, 'DELETE'),
  logoutInstance: (instance: string) => callApi(`/instance/logout/${instance}`, 'DELETE')
};
