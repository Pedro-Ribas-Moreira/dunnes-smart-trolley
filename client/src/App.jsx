import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { ScanLine, ShoppingCart, User, Camera, Trash2, Loader2, Mail, Lock, LogOut } from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAImHNkhaLaWykYR9vJPzzX_7GJpjc9Fdg",
  authDomain: "dunnes-smart-trolley.firebaseapp.com",
  projectId: "dunnes-smart-trolley",
  storageBucket: "dunnes-smart-trolley.firebasestorage.app",
  messagingSenderId: "997152074108",
  appId: "1:997152074108:web:03d74cd7bd760d48ee9cf9",
  measurementId: "G-Q7HN4EZJ02"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'dunnes-trolley';

// --- PROFILE PAGE COMPONENT ---
function ProfilePage({ user }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAnonymous = user ? user.isAnonymous : true;

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name });
        await setDoc(doc(db, 'artifacts', appId, 'users', credential.user.uid, 'profile', 'details'), {
          name: name,
          email: email,
          createdAt: new Date().toISOString()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  if (!isAnonymous) {
    return (
      <div className="p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
          <User size={48} className="mx-auto text-green-700 mb-4" />
          <h2 className="text-xl font-bold text-gray-800">{user.displayName || 'Shopper'}</h2>
          <p className="text-sm text-gray-500 mb-6">{user.email}</p>
          <button onClick={() => signOut(auth)} className="w-full bg-red-50 text-red-600 font-bold py-3 rounded-xl flex justify-center items-center gap-2">
            <LogOut size={18} /> Log Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-center mb-6">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded">{error}</p>}
        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <input type="text" placeholder="Full Name" className="w-full p-3 bg-gray-50 border rounded-xl" value={name} onChange={(e) => setName(e.target.value)} required />
          )}
          <input type="email" placeholder="Email" className="w-full p-3 bg-gray-50 border rounded-xl" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="w-full p-3 bg-gray-50 border rounded-xl" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" className="w-full bg-green-700 text-white font-bold py-3 rounded-xl" disabled={loading}>
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
          </button>
        </form>
        <button onClick={() => setIsSignUp(!isSignUp)} className="w-full mt-4 text-sm text-green-700 font-semibold underline">
          {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('scan');
  const [cartItems, setCartItems] = useState([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Auth error:", error);
        }
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const cartRef = collection(db, 'artifacts', appId, 'users', user.uid, 'cart');
    const unsubscribe = onSnapshot(cartRef, (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      setCartItems(items);
    });
    return () => unsubscribe();
  }, [user]);

  const handleSimulateScan = async () => {
    if (!user) return;
    setIsScanning(true);
    setTimeout(async () => {
      const mockProducts = [
        { name: "Brennan's Sliced Pan", price: 1.95, barcode: "501234567890" },
        { name: "Avonmore Fresh Milk 2L", price: 2.29, barcode: "509876543210" }
      ];
      const randomProduct = mockProducts[Math.floor(Math.random() * mockProducts.length)];
      await setDoc(doc(collection(db, 'artifacts', appId, 'users', user.uid, 'cart')), { ...randomProduct, addedAt: new Date().toISOString() });
      setIsScanning(false);
    }, 1000);
  };

  if (loadingAuth) return <div className="flex h-screen items-center justify-center bg-green-700 text-white"><Loader2 className="animate-spin" size={48} /></div>;

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2);

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen font-sans">
      <div className="w-full max-w-md bg-white shadow-xl flex flex-col h-screen overflow-hidden relative">
        <header className="bg-green-700 text-white p-4 shadow-md z-10 flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-wide">Dunnes Smart Trolley</h1>
          <div className="bg-green-800 px-3 py-1 rounded-full text-sm font-semibold">€{cartTotal}</div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50 pb-20">
          {activeTab === 'scan' && (
            <div className="flex flex-col items-center justify-center h-full p-6 space-y-6">
              <div className="w-full aspect-square bg-gray-900 rounded-2xl flex flex-col items-center justify-center relative border-4 border-gray-200">
                <Camera size={48} className="text-gray-500 mb-4" />
                <p className="text-gray-400 font-medium">Scanner will be initialized here</p>
              </div>
              <button onClick={handleSimulateScan} disabled={isScanning} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95">
                {isScanning ? 'Scraping...' : 'Simulate Scan'}
              </button>
            </div>
          )}
          {activeTab === 'cart' && (
            <div className="p-4 space-y-3">
              {cartItems.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between">
                  <span className="font-semibold">{item.name}</span>
                  <span className="font-bold text-green-700">€{item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'profile' && <ProfilePage user={user} />}
        </main>

        <nav className="absolute bottom-0 w-full bg-white border-t border-gray-200 flex justify-around py-4">
          <button onClick={() => setActiveTab('scan')} className={activeTab === 'scan' ? 'text-green-700' : 'text-gray-400'}><ScanLine size={24} /></button>
          <button onClick={() => setActiveTab('cart')} className={activeTab === 'cart' ? 'text-green-700' : 'text-gray-400'}><ShoppingCart size={24} /></button>
          <button onClick={() => setActiveTab('profile')} className={activeTab === 'profile' ? 'text-green-700' : 'text-gray-400'}><User size={24} /></button>
        </nav>
      </div>
    </div>
  );
}