export default function Contacts() {
  return (
    <div className="p-8 h-full overflow-y-auto bg-bg-main flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Contatos</h1>
          <p className="text-text-secondary">Gerencie todos os seus contatos das instâncias ativas.</p>
        </div>
        <button className="bg-accent-green hover:opacity-90 text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
          Adicionar Contato
        </button>
      </div>

      <div className="bg-bg-panel rounded-xl border border-border-dark flex-1 flex items-center justify-center">
        <div className="text-center text-text-secondary">
          <p className="text-lg font-medium text-text-primary mb-2">Lista de Contatos Centralizada</p>
          <p className="text-sm">Os contatos das suas instâncias conectadas aparecerão aqui.</p>
        </div>
      </div>
    </div>
  );
}
