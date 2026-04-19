import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const payload = req.body;
    console.log('Webhook Payload:', JSON.stringify(payload).substring(0, 100));

    const eventType = payload.event;
    const instanceName = payload.instance;

    // Apenas mensagens novas nos interessam
    if (eventType !== 'messages.upsert') {
      return res.status(200).json({ received: true, ignored: true });
    }

    const messageData = payload.data?.message || payload.data?.messages?.[0];
    if (!messageData) {
      return res.status(200).json({ received: true, ignored: true });
    }

    // Chaves de estado configuradas lá na Vercel
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("Variaveis do Supabase ausentes na Vercel.");
        return res.status(500).json({ error: 'Config error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const remoteJid = messageData.key?.remoteJid || '';
    const isFromMe = messageData.key?.fromMe || false;
    const pushName = messageData.pushName || '';

    // Extrair conteudo
    let content = '';
    const msg = messageData.message || {};
    if (msg.conversation) content = msg.conversation;
    else if (msg.extendedTextMessage?.text) content = msg.extendedTextMessage.text;
    else if (messageData.textMessage?.text) content = messageData.textMessage.text;

    let msgType = messageData.messageType || 'conversation';
    if(msg.imageMessage) msgType = 'imageMessage';
    if(msg.audioMessage) msgType = 'audioMessage';
    if(msg.videoMessage) msgType = 'videoMessage';
    if(msg.documentMessage) msgType = 'documentMessage';

    const timestampStr = messageData.messageTimestamp
      ? new Date(messageData.messageTimestamp * 1000).toISOString()
      : new Date().toISOString();

    // 1. Salva Chat (upsert)
    const { data: chatData, error: chatError } = await supabase
      .from('evo_chats')
      .upsert({
        instance_name: instanceName,
        remote_jid: remoteJid,
        contact_name: pushName,
        last_message_at: timestampStr
      }, { onConflict: 'instance_name, remote_jid' })
      .select('id')
      .single();

    if (chatError || !chatData) {
       console.error('Erro Chat', chatError);
       return res.status(500).json({ error: 'DB Error' });
    }

    // 2. Salva Mensagem (insert)
    const { error: msgErr } = await supabase.from('evo_messages').insert({
      chat_id: chatData.id,
      message_id: messageData.key?.id || String(Date.now()),
      remote_jid: remoteJid,
      is_from_me: isFromMe,
      message_type: msgType,
      text_content: content,
      timestamp: timestampStr
    });

    if (msgErr) console.error('Erro na mensagem:', msgErr);

    return res.status(200).json({ success: true, chat_id: chatData.id });
  } catch (err) {
    console.error('Webhook erro geral:', err);
    return res.status(500).json({ error: err.message });
  }
}
