export enum VoiceName {
  Kore = 'Kore',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}

export interface VoiceControls {
  temp: string;
  emotion: string;
  speed: string;
  depth: string;
  pitch: string;
  drama: string;
  purpose?: string;
}

export interface VoiceFingerprint {
  name: string;
  style: 'رسمي' | 'ودود' | 'حماسي';
  rhythm: 'هادئ' | 'متوسط' | 'نشيط';
  narrative: 'مباشر' | 'قصصي';
  isActive: boolean;
}

export interface VoiceSelection {
  dialect: string;
  type: string;
  field: string;
  controls: VoiceControls;
  fingerprint?: VoiceFingerprint;
}

export interface GenerationHistory {
  id: string;
  text: string;
  selection: VoiceSelection;
  timestamp: number;
  audioBlobUrl: string;
}

export interface NarrationSegment {
  id: number;
  label: string;
  role: string;
  selectedVoice: string;
  content: string;
  pilotAudioUrl?: string;
  finalAudioUrl?: string;
}

export interface AudiobookProject {
  id: string;
  name: string;
  dialectId: string;
  status: 'مسودة' | 'قيد الإعداد';
  createdAt: number;
  lastEdited: number;
  content: string;
  enhancedContent: string;
  segments: NarrationSegment[];
}