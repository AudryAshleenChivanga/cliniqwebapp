type SpeechRecognitionType = typeof window extends never
  ? never
  : (typeof window & {
      webkitSpeechRecognition?: new () => SpeechRecognition;
      SpeechRecognition?: new () => SpeechRecognition;
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

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    onText(transcript);
  };
  recognition.onerror = () => onError("Unable to process voice input.");
  recognition.start();
}
