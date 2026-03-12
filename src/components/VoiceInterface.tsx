import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceInterfaceProps {
  taskSummary: string;
  onTranscriptUpdate: (transcript: string) => void;
}

export const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ taskSummary, onTranscriptUpdate }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");

  const startSession = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are a Socratic Mentor. Guide the student through a voice conversation to demonstrate their understanding.
          
          TASK CONTEXT:
          ${taskSummary}
          
          RULES:
          1. DO NOT provide answers.
          2. Ask one question at a time.
          3. Start simple, then get complex.
          4. Be encouraging.
          5. Keep responses short for voice interaction.`,
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            setupAudioInput();
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              playAudio(base64Audio);
            }
            
            // Handle transcriptions
            // @ts-ignore - types might be slightly off for latest Live API
            if (message.serverContent?.modelTurn?.parts[0]?.text || message.outputAudioTranscription?.text) {
                // @ts-ignore
                const text = message.serverContent?.modelTurn?.parts[0]?.text || message.outputAudioTranscription?.text;
                if (text && !transcriptRef.current.endsWith(text)) {
                  transcriptRef.current += `\nMentor: ${text}`;
                  onTranscriptUpdate(transcriptRef.current);
                }
            }

            // User transcription
            // @ts-ignore
            if (message.inputAudioTranscription?.text) {
                // @ts-ignore
                const text = message.inputAudioTranscription.text;
                if (text && !transcriptRef.current.endsWith(text)) {
                  transcriptRef.current += `\nStudent: ${text}`;
                  onTranscriptUpdate(transcriptRef.current);
                }
            }
          },
          onclose: () => {
            setIsConnected(false);
            stopAudioInput();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection error. Please try again.");
            setIsConnecting(false);
          }
        }
      });
      
      sessionRef.current = session;
    } catch (err) {
      console.error("Failed to start voice session:", err);
      setError("Could not access microphone or connect to AI.");
      setIsConnecting(false);
    }
  };

  const setupAudioInput = async () => {
    if (!streamRef.current || !audioContextRef.current || !sessionRef.current) return;

    const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContextRef.current.destination);

    processor.onaudioprocess = (e) => {
      if (isMuted) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
      }
      
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
      sessionRef.current.sendRealtimeInput({
        media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
      });
    };
  };

  const stopAudioInput = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  const playAudio = async (base64Data: string) => {
    if (!audioContextRef.current) return;
    
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pcmData = new Int16Array(bytes.buffer);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 0x7FFF;
    }
    
    const buffer = audioContextRef.current.createBuffer(1, floatData.length, 16000);
    buffer.getChannelData(0).set(floatData);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  };

  const toggleMute = () => setIsMuted(!isMuted);

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
    }
    setIsConnected(false);
  };

  useEffect(() => {
    return () => stopSession();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6 bg-white rounded-2xl shadow-sm border border-slate-100">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-slate-800">Voice Conversation</h3>
        <p className="text-slate-500 text-sm">Speak naturally with your mentor to demonstrate your knowledge.</p>
      </div>

      <AnimatePresence mode="wait">
        {!isConnected ? (
          <motion.button
            key="start"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={startSession}
            disabled={isConnecting}
            className="w-24 h-24 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-200 hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {isConnecting ? <Loader2 className="w-10 h-10 animate-spin" /> : <Mic className="w-10 h-10" />}
          </motion.button>
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center space-y-6"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-brand-400 animate-ping opacity-20" />
              <div className="w-24 h-24 rounded-full bg-brand-500 text-white flex items-center justify-center relative z-10">
                <Volume2 className="w-10 h-10" />
              </div>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={toggleMute}
                className={cn(
                  "p-4 rounded-full transition-colors",
                  isMuted ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                )}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              <button
                onClick={stopSession}
                className="px-6 py-2 bg-slate-800 text-white rounded-full font-medium hover:bg-slate-900 transition-colors"
              >
                End Session
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
