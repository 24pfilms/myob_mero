import { ItemType, ShapeType, BoardItem } from '../types';

export interface VoiceCommand {
  action: 'create' | 'unknown';
  itemType?: ItemType;
  shape?: ShapeType;
  properties?: Partial<BoardItem>;
  confidence: number;
}

const COMMAND_PATTERNS = {
  // Sticky notes
  note: { type: ItemType.StickyNote, keywords: ['note', 'sticky', 'post-it'] },
  
  // Text boxes
  text: { type: ItemType.TextBox, keywords: ['text', 'text box', 'textbox', 'label'] },
  
  // Shapes
  circle: { type: ItemType.Shape, shape: ShapeType.Circle, keywords: ['circle', 'oval', 'round'] },
  rectangle: { type: ItemType.Shape, shape: ShapeType.Rectangle, keywords: ['rectangle', 'square', 'box'] },
  triangle: { type: ItemType.Shape, shape: ShapeType.Triangle, keywords: ['triangle'] },
  diamond: { type: ItemType.Shape, shape: ShapeType.Diamond, keywords: ['diamond', 'rhombus'] },
  hexagon: { type: ItemType.Shape, shape: ShapeType.Hexagon, keywords: ['hexagon', 'hex'] },
  
  // Frames
  frame: { type: ItemType.Frame, keywords: ['frame', 'container', 'group'] },
};

const COLOR_MAP: { [key: string]: string } = {
  red: '#ff6b6b',
  blue: '#4dabf7',
  green: '#51cf66',
  yellow: '#fff38a',
  orange: '#ff922b',
  purple: '#cc5de8',
  pink: '#ffa8e4',
  gray: '#868e96',
  black: '#000000',
  white: '#ffffff',
};

const SIZE_MAP: { [key: string]: { width: number; height: number } } = {
  small: { width: 100, height: 100 },
  medium: { width: 200, height: 200 },
  large: { width: 300, height: 300 },
  big: { width: 300, height: 300 },
};

export function parseVoiceCommand(transcript: string): VoiceCommand {
  const lower = transcript.toLowerCase().trim();
  
  console.log('🎤 Parsing voice command:', transcript);
  
  // Check for creation keywords
  const isCreateCommand = 
    lower.includes('create') || 
    lower.includes('add') || 
    lower.includes('make') || 
    lower.includes('new');
  
  if (!isCreateCommand) {
    console.log('❌ No creation keyword found');
    return { action: 'unknown', confidence: 0 };
  }
  
  // Determine item type and shape
  let itemType: ItemType | undefined;
  let shape: ShapeType | undefined;
  let confidence = 0.5; // Base confidence for having a creation keyword
  
  for (const [key, config] of Object.entries(COMMAND_PATTERNS)) {
    for (const keyword of config.keywords) {
      if (lower.includes(keyword)) {
        itemType = config.type;
        shape = 'shape' in config ? config.shape : undefined;
        confidence = 0.9; // High confidence when we match a keyword
        console.log(`✅ Matched keyword "${keyword}" → ${itemType}${shape ? ` (${shape})` : ''}`);
        break;
      }
    }
    if (itemType) break;
  }
  
  if (!itemType) {
    console.log('❌ No item type keyword found');
    return { action: 'unknown', confidence: 0 };
  }
  
  // Extract properties (color, size, text)
  const properties: Partial<BoardItem> = {};
  
  // Check for colors
  for (const [colorName, colorValue] of Object.entries(COLOR_MAP)) {
    if (lower.includes(colorName)) {
      properties.backgroundColor = colorValue;
      confidence += 0.05;
      console.log(`🎨 Found color: ${colorName} → ${colorValue}`);
      break;
    }
  }
  
  // Check for sizes
  for (const [sizeName, dimensions] of Object.entries(SIZE_MAP)) {
    if (lower.includes(sizeName)) {
      properties.width = dimensions.width;
      properties.height = dimensions.height;
      confidence += 0.05;
      console.log(`📏 Found size: ${sizeName} → ${dimensions.width}x${dimensions.height}`);
      break;
    }
  }
  
  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0);
  
  return {
    action: 'create',
    itemType,
    shape,
    properties,
    confidence
  };
}

// Helper function to get natural language description of command
export function describeCommand(command: VoiceCommand): string {
  if (command.action === 'unknown') {
    return 'Command not recognized';
  }
  
  const parts: string[] = ['Creating'];
  
  // Add size
  if (command.properties?.width) {
    const size = command.properties.width === 100 ? 'small' : 
                 command.properties.width === 200 ? 'medium' : 'large';
    parts.push(size);
  }
  
  // Add color
  if (command.properties?.backgroundColor) {
    const colorName = Object.entries(COLOR_MAP).find(
      ([_, value]) => value === command.properties?.backgroundColor
    )?.[0];
    if (colorName) parts.push(colorName);
  }
  
  // Add item type
  if (command.shape) {
    parts.push(command.shape.toLowerCase());
  } else if (command.itemType === ItemType.StickyNote) {
    parts.push('sticky note');
  } else if (command.itemType === ItemType.TextBox) {
    parts.push('text box');
  } else if (command.itemType === ItemType.Frame) {
    parts.push('frame');
  }
  
  return parts.join(' ');
}
