# Beautiful Glassmorphism Modal Designs

10 modern glassmorphism modal designs for the Mero project. All use Tailwind CSS.

---

## 1. Frosted Crystal Modal

Subtle frosted glass with soft purple/blue gradient border glow.

```tsx
<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
  {/* Backdrop */}
  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
  
  {/* Modal */}
  <div className="relative w-full max-w-lg">
    {/* Glow effect */}
    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 rounded-3xl blur-lg opacity-30 animate-pulse" />
    
    {/* Glass card */}
    <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10">
        <h2 className="text-xl font-semibold text-white">Modal Title</h2>
      </div>
      
      {/* Content */}
      <div className="px-6 py-6">
        <p className="text-gray-300">Your content here...</p>
      </div>
      
      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
        <button className="px-4 py-2 text-gray-300 hover:text-white transition-colors">
          Cancel
        </button>
        <button className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition-all">
          Confirm
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## 2. Aurora Glass Modal

Northern lights inspired with animated gradient background.

```tsx
<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
  {/* Animated aurora backdrop */}
  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-400/20 via-transparent to-transparent animate-pulse" />
  </div>
  <div className="absolute inset-0 backdrop-blur-[2px]" onClick={onClose} />
  
  {/* Modal */}
  <div className="relative w-full max-w-lg bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
    {/* Shine effect */}
    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
    
    {/* Header */}
    <div className="relative px-6 py-5 border-b border-white/10">
      <h2 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
        Aurora Modal
      </h2>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all">
        <XIcon />
      </button>
    </div>
    
    {/* Content */}
    <div className="relative px-6 py-6">
      <p className="text-gray-300/90 leading-relaxed">Content goes here...</p>
    </div>
    
    {/* Footer */}
    <div className="relative px-6 py-4 bg-black/20 flex justify-end gap-3">
      <button className="px-5 py-2.5 text-gray-300 hover:text-white rounded-xl transition-colors">
        Cancel
      </button>
      <button className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/25 transition-all">
        Continue
      </button>
    </div>
  </div>
</div>
```

---

## 3. Neon Edge Modal

Cyberpunk-style with neon border animation.

```tsx
<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
  {/* Modal with animated neon border */}
  <div className="relative w-full max-w-lg group">
    {/* Animated neon border */}
    <div className="absolute -inset-[2px] bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl opacity-75 blur-sm group-hover:opacity-100 transition-opacity duration-500" 
         style={{ backgroundSize: '200% 200%', animation: 'gradient-shift 3s ease infinite' }} />
    
    {/* Inner glow */}
    <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl opacity-50" />
    
    {/* Glass content */}
    <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400">
          Neon Modal
        </h2>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
          <XIcon />
        </button>
      </div>
      
      {/* Content */}
      <div className="px-6 py-6">
        <p className="text-gray-300">Your futuristic content here...</p>
      </div>
      
      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
        <button className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
          Cancel
        </button>
        <button className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-medium rounded-lg transition-all">
          Execute
        </button>
      </div>
    </div>
  </div>
</div>

{/* Add to your CSS/globals */}
<style>{`
  @keyframes gradient-shift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
`}</style>
```

---

## 4. Soft Neumorphic Glass

Combines neumorphism with glassmorphism for a soft, tactile feel.

```tsx
<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
  {/* Soft gradient backdrop */}
  <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800" onClick={onClose} />
  
  {/* Modal */}
  <div className="relative w-full max-w-lg bg-slate-800/50 backdrop-blur-xl rounded-3xl shadow-[20px_20px_60px_#1e1e2e,-20px_-20px_60px_#2a2a3e] border border-white/5 overflow-hidden">
    {/* Inner highlight */}
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
    
    {/* Header */}
    <div className="relative px-6 py-5">
      <h2 className="text-xl font-semibold text-gray-100">Soft Glass</h2>
      <p className="text-sm text-gray-400 mt-1">Neumorphic glassmorphism blend</p>
    </div>
    
    {/* Content */}
    <div className="relative px-6 py-4">
      <div className="bg-slate-900/50 rounded-2xl p-4 shadow-inner">
        <p className="text-gray-300">Content in a recessed container...</p>
      </div>
    </div>
    
    {/* Footer */}
    <div className="relative px-6 py-5 flex justify-end gap-3">
      <button className="px-5 py-2.5 bg-slate-700/50 hover:bg-slate-700/70 text-gray-300 rounded-xl shadow-[5px_5px_15px_#1a1a2e,-5px_-5px_15px_#2e2e42] transition-all active:shadow-inner">
        Cancel
      </button>
      <button className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all">
        Save
      </button>
    </div>
  </div>
