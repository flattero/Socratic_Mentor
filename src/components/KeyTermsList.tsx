import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface KeyTermsListProps {
  terms: string[];
  transcript: string;
}

export const KeyTermsList: React.FC<KeyTermsListProps> = ({ terms, transcript }) => {
  const [usedTerms, setUsedTerms] = useState<Set<string>>(new Set());

  useEffect(() => {
    const lowerTranscript = transcript.toLowerCase();
    const newUsedTerms = new Set<string>();
    
    terms.forEach(term => {
      if (lowerTranscript.includes(term.toLowerCase())) {
        newUsedTerms.add(term);
      }
    });

    if (newUsedTerms.size !== usedTerms.size) {
      setUsedTerms(newUsedTerms);
    }
  }, [transcript, terms]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 h-full">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">Key Terms</h3>
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
          {usedTerms.size} / {terms.length}
        </span>
      </div>
      
      <div className="space-y-2">
        {terms.map((term, index) => {
          const isUsed = usedTerms.has(term);
          return (
            <motion.div
              key={term}
              initial={false}
              animate={{ 
                backgroundColor: isUsed ? 'rgb(240 253 244)' : 'transparent',
                borderColor: isUsed ? 'rgb(187 247 208)' : 'rgb(241 245 249)'
              }}
              className={`flex items-center justify-between p-3 rounded-xl border transition-colors`}
            >
              <span className={`text-sm font-medium ${isUsed ? 'text-emerald-700' : 'text-slate-600'}`}>
                {term}
              </span>
              <AnimatePresence mode="wait">
                {isUsed ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="text-emerald-500"
                  >
                    <CheckCircle2 size={18} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="circle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-slate-200"
                  >
                    <Circle size={18} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {terms.length === 0 && (
        <p className="text-slate-400 text-sm italic text-center py-8">
          No key terms identified for this task.
        </p>
      )}
    </div>
  );
};
