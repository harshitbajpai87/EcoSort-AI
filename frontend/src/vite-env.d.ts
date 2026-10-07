/// <reference types="vite/client" />

// Web Speech API — not fully typed in TypeScript DOM lib
interface Window {
  SpeechRecognition: typeof SpeechRecognition
  webkitSpeechRecognition: typeof SpeechRecognition
}
