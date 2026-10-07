// src/components/LangSwitcher.tsx
import { useLang, type Language } from '../contexts/LangContext'

const OPTIONS: { value: Language; label: string; flag: string }[] = [
  { value: 'en',       label: 'EN',      flag: '🇬🇧' },
  { value: 'hi',       label: 'हिं',     flag: '🇮🇳' },
  { value: 'hinglish', label: 'Hinglish', flag: '🤝' },
]

export default function LangSwitcher() {
  const { lang, setLang } = useLang()
  return (
    <div className="flex items-center gap-0.5">
      {OPTIONS.map(o => (
        <button
          key={o.value}
          onClick={() => setLang(o.value)}
          title={o.value === 'en' ? 'English' : o.value === 'hi' ? 'हिंदी' : 'Hinglish'}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors
            ${lang === o.value
              ? 'bg-emerald-600 text-white'
              : 'text-emerald-300 hover:text-white hover:bg-emerald-700'}`}
        >
          {o.flag} {o.label}
        </button>
      ))}
    </div>
  )
}
