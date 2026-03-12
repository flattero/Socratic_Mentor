import { useState } from 'react';
import { TaskInput } from './components/TaskInput';
import { ChatInterface } from './components/ChatInterface';
import { VoiceInterface } from './components/VoiceInterface';
import { Message } from './services/ai';
import { generatePDF } from './services/pdf';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, MessageSquare, Mic, Download, RefreshCw } from 'lucide-react';

type AppState = 'input' | 'mode-selection' | 'chat' | 'voice' | 'summary';

export default function App() {
  const [state, setState] = useState<AppState>('input');
  const [taskSummary, setTaskSummary] = useState('');
  const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  const handleTaskAnalyzed = (summary: string) => {
    setTaskSummary(summary);
    setState('mode-selection');
  };

  const handleSessionEnd = (messages: Message[]) => {
    setSessionMessages(messages);
    setState('summary');
  };

  const handleDownloadPDF = () => {
    if (state === 'summary' && sessionMessages.length > 0) {
      generatePDF(sessionMessages, taskSummary);
    } else if (voiceTranscript) {
      // Convert voice transcript to Message format for PDF generator
      const lines = voiceTranscript.split('\n').filter(l => l.trim());
      const messages: Message[] = lines.map(line => {
        if (line.startsWith('Mentor:')) return { role: 'model', content: line.replace('Mentor:', '').trim() };
        if (line.startsWith('Student:')) return { role: 'user', content: line.replace('Student:', '').trim() };
        return { role: 'user', content: line.trim() };
      });
      generatePDF(messages, taskSummary);
    }
  };

  const reset = () => {
    setState('input');
    setTaskSummary('');
    setSessionMessages([]);
    setVoiceTranscript('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 py-4 px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="bg-brand-500 p-2 rounded-xl text-white">
            <GraduationCap size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Socratic Mentor</h1>
        </div>
        {state !== 'input' && (
          <button 
            onClick={reset}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center space-x-1"
          >
            <RefreshCw size={14} />
            <span>Start Over</span>
          </button>
        )}
      </header>

      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <AnimatePresence mode="wait">
          {state === 'input' && (
            <TaskInput key="input" onTaskAnalyzed={handleTaskAnalyzed} />
          )}

          {state === 'mode-selection' && (
            <motion.div
              key="mode"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8 text-center"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-slate-900">Choose Your Method</h2>
                <p className="text-slate-500">How would you like to demonstrate your understanding?</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <button
                  onClick={() => setState('chat')}
                  className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-brand-200 transition-all group text-left space-y-4"
                >
                  <div className="w-12 h-12 bg-brand-50 text-brand-500 rounded-2xl flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors">
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Text Chat</h3>
                    <p className="text-slate-500 text-sm">A structured text-based dialogue with your mentor.</p>
                  </div>
                </button>

                <button
                  onClick={() => setState('voice')}
                  className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-brand-200 transition-all group text-left space-y-4"
                >
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <Mic size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Voice Session</h3>
                    <p className="text-slate-500 text-sm">Real-time voice conversation for a natural flow.</p>
                  </div>
                </button>
              </div>

              <div className="p-6 bg-brand-50 rounded-2xl text-left">
                <h4 className="text-sm font-bold text-brand-800 uppercase tracking-wider mb-2">Task Analysis Summary</h4>
                <p className="text-brand-900 text-sm leading-relaxed">{taskSummary}</p>
              </div>
            </motion.div>
          )}

          {state === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ChatInterface taskSummary={taskSummary} onSessionEnd={handleSessionEnd} />
            </motion.div>
          )}

          {state === 'voice' && (
            <motion.div
              key="voice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <VoiceInterface 
                taskSummary={taskSummary} 
                onTranscriptUpdate={setVoiceTranscript} 
              />
              <div className="text-center">
                <button 
                  onClick={() => setState('summary')}
                  className="text-brand-600 font-medium hover:underline"
                >
                  End Voice Session & Download Transcript
                </button>
              </div>
            </motion.div>
          )}

          {state === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto text-center space-y-8 p-12 bg-white rounded-3xl shadow-xl border border-slate-100"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Download size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-slate-900">Session Complete</h2>
                <p className="text-slate-500">You've successfully demonstrated your understanding. Download your transcript below.</p>
              </div>
              <button
                onClick={handleDownloadPDF}
                className="w-full py-4 bg-brand-500 text-white rounded-2xl font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-100"
              >
                Download PDF Transcript
              </button>
              <button
                onClick={reset}
                className="text-slate-500 font-medium hover:text-slate-800"
              >
                Start a New Session
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-slate-400 text-sm">
        <p>&copy; 2026 Socratic Mentor AI. Empowering students through dialogue.</p>
      </footer>
    </div>
  );
}
