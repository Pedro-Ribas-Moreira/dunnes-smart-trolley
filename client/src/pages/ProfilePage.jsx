import React, { useState } from 'react';
import { User, Mail, Lock, LogOut } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase'; 

const appId = 'dunnes-trolley';

export default function ProfilePage({ user }) {
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
        // 1. Create account
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        // 2. Set profile name
        await updateProfile(credential.user, { displayName: name });
        // 3. Create database entry for this user's profile
        await setDoc(doc(db, 'artifacts', appId, 'users', credential.user.uid, 'profile', 'details'), {
          name: name,
          email: email,
          createdAt: new Date().toISOString()
        });
      } else {
        // Log in
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  // If already logged in (not anonymous), show details
  if (!isAnonymous) {
    return (
      <div className="p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
          <User size={48} className="mx-auto text-green-700 mb-4" />
          <h2 className="text-xl font-bold text-gray-800">{user.displayName}</h2>
          <p className="text-sm text-gray-500 mb-6">{user.email}</p>
          <button onClick={() => signOut(auth)} className="w-full bg-red-50 text-red-600 font-bold py-3 rounded-xl flex justify-center items-center gap-2">
            <LogOut size={18} /> Log Out
          </button>
        </div>
      </div>
    );
  }

  // Sign Up / Log In Form
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