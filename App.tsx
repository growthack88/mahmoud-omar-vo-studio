import React, { useState, useRef, useEffect } from 'react';
import { DIALECTS, VOICE_TYPES, VOICE_FIELDS, CATEGORY_STYLES, getBaseVoiceForType, VoiceProfile, STUDIO_CONTROLS } from './constants';
import { GenerationHistory, VoiceControls, AudiobookProject, VoiceFingerprint, NarrationSegment } from './types';
import { savioService, PodcastTurn, PodcastScriptResult, SegmentSuggestion, SpeakerProfile } from './services/geminiService';

// --- Types & Constants ---
type AppMode = 'home' | 'audiobook' | 'podcast' | 'transcript';
type AudiobookMode = 'none' | 'new' | 'import' | 'script' | 'multi' | 'pilot' | 'production';
type PodcastSource = 'upload' | 'manual';
type PodcastDistributionMode = 'smart' | 'manual';
type TranscriptionStatus = 'idle' | 'transcribing' | 'completed';

interface HistoryItem {
  id: string;
  voiceName: string;
  dialect: string;
  category: string;
  timestamp: number;
  url: string;
}

const WORKFLOW_STEPS = [
  { id: 'new', label: 'المشروع' },
  { id: 'import', label: 'استيراد النص' },
  { id: 'script', label: 'تجهيز النص' },
  { id: 'multi', label: 'توزيع وتوزيع النص' },
  { id: 'pilot', label: 'مقطع تجريبي' },
  { id: 'production', label: 'الإنتاج النهائي' }
];

const PREVIEW_SCRIPTS: Record<string, string> = {
  ads: 'دلوقتي تقدر توصل فكرتك بصوت واضح ومؤثر يخلي رسالتك توصل بسهولة.',
  doc: 'في هذا الفيلم الوثائقي، نستعرض رحلة مليئة بالتفاصيل والحقائق.',
  podcast: 'أهلاً بيكم، النهارده هنتكلم عن موضوع مهم بشكل بسيط وهادئ.',
  novels: 'وفي ليلة هادئة، بدأت الحكاية من حيث لم يتوقع أحد.',
  corporate: 'نحن نؤمن بتقديم حلول مبتكرة تساعد عملاءنا على النجاح.',
  cartoon: 'يلا بينا نبدأ المغامرة ونشوف إيه اللي هيحصل!',
  youtube: 'أهلاً يا أصدقاء، فيديو النهارده هيكون مميز جداً، خليكم معانا.',
  drama: 'الأحداث تتسارع، والغموض يلف المكان، ماذا سيحدث غداً؟',
  edu: 'في هذا الدرس، سنتعلم مهارات جديدة تساعدنا في تطوير ذواتنا.'
};

// --- Typewriter Component ---
const TypewriterText: React.FC<{ text: string }> = ({ text }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    let currentText = '';
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        currentText += text[index];
        setDisplayedText(currentText);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 25);
    return () => {
      clearInterval(interval);
      setDisplayedText('');
    };
  }, [text]);

  return <span>{displayedText}</span>;
};

// --- Auxiliary Components ---

const NeumorphicSocialIcon: React.FC<{ 
  platform: 'facebook' | 'instagram' | 'tiktok';
  href: string;
  src: string;
}> = ({ platform, href, src }) => {
  const animationClass = {
    facebook: 'animate-float-fb',
    instagram: 'animate-float-ig',
    tiktok: 'animate-float-tt'
  }[platform];

  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`relative w-12 h-12 flex items-center justify-center transition-all duration-300 ${animationClass}`}
    >
      <img src={src} alt={platform} className="w-full h-full object-contain" />
    </a>
  );
};

const EdgeMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300);
  };

  return (
    <div 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative z-[100] flex flex-col items-center pointer-events-auto"
    >
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="h-1.5 w-10 cursor-pointer rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(212,175,55,0.25)] bg-amber-500/40 hover:bg-amber-500 hover:w-14"
      />
      <div 
        className={`mt-3 bg-[#0a0a0a]/98 backdrop-blur-3xl border border-white/5 shadow-[0_40px_80px_rgba(0,0,0,0.9)] flex flex-col p-5 rounded-3xl origin-top w-52 transition-all duration-[400ms] cubic-bezier(0.4, 0, 0.2, 1) ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-4 pointer-events-none'}`}
      >
        <div className="mb-4 text-right">
          <h4 className="text-[10px] font-black gold-text uppercase tracking-[0.2em]">خدمات أخرى</h4>
          <div className="h-0.5 w-6 bg-amber-500/30 mt-1 mr-0 ml-auto rounded-full"></div>
        </div>
        <div className="flex flex-col gap-2.5">
          <a 
            href="https://www.minimax.io/audio/voices-cloning" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl bg-white/2 border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 group/item transition-all duration-300 text-right"
          >
            <div className="flex items-center gap-2.5 flex-row-reverse">
              <div className="w-7 h-7 rounded-lg bg-amber-500/5 flex items-center justify-center text-amber-500/70 group-hover/item:scale-110 group-hover/item:text-amber-500 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.183.394l-1.44 1.08a2 2 0 00-.595.89c.027.669.51 1.253 1.154 1.407l3.59.854a.5.5 0 00.118 0l11.93-2.833a.5.5 0 00.27-.874l-1.466-1.101zM12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" /></svg>
              </div>
              <span className="text-[11px] font-bold text-white/40 group-hover/item:text-white">استنساخ الصوت</span>
            </div>
          </a>
          <a 
            href="https://podcast.adobe.com/en/enhance" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl bg-white/2 border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 group/item transition-all duration-300 text-right"
          >
            <div className="flex items-center gap-2.5 flex-row-reverse">
              <div className="w-7 h-7 rounded-lg bg-amber-500/5 flex items-center justify-center text-amber-500/70 group-hover/item:scale-110 group-hover/item:text-amber-500 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>
              </div>
              <span className="text-[11px] font-bold text-white/40 group-hover/item:text-white">عزل الضجيج</span>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

// --- Helpers ---
const formatTime = (time: number) => {
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// --- Unified Audio Player Component ---
const UnifiedAudioPlayer: React.FC<{ 
  url: string; 
  title?: string; 
  subtitle?: string;
  showShare?: boolean;
  onDownload?: void;
}> = ({ url, title, subtitle, showShare = false, onDownload }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnd = () => setIsPlaying(false);
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnd);
    
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnd);
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.volume = val;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const handleReplay = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
    setIsPlaying(true);
  };

  const handleWhatsAppShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], `${title || 'savio_audio'}.wav`, { type: 'audio/wav' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title || 'سافيو ستوديو VO',
          text: 'استمع إلى التعليق الصوتي المولد عبر سافيو ستوديو VO'
        });
      } else {
        const text = encodeURIComponent(`استمع إلى التعليق الصوتي: ${window.location.href}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
      }
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl p-10 rounded-[50px] bg-white/5 border border-white/10 space-y-10 shadow-3xl relative backdrop-blur-3xl animate-in zoom-in duration-500">
      <audio ref={audioRef} src={url} className="hidden" />
      <div className="flex items-center justify-between flex-row-reverse border-b border-white/5 pb-8">
        <div className="text-right">
          {title && <h4 className="font-bold text-2xl text-white mb-1">{title}</h4>}
          {subtitle && <p className="text-[10px] text-amber-500 font-bold tracking-[0.2em] uppercase">{subtitle}</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={handleReplay} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/50 text-white/40 hover:text-amber-500 transition-all" title="إعادة التشغيل">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          
          {showShare && (
            <button onClick={handleWhatsAppShare} disabled={isSharing} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-[#25D366]/50 text-white/40 hover:text-[#25D366] transition-all disabled:opacity-30" title="مشاركة عبر واتساب">
              {isSharing ? <div className="w-5 h-5 border-2 border-t-transparent border-white/20 rounded-full animate-spin"></div> : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>}
            </button>
          )}

          <button onClick={() => { if(onDownload) (onDownload as any)(); else { const a = document.createElement('a'); a.href = url; a.download = `${title || 'savio_audio'}.wav`; a.click(); } }} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/50 text-white/40 hover:text-amber-500 transition-all" title="تحميل الملف">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-10 flex-row-reverse">
        <button onClick={togglePlay} className="h-20 w-20 rounded-full gold-bg text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-[0_15px_30px_rgba(212,175,55,0.3)]">
          {isPlaying ? <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="h-8 w-8 translate-x-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
        </button>
        
        <div className="flex-1 w-full space-y-4">
          <div className="flex justify-between items-center flex-row-reverse text-[9px] font-bold text-white/20 tracking-[0.2em] uppercase">
            <span>{formatTime(duration)}</span>
            <span>{formatTime(currentTime)}</span>
          </div>
          <div className="relative group h-6 flex items-center">
            <input type="range" min="0" max={duration || 0} step="0.01" value={currentTime} onChange={handleSeek} className="absolute inset-0 w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer outline-none" style={{ background: `linear-gradient(to left, #d4af37 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.05) ${(currentTime / (duration || 1)) * 100}%)`, direction: 'rtl' }} />
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/2 px-5 py-3 rounded-2xl border border-white/5">
          <button onClick={() => { if(audioRef.current) audioRef.current.muted = !isMuted; setIsMuted(!isMuted); }} className="text-white/30 hover:text-amber-500 transition-colors">
            {isMuted || volume === 0 ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>}
          </button>
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className="w-20 h-0.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500" />
        </div>
      </div>
    </div>
  );
};

// --- Main App Logic ---
const playCompletionSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    console.warn("Audio feedback blocked");
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

const mergeAudioSegments = async (audioUrls: string[]): Promise<string> => {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const buffers = await Promise.all(
    audioUrls.map(async (url) => {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await audioCtx.decodeAudioData(arrayBuffer);
    })
  );
  const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
  const masterBuffer = audioCtx.createBuffer(1, totalLength, buffers[0].sampleRate);
  let offset = 0;
  const masterData = masterBuffer.getChannelData(0);
  for (const buf of buffers) {
    masterData.set(buf.getChannelData(0), offset);
    offset += buf.length;
  }
  const wavBlob = audioBufferToWavBlob(masterBuffer);
  return URL.createObjectURL(wavBlob);
};

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  let pos = 0;
  function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }
  function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan); setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);
  const channels = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  let offset = 0;
  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
      view.setInt16(pos, sample, true); pos += 2;
    }
    offset++;
  }
  return new Blob([outBuffer], { type: "audio/wav" });
}

const GenderIcon = ({ gender, className }: { gender: string, className?: string }) => {
  if (gender === 'male' || gender === 'ذكر') return <svg className={className} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>;
  return <svg className={className} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /><path d="M10 12l-2 2h4l-2-2z" /></svg>;
};

const CategoryIcon = ({ type, className }: { type: string, className?: string }) => {
  switch (type) {
    case 'mic-documentary': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>;
    case 'mic-ads': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>;
    case 'mic-kids': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case 'mic-podcast': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case 'mic-book': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.247 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
    case 'mic-youtube': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
    case 'mic-transcript': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>;
    default: return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>;
  }
};

const CinematicIntro: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [stage, setStage] = useState<'titles' | 'reveal' | 'fadeout'>('titles');
  useEffect(() => {
    const timer1 = setTimeout(() => setStage('reveal'), 2500);
    const timer2 = setTimeout(() => setStage('fadeout'), 5000);
    const timer3 = setTimeout(onComplete, 6000);
    return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
  }, [onComplete]);
  return (
    <div className={`fixed inset-0 z-[100] bg-[#050505] overflow-hidden flex items-center justify-center transition-opacity duration-1000 ${stage === 'fadeout' ? 'opacity-0 blur-2xl' : 'opacity-100'}`}>
      <div className="relative z-10 text-center">
        <div className={`${stage === 'titles' ? 'animate-cinematic' : 'opacity-0 transition-opacity duration-1000'}`}>
          <h2 className="android-tech-logo text-6xl md:text-8xl">SAVIO</h2>
          <div className="android-subtitle text-sm md:text-base">VOICE OVER</div>
        </div>
      </div>
    </div>
  );
};

const ControlGroup: React.FC<{ id: string; title: string; options: { label: string; desc: string }[]; current: string; onChange: (val: string) => void; disabled?: boolean; }> = ({ title, options, current, onChange, disabled }) => (
  <div className={`space-y-4 text-right group transition-opacity duration-300 ${disabled ? 'opacity-50' : ''}`}>
    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] group-hover:text-amber-500/50 transition-colors">{title}</label>
    <div className="grid grid-cols-1 gap-2.5">
      {options.map(opt => (
        <button 
          key={opt.label} 
          disabled={disabled}
          onClick={() => onChange(opt.label)} 
          className={`relative p-4 rounded-2xl border text-right transition-all duration-500 overflow-hidden ${disabled ? 'cursor-not-allowed' : ''} ${current === opt.label ? 'border-amber-500/50 bg-amber-500/10 text-white shadow-lg' : 'border-white/5 bg-white/5 text-white/30 hover:bg-white/10 hover:border-white/10'}`}
        >
          {current === opt.label && <div className="absolute top-0 right-0 w-1 h-full bg-amber-500"></div>}
          <div className="flex justify-between items-center mb-1 flex-row-reverse"><span className={`text-sm font-bold ${current === opt.label ? 'text-amber-500' : 'text-white/60'}`}>{opt.label}</span></div>
          <p className="text-[10px] text-white/30 leading-relaxed line-clamp-2">{opt.desc}</p>
        </button>
      ))}
    </div>
  </div>
);

