import { useCallback, useEffect, useRef, useState } from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  type AudioPlayer,
} from "expo-audio";
import type { RoomAtmosphere } from "./use-room-atmosphere";

const RAIN = require("../../../../packages/assets/rooms/v2/audio/rain.mp3");
const WIND = require("../../../../packages/assets/rooms/v2/audio/wind.mp3");
const CAT = require("../../../../packages/assets/rooms/v2/audio/cat-purr.mp3");
// Expo AudioPlayer is an imperative native handle; property setters are its documented API.
function volume(player: AudioPlayer, value: number) {
  player.volume = value;
}
function looping(player: AudioPlayer) {
  player.loop = true;
}
/** No microphone, background playback or automatic pet calls. A tap starts every listening session. */
export function useRoomAudio(atmosphere: RoomAtmosphere, quiet = false) {
  const rain = useAudioPlayer(RAIN, { updateInterval: 1000 });
  const wind = useAudioPlayer(WIND, { updateInterval: 1000 });
  const cat = useAudioPlayer(CAT, { updateInterval: 1000 });
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(false);
  const ready = useRef(false),
    lastPet = useRef(0);
  const allowed =
    atmosphere.settings.data?.sound_enabled === true &&
    atmosphere.active &&
    !quiet;
  const kind = atmosphere.weather.hour?.kind;
  const rainLevel =
    kind && ["rain", "sleet", "thunder"].includes(kind) ? 0.35 : 0;
  const windLevel = atmosphere.weather.hour
    ? Math.min(0.3, Math.max(0, (atmosphere.weather.hour.windSpeed - 2) / 30))
    : 0;
  useEffect(() => {
    let alive = true;
    void setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: "mixWithOthers",
      allowsRecording: false,
      shouldPlayInBackground: false,
    })
      .then(() => {
        if (alive) ready.current = true;
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
      ready.current = false;
    };
  }, []);
  useEffect(() => {
    looping(rain);
    looping(wind);
    volume(cat, 0.5);
    const subscriptions = [rain, wind, cat].map((player) =>
      player.addListener("playbackStatusUpdate", (status) => {
        if (status.error) setError(true);
      }),
    );
    return () => {
      subscriptions.forEach((sub) => sub.remove());
    };
  }, [rain, wind, cat]);
  useEffect(() => {
    if (!allowed || !listening) {
      rain.pause();
      wind.pause();
      cat.pause();
      return;
    }
    rain.play();
    wind.play();
    const startRain = rain.volume,
      startWind = wind.volume;
    let step = 0;
    const fade = setInterval(() => {
      step++;
      volume(
        rain,
        startRain + (rainLevel - startRain) * Math.min(1, step / 12),
      );
      volume(
        wind,
        startWind + (windLevel - startWind) * Math.min(1, step / 12),
      );
      if (step >= 12) clearInterval(fade);
    }, 100);
    return () => {
      clearInterval(fade);
      rain.pause();
      wind.pause();
      cat.pause();
    };
  }, [allowed, listening, rainLevel, windLevel, rain, wind, cat]);
  const toggle = useCallback(() => {
    if (listening) {
      rain.pause();
      wind.pause();
      cat.pause();
      setListening(false);
      return;
    }
    if (!allowed || !ready.current) {
      setError(true);
      return;
    }
    try {
      // Keep play() synchronous with the user gesture for Safari's media policy.
      volume(rain, 0);
      volume(wind, 0);
      rain.play();
      wind.play();
      setError(false);
      setListening(true);
    } catch {
      setError(true);
    }
  }, [allowed, listening, rain, wind, cat]);
  const petCat = useCallback(() => {
    if (
      !allowed ||
      !listening ||
      !ready.current ||
      Date.now() - lastPet.current < 12000
    )
      return;
    lastPet.current = Date.now();
    try {
      // seekTo can finish asynchronously; play remains in the original gesture on web.
      void cat.seekTo(0).catch(() => setError(true));
      cat.play();
      setError(false);
    } catch {
      setError(true);
    }
  }, [allowed, listening, cat]);
  return { allowed, listening: listening && allowed, toggle, petCat, error };
}
export type RoomAudio = ReturnType<typeof useRoomAudio>;
