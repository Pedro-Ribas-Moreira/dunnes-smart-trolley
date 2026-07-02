import React, {useState} from 'react';
import { ScanLine, ShoppingCart, User } from 'lucide-react';

import ScanPage from './pages/ScanPage.jsx';
import CartPage from './pages/CartPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';  

export default function App() {
  const [activePage, setActivePage] = useState('scan');

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen font-sans w-full">
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col h-[100dvh] relative overflow-hidden"
      >
        
        {/* HEADER */}
        <header className="bg-green-700 text-white p-4 shadow-md z-20 flex-shrink-0">
          <h1 className="text-xl font-bold tracking-wide">Dunnes Smart Trolley</h1>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto bg-gray-50 pb-20">
          {/* We now render the standalone components instead of inline HTML */}
          {activePage === 'scan' && <ScanPage />}
          {activePage === 'cart' && <CartPage />}
          {activePage === 'profile' && <ProfilePage />}
        </main>

        {/* BOTTOM NAVIGATION BAR */}
        <nav className="absolute bottom-10 w-full bg-white border-t border-gray-200 flex justify-around pb-safe">
          <button 
            onClick={() => setActivePage('scan')} 
            className={`flex-1 py-4 flex flex-col items-center gap-1 ${activePage === 'scan' ? 'text-green-700' : 'text-gray-400'}`}
          >
            <ScanLine size={24} />
            <span className="text-xs font-medium">Scan</span>
          </button>
          
          <button 
            onClick={() => setActivePage('cart')} 
            className={`flex-1 py-4 flex flex-col items-center gap-1 ${activePage === 'cart' ? 'text-green-700' : 'text-gray-400'}`}
          >
            <ShoppingCart size={24} />
            <span className="text-xs font-medium">Cart</span>
          </button>

          <button 
            onClick={() => setActivePage('profile')} 
            className={`flex-1 py-4 flex flex-col items-center gap-1 ${activePage === 'profile' ? 'text-green-700' : 'text-gray-400'}`}
          >
            <User size={24} />
            <span className="text-xs font-medium">Profile</span>
          </button>
        </nav>
        
      </div>
    </div>
  )
}