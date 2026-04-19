import { Copy } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

export default function Settings() {
  const [copied, setCopied] = useState(false);
  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/evolution` : 'URL do Servidor';

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-bg-main flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Configurações</h1>
        <p className="text-text-secondary">Configurações globais do sistema e integrações.</p>
      </div>

      <div className="max-w-3xl space-y-6">
        <div className="bg-bg-panel rounded-xl border border-border-dark overflow-hidden">
          <div className="p-5 border-b border-border-dark">
            <h2 className="text-lg font-semibold text-text-primary">Webhook (Eventos em Tempo Real)</h2>
            <p className="text-sm text-text-secondary mt-1">
              Copie a URL abaixo e configure como o "Global Webhook" da sua API Evolution para que as mensagens cheguem em tempo real no chat.
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Webhook URL</label>
              <div className="flex bg-bg-main rounded-md border border-border-dark overflow-hidden shadow-sm">
                <input 
                  type="text" 
                  readOnly 
                  value={webhookUrl}
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-text-primary outline-none"
                />
                <button 
                  onClick={handleCopy}
                  className="flex items-center justify-center bg-white/5 px-4 border-l border-border-dark hover:bg-white/10 transition-colors text-text-primary focus:outline-none"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            <div className="bg-accent-green/10 border border-accent-green/20 rounded-lg p-4 text-sm text-accent-green">
              <strong className="font-semibold block mb-1">Eventos necessários (Events):</strong>
              Marque os seguintes eventos lá no painel da sua API: <br />
              <code className="text-[12px] bg-accent-green/20 px-1.5 py-0.5 rounded mt-2 inline-block text-accent-green font-mono">messages.upsert</code>
              <code className="text-[12px] bg-accent-green/20 px-1.5 py-0.5 rounded mt-2 inline-block ml-2 text-accent-green font-mono">messages.update</code>
              <code className="text-[12px] bg-accent-green/20 px-1.5 py-0.5 rounded mt-2 inline-block ml-2 text-accent-green font-mono">connection.update</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
