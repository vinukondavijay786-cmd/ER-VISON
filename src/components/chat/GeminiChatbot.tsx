import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage } from '../../types';
import { storage } from '../../services/storage';
import { aiService } from '../../services/aiService';
import {
  MessageSquare,
  Sparkles,
  Send,
  X,
  Minimize2,
  Maximize2,
  Trash2,
  Bot,
  User as UserIcon,
  Zap,
} from 'lucide-react';

interface GeminiChatbotProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

export type ChatbotPersona =
  | 'patient_navigator'
  | 'nurse_protocol'
  | 'physician_copilot'
  | 'pharmacology';

interface PersonaConfig {
  id: ChatbotPersona;
  title: string;
  badge: string;
  description: string;
  systemInstruction: string;
  defaultModel: 'standard' | 'fast';
  presetPrompts: string[];
}

const PERSONA_CONFIGS: Record<ChatbotPersona, PersonaConfig> = {
  patient_navigator: {
    id: 'patient_navigator',
    title: 'Patient Health & Wellness Navigator',
    badge: 'Patient Companion',
    description: 'Empathetic guidance on symptoms, clinic visits, and health questions.',
    systemInstruction:
      'You are ER Vision Patient Health Navigator, an empathetic, supportive, and clear healthcare conversational assistant. Explain medical terms in reassuring, plain English. Provide self-care guidance, advise when in-person medical attention or emergency care is warranted, and prepare patients for doctor visits.',
    defaultModel: 'standard',
    presetPrompts: [
      'What should I ask my doctor about my recurring headaches?',
      'How can I prepare for my upcoming specialist appointment?',
      'What are healthy comfort measures for mild seasonal allergies?',
      'When is a fever considered dangerous in an adult?',
    ],
  },
  nurse_protocol: {
    id: 'nurse_protocol',
    title: 'Emergency Triage & Protocol Advisor',
    badge: 'Triage Nurse Copilot',
    description: 'MEWS calculations, SIRS/sepsis checklists, and vital sign anomaly analysis.',
    systemInstruction:
      'You are ER Vision Nurse Triage & Protocol Copilot, an acute care and emergency medicine assistant. Provide rapid, guideline-concordant answers on Emergency Severity Index (ESI), Modified Early Warning Scores (MEWS), sepsis resuscitation bundles, shock index thresholds, and bedside nursing intervention protocols.',
    defaultModel: 'fast',
    presetPrompts: [
      'What are the 1-hour bundle interventions for suspected sepsis?',
      'Explain the clinical implications of a shock index greater than 0.9.',
      'What criteria differentiate ESI Level 2 from ESI Level 3?',
      'Recommended immediate nursing orders for acute dyspnea with SpO2 89%?',
    ],
  },
  physician_copilot: {
    id: 'physician_copilot',
    title: 'Physician Clinical Decision Copilot',
    badge: 'Physician CDS',
    description: 'Differential diagnosis reasoning, critical red flags, and guideline summaries.',
    systemInstruction:
      'You are ER Vision Physician Clinical Decision Copilot, a sophisticated evidence-based clinical reasoning partner for licensed medical doctors. Provide structured differential diagnoses, red-flag life threats to exclude, diagnostic workup recommendations, and evidence summaries from ACP, AHA, and ACEP clinical guidelines.',
    defaultModel: 'standard',
    presetPrompts: [
      'Differential diagnoses for acute pleuritic chest pain in a 42-year-old female.',
      'Wells score criteria and D-dimer cutoffs for ruling out PE.',
      'Initial pharmacotherapy for acute decompensated heart failure.',
      'Guidelines for dual antiplatelet therapy post-PCI with drug-eluting stents.',
    ],
  },
  pharmacology: {
    id: 'pharmacology',
    title: 'Pharmacology & Medication Safety Specialist',
    badge: 'Pharmacist Advisor',
    description: 'Fast drug interactions, dosing adjustments, and adverse reaction checks.',
    systemInstruction:
      'You are ER Vision Clinical Pharmacology Specialist. Answer precise questions regarding pharmacokinetics, drug-drug and drug-food interactions, renal dosage adjustments, contraindications, and black-box safety warnings.',
    defaultModel: 'fast',
    presetPrompts: [
      'Are there significant interactions between Clopidogrel and Omeprazole?',
      'Renal dosing guidelines for Ceftriaxone vs Cefepime in severe CKD.',
      'Common adverse reactions to watch for when starting ACE inhibitors.',
      'Food interactions and timing recommendations for Levothyroxine.',
    ],
  },
};

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({ user, isOpen, onClose }) => {
  const getInitialPersona = (): ChatbotPersona => {
    if (user.role === 'doctor') return 'physician_copilot';
    if (user.role === 'nurse') return 'nurse_protocol';
    return 'patient_navigator';
  };

  const [persona, setPersona] = useState<ChatbotPersona>(getInitialPersona());
  const [modelSpeed, setModelSpeed] = useState<'standard' | 'fast'>('standard');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentPersona = PERSONA_CONFIGS[persona];

  useEffect(() => {
    const saved = storage.getChatHistory(user.id);
    if (saved && saved.length > 0) {
      setMessages(saved);
    } else {
      const initialGreeting: ChatMessage = {
        id: 'msg_welcome',
        role: 'model',
        content: `Hello ${user.name}! I am your **${currentPersona.title}**, powered by Google Gemini AI. How can I assist you with clinical protocols, health queries, or care coordination today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([initialGreeting]);
      storage.saveChatHistory(user.id, [initialGreeting]);
    }
  }, [user.id]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    storage.saveChatHistory(user.id, newMessages);
    setInputValue('');
    setIsSending(true);

    try {
      const contextHistory = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const replyText = await aiService.sendChatMessage({
        messages: contextHistory,
        systemInstruction: currentPersona.systemInstruction,
        model: modelSpeed,
      });

      const modelMessage: ChatMessage = {
        id: 'msg_' + Math.random().toString(36).substring(2, 9),
        role: 'model',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMessages = [...newMessages, modelMessage];
      setMessages(finalMessages);
      storage.saveChatHistory(user.id, finalMessages);
    } catch {
      const errorMessage: ChatMessage = {
        id: 'msg_' + Math.random().toString(36).substring(2, 9),
        role: 'model',
        content:
          'I encountered a brief connection issue. Please feel free to retry your question, or refer to direct medical staff for acute needs.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = () => {
    storage.clearChatHistory(user.id);
    const resetGreeting: ChatMessage = {
      id: 'msg_welcome_' + Date.now(),
      role: 'model',
      content: `Conversation refreshed. I am ready to assist with your medical questions as **${currentPersona.title}**.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([resetGreeting]);
    storage.saveChatHistory(user.id, [resetGreeting]);
  };

  return (
    <div
      className={`fixed z-50 transition-all duration-300 shadow-2xl flex flex-col ${
        isExpanded
          ? 'inset-4 md:inset-8 bg-white border border-slate-300 rounded-3xl overflow-hidden'
          : 'bottom-4 right-4 sm:right-6 w-[94vw] sm:w-[440px] h-[600px] max-h-[85vh] bg-white border border-slate-200 rounded-3xl overflow-hidden'
      }`}
    >
      {/* Header */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-sky-600 to-purple-600 flex items-center justify-center text-white shadow-xs">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h3 className="text-xs font-bold text-slate-900 tracking-wide">PulseCare AI Copilot</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-200">
                Gemini
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate max-w-[210px]">
              {currentPersona.title}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {/* Speed Model Switcher */}
          <button
            onClick={() => setModelSpeed(modelSpeed === 'standard' ? 'fast' : 'standard')}
            title={`Active: ${modelSpeed === 'standard' ? 'gemini-3.8-flash (Standard Deep Reasoning)' : 'gemini-3.1-flash-lite (Fast Tasks)'}`}
            className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-[10px] font-bold text-slate-700 flex items-center space-x-1 border border-slate-200 shadow-xs"
          >
            <Zap className={`h-3 w-3 ${modelSpeed === 'fast' ? 'text-amber-500' : 'text-sky-600'}`} />
            <span>{modelSpeed === 'fast' ? 'Fast Lite' : 'Flash'}</span>
          </button>

          {/* Clear Thread */}
          <button
            onClick={handleClearHistory}
            title="Clear Chat History"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          {/* Expand / Minimize */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand full-screen'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            title="Close chatbot"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Persona Role Switcher Strip */}
      <div className="bg-slate-100/60 px-3 py-1.5 border-b border-slate-200 flex items-center space-x-1.5 overflow-x-auto text-[11px] shrink-0">
        <span className="text-slate-500 font-bold text-[10px] uppercase shrink-0">Role:</span>
        {(Object.keys(PERSONA_CONFIGS) as ChatbotPersona[]).map((key) => {
          const cfg = PERSONA_CONFIGS[key];
          const isActive = persona === key;
          return (
            <button
              key={key}
              onClick={() => {
                setPersona(key);
                setModelSpeed(cfg.defaultModel);
              }}
              className={`px-2 py-0.5 rounded-lg font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-sky-100 text-sky-800 border border-sky-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {cfg.badge}
            </button>
          );
        })}
      </div>

      {/* Message Scrollable Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gradient-to-b from-slate-50 to-white">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-2.5 ${isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}
            >
              <div
                className={`h-7 w-7 rounded-xl flex items-center justify-center shrink-0 text-white shadow-xs ${
                  isUser
                    ? 'bg-sky-600'
                    : 'bg-gradient-to-tr from-purple-600 to-indigo-600'
                }`}
              >
                {isUser ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>

              <div className={`max-w-[85%] space-y-1 ${isUser ? 'text-right' : 'text-left'}`}>
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-sky-600 text-white rounded-tr-none shadow-xs font-medium'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs'
                  }`}
                >
                  {msg.content}
                </div>
                <div className="text-[10px] text-slate-400 font-mono px-1">
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-start space-x-2.5">
            <div className="h-7 w-7 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0 text-purple-700">
              <Bot className="h-3.5 w-3.5 animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none text-xs text-slate-500 flex items-center space-x-2 shadow-xs">
              <div className="flex space-x-1">
                <div className="h-1.5 w-1.5 bg-sky-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="h-1.5 w-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="h-1.5 w-1.5 bg-teal-500 rounded-full animate-bounce" />
              </div>
              <span className="text-[11px] font-medium">Consulting Gemini medical reasoning...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset Suggestion Chips */}
      {messages.length <= 3 && (
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 overflow-x-auto flex items-center space-x-1.5 shrink-0">
          <span className="text-[10px] text-slate-500 font-bold shrink-0">Prompts:</span>
          {currentPersona.presetPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-semibold whitespace-nowrap border border-slate-200 transition-colors shadow-xs"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Composer */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Ask ${currentPersona.badge}...`}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isSending}
            className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-1 font-medium">
          <span>PulseCare Multi-Turn Clinical Intelligence</span>
          <span>Role: {currentPersona.badge}</span>
        </div>
      </div>
    </div>
  );
};
