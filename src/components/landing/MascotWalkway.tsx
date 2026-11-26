"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MASCOT_SPRITES = {
  walkLeft: "/mascot/transparent/walk-left.webp",
  walkRight: "/mascot/transparent/walk-right.webp",
  welcomeLeft: "/mascot/transparent/welcome-left.webp",
  wagTailLeft: "/mascot/transparent/wag-tail-left.webp",
  stumbleLeft: "/mascot/transparent/stumble-left.webp",
  stumbleRight: "/mascot/transparent/stumble-right.webp",
} as const;

type SpriteKey = keyof typeof MASCOT_SPRITES;
type Facing = "left" | "right";

interface ChoreographyStep {
  sprite: Exclude<SpriteKey, "stumbleLeft" | "stumbleRight">;
  facing: Facing;
  from: number; // normalized track position 0 (left) .. 1 (right)
  to: number;
  durationMs: number;
}

// Smooth automatic loop (no stumble — stumble is triggered interactively on click).
// Each action sprite is 30 frames / 3000ms.
const CHOREOGRAPHY: readonly ChoreographyStep[] = [
  { sprite: "walkLeft", facing: "left", from: 1, to: 0.52, durationMs: 4200 },
  {
    sprite: "welcomeLeft",
    facing: "left",
    from: 0.52,
    to: 0.52,
    durationMs: 3000,
  },
  { sprite: "walkLeft", facing: "left", from: 0.52, to: 0, durationMs: 4400 },
  {
    sprite: "wagTailLeft",
    facing: "left",
    from: 0,
    to: 0,
    durationMs: 3000,
  },
  { sprite: "walkRight", facing: "right", from: 0, to: 1, durationMs: 8200 },
  {
    sprite: "welcomeLeft",
    facing: "left",
    from: 1,
    to: 1,
    durationMs: 3000,
  },
];

const STUMBLE_DURATION_MS = 3000;
const SPRITE_WIDTH = 640;
const SPRITE_HEIGHT = 360;

