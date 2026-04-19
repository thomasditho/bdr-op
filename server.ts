import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EVOLUTION_API_URL = 'https://dithosolucoestech.up.railway.app';
const API_KEY = 'Dithosolucoes324911@';

// Supabase Configuration
const supabaseUrl = 'https://ifxbrtlelvmnckicscwi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmeGJydGxlbHZtbmNraWNzY3dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzE0OTAsImV4cCI6MjA5MDY0NzQ5MH0.9JMwkQXbpUZWK4w7-wsVdjlaFEuvejqYPtZCVpRPV9I';
const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  app.use(cors());
  
  // Use multer for multipart form data (for sending media)
  const upload = multer({ storage: multer.memoryStorage() });

  // Webhook endpoint to receive real-time data from Evolution API and save to Supabase
  app.post('/api/webhook/evolution', express.json({ limit: '50mb' }), async (req, res) => {
    try {
      const payload = req.body;
      const { event, data, instance } = payload;
      
      // Emit strictly for raw debugging if needed
      io.emit('evolution_event', { event, data, instance });

      if (event === 'messages.upsert' && data?.messages && Array.isArray(data.messages)) {
        for (const m of data.messages) {
           const remoteJid = m.key?.remoteJid || m.remoteJid || '';
           if (!remoteJid || remoteJid === 'status@broadcast') continue;

           // Ignore system objects dynamically like handled in the front 
           let msgPayload = m.message || {};
           if (typeof msgPayload === 'string') {
              try { msgPayload = JSON.parse(msgPayload); } catch(e){}
           }
           if (msgPayload.reactionMessage || msgPayload.protocolMessage || msgPayload.senderKeyDistributionMessage) {
              continue;
           }

           const contactName = m.pushName || m.pushname || m.name || remoteJid.split('@')[0];
           const timestampMs = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
           const lastMsgDate = new Date(timestampMs).toISOString();

           // 1. Identificar se já existe o contato para não sobrescrever nome bom por JID/Número
           const { data: existingChat } = await supabase
             .from('evo_chats')
             .select('contact_name, avatar_url')
             .eq('instance_name', instance || 'Evolution')
             .eq('remote_jid', remoteJid)
             .single();

           let finalName = contactName;
           // Se o nome novo parecer um número/JID e já tivermos um nome amigável, mantém o antigo
           if (existingChat?.contact_name && (contactName.includes('@') || !isNaN(Number(contactName)))) {
              finalName = existingChat.contact_name;
           }

           // 2. Upsert Chat
           const { data: chatData, error: chatError } = await supabase
             .from('evo_chats')
             .upsert({
               instance_name: instance || 'Evolution',
               remote_jid: remoteJid,
               contact_name: finalName,
               last_message_at: lastMsgDate
             }, { onConflict: 'instance_name, remote_jid' })
             .select('id')
             .single();

           if (chatError || !chatData) {
             console.error('[Supabase] Failed to upsert chart:', chatError);
             continue;
           }

           // 3. Proactive Enrichment: Se não tiver avatar, tenta buscar
           if (!existingChat?.avatar_url) {
              try {
                const profileResp = await axios.post(`${EVOLUTION_API_URL}/chat/getBase64ProfilePicture/${instance}`, {
                  number: remoteJid
                }, { headers: { 'apikey': API_KEY } });
                
                if (profileResp.data?.picture) {
                   await supabase.from('evo_chats').update({
                     avatar_url: profileResp.data.picture
                   }).eq('id', chatData.id);
                   console.log(`[Enrichment] Avatar updated for ${remoteJid}`);
                }
              } catch (e) {
                // Silently fail enrichment
              }
           }

           // 4. Extract Text safely
           const textExtracted = msgPayload?.conversation || msgPayload?.extendedTextMessage?.text || (typeof msgPayload === 'string' ? msgPayload : '') || m.conversation || '';
           
           const messageId = m.key?.id || m.id;
           const isFromMe = m.key?.fromMe ?? m.fromMe ?? false;
           const messageType = m.messageType || 'conversation';

           // 5. Upsert Message
           const { error: msgError } = await supabase
             .from('evo_messages')
             .upsert({
               chat_id: chatData.id,
               evolution_message_id: messageId,
               text_content: textExtracted || JSON.stringify(msgPayload),
               message_type: messageType,
               is_from_me: isFromMe,
               timestamp: lastMsgDate,
               raw_data: m
             }, { onConflict: 'evolution_message_id' });

           if (msgError) {
              console.error('[Supabase] Failed to upsert message:', msgError);
           } else {
              console.log(`[Supabase] Message ${messageId} saved!`);
           }
        }
      }
      res.status(200).send('OK');
    } catch (e) {
      console.error('[Webhook] Processing error:', e);
      res.status(500).send('Error Processing Webhook');
    }
  });

  // REST endpoints for the UI to talk to Evolution API securely
  app.use(express.json({ limit: '50mb' }));

  const setupProxyRoute = (path: string, method: 'GET' | 'POST' | 'DELETE') => {
    app[method.toLowerCase() as 'get' | 'post' | 'delete'](`/api/evolution${path}`, async (req, res) => {
      try {
        const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
        const fullUrl = `${EVOLUTION_API_URL}${req.path.replace('/api/evolution', '')}${queryParams ? `?${queryParams}` : ''}`;
        
        const response = await axios({
          method,
          url: fullUrl,
          data: req.body,
          headers: {
            'apikey': API_KEY,
            'Content-Type': 'application/json'
          }
        });
        
        if (req.path.includes('/chat/findMessages')) {
           console.log(`[findMessages API Response] URL: ${fullUrl}`);
           console.log(`[findMessages API Response] Data: ${JSON.stringify(response.data).substring(0, 1000)}`);
        }

        res.status(response.status).json(response.data);
      } catch (error: any) {
        console.error(`Evolution API Proxy Error (${method} ${path}):`, error?.response?.data || error.message);
        res.status(error?.response?.status || 500).json(error?.response?.data || { error: 'Internal Server Error' });
      }
    });
  };

  // Specific Routes definition for Evolution API matching common paths
  // Instances
  setupProxyRoute('/instance/fetchInstances', 'GET');
  setupProxyRoute('/instance/create', 'POST');
  setupProxyRoute('/instance/logout/:instance', 'DELETE');
  setupProxyRoute('/instance/connectionState/:instance', 'GET');

  // Chats
  setupProxyRoute('/chat/findChats/:instance', 'POST');
  setupProxyRoute('/chat/findChats/:instance', 'GET');
  setupProxyRoute('/chat/findMessages/:instance', 'POST');
  setupProxyRoute('/chat/getBase64ProfilePicture/:instance', 'POST');
  
  // Messages
  setupProxyRoute('/message/sendText/:instance', 'POST');
  setupProxyRoute('/message/sendMedia/:instance', 'POST');

  // Any other routes proxy
  app.all('/api/evolution/*', async (req, res) => {
    try {
      const fullUrl = `${EVOLUTION_API_URL}${req.path.replace('/api/evolution', '')}`;
      const response = await axios({
        method: req.method,
        url: fullUrl,
        data: req.body,
        params: req.query,
        headers: {
          'apikey': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      if (req.path.includes('/chat/findMessages')) {
         console.log(`[findMessages GET Fallback] URL: ${fullUrl}`);
         console.log(`[findMessages GET Fallback] Data: ${JSON.stringify(response.data).substring(0, 1000)}`);
      }

      res.status(response.status).json(response.data);
    } catch (e: any) {
      res.status(e?.response?.status || 500).json(e?.response?.data || { error: 'Proxy failed' });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on port ${PORT}`);
  });
}

startServer();
