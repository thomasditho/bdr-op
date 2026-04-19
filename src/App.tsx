/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Inbox from './pages/Inbox';
import Contacts from './pages/Contacts';
import Instances from './pages/Instances';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Router>
      <div className="flex h-screen overflow-hidden bg-bg-main text-text-primary font-sans">
        <Sidebar />
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/inbox" />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/instances" element={<Instances />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
