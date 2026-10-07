// src/pages/EcoChat.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { sendChat } from '../api/client'
import { Send, Bot, User, RefreshCw, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { useLang } from '../contexts/LangContext'

interface Message {
  role: 'user' | 'assistant'
  text: string
  source?: string
}

const QUICK_PROMPTS = [
  'Which bin should I use for a glass bottle?',
  'How do I dispose of swollen lithium batteries?',
  'Can I compost cooked food at home?',
  'What is the e-waste drop-off process?',
  'How do I earn Eco-Points?',
  'Is aluminium foil recyclable?',
]

function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold
        ${isUser ? 'bg-emerald-600' : 'bg-gray-700'}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line shadow-sm
        ${isUser
          ? 'bg-emerald-600 text-white rounded-tr-sm'
          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
        {msg.text}
        {msg.source && (
          <p className={`text-xs mt-2 ${isUser ? 'text-emerald-200' : 'text-gray-400'}`}>
            via {msg.source}
          </p>
        )}
      </div>
    </div>
  )
}

export default function EcoChat() {
  const { lang } = useLang()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: "👋 Hi! I'm EcoChat, your EcoSort AI assistant.\n\nAsk me anything about waste sorting, recycling, composting, or hazardous disposal — or pick a quick prompt below!",
    },
  ])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const [listening, setListening] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Speech-to-text (voice input)
  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      alert('Voice input is not supported in your browser. Please use Chrome or Edge.')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR()
    recognitionRef.current = recognition
    recognition.lang = lang === 'hi' ? 'hi-IN' : lang === 'hinglish' ? 'hi-IN' : 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript as string
      setInput(prev => prev + (prev ? ' ' : '') + transcript)
      setListening(false)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
    setListening(true)
  }, [lang])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  // Text-to-speech (voice output)
  const speak = useCallback((text: string) => {
    if (!ttsEnabled || !window.speechSynthesis) return
    // Cancel any current speech
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
  }, [ttsEnabled, lang])

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || sending) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setSending(true)

    try {
      const res = await sendChat(msg)
      setMessages(prev => [...prev, { role: 'assistant', text: res.reply, source: res.source }])
      speak(res.reply)
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Unknown error'
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `⚠️ Sorry, I couldn't reach the server right now.\n\n${err}`,
      }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] max-w-2xl">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">EcoChat</h1>
        <p className="text-gray-500 mt-1">Ask anything about waste, recycling, or eco best practices.</p>
      </div>

      {/* Message feed */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-4">
        {messages.map((m, i) => <ChatBubble key={i} msg={m} />)}
        {sending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <RefreshCw size={16} className="text-gray-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="my-3 flex flex-wrap gap-2">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p}
            onClick={() => handleSend(p)}
            disabled={sending}
            className="text-xs bg-white border border-emerald-300 text-emerald-700 rounded-full
                       px-3 py-1.5 hover:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Voice controls */}
      <div className="flex justify-end gap-2 mb-1">
        <button
          onClick={() => listening ? stopListening() : startListening()}
          title={listening ? 'Stop listening' : 'Start voice input'}
          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-colors
            ${listening
              ? 'bg-rose-100 border-rose-300 text-rose-700 animate-pulse'
              : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'}`}
        >
          {listening ? <MicOff size={13} /> : <Mic size={13} />}
          {listening ? 'Stop' : 'Voice Input'}
        </button>
        <button
          onClick={() => setTtsEnabled(v => !v)}
          title={ttsEnabled ? 'Disable voice output' : 'Enable voice output'}
          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-colors
            ${ttsEnabled
              ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
              : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'}`}
        >
          {ttsEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          {ttsEnabled ? 'TTS On' : 'TTS Off'}
        </button>
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={lang === 'hi' ? 'अपना प्रश्न टाइप करें…' : lang === 'hinglish' ? 'Apna sawaal type karo…' : 'Type your question…'}
          disabled={sending}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:bg-gray-100"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || sending}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white
                     rounded-xl px-4 py-2.5 transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
