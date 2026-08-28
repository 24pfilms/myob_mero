import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";

export type FileSortOption = 'name-asc' | 'name-desc' | 'created-new' | 'created-old' | 'modified-new' | 'modified-old';

export interface AppSettings {
  appName: string;
  defaultViewMode: 'edit' | 'preview' | 'split';
  autoSave: boolean;
  autoSaveDelay: number;
  showWordCount: boolean;
  editorFontSize: number;
  previewFontSize: number;
  sidebarFontSize: number;
  splitLayoutReversed: boolean;
  editorFontFamily: string;
  previewFontFamily: string;
  accentColorHue: number; // 0-360
  accentColorSaturation: number; // 0-100
  accentColorLightness: number; // 0-100
  textLuminance: number; // 0-100 - controls brightness of all text (foreground)
  backgroundColorHue: number; // 0-360 - controls hue of background color
  backgroundColorSaturation: number; // 0-100 - controls saturation of background
  backgroundColorLightness: number; // 0-100 - controls lightness of background
  previewBackgroundBrightness: number; // 0-100 - 0=black, 50=medium gray, 100=white
  previewBackgroundTexture: string; // None, Paper, Linen, Grid, Dots
  previewTextColor: string; // 'white' or 'black'
  textureIntensity: number; // 0-100 - controls opacity of texture
  textureScale: number; // 0.5-10.0 - controls size of texture pattern
  textureColor: string; // Hex color for grid/dots textures
  gridLineThickness: number; // 1-5 - thickness of grid lines in pixels
  gridStyle: string; // square, wide, tall, dense
  fileSortOption: FileSortOption; // How files are sorted in the sidebar
}

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'MyOb',
  defaultViewMode: 'preview',
  autoSave: true,
  autoSaveDelay: 2000,
  showWordCount: true,
  editorFontSize: 14,
  previewFontSize: 16,
  sidebarFontSize: 14,
  splitLayoutReversed: false,
  editorFontFamily: 'JetBrains Mono',
  previewFontFamily: 'Inter',
  accentColorHue: 263,
  accentColorSaturation: 70,
  accentColorLightness: 60,
  textLuminance: 96, // Default to light text (96% brightness for light theme)
  backgroundColorHue: 240, // Default to blue-ish gray
  backgroundColorSaturation: 10, // Low saturation for subtle color
  backgroundColorLightness: 8, // Dark background (8% brightness for dark theme)
  previewBackgroundBrightness: 100,
  previewBackgroundTexture: 'none',
  previewTextColor: 'black',
  textureIntensity: 50,
  textureScale: 1.0,
  textureColor: '#000000',
  gridLineThickness: 1,
  gridStyle: 'square',
  fileSortOption: 'name-asc', // Always start with alphabetical sorting
};

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export const SettingsModal = ({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: SettingsModalProps) => {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [originalSettings, setOriginalSettings] = useState<AppSettings>(settings);

  // Sync local settings when modal opens or settings prop changes
  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
      setOriginalSettings(settings); // Store original settings for cancel
    }
  }, [open, settings]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    localStorage.setItem('myob-settings', JSON.stringify(localSettings));
    
    // Build HSL color string
    const hslColor = `${localSettings.accentColorHue} ${localSettings.accentColorSaturation}% ${localSettings.accentColorLightness}%`;
    
    // Apply accent color to CSS variables with animation
    const root = document.documentElement;
    root.style.transition = 'all 0.3s ease-in-out';
    root.style.setProperty('--primary', hslColor);
    root.style.setProperty('--primary-glow', hslColor);
    root.style.setProperty('--accent', hslColor);
    root.style.setProperty('--ring', hslColor);
    root.style.setProperty('--sidebar-primary', hslColor);
    root.style.setProperty('--sidebar-ring', hslColor);
    
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully.",
    });
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
    toast({
      title: "Settings Reset",
      description: "All settings have been reset to defaults.",
    });
  };

  const updateSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    
    // Apply accent color changes live and save immediately
    if (key === 'accentColorHue' || key === 'accentColorSaturation' || key === 'accentColorLightness') {
      const hslColor = `${key === 'accentColorHue' ? value : newSettings.accentColorHue} ${key === 'accentColorSaturation' ? value : newSettings.accentColorSaturation}% ${key === 'accentColorLightness' ? value : newSettings.accentColorLightness}%`;
      const root = document.documentElement;
      root.style.setProperty('--primary', hslColor);
      root.style.setProperty('--primary-glow', hslColor);
      root.style.setProperty('--accent', hslColor);
      root.style.setProperty('--ring', hslColor);
      root.style.setProperty('--sidebar-primary', hslColor);
      root.style.setProperty('--sidebar-ring', hslColor);
      
      // Save accent color changes immediately to localStorage
      localStorage.setItem('myob-settings', JSON.stringify(newSettings));
      onSettingsChange(newSettings);
    }
    
    // Apply text luminance changes live and save immediately
    if (key === 'textLuminance') {
      const root = document.documentElement;
      // Set foreground color based on luminance (neutral gray with adjustable brightness)
      const textColor = `240 5% ${value}%`;
      root.style.setProperty('--foreground', textColor);
      root.style.setProperty('--card-foreground', textColor);
      root.style.setProperty('--popover-foreground', textColor);
      root.style.setProperty('--sidebar-foreground', textColor);
      
      // Save text luminance changes immediately to localStorage
      localStorage.setItem('myob-settings', JSON.stringify(newSettings));
      onSettingsChange(newSettings);
    }
    
    // Apply background color changes live and save immediately (for preview window)
    if (key === 'backgroundColorHue' || key === 'backgroundColorSaturation' || key === 'backgroundColorLightness') {
      // Save background color changes immediately to localStorage
      localStorage.setItem('myob-settings', JSON.stringify(newSettings));
      onSettingsChange(newSettings);
    }
    
    // Apply changes live for preview-related settings
    if (key === 'previewBackgroundBrightness' || key === 'previewBackgroundTexture' || key === 'previewTextColor' || key === 'textureIntensity' || key === 'textureScale' || key === 'textureColor' || key === 'gridLineThickness' || key === 'gridStyle' || key === 'previewFontFamily' || key === 'previewFontSize') {
      onSettingsChange(newSettings);
    }
    
    // Apply changes live for editor font settings
    if (key === 'editorFontSize' || key === 'editorFontFamily') {
      onSettingsChange(newSettings);
    }
  };

  const handleCancel = () => {
    // Restore original settings when canceling
    onSettingsChange(originalSettings);
    setLocalSettings(originalSettings);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <DialogTitle>Application Settings</DialogTitle>
            <DialogDescription>
              Customize your MyOb experience with these preferences
            </DialogDescription>
          </div>
          <Button onClick={handleSave} className="ml-4">Save Changes</Button>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            {/* App Name */}
            <div className="space-y-2">
              <Label htmlFor="appName">Application Name</Label>
              <Input
                id="appName"
                value={localSettings.appName}
                onChange={(e) => updateSetting('appName', e.target.value)}
                placeholder="Enter app name"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Customize the name displayed in the toolbar (max 20 characters)
              </p>
            </div>
          </TabsContent>

          <TabsContent value="editor" className="space-y-4 mt-4">
            {/* Default View Mode */}
            <div className="space-y-2">
              <Label htmlFor="defaultViewMode">Default View Mode</Label>
              <Select
                value={localSettings.defaultViewMode}
                onValueChange={(value) =>
                  updateSetting('defaultViewMode', value as 'edit' | 'preview' | 'split')
                }
              >
                <SelectTrigger id="defaultViewMode">
                  <SelectValue placeholder="Select default view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edit">Edit Mode</SelectItem>
                  <SelectItem value="preview">Preview Mode</SelectItem>
                  <SelectItem value="split">Split Mode</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose which view mode to use when opening notes
              </p>
            </div>

            <Separator />

            {/* Auto Save */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoSave">Auto Save</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically save changes after a delay
                </p>
              </div>
              <Switch
                id="autoSave"
                checked={localSettings.autoSave}
                onCheckedChange={(checked) => updateSetting('autoSave', checked)}
              />
            </div>

            {localSettings.autoSave && (
              <div className="space-y-2 ml-6">
                <Label htmlFor="autoSaveDelay">Auto Save Delay (seconds)</Label>
                <Select
                  value={localSettings.autoSaveDelay.toString()}
                  onValueChange={(value) =>
                    updateSetting('autoSaveDelay', parseInt(value))
                  }
                >
                  <SelectTrigger id="autoSaveDelay">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1000">1 second</SelectItem>
                    <SelectItem value="2000">2 seconds</SelectItem>
                    <SelectItem value="3000">3 seconds</SelectItem>
                    <SelectItem value="5000">5 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            {/* Show Word Count */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="showWordCount">Show Word Count</Label>
                <p className="text-xs text-muted-foreground">
                  Display word and character count in the status bar
                </p>
              </div>
              <Switch
                id="showWordCount"
                checked={localSettings.showWordCount}
                onCheckedChange={(checked) => updateSetting('showWordCount', checked)}
              />
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4 mt-4">
            {/* Theme Selection */}
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={theme}
                onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
              >
                <SelectTrigger id="theme">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light Mode</SelectItem>
                  <SelectItem value="dark">Dark Mode</SelectItem>
                  <SelectItem value="system">System Default</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose between light, dark, or follow system preferences
              </p>
            </div>

            <Separator />

            {/* Accent Color Picker */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose a color for buttons, links, and highlights
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded border-2 border-border shadow-sm"
                    style={{ 
                      backgroundColor: `hsl(${localSettings.accentColorHue} ${localSettings.accentColorSaturation}% ${localSettings.accentColorLightness}%)`,
                    }}
                  />
                </div>
              </div>
              
              <div className="w-full">
                <input type="range" min="0" max="360" value={localSettings.accentColorHue} onChange={(event) => updateSetting('accentColorHue', Number(event.target.value))} className="w-full accent-primary" aria-label="Accent color hue" />
              </div>
              
              {/* Brightness Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="accentBrightness" className="text-sm">Brightness</Label>
                  <span className="text-xs text-muted-foreground font-mono">{localSettings.accentColorLightness}%</span>
                </div>
                <input
                  id="accentBrightness"
                  type="range"
                  min="10"
                  max="80"
                  step="6"
                  value={localSettings.accentColorLightness}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateSetting('accentColorLightness', parseInt(e.target.value));
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Darker</span>
                  <span>Brighter</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Text Luminance */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="textLuminance">Text Brightness</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Adjust the brightness of all text throughout the site
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="textLuminance" className="text-sm">Luminance</Label>
                  <span className="text-xs text-muted-foreground font-mono">{localSettings.textLuminance}%</span>
                </div>
                <input
                  id="textLuminance"
                  type="range"
                  min="10"
                  max="96"
                  step="6"
                  value={localSettings.textLuminance}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateSetting('textLuminance', parseInt(e.target.value));
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Darker</span>
                  <span>Lighter</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Background Color */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="backgroundColor">Background Color</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Adjust the color of the background throughout the site
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded border-2 border-border shadow-sm"
                    style={{ 
                      backgroundColor: `hsl(${localSettings.backgroundColorHue} ${localSettings.backgroundColorSaturation}% ${localSettings.backgroundColorLightness}%)`,
                    }}
                  />
                </div>
              </div>
              
              <div className="w-full">
                <Label htmlFor="bgColorHue" className="text-sm mb-2 block">Hue</Label>
                <input type="range" min="0" max="360" value={localSettings.backgroundColorHue} onChange={(event) => updateSetting('backgroundColorHue', Number(event.target.value))} className="w-full accent-primary" aria-label="Background color hue" />
              </div>
              
              {/* Background Lightness Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bgColorLightness" className="text-sm">Brightness</Label>
                  <span className="text-xs text-muted-foreground font-mono">{localSettings.backgroundColorLightness}%</span>
                </div>
                <input
                  id="bgColorLightness"
                  type="range"
                  min="3"
                  max="20"
                  step="1"
                  value={localSettings.backgroundColorLightness}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateSetting('backgroundColorLightness', parseInt(e.target.value));
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Darker</span>
                  <span>Lighter</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Preview Background */}
            <div className="space-y-4">
              <div>
                <Label>Preview Background</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Customize the preview pane background for better reading
                </p>
              </div>
              
              {/* Background Brightness */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="previewBgBrightness" className="text-sm">Background Brightness</Label>
                  <span className="text-xs text-muted-foreground font-mono">{localSettings.previewBackgroundBrightness}%</span>
                </div>
                <input
                  id="previewBgBrightness"
                  type="range"
                  min="0"
                  max="100"
                  value={localSettings.previewBackgroundBrightness}
                  onChange={(e) => updateSetting('previewBackgroundBrightness', parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #000000, #808080, #ffffff)`
                  }}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Black</span>
                  <span>Gray</span>
                  <span>White</span>
                </div>
              </div>
              
              {/* Text Color Toggle */}
              <div className="space-y-2">
                <Label htmlFor="previewTextColor" className="text-sm">Text Color</Label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className={`flex-1 p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                      localSettings.previewTextColor === 'black'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => updateSetting('previewTextColor', 'black')}
                  >
                    <div className="w-6 h-6 rounded-full bg-black border border-border" />
                    <span className="text-sm font-medium">Black</span>
                  </button>
                  <button
                    type="button"
                    className={`flex-1 p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                      localSettings.previewTextColor === 'white'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => updateSetting('previewTextColor', 'white')}
                  >
                    <div className="w-6 h-6 rounded-full bg-white border border-border" />
                    <span className="text-sm font-medium">White</span>
                  </button>
                </div>
              </div>
              
              {/* Background Texture */}
              <div className="space-y-2">
                <Label htmlFor="previewBgTexture" className="text-sm">Background Texture</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: 'None', value: 'none' },
                    { name: 'Paper', value: 'paper' },
                    { name: 'Linen', value: 'linen' },
                    { name: 'Grid', value: 'grid' },
                    { name: 'Dots', value: 'dots' },
                    { name: 'Noise', value: 'noise' },
                  ].map((texture) => (
                    <button
                      key={texture.value}
                      type="button"
                      className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                        localSettings.previewBackgroundTexture === texture.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => updateSetting('previewBackgroundTexture', texture.value)}
                    >
                      {texture.name}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Texture Intensity Slider */}
              {localSettings.previewBackgroundTexture !== 'none' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="textureIntensity" className="text-sm">Texture Intensity</Label>
                    <span className="text-xs text-muted-foreground font-mono">{localSettings.textureIntensity}%</span>
                  </div>
                  <input
                    id="textureIntensity"
                    type="range"
                    min="0"
                    max="100"
                    value={localSettings.textureIntensity}
                    onChange={(e) => updateSetting('textureIntensity', parseInt(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtle</span>
                    <span>Strong</span>
                  </div>
                </div>
              )}
              
              {/* Texture Scale Slider */}
              {localSettings.previewBackgroundTexture !== 'none' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="textureScale" className="text-sm">Texture Scale</Label>
                    <span className="text-xs text-muted-foreground font-mono">{localSettings.textureScale.toFixed(1)}x</span>
                  </div>
                  <input
                    id="textureScale"
                    type="range"
                    min="0.5"
                    max="10.0"
                    step="0.1"
                    value={localSettings.textureScale}
                    onChange={(e) => updateSetting('textureScale', parseFloat(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Smaller</span>
                    <span>Larger</span>
                  </div>
                </div>
              )}
              
              {/* Texture Color Picker (for grid/dots) */}
              {(localSettings.previewBackgroundTexture === 'grid' || localSettings.previewBackgroundTexture === 'dots') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="textureColor" className="text-sm">Texture Color</Label>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded border-2 border-border shadow-sm"
                        style={{ backgroundColor: localSettings.textureColor }}
                      />
                      <span className="text-xs font-mono font-medium">{localSettings.textureColor.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="w-full">
                    <input type="color" value={localSettings.textureColor} onChange={(event) => updateSetting('textureColor', event.target.value)} className="h-9 w-full rounded border border-border bg-transparent" aria-label="Texture color" />
                  </div>
                </div>
              )}
              
              {/* Grid Style Picker (grid only) */}
              {localSettings.previewBackgroundTexture === 'grid' && (
                <div className="space-y-2">
                  <Label htmlFor="gridStyle" className="text-sm">Grid Style</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: 'Square', value: 'square' },
                      { name: 'Wide', value: 'wide' },
                      { name: 'Tall', value: 'tall' },
                      { name: 'Dense', value: 'dense' },
                    ].map((style) => (
                      <button
                        key={style.value}
                        type="button"
                        className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                          localSettings.gridStyle === style.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => updateSetting('gridStyle', style.value)}
                      >
                        {style.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Grid Line Thickness (grid only) */}
              {localSettings.previewBackgroundTexture === 'grid' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gridLineThickness" className="text-sm">Line Thickness</Label>
                    <span className="text-xs text-muted-foreground font-mono">{localSettings.gridLineThickness}px</span>
                  </div>
                  <input
                    id="gridLineThickness"
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={localSettings.gridLineThickness}
                    onChange={(e) => updateSetting('gridLineThickness', parseInt(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Thin</span>
                    <span>Thick</span>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Editor Font Family */}
            <div className="space-y-2">
              <Label htmlFor="editorFontFamily">Editor Font</Label>
              <Select
                value={localSettings.editorFontFamily}
                onValueChange={(value) => updateSetting('editorFontFamily', value)}
              >
                <SelectTrigger id="editorFontFamily">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Montserrat">Montserrat</SelectItem>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="Georgia">Georgia</SelectItem>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                  <SelectItem value="JetBrains Mono">JetBrains Mono (Monospace)</SelectItem>
                  <SelectItem value="Merriweather">Merriweather</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Font family for the markdown editor
              </p>
            </div>

            <Separator />

            {/* Editor Font Size */}
            <div className="space-y-2">
              <Label htmlFor="editorFontSize">Editor Font Size</Label>
              <Select
                value={localSettings.editorFontSize.toString()}
                onValueChange={(value) =>
                  updateSetting('editorFontSize', parseInt(value))
                }
              >
                <SelectTrigger id="editorFontSize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12px (Small)</SelectItem>
                  <SelectItem value="14">14px (Default)</SelectItem>
                  <SelectItem value="16">16px (Medium)</SelectItem>
                  <SelectItem value="18">18px (Large)</SelectItem>
                  <SelectItem value="20">20px (Extra Large)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Font size for the markdown editor
              </p>
            </div>

            <Separator />

            {/* Preview Font Family */}
            <div className="space-y-2">
              <Label htmlFor="previewFontFamily">Preview Font</Label>
              <Select
                value={localSettings.previewFontFamily}
                onValueChange={(value) => updateSetting('previewFontFamily', value)}
              >
                <SelectTrigger id="previewFontFamily">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Montserrat">Montserrat</SelectItem>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="Georgia">Georgia</SelectItem>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                  <SelectItem value="JetBrains Mono">JetBrains Mono (Monospace)</SelectItem>
                  <SelectItem value="Merriweather">Merriweather</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Font family for the preview pane
              </p>
            </div>

            <Separator />

            {/* Preview Font Size */}
            <div className="space-y-2">
              <Label htmlFor="previewFontSize">Preview Font Size</Label>
              <Select
                value={localSettings.previewFontSize.toString()}
                onValueChange={(value) =>
                  updateSetting('previewFontSize', parseInt(value))
                }
              >
                <SelectTrigger id="previewFontSize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="14">14px (Small)</SelectItem>
                  <SelectItem value="16">16px (Default)</SelectItem>
                  <SelectItem value="18">18px (Medium)</SelectItem>
                  <SelectItem value="20">20px (Large)</SelectItem>
                  <SelectItem value="22">22px (Extra Large)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Font size for the preview pane
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />

        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const loadSettings = (): AppSettings => {
  try {
    const saved = localStorage.getItem('myob-settings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return DEFAULT_SETTINGS;
};
