import React, { useState, useRef, useEffect } from 'react';
import { LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAI } from '../services/ai';
import { KeyTermsList } from './KeyTermsList';

interface VoiceInterfaceProps {
  taskSummary: string;
  keyTerms: string[];
  onTranscriptUpdate: (transcript: string) => void;
  onSessionEnd?: () => void;
}

export const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ taskSummary, keyTerms, onTranscriptUpdate, onSessionEnd }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");

  const nextStartTimeRef = useRef<number>(0);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;
  };

  const startSession = async () => {
    setIsConnecting(true);
    setError(null);
    transcriptRef.current = "";
    setTranscript("");
    onTranscriptUpdate("");
    
    try {
      const ai = getAI();
      
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      console.log("Connecting to Gemini Live API...");
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.TEXT],
          inputAudioTranscription: {},
          systemInstruction: `You are a Socratic Mentor. Your goal is to help the student demonstrate their understanding of the task.
          
          TASK CONTEXT:
          ${taskSummary}
          
          RULES:
          1. DO NOT provide answers.
          2. Ask one question at a time.
          3. Start with a friendly greeting and ask the first question to get the student started.
          4. Respond ONLY with text. Do not generate audio.`,
        },
        callbacks: {
          onopen: () => {
            console.log("Live session opened successfully");
            setIsConnected(true);
            setIsConnecting(false);
            if (audioContextRef.current?.state === 'suspended') {
              audioContextRef.current.resume().then(() => {
                console.log("AudioContext resumed");
                setupAudioInput();
              });
            } else {
              setupAudioInput();
            }
          },
          onmessage: async (rawMessage: LiveServerMessage) => {
            const message = rawMessage as any;
            console.log("Live message received:", message);
            
            // Handle transcriptions from model
            const modelText = message.serverContent?.modelTurn?.parts?.find((p: any) => p.text)?.text;
            if (modelText) {
                console.log("Model text response:", modelText);
                if (!transcriptRef.current.endsWith(`Mentor: ${modelText}`)) {
                  transcriptRef.current += `\nMentor: ${modelText}`;
                  setTranscript(transcriptRef.current);
                  onTranscriptUpdate(transcriptRef.current);
                }
            }

            // User transcription (from model's transcription of user audio)
            if (message.inputAudioTranscription?.text) {
                const userText = message.inputAudioTranscription.text;
                console.log("User transcript:", userText);
                if (!transcriptRef.current.endsWith(`Student: ${userText}`)) {
                  transcriptRef.current += `\nStudent: ${userText}`;
                  setTranscript(transcriptRef.current);
                  onTranscriptUpdate(transcriptRef.current);
                }
            }
          },
          onclose: () => {
            console.log("Live session closed");
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
    if (!streamRef.current || !audioContextRef.current || !sessionRef.current) {
      console.warn("Cannot setup audio input: missing stream, context, or session");
      return;
    }

    console.log("Setting up AudioWorklet...");
    try {
      const workletCode = `
        class AudioProcessor extends AudioWorkletProcessor {
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input && input.length > 0) {
              const floatData = input[0];
              const pcmData = new Int16Array(floatData.length);
              for (let i = 0; i < floatData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, floatData[i])) * 0x7FFF;
              }
              this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
            }
            return true;
          }
        }
        registerProcessor('audio-processor', AudioProcessor);
      `;

      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await audioContextRef.current.audioWorklet.addModule(url);
      
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      const workletNode = new AudioWorkletNode(audioContextRef.current, 'audio-processor');

      let chunkCount = 0;
      workletNode.port.onmessage = (event) => {
        if (isMutedRef.current || !sessionRef.current) return;
        
        const arrayBuffer = event.data;
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // More efficient base64 conversion
        let binary = "";
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binary);
        
        if (chunkCount % 100 === 0) {
          console.log("Sending audio chunk to Gemini...");
        }
        chunkCount++;

        sessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      source.connect(workletNode);
      // We don't need to connect to destination as we only want to capture
      console.log("AudioWorklet setup complete and connected");
    } catch (e) {
      console.error("Failed to setup AudioWorklet:", e);
      setupAudioInputFallback();
    }
  };

  const setupAudioInputFallback = () => {
    if (!streamRef.current || !audioContextRef.current || !sessionRef.current) return;
    console.log("Falling back to ScriptProcessor...");

    const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    const silentGain = audioContextRef.current.createGain();
    silentGain.gain.value = 0;
    processor.connect(silentGain);
    silentGain.connect(audioContextRef.current.destination);

    processor.onaudioprocess = (e) => {
      if (isMutedRef.current || !sessionRef.current) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
      }
      
      const uint8Array = new Uint8Array(pcmData.buffer);
      let binary = "";
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Data = btoa(binary);
      
      sessionRef.current.sendRealtimeInput({
        media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
      });
    };
  };

  const stopAudioInput = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
    }
    setIsConnected(false);
    if (onSessionEnd) {
      onSessionEnd();
    }
  };

  useEffect(() => {
    return () => stopSession();
  }, []);

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-6 bg-white rounded-3xl shadow-sm border border-slate-100">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-slate-800">Voice Conversation</h3>
              <p className="text-slate-500">Speak naturally with your mentor to demonstrate your knowledge.</p>
            </div>
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
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <motion.div
              key="active"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2 flex flex-col items-center space-y-6 p-8 bg-white rounded-3xl shadow-sm border border-slate-100"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-brand-400 animate-ping opacity-20" />
                <div className="w-24 h-24 rounded-full bg-brand-500 text-white flex items-center justify-center relative z-10">
                  <Mic className="w-10 h-10" />
                </div>
              </div>

              <div className="w-full max-h-[400px] overflow-y-auto p-6 bg-slate-50 rounded-2xl space-y-4 text-left border border-slate-100">
                {transcript.split('\n').filter(Boolean).map((line, i) => (
                  <div key={i} className={`p-4 rounded-2xl text-sm leading-relaxed ${line.startsWith('Mentor:') ? 'bg-white border border-slate-100 text-slate-800 shadow-sm' : 'bg-brand-50 text-brand-800 ml-8'}`}>
                    <span className="font-bold mr-2">{line.split(':')[0]}:</span>
                    {line.split(':').slice(1).join(':')}
                  </div>
                ))}
                {transcript === "" && (
                  <p className="text-slate-400 text-center italic py-8">Waiting for mentor to start...</p>
                )}
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
                  className="px-8 py-3 bg-slate-800 text-white rounded-full font-bold hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200"
                >
                  End Session
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="h-full"
            >
              <KeyTermsList terms={keyTerms} transcript={transcript} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {error && <p className="mt-4 text-red-500 text-sm text-center font-medium">{error}</p>}
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
