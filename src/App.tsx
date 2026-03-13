import { useState } from 'react';
import { TaskInput } from './components/TaskInput';
import { ChatInterface } from './components/ChatInterface';
import { VoiceInterface } from './components/VoiceInterface';
import { Message, TaskAnalysis, generateFeedback } from './services/ai';
import { generatePDF } from './services/pdf';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, MessageSquare, Mic, Download, RefreshCw, Sparkles, Loader2 } from 'lucide-react';

type AppState = 'input' | 'mode-selection' | 'chat' | 'voice' | 'summary';

export default function App() {
  const [state, setState] = useState<AppState>('input');
  const [taskSummary, setTaskSummary] = useState('');
  const [keyTerms, setKeyTerms] = useState<string[]>([]);
  const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

  const handleTaskAnalyzed = (analysis: TaskAnalysis) => {
    setTaskSummary(analysis.summary);
    setKeyTerms(analysis.keyTerms);
    setState('mode-selection');
  };

  const handleSessionEnd = async (messages: Message[]) => {
    setSessionMessages(messages);
    setState('summary');
    setIsGeneratingFeedback(true);
    try {
      const result = await generateFeedback(messages, taskSummary);
      setFeedback(result);
    } catch (error) {
      console.error("Feedback error:", error);
      setFeedback("Great job completing the session! Your transcript is ready for download.");
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  const handleVoiceSessionEnd = async () => {
    if (!voiceTranscript || voiceTranscript.trim() === "") {
      setState('mode-selection');
      return;
    }

    const lines = voiceTranscript.split('\n').filter(l => l.trim());
    const messages: Message[] = lines.map(line => {
      if (line.startsWith('Mentor:')) return { role: 'model', content: line.replace('Mentor:', '').trim() };
      if (line.startsWith('Student:')) return { role: 'user', content: line.replace('Student:', '').trim() };
      return { role: 'user', content: line.trim() };
    });
    
    setSessionMessages(messages);
    setState('summary');
    setIsGeneratingFeedback(true);
    try {
      const result = await generateFeedback(messages, taskSummary);
      setFeedback(result);
    } catch (error) {
      console.error("Feedback error:", error);
      setFeedback("Great job completing the session! Your transcript is ready for download.");
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  const handleDownloadPDF = () => {
    if (state === 'summary' && sessionMessages.length > 0) {
      generatePDF(sessionMessages, taskSummary, feedback);
    } else if (voiceTranscript) {
      // Convert voice transcript to Message format for PDF generator
      const lines = voiceTranscript.split('\n').filter(l => l.trim());
      const messages: Message[] = lines.map(line => {
        if (line.startsWith('Mentor:')) return { role: 'model', content: line.replace('Mentor:', '').trim() };
        if (line.startsWith('Student:')) return { role: 'user', content: line.replace('Student:', '').trim() };
        return { role: 'user', content: line.trim() };
      });
      generatePDF(messages, taskSummary, feedback);
    }
  };

  const reset = () => {
    setState('input');
    setTaskSummary('');
    setKeyTerms([]);
    setSessionMessages([]);
    setVoiceTranscript('');
    setFeedback('');
    setIsGeneratingFeedback(false);
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

      <main className={`flex-1 container mx-auto px-4 py-12 ${state === 'voice' ? 'max-w-6xl' : 'max-w-4xl'}`}>
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
                {keyTerms.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {keyTerms.map((term, i) => (
                      <span key={i} className="px-2 py-1 bg-brand-100 text-brand-700 rounded-lg text-xs font-medium">
                        {term}
                      </span>
                    ))}
                  </div>
                )}
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
                keyTerms={keyTerms}
                onTranscriptUpdate={setVoiceTranscript} 
                onSessionEnd={handleVoiceSessionEnd}
              />
              <div className="text-center">
                <button 
                  onClick={handleVoiceSessionEnd}
                  className="text-brand-600 font-medium hover:underline"
                >
                  End Voice Session & Get Feedback
                </button>
              </div>
            </motion.div>
          )}

          {state === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto text-center space-y-8 p-12 bg-white rounded-3xl shadow-xl border border-slate-100"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Sparkles size={40} />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-slate-900">Session Complete</h2>
                
                <div className="p-6 bg-brand-50 rounded-2xl text-left border border-brand-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <GraduationCap size={64} />
                  </div>
                  <h3 className="text-sm font-bold text-brand-800 uppercase tracking-wider mb-3 flex items-center">
                    <Sparkles size={16} className="mr-2" />
                    Mentor Feedback
                  </h3>
                  {isGeneratingFeedback ? (
                    <div className="flex items-center space-x-3 text-brand-600 py-4">
                      <Loader2 size={20} className="animate-spin" />
                      <span className="font-medium">Mentor is reflecting on your progress...</span>
                    </div>
                  ) : (
                    <div className="text-brand-900 leading-relaxed whitespace-pre-wrap italic">
                      {feedback || "Great job completing the session! Your transcript is ready for download."}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleDownloadPDF}
                  className="py-4 bg-brand-500 text-white rounded-2xl font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-100 flex items-center justify-center space-x-2"
                >
                  <Download size={20} />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={reset}
                  className="py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center space-x-2"
                >
                  <RefreshCw size={20} />
                  <span>New Session</span>
                </button>
              </div>
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
