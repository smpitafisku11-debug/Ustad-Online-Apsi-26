"use client";

import {
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type ReactNode,
} from "react";
import "./ustad-online.css";

export interface UstadOnlineMode {
  id: string;
  label: string;
  content: ReactNode;
}

interface UstadOnlineAppProps {
  modes: UstadOnlineMode[];
  initialMode?: string;
}

type DoorPhase = "opening" | "idle" | "closing";

export function UstadOnlineApp({
  modes,
  initialMode,
}: UstadOnlineAppProps) {
  const firstMode = modes[0]?.id ?? "";
  const [activeMode, setActiveMode] = useState(
    modes.some((mode) => mode.id === initialMode) ? initialMode! : firstMode,
  );
  const [pendingMode, setPendingMode] = useState<string | null>(null);
  const pendingModeRef = useRef<string | null>(null);
  const [doorPhase, setDoorPhase] = useState<DoorPhase>("opening");
  const [reducedMotion, setReducedMotion] = useState(false);
  const selectedMode = modes.find((mode) => mode.id === activeMode);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) {
        if (pendingModeRef.current) {
          setActiveMode(pendingModeRef.current);
          pendingModeRef.current = null;
          setPendingMode(null);
        }
        setDoorPhase("idle");
      }
    };
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  function navigateTo(modeId: string) {
    if (modeId === activeMode || doorPhase !== "idle") return;
    if (reducedMotion) {
      setActiveMode(modeId);
      return;
    }
    pendingModeRef.current = modeId;
    setPendingMode(modeId);
    setDoorPhase("closing");
  }

  function handleDoorAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLElement) ||
        !event.target.classList.contains("uo-door-bottom") ||
        !event.animationName.startsWith("uo-door-")) return;

    if (doorPhase === "closing" && pendingMode) {
      setActiveMode(pendingMode);
      pendingModeRef.current = null;
      setPendingMode(null);
      setDoorPhase("opening");
    } else if (doorPhase === "opening") {
      setDoorPhase("idle");
    }
  }

  return (
    <div className="uo-app">
      <nav className="uo-nav" aria-label="Menu utama">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className="uo-nav-button"
            aria-current={activeMode === mode.id ? "page" : undefined}
            disabled={doorPhase !== "idle"}
            onClick={() => navigateTo(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </nav>

      <main className="uo-main">
        {selectedMode?.content}
      </main>

      {doorPhase !== "idle" && (
        <div
          className={`uo-door-overlay is-${doorPhase}`}
          aria-hidden="true"
          onAnimationEnd={handleDoorAnimationEnd}
        >
          <div className="uo-door uo-door-top" />
          <div className="uo-door uo-door-bottom" data-door="bottom" />
          <span className="uo-door-mark">ت</span>
        </div>
      )}
    </div>
  );
}