export function MascotWalkway() {
  const trackRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [stumble, setStumble] = useState<{
    direction: Facing;
    nonce: number;
  } | null>(null);

  const stepIndexRef = useRef(0);
  const stepElapsedRef = useRef(0);
  const progressRef = useRef(CHOREOGRAPHY[0].from);
  const maxTravelRef = useRef(0);
  const pausedRef = useRef(false);
  const stumblingRef = useRef(false);
  const stumbleNonceRef = useRef(0);
  const stumbleTimerRef = useRef<number | null>(null);
  const preloadedRef = useRef(false);

  const applyTransform = useCallback((normalizedX: number) => {
    const actor = actorRef.current;
    if (!actor) return;
    const xPx = Math.round(normalizedX * maxTravelRef.current * 100) / 100;
    actor.style.transform = `translate3d(${xPx}px, 0, 0)`;
  }, []);

  const drawFrozenFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);
    ctx.drawImage(img, 0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);
  }, []);

  // Cleanup stumble timer on unmount
  useEffect(() => {
    return () => {
      if (stumbleTimerRef.current !== null) {
        window.clearTimeout(stumbleTimerRef.current);
      }
    };
  }, []);

  // Respect system reduced-motion preference on mount and when toggled
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = (prefersReduced: boolean) => {
      if (prefersReduced) {
        pausedRef.current = true;
        setIsPaused(true);
        stepIndexRef.current = 1; // welcomeLeft centered
        stepElapsedRef.current = 0;
        progressRef.current = 0.5;
        setStepIndex(1);
        applyTransform(0.5);
      }
    };
    syncPreference(mq.matches);
    const onChange = (e: MediaQueryListEvent) => syncPreference(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [applyTransform]);

  // Preload all sprites (including stumble-left and stumble-right) once near viewport
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting && !preloadedRef.current) {
          preloadedRef.current = true;
          Object.values(MASCOT_SPRITES).forEach((src) => {
            const preload = new Image();
            preload.decoding = "async";
            preload.src = src;
          });
        }
      },
      { rootMargin: "120px 0px" }
    );
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  // Keep travel distance synced to track and actor size
  useEffect(() => {
    const track = trackRef.current;
    const actor = actorRef.current;
    if (!track || !actor) return;

    const measure = () => {
      maxTravelRef.current = Math.max(0, track.clientWidth - actor.offsetWidth);
      applyTransform(progressRef.current);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    ro.observe(actor);
    return () => ro.disconnect();
  }, [applyTransform]);

  // Compositor-only rAF loop (pauses cleanly while stumbling or paused)
  useEffect(() => {
    pausedRef.current = isPaused;
    stumblingRef.current = stumble !== null;

    if (isPaused && stumble === null) {
      drawFrozenFrame();
      return;
    }
    if (!isVisible || stumble !== null) return;

    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (pausedRef.current || stumblingRef.current) return;
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;

      let idx = stepIndexRef.current;
      let elapsed = stepElapsedRef.current + dt;
      let step = CHOREOGRAPHY[idx];

      if (elapsed >= step.durationMs) {
        elapsed = elapsed - step.durationMs;
        idx = (idx + 1) % CHOREOGRAPHY.length;
        step = CHOREOGRAPHY[idx];
        stepIndexRef.current = idx;
        setStepIndex(idx);
      }

      stepElapsedRef.current = elapsed;
      const t = Math.min(1, elapsed / step.durationMs);
      const pos = step.from + (step.to - step.from) * t;
      progressRef.current = pos;
      applyTransform(pos);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPaused, isVisible, stumble, applyTransform, drawFrozenFrame]);

  const activeStep = CHOREOGRAPHY[stepIndex];
  const isFrozen = isPaused && stumble === null;

  const activeSpriteUrl = stumble
    ? `${
        stumble.direction === "left"
          ? MASCOT_SPRITES.stumbleLeft
          : MASCOT_SPRITES.stumbleRight
      }?s=${stumble.nonce}`
    : MASCOT_SPRITES[activeStep.sprite];

  const activeLabel = stumble
    ? "Isked turtle mascot stumbling playfully"
    : "Isked turtle mascot — click to make it stumble";

  function handleMascotClick() {
    if (stumblingRef.current) return;
    const direction = CHOREOGRAPHY[stepIndexRef.current].facing;
    stumbleNonceRef.current += 1;
    stumblingRef.current = true;
    setStumble({ direction, nonce: stumbleNonceRef.current });

    if (stumbleTimerRef.current !== null) {
      window.clearTimeout(stumbleTimerRef.current);
    }
    stumbleTimerRef.current = window.setTimeout(() => {
      stumbleTimerRef.current = null;
      stumblingRef.current = false;
      setStumble(null);
    }, STUMBLE_DURATION_MS);
  }

  return (
    <section
      aria-label="Isked mascot animation"
      className="w-full overflow-x-clip bg-background"
    >
      <div className="relative mx-auto max-w-5xl px-6">
        <div
          ref={trackRef}
          className="relative h-[116px] w-full overflow-x-clip py-1 [container-type:inline-size] sm:h-[134px]"
        >
          <div
            ref={actorRef}
            style={{ transform: "translate3d(calc(100cqi - 100%), 0, 0)" }}
            className="absolute bottom-1 left-0 h-[104px] w-[185px] will-change-transform sm:h-[122px] sm:w-[217px]"
          >
            <button
              type="button"
              onClick={handleMascotClick}
              aria-label={activeLabel}
              title="Click me!"
              className="relative block h-full w-full cursor-pointer rounded-xl bg-transparent p-0 transition-[scale,filter] duration-150 ease-out hover:drop-shadow-xs active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {/* Consistent 16:9 box across all actions using true alpha-transparent animated WebPs */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={activeSpriteUrl}
                alt=""
                aria-hidden="true"
                width={SPRITE_WIDTH}
                height={SPRITE_HEIGHT}
                loading="lazy"
                decoding="async"
                onLoad={() => {
                  if (pausedRef.current && !stumblingRef.current) {
                    drawFrozenFrame();
                  }
                }}
                className={`pointer-events-none absolute inset-0 h-full w-full select-none object-contain object-bottom ${
                  isFrozen ? "opacity-0" : "opacity-100"
                }`}
              />
              <canvas
                ref={canvasRef}
                width={SPRITE_WIDTH}
                height={SPRITE_HEIGHT}
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 h-full w-full select-none object-contain object-bottom ${
                  isFrozen ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
