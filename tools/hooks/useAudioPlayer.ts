import { useEffect, useRef, useState } from "react";

// In plain terms: this hook controls audio playback for spoken responses.

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlayingAudio(true);
    const handleEnded = () => setIsPlayingAudio(false);
    const handlePause = () => setIsPlayingAudio(false);
    const handleError = () => setIsPlayingAudio(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  const playAudio = (base64Audio: string, mimeType = 'audio/mp3') => {
    const audioUrl = `data:${mimeType};base64,${base64Audio}`;
    setAudioData(audioUrl);
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("Audio playing successfully");
            setIsPlayingAudio(true);
          })
          .catch((err) => {
            console.error("Audio playback failed:", err);
            setIsPlayingAudio(false);
          });
      }
    }
  };

  const replayAudio = () => {
    if (audioRef.current && audioData) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => console.error("Replay failed:", err));
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  return {
    audioRef,
    audioData,
    isPlayingAudio,
    playAudio,
    replayAudio,
    stopAudio,
  };
}
