import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { evolutionApi } from '../../lib/api';
import { Search, RefreshCw, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

const formatPhone = (jid: string) => {
  if (!jid) return '';
  const num = jid.split('@')[0];
  if (num.startsWith('55') && num.length >= 12) {
    return `+55 (${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
  }
  return `+${num}`;
};

function ChatItem({ chat, instance, isSelected, onClick }: { chat: any, instance: string, isSelected: boolean, onClick: () => void }) {
  const [pic, setPic] = useState(chat.mergedPic || chat.avatar_url || chat.picUrl);
  const jid = chat.remoteJid || chat.id || chat.remote_jid;
  
  // Melhoria na Resolucao de Nome: Tenta priorizar nomes reais
  const displayName = chat.mergedName || chat.contact_name || chat.name || chat.pushName || chat.verifiedName || formatPhone(jid);

  useEffect(() => {
    let active = true;
    if (!pic && jid && instance) {
       // Tenta buscar a foto proativamente se nao existir
       evolutionApi.getProfilePic(instance, jid).then(res => {
         if (active && res && res.picture) setPic(res.picture);
       }).catch(() => {});
    }
    return () => { active = false; };
  }, [jid, instance, pic]);

  const ts = chat.conversationTimestamp || chat.updatedAt || chat.last_message_at;
  let time = '';
  if (ts) {
    try {
      const numTs = Number(ts);
      const dateObj = Number.isNaN(numTs) 
        ? new Date(ts) 
        : new Date(numTs * (String(numTs).length > 11 ? 1 : 1000));
      if (!Number.isNaN(dateObj.getTime())) time = format(dateObj, 'HH:mm');
    } catch (e) {}
  }

  return (
    <div 
      onClick={onClick}
      className={clsx(
        "flex items-center gap-3 py-4 px-6 cursor-pointer border-b border-white/[0.03] transition-colors",
        isSelected ? "bg-white/5 border-l-[3px] border-l-accent-green pl-[21px]" : "hover:bg-white/[0.02]"
      )}
    >
      <div className="w-12 h-12 rounded-full bg-[#3d3d45] overflow-hidden flex-shrink-0 relative">
        {pic ? (
          <img src={pic} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
}

export default function ChatList({ instance, selectedChat, onSelectChat }: { instance: string, selectedChat: any, onSelectChat: (chat: any) => void }) {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [search, setSearch] = useState('');

  const loadChats = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: dbChats, error: dbError } = await supabase
        .from('evo_chats')
        .select('*')
        .eq('instance_name', instance)
        .order('last_message_at', { ascending: false });

      if (dbError) throw dbError;
      
      if (dbChats && dbChats.length > 0) {
        setChats(dbChats.map((chat: any) => ({
          ...chat,
          mergedName: chat.contact_name,
          mergedPic: chat.avatar_url,
          timestamp: chat.last_message_at
        })));
      } else {
        const evoData = await evolutionApi.getChats(instance);
        const list = Array.isArray(evoData) ? evoData : (evoData?.instances || Object.values(evoData || {}));
        
        setChats(list.map((c: any) => {
          const jid = c.id || c.remoteJid || c.key?.remoteJid;
          const rawNumber = jid?.split('@')[0] || '';
          const bestName = c.name || c.pushName || c.verifiedName || c.vcard?.name;
          
          return {
            ...c,
            remote_jid: jid,
            mergedName: (bestName && bestName !== rawNumber) ? bestName : null,
            mergedPic: c.imgUrl || c.profilePictureUrl || c.picUrl,
            timestamp: c.conversationTimestamp || c.updatedAt
          };
        }));
      }
    } catch (err) {
      console.error('Error fetching chats', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadChats();
    const subscription = supabase
      .channel(`chats_${instance}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'evo_chats',
        filter: `instance_name=eq.${instance}` 
      }, () => loadChats(true))
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [instance]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncDone(false);
    
    try {
      console.log('Iniciando Sincronizacao de Agenda...');
      const contacts = await evolutionApi.getContacts(instance);
      const contactList = Array.isArray(contacts) ? contacts : (contacts?.records || []);
      
      if (contactList.length > 0) {
        // Prepara os dados para upsert em massa (fatiado para evitar estouro)
        const batchSize = 50;
        for (let i = 0; i < contactList.length; i += batchSize) {
          const batch = contactList.slice(i, i + batchSize).map((c: any) => ({
            instance_name: instance,
            remote_jid: c.id || c.remoteJid,
            contact_name: c.name || c.pushName || c.verifiedName || null,
            avatar_url: c.profilePictureUrl || c.imgUrl || null,
            last_message_at: new Date().toISOString()
          })).filter((item: any) => item.remote_jid);

          if (batch.length > 0) {
            await supabase.from('evo_chats').upsert(batch, { onConflict: 'instance_name, remote_jid' });
          }
        }
      }
      
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 3000);
      await loadChats(true);
    } catch (err) {
      console.error('Erro na sincronizacao', err);
    } finally {
      setSyncing(false);
    }
  };

  const filtered = chats.filter(c => {
    const term = search.toLowerCase();
    const name = (c.contact_name || c.name || c.pushName || c.remote_jid || '').toLowerCase();
    return name.includes(term);
  });

  if (loading) {
     return <div className="p-4 text-center text-sm text-text-secondary">Puxando histórico...</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-panel pt-2">
      <div className="px-4 py-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary w-4 h-4" />
          <input
            type="text"
            placeholder="Pesquisar..."
            className="w-full bg-bg-main text-text-primary text-sm rounded-lg pl-9 pr-4 py-2 outline-none focus:ring-1 focus:ring-accent-green transition-all border border-border-dark"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button 
          onClick={handleSync}
          disabled={syncing}
          className={clsx(
            "p-2.5 rounded-lg border border-border-dark transition-all flex-shrink-0",
            syncDone ? "bg-accent-green/20 border-accent-green/30 text-accent-green" : "bg-bg-main hover:bg-white/5 text-text-secondary hover:text-text-primary"
          )}
          title="Sincronizar Agenda"
        >
          {syncing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : syncDone ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.map((chat, idx) => {
          const jid = chat.remoteJid || chat.id || chat.remote_jid;
          if (!jid) return null;
          const isSelected = selectedChat?.id === chat.id || selectedChat?.remoteJid === jid;
          return (
            <ChatItem 
              key={jid || idx}
              chat={chat}
              instance={instance}
              isSelected={isSelected}
              onClick={() => onSelectChat(chat)}
            />
          );
        })}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-text-secondary text-sm">Nenhuma conversa encontrada.</div>
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
