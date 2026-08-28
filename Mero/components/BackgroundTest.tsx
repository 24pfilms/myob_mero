import React, { useState } from 'react';
import { InteractiveBGPattern } from './ui/InteractiveBGPattern';

interface BackgroundTestProps {
  onClose?: () => void;
}

export const BackgroundTest: React.FC<BackgroundTestProps> = ({ onClose }) => {
  const [settings, setSettings] = useState({
    dotSize: 2,
    spacing: 35,
    baseOpacity: 0.2,
    glowOpacity: 1.0,
    glowRadius: 200,
    colorChangeEnabled: true,
    colorChangeInterval: 3000,
    shape: 'rectangle' as 'circle' | 'rectangle',
    rectangleWidth: 3,
    rectangleHeight: 3,
  });

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black"
      style={{ isolation: 'isolate' }}
    >
      {/* Interactive Background - no mouseTargetRef = uses window-level tracking */}
      <InteractiveBGPattern
        dotSize={settings.dotSize}
        spacing={settings.spacing}
        baseOpacity={settings.baseOpacity}
        glowOpacity={settings.glowOpacity}
        glowRadius={settings.glowRadius}
        colorChangeEnabled={settings.colorChangeEnabled}
        colorChangeInterval={settings.colorChangeInterval}
        shape={settings.shape}
        rectangleWidth={settings.rectangleWidth}
        rectangleHeight={settings.rectangleHeight}
        className="z-0"
      />

      {/* Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-50 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm border border-white/20 transition-all"
        >
          Close Test
        </button>
      )}

      {/* Settings Panel */}
      <div className="fixed top-4 left-4 z-50 p-4 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 text-white max-w-xs">
        <h2 className="text-lg font-semibold mb-4 text-green-400">Background Settings</h2>
        
        {/* Shape Toggle */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Shape</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSettings(s => ({ ...s, shape: 'circle' }))}
              className={`px-3 py-1 rounded text-sm ${settings.shape === 'circle' ? 'bg-green-500 text-black' : 'bg-white/10'}`}
            >
              Circle
            </button>
            <button
              onClick={() => setSettings(s => ({ ...s, shape: 'rectangle' }))}
              className={`px-3 py-1 rounded text-sm ${settings.shape === 'rectangle' ? 'bg-green-500 text-black' : 'bg-white/10'}`}
            >
              Rectangle
            </button>
          </div>
        </div>

        {/* Dot Size */}
        <div className="mb-3">
          <label className="block text-sm text-gray-400 mb-1">Dot Size: {settings.dotSize}</label>
          <input
            type="range"
            min="1"
            max="8"
            step="0.5"
            value={settings.dotSize}
            onChange={(e) => setSettings(s => ({ ...s, dotSize: parseFloat(e.target.value) }))}
            className="w-full accent-green-500"
          />
        </div>

        {/* Spacing */}
        <div className="mb-3">
          <label className="block text-sm text-gray-400 mb-1">Spacing: {settings.spacing}px</label>
          <input
            type="range"
            min="15"
            max="60"
            value={settings.spacing}
            onChange={(e) => setSettings(s => ({ ...s, spacing: parseInt(e.target.value) }))}
            className="w-full accent-green-500"
          />
        </div>

        {/* Glow Radius */}
        <div className="mb-3">
          <label className="block text-sm text-gray-400 mb-1">Glow Radius: {settings.glowRadius}px</label>
          <input
            type="range"
            min="50"
            max="500"
            value={settings.glowRadius}
            onChange={(e) => setSettings(s => ({ ...s, glowRadius: parseInt(e.target.value) }))}
            className="w-full accent-green-500"
          />
        </div>

        {/* Base Opacity */}
        <div className="mb-3">
          <label className="block text-sm text-gray-400 mb-1">Base Opacity: {settings.baseOpacity.toFixed(2)}</label>
          <input
            type="range"
            min="0.05"
            max="0.5"
            step="0.05"
            value={settings.baseOpacity}
            onChange={(e) => setSettings(s => ({ ...s, baseOpacity: parseFloat(e.target.value) }))}
            className="w-full accent-green-500"
          />
        </div>

        {/* Glow Opacity */}
        <div className="mb-3">
          <label className="block text-sm text-gray-400 mb-1">Glow Opacity: {settings.glowOpacity.toFixed(2)}</label>
          <input
            type="range"
            min="0.3"
            max="1.0"
            step="0.1"
            value={settings.glowOpacity}
            onChange={(e) => setSettings(s => ({ ...s, glowOpacity: parseFloat(e.target.value) }))}
            className="w-full accent-green-500"
          />
        </div>

        {/* Color Change Toggle */}
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm text-gray-400">Color Animation</label>
          <button
            onClick={() => setSettings(s => ({ ...s, colorChangeEnabled: !s.colorChangeEnabled }))}
            className={`px-3 py-1 rounded text-sm ${settings.colorChangeEnabled ? 'bg-green-500 text-black' : 'bg-white/10'}`}
          >
            {settings.colorChangeEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Color Change Interval */}
        {settings.colorChangeEnabled && (
          <div className="mb-3">
            <label className="block text-sm text-gray-400 mb-1">Color Interval: {settings.colorChangeInterval}ms</label>
            <input
              type="range"
              min="1000"
              max="8000"
              step="500"
              value={settings.colorChangeInterval}
              onChange={(e) => setSettings(s => ({ ...s, colorChangeInterval: parseInt(e.target.value) }))}
              className="w-full accent-green-500"
            />
          </div>
        )}

        {/* Reset Button */}
        <button
          onClick={() => setSettings({
            dotSize: 2,
            spacing: 35,
            baseOpacity: 0.2,
            glowOpacity: 1.0,
            glowRadius: 200,
            colorChangeEnabled: true,
            colorChangeInterval: 3000,
            shape: 'rectangle',
            rectangleWidth: 3,
            rectangleHeight: 3,
          })}
          className="w-full mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-all"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Center Content Demo */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Interactive Background Test</h1>
          <p className="text-gray-400 text-lg">Move your mouse to see the glow effect</p>
          <p className="text-gray-500 text-sm mt-2">Colors will transition automatically</p>
        </div>
      </div>
    </div>
  );
};

export default BackgroundTest;
