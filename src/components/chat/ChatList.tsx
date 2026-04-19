import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { evolutionApi } from '../../lib/api';
import { Search } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

export default function ChatList({ instance, selectedChat, onSelectChat }: { instance: string, selectedChat: any, onSelectChat: (chat: any) => void }) {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let unmounted = false;
    setLoading(true);

    const loadChats = async () => {
      try {
        console.log('Fetching Enriched Chats from Supabase...');
        // Buscamos diretamente do DB o que já foi higienizado pelo Webhook (Fase 1)
        const { data: dbChats, error: dbError } = await supabase
          .from('evo_chats')
          .select('*')
          .eq('instance_name', instance)
          .order('last_message_at', { ascending: false });

        if (dbError) throw dbError;
        
        if (unmounted) return;

        if (dbChats && dbChats.length > 0) {
          // Formata os chats vindos do DB para o formato que o componente espera
          const formatted = dbChats.map((chat: any) => ({
            ...chat,
            mergedName: chat.contact_name,
            mergedPic: chat.avatar_url,
            timestamp: chat.last_message_at
          }));
          setChats(formatted);
        } else {
          // FALLBACK: Se o Supabase estiver vazio, busca direto na Evolution para nao ficar tela vazia
          console.warn('Supabase empty, fetching directly from Evolution API...');
          const evoData = await evolutionApi.getChats(instance);
          const list = Array.isArray(evoData) ? evoData : (evoData?.instances || Object.values(evoData || {}));
          
          if (!unmounted) {
            setChats(list.map((c: any) => ({
              ...c,
              mergedName: c.name || c.pushName || c.id?.split('@')[0],
              mergedPic: c.imgUrl || c.profilePictureUrl,
              timestamp: c.conversationTimestamp || c.updatedAt
            })));
          }
        }
      } catch (err) {
        console.error('Error fetching chats from Supabase', err);
      } finally {
        if (!unmounted) setLoading(false);
      }
    };

    loadChats();

    // Fica de olho no Supabase SOMENTE para atualizacoes em TEMPO REAL (Ja que na vercel socket cai)
    const subscription = supabase
      .channel('evo_chats_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'evo_chats',
        filter: `instance_name=eq.${instance}` 
      }, () => {
        if (!unmounted) loadChats(); // Se chegar mensagem nova no Webhook, recarrega a lista nativa
      })
      .subscribe();

    return () => {
      unmounted = true;
      supabase.removeChannel(subscription);
    };
  }, [instance]);

  const filtered = chats.filter(c => {
    const term = search.toLowerCase();
    const name = (c.contact_name || c.name || c.pushName || c.remoteJid || c.remote_jid || '').toLowerCase();
    return name.includes(term);
  });

  const formatPhone = (jid: string) => {
    if (!jid) return '';
    const num = jid.split('@')[0];
    if (num.startsWith('55') && num.length >= 12) {
      return `+55 (${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
    }
    return `+${num}`;
  };

  if (loading) {
     return <div className="p-4 text-center text-sm text-text-secondary">Puxando histórico da Evolution...</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-panel pt-2">
      <div className="p-4 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary w-4 h-4" />
          <input
            type="text"
            placeholder="Pesquisar..."
            className="w-full bg-bg-main text-text-primary text-sm rounded-lg pl-9 pr-4 py-2.5 outline-none focus:ring-1 focus:ring-accent-green transition-all border border-border-dark placeholder-text-secondary"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {filtered.map(chat => {
          const jid = chat.remoteJid || chat.id || chat.remote_jid;
          if (!jid) return null;

          const isSelected = selectedChat?.id === chat.id || selectedChat?.remoteJid === jid;
          const ts = chat.conversationTimestamp || chat.updatedAt || chat.last_message_at;
          
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

          const rawNumber = jid.split('@')[0];
          
          let rawName = chat.mergedName;
          if (!rawName && chat.messages && chat.messages.length > 0) {
              const firstMsg = chat.messages[0];
              rawName = firstMsg.pushName || firstMsg.profileName || firstMsg.name;
          }
          
          const displayName = (rawName && rawName !== rawNumber) ? rawName : formatPhone(jid);
          const finalPic = chat.mergedPic;
          
          return (
            <div 
              key={jid}
              onClick={() => onSelectChat(chat)}
              className={clsx(
                "flex items-center gap-3 py-4 px-6 cursor-pointer border-b border-white/[0.03] transition-colors",
                isSelected ? "bg-white/5 border-l-[3px] border-l-accent-green pl-[21px]" : "hover:bg-white/[0.02]"
              )}
            >
              <div className="w-12 h-12 rounded-full bg-[#3d3d45] overflow-hidden flex-shrink-0 relative">
                {finalPic ? (
                  <img src={finalPic} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-secondary font-medium text-lg">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-[14px] font-semibold text-text-primary truncate pr-2" title={displayName}>{displayName}</h3>
                  {time && <span className="text-[11px] text-text-secondary flex-shrink-0">{time}</span>}
                </div>
                <p className="text-[13px] text-text-secondary truncate">
                  <span className="opacity-80 font-mono text-[11px]">{formatPhone(jid)}</span>
                </p>
              </div>
              {(chat.unreadCount > 0 || chat.unread_count > 0) && (
                <div className="bg-accent-green text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 min-w-[20px] text-center">
                  {chat.unreadCount || chat.unread_count}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-text-secondary text-sm">
            Nenhuma conversa encontrada.
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="text-[10px] bg-[#101e26] px-2 py-1 rounded border border-[#1a283a] text-[#47a3ff] flex items-center gap-1.5 w-fit">
          <div className="w-1.5 h-1.5 bg-[#47a3ff] rounded-full shadow-[0_0_5px_var(--color-accent-blue)]"></div>
          Evolution Proxy API • Híbrido
        </div>
      </div>
    </div>
  );
}
