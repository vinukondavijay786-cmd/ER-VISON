import React, { useState, useEffect } from 'react';
import { User } from './types';
import { storage } from './services/storage';
import { AuthPortal } from './components/auth/AuthPortal';
import { Header } from './components/common/Header';
import { PatientPortal } from './components/patient/PatientPortal';
import { NursePortal } from './components/nurse/NursePortal';
import { DoctorPortal } from './components/doctor/DoctorPortal';
import { GeminiChatbot } from './components/chat/GeminiChatbot';
import { Bot, Sparkles } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    // Check persistent browser storage session
    const session = storage.getSession();
    if (session && session.user) {
      // Re-verify user exists in persistent storage
      const refreshed = storage.findUserById(session.user.id);
      if (refreshed) {
        setCurrentUser(refreshed);
      } else {
        setCurrentUser(session.user);
      }
    }
    setIsInitializing(false);
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    storage.clearSession();
    setCurrentUser(null);
    setIsChatOpen(false);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <div className="flex items-center space-x-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="h-5 w-5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-700">Loading ER Vision Healthcare System...</span>
        </div>
      </div>
    );
  }

  // Not authenticated: render Universal Auth Entry Portal
  if (!currentUser) {
    return <AuthPortal onLoginSuccess={handleLoginSuccess} />;
  }

  // Authenticated: render Header, role-routed Portal, and Gemini Chatbot in crisp light theme
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-sky-500 selection:text-white relative">
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onOpenChat={() => setIsChatOpen(true)}
      />

      <main className="flex-1">
        {currentUser.role === 'patient' && <PatientPortal user={currentUser} />}
        {currentUser.role === 'nurse' && <NursePortal user={currentUser} />}
        {currentUser.role === 'doctor' && <DoctorPortal user={currentUser} />}
      </main>

      {/* Floating Gemini Chatbot Launcher Button */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-5 right-5 z-40 px-4 py-3 rounded-2xl bg-gradient-to-r from-sky-600 via-teal-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white shadow-lg shadow-sky-600/20 flex items-center space-x-2.5 transition-all transform hover:scale-105 group border border-white/20"
          title="Open Gemini AI Clinical & Care Assistant"
        >
          <div className="relative">
            <Bot className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-200"></span>
            </span>
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold leading-tight flex items-center space-x-1">
              <span>AI Clinical Copilot</span>
              <Sparkles className="h-3 w-3 text-sky-200 inline" />
            </div>
            <div className="text-[10px] text-sky-100 leading-tight">
              Gemini Powered
            </div>
          </div>
        </button>
      )}

      {/* Multi-turn Gemini Chatbot Component */}
      <GeminiChatbot
        user={currentUser}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
}