</div>
```

---

## 5. Minimal Frost Modal

Ultra-clean minimal design with maximum clarity.

```tsx
<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
  {/* Clean backdrop */}
  <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />
  
  {/* Modal */}
  <div className="relative w-full max-w-md bg-white/10 backdrop-blur-2xl border border-white/30 rounded-2xl shadow-2xl overflow-hidden">
    {/* Close button */}
    <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all z-10">
      <XIcon />
    </button>
    
    {/* Content */}
    <div className="px-8 py-10 text-center">
      <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
        <CheckIcon className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Success!</h2>
      <p className="text-gray-300/80 mb-8">Your action has been completed successfully.</p>
      <button className="w-full py-3 bg-white/20 hover:bg-white/30 text-white font-medium rounded-xl backdrop-blur-sm transition-all">
        Continue
      </button>
    </div>
  </div>
</div>
```

---

## 6. Floating Card Modal

3D floating effect with layered glass panels.

```tsx
<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 perspective-1000">
  {/* Backdrop */}
  <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/90 via-purple-900/90 to-pink-900/90 backdrop-blur-sm" onClick={onClose} />
  
  {/* Floating layers */}
  <div className="relative w-full max-w-lg transform-gpu" style={{ transformStyle: 'preserve-3d' }}>
    {/* Back shadow layer */}
    <div className="absolute inset-4 bg-black/30 rounded-3xl blur-xl transform translate-z-[-40px]" />
    
    {/* Middle glow layer */}
    <div className="absolute inset-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl blur-lg transform translate-z-[-20px]" />
    
    {/* Main card */}
    <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden transform hover:scale-[1.02] transition-transform duration-300">
      {/* Glass shine */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/5 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="relative px-6 py-5 border-b border-white/10">
        <h2 className="text-xl font-bold text-white">Floating Glass</h2>
      </div>
      
      {/* Content */}
      <div className="relative px-6 py-6">
        <p className="text-gray-300">Elevated glass panel design...</p>
      </div>
      
      {/* Footer */}
      <div className="relative px-6 py-4 bg-white/5 flex justify-end gap-3">
        <button className="px-4 py-2 text-gray-300 hover:text-white transition-colors">
          Dismiss
        </button>
        <button className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-sm border border-white/20 transition-all">
          Accept
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## 7. Dark Obsidian Modal

Deep dark glass with subtle reflections.

```tsx
<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
  {/* Dark backdrop */}
  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
  
  {/* Modal */}
  <div className="relative w-full max-w-lg">
    {/* Subtle outer glow */}
    <div className="absolute -inset-px bg-gradient-to-b from-gray-700/50 to-transparent rounded-2xl" />
    
    {/* Main card */}
    <div className="relative bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden">
      {/* Top reflection */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gray-500/50 to-transparent" />
      
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Dark Mode</h2>
          <p className="text-xs text-gray-500">Obsidian glass design</p>
        </div>
        <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-all">
          <XIcon />
        </button>
      </div>
      
      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-700/70 to-transparent" />
      
      {/* Content */}
      <div className="px-6 py-6">
        <p className="text-gray-400">Deep, sophisticated dark glass...</p>
      </div>
      
      {/* Footer */}
      <div className="px-6 py-4 bg-black/30 flex justify-end gap-3">
        <button className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors">
          Cancel
        </button>
        <button className="px-6 py-2 bg-gray-100 hover:bg-white text-gray-900 font-medium rounded-lg transition-all">
          Confirm
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## 8. Iridescent Glass Modal

Holographic rainbow reflections on glass.

```tsx
<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
  {/* Backdrop */}
  <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onClick={onClose} />
  
  {/* Modal */}
  <div className="relative w-full max-w-lg">
    {/* Iridescent border */}
    <div className="absolute -inset-[1px] bg-gradient-to-r from-rose-500 via-violet-500 via-cyan-500 via-emerald-500 to-rose-500 rounded-2xl opacity-70" 
         style={{ backgroundSize: '300% 100%', animation: 'shimmer 4s linear infinite' }} />
    
    {/* Glass card */}
    <div className="relative bg-slate-900/80 backdrop-blur-2xl rounded-2xl overflow-hidden">
      {/* Iridescent shine overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 via-violet-500/10 via-cyan-500/10 to-emerald-500/10 opacity-50 pointer-events-none"
           style={{ backgroundSize: '200% 200%', animation: 'shimmer 6s ease infinite' }} />
      
      {/* Header */}
      <div className="relative px-6 py-5 border-b border-white/10">
        <h2 className="text-xl font-bold text-white">Iridescent Glass</h2>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all">
          <XIcon />
        </button>
      </div>
      
      {/* Content */}
      <div className="relative px-6 py-6">
        <p className="text-gray-300">Holographic rainbow reflections...</p>
      </div>
      
      {/* Footer */}
      <div className="relative px-6 py-4 border-t border-white/10 flex justify-end gap-3">
        <button className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
          Cancel
        </button>
        <button className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium rounded-lg shadow-lg shadow-violet-500/25 transition-all">
          Continue
        </button>
      </div>
    </div>
  </div>
</div>

<style>{`
  @keyframes shimmer {
    0% { background-position: 0% 50%; }
    100% { background-position: 100% 50%; }
  }
`}</style>
```

---

## 9. Warm Amber Glass Modal

Warm, inviting glass with golden tones.

```tsx
<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
  {/* Warm backdrop */}
  <div className="absolute inset-0 bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-red-900/40 backdrop-blur-sm" onClick={onClose} />
  
  {/* Modal */}
  <div className="relative w-full max-w-lg">
    {/* Warm glow */}
    <div className="absolute -inset-4 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent rounded-3xl blur-2xl" />
    
    {/* Glass card */}
    <div className="relative bg-gradient-to-br from-amber-900/30 to-orange-900/20 backdrop-blur-2xl border border-amber-500/20 rounded-2xl shadow-2xl overflow-hidden">
      {/* Warm shine */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 via-transparent to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="relative px-6 py-5 border-b border-amber-500/20">
        <h2 className="text-xl font-bold text-amber-100">Warm Welcome</h2>
        <p className="text-sm text-amber-200/60 mt-1">Golden glass aesthetic</p>
      </div>
      
      {/* Content */}
      <div className="relative px-6 py-6">
        <p className="text-amber-100/80">Inviting and comfortable design...</p>
      </div>
      
      {/* Footer */}
      <div className="relative px-6 py-4 bg-black/20 flex justify-end gap-3">
        <button className="px-4 py-2 text-amber-200/70 hover:text-amber-100 transition-colors">
          Maybe Later
        </button>
        <button className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-medium rounded-lg shadow-lg shadow-amber-500/30 transition-all">
          Get Started
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## 10. Electric Blue Modal

Vibrant electric blue with energy effects.

```tsx
<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
  {/* Electric backdrop */}
  <div className="absolute inset-0 bg-slate-950/95" onClick={onClose}>
    {/* Electric particles effect */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent" />
  </div>
  
  {/* Modal */}
  <div className="relative w-full max-w-lg">
    {/* Electric glow */}
    <div className="absolute -inset-2 bg-blue-500/30 rounded-3xl blur-xl animate-pulse" />
    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-2xl opacity-60" />
    
    {/* Glass card */}
    <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl overflow-hidden">
      {/* Electric top bar */}
      <div className="h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600" 
           style={{ backgroundSize: '200% 100%', animation: 'electric 2s linear infinite' }} />
      
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/40">
            <BoltIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Electric Mode</h2>
            <p className="text-xs text-blue-400">High energy interface</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-blue-500/20 rounded-lg transition-all">
          <XIcon />
        </button>
      </div>
      
      {/* Content */}
      <div className="px-6 py-6 border-t border-blue-500/20">
        <p className="text-gray-300">Energizing electric design...</p>
      </div>
      
      {/* Footer */}
      <div className="px-6 py-4 bg-blue-950/50 flex justify-end gap-3">
        <button className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
          Cancel
        </button>
        <button className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/40 transition-all">
          Activate
        </button>
      </div>
    </div>
  </div>
</div>

<style>{`
  @keyframes electric {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
`}</style>
```

---

## CSS Animations (Add to index.css)

```css
/* Gradient animations for modals */
@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes shimmer {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}

@keyframes electric {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* Utility for 3D transforms */
.perspective-1000 {
  perspective: 1000px;
}

.transform-gpu {
  transform: translateZ(0);
}
```

---

## Recommendation

For Mero's dark canvas-based UI, I recommend **#7 Dark Obsidian** or **#3 Neon Edge** as the primary modal style. These complement the existing dark theme while adding visual sophistication.

The **#2 Aurora Glass** would be excellent for the AI Assistant modal to give it a special, premium feel.
