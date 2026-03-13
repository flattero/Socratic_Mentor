import React, { useState } from 'react';
import { Upload, FileText, ArrowRight, Loader2, X } from 'lucide-react';
import { analyzeTask } from '../services/ai';
import { motion } from 'motion/react';

interface TaskInputProps {
  onTaskAnalyzed: (summary: string) => void;
}

export const TaskInput: React.FC<TaskInputProps> = ({ onTaskAnalyzed }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async () => {
    if (!text.trim() && !file) {
      setError("Please provide some text or upload a document.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      let fileData;
      if (file) {
        const base64 = await fileToBase64(file);
        fileData = {
          data: base64,
          mimeType: file.type
        };
      }

      const summary = await analyzeTask(text, fileData);
      onTaskAnalyzed(summary || "Task analyzed successfully.");
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Failed to analyze the task. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-8 p-8 bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100"
    >
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">What Would You Like To Learn?</h2>
        <p className="text-slate-500">Paste your assessment criteria or upload a task document to begin.</p>
      </div>

      <div className="space-y-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste assessment details here..."
          className="w-full h-40 p-4 bg-slate-50 border-none rounded-2xl text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none"
        />

        <div className="relative">
          <input
            type="file"
            id="file-upload"
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.doc,.docx,image/*"
          />
          <label
            htmlFor="file-upload"
            className="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-all group"
          >
            {file ? (
              <div className="flex items-center space-x-3 text-brand-600 font-medium">
                <FileText className="w-5 h-5" />
                <span className="truncate max-w-[200px]">{file.name}</span>
                <button 
                  onClick={(e) => { e.preventDefault(); setFile(null); }}
                  className="p-1 hover:bg-brand-100 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2 text-slate-400 group-hover:text-brand-500">
                <Upload className="w-8 h-8" />
                <span className="text-sm font-medium">Upload task document (PDF, Image)</span>
              </div>
            )}
          </label>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isAnalyzing}
        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold flex items-center justify-center space-x-2 hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Analyzing Task...</span>
          </>
        ) : (
          <>
            <span>Analyze & Start Session</span>
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </motion.div>
  );
};
