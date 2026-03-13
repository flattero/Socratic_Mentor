import React, { useState, useRef, useEffect } from 'react';
import { LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAI } from '../services/ai';

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

  const nextStartTimeRef = useRef<number>(0);

  const startSession = async () => {
    setIsConnecting(true);
    setError(null);
    transcriptRef.current = "";
    onTranscriptUpdate("");
    
    try {
      const ai = getAI();
      
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
          systemInstruction: `You are a Socratic Mentor. Your goal is to help the student demonstrate their understanding of the task.
          
          TASK CONTEXT:
          ${taskSummary}
          
          RULES:
          1. DO NOT provide answers.
          2. Ask one question at a time.
          3. Start with a friendly greeting and ask the first question to get the student started.
          4. Keep responses concise for voice interaction.`,
        },
        callbacks: {
          onopen: () => {
            console.log("Live session opened");
            setIsConnected(true);
            setIsConnecting(false);
            if (audioContextRef.current?.state === 'suspended') {
              audioContextRef.current.resume();
            }
            setupAudioInput();
          },
          onmessage: async (rawMessage: LiveServerMessage) => {
            const message = rawMessage as any;
            console.log("Live message received:", message);
            
            // Handle audio output
            const audioData = message.serverContent?.modelTurn?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
            if (audioData) {
              playAudio(audioData);
            }
            
            // Handle transcriptions
            const modelText = message.serverContent?.modelTurn?.parts?.find((p: any) => p.text)?.text || message.outputAudioTranscription?.text;
            if (modelText) {
                if (!transcriptRef.current.includes(`Mentor: ${modelText}`)) {
                  transcriptRef.current += `\nMentor: ${modelText}`;
                  onTranscriptUpdate(transcriptRef.current);
                }
            }

            // User transcription
            if (message.inputAudioTranscription?.text) {
                const userText = message.inputAudioTranscription.text;
                if (!transcriptRef.current.includes(`Student: ${userText}`)) {
                  transcriptRef.current += `\nStudent: ${userText}`;
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
    if (!streamRef.current || !audioContextRef.current || !sessionRef.current) return;

    try {
      const workletCode = `
        class AudioProcessor extends AudioWorkletProcessor {
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input.length > 0) {
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

      workletNode.port.onmessage = (event) => {
        if (isMuted || !sessionRef.current) return;
        
        const arrayBuffer = event.data;
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binary);
        
        sessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      source.connect(workletNode);
      workletNode.connect(audioContextRef.current.destination);
    } catch (e) {
      console.error("Failed to setup AudioWorklet:", e);
      // Fallback to ScriptProcessor if Worklet fails
      setupAudioInputFallback();
    }
  };

  const setupAudioInputFallback = () => {
    if (!streamRef.current || !audioContextRef.current || !sessionRef.current) return;

    const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    const silentGain = audioContextRef.current.createGain();
    silentGain.gain.value = 0;
    processor.connect(silentGain);
    silentGain.connect(audioContextRef.current.destination);

    processor.onaudioprocess = (e) => {
      if (isMuted || !sessionRef.current) return;
      
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

  const playAudio = async (base64Data: string) => {
    if (!audioContextRef.current) return;
    
    try {
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
      
      const now = audioContextRef.current.currentTime;
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now;
      }
      
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;
    } catch (e) {
      console.error("Error playing audio chunk:", e);
    }
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
