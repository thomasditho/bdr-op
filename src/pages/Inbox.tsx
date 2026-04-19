import { useState, useEffect } from 'react';
import ChatList from '../components/chat/ChatList';
import ChatArea from '../components/chat/ChatArea';
import { evolutionApi } from '../lib/api';
import { getSocket } from '../lib/socket';

export default function Inbox() {
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);

  useEffect(() => {
    // Fetch available instances
    evolutionApi.getInstances().then(data => {
      // Assuming array of instances
      const list = Array.isArray(data) ? data : (data?.instances || Object.values(data || {}));
      setInstances(list);
      
      // Select the first connected instance automatically if none selected
      if (list.length > 0) {
        const connected = list.find(i => i.instance?.status === 'open' || i.status === 'open');
        setSelectedInstance(connected?.instance?.instanceName || connected?.instanceName || list[0].instance?.instanceName || list[0].instanceName);
      }
    }).catch(err => {
      console.error('Failed to load instances', err);
    });

    const socket = getSocket();
    const handleEvolutionEvent = (payload: any) => {
      console.log('Got real-time event:', payload);
      // Logic for real-time is pushed down to specific components (like ChatList and ChatArea) 
      // or handled globally via React context. 
      // For simplicity, we can pass a trigger dependency or use an event emitter.
    };

    socket.on('evolution_event', handleEvolutionEvent);
    return () => {
      socket.off('evolution_event', handleEvolutionEvent);
    };
  }, []);

  return (
    <div className="flex h-full w-full bg-bg-main relative">
      <div className="w-[320px] min-w-[320px] bg-bg-panel border-r border-border-dark flex flex-col h-full z-10 relative">
        <div className="p-6 border-b border-border-dark flex-shrink-0">
          <h2 className="text-[18px] text-text-primary mb-4 font-normal">Conversas</h2>
          {instances.length > 0 && (
            <div className="bg-bg-main border border-border-dark rounded-lg py-2 px-3 flex items-center justify-between text-[13px] text-text-primary relative group cursor-pointer">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-green shadow-[0_0_8px_var(--color-accent-green)]"></div>
                <span>{selectedInstance || 'Selecione...'}</span>
              </div>
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
              <select 
                value={selectedInstance || ''} 
                onChange={e => {
                  setSelectedInstance(e.target.value);
                  setSelectedChat(null);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer bg-bg-main text-text-primary"
              >
                {instances.map((inst, index) => {
                  const name = inst.instance?.instanceName || inst.instanceName || inst.name || `instance-${index}`;
                  return <option className="bg-bg-main text-text-primary" key={name} value={name}>{name}</option>;
                })}
              </select>
            </div>
          )}
        </div>
        
        {selectedInstance ? (
          <ChatList 
            instance={selectedInstance} 
            selectedChat={selectedChat}
            onSelectChat={setSelectedChat}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center bg-bg-panel">
            <p className="text-text-secondary text-sm">Carregando conexões do WhatsApp...</p>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col h-full bg-[radial-gradient(circle_at_2px_2px,#1a1a1f_1px,transparent_0)] bg-[size:40px_40px] bg-bg-main min-w-[400px]">
        {selectedChat && selectedInstance ? (
          <ChatArea instance={selectedInstance} chat={selectedChat} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-secondary p-8 text-center gap-4">
            <div className="w-24 h-24 rounded-full bg-bg-panel flex items-center justify-center shadow-sm border border-border-dark">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-text-secondary opacity-50" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
               </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-text-primary">Selecione uma conversa</p>
              <p className="text-sm mt-1">Clique em um contato na barra lateral para abrir o chat.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
