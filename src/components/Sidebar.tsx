import { MessageSquare, Settings, Users, PhoneCall } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

export default function Sidebar() {
  const links = [
    { name: 'Inbox', path: '/inbox', icon: MessageSquare },
    { name: 'Contatos', path: '/contacts', icon: Users },
    { name: 'Instâncias', path: '/instances', icon: PhoneCall },
    { name: 'Configurações', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-[72px] bg-bg-sidebar flex flex-col items-center border-r border-border-dark py-5 gap-6 z-20 shrink-0">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-green to-[#00c853] flex flex-col items-center justify-center font-bold text-black text-xl shrink-0">
        D
      </div>

      <nav className="flex-1 flex flex-col items-center gap-3 w-full px-3">
        {links.map((link) => (
          <NavLink
            key={link.name}
            to={link.path}
            title={link.name}
            className={({ isActive }) =>
              clsx(
                'w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer',
                isActive
                  ? 'bg-accent-green/10 text-accent-green'
                  : 'text-text-secondary hover:bg-white/5 hover:text-white'
              )
            }
          >
            <link.icon className="w-6 h-6 stroke-[1.5]" />
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-3 w-full flex justify-center">
        <div className="w-10 h-10 rounded-full bg-[#3d3d45] flex items-center justify-center font-bold text-text-primary text-xs text-center border-2 border-transparent hover:border-border-dark cursor-pointer transition-all">
          A
        </div>
      </div>
    </aside>
  );
}
