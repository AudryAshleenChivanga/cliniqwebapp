type SpeechRecognitionResultEventLite = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionLite = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEventLite) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLite;

type SpeechRecognitionType = typeof window extends never
  ? never
  : (typeof window & {
      webkitSpeechRecognition?: SpeechRecognitionCtor;
      SpeechRecognition?: SpeechRecognitionCtor;
    });

export function transcribeOnce(onText: (text: string) => void, onError: (message: string) => void) {
  const globalWindow = window as unknown as SpeechRecognitionType;
  const Constructor = globalWindow.SpeechRecognition || globalWindow.webkitSpeechRecognition;
  if (!Constructor) {
    onError("Speech recognition is not supported in this browser.");
    return;
  }

  const recognition = new Constructor();
  recognition.lang = localStorage.getItem("cliniq_lang") || "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: SpeechRecognitionResultEventLite) => {
    const transcript = event.results[0][0].transcript;
    onText(transcript);
  };
  recognition.onerror = () => onError("Unable to process voice input.");
  recognition.start();
}
