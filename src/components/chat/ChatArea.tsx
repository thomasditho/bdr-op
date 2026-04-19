import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { evolutionApi } from '../../lib/api';
import { Send, Loader2, Image as ImageIcon, FileText, Phone, Mic } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export default function ChatArea({ instance, chat }: { instance: string, chat: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const jid = chat?.remoteJid || chat?.id || chat?.remote_jid;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    let unmounted = false;
    if (!jid) return;

    const loadMessages = async () => {
      setLoading(true);
      try {
        console.log('Fetching messages via Evolution Proxy...');
        const data = await evolutionApi.getMessages(instance, jid);
        if (unmounted) return;
        
        let msgs = [];
        if (Array.isArray(data)) {
          msgs = data;
        } else if (data && data.messages) {
          if (data.messages.records && Array.isArray(data.messages.records)) {
            msgs = data.messages.records;
          } else if (Array.isArray(data.messages)) {
            msgs = data.messages;
          }
        } else if (data && data.data && Array.isArray(data.data.messages)) {
          msgs = data.data.messages;
        } else if (data && data.data && Array.isArray(data.data)) {
          msgs = data.data; 
        } else if (data && data.records && Array.isArray(data.records)) {
          msgs = data.records;
        }

        if (msgs.length > 0 && msgs[0].messages && Array.isArray(msgs[0].messages)) {
           msgs = msgs.reduce((acc, curr) => acc.concat(curr.messages || []), []);
        }

        const cleanJid = jid.split('@')[0];
        msgs = msgs.filter((m: any) => {
          const mJid = m.key?.remoteJid || m.remoteJid || m.id || m.remote_jid || '';
          return mJid.includes(cleanJid);
        });

        msgs.sort((a: any, b: any) => {
          const tA = a.messageTimestamp || a.message?.messageTimestamp || a.timestamp || 0;
          const tB = b.messageTimestamp || b.message?.messageTimestamp || b.timestamp || 0;
          return tA - tB;
        });

        setMessages(msgs);
        setTimeout(scrollToBottom, 100);
      } catch (err) {
        console.error('Failed to load messages from Evolution proxy', err);
      } finally {
        if (!unmounted) setLoading(false);
      }
    };

    loadMessages();

    const subscription = supabase
      .channel(`rt_messages_${jid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'evo_messages',
        filter: `remote_jid=eq.${jid}`
      }, () => {
        if (!unmounted) loadMessages();
      })
      .subscribe();

    return () => {
      unmounted = true;
      supabase.removeChannel(subscription);
    };
  }, [instance, jid]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    
    setSending(true);
    const text = inputText;
    setInputText('');

    try {
      const number = jid.split('@')[0];
      await evolutionApi.sendText(instance, number, text);
    } catch (err) {
      console.error('Send error', err);
      setInputText(text); // revert
    } finally {
      setSending(false);
    }
  };

  const getMessageContent = (m: any) => {
    if (m.text_content !== undefined) {
      return { 
        text: m.text_content, 
        type: m.message_type === 'imageMessage' ? 'image' 
             : m.message_type === 'audioMessage' ? 'audio' 
             : m.message_type === 'videoMessage' ? 'video' 
             : m.message_type === 'documentMessage' ? 'document' 
             : 'text',
        url: m.raw_data?.message?.imageMessage?.url || m.raw_data?.message?.audioMessage?.url || m.raw_data?.message?.videoMessage?.url || m.raw_data?.message?.documentMessage?.url || m.raw_data?.url,
        fileName: m.raw_data?.message?.documentMessage?.fileName || 'Documento.pdf'
      };
    }

    let msg = m.message || {};
    if (typeof msg === 'string') {
       try { msg = JSON.parse(msg); } catch (e) { return { text: msg, type: 'text' }; }
    }

    const msgType = m.messageType || m.type;
    const msgContent = msg.imageMessage || msg.audioMessage || msg.videoMessage || msg.documentMessage || msg.extendedTextMessage || msg;

    if (msgType === 'imageMessage' || msg.imageMessage) {
        return { type: 'image', url: msgContent.url, caption: msgContent.caption || '' };
    }
    if (msgType === 'audioMessage' || msg.audioMessage) {
        return { type: 'audio', url: msgContent.url };
    }
    if (msgType === 'videoMessage' || msg.videoMessage) {
        return { type: 'video', url: msgContent.url, caption: msgContent.caption || '' };
    }
    if (msgType === 'documentMessage' || msg.documentMessage) {
        return { type: 'document', text: msgContent.fileName || 'Arquivo', url: msgContent.url };
    }

    if (m.textMessage?.text) return { text: m.textMessage.text, type: 'text' };
    if (typeof m.text === 'string') return { text: m.text, type: 'text' };
    
    if (msg.reactionMessage) return { text: `❤️ [Reação]`, type: 'system', skip: true };
    if (msg.protocolMessage) return { text: `🚫 [Mensagem Apagada]`, type: 'system', skip: true };
    if (msg.senderKeyDistributionMessage) return { skip: true, text: '', type: 'system' };

    let textExtracted = msg.conversation || msg.extendedTextMessage?.text || (typeof msg === 'string' ? msg : '') || m.conversation || '';
    if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
       return { text: textExtracted || (typeof msg === 'object' ? JSON.stringify(msg) : String(msg)), type: 'text' };
    }
    if (textExtracted) return { text: textExtracted, type: 'text' };
    
    if (typeof msg === 'object' && Object.keys(msg).length > 0) {
       return { text: JSON.stringify(msg), type: 'unknown' };
    }

    return { text: '[Tipo de mensagem não suportado]', type: 'unknown' };
  };

  const formatPhone = (phoneJid: string) => {
    if (!phoneJid) return '';
    const num = phoneJid.split('@')[0];
    if (num.startsWith('55') && num.length >= 12) {
      return `+55 (${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
    }
    return `+${num}`;
  };

  const rawNumber = jid?.split('@')[0] || '';
  const rawName = chat.mergedName || chat.contact_name || chat.name || chat.pushName;
  const displayName = (rawName && rawName !== rawNumber) 
    ? rawName 
    : formatPhone(jid || '');
  
  const displayPic = chat.mergedPic || chat.avatar_url || chat.profilePictureUrl || chat.profile_picture_url;

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 h-[72px] bg-bg-panel border-b border-border-dark z-10 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-[#3d3d45] overflow-hidden flex-shrink-0 shadow-sm">
          {displayPic ? (
             <img src={displayPic} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-secondary font-medium text-lg">
               {displayName?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-[15px] text-text-primary leading-tight flex items-center gap-2">
            {displayName}
          </h2>
          <p className="text-[12px] text-accent-green font-mono">{formatPhone(jid || '')}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-6 h-6 text-text-secondary animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary p-4 space-y-4">
             <p className="text-sm opacity-50">Nenhuma mensagem encontrada.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {messages.map((m, idx) => {
                const isMe = Boolean(
                  m.key?.fromMe === true || 
                  m.fromMe === true || 
                  m.is_from_me === true ||
                  (m.message && m.message.key && m.message.key.fromMe === true)
                );
                
                const content = getMessageContent(m);
                const ts = m.messageTimestamp || m.timestamp || m.message?.messageTimestamp;
                
                let time = '';
                if (ts) {
                  try {
                    const numTs = Number(ts);
                    const dateObj = Number.isNaN(numTs) 
                      ? new Date(ts) 
                      : new Date(numTs * (String(numTs).length > 11 ? 1 : 1000));
                      
                    if (!Number.isNaN(dateObj.getTime())) {
                      time = format(dateObj, 'HH:mm');
                    }
                  } catch (e) {}
                }

                if (content.skip) return null;

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    key={m.key?.id || m.id || idx} 
                    className={clsx("flex", isMe ? "justify-end" : "justify-start")}
                  >
                    <div 
                      className={clsx(
                        "max-w-[75%] px-3 py-2 text-[14px] leading-relaxed relative",
                        content.type === 'system'
                          ? "bg-black/20 text-text-secondary rounded-lg text-xs italic border border-white/5"
                          : isMe 
                            ? "bg-msg-sent text-msg-sent-text rounded-xl rounded-br-[2px] shadow-sm" 
                            : "bg-bg-bubble text-text-primary rounded-xl rounded-bl-[2px] shadow-sm border border-white/[0.03]"
                      )}
                    >
                      {content.type === 'image' && (
                        <div className="mb-1 rounded-lg overflow-hidden border border-white/10 group cursor-pointer shadow-inner">
                          {content.url ? (
                            <img 
                              src={content.url} 
                              alt={content.caption || ''} 
                              className="max-h-[300px] w-full object-contain bg-black/40"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="aspect-square bg-black/20 flex flex-col items-center justify-center p-6 gap-2 min-w-[200px]">
                              <ImageIcon className="w-8 h-8 opacity-20" />
                              <span className="text-[10px] opacity-40">Mídia não carregada</span>
                            </div>
                          )}
                          {content.caption && <p className="p-2 text-[13px] bg-black/20">{content.caption}</p>}
                        </div>
                      )}

                      {content.type === 'video' && (
                        <div className="mb-1 rounded-lg overflow-hidden border border-white/10 bg-black/40">
                          {content.url ? (
                            <video controls className="max-h-[300px] w-full">
                              <source src={content.url} type="video/mp4" />
                            </video>
                          ) : (
                            <div className="p-6 text-center text-xs opacity-50 min-w-[200px]">Vídeo indisponível</div>
                          )}
                          {content.caption && <p className="p-2 text-[13px]">{content.caption}</p>}
                        </div>
                      )}

                      {content.type === 'audio' && (
                        <div className={clsx(
                          "mb-1 min-w-[240px] p-2 rounded-lg flex flex-col gap-2",
                          isMe ? "bg-black/20" : "bg-black/10"
                        )}>
                          <div className="flex items-center gap-2">
                             <Mic className={clsx("w-4 h-4", isMe ? "text-accent-green" : "text-accent-blue")} />
                             <audio controls className="w-full h-8 brightness-90 contrast-125">
                                <source src={content.url} type="audio/ogg" />
                                <source src={content.url} type="audio/mpeg" />
                             </audio>
                          </div>
                          <span className="text-[9px] opacity-60 px-1">Mensagem de voz</span>
                        </div>
                      )}

                      {content.type === 'document' && (
                        <a 
                          href={content.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors border border-white/5"
                        >
                          <div className="w-10 h-10 bg-accent-green/20 rounded flex items-center justify-center">
                            <FileText className="w-6 h-6 text-accent-green" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium truncate">{content.text || content.fileName || 'Documento'}</div>
                            <div className="text-[10px] opacity-50">Clique para abrir</div>
                          </div>
                        </a>
                      )}
                      
                      {content.text && content.type === 'text' && (
                        <div className="whitespace-pre-wrap">
                          {typeof content.text === 'object' ? JSON.stringify(content.text) : content.text}
                        </div>
                      )}
                      
                      <div className={clsx("text-[10px] text-right mt-1 opacity-70", isMe ? "text-[#98d9c1]" : "text-text-secondary")}>
                        {time}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-5 bg-bg-panel border-t border-border-dark flex items-center gap-4 shrink-0">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="Digite uma mensagem..."
            className="w-full bg-bg-main border border-border-dark rounded-xl px-5 py-3 text-[14px] text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-green transition-colors"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sending}
          />
        </div>
        {inputText.trim() ? (
          <button 
            className="text-accent-green hover:opacity-80 transition-opacity shrink-0 flex items-center justify-center disabled:opacity-50 h-11 w-11 rounded-full bg-bg-main border border-border-dark"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        ) : (
          <div className="w-11 h-11"></div>
        )}
      </div>
    </div>
  );
}
