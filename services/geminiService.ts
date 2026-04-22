import { GoogleGenAI, Modality, Type } from "@google/genai";
import { VoiceControls } from "../types";
import { VoiceProfile } from "../constants";

// Audio Decoding Helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudio_Data(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Convert AudioBuffer to WAV Blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);

  setUint32(0x61746164);                         // "data"
  setUint32(length - pos - 4);

  for (i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([outBuffer], { type: "audio/wav" });
}

export interface SpeakerProfile {
  id: string;
  role: string;
  tone: string;
  style: string;
  gender: 'male' | 'female' | 'any';
  categoryHint: 'doc' | 'ads' | 'cartoon' | 'podcast' | 'novels' | 'youtube' | 'drama' | 'edu' | 'corporate';
  description: string;
  reasoning: string;
}

export interface PodcastTurn {
  speakerId: string;
  text: string;
}

export interface PodcastScriptResult {
  turns: PodcastTurn[];
  speakers: SpeakerProfile[];
  error?: string;
}

export interface SegmentSuggestion {
  label: string;
  role: string;
  text: string;
}

export class SavioStudioService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  private generateVoiceFingerprint(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString().substring(0, 8);
  }

  async preprocessText(text: string, options: { dialect: string, field: string, personality: string, controls: any }): Promise<string> {
    let dialectInstruction = `الالتزام بنمط وروح اللهجة: ${options.dialect}.`;
    
    const dialectKey = options.dialect.toLowerCase();

    // Automatic Sudanese Adaptation Logic
    if (dialectKey.includes("سودانية") || dialectKey === 'sudanese') {
      dialectInstruction = `
أنت خبير لغوي في اللهجة السودانية. 
المهمة: تحويل النص التالي إلى اللهجة السودانية الدارجة الخفيفة والمفهومة.
القواعد:
1. استخدم مفردات سودانية أصيلة ومفهومة (مثلاً: شديد، هسة، زول، تمام).
2. طبق قواعد صياغة الجمل السودانية مع الحفاظ على المعنى الأصلي بدقة.
3. تجنب المصطلحات شديدة الصعوبة أو "الراندوك" المبالغ فيه.
4. ابتعد تماماً عن أنماط الحديث المصرية أو الخليجية.
5. أخرج النص المعدل فقط.
      `;
    }

    // Automatic Yemeni Adaptation Logic
    if (dialectKey.includes("يمنية") || dialectKey === 'yemeni') {
      dialectInstruction = `
أنت خبير لغوي في اللهجة اليمنية. 
المهمة: تحويل النص التالي إلى اللهجة اليمنية البيضاء (المدنية) المفهومة واللطيفة.
القواعد:
1. استخدم مفردات يمنية دارجة خفيفة ومحببة (مثلاً: الحين، كذا، عاد، خلّينا، نشوف، تمام).
2. طبق قواعد صياغة الجمل اليمنية مع الحفاظ على المعنى الأصلي بدقة.
3. التزم بالنبرة اليمنية المدنية الواضحة والمباشرة.
4. تجنب المصطلحات قبلية أو إقليمية شديدة الصعوبة؛ اجعلها "لهجة بيضاء" يمنية.
5. ابتعد تماماً عن أنماط الحديث الخليجية أو السعودية الثقيلة.
6. أخرج النص المعدل فقط.
      `;
    }

    // Automatic Lebanese Adaptation Logic
    if (dialectKey.includes("لبنانية") || dialectKey === 'lebanese') {
      dialectInstruction = `
أنت خبير لغوي في اللهجة اللبنانية. 
المهمة: تحويل النص التالي إلى اللهجة اللبنانية البيضاء (المدنية) الأنيقة واللطيفة.
القواعد:
1. استخدم مفردات لبنانية دارجة خفيفة ومحببة (مثلاً: هلق، كتير، هيك، خلّينا، تمام، أكيد، مش مشكلة).
2. طبق قواعد صياغة الجمل اللبنانية مع الحفاظ على المعنى الأصلي بدقة ومرونة.
3. التزم بالنبرة اللبنانية المدنية الراقية والواضحة.
4. تجنب المبالغة في اللكنة أو استخدام المصطلحات سوقية؛ اجعلها "لهجة بيضاء" لبنانية مهذبة تناسب المحتوى الاحترافي.
5. ابتعد تماماً عن أنماط الحديث المصرية أو الخليجية.
6. أخرج النص المعدل فقط.
      `;
    }

    const prompt = `
أنت خبير معالجة نصوص في استوديو "سافيو VO". مهمتك هي إعادة صياغة النص العربي التالي ليناسب الأداء الصوتي المحترف.
${dialectInstruction}
النص المراد معالجته:
"${text}"
أخرج النص المعالج فقط بالعربية.
    `;

    try {
      const result = await this.getAI().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
      });
      return result.text || text;
    } catch (error) {
      return text;
    }
  }

  async identifyKeySentences(text: string): Promise<string[]> {
    if (!text || text.length < 20) return [];
    
    const prompt = `
أنت خبير تحليل محتوى عربي. قم بتحليل النص المرفق واستخرج أهم جملة أو جملتين (الجمل المحورية) فقط.
الجمل المحورية هي التي تمثل:
1. الفكرة الأساسية (Main Idea).
2. الرسالة المركزية (Key Message).
3. رؤية عميقة (Central Insight).
4. دعوة واضحة لاتخاذ إجراء (Call-to-Action).

القواعد الصارمة:
- استخرج الجمل كما هي حرفياً من النص الأصلي بدون أي تعديل أو إعادة صياغة.
- لا تضف أي شرح أو تعليق.
- أخرج النتائج بتنسيق JSON حصراً كصفوف في مصفوفة تحت مفتاح "sentences".
- إذا كان النص لا يحتوي على جمل واضحة، أخرج مصفوفة فارغة.
    `;

    try {
      const result = await this.getAI().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt + `\n\nالنص المرفق: "${text}"` }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sentences: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ['sentences']
          }
        }
      });
      const parsed = JSON.parse(result.text || "{\"sentences\":[]}");
      return parsed.sentences || [];
    } catch (error) {
      console.error("Key sentence identification error:", error);
      return [];
    }
  }

  async analyzeAndSegmentText(text: string): Promise<SegmentSuggestion[]> {
    const systemInstruction = `
أنت مخرج كتب صوتية خبير في استوديو "سافيو VO". مهمتك هي تحليل النص العربي المرفق وتقسيمه إلى مقاطع سردية منطقية لتوزيع الأصوات.
القواعد:
1. ميز بين السرد (الراوي) والحوار (الشخصيات).
2. قسم النص إلى فقرات أو حوارات مترابطة.
3. اقترح "دور" (Role) لكل مقطع (مثلاً: الراوي، البطل، شخصية عابرة).
4. أخرج النتائج بتنسيق JSON حصراً كصفوف تحتوي على (label, role, text).
5. الالتزام باللغة العربية في المخرجات.
    `;

    const prompt = `قم بتحليل وتقسيم النص التالي: "${text}"`;

    try {
      const result = await this.getAI().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              segments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    role: { type: Type.STRING },
                    text: { type: Type.STRING }
                  },
                  required: ['label', 'role', 'text']
                }
              }
            },
            required: ['segments']
          }
        }
      });
      const parsed = JSON.parse(result.text || "{\"segments\":[]}");
      return parsed.segments;
    } catch (error) {
      console.error("Segmentation error:", error);
      return [{ label: "مقطع افتراضي", role: "الراوي", text: text }];
    }
  }

  async transcribeMedia(base64: string, mimeType: string, includeTimestamps: boolean, language: string = 'Auto'): Promise<string> {
    const timestampInstruction = includeTimestamps 
      ? "قم بتقسيم النص إلى فقرات مع إضافة طوابع زمنية دقيقة بتنسيق [MM:SS] في بداية كل جملة أو فقرة منطقية." 
      : "لا تضف أي طوابع زمنية، استخرج النص بشكل متصل مع مراعاة الفقرات.";
    
    const langInstruction = language === 'Auto' 
      ? "تعرف على اللغة تلقائياً وحافظ عليها." 
      : `الغة المتوقعة في الملف هي: ${language}. التزم بها بدقة.`;

    const prompt = `
أنت خبير تفريغ نصوص صوتية احترافي (Audio-to-Text). مهمتك هي استخراج النص الكامل من الملف الصوتي المرفق بدقة متناهية.
القواعد الصارمة:
1. استخرج النص كاملاً كما نُطق تماماً (Verbatim Transcription).
2. ممنوع التلخيص نهائياً (Do NOT summarize).
3. ممنوع الاختصار أو حذف أي كلمات (Do NOT shorten or skip).
4. ممنوع إعادة الصياغة؛ انقل الكلمات حرفياً (Do NOT paraphrase).
5. ${langInstruction}
6. حافظ على لهجة المتحدث الأصلية كما هي.
7. لا تقم بتنظيف اللغة أو تصحيح القواعد؛ استخرج ما قيل حرفياً.
8. ${timestampInstruction}
9. أخرج النص المفرغ فقط, بدون أي مقدمات أو تعليقات خارجية.
    `;

    try {
      const result = await this.getAI().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              { inlineData: { mimeType: mimeType, data: base64 } },
              { text: prompt },
            ],
          },
        ],
      });
      return result.text || "";
    } catch (error) {
      console.error("Transcription error:", error);
      throw new Error("فشل في تفريغ النص من الملف الصوتي. يرجى التأكد من جودة الملف وحجمه.");
    }
  }

  async extractTextFromFile(base64: string, mimeType: string): Promise<string> {
    const prompt = `استخرج كافة النصوص العربية المقروءة من الملف المرفق بشكل نظيف وصالح للقراءة الصوتية.`;
    try {
      const result = await this.getAI().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              { inlineData: { mimeType: mimeType, data: base64 } },
              { text: prompt },
            ],
          },
        ],
      });
      const text = result.text;
      if (!text || text.trim().length === 0) throw new Error("تعذر تحليل المحتوى.");
      return text;
    } catch (error) {
      throw new Error("تعذر تحليل المحتوى. يُرجى مراجعة الملف أو تقسيمه.");
    }
  }

  async generatePodcastScript(content: string, dialect: string, dialectId: string, existingSpeakers: SpeakerProfile[] = []): Promise<PodcastScriptResult> {
    if (!content || content.trim().length === 0) {
      return { turns: [], speakers: [], error: "لا يوجد نص لتحليله." };
    }

    const dialectStyleGuides: Record<string, string> = {
      'egyptian': "يجب توطين الحوار لغويًا ليعكس روح اللهجة المصرية العامية. استخدم تعبيرات مصرية دارجة (مثل: عشان، كده، إيه، مفيش) مع الحفاظ على سلاسة الحوار. يفضل تجنب المفردات شديدة الرسمية.",
      'saudi': "يجب توطين الحوار ليعكس نمط الحديث السعودي الدارج والمهذب. استخدم مفردات وروح اللهجة السعودية.",
      'khaleeji': "يجب أن يعكس الحوار نمط الحديث الخليجي الأبيض الواضح والمريح.",
      'levantine': "يجب توطين الحوار لغويًا ليعكس روح اللهجة الشامية بأسلوبها العذب وتعبيراتها الدارجة (مثل: هيك، شو، كرمال).",
      'sudanese': "يجب توطين الحوار لغويًا ليعكس روح اللهجة السودانية الدافئة. استخدم تعبيرات سودانية دارجة ومحببة (مثل: يا زول، هسة، تمام شديد) مع الحفاظ على الوقار السوداني المعتاد في الحديث.",
      'yemeni': "يجب توطين الحوار ليعكس الأصالة اليمنية والأسلوب اليمني المدني الودود في الحديث. استخدم كلمات مثل (الحين، كذا، عاد، نشوف).",
      'lebanese': "يجب توطين الحوار ليعكس الرقة والأناقة اللبنانية في التعبير (مثل: هلق، كتير، هيك، شو، كيفك، ميرسي، كرمالك، أكيد).",
      'fusha': "يجب أن يكون الحوار باللغة العربية الفصحى السليمة والمعاصرة."
    };

    const styleGuide = dialectStyleGuides[dialectId] || `الالتزام بنمط الحديث الخاص بـ ${dialect}.`;

    let speakersInstruction = "";
    if (existingSpeakers.length > 0) {
      speakersInstruction = `
STRICT REQUIREMENT: The user has manually defined the following speakers. You MUST include ALL of them in the generated script turns:
${existingSpeakers.map(s => `- ID: ${s.id}, Role: ${s.role}, Tone: ${s.tone}`).join('\n')}

INSTRUCTIONS:
1. Re-analyze the content balance to include all these defined speakers naturally.
2. DO NOT delete, rename, or overwrite any of the IDs or Roles provided above.
3. If the script was previously two speakers and now there are more, expand the narrative turns to give the new characters significant presence.
4. Return all speakers (including the ones provided above) in the "speakers" array.
      `;
    }

    const analysisSystemInstruction = `
أنت خبير صياغة حوارات بودكاست ومخرج فني في استوديو "سافيو VO".
المهمة: تحليل النص المرفق وتنفيذ معالجة ذكية للسيناريو والشخصيات:
1. تحليل الشخصيات: تحديد كافة المتحدثين المذكورين أو المستنبطين من النص بدقة. استخرج العدد الحقيقي للمتحدثين الذين يثرون الحوار بناءً على تعقيد المحتوى.
2. تصنيف الأدوار: حدد الدور لكل شخصية ونبرة الحديث (هادئ، متحمس، رسمي).
3. ذكاء التوزيع: اقترح أفضل فئة صوتية (categoryHint) من الخيارات التالية لكل شخصية جديدة: [doc, ads, cartoon, podcast, novels, youtube, drama, edu, corporate].
4. صياغة السيناريو: تحويل المحتوى إلى حوار منساب طبيعي بين الشخصيات.

${speakersInstruction}

إرشاد اللهجة:
${styleGuide}

المخرجات المطلوبة بتنسيق JSON:
- "speakers": مصفوفة من الكائنات تحتوي على (id, role, tone, style, gender ['male', 'female', 'any'], categoryHint, description, reasoning).
- "turns": مصفوفة من الكائنات (speakerId, text).
    `;

    const prompt = `المحتوى المراد تحليله: "${content}"`;

    try {
      const result = await this.getAI().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: analysisSystemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              error: { type: Type.STRING },
              speakers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    role: { type: Type.STRING },
                    tone: { type: Type.STRING },
                    style: { type: Type.STRING },
                    gender: { type: Type.STRING, enum: ['male', 'female', 'any'] },
                    categoryHint: { type: Type.STRING, enum: ['doc', 'ads', 'cartoon', 'podcast', 'novels', 'youtube', 'drama', 'edu', 'corporate'] },
                    description: { type: Type.STRING },
                    reasoning: { type: Type.STRING }
                  },
                  required: ['id', 'role', 'tone', 'style', 'gender', 'categoryHint', 'description', 'reasoning']
                }
              },
              turns: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speakerId: { type: Type.STRING },
                    text: { type: Type.STRING }
                  },
                  required: ['speakerId', 'text']
                }
              }
            },
            required: ['turns', 'speakers']
          }
        }
      });
      
      const parsed: PodcastScriptResult = JSON.parse(result.text || "{\"turns\":[], \"speakers\":[]}");
      return parsed;
    } catch (error) {
      return { turns: [], speakers: [], error: "تعذر تحليل المحتوى." };
    }
  }

  async generateVoiceOver(
    text: string, 
    voiceName: string, 
    profile: VoiceProfile, 
    controls: VoiceControls, 
    performanceNote: string,
    dialectId?: string
  ): Promise<string> {
    const fingerprint = this.generateVoiceFingerprint(profile.name);
    
    const targetDialect = dialectId || (profile.id.startsWith("egy_") ? "egyptian" : profile.id.startsWith("sau_") ? "saudi" : "fusha");
    
    const dialectPromptMaps: Record<string, string> = {
      'egyptian': `STRICT EGYPTIAN PHONETIC LOCK: 1. Pronounce ALL words using natural Egyptian phonetics. 2. (ج) must be soft 'g'. 3. Casual rhythm.`,
      'saudi': `STRICT SAUDI PHONETIC LOCK: 1. Authentic Saudi prosody. 2. Najdi/Hejazi inflections.`,
      'khaleeji': `STRICT KHALEEJI PHONETIC LOCK: 1. Gulf White phonetics. 2. Traditional elongation.`,
      'levantine': `STRICT LEVANTINE PHONETIC LOCK: 1. Syrian/Levantine melodic prosody.`,
      'sudanese': `STRICT SUDANESE PHONETIC LOCK: 1. Authentic Sudanese phonetics. 2. Proper pronunciation of Sudanese 'qaf' and 'jeem'. 3. Calm, warm Sudanese rhythmic pacing.`,
      'yemeni': `STRICT YEMENI PHONETIC LOCK: 1. Clear Arabic pronunciation with a natural urban Yemeni tone. 2. Neutral urban Yemeni style (avoid aggressive tribal sub-dialects). 3. Avoid Gulf-style elongation or Saudi heavy inflections. 4. Calm and natural rhythmic pacing.`,
      'lebanese': `STRICT LEBANESE PHONETIC LOCK: 1. Soft, smooth Arabic pronunciation with light Lebanese musical intonation. 2. Natural urban Lebanese style (Beirut/Modern urban style). 3. Avoid Gulf-style heaviness or strong Egyptian influence. 4. Natural conversational pacing. 5. Specific vowel elongation characteristic of elegant Lebanese speech.`,
      'fusha': `STRICT MSA LOCK: 1. Formal academic Arabic. 2. Correct case endings.`
    };

    const phoneticLock = dialectPromptMaps[targetDialect] || dialectPromptMaps['fusha'];

    const purposeInstructions: Record<string, string> = {
      'إعلان': "DELIVERY STYLE: Advertisement - energetic, engaging, confident pacing.",
      'قصصي': "DELIVERY STYLE: Narrative - warm, flowing, expressive pacing.",
      'توعوي': "DELIVERY STYLE: Awareness - calm, sincere, reassuring delivery.",
      'إخباري': "DELIVERY STYLE: Informational - neutral, professional, concise.",
      'تعليمي': "DELIVERY STYLE: Educational - clear, steady, explanatory tone."
    };
    
    const purposeDirective = controls.purpose ? purposeInstructions[controls.purpose] : "";

    const studioDirective = `
MODE: READY_FOR_TTS (Text-to-Speech Synthesis Only)
IDENTITY: ${profile.name} (${profile.description})
FINGERPRINT: ${fingerprint}
DIALECT: ${targetDialect}
${phoneticLock}
${purposeDirective}
CONTROLS: Speed ${controls.speed}, Pitch ${controls.pitch}, Emotion ${controls.emotion}.
${performanceNote}

TEXT_TO_SYNTHESIZE: "${text}"
    `;

    try {
      const response = await this.getAI().models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: studioDirective }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("فشل توليد الصوت من الخادم.");

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const decodedBytes = decode(base64Audio);
      const audioBuffer = await decodeAudio_Data(decodedBytes, audioContext, 24000, 1);
      
      return URL.createObjectURL(audioBufferToWav(audioBuffer));
    } catch (error) {
      throw error;
    }
  }
}

export const savioService = new SavioStudioService();
