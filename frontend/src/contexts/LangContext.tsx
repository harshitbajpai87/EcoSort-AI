/**
 * src/contexts/LangContext.tsx
 * =============================
 * Multilingual support: English, Hindi (हिंदी), Hinglish
 * Provides a simple t() translation function and language switcher.
 */

import { createContext, useContext, useState, type ReactNode } from 'react'

export type Language = 'en' | 'hi' | 'hinglish'

// Translation strings
const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    dashboard:     'Dashboard',
    scanner:       'AI Scanner',
    ecochat:       'EcoChat',
    pickup:        'Pickup Requests',
    leaderboard:   'Leaderboard',
    challenges:    'Challenges',
    centers:       'Recycling Map',
    analytics:     'Analytics',
    impact:        'Impact & Report',
    profile:       'Profile',
    // Scanner
    scan_title:    'AI Scanner',
    scan_subtitle: 'Upload a photo of any waste item to get instant AI classification.',
    classify:      'Classify Waste',
    classifying:   'Classifying…',
    reset:         'Reset',
    feedback_correct: 'Was this correct?',
    yes_correct:   'Yes, correct',
    no_wrong:      'No, it\'s wrong',
    // EcoChat
    chat_placeholder: 'Type your question…',
    // Dashboard
    total_scans:   'Total Scans',
    waste_diverted: 'Waste Diverted',
    eco_points:    'Eco-Points',
    hazardous:     'Hazardous Items',
    // Common
    loading:       'Loading…',
    error:         'Error',
    submit:        'Submit',
    cancel:        'Cancel',
    sign_out:      'Sign out',
    save:          'Save',
    points_earned: 'EcoPoints earned',
  },
  hi: {
    // Navigation
    dashboard:     'डैशबोर्ड',
    scanner:       'AI स्कैनर',
    ecochat:       'इकोचैट',
    pickup:        'पिकअप अनुरोध',
    leaderboard:   'लीडरबोर्ड',
    challenges:    'चुनौतियाँ',
    centers:       'रीसाइक्लिंग मानचित्र',
    analytics:     'विश्लेषण',
    impact:        'प्रभाव और रिपोर्ट',
    profile:       'प्रोफ़ाइल',
    // Scanner
    scan_title:    'AI स्कैनर',
    scan_subtitle: 'किसी भी अपशिष्ट वस्तु की फ़ोटो अपलोड करें तुरंत AI वर्गीकरण पाने के लिए।',
    classify:      'कचरा वर्गीकृत करें',
    classifying:   'वर्गीकृत हो रहा है…',
    reset:         'रीसेट',
    feedback_correct: 'क्या यह सही था?',
    yes_correct:   'हाँ, सही है',
    no_wrong:      'नहीं, गलत है',
    // EcoChat
    chat_placeholder: 'अपना प्रश्न टाइप करें…',
    // Dashboard
    total_scans:   'कुल स्कैन',
    waste_diverted: 'कचरा मोड़ा',
    eco_points:    'इको-पॉइंट्स',
    hazardous:     'खतरनाक वस्तुएं',
    // Common
    loading:       'लोड हो रहा है…',
    error:         'त्रुटि',
    submit:        'जमा करें',
    cancel:        'रद्द करें',
    sign_out:      'साइन आउट',
    save:          'सहेजें',
    points_earned: 'इको-पॉइंट्स अर्जित',
  },
  hinglish: {
    // Navigation
    dashboard:     'Dashboard',
    scanner:       'AI Scanner',
    ecochat:       'EcoChat',
    pickup:        'Pickup Request',
    leaderboard:   'Leaderboard',
    challenges:    'Challenges',
    centers:       'Recycling Map',
    analytics:     'Analytics',
    impact:        'Impact & Report',
    profile:       'Profile',
    // Scanner
    scan_title:    'AI Scanner',
    scan_subtitle: 'Kisi bhi waste item ki photo upload karo — turant AI classification milegi!',
    classify:      'Waste Classify Karo',
    classifying:   'Classify ho raha hai…',
    reset:         'Reset Karo',
    feedback_correct: 'Kya yeh sahi tha?',
    yes_correct:   'Haan, sahi hai',
    no_wrong:      'Nahi, galat hai',
    // EcoChat
    chat_placeholder: 'Apna sawaal type karo…',
    // Dashboard
    total_scans:   'Total Scans',
    waste_diverted: 'Waste Diverted',
    eco_points:    'Eco-Points',
    hazardous:     'Hazardous Items',
    // Common
    loading:       'Load ho raha hai…',
    error:         'Error',
    submit:        'Submit Karo',
    cancel:        'Cancel Karo',
    sign_out:      'Sign Out Karo',
    save:          'Save Karo',
    points_earned: 'EcoPoints mile',
  },
}

interface LangContextValue {
  lang: Language
  setLang: (l: Language) => void
  t: (key: string) => string
}

const LangContext = createContext<LangContextValue | undefined>(undefined)

const STORAGE_KEY = 'ecosort_lang'

export function LangProvider({ children }: { children: ReactNode }) {
  const stored = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as Language | null
  const [lang, setLangState] = useState<Language>(stored ?? 'en')

  function setLang(l: Language) {
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  function t(key: string): string {
    return TRANSLATIONS[lang][key] ?? TRANSLATIONS['en'][key] ?? key
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>')
  return ctx
}
