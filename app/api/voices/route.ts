import { NextResponse } from "next/server";

// Common Verbum AI voices for major languages
// Format: { "language-code": { "male": ["voice1", "voice2"], "female": ["voice1", "voice2"] } }
const VOICES: Record<string, { male: string[]; female: string[] }> = {
  "en-US": {
    male: ["en-US-AndrewMultilingualNeural", "en-US-BrianMultilingualNeural", "en-US-ChristopherNeural"],
    female: ["en-US-AvaMultilingualNeural", "en-US-EmmaMultilingualNeural", "en-US-JennyNeural"]
  },
  "en-GB": {
    male: ["en-GB-RyanNeural", "en-GB-ThomasNeural"],
    female: ["en-GB-SoniaNeural", "en-GB-LibbyNeural"]
  },
  "es-MX": {
    male: ["es-MX-JorgeNeural", "es-MX-LibertoNeural"],
    female: ["es-MX-DaliaNeural", "es-MX-BeatrizNeural"]
  },
  "es-ES": {
    male: ["es-ES-AlvaroNeural", "es-ES-ArnauNeural"],
    female: ["es-ES-ElviraNeural", "es-ES-AbrilNeural"]
  },
  "fr-FR": {
    male: ["fr-FR-HenriNeural", "fr-FR-AlainNeural"],
    female: ["fr-FR-DeniseNeural", "fr-FR-BrigitteNeural"]
  },
  "fr-CA": {
    male: ["fr-CA-AntoineNeural", "fr-CA-JeanNeural"],
    female: ["fr-CA-SylvieNeural", "fr-CA-ThierryNeural"]
  },
  "de-DE": {
    male: ["de-DE-ConradNeural", "de-DE-KlausNeural"],
    female: ["de-DE-KatjaNeural", "de-DE-AmalaNeural"]
  },
  "it-IT": {
    male: ["it-IT-DiegoNeural", "it-IT-BenignoNeural"],
    female: ["it-IT-ElsaNeural", "it-IT-IsabellaNeural"]
  },
  "pt-BR": {
    male: ["pt-BR-AntonioNeural", "pt-BR-FabioNeural"],
    female: ["pt-BR-FranciscaNeural", "pt-BR-BrendaNeural"]
  },
  "pt-PT": {
    male: ["pt-PT-DuarteNeural"],
    female: ["pt-PT-RaquelNeural", "pt-PT-FernandaNeural"]
  },
  "zh-CN": {
    male: ["zh-CN-YunxiNeural", "zh-CN-YunjianNeural"],
    female: ["zh-CN-XiaoxiaoNeural", "zh-CN-XiaoyiNeural"]
  },
  "zh-TW": {
    male: ["zh-TW-YunJheNeural"],
    female: ["zh-TW-HsiaoChenNeural", "zh-TW-HsiaoYuNeural"]
  },
  "ja-JP": {
    male: ["ja-JP-KeitaNeural", "ja-JP-DaichiNeural"],
    female: ["ja-JP-NanamiNeural", "ja-JP-AoiNeural"]
  },
  "ko-KR": {
    male: ["ko-KR-InJoonNeural", "ko-KR-BongJinNeural"],
    female: ["ko-KR-SunHiNeural", "ko-KR-JiMinNeural"]
  },
  "ar-SA": {
    male: ["ar-SA-HamedNeural"],
    female: ["ar-SA-ZariyahNeural"]
  },
  "ar-EG": {
    male: ["ar-EG-ShakirNeural"],
    female: ["ar-EG-SalmaNeural"]
  },
  "hi-IN": {
    male: ["hi-IN-MadhurNeural"],
    female: ["hi-IN-SwaraNeural"]
  },
  "ru-RU": {
    male: ["ru-RU-DmitryNeural"],
    female: ["ru-RU-SvetlanaNeural", "ru-RU-DariyaNeural"]
  },
  "pl-PL": {
    male: ["pl-PL-MarekNeural"],
    female: ["pl-PL-ZofiaNeural", "pl-PL-AgnieszkaNeural"]
  },
  "nl-NL": {
    male: ["nl-NL-MaartenNeural"],
    female: ["nl-NL-ColetteNeural", "nl-NL-FennaNeural"]
  },
  "sv-SE": {
    male: ["sv-SE-MattiasNeural"],
    female: ["sv-SE-SofieNeural", "sv-SE-HilleviNeural"]
  },
  "da-DK": {
    male: ["da-DK-JeppeNeural"],
    female: ["da-DK-ChristelNeural"]
  },
  "no-NO": {
    male: ["no-NO-FinnNeural"],
    female: ["no-NO-PernilleNeural", "no-NO-IselinNeural"]
  },
  "fi-FI": {
    male: ["fi-FI-HarriNeural"],
    female: ["fi-FI-NooraNeural", "fi-FI-SelmaNeural"]
  },
  "tr-TR": {
    male: ["tr-TR-AhmetNeural"],
    female: ["tr-TR-EmelNeural"]
  },
  "th-TH": {
    male: ["th-TH-NiwatNeural"],
    female: ["th-TH-PremwadeeNeural", "th-TH-AcharaNeural"]
  },
  "vi-VN": {
    male: ["vi-VN-NamMinhNeural"],
    female: ["vi-VN-HoaiMyNeural"]
  },
  "id-ID": {
    male: ["id-ID-ArdiNeural"],
    female: ["id-ID-GadisNeural"]
  },
  "ms-MY": {
    male: ["ms-MY-OsmanNeural"],
    female: ["ms-MY-YasminNeural"]
  },
  "uk-UA": {
    male: ["uk-UA-OstapNeural"],
    female: ["uk-UA-PolinaNeural"]
  },
  "cs-CZ": {
    male: ["cs-CZ-AntoninNeural"],
    female: ["cs-CZ-VlastaNeural"]
  },
  "el-GR": {
    male: ["el-GR-NestorasNeural"],
    female: ["el-GR-AthinaNeural"]
  },
  "he-IL": {
    male: ["he-IL-AvriNeural"],
    female: ["he-IL-HilaNeural"]
  },
  "hu-HU": {
    male: ["hu-HU-TamasNeural"],
    female: ["hu-HU-NoemiNeural"]
  },
  "ro-RO": {
    male: ["ro-RO-EmilNeural"],
    female: ["ro-RO-AlinaNeural"]
  }
};

export async function GET() {
  try {
    return NextResponse.json({ voices: VOICES });
  } catch (error) {
    console.error("Voices API error:", error);
    return NextResponse.json(
      { error: "Failed to get voices" },
      { status: 500 }
    );
  }
}
