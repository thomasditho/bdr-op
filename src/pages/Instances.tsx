import { useState, useEffect } from 'react';
import { evolutionApi } from '../lib/api';
import { getSocket } from '../lib/socket';
import { PhoneCall, Plus, RefreshCw, Trash2, QrCode, LogOut, Loader2, Wifi, WifiOff } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

export default function Instances() {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrCodeData, setQrCodeData] = useState<{ [key: string]: string | null }>({});
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});

  const fetchInstances = async () => {
    setLoading(true);
    try {
      const data = await evolutionApi.getInstances();
      setInstances(Array.isArray(data) ? data : (data?.instances || Object.values(data || {})));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (instanceName: string) => {
    setActionLoading(prev => ({ ...prev, [instanceName]: true }));
    try {
      const data = await evolutionApi.connectInstance(instanceName);
      if (data && data.base64) {
        setQrCodeData(prev => ({ ...prev, [instanceName]: data.base64 }));
      }
    } catch (err) {
      console.error('Failed to get QR code', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [instanceName]: false }));
    }
  };

  const handleDelete = async (instanceName: string) => {
    if (!confirm(`Deseja realmente remover a instância ${instanceName}?`)) return;
    setActionLoading(prev => ({ ...prev, [instanceName]: true }));
    try {
      await evolutionApi.deleteInstance(instanceName);
      fetchInstances();
    } catch (err) {
      console.error('Delete error', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [instanceName]: false }));
    }
  };

  useEffect(() => {
    fetchInstances();
    const socket = getSocket();

    const handleUpdate = (payload: any) => {
       console.log('Socket Update in Instances:', payload);
       // Refresh list on any status change event
       if (payload.event?.includes('status') || payload.event === 'instance-update') {
          fetchInstances();
       }
    };

    socket.on('evolution_event', handleUpdate);
    return () => {
      socket.off('evolution_event', handleUpdate);
    };
  }, []);

  return (
    <div className="p-8 h-full overflow-y-auto bg-bg-main flex flex-col custom-scrollbar">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Gerenciador de Instâncias</h1>
          <p className="text-text-secondary text-sm mt-1">Status em tempo real das suas conexões WhatsApp.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchInstances}
            disabled={loading}
            className="p-2.5 text-text-secondary bg-bg-panel border border-border-dark hover:text-text-primary rounded-lg text-sm font-medium transition-all shadow-sm flex items-center justify-center disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
          </button>
          <button className="bg-accent-green hover:opacity-90 text-black px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center gap-2 active:scale-95">
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Nova Conexão
          </button>
        </div>
      </motion.div>

      {loading && instances.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
           <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-accent-green animate-spin" />
              <p className="text-text-secondary animate-pulse text-sm">Consultando Evolution API...</p>
           </div>
        </div>
      ) : instances.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-bg-panel rounded-2xl border border-border-dark flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6"
        >
          <div className="w-20 h-20 bg-accent-green/10 rounded-full flex items-center justify-center border border-accent-green/20">
            <PhoneCall className="w-10 h-10 text-accent-green" />
          </div>
          <div className="max-w-md">
            <h3 className="text-xl font-bold text-text-primary">Sem Instâncias Ativas</h3>
            <p className="text-text-secondary text-sm mt-2">
              Clique no botão "Nova Conexão" para criar sua primeira instância e começar a gerenciar seus chats.
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
          <AnimatePresence mode="popLayout">
            {instances.map((inst, i) => {
              const data = inst.instance || inst;
              const name = data.instanceName || data.name || `Instância ${i + 1}`;
              const status = data.connectionStatus || data.status;
              const connected = status === 'open';
              const isConnecting = actionLoading[name];

              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  key={name} 
                  className={clsx(
                    "bg-bg-panel rounded-2xl border border-border-dark overflow-hidden flex flex-col hover:border-white/10 transition-all shadow-lg group",
                    connected ? "hover:shadow-accent-green/5" : "hover:shadow-red-500/5"
                  )}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-bg-main flex items-center justify-center border border-border-dark text-text-secondary overflow-hidden shadow-inner group-hover:border-accent-green/30 transition-colors">
                          {data.profilePictureUrl ? (
                            <img src={data.profilePictureUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                          ) : (
                            <PhoneCall className={clsx("w-6 h-6", connected ? "text-accent-green" : "text-text-secondary")} />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-text-primary text-lg leading-tight">{name}</h3>
                          <p className="text-[11px] text-text-secondary font-mono mt-1 opacity-60">ID: {name?.toLowerCase()}</p>
                        </div>
                      </div>
                      <div className={clsx(
                        "p-2 rounded-full",
                        connected ? "bg-accent-green/10 text-accent-green" : "bg-red-500/10 text-red-500"
                      )}>
                        {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                      </div>
                    </div>

                    {qrCodeData[name] && !connected && (
                       <motion.div 
                         initial={{ opacity: 0, scale: 0.8 }}
                         animate={{ opacity: 1, scale: 1 }}
                         className="mb-6 p-4 bg-white rounded-xl flex flex-col items-center justify-center gap-3 shadow-2xl"
                       >
                         <img src={qrCodeData[name]!} alt="QR Code" className="w-48 h-48" />
                         <span className="text-[10px] text-black font-bold uppercase tracking-wider">Escaneie no WhatsApp</span>
                       </motion.div>
                    )}

                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm bg-bg-main/50 p-3 rounded-xl border border-border-dark">
                        <span className="text-text-secondary flex items-center gap-2">
                           <div className={clsx("w-2 h-2 rounded-full", connected ? "bg-accent-green animate-pulse" : "bg-red-500")} />
                           Conectividade
                        </span>
                        <span className={clsx(
                          "font-bold",
                          connected ? "text-accent-green" : "text-red-500"
                        )}>
                          {connected ? 'OPEN' : status?.toUpperCase() || 'OFFLINE'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-border-dark p-4 bg-bg-main/30 flex items-center gap-3 justify-between">
                    <div className="flex gap-2">
                      <button 
                         onClick={() => handleDelete(name)}
                         disabled={isConnecting}
                         className="p-2 text-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all active:scale-90 disabled:opacity-50"
                         title="Remover Instância"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      {!connected && (
                        <button 
                          onClick={() => handleConnect(name)}
                          disabled={isConnecting}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-black bg-accent-green rounded-lg transition-all hover:opacity-90 active:scale-95 shadow-sm disabled:opacity-50"
                        >
                          {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                          GERAR QR
                        </button>
                      )}
                      {connected && (
                        <button 
                           onClick={() => evolutionApi.logoutInstance(name).then(() => fetchInstances())}
                           className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-text-primary bg-bg-main border border-border-dark rounded-lg transition-all hover:bg-white/5 active:scale-95 shadow-sm"
                        >
                           <LogOut className="w-4 h-4" />
                           LOGOUT
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