const App: React.FC = () => {
  const [showIntro, setShowIntro] = useState<boolean>(() => sessionStorage.getItem('savio_intro_played') !== 'true');
  const [appMode, setAppMode] = useState<AppMode>('home');
  const [selectedDialectId, setSelectedDialectId] = useState<string>(DIALECTS[0].id);
  const [selectedType, setSelectedType] = useState<string>(VOICE_TYPES[0]);
  const [selectedGender, setSelectedGender] = useState<string>('ذكر');
  const [selectedFieldId, setSelectedFieldId] = useState<string>(VOICE_FIELDS[0].id);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [voiceControls, setVoiceControls] = useState<VoiceControls>({ temp: 'متوازن', emotion: 'متوسط', speed: 'متوسطة', depth: 'متوسطة', pitch: 'متوسطة', drama: 'متوسط', purpose: '' });
  const [inputText, setInputText] = useState<string>('');
  const [processedText, setProcessedText] = useState<string>('');
  const [isPreprocessing, setIsPreprocessing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [isVoiceLocked, setIsVoiceLocked] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<GenerationHistory | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const previewAudioRef = useRef<HTMLAudioElement>(new Audio());
  const [activeProject, setActiveProject] = useState<AudiobookProject | null>(null);
  const [audiobookWorkspaceMode, setAudiobookWorkspaceMode] = useState<AudiobookMode>('none');
  const [importTextBuffer, setImportTextBuffer] = useState('');
  const [showImportSuccess, setShowImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isScriptEnhancing, setIsScriptEnhancing] = useState(false);
  const [showScriptSaveSuccess, setShowScriptSaveSuccess] = useState(false);
  const [isAutoDistributing, setIsAutoDistributing] = useState(false);
  const [showAutoSuccess, setShowAutoSuccess] = useState(false);
  const [showMultiSaveSuccess, setShowMultiSaveSuccess] = useState(false);
  const [pilotLoadingId, setPilotLoadingId] = useState<number | null>(null);
  const [productionProgress, setProductionProgress] = useState(0);
  const [productionPhase, setProductionPhase] = useState<'idle' | 'generating' | 'completed'>('idle');
  const [masterAudioUrl, setMasterAudioUrl] = useState<string | null>(null);
  const [hoveredStudio, setHoveredStudio] = useState<string | null>(null);
  const [showFingerprintPanel, setShowFingerprintPanel] = useState(false);
  const [fingerprintConfirmation, setFingerprintConfirmation] = useState(false);
  const [voiceFingerprint, setVoiceFingerprint] = useState<VoiceFingerprint>({
    name: '',
    style: 'رسمي',
    rhythm: 'متوسط',
    narrative: 'مباشر',
    isActive: false
  });
  
  // Pivot Sentence state
  const [keySentences, setKeySentences] = useState<string[]>([]);
  const [isAnalyzingKey, setIsAnalyzingKey] = useState(false);

  // Clear pivot sentences on edit
  useEffect(() => {
    if (keySentences.length > 0) setKeySentences([]);
  }, [inputText, processedText]);

  // Podcast Studio States
  const [podcastSourceType, setPodcastSourceType] = useState<PodcastSource>('upload');
  const [manualPodcastText, setManualPodcastText] = useState('');
  const [podcastDialectId, setPodcastDialectId] = useState('egyptian');
  const [isAnalyzingPodcast, setIsAnalyzingPodcast] = useState(false);
  const [isGeneratingPodcastAudio, setIsGeneratingPodcastAudio] = useState(false);
  const [podcastScript, setPodcastScript] = useState<PodcastTurn[] | null>(null);
  const [podcastSpeakers, setPodcastSpeakers] = useState<SpeakerProfile[]>([]);
  const [podcastAudioUrl, setPodcastAudioUrl] = useState<string | null>(null);
  const [podcastProgress, setPodcastProgress] = useState(0);
  const [audio_generated, setAudio_generated] = useState(false);
  const [isPodcastDistributed, setIsPodcastDistributed] = useState(false);
  const [speakerVoiceMap, setSpeakerVoiceMap] = useState<Record<string, string>>({});
  const [podcastDistMode, setPodcastDistMode] = useState<PodcastDistributionMode>('smart');

  // Transcript Studio States
  const [transcriptFile, setTranscriptFile] = useState<{ raw: File, name: string, type: string } | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatus>('idle');
  const [transcriptResult, setTranscriptResult] = useState('');
  const [useTimestamps, setUseTimestamps] = useState(false);
  const [exportFormat, setExportFormat] = useState<'txt' | 'srt' | 'docx'>('txt');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const transcriptInputRef = useRef<HTMLInputElement>(null);

  const selectedDialect = DIALECTS.find(d => d.id === selectedDialectId) || DIALECTS[0];
  const selectedField = VOICE_FIELDS.find(f => f.id === selectedFieldId) || VOICE_FIELDS[0];
  const allVoicesFlattened = DIALECTS.flatMap(d => d.profiles);

  // Auto-stop preview
  useEffect(() => {
    const audio = previewAudioRef.current;
    const handleEnded = () => setActivePreviewId(null);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, []);

  const podcastDialectVoices = DIALECTS.find(d => d.id === podcastDialectId)?.profiles || [];
  
  useEffect(() => {
    if (appMode === 'podcast' && podcastDialectVoices.length > 1) {
      setPodcastScript(null);
      setPodcastSpeakers([]);
      setPodcastAudioUrl(null);
      setAudio_generated(false);
      setIsPodcastDistributed(false);
      setSpeakerVoiceMap({});
    }
  }, [podcastDialectId, appMode]);

  const filteredProfiles = (selectedType === 'كبار السن' 
    ? DIALECTS.flatMap(d => d.profiles) 
    : selectedDialect.profiles
  ).filter((p, index, self) => {
    if (self.findIndex(t => t.id === p.id) !== index) return false;
    const matchesType = p.voiceType === selectedType;
    const matchesGender = p.gender === (selectedGender === 'ذكر' ? 'male' : 'female');
    return matchesType && matchesGender;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsReadingFile(true);
    setUploadedFileName(file.name);
    try {
      const base64 = await fileToBase64(file);
      const extractedText = await savioService.extractTextFromFile(base64, file.type);
      setImportTextBuffer(extractedText);
    } catch (err: any) {
      setError(err.message || "فشل استخراج النص");
    } finally {
      setIsReadingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleTranscriptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setError("هذا القسم يدعم الملفات الصوتية فقط");
      if (e.target) e.target.value = '';
      return;
    }
    setTranscriptionStatus('idle');
    setTranscriptFile({ raw: file, name: file.name, type: file.type });
    setTranscriptResult('');
    if (e.target) e.target.value = '';
  };

  const handleStartTranscription = async () => {
    if (!transcriptFile) return;
    setTranscriptionStatus('transcribing');
    setError(null);
    try {
      const base64 = await fileToBase64(transcriptFile.raw);
      const result = await savioService.transcribeMedia(base64, transcriptFile.type, useTimestamps, 'Auto');
      setTranscriptResult(result);
      setTranscriptionStatus('completed');
    } catch (err: any) {
      setTranscriptionStatus('idle');
      setError(err.message || "فشل في عملية التفريغ.");
    }
  };

  const handleQuickCopy = () => {
    if (!transcriptResult) return;
    navigator.clipboard.writeText(transcriptResult);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const exportTranscript = (format: 'txt' | 'srt' | 'docx') => {
    if (!transcriptResult) return;
    let content = transcriptResult;
    let mime = 'text/plain';
    let ext = format;
    if (format === 'docx') {
      content = `<!DOCTYPE html><html><body><div style="direction:rtl; font-family: 'Amiri', serif;">${transcriptResult.replace(/\n/g, '<br>')}</div></body></html>`;
      mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `savio_transcript_${transcriptFile?.name || 'result'}.${ext}`;
    a.click();
  };

  const handleVoicePreview = async (e: React.MouseEvent | React.TouchEvent, profile: VoiceProfile) => {
    e.stopPropagation();
    const audio = previewAudioRef.current;
    if (activePreviewId === profile.id) { audio.pause(); setActivePreviewId(null); return; }
    audio.pause();
    setIsPreviewLoading(true);
    setActivePreviewId(profile.id);
    setError(null);
    try {
      const previewText = PREVIEW_SCRIPTS[profile.categoryKey] || "أهلاً بك في استوديو سافيو. هذا نموذج لبصمة صوتي المميزة.";
      const baseVoice = getBaseVoiceForType(profile.voiceType, profile.gender);
      const audioUrl = await savioService.generateVoiceOver(previewText, baseVoice, profile, voiceControls, "Identity Preview", activeProject?.dialectId || podcastDialectId);
      audio.src = audioUrl;
      await audio.play();
    } catch {
      setActivePreviewId(null);
      setError("الصوت المختار غير متاح حاليًا");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleHistoryPlay = (url: string, id: string) => {
    const audio = previewAudioRef.current;
    if (activePreviewId === id) { audio.pause(); setActivePreviewId(null); return; }
    audio.pause();
    setActivePreviewId(id);
    audio.src = url;
    audio.play();
  };

  const handleAutoDistributeVoices = async () => {
    if (!activeProject) return;
    
    const sourceText = activeProject.enhancedContent || activeProject.content;
    if (!sourceText || sourceText.trim().length === 0) {
      setError("لا يوجد نص متاح لتوزيع الأصوات");
      return;
    }

    setIsAutoDistributing(true);
    setError(null);

    try {
      // Step 1 & 2: Use Gemini to analyze and split the text into narrative segments
      const suggestions: SegmentSuggestion[] = await savioService.analyzeAndSegmentText(sourceText);
      
      // Step 3: Map suggestions to available profiles consistently within the inherited dialect
      const availableVoices = DIALECTS.find(d => d.id === activeProject.dialectId)?.profiles || allVoicesFlattened;
      const roleVoiceMap: Record<string, string> = {};
      
      const newSegments = suggestions.map((sug, idx) => {
        if (!roleVoiceMap[sug.role]) {
          // Find a voice for this role within the selected dialect
          let voice: VoiceProfile | undefined;
          if (sug.role.includes("الراوي")) {
            voice = availableVoices.find(v => v.categoryKey === 'novels' || v.categoryKey === 'doc');
          } else {
            // For characters, pick somewhat randomly but consistently for that role name
            const roleHash = sug.role.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            voice = availableVoices[roleHash % availableVoices.length];
          }
          roleVoiceMap[sug.role] = voice?.name || availableVoices[0].name;
        }

        return {
          id: Date.now() + idx,
          label: sug.label,
          role: sug.role,
          selectedVoice: roleVoiceMap[sug.role],
          content: sug.text
        };
      });

      updateActiveProject({ segments: newSegments });
      setShowAutoSuccess(true);
    } catch (err) {
      setError("حدث خطأ أثناء التوزيع التلقائي الذكي");
    } finally {
      setIsAutoDistributing(false);
      setTimeout(() => setShowAutoSuccess(false), 2000);
    }
  };

  const handleIdentifyPivotSentences = async () => {
    const targetText = processedText.trim() || inputText.trim();
    if (!targetText) return;
    
    setIsAnalyzingKey(true);
    try {
      const sentences = await savioService.identifyKeySentences(targetText);
      setKeySentences(sentences);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzingKey(false);
    }
  };

  const initializeNewProject = () => {
    setActiveProject({ 
      id: Math.random().toString(36).substr(2, 9), 
      name: '', 
      dialectId: selectedDialectId,
      status: 'مسودة', 
      createdAt: Date.now(), 
      lastEdited: Date.now(), 
      content: '', 
      enhancedContent: '', 
      segments: [{ id: 1, label: 'مقدمة الراوي', role: 'الراوي', selectedVoice: '', content: '' }] 
    });
    setAudiobookWorkspaceMode('new'); setAppMode('home'); setImportTextBuffer(''); setShowImportSuccess(false); setShowScriptSaveSuccess(false); setProductionPhase('idle');
  };

  const updateActiveProject = (updates: Partial<AudiobookProject>) => { if (activeProject) setActiveProject({ ...activeProject, ...updates, lastEdited: Date.now() }); };

  const handleGeneratePodcastScript = async () => {
    const content = manualPodcastText;
    if (!content || !content.trim()) { setError("يرجى إدخال النص أولاً للتحليل."); return; }
    
    setIsAnalyzingPodcast(true);
    // Reset production audio/distributed state but NOT speakers if we want to adapt
    setPodcastAudioUrl(null);
    setAudio_generated(false);
    setIsPodcastDistributed(false);
    setError(null);
    
    try {
      const dialectName = DIALECTS.find(d => d.id === podcastDialectId)?.title || "فصحى";
      // Pass existing speakers so AI can adapt
      const result: PodcastScriptResult = await savioService.generatePodcastScript(content, dialectName, podcastDialectId, podcastSpeakers);
      if (result.error) { setError(result.error); setIsAnalyzingPodcast(false); return; }
      
      setPodcastScript(result.turns);
      
      // Update speakers: Merge new AI suggestions while keeping user-modified ones
      setPodcastSpeakers(prev => {
        const merged = [...prev];
        result.speakers.forEach(newS => {
          const idx = merged.findIndex(oldS => oldS.id === newS.id);
          if (idx === -1) {
            merged.push(newS);
          } else {
            // If it already exists, Gemini returned our original speaker.
            // We keep our local speaker version which may have edits.
          }
        });
        return merged;
      });

      // Smart Distribution mapping (only for new speakers with no assignment)
      setSpeakerVoiceMap(prev => {
        const newMap = { ...prev };
        const usedVoiceIds = new Set(Object.values(newMap));

        result.speakers.forEach(s => {
          if (!newMap[s.id]) {
            let matches = podcastDialectVoices.filter(v => (s.gender === 'any' || v.gender === s.gender));
            let bestMatches = matches.filter(v => v.categoryKey === s.categoryHint);
            if (bestMatches.length === 0) bestMatches = matches;
            let selected = bestMatches.find(v => !usedVoiceIds.has(v.id)) || bestMatches[0];
            if (selected) {
               newMap[s.id] = selected.id;
               usedVoiceIds.add(selected.id);
            }
          }
        });
        return newMap;
      });
      
      setPodcastDistMode('smart');

    } catch (err: any) {
      setError(err.message || "تعذر تحليل المحتوى.");
    } finally {
      setIsAnalyzingPodcast(false);
    }
  };

  const handleGeneratePodcastAudio = async () => {
    if (!podcastScript || podcastScript.length === 0) return;
    setIsGeneratingPodcastAudio(true);
    setPodcastProgress(0);
    setPodcastAudioUrl(null);
    setAudio_generated(false);
    setError(null);
    try {
      const audioParts: string[] = [];
      for (let i = 0; i < podcastScript.length; i++) {
        const turn = podcastScript[i];
        const voiceId = speakerVoiceMap[turn.speakerId];
        const profile = podcastDialectVoices.find(v => v.id === voiceId);
        if (!profile) throw new Error("يجب اختيار أصوات صحيحة لكافة الشخصيات.");
        
        const voiceName = getBaseVoiceForType(profile.voiceType, profile.gender);
        const url = await savioService.generateVoiceOver(turn.text, voiceName, profile, voiceControls, "Podcast Audio Production", podcastDialectId);
        audioParts.push(url);
        setPodcastProgress(Math.round(((i + 1) / podcastScript.length) * 100));
      }
      const masterUrl = await mergeAudioSegments(audioParts);
      setPodcastAudioUrl(masterUrl);
      setAudio_generated(true);
    } catch (err: any) {
      setError("حدث خطأ أثناء توليد البودكاست الصوتي.");
    } finally {
      setIsGeneratingPodcastAudio(false);
    }
  };

  const handleStartTTSSynthesis = async () => {
    if (isGenerating) return;

    // Hide pivot hint on start
    setKeySentences([]);

    const targetText = (processedText.trim() || inputText.trim());
    const activeVoice = filteredProfiles.find(p => p.name === selectedVoiceName); 
    
    if (!targetText) {
      setError("يرجى إدخال النص أولاً لبدء الإنتاج");
      return;
    }
    
    if (!activeVoice) { 
      setError("يرجى اختيار صوت أولاً من المعرض وتثبيته"); 
      return; 
    }

    setIsGenerating(true); 
    setGenerationProgress(5);
    setGenerationStatus('جاري تهيئة المحرك...');
    setError(null);

    const frozenText = targetText;
    const frozenVoiceProfile = { ...activeVoice };
    const frozenControls = { ...voiceControls };
    const frozenDialectId = selectedDialectId;
    const frozenVoiceType = selectedType;
    const frozenBaseVoice = getBaseVoiceForType(frozenVoiceType, frozenVoiceProfile.gender);

    let performanceNote = "Manual Studio Session (Synthesis Mode)";
    if (voiceFingerprint.isActive) {
      performanceNote += ` [FINGERPRINT: Style=${voiceFingerprint.style}, Rhythm=${voiceFingerprint.rhythm}]`;
    }

    try { 
      setTimeout(() => {
        setGenerationProgress(25);
        setGenerationStatus('جاري تحليل خصائص النص...');
      }, 1000);

      setTimeout(() => {
        setGenerationProgress(45);
        setGenerationStatus('جاري توليد الصوت النهائي...');
      }, 2500);

      const url = await savioService.generateVoiceOver(
        frozenText, 
        frozenBaseVoice, 
        frozenVoiceProfile, 
        frozenControls, 
        performanceNote, 
        frozenDialectId
      ); 
      
      setGenerationProgress(100);
      setGenerationStatus('اكتمل الإنتاج بنجاح!');
      playCompletionSound();

      setTimeout(() => {
        const resultId = Math.random().toString(36).substr(2, 9);
        const resultData: GenerationHistory = { 
          id: resultId, 
          text: frozenText, 
          selection: { 
            dialect: selectedDialect.title, 
            type: frozenVoiceType, 
            field: selectedField.title, 
            controls: frozenControls,
            fingerprint: voiceFingerprint.isActive ? voiceFingerprint : undefined
          }, 
          timestamp: Date.now(), 
          audioBlobUrl: url 
        };

        setCurrentResult(resultData); 
        setHistory(prev => [
          { 
            id: resultId, 
            voiceName: frozenVoiceProfile.name, 
            dialect: selectedDialect.title, 
            category: frozenVoiceProfile.category, 
            timestamp: Date.now(), 
            url 
          }, 
          ...prev
        ].slice(0, 5));
        
        setIsGenerating(false);
        setGenerationProgress(0);
        setGenerationStatus('');
      }, 1200);

    } catch (err: any) { 
      setError("فشل الإنتاج الصوتي: " + (err.message || "خطأ غير متوقع")); 
      setGenerationProgress(0);
      setIsGenerating(false);
    } 
  };

  const handleSaveFingerprint = () => {
    setVoiceFingerprint(prev => ({ ...prev, isActive: true }));
    setFingerprintConfirmation(true);
    setTimeout(() => {
      setFingerprintConfirmation(false);
      setShowFingerprintPanel(false);
    }, 2000);
  };

  const handleManualSplitByParagraph = () => {
    if (!activeProject) return;
    const text = activeProject.enhancedContent || activeProject.content;
    if (!text) return;

    const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
    const availableVoices = DIALECTS.find(d => d.id === activeProject.dialectId)?.profiles || allVoicesFlattened;
    
    const newSegments: NarrationSegment[] = paragraphs.map((p, i) => ({
      id: Date.now() + i,
      label: `فقرة ${i + 1}`,
      role: 'الراوي',
      selectedVoice: availableVoices[0].name,
      content: p
    }));

    updateActiveProject({ segments: newSegments });
  };

  const handleAddSegmentAfter = (index: number) => {
    if (!activeProject) return;
    const newSegments = [...activeProject.segments];
    newSegments.splice(index + 1, 0, {
      id: Date.now(),
      label: 'مقطع جديد',
      role: 'شخصية',
      selectedVoice: '',
      content: ''
    });
    updateActiveProject({ segments: newSegments });
  };

  const handleRemoveSegment = (index: number) => {
    if (!activeProject || activeProject.segments.length <= 1) return;
    const newSegments = [...activeProject.segments];
    newSegments.splice(index, 1);
    updateActiveProject({ segments: newSegments });
  };

  const handleMergeSegments = (index: number) => {
    if (!activeProject || index >= activeProject.segments.length - 1) return;
    const newSegments = [...activeProject.segments];
    const current = newSegments[index];
    const next = newSegments[index + 1];
    current.content = current.content + "\n\n" + next.content;
    newSegments.splice(index + 1, 1);
    updateActiveProject({ segments: newSegments });
  };

  const renderTranscriptStudio = () => {
    const isProcessing = transcriptionStatus === 'transcribing';
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center py-24 px-6 font-arabic animate-in fade-in zoom-in duration-500" dir="rtl">
        <div className="w-full max-w-6xl space-y-12">
          <div className="flex items-center justify-between">
            <button onClick={() => setAppMode('home')} className="px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 text-white/60 transition-all flex items-center gap-3"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5m7 7l-7-7 7-7" /></svg><span>العودة للرئيسية</span></button>
            <div className="text-right">
              <h2 className="text-4xl font-bold gold-text">Transcript Studio</h2>
              <p className="text-white/30 text-sm mt-1 uppercase tracking-widest">تفريغ صوتي احترافي - استخراج النص كاملاً</p>
            </div>
          </div>

          <div className="glass-3d p-12 rounded-[45px] space-y-12">
            <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl text-amber-500 text-sm text-center font-bold">
              سيتم استخراج النص كاملاً بدون اختصار أو تعديل - يدعم الملفات الصوتية فقط
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <label className="text-xs font-bold text-amber-500 uppercase tracking-[0.4em] pr-2">رفع ملف صوتي (MP3, WAV, M4A, FLAC)</label>
                <div 
                  onClick={() => !isProcessing && transcriptInputRef.current?.click()} 
                  className={`h-64 rounded-[35px] border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 group cursor-pointer relative ${transcriptFile ? 'border-amber-500 bg-amber-500/5' : 'border-white/5 bg-white/2 hover:bg-white/5'} ${isProcessing ? 'opacity-50' : ''}`}
                >
                  <input type="file" ref={transcriptInputRef} onChange={handleTranscriptFileChange} accept="audio/*" className="hidden" />
                  <div className="text-center">
                    <svg className={`w-12 h-12 mx-auto mb-4 ${transcriptFile ? 'text-amber-500' : 'text-white/10'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <p className="text-sm font-bold text-white/40">{transcriptFile ? transcriptFile.name : 'اضغط لاختيار ملف صوتي'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-6 rounded-3xl bg-white/2 border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-right">
                        <span className="text-xs font-bold text-white/80 block">تقسية النص حسب التوقيت</span>
                      </div>
                      <button 
                        onClick={() => setUseTimestamps(!useTimestamps)} 
                        className={`w-12 h-6 rounded-full relative transition-all ${useTimestamps ? 'bg-amber-500' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${useTimestamps ? 'right-6' : 'right-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleStartTranscription} 
                  disabled={!transcriptFile || isProcessing} 
                  className="w-full py-8 rounded-[30px] gold-bg text-black font-bold text-xl hover:scale-105 transition-all shadow-2xl disabled:opacity-30 flex items-center justify-center gap-4"
                >
                  {isProcessing ? (
                    <><div className="w-6 h-6 border-4 border-t-transparent border-black rounded-full animate-spin" /><span>جاري التفريغ...</span></>
                  ) : (
                    "بدء التفريغ النصي"
                  )}
                </button>
              </div>
            </div>

            {transcriptResult && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-white/5 pt-8">
                  <div className="flex flex-wrap items-center gap-4">
                    <button onClick={handleQuickCopy} className={`px-6 py-3 rounded-2xl border transition-all text-xs font-bold flex items-center gap-2 ${copyFeedback ? 'bg-green-500 border-green-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}>
                      {copyFeedback ? 'تم نسخ النص' : 'نسخ النص'}
                    </button>
                    
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-1">
                      <label className="text-[10px] text-white/40 whitespace-nowrap">صيغة إخراج النص:</label>
                      <select 
                        value={exportFormat} 
                        onChange={(e) => setExportFormat(e.target.value as any)}
                        className="bg-transparent text-xs font-bold text-amber-500 focus:outline-none cursor-pointer p-2"
                      >
                        <option value="txt">TXT</option>
                        <option value="docx">DOCX</option>
                        <option value="srt">SRT</option>
                      </select>
                      <button 
                        onClick={() => exportTranscript(exportFormat)} 
                        className="text-white/40 hover:text-amber-500 transition-all p-2"
                        title="تحميل"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest">محرر النص المستخرج</h3>
                  </div>
                </div>

                <textarea 
                  value={transcriptResult} 
                  onChange={(e) => setTranscriptResult(e.target.value)} 
                  className="w-full h-[400px] bg-black/40 border border-white/5 rounded-[40px] p-10 text-lg leading-relaxed text-right focus:outline-none focus:border-amber-500/20 custom-scrollbar shadow-inner"
                />

                <div className="flex justify-center gap-4">
                   <button onClick={() => { setManualPodcastText(transcriptResult); setAppMode('podcast'); setPodcastSourceType('manual'); }} className="px-8 py-4 rounded-full border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 transition-all text-xs font-bold">إرسال إلى Podcast Studio</button>
                   <button onClick={() => { initializeNewProject(); updateActiveProject({ content: transcriptResult }); setAppMode('audiobook'); }} className="px-8 py-4 rounded-full border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all text-xs font-bold">إرسال إلى Audiobook Studio</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAudiobookWorkspace = () => {
    const isNewMode = audiobookWorkspaceMode === 'new';
    const isImportMode = audiobookWorkspaceMode === 'import';
    const isScriptMode = audiobookWorkspaceMode === 'script';
    const isMultiMode = audiobookWorkspaceMode === 'multi';
    const isPilotMode = audiobookWorkspaceMode === 'pilot';
    const isProductionMode = audiobookWorkspaceMode === 'production';
    const currentStepIdx = WORKFLOW_STEPS.findIndex(s => s.id === audiobookWorkspaceMode);

    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center py-24 px-6 font-arabic animate-in fade-in zoom-in duration-500" dir="rtl">
        <div className="w-full max-w-6xl space-y-12">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button onClick={() => setAppMode('home')} className="px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 text-white/60 transition-all flex items-center gap-3">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5m7 7l-7-7 7-7" /></svg>
              <span>العودة للرئيسية</span>
            </button>
            <div className="text-right">
              <h2 className="text-4xl font-bold gold-text">Audiobook Studio</h2>
              <p className="text-white/30 text-sm mt-1 uppercase tracking-widest">{WORKFLOW_STEPS[currentStepIdx]?.label || 'Workspace'}</p>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="w-full max-w-5xl mx-auto mb-12">
            <div className="flex items-center justify-between relative">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/5 -translate-y-1/2 z-0"></div>
              {WORKFLOW_STEPS.map((step, idx) => (
                <button 
                  key={step.id} 
                  onClick={() => { if (activeProject && productionPhase === 'idle') setAudiobookWorkspaceMode(step.id as any); }} 
                  disabled={!activeProject || productionPhase !== 'idle'}
                  className={`relative z-10 flex flex-col items-center gap-3 group disabled:opacity-30`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${step.id === audiobookWorkspaceMode ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_20px_rgba(212,175,55,0.4)] scale-125' : currentStepIdx > idx ? 'bg-white/10 border-amber-500/40 text-amber-500' : 'bg-[#050505] border-white/10 text-white/20'}`}>
                    {currentStepIdx > idx ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : <span className="text-xs font-bold">{idx + 1}</span>}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-widest transition-all ${step.id === audiobookWorkspaceMode ? 'text-amber-500 opacity-100' : 'text-white/20 opacity-60'}`}>{step.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Workflow Content */}
          <div className="glass-3d p-16 rounded-[45px] space-y-16">
            
            {/* 1. Project Identity Setup | إعداد هوية المشروع */}
            {(isNewMode || isImportMode || isScriptMode) && (
              <section className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 border-b border-white/5 pb-8">
                <div className="text-right">
                  <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">إعدادات وهوية المشروع</h3>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">اختيار اللهجة</label>
                  <select 
                    value={activeProject?.dialectId} 
                    onChange={(e) => updateActiveProject({ dialectId: e.target.value })}
                    className="bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-amber-500/30 outline-none min-w-[200px] cursor-pointer shadow-lg"
                  >
                    <option value="egyptian">المصرية</option>
                    <option value="saudi">السعودية</option>
                    <option value="khaleeji">الخليجية</option>
                    <option value="levantine">الشامية</option>
                    <option value="iraqi">العراقية</option>
                    <option value="moroccan">المغربية</option>
                    <option value="algerian">الجزائرية</option>
                    <option value="tunisian">التونسية</option>
                    <option value="sudanese">السودانية</option>
                    <option value="fusha">الفصحى</option>
                  </select>
                </div>
              </section>
            )}

            {isNewMode && activeProject && (
              <div className="space-y-12 animate-in fade-in">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-white/20 uppercase pr-4">عنوان الكتاب الصوتي</label>
                  <input type="text" value={activeProject.name} onChange={(e) => updateActiveProject({ name: e.target.value })} placeholder="أدخل عنوان الكتاب الصوتي هنا..." className="w-full bg-white/5 border border-white/5 rounded-2xl p-6 text-lg focus:outline-none focus:border-amber-500/20" />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-white/20 uppercase pr-4">النص المبدئي</label>
                  <textarea value={activeProject.content} onChange={(e) => updateActiveProject({ content: e.target.value })} placeholder="اكتب أو الصق نص الكتاب هنا..." className="w-full h-96 bg-white/5 border border-white/5 rounded-[35px] p-10 text-xl leading-relaxed resize-none focus:outline-none focus:border-amber-500/20 shadow-inner" />
                </div>
                <div className="flex justify-center pt-8">
                  <button onClick={() => setAudiobookWorkspaceMode('import')} className="px-16 py-6 rounded-full gold-bg text-black font-black text-xl hover:scale-105 transition-all shadow-2xl">المتابعة لاستيراد النص</button>
                </div>
              </div>
            )}

            {isImportMode && activeProject && (
              <div className="space-y-16 animate-in fade-in">
                {showImportSuccess && <div className="bg-amber-500/20 border border-amber-500/30 rounded-2xl p-6 text-center text-amber-500 font-bold text-sm">تمت إضافة النص إلى مشروع الكتاب الصوتي</div>}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-white/20 uppercase pr-4">استيراد من ملف</label>
                    <div onClick={() => fileInputRef.current?.click()} className="h-64 rounded-[35px] border-2 border-dashed border-white/10 bg-white/2 flex flex-col items-center justify-center gap-4 group cursor-pointer relative hover:border-amber-500/30 transition-all">
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.doc,.docx,.pdf" className="hidden" />
                      {isReadingFile ? <div className="animate-spin w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full" /> : (
                        <>
                          <svg className="w-12 h-12 text-white/10 group-hover:text-amber-500/50 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                          <p className="text-sm font-bold text-white/40">اضغط للاختيار (PDF, TXT, DOCX)</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-white/20 uppercase pr-4">محرر الاستيراد السريع</label>
                    <textarea value={importTextBuffer} onChange={(e) => setImportTextBuffer(e.target.value)} placeholder="أو الصق النص هنا..." className="w-full h-64 bg-white/5 border border-white/5 rounded-[35px] p-8 text-right focus:outline-none focus:border-amber-500/20" />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-6 pt-8">
                  <button onClick={() => { if(activeProject && importTextBuffer.trim()){ updateActiveProject({ content: importTextBuffer }); setShowImportSuccess(true); } }} className="px-16 py-6 rounded-full gold-bg text-black font-black text-xl shadow-2xl">حفظ النص في المشروع</button>
                  {showImportSuccess && <button onClick={() => setAudiobookWorkspaceMode('script')} className="text-amber-500 font-bold text-sm transition-all animate-bounce">متابعة لتجهيز النص</button>}
                </div>
              </div>
            )}

            {isScriptMode && activeProject && (
              <div className="space-y-12 animate-in fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-white/20 uppercase pr-4">النص الأصلي</label>
                    <textarea value={activeProject.content} onChange={(e) => updateActiveProject({ content: e.target.value })} className="script-panel-textarea w-full h-[500px] border rounded-[40px] p-10 text-lg text-right focus:outline-none" placeholder="النص الأصلي..." />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-amber-500 uppercase pr-4">النص المُحسن والمعدل</label>
                    <textarea value={activeProject.enhancedContent || activeProject.content} onChange={(e) => updateActiveProject({ enhancedContent: e.target.value })} className="script-panel-textarea w-full h-[500px] border rounded-[40px] p-10 text-lg text-right focus:outline-none" placeholder="النص المُحسن والمعدل..." />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-6 pt-10 border-t border-white/5">
                  <div className="flex gap-6">
                    <button onClick={async () => { setIsScriptEnhancing(true); try { const r = await savioService.preprocessText(activeProject.content, { dialect: DIALECTS.find(d => d.id === activeProject.dialectId)?.title || 'Fusha', field: 'Novels', personality: 'Professional', controls: {} }); updateActiveProject({ enhancedContent: r }); } finally { setIsScriptEnhancing(false); } }} disabled={isScriptEnhancing} className="px-14 py-6 rounded-full border border-amber-500/20 text-amber-500 font-bold text-lg hover:bg-amber-500 hover:text-black transition-all shadow-xl">{isScriptEnhancing ? "جاري التحسين..." : "تحسين النص ذكياً"}</button>
                    <button onClick={() => { setShowScriptSaveSuccess(true); }} className="px-14 py-6 rounded-full gold-bg text-black font-black text-lg shadow-2xl">اعتماد المخطوطة</button>
                  </div>
                  {showScriptSaveSuccess && <button onClick={() => setAudiobookWorkspaceMode('multi')} className="text-amber-500 font-bold text-sm transition-all animate-in slide-in-from-bottom-2">متابعة لتوزيع النص وتوزيع الأدوار</button>}
                </div>
              </div>
            )}

            {isMultiMode && activeProject && (
              <div className="space-y-10 animate-in fade-in">
                {/* Immediate Text Visibility | النص الكامل المعتمد */}
                <section className="bg-black/60 border border-white/10 rounded-[40px] p-10 space-y-4 shadow-2xl">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Project Content Preview | معاينة نص المشروع</span>
                    <svg className="w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </div>
                  <div className="max-h-64 overflow-y-auto text-white/60 text-lg leading-relaxed text-right custom-scrollbar select-all">
                    {activeProject.enhancedContent || activeProject.content}
                  </div>
                </section>

                <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-white/5 pb-8">
                  <div className="text-right">
                    <h3 className="text-2xl font-black gold-text">Distribution Engine</h3>
                    <p className="text-white/30 text-xs mt-1">اختر أداة لتقسيم النص أعلاه وتوزيع الأدوار الصوتية</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={handleManualSplitByParagraph} className="px-6 py-2 rounded-full border border-amber-500/30 text-amber-500 text-xs font-bold hover:bg-amber-500/10 transition-all">تقسيم حسب الفقرات</button>
                    <button onClick={handleAutoDistributeVoices} disabled={isAutoDistributing} className={`px-6 py-2 rounded-full border-2 transition-all text-xs font-bold flex items-center gap-3 ${showAutoSuccess ? 'border-green-500/50 text-green-500 bg-green-500/10' : 'border-amber-500/30 text-amber-500 hover:bg-amber-500/10'}`}>{isAutoDistributing ? <div className="w-3 h-3 border-2 border-t-transparent border-amber-500 rounded-full animate-spin" /> : showAutoSuccess ? '✓ تم التوزيع' : 'توزيع ذكي للأدوار'}</button>
                  </div>
                </div>

                <div className="space-y-8 max-h-[800px] overflow-y-auto pr-4 custom-scrollbar">
                  {activeProject.segments.map((seg, idx) => (
                    <div key={seg.id} className="bg-white/2 border border-white/5 rounded-[40px] p-10 flex flex-col gap-6 relative group/seg transition-all hover:bg-white/[0.03]">
                      <div className="absolute -right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover/seg:opacity-100 transition-opacity z-20">
                         <button onClick={() => handleAddSegmentAfter(idx)} className="w-10 h-10 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all" title="إضافة مقطع بعد">＋</button>
                         <button onClick={() => handleRemoveSegment(idx)} className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all" title="حذف">×</button>
                      </div>

                      <div className="flex flex-col md:flex-row items-center gap-8 border-b border-white/5 pb-6">
                        <div className="flex flex-col gap-2 flex-1 w-full">
                          <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">عنوان المقطع (فصل / مشهد)</label>
                          <input 
                            type="text" 
                            value={seg.label} 
                            onChange={(e) => { 
                              const n = [...activeProject.segments]; 
                              n[idx].label = e.target.value; 
                              updateActiveProject({ segments: n }); 
                            }} 
                            className="text-2xl font-black text-white bg-transparent border-none focus:outline-none text-right" 
                          />
                        </div>
                        <div className="flex flex-col gap-2 w-full md:w-64">
                          <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">المؤدي الصوتي</label>
                          <select 
                            className="bg-black/60 border border-white/10 rounded-2xl p-4 text-xs text-white focus:border-amber-500/30 outline-none transition-all" 
                            value={seg.selectedVoice} 
                            onChange={(e) => { 
                              const n = [...activeProject.segments]; 
                              n[idx].selectedVoice = e.target.value; 
                              updateActiveProject({ segments: n }); 
                            }}
                          >
                            <option value="">اختر الصوت...</option>
                            {(DIALECTS.find(d => d.id === activeProject.dialectId)?.profiles || allVoicesFlattened).map(v => (
                              <option key={v.id} value={v.name}>{v.name} ({v.category})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-white/20 uppercase flex justify-between items-center flex-row-reverse tracking-widest">
                          <span>محتوى النص للمقطع</span>
                          {idx < activeProject.segments.length - 1 && (
                            <button onClick={() => handleMergeSegments(idx)} className="text-amber-500/40 hover:text-amber-500 transition-colors flex items-center gap-2">
                               <span>دمج مع التالي</span>
                               <svg className="w-4 h-4" fill="none" viewBox="0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7" /></svg>
                            </button>
                          )}
                        </label>
                        <textarea 
                          value={seg.content} 
                          onChange={(e) => { 
                            const n = [...activeProject.segments]; 
                            n[idx].content = e.target.value; 
                            updateActiveProject({ segments: n }); 
                          }} 
                          className="w-full h-48 bg-black/40 border border-white/5 rounded-2xl p-8 text-lg text-right focus:outline-none focus:border-amber-500/20 shadow-inner resize-none custom-scrollbar" 
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-center gap-6 pt-10 border-t border-white/5">
                  <button onClick={() => { 
                    const n = [...activeProject.segments, { id: Date.now(), label: 'مقطع جديد', role: 'شخصية', selectedVoice: '', content: '' }]; 
                    updateActiveProject({ segments: n }); 
                  }} className="text-xs text-white/40 hover:text-white transition-all bg-white/5 px-8 py-3 rounded-full border border-white/10 hover:bg-white/10">+ إضافة مقطع يدوي جديد</button>
                  
                  <button onClick={() => {
                    const unassigned = activeProject.segments.some(s => !s.selectedVoice);
                    if (unassigned) {
                      setError("يرجى التأكد من اختيار صوت لكل مقطع نصي قبل المتابعة");
                      return;
                    }
                    setShowMultiSaveSuccess(true);
                  }} className="w-full max-w-2xl py-8 rounded-full gold-bg text-black font-black text-2xl shadow-3xl hover:scale-[1.02] transition-all">حفظ التوزيع والمتابعة</button>
                  
                  {showMultiSaveSuccess && (
                    <button onClick={() => setAudiobookWorkspaceMode('pilot')} className="text-amber-500 font-bold text-sm transition-all animate-in slide-in-from-bottom-2 flex items-center gap-2">
                       <span>متابعة لتوليد مقاطع تجريبية</span>
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    </button>
                  )}
                </div>
              </div>
            )}

            {isPilotMode && activeProject && (
              <div className="animate-in fade-in space-y-10">
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Pilot Session | جلسة الاستماع التجريبية</h3>
                  <p className="text-white/30 text-sm max-w-md mx-auto">استمع لعينات صوتية من كل مقطع للتأكد من تناغم الأصوات قبل بدء الإنتاج الماستر النهائي</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {activeProject.segments.map((seg, idx) => (
                    <div key={seg.id} className="bg-white/2 border border-white/5 rounded-[35px] p-8 space-y-6 group hover:border-amber-500/20 transition-all shadow-xl">
                      <div className="text-right flex justify-between items-center flex-row-reverse">
                        <div>
                          <h4 className="text-lg font-bold text-white">{seg.label}</h4>
                          <p className="text-[10px] text-amber-500 uppercase font-black tracking-widest">المؤدي: {seg.selectedVoice || 'غير محدد'}</p>
                        </div>
                        <button onClick={() => setAudiobookWorkspaceMode('multi')} className="text-[10px] text-white/10 hover:text-amber-500 transition-colors uppercase font-bold px-3 py-1 rounded-lg border border-white/5">تعديل</button>
                      </div>
                      
                      {!seg.pilotAudioUrl && !pilotLoadingId && (
                        <button 
                          onClick={async () => { 
                            setPilotLoadingId(seg.id); 
                            try { 
                              const v = allVoicesFlattened.find(v => v.name === seg.selectedVoice); 
                              if(!v) throw new Error("الصوت غير موجود"); 
                              const url = await savioService.generateVoiceOver(seg.content.substring(0, 100), getBaseVoiceForType(v.voiceType, v.gender), v, voiceControls, "Pilot Lock", activeProject.dialectId); 
                              const n = [...activeProject.segments]; 
                              n[idx].pilotAudioUrl = url; 
                              updateActiveProject({ segments: n }); 
                            } catch (err: any) { 
                              setError(err.message || "الصوت غير متاح حالياً"); 
                            } finally { 
                              setPilotLoadingId(null); 
                            } 
                          }} 
                          disabled={!seg.selectedVoice || !seg.content.trim()} 
                          className="w-full py-5 rounded-2xl border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/10 transition-all shadow-lg"
                        >
                          توليد عينة تجريبية (أول ١٠٠ حرف)
                        </button>
                      )}
                      
                      {pilotLoadingId === seg.id && <div className="flex justify-center py-4"><div className="w-8 h-8 border-4 border-t-amber-500 border-white/10 rounded-full animate-spin" /></div>}
                      {seg.pilotAudioUrl && <UnifiedAudioPlayer url={seg.pilotAudioUrl} title={`عينة: ${seg.label}`} subtitle={seg.selectedVoice} />}
                    </div>
                  ))}
                </div>
                <div className="flex justify-center pt-16">
                  <button onClick={() => setAudiobookWorkspaceMode('production')} className="px-24 py-10 rounded-full gold-bg text-black font-black text-3xl shadow-3xl hover:scale-105 transition-all">متابعة للإنتاج النهائي الكامل</button>
                </div>
              </div>
            )}

            {isProductionMode && activeProject && (
              <div className="space-y-16 flex flex-col items-center animate-in fade-in">
                <div className="text-center space-y-4">
                  <h3 className="text-5xl font-black gold-text tracking-tighter">Final Master Production</h3>
                  <p className="text-white/40 max-w-lg mx-auto leading-relaxed">سيتم الآن معالجة كافة المقاطع وتوليد النسخة النهائية الماستر للكتاب الصوتي. قد تستغرق هذه العملية عدة دقائق بناءً على طول النص الإجمالي لضمان الجودة الفائقة.</p>
                </div>

                {productionPhase === 'completed' && masterAudioUrl ? (
                  <div className="space-y-12 flex flex-col items-center w-full">
                    <div className="bg-green-500/10 border border-green-500/20 px-10 py-5 rounded-full text-green-500 text-lg font-black animate-bounce flex items-center gap-4 shadow-2xl">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      تم إنتاج الماستر النهائي بنجاح
                    </div>
                    <UnifiedAudioPlayer url={masterAudioUrl} title={activeProject.name || "كتاب صوتي جديد"} subtitle="النسخة الماستر الكاملة" showShare={true} />
                    <button onClick={() => { setMasterAudioUrl(null); setProductionPhase('idle'); setAudiobookWorkspaceMode('new'); }} className="text-white/20 hover:text-amber-500 text-xs font-bold transition-all border-b border-transparent hover:border-amber-500 pb-1">إغلاق المشروع والبدء من جديد</button>
                  </div>
                ) : (
                  <button 
                    disabled={productionPhase === 'generating'}
                    onClick={async () => { 
                      setProductionPhase('generating'); 
                      setProductionProgress(0); 
                      const s = [...activeProject.segments]; 
                      const updated = [...s]; 
                      try { 
                        for(let i=0; i<s.length; i++){ 
                          const v = allVoicesFlattened.find(v => v.name === s[i].selectedVoice); 
                          if(!v) continue; 
                          const url = await savioService.generateVoiceOver(s[i].content, getBaseVoiceForType(v.voiceType, v.gender), v, voiceControls, `Full Production: Segment ${i+1}`, activeProject.dialectId); 
                          updated[i].finalAudioUrl = url; 
                          setProductionProgress(Math.round(((i+1)/s.length)*100)); 
                        } 
                        const valid = updated.map(u => u.finalAudioUrl).filter(Boolean) as string[]; 
                        if(valid.length > 0){ 
                          const m = await mergeAudioSegments(valid); 
                          setMasterAudioUrl(m); 
                          setProductionPhase('completed'); 
                          updateActiveProject({ segments: updated }); 
                        } else {
                          throw new Error("لم يتم توليد أي مقاطع بنجاح");
                        }
                      } catch (err: any) { 
                        setError("خطأ في الإنتاج النهائي: " + err.message); 
                        setProductionPhase('idle'); 
                      } 
                    }} 
                    className={`px-32 py-12 rounded-full gold-bg text-black font-black text-4xl shadow-3xl hover:scale-105 active:scale-95 transition-all ${productionPhase === 'generating' ? 'opacity-50 cursor-not-allowed scale-95' : ''}`}
                  >
                    {productionPhase === 'generating' ? "جاري الإنتاج..." : "إطلاق الإنتاج الصوتي"}
                  </button>
                )}
                
                {productionPhase === 'generating' && (
                  <div className="w-full max-w-2xl space-y-6 animate-in fade-in">
                    <div className="relative h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                      <div className="gold-bg h-full transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) relative shadow-[0_0_20px_rgba(212,175,55,0.4)]" style={{ width: `${productionProgress}%` }}>
                         <div className="absolute right-0 top-0 bottom-0 w-8 bg-amber-300 blur-md opacity-50" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs font-black text-white/30 uppercase tracking-[0.3em]">
                      <span className="animate-pulse">Processing Engine v2.5</span>
                      <span className="text-amber-500 drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]">{productionProgress}% COMPLETE</span>
                      <span>Studio Master Render</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleAddNewSpeaker = () => {
    const newId = `manual_speaker_${Date.now()}`;
    const newSpeaker: SpeakerProfile = {
      id: newId,
      role: 'شخصية جديدة',
      tone: 'هادئ',
      style: 'رسمي',
      gender: 'any',
      categoryHint: 'podcast',
      description: 'شخصية تمت إضافتها يدوياً',
      reasoning: 'إضافة يدوية'
    };
    setPodcastSpeakers(prev => [...prev, newSpeaker]);
    setPodcastDistMode('manual');
  };

  const renderPodcastStudio = () => {
    const allAssigned = podcastSpeakers.length > 0 && podcastSpeakers.every(s => speakerVoiceMap[s.id]);
    
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center py-24 px-6 font-arabic animate-in fade-in zoom-in duration-500" dir="rtl">
        <div className="w-full max-w-6xl space-y-12">
          <div className="flex items-center justify-between">
            <button onClick={() => setAppMode('home')} className="px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 text-white/60 transition-all flex items-center gap-3"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5m7 7l-7-7 7-7" /></svg><span>العودة للرئيسية</span></button>
            <div className="text-right">
              <h2 className="text-4xl font-bold gold-text">Podcast Studio</h2>
            </div>
          </div>
          
          <div className="glass-3d p-16 rounded-[45px] space-y-16">
            {/* Persistently Visible Input & Analysis Trigger */}
            {!audio_generated && (
              <section className="space-y-8 animate-in fade-in border-b border-white/5 pb-12">
                <div className="flex flex-col md:flex-row items-center gap-6 justify-between flex-row-reverse">
                   <div className="text-right">
                      <h3 className="text-sm font-black text-white/40 uppercase tracking-widest">Source Material & Logic</h3>
                   </div>
                   <select value={podcastDialectId} onChange={e => setPodcastDialectId(e.target.value)} className="w-full md:w-64 p-3 bg-black/40 border border-white/5 rounded-xl text-xs focus:outline-none text-right">
                     {DIALECTS.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                   </select>
                </div>
                
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest block pr-2 text-right">نص البودكاست المراد تحليله</label>
                  <textarea 
                    value={manualPodcastText} 
                    onChange={(e) => setManualPodcastText(e.target.value)} 
                    placeholder="اكتب فكرة البودكاست أو السيناريو الأولي هنا..." 
                    className="w-full h-48 bg-white/5 border border-white/5 rounded-[30px] p-8 text-lg focus:outline-none focus:border-amber-500/20 text-right resize-none shadow-inner" 
                  />
                </div>

                <div className="flex justify-center">
                  <button 
                    onClick={handleGeneratePodcastScript} 
                    disabled={isAnalyzingPodcast} 
                    className="px-20 py-8 rounded-full gold-bg text-black font-black text-2xl shadow-3xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 flex items-center gap-4"
                  >
                    {isAnalyzingPodcast ? (
                      <><div className="w-6 h-6 border-4 border-t-transparent border-black rounded-full animate-spin" /><span>جاري التحليل...</span></>
                    ) : (
                      "تحليل المحتوى وصياغة المسودة"
                    )}
                  </button>
                </div>
              </section>
            )}

            {/* Results & Distribution Phase */}
            {podcastScript && !audio_generated && (
              <div className="space-y-12 animate-in slide-in-from-bottom-5">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
                   <div className="text-right flex-1">
                      <h3 className="text-2xl font-black text-white">Character & Distribution Engine</h3>
                      <p className="text-white/30 text-xs mt-1">المحرك اكتشف {podcastSpeakers.length} شخصيات. قم بتوزيع الأصوات وتأكيد السيناريو.</p>
                   </div>
                   
                   <div className="flex flex-wrap items-center gap-4 justify-end">
                     <button 
                       onClick={handleAddNewSpeaker}
                       className="px-6 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 hover:border-amber-500/30 text-amber-500 transition-all flex items-center gap-2"
                     >
                       <span>+ إضافة شخصية جديدة</span>
                     </button>

                     <button 
                       onClick={handleGeneratePodcastScript}
                       disabled={isAnalyzingPodcast}
                       className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 text-amber-500 transition-all flex items-center gap-2"
                       title="إعادة توزيع الحوار بناءً على الشخصيات المتاحة حالياً"
                     >
                       {isAnalyzingPodcast ? <div className="w-3 h-3 border-2 border-t-transparent border-amber-500 rounded-full animate-spin" /> : <span>🔄 إعادة تحليل السيناريو بعد التعديلات</span>}
                     </button>

                     {!isPodcastDistributed && (
                       <div className="flex bg-white/2 border border-white/10 rounded-2xl p-1">
                          <button 
                            onClick={() => setDistributionMode('smart')}
                            className={`px-8 py-2.5 rounded-xl text-xs font-bold transition-all ${podcastDistMode === 'smart' ? 'gold-bg text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                          >
                            توزيع ذكي (AI)
                          </button>
                          <button 
                            onClick={() => setDistributionMode('manual')}
                            className={`px-8 py-2.5 rounded-xl text-xs font-bold transition-all ${podcastDistMode === 'manual' ? 'gold-bg text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                          >
                            توزيع يدوي
                          </button>
                       </div>
                     )}
                   </div>

                   {isPodcastDistributed && (
                     <button onClick={() => setIsPodcastDistributed(false)} className="text-xs text-amber-500/60 hover:text-amber-500 underline self-center">تعديل الأدوار والتوزيع</button>
                   )}
                </div>

                {!isPodcastDistributed ? (
                  <section className="space-y-8">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                       {podcastSpeakers.map((speaker, sIdx) => {
                         const assignedVoiceId = speakerVoiceMap[speaker.id];
                         const assignedVoice = podcastDialectVoices.find(v => v.id === assignedVoiceId);
                         const isPreviewing = activePreviewId === assignedVoiceId;

                         return (
                           <div key={speaker.id} className="p-8 rounded-[35px] bg-white/5 border border-white/10 space-y-6 relative overflow-hidden group hover:border-amber-500/30 transition-all flex flex-col">
                              {speaker.id.indexOf('manual_speaker') === -1 ? (
                                <div className="absolute top-0 left-0 bg-amber-500/10 px-4 py-1 rounded-br-2xl text-[8px] font-black text-amber-500 uppercase tracking-widest border-r border-b border-amber-500/20">AI Suggestion</div>
                              ) : (
                                <div className="absolute top-0 left-0 bg-indigo-500/10 px-4 py-1 rounded-br-2xl text-[8px] font-black text-indigo-500 uppercase tracking-widest border-r border-b border-indigo-500/20">User Defined</div>
                              )}
                              
                              <div className="flex justify-between items-center flex-row-reverse mt-2">
                                 <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-black">{sIdx + 1}</div>
                                 <div className="flex-1 pr-4">
                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest block text-right">Character ID: {speaker.id.substring(0, 8)}</span>
                                    {podcastDistMode === 'smart' && speaker.reasoning && (
                                      <span className="text-[9px] text-amber-500 font-bold bg-amber-500/5 px-2 rounded-full mt-1 inline-block text-right w-full">{speaker.reasoning}</span>
                                    )}
                                 </div>
                              </div>
                              
                              <div className="space-y-4 mt-auto">
                                 <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                       <label className="text-[9px] font-bold text-amber-500/50 uppercase text-right block">الدور</label>
                                       <input 
                                         value={speaker.role} 
                                         onChange={(e) => {
                                           const newSpeakers = [...podcastSpeakers];
                                           newSpeakers[sIdx].role = e.target.value;
                                           setPodcastSpeakers(newSpeakers);
                                         }}
                                         className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-white focus:border-amber-500/20 outline-none text-right"
                                       />
                                    </div>
                                    <div className="space-y-2">
                                       <label className="text-[9px] font-bold text-amber-500/50 uppercase text-right block">النبرة (Tone)</label>
                                       <input 
                                         value={speaker.tone} 
                                         onChange={(e) => {
                                           const newSpeakers = [...podcastSpeakers];
                                           newSpeakers[sIdx].tone = e.target.value;
                                           setPodcastSpeakers(newSpeakers);
                                         }}
                                         className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-white focus:border-amber-500/20 outline-none text-right"
                                       />
                                    </div>
                                 </div>
                                 
                                 <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-amber-500/50 uppercase text-right block">اختيار المؤدي الصوتي</label>
                                    <div className="flex gap-2">
                                      <select 
                                        value={speakerVoiceMap[speaker.id] || ''} 
                                        onChange={(e) => {
                                          setSpeakerVoiceMap(prev => ({...prev, [speaker.id]: e.target.value}));
                                          if (podcastDistMode === 'smart') setPodcastDistMode('manual');
                                        }}
                                        className="flex-1 p-4 bg-black/60 border border-white/10 rounded-2xl text-xs text-white focus:border-amber-500/30 outline-none"
                                      >
                                        <option value="" disabled>اختر صوتاً...</option>
                                        {podcastDialectVoices.map(v => <option key={v.id} value={v.id}>{v.name} ({v.category})</option>)}
                                      </select>
                                      {assignedVoice && (
                                        <button 
                                          onClick={(e) => handleVoicePreview(e, assignedVoice)}
                                          className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${isPreviewing ? 'bg-amber-500 border-amber-500 text-black' : 'bg-white/5 border-white/10 text-white/40 hover:border-amber-500/50 hover:text-amber-500'}`}
                                        >
                                          {isPreviewing && isPreviewLoading ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin" />
                                          ) : isPreviewing ? (
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                          ) : (
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                 </div>

                                 <p className="text-[10px] text-white/30 italic leading-relaxed text-right pr-2 border-r border-white/5">
                                   {speaker.description}
                                 </p>
                              </div>
                           </div>
                         );
                       })}
                     </div>
                     
                     <div className="pt-6">
                        <button 
                          disabled={!allAssigned}
                          onClick={() => {
                            if (allAssigned) {
                              setIsPodcastDistributed(true);
                            }
                          }} 
                          className={`w-full py-8 rounded-full gold-bg text-black font-black text-xl shadow-3xl hover:scale-[1.01] active:scale-95 transition-all ${!allAssigned ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                        >
                          اعتماد التوزيع والمتابعة
                        </button>
                        {!allAssigned && (
                          <p className="text-center text-[10px] text-red-500/60 mt-4 font-bold">يرجى التأكد من اختيار أصوات لكافة الشخصيات المكتشفة قبل المتابعة</p>
                        )}
                     </div>
                  </section>
                ) : (
                  <div className="bg-green-500/5 border border-green-500/20 p-8 rounded-[40px] flex items-center justify-between flex-row-reverse animate-in fade-in">
                     <div className="text-right">
                        <p className="text-green-500 font-black text-lg">تم اعتماد التوزيع بنجاح</p>
                        <p className="text-white/30 text-xs mt-1">المحرك جاهز الآن لتوليد الحوار الصوتي النهائي</p>
                     </div>
                     <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                     </div>
                  </div>
                )}

                <div className="w-full h-96 bg-black/40 border border-white/5 rounded-[40px] p-10 overflow-y-auto space-y-6 text-right custom-scrollbar shadow-inner">
                  {podcastScript.map((turn, idx) => {
                    const speaker = podcastSpeakers.find(s => s.id === turn.speakerId);
                    return (
                      <div key={idx} className={`p-6 rounded-3xl border transition-all ${idx % 2 === 0 ? 'bg-white/5 border-white/5' : 'bg-amber-500/5 border-amber-500/10 mr-12'}`}>
                        <div className="flex justify-between items-center mb-2 flex-row-reverse">
                           <div className="flex items-center gap-3">
                              <span className={`text-[9px] font-black uppercase tracking-widest ${idx % 2 === 0 ? 'text-white/40' : 'text-amber-500/60'}`}>
                                المتحدث:
                              </span>
                              <select 
                                value={turn.speakerId} 
                                onChange={(e) => {
                                  const n = [...podcastScript];
                                  n[idx].speakerId = e.target.value;
                                  setPodcastScript(n);
                                }}
                                className="bg-white/5 border border-white/10 rounded-lg p-1.5 text-[10px] font-bold text-white focus:outline-none"
                              >
                                {podcastSpeakers.map(s => <option key={s.id} value={s.id}>{s.role}</option>)}
                              </select>
                           </div>
                        </div>
                        <textarea value={turn.text} onChange={(e) => { const n = [...podcastScript]; n[idx].text = e.target.value; setPodcastScript(n); }} className="w-full bg-transparent border-none focus:outline-none text-lg text-white/90 resize-none h-auto custom-scrollbar" />
                      </div>
                    );
                  })}
                </div>

                {isPodcastDistributed && allAssigned && (
                  <button onClick={handleGeneratePodcastAudio} disabled={isGeneratingPodcastAudio} className="w-full py-10 rounded-full gold-bg text-black font-black text-3xl shadow-3xl hover:scale-[1.02] transition-all">
                    {isGeneratingPodcastAudio ? `جاري الإنتاج (${podcastProgress}%)...` : "بدء الإنتاج الصوتي النهائي"}
                  </button>
                )}
              </div>
            )}

            {audio_generated && podcastAudioUrl && (
              <div className="flex flex-col items-center gap-10 animate-in zoom-in pt-12 border-t border-white/5">
                <UnifiedAudioPlayer url={podcastAudioUrl} title="Podcast Production Result" showShare={true} />
                <button onClick={() => { setPodcastScript(null); setPodcastSpeakers([]); setPodcastAudioUrl(null); setAudio_generated(false); setIsPodcastDistributed(false); setPodcastDistMode('smart'); }} className="px-10 py-4 rounded-full border border-white/10 text-white/40 hover:text-white transition-all text-sm font-bold tracking-widest">بدء جلسة بودكاست جديدة</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const setDistributionMode = (mode: PodcastDistributionMode) => {
    setPodcastDistMode(mode);
    if (mode === 'smart' && podcastSpeakers.length > 0) {
      const smartMap: Record<string, string> = {};
      const usedVoiceIds = new Set<string>();
      podcastSpeakers.forEach(s => {
        let matches = podcastDialectVoices.filter(v => (s.gender === 'any' || v.gender === s.gender));
        let bestMatches = matches.filter(v => v.categoryKey === s.categoryHint);
        if (bestMatches.length === 0) bestMatches = matches;
        let selected = bestMatches.find(v => !usedVoiceIds.has(v.id)) || bestMatches[0];
        if (selected) {
           smartMap[s.id] = selected.id;
           usedVoiceIds.add(selected.id);
        }
      });
      setSpeakerVoiceMap(smartMap);
    }
  };

  if (appMode === 'audiobook') return renderAudiobookWorkspace();
  if (appMode === 'podcast') return renderPodcastStudio();
  if (appMode === 'transcript') return renderTranscriptStudio();

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center py-24 px-6 font-arabic overflow-hidden relative animate-in fade-in duration-1000" dir="rtl">
      
      {/* Static Atmosphere Depth Layer */}
      <div className="studio-atmosphere">
        <div className="resonance-layer res-static-1"></div>
        <div className="resonance-layer res-static-2"></div>
        <div className="resonance-layer res-static-3"></div>
        <div className="resonance-layer res-static-4"></div>
      </div>

      {/* Profile Container */}
      <div className="absolute top-8 left-8 z-[60] group pointer-events-auto">
        <div className="relative w-16 h-16 rounded-full border border-amber-500/30 p-0.5 shadow-2xl animate-float-slow overflow-hidden">
          <img src="https://i.ibb.co/WNzzztQw/Copy.jpg" alt="Profile" className="w-full h-full object-cover rounded-full" />
        </div>
      </div>

      {/* Header Utilities Cluster (Social Icons + Other Services Menu Trigger) */}
      <div className="absolute top-8 right-8 z-[100] flex flex-col items-center gap-4">
        <div className="flex items-center gap-6">
          <NeumorphicSocialIcon 
            platform="facebook" 
            href="https://www.facebook.com/share/1AcufZTArY/" 
            src="https://i.ibb.co/tMQmt37y/image.png"
          />
          
          <NeumorphicSocialIcon 
            platform="instagram" 
            href="https://www.instagram.com/ahmed_samir_ai?igsh=MWNzdmR2czliNTl0Ng==" 
            src="https://i.ibb.co/8LqyQTSR/image.png"
          />

          <NeumorphicSocialIcon 
            platform="tiktok" 
            href="https://tiktok.com/@ahmed_savio.ai" 
            src="https://i.ibb.co/93kzPrNd/image.png"
          />
        </div>
        <EdgeMenu />
      </div>

      <header className="mb-24 text-center relative z-10 group">
        <div className="flex items-center justify-center gap-6 mb-6">
          <div className="h-20 w-20 gold-bg rounded-[24px] flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
            <svg viewBox="0 0 24 24" className="h-10 w-10 text-black" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-6xl font-bold gold-text tracking-tight leading-tight">سافيو ستوديو VO</h1>
            <p className="text-white/30 text-xs uppercase tracking-[0.6em] font-medium mt-2">Professional Arabic Voice Engine</p>
          </div>
        </div>
      </header>

      <div className="w-full max-w-5xl space-y-24 relative z-10">
        <section className="glass-3d p-16 rounded-[45px]">
          <h3 className="text-xs font-bold text-amber-500 uppercase tracking-[0.4em] text-center mb-14">١. منصة اختيار اللهجات</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {DIALECTS.map((dialect) => (
              <button 
                key={dialect.id} 
                disabled={isVoiceLocked || isGenerating}
                onClick={() => setSelectedDialectId(dialect.id)} 
                className={`relative text-right p-8 rounded-[35px] transition-all duration-500 border-2 ${selectedDialectId === dialect.id ? 'border-amber-500/50 bg-amber-500/5 scale-[1.02]' : 'border-white/5 bg-white/5 hover:bg-white/10'} ${isVoiceLocked || isGenerating ? 'cursor-not-allowed grayscale-[0.5] opacity-80' : ''}`}
              >
                <div className="flex items-center justify-between flex-row-reverse mb-5">
                  <h4 className={`text-2xl font-bold ${selectedDialectId === dialect.id ? 'text-amber-500' : 'text-white/80'}`}>{dialect.title}</h4>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${selectedDialectId === dialect.id ? 'gold-bg text-black' : 'bg-white/5 text-white/10'}`}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </div>
                </div>
                <p className="text-xs text-white/30 leading-relaxed">{dialect.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="glass-3d p-16 rounded-[45px] space-y-16">
          <div className="w-full space-y-8 text-center">
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-[0.4em]">٢. الفئة العمرية والنمط الأدائي</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {VOICE_TYPES.map(opt => <button key={opt} disabled={isVoiceLocked || isGenerating} onClick={() => setSelectedType(opt)} className={`px-8 py-3.5 rounded-[22px] border transition-all text-sm font-bold ${selectedType === opt ? 'gold-bg text-black scale-105' : 'border-white/5 bg-white/5 text-white/40'} ${isVoiceLocked || isGenerating ? 'cursor-not-allowed opacity-80' : ''}`}>{opt}</button>)}
            </div>
          </div>
          <div className="flex flex-col items-center gap-8">
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-[0.4em]">بصمة الصوت</h3>
            <div className="flex gap-4">
              {['ذكر', 'أنثى'].map(gender => <button key={gender} disabled={isVoiceLocked || isGenerating} onClick={() => setSelectedGender(gender)} className={`px-14 py-4 rounded-full border-2 transition-all text-sm font-bold ${selectedGender === gender ? 'border-amber-500 bg-amber-500/10 text-white scale-105' : 'border-white/5 bg-white/5 text-white/30 hover:bg-white/10'} ${isVoiceLocked || isGenerating ? 'cursor-not-allowed opacity-80' : ''}`}>{gender}</button>)}
            </div>
          </div>
          <div className="pt-16 border-t border-white/5">
            <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.5em] text-center mb-10">معرض النخب الصوتية</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredProfiles.length > 0 ? filteredProfiles.map((profile, idx) => {
                const style = CATEGORY_STYLES[profile.categoryKey as keyof typeof CATEGORY_STYLES];
                const isActive = selectedVoiceName === profile.name;
                const isPreviewing = activePreviewId === profile.id;
                return (
                  <button key={idx} disabled={isVoiceLocked || isGenerating} onClick={() => setSelectedVoiceName(profile.name)} className={`relative overflow-hidden text-right p-6 rounded-[35px] border-2 transition-all duration-700 transform group h-full flex flex-col items-center justify-start gap-5 text-center shadow-lg ${isActive ? `border-white/20 bg-gradient-to-br ${style.color} ring-8 ring-amber-500/10` : 'border-white/5 bg-white/5 hover:border-white/10'} ${!isVoiceLocked && !isGenerating ? 'hover:scale-105' : 'cursor-not-allowed opacity-80'}`}>
                    <div className="absolute top-4 left-4"><GenderIcon gender={profile.gender} className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/10'}`} /></div>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isActive ? 'bg-white/20 scale-110' : 'bg-white/5'}`}><CategoryIcon type={style.icon} className={`w-7 h-7 ${isActive ? 'text-white' : 'text-white/20'}`} /></div>
                    <div className="space-y-1">
                      <h5 className={`text-lg font-bold ${isActive ? 'text-white' : 'text-white/70'}`}>{profile.name}</h5>
                      <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-bold tracking-wider ${isActive ? 'bg-black/40 text-white' : 'bg-white/5 text-white/20'}`}>{profile.category}</span>
                    </div>
                    <p className={`text-[10px] leading-relaxed transition-all px-2 ${isActive ? 'text-white/80' : 'text-white/30'}`}>{profile.description}</p>
                    <div className="mt-auto pt-4 w-full">
                      <div onClick={(e) => !isGenerating && handleVoicePreview(e, profile)} className={`w-full py-2.5 rounded-2xl border text-[9px] font-bold flex items-center justify-center gap-2 transition-all ${isPreviewing ? 'bg-white text-black border-white' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'} ${isGenerating ? 'opacity-30 cursor-not-allowed' : ''}`}>
                        {isPreviewing && isPreviewLoading ? <div className="w-3 h-3 border-2 border-t-black rounded-full animate-spin"></div> : isPreviewing ? <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                        <span>{isPreviewing ? 'إيقاف' : 'استعراض الصوت'}</span>
                      </div>
                    </div>
                  </button>
                );
              }) : <div className="col-span-full py-20 text-center text-white/10 italic text-sm">محرك البحث الصوتي لا يجد نتائج لهذا الاختيار</div>}
            </div>
          </div>
        </section>

        <section className="glass-3d p-16 rounded-[45px]">
          <h3 className="text-xs font-bold text-amber-500 uppercase tracking-[0.4em] text-center mb-16">٣. غرفة التحكم والمعالجة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-10">
            {Object.entries(STUDIO_CONTROLS).map(([key, control]: [string, any]) => (
              <ControlGroup 
                key={key} 
                id={key} 
                title={control.title} 
                options={control.options} 
                current={(voiceControls as any)[key]} 
                onChange={(val) => setVoiceControls(v => ({ ...v, [key]: val }))} 
                disabled={isVoiceLocked || isGenerating} 
              />
            ))}
          </div>

          {/* Voice Purpose Selector */}
          <div className="flex flex-col items-center gap-6 mb-10 pt-6 border-t border-white/5 animate-in fade-in duration-500">
            <label className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.3em] opacity-60">الغرض من الصوت (اختياري)</label>
            <div className="flex flex-wrap justify-center gap-2">
              {['إعلان', 'قصصي', 'توعوي', 'إخباري', 'تعليمي'].map(p => (
                <button 
                  key={p} 
                  disabled={isVoiceLocked || isGenerating}
                  onClick={() => setVoiceControls(v => ({ ...v, purpose: voiceControls.purpose === p ? '' : p }))}
                  className={`px-8 py-3 rounded-full border text-[11px] font-bold transition-all duration-300 ${voiceControls.purpose === p ? 'gold-bg text-black border-transparent shadow-xl scale-105' : 'border-white/10 bg-white/5 text-white/40 hover:border-amber-500/40'}`}
                >
                  {p}
                </button>
              ))}
            </div>
            {voiceControls.purpose && (
              <p className="text-[10px] text-amber-500/40 italic font-medium animate-in slide-in-from-bottom-2">
                سيتم ضبط الأداء ليكون {
                  voiceControls.purpose === 'إعلان' ? 'حماسياً وجذاباً' :
                  voiceControls.purpose === 'قصصي' ? 'دافئاً ومعبراً' :
                  voiceControls.purpose === 'توعوي' ? 'هادئاً ومطمئناً' :
                  voiceControls.purpose === 'إخباري' ? 'رسمياً ومباشراً' : 'واضحاً وتفسيرياً'
                }
              </p>
            )}
          </div>
          
          {/* Voice Lock & Fingerprint Section */}
          <div className="flex flex-col items-center gap-8 pt-4">
            <div className="flex flex-wrap justify-center items-center gap-6">
              <button 
                disabled={isGenerating}
                onClick={() => setIsVoiceLocked(!isVoiceLocked)}
                className={`px-16 py-5 rounded-full font-bold text-sm transition-all flex items-center gap-4 border-2 shadow-2xl ${isVoiceLocked ? 'bg-green-500/10 border-green-500 text-green-500 scale-105' : 'bg-white/5 border-white/10 text-white/60 hover:border-amber-500/40'} ${isGenerating ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                {isVoiceLocked ? (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                    <span>الصوت مثبت</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    <span>🔒 تثبيت الصوت</span>
                  </>
                )}
              </button>

              <button 
                disabled={isGenerating}
                onClick={() => setShowFingerprintPanel(!showFingerprintPanel)}
                className={`px-10 py-4 rounded-full font-bold text-xs transition-all flex items-center gap-3 border shadow-lg ${voiceFingerprint.isActive ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'border-white/10 bg-white/2 text-white/50 hover:border-amber-500/30 hover:text-amber-500'} ${isGenerating ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c-1.22 0-2.383.218-3.46.614m1.304 12.44a8.002 8.002 0 01-4.704-5.68m.224-6.3a8.002 8.002 0 014.704 5.68" />
                </svg>
                <span>بصمة الصوت</span>
              </button>
            </div>

            {/* Fingerprint Panel Overlay */}
            {showFingerprintPanel && (
              <div className="w-full max-w-lg p-8 rounded-[40px] bg-[#0a0a0a] border border-white/5 shadow-3xl space-y-8 animate-in zoom-in duration-300 relative z-[50]">
                <div className="flex justify-between items-center flex-row-reverse border-b border-white/5 pb-4">
                  <h4 className="text-sm font-bold gold-text">تخصيص بصمة الصوت</h4>
                  <button onClick={() => setShowFingerprintPanel(false)} className="text-white/20 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest text-right block">اسم الهوية الصوتية (اختياري)</label>
                    <input 
                      type="text" 
                      value={voiceFingerprint.name} 
                      onChange={(e) => setVoiceFingerprint(v => ({ ...v, name: e.target.value }))}
                      placeholder="مثل: صوت البودكاست، صوت القناة..." 
                      className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm focus:outline-none focus:border-amber-500/20 text-right"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-amber-500/40 uppercase tracking-widest text-right block">الأسلوب</label>
                      <div className="flex flex-col gap-2">
                        {['رسمي', 'ودود', 'حماسي'].map(s => (
                          <button key={s} onClick={() => setVoiceFingerprint(v => ({ ...v, style: s as any }))} className={`p-3 rounded-xl border text-[11px] font-bold transition-all ${voiceFingerprint.style === s ? 'bg-amber-500/10 border-amber-500 text-white' : 'bg-white/2 border-white/5 text-white/30 hover:bg-white/5'}`}>{s}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-amber-500/40 uppercase tracking-widest text-right block">الإيقاع</label>
                      <div className="flex flex-col gap-2">
                        {['هادئ', 'متوسط', 'نشيط'].map(r => (
                          <button key={r} onClick={() => setVoiceFingerprint(v => ({ ...v, rhythm: r as any }))} className={`p-3 rounded-xl border text-[11px] font-bold transition-all ${voiceFingerprint.rhythm === r ? 'bg-amber-500/10 border-amber-500 text-white' : 'bg-white/2 border-white/5 text-white/30 hover:bg-white/5'}`}>{r}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-amber-500/40 uppercase tracking-widest text-right block">طريقة السرد</label>
                      <div className="flex flex-col gap-2">
                        {['مباشر', 'قصصي'].map(n => (
                          <button key={n} onClick={() => setVoiceFingerprint(v => ({ ...v, narrative: n as any }))} className={`p-3 rounded-xl border text-[11px] font-bold transition-all ${voiceFingerprint.narrative === n ? 'bg-amber-500/10 border-amber-500 text-white' : 'bg-white/2 border-white/5 text-white/30 hover:bg-white/5'}`}>{n}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
                    <button onClick={handleSaveFingerprint} className="w-full py-5 rounded-2xl gold-bg text-black font-bold text-sm shadow-2xl hover:scale-[1.02] transition-all">حفظ بصمة الصوت</button>
                    {voiceFingerprint.isActive && (
                      <button onClick={() => { setVoiceFingerprint(v => ({ ...v, isActive: false })); setShowFingerprintPanel(false); }} className="text-[10px] font-bold text-red-500/60 hover:text-red-500 transition-colors">إلغاء تفعيل البصمة</button>
                    )}
                  </div>
                </div>

                {fingerprintConfirmation && (
                  <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-[40px] flex items-center justify-center animate-in fade-in">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500 flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <p className="font-bold text-white">تم حفظ بصمة الصوت بنجاح</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <p className="text-[10px] text-white/20 text-center max-w-sm">تثبيت الصوت يمنع تغيير اللهجة أو المؤدي أو الإعدادات أثناء جلسات الإنتاج الطويلة لضمان الاتساق الكامل.</p>
          </div>
        </section>

        <section className="glass-3d p-16 rounded-[45px] space-y-12">
          <h3 className="text-xs font-bold text-amber-500 uppercase tracking-[0.4em] text-center">٤. هندسة النص والمخطوطة</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-5">
              <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest text-right block pr-4">مسودة النص</label>
              <textarea 
                disabled={isGenerating} 
                className="w-full h-80 bg-black/40 border border-white/5 rounded-[40px] p-10 text-xl text-white placeholder-white/5 focus:outline-none focus:border-amber-500/20 transition-all font-arabic leading-relaxed resize-none text-right shadow-2xl disabled:opacity-50" 
                placeholder="ابدأ بكتابة فكرتك هنا..." 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
              />
              <div className="flex gap-4">
                <button 
                  onClick={async () => { 
                    setIsPreprocessing(true); 
                    const r = await savioService.preprocessText(inputText, { dialect: selectedDialect.title, field: selectedField.title, personality: selectedVoiceName, controls: voiceControls }); 
                    setProcessedText(r); 
                    setIsPreprocessing(false); 
                  }} 
                  disabled={isPreprocessing || !inputText.trim() || isGenerating} 
                  className="flex-1 py-5 rounded-[24px] border border-amber-500/20 bg-amber-500/5 text-amber-500 text-sm font-bold hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center gap-4 group shadow-lg disabled:opacity-30"
                >
                  {isPreprocessing && <div className="w-4 h-4 border-2 border-t-amber-500 rounded-full animate-spin"></div>}
                  <span className="tracking-widest">تحسين النص ذكياً</span>
                </button>
                <button 
                  onClick={handleIdentifyPivotSentences}
                  disabled={isAnalyzingKey || (!inputText.trim() && !processedText.trim()) || isGenerating}
                  className="px-6 py-5 rounded-[24px] border border-white/10 bg-white/5 text-white/40 hover:text-amber-500 hover:border-amber-500/30 transition-all flex items-center justify-center gap-2 group disabled:opacity-30"
                  title="تحليل الجمل المحورية"
                >
                  {isAnalyzingKey ? <div className="w-4 h-4 border-2 border-t-transparent border-amber-500 rounded-full animate-spin"></div> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.989-2.386l-.548-.547z" /></svg>}
                </button>
              </div>
            </div>
            <div className="space-y-5">
              <label className="text-[10px] font-bold text-amber-500/50 uppercase tracking-widest text-right block pr-4">المخطوطة النهائية</label>
              <textarea 
                disabled={isGenerating} 
                className="w-full h-80 bg-amber-500/5 border border-amber-500/10 rounded-[40px] p-10 text-xl text-amber-50 placeholder-white/5 focus:outline-none focus:border-amber-500/30 transition-all font-arabic leading-relaxed resize-none text-right shadow-2xl disabled:opacity-50" 
                placeholder="سيظهر النص المعالج هنا للإخراج النهائي..." 
                value={processedText} 
                onChange={(e) => setProcessedText(e.target.value)} 
              />
            </div>
          </div>
        </section>

        <section className="flex flex-col items-center">
          {/* Pivotal Sentences Insight Hint */}
          {keySentences.length > 0 && !isGenerating && (
            <div className="w-full max-w-2xl bg-amber-500/5 border border-amber-500/10 rounded-[35px] p-8 mb-10 animate-in slide-in-from-top-4 fade-in duration-500 backdrop-blur-xl">
              <div className="flex items-center justify-between flex-row-reverse mb-5 border-b border-amber-500/10 pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-amber-500 uppercase tracking-[0.2em]">جملة محورية</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                </div>
                <svg className="w-5 h-5 text-amber-500/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="space-y-3">
                {keySentences.map((s, i) => (
                  <p key={i} className="text-sm text-white/60 text-right leading-relaxed italic pr-4 border-r border-amber-500/20">{s}</p>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={handleStartTTSSynthesis} 
            disabled={isGenerating || (!processedText.trim() && !inputText.trim())} 
            className={`w-full max-w-2xl py-10 rounded-full font-bold text-2xl flex items-center justify-center gap-6 transition-all shadow-2xl ${isGenerating ? 'bg-white/5 text-white/10 cursor-not-allowed' : 'gold-bg text-black hover:scale-105 active:scale-95 shadow-amber-500/40'}`}
          >
            {isGenerating ? (
              <>
                <div className="w-8 h-8 border-4 border-t-black rounded-full animate-spin"></div>
                <span className="animate-pulse">جاري الإنتاج الصوتي...</span>
              </>
            ) : (
              <>
                <svg className="h-10 w-10" fill="currentColor" viewBox="0 20 20">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                </svg>
                توليد الصوت النهائي
              </>
            )}
          </button>

          {isGenerating && (
            <div className="w-full max-w-2xl mx-auto mt-12 space-y-8 animate-in fade-in slide-in-from-top-4 duration-700 perspective-1000">
              <div className="space-y-4 text-center">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[11px] font-bold text-amber-500 uppercase tracking-[0.5em] drop-shadow-sm">{generationStatus}</span>
                  <div className="h-0.5 w-12 bg-amber-500/30 rounded-full"></div>
                </div>
                <div className="relative h-6 w-full bg-black/80 rounded-full overflow-hidden border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
                  <div 
                    className="absolute top-0 left-0 h-full gold-bg transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) relative"
                    style={{ width: `${generationProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent h-1/2 opacity-50" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-amber-400 blur-md opacity-60 animate-pulse" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-black text-white mix-blend-difference tracking-tighter">{generationProgress}%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center px-4">
                  <span className="text-[8px] text-white/20 font-bold uppercase tracking-widest">Studio Engine v2.5</span>
                  <span className="text-[8px] text-white/20 font-bold uppercase tracking-widest">AI Synthesis Active</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {currentResult && !isGenerating && (
          <section className="w-full flex flex-col items-center gap-10 animate-in fade-in slide-in-from-top-4 duration-700">
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-[0.4em]">النتيجة الحالية</h3>
            <UnifiedAudioPlayer 
              url={currentResult.audioBlobUrl} 
              title={`جلسة: ${currentResult.selection.dialect}`} 
              subtitle={currentResult.selection.type} 
              showShare={true} 
            />
          </section>
        )}

        {history.length > 0 && (
          <section className="glass-3d p-16 rounded-[45px] space-y-10">
            <h3 className="text-xs font-bold text-white/20 uppercase tracking-[0.4em] text-center">السجل الأخير</h3>
            <div className="space-y-4">
              {history.map((item) => (
                <div key={item.id} className="bg-white/2 border border-white/5 p-6 rounded-3xl flex items-center justify-between flex-row-reverse hover:bg-white/5 transition-all">
                  <div className="text-right">
                    <p className="font-bold text-white/80">{item.voiceName} - {item.dialect}</p>
                    <p className="text-[9px] text-white/20 uppercase">{new Date(item.timestamp).toLocaleTimeString('ar-EG')}</p>
                  </div>
                  <button 
                    onClick={() => handleHistoryPlay(item.url, item.id)}
                    className="p-3 rounded-full bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black transition-all"
                  >
                    {activePreviewId === item.id ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="glass-3d p-16 rounded-[45px] space-y-14">
          <div className="text-center space-y-4"><h2 className="text-5xl font-extrabold gold-text tracking-tight">Studios</h2><p className="text-white/40 text-lg">أدوات الإنتاج المتخصصة</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <button 
              disabled={isGenerating} 
              onClick={() => { initializeNewProject(); setAppMode('audiobook'); }} 
              onMouseEnter={() => setHoveredStudio('audiobook')}
              onMouseLeave={() => setHoveredStudio(null)}
              className={`group relative bg-[#0a0a0a] border border-white/5 rounded-[35px] p-10 text-right space-y-4 transition-all duration-500 overflow-hidden ${!isGenerating ? 'hover:scale-[1.05] hover:border-amber-500/30' : 'opacity-30 cursor-not-allowed'}`}
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-amber-500 group-hover:gold-bg group-hover:text-black transition-all duration-500 mb-2">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.247 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <h4 className="text-xl font-bold text-white group-hover:gold-text transition-colors">Audiobook Studio</h4>
              <div className="min-h-[40px] flex items-center justify-end">
                {hoveredStudio === 'audiobook' && (
                  <p className="text-[12px] text-amber-500 font-bold leading-relaxed drop-shadow-[0_0_10px_rgba(212,175,55,0.8)] transition-all duration-300 animate-in fade-in">
                    <TypewriterText text="حوّل كتابك لتجربة صوتية كاملة… راوي، شخصيات، وإخراج احترافي" />
                  </p>
                )}
              </div>
            </button>

            <button 
              disabled={isGenerating} 
              onClick={() => setAppMode('podcast')} 
              onMouseEnter={() => setHoveredStudio('podcast')}
              onMouseLeave={() => setHoveredStudio(null)}
              className={`group relative bg-[#0a0a0a] border border-white/5 rounded-[35px] p-10 text-right space-y-4 transition-all duration-500 overflow-hidden ${!isGenerating ? 'hover:scale-[1.05] hover:border-amber-500/30' : 'opacity-30 cursor-not-allowed'}`}
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-amber-500 group-hover:gold-bg group-hover:text-black transition-all duration-500 mb-2">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h4 className="text-xl font-bold text-white group-hover:gold-text transition-colors">Podcast Studio</h4>
              <div className="min-h-[40px] flex items-center justify-end">
                {hoveredStudio === 'podcast' && (
                  <p className="text-[12px] text-amber-500 font-bold leading-relaxed drop-shadow-[0_0_10px_rgba(212,175,55,0.8)] transition-all duration-300 animate-in fade-in">
                    <TypewriterText text="اصنع بودكاست ذكي بصوت بشري… تحليل، حوار، وإنتاج جاهز" />
                  </p>
                )}
              </div>
            </button>

            <button 
              disabled={isGenerating} 
              onClick={() => setAppMode('transcript')} 
              onMouseEnter={() => setHoveredStudio('transcript')}
              onMouseLeave={() => setHoveredStudio(null)}
              className={`group relative bg-[#0a0a0a] border border-white/5 rounded-[35px] p-10 text-right space-y-4 transition-all duration-500 overflow-hidden ${!isGenerating ? 'hover:scale-[1.05] hover:border-amber-500/30' : 'opacity-30 cursor-not-allowed'}`}
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-amber-500 group-hover:gold-bg group-hover:text-black transition-all duration-500 mb-2">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </div>
              <h4 className="text-xl font-bold text-white group-hover:gold-text transition-colors">Transcript Studio</h4>
              <div className="min-h-[40px] flex items-center justify-end">
                {hoveredStudio === 'transcript' && (
                  <p className="text-[12px] text-amber-500 font-bold leading-relaxed drop-shadow-[0_0_10px_rgba(212,175,55,0.8)] transition-all duration-300 animate-in fade-in">
                    <TypewriterText text="فرّغ الصوت بدقة عالية… نص كامل بدون اختصار أو فقدان كلمة" />
                  </p>
                )}
              </div>
            </button>
          </div>
        </section>
      </div>

      <footer className="mt-40 text-center relative z-10"><p className="text-xs text-white/20 uppercase tracking-[0.8em] font-light">&copy; ٢٠٢٤ سافيو ستوديو VO</p></footer>
      {showIntro && <CinematicIntro onComplete={() => { sessionStorage.setItem('savio_intro_played', 'true'); setShowIntro(false); }} />}
      {error && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 px-10 py-5 bg-red-500/20 border border-red-500/30 text-red-500 rounded-3xl backdrop-blur-xl animate-in slide-in-from-bottom-5 font-bold z-[200]">{error}</div>}
    </div>
  );
};

export default App;
