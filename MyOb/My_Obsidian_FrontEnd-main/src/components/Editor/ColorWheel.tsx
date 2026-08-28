import { useState, useRef, useEffect } from 'react';

interface ColorWheelProps {
  value: string; // hex color
  onChange: (color: string) => void;
  size?: number;
}

export const ColorWheel = ({ value, onChange, size = 200 }: ColorWheelProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);

  // Convert hex to HSL
  const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 100, l: 50 };

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  };

  // Convert HSL to hex
  const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

    const toHex = (n: number) => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Initialize from current color
  useEffect(() => {
    const hsl = hexToHSL(value);
    setHue(hsl.h);
    setSaturation(hsl.s);
  }, []);

  // Draw the color wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw color wheel
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 90) * Math.PI / 180;
      const endAngle = (angle - 89) * Math.PI / 180;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.3, `hsl(${angle}, 100%, 70%)`);
      gradient.addColorStop(1, `hsl(${angle}, 100%, 40%)`);

      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }, [size]);

  const handleInteraction = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - size / 2;
    const y = clientY - rect.top - size / 2;

    // Calculate angle and distance from center
    let angle = Math.atan2(y, x) * 180 / Math.PI + 90;
    if (angle < 0) angle += 360;

    const distance = Math.sqrt(x * x + y * y);
    const maxDistance = size / 2 - 10;
    const newSaturation = Math.min(100, (distance / maxDistance) * 100);

    setHue(angle);
    setSaturation(newSaturation);
    
    const newColor = hslToHex(angle, newSaturation, 50);
    onChange(newColor);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleInteraction(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleInteraction(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Calculate selector position
  const angle = (hue - 90) * Math.PI / 180;
  const distance = (saturation / 100) * (size / 2 - 10);
  const selectorX = size / 2 + Math.cos(angle) * distance;
  const selectorY = size / 2 + Math.sin(angle) * distance;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="cursor-crosshair rounded-full shadow-lg"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        {/* Selector dot */}
        <div
          className="absolute w-5 h-5 rounded-full border-3 border-white shadow-lg pointer-events-none"
          style={{
            left: selectorX - 10,
            top: selectorY - 10,
            backgroundColor: hslToHex(hue, saturation, 50),
            boxShadow: '0 0 0 2px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.3)'
          }}
        />
      </div>
      
      {/* Color preview and hex display */}
      <div className="flex items-center gap-3 w-full">
        <div
          className="w-12 h-12 rounded-lg border-2 border-border shadow-md"
          style={{ backgroundColor: value }}
        />
        <div className="flex-1 text-center">
          <span className="text-sm font-mono font-medium">{value.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};
