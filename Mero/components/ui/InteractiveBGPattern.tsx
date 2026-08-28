import React, { useRef, useEffect } from "react";

interface InteractiveBGPatternProps {
  className?: string;
  dotSize?: number;
  spacing?: number;
  baseOpacity?: number;
  glowOpacity?: number;
  glowRadius?: number;
  shape?: "circle" | "rectangle";
  rectangleWidth?: number;
  rectangleHeight?: number;
  colorChangeEnabled?: boolean;
  colorChangeInterval?: number;
  mouseTargetRef?: React.RefObject<HTMLDivElement | null>;
}

interface Color {
  r: number;
  g: number;
  b: number;
}

const COLOR_PALETTE: Color[] = [
  { r: 242, g: 242, b: 242 },
  { r: 255, g: 135, b: 170 },
  { r: 110, g: 195, b: 255 },
  { r: 85, g: 240, b: 115 },
  { r: 255, g: 180, b: 105 },
  { r: 235, g: 105, b: 235 },
  { r: 255, g: 237, b: 115 },
];

function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

function getRandomColor(): Color {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
}

export function InteractiveBGPattern({
  className = "",
  dotSize = 2,
  spacing = 25,
  baseOpacity = 0.1,
  glowOpacity = 0.9,
  glowRadius = 300,
  shape = "circle",
  rectangleWidth = 4,
  rectangleHeight = 4,
  colorChangeEnabled = true,
  colorChangeInterval = 2000,
  mouseTargetRef,
}: InteractiveBGPatternProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  const stateRef = useRef({
    targetMousePos: { x: -1000, y: -1000 },
    lerpedMousePos: { x: -1000, y: -1000 },
    currentColor: { r: 85, g: 240, b: 115 },
    targetColor: { r: 255, g: 135, b: 170 },
    colorTransitionProgress: 0,
    lastColorChange: 0,
    pulseScale: 1,
    targetPulseScale: 1,
    lastPulseChange: 0,
  });

  const configRef = useRef({
    dotSize,
    spacing,
    baseOpacity,
    glowOpacity,
    glowRadius,
    shape,
    rectangleWidth,
    rectangleHeight,
    colorChangeEnabled,
    colorChangeInterval,
  });

  useEffect(() => {
    configRef.current = {
      dotSize,
      spacing,
      baseOpacity,
      glowOpacity,
      glowRadius,
      shape,
      rectangleWidth,
      rectangleHeight,
      colorChangeEnabled,
      colorChangeInterval,
    };
  }, [
    dotSize,
    spacing,
    baseOpacity,
    glowOpacity,
    glowRadius,
    shape,
    rectangleWidth,
    rectangleHeight,
    colorChangeEnabled,
    colorChangeInterval,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = stateRef.current;
    state.lastPulseChange = performance.now();
    state.lastColorChange = performance.now();
    state.targetPulseScale = 0.6 + Math.random() * 1.4;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      state.targetMousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      state.targetMousePos = { x: -1000, y: -1000 };
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      state.targetMousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const drawDots = () => {
      const config = configRef.current;
      const rect = container.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const extraDots = 2;
      const cols = Math.ceil(rect.width / config.spacing) + extraDots;
      const rows = Math.ceil(rect.height / config.spacing) + extraDots;
      const offsetX = -config.spacing;
      const offsetY = -config.spacing;

      const scaledGlowRadius = config.glowRadius * state.pulseScale;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * config.spacing + offsetX;
          const y = row * config.spacing + offsetY;

          const dx = state.lerpedMousePos.x - x;
          const dy = state.lerpedMousePos.y - y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          let opacity = config.baseOpacity;
          let currentDotSize = config.dotSize;
          let dramaticInfluence = 0;

          if (distance < scaledGlowRadius) {
            const influence = 1 - distance / scaledGlowRadius;
            dramaticInfluence = Math.pow(influence, 1.5);
            opacity = config.baseOpacity + (config.glowOpacity - config.baseOpacity) * dramaticInfluence;
            currentDotSize = config.dotSize + dramaticInfluence * config.dotSize * 0.6;
          }

          let r: number, g: number, b: number;
          if (config.colorChangeEnabled && state.colorTransitionProgress > 0) {
            r = Math.round(lerp(state.currentColor.r, state.targetColor.r, state.colorTransitionProgress));
            g = Math.round(lerp(state.currentColor.g, state.targetColor.g, state.colorTransitionProgress));
            b = Math.round(lerp(state.currentColor.b, state.targetColor.b, state.colorTransitionProgress));
          } else {
            r = state.currentColor.r;
            g = state.currentColor.g;
            b = state.currentColor.b;
          }

          if (opacity > config.baseOpacity * 2) {
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
            ctx.shadowBlur = currentDotSize * 2;
          } else {
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
          }

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;

          if (config.shape === "rectangle") {
            const currentWidth = config.rectangleWidth + dramaticInfluence * config.rectangleWidth * 0.6;
            const currentHeight = config.rectangleHeight + dramaticInfluence * config.rectangleHeight * 0.6;
            ctx.fillRect(x - currentWidth / 2, y - currentHeight / 2, currentWidth, currentHeight);
          } else {
            ctx.beginPath();
            ctx.arc(x, y, currentDotSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };

    const animate = () => {
      const config = configRef.current;
      const currentTime = performance.now();

      // Pulse animation
      const pulseDuration = 3000;
      const timeSinceLastPulse = currentTime - state.lastPulseChange;

      if (timeSinceLastPulse >= pulseDuration) {
        state.targetPulseScale = 0.6 + Math.random() * 1.4;
        state.lastPulseChange = currentTime;
      }

      const pulseProgress = Math.min(timeSinceLastPulse / pulseDuration, 1);
      const easedPulseProgress = 1 - Math.pow(1 - pulseProgress, 3);
      state.pulseScale = lerp(state.pulseScale, state.targetPulseScale, easedPulseProgress * 0.02);

      // Color transitions
      if (config.colorChangeEnabled) {
        if (currentTime - state.lastColorChange >= config.colorChangeInterval) {
          if (state.colorTransitionProgress > 0 && state.colorTransitionProgress < 1) {
            state.currentColor = {
              r: Math.round(lerp(state.currentColor.r, state.targetColor.r, state.colorTransitionProgress)),
              g: Math.round(lerp(state.currentColor.g, state.targetColor.g, state.colorTransitionProgress)),
              b: Math.round(lerp(state.currentColor.b, state.targetColor.b, state.colorTransitionProgress)),
            };
          } else if (state.colorTransitionProgress >= 1) {
            state.currentColor = { ...state.targetColor };
          }

          state.targetColor = getRandomColor();
          state.colorTransitionProgress = 0;
          state.lastColorChange = currentTime;
        }

        const timeSinceLastChange = currentTime - state.lastColorChange;
        const transitionDuration = 1500;
        const progress = Math.min(timeSinceLastChange / transitionDuration, 1);
        state.colorTransitionProgress = progress;

        if (progress >= 1) {
          state.currentColor = { ...state.targetColor };
          state.colorTransitionProgress = 0;
        }
      }

      // Mouse lerping
      const dx = state.targetMousePos.x - state.lerpedMousePos.x;
      const dy = state.targetMousePos.y - state.lerpedMousePos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let baseLerpSpeed = 0.02;
      if (distance > 200) baseLerpSpeed = 0.05;
      else if (distance > 100) baseLerpSpeed = 0.08;
      else if (distance > 50) baseLerpSpeed = 0.06;
      else if (distance > 20) baseLerpSpeed = 0.04;

      const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(t, 1), 3);
      const distanceRatio = Math.min(distance / 300, 1);
      const easedSpeed = baseLerpSpeed * easeOutCubic(distanceRatio);

      state.lerpedMousePos = {
        x: lerp(state.lerpedMousePos.x, state.targetMousePos.x, easedSpeed),
        y: lerp(state.lerpedMousePos.y, state.targetMousePos.y, easedSpeed),
      };

      drawDots();
      animationRef.current = requestAnimationFrame(animate);
    };

    resizeCanvas();

    // Use window for mouse tracking when used as a background layer (no mouseTargetRef)
    // This allows mouse events to be captured even with pointerEvents: "none"
    const mouseTarget = mouseTargetRef?.current;
    if (mouseTarget) {
      mouseTarget.addEventListener("mousemove", handleMouseMove, { passive: true });
      mouseTarget.addEventListener("mouseleave", handleMouseLeave, { passive: true });
    } else {
      window.addEventListener("mousemove", handleWindowMouseMove, { passive: true });
    }
    window.addEventListener("resize", resizeCanvas);

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (mouseTarget) {
        mouseTarget.removeEventListener("mousemove", handleMouseMove);
        mouseTarget.removeEventListener("mouseleave", handleMouseLeave);
      } else {
        window.removeEventListener("mousemove", handleWindowMouseMove);
      }
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [mouseTargetRef]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${className}`}
      style={{
        zIndex: 0,
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        margin: 0,
        padding: 0,
        pointerEvents: "none",
        backgroundColor: "transparent",
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
    </div>
  );
}

export default InteractiveBGPattern;
