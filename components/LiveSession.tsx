
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const DURATION_OPTIONS = [
  { label: '5m', value: 5 },
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: 'Manual', value: 0 },
];

interface LiveSessionProps {
  onSave?: (messages: { role: string; text: string }[]) => void;
}

const LiveSession: React.FC<LiveSessionProps> = ({ onSave }) => {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(30); // minutes, 0 is manual
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // seconds
  const [transcripts, setTranscripts] = useState<{ role: string; text: string }[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  // Helper: Encode to base64
  const encode = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Helper: Decode base64
  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  // Helper: Decode PCM to AudioBuffer
  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  const stopSession = useCallback(() => {
    if (transcripts.length > 0 && onSave) {
      onSave(transcripts);
    }
    setIsActive(false);
    setIsPaused(false);
    setTimeLeft(null);
    setTranscripts([]);
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    if (outputContextRef.current) outputContextRef.current.close();
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    sessionRef.current = null;
  }, [transcripts, onSave]);

  const startSession = async () => {
    try {
      setTranscripts([]);
      setIsActive(true);
      setIsPaused(false);
      
      if (selectedDuration > 0) {
        setTimeLeft(selectedDuration * 60);
      } else {
        setTimeLeft(null);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: 'You are Lumina, a live companion. Listen to the user’s routine sounds. Offer helpful, very brief observations or encouraging words only when appropriate. Be a "fly on the wall" life coach.',
        },
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              if (isPaused) return;

              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(s => {
                if (s) s.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription) {
              setCurrentInput(prev => prev + msg.serverContent!.inputTranscription!.text);
            }
            if (msg.serverContent?.outputTranscription) {
              setCurrentOutput(prev => prev + msg.serverContent!.outputTranscription!.text);
            }
            if (msg.serverContent?.turnComplete) {
              setTranscripts(prev => [
                ...prev, 
                { role: 'user', text: currentInput },
                { role: 'model', text: currentOutput }
              ]);
              setCurrentInput('');
              setCurrentOutput('');
            }

            const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && !isPaused) {
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000);
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error("Live Error:", e);
            stopSession();
          },
          onclose: () => {
            stopSession();
          },
        }
      });
      
      sessionRef.current = sessionPromise;
    } catch (err) {
      console.error("Failed to start session:", err);
      setIsActive(false);
    }
  };

  useEffect(() => {
    if (isActive && !isPaused && timeLeft !== null) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            stopSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, isPaused, timeLeft, stopSession]);

  useEffect(() => {
    transcriptScrollRef.current?.scrollTo({ top: transcriptScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [transcripts, currentInput, currentOutput]);

  const togglePause = () => {
    setIsPaused(prev => !prev);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-8 flex flex-col items-center justify-center space-y-6 border-b border-slate-50 bg-slate-50/50 relative overflow-hidden">
          
          <div className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-700 ${isActive ? (isPaused ? 'bg-amber-100' : 'bg-indigo-600 shadow-2xl shadow-indigo-200') : 'bg-slate-200'}`}>
            {isActive && !isPaused && (
              <>
                <div className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-20"></div>
                <div className="absolute inset-0 rounded-full bg-indigo-500 animate-pulse opacity-40" style={{ animationDelay: '0.2s' }}></div>
              </>
            )}
            <div className={`transition-all duration-300 ${isPaused ? 'scale-110' : 'scale-100'}`}>
              {isPaused ? (
                <svg className="w-12 h-12 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <div className="flex flex-col items-center">
                  <svg className={`w-12 h-12 transition-colors ${isActive ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  {isActive && timeLeft !== null && (
                    <span className="text-white text-[10px] font-bold mt-1 tracking-widest">{formatTime(timeLeft)}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="text-center z-10 w-full px-4">
            <h2 className="text-xl font-bold text-slate-800">
              {!isActive ? 'Session Duration' : isPaused ? 'Session Paused' : 'Lumina is Listening'}
            </h2>
            
            {!isActive ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setSelectedDuration(opt.value)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                      selectedDuration === opt.value 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                        : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 max-w-xs mx-auto mt-2 h-10">
                {isPaused 
                  ? 'I’m on standby. Tap play to resume monitoring your routine.' 
                  : 'I’m picking up your routine. Just go about your day and speak when you want to.'}
              </p>
            )}
          </div>

          <div className="flex gap-3 items-center">
            {isActive ? (
              <>
                <button
                  onClick={togglePause}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-md ${
                    isPaused 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100'
                  }`}
                >
                  {isPaused ? (
                    <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> Resume</>
                  ) : (
                    <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg> Pause</>
                  )}
                </button>
                <button
                  onClick={stopSession}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 transition-all shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> End
                </button>
              </>
            ) : (
              <button
                onClick={startSession}
                className="px-10 py-4 rounded-2xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                Go Live
              </button>
            )}
          </div>
        </div>

        <div ref={transcriptScrollRef} className="flex-1 p-6 overflow-y-auto space-y-4 bg-white font-mono text-xs relative">
          <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 flex items-center justify-between pb-2 mb-2 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isActive && !isPaused ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Transcript</span>
            </div>
            {isPaused && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">PAUSED</span>
            )}
            {isActive && timeLeft !== null && (
              <span className="text-[10px] font-bold text-indigo-600">{formatTime(timeLeft)} left</span>
            )}
          </div>
          
          {transcripts.map((t, i) => (
            <div key={i} className={`flex gap-3 animate-in slide-in-from-left-2 duration-300 ${t.role === 'user' ? 'text-slate-500' : 'text-indigo-600 font-semibold'}`}>
              <span className="shrink-0 opacity-40">[{t.role === 'user' ? 'YOU' : 'LUM'}]</span>
              <span className="break-words">{t.text}</span>
            </div>
          ))}
          
          {currentInput && (
            <div className="flex gap-3 text-slate-400 italic">
              <span className="shrink-0 opacity-40">[YOU]</span>
              <span>{currentInput}...</span>
            </div>
          )}
          
          {currentOutput && (
            <div className="flex gap-3 text-indigo-400 font-semibold italic">
              <span className="shrink-0 opacity-40">[LUM]</span>
              <span>{currentOutput}...</span>
            </div>
          )}

          {transcripts.length === 0 && !currentInput && !currentOutput && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300">
              <svg className="w-8 h-8 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span className="italic">No audio processed yet</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 group hover:shadow-md transition-all">
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Session Goal</p>
          <p className="text-xs font-medium text-indigo-700">
            {selectedDuration === 0 ? 'Monitoring flow' : `Optimizing next ${selectedDuration}m`}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 group hover:shadow-md transition-all">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Auto-Logging</p>
          <p className="text-xs font-medium text-emerald-700">Active (Tracking tasks verbally)</p>
        </div>
      </div>
    </div>
  );
};

export default LiveSession;
