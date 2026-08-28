# Voice Commands - User Guide

## Overview

Mero now supports voice commands to create items on the canvas at your mouse cursor position. Simply activate voice commands, position your mouse where you want the item, and speak your command!

## Activation

### Method 1: Keyboard Shortcut (Recommended)
Press **Ctrl+Alt+V** to toggle voice commands on/off.

### Method 2: Toolbar Button
Click the microphone icon (🎤) in the toolbar to toggle voice commands.

**Visual Indicators:**
- 🔴 **Red pulsing dot** on microphone icon = Voice commands are active
- 🔵 **Blue highlight** = Microphone button is selected
- 🎤 **Blue notification** at top = "Voice commands active - Say 'create a note'"

## Supported Commands

### Creating Sticky Notes
- "create a note"
- "add a note"
- "create a sticky note"
- "make a sticky"
- "add a post-it"

### Creating Text Boxes
- "create a text box"
- "add text"
- "make a text box"
- "create a label"

### Creating Shapes

#### Circles
- "create a circle"
- "add a circle"
- "make an oval"
- "create a round"

#### Rectangles
- "create a rectangle"
- "add a square"
- "make a box"
- "create a rectangle"

#### Triangles
- "create a triangle"
- "add a triangle"
- "make a triangle"

#### Diamonds
- "create a diamond"
- "add a rhombus"
- "make a diamond"

#### Hexagons
- "create a hexagon"
- "add a hex"
- "make a hexagon"

### Creating Frames
- "create a frame"
- "add a container"
- "make a group"

## Command Modifiers (Advanced)

### Colors
Add color words to customize item appearance:
- "create a **red** note"
- "add a **blue** circle"
- "make a **green** rectangle"

**Supported colors:**
- red, blue, green, yellow, orange, purple, pink, gray, black, white

### Sizes
Add size words to control dimensions:
- "create a **small** circle"
- "add a **large** note"
- "make a **big** rectangle"

**Supported sizes:**
- small (100x100), medium (200x200), large/big (300x300)

## How It Works

1. **Activate voice commands** (Ctrl+Alt+V or click microphone)
2. **Position your mouse** where you want the item to appear
3. **Speak your command** clearly (e.g., "create a note")
4. **Item appears instantly** at your mouse cursor position!

### Important: Mouse Position Capture
The system captures your mouse position at the START of listening, so you can:
- Position mouse first
- Then speak your command
- Item will appear where your mouse WAS when you started speaking

This prevents drift from mouse movement while you're talking.

## Visual Feedback

### Success
- ✅ **Green notification** at top of screen
- Text: "✓ Creating [item description]"
- Item appears on canvas

### Error/Unrecognized
- ❌ **Red notification** at top of screen
- Text: "✗ Command not recognized: [your words]"
- No item created

### Info/Tips
- 🎤 **Blue notification** on activation
- Tips and instructions shown

## Browser Compatibility

Voice commands use the browser's native Web Speech API:

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome  | ✅ Full | Best experience |
| Edge    | ✅ Full | Chromium-based |
| Safari  | ✅ Good | WebKit support |
| Firefox | ❌ Limited | May not work |

**Microphone Permission Required:** Your browser will request microphone access on first use.

## Tips & Best Practices

### ✅ DO
- **Speak clearly** and at normal pace
- **Use natural commands** ("create a note" not "create note")
- **Position mouse first** then speak
- **Wait for feedback** before next command
- **Use short commands** (2-5 words work best)

### ❌ DON'T
- Don't speak too fast or mumble
- Don't move mouse while speaking (position is captured at start)
- Don't expect complex multi-step commands
- Don't use in noisy environments
- Don't forget to turn off when done (prevents accidental triggers)

## Troubleshooting

### "Voice commands not working"
1. Check microphone icon has red dot (active)
2. Verify microphone permission granted
3. Test microphone in other apps
4. Try Chrome/Edge if using other browser

### "Commands not recognized"
1. Speak more clearly
2. Use exact phrases from this guide
3. Check notification for what was heard
4. Reduce background noise

### "Items appearing in wrong place"
1. Remember: position captured at START of listening
2. Position mouse BEFORE speaking
3. Don't move mouse while speaking

### "Accidental item creation"
1. Turn off voice commands when not in use (Ctrl+Alt+V)
2. Watch for red pulsing dot indicator
3. Speak deliberately when active

### "Microphone not working"
1. Check browser permissions (camera/microphone)
2. Refresh page and try again
3. Try different browser
4. Check system microphone settings

## Privacy & Security

- **All processing is local** - Voice recognition happens in your browser
- **No audio sent to servers** - Web Speech API is browser-native
- **No recording stored** - Transcripts processed and discarded immediately
- **Microphone control** - Easy on/off toggle, visual indicators

## Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| Ctrl+Alt+V | Toggle voice commands on/off |
| Esc | Cancel pending tool (if using click-to-place) |
| F11 | Toggle fullscreen |

## Examples

### Basic Usage
1. Press **Ctrl+Alt+V** to activate
2. Position mouse in center of canvas
3. Say **"create a note"**
4. ✅ Yellow sticky note appears!

### With Color
1. Activate voice commands
2. Position mouse
3. Say **"create a red circle"**
4. ✅ Red circle appears!

### Multiple Items
1. Keep voice commands active
2. Move mouse to position 1
3. Say **"create a note"** ✅
4. Move mouse to position 2
5. Say **"add a circle"** ✅
6. Move mouse to position 3
7. Say **"make a text box"** ✅

### Quick On/Off
1. Press **Ctrl+Alt+V** - commands active
2. Create items with voice
3. Press **Ctrl+Alt+V** again - commands off
4. Continue normal canvas work

## Advanced Tips

### Workflow Integration
- Keep voice commands **OFF** by default
- Turn **ON** only when placing multiple items
- Use for rapid brainstorming sessions
- Combine with manual item placement

### Accessibility
- Great for users with mobility limitations
- Reduces need for toolbar clicks
- Hands-free operation while thinking/presenting
- Works alongside screen readers

### Presentation Mode
- Perfect for live demos and presentations
- Create items while talking to audience
- More natural than clicking through toolbar
- Engages viewers with voice interaction

## Future Enhancements (Coming Soon)

Potential features being considered:
- ✨ Delete items by voice ("delete this")
- ✨ Move/modify items ("move this right")
- ✨ Add text content ("create a note saying hello")
- ✨ Group operations ("select all notes")
- ✨ Custom voice shortcuts
- ✨ Multi-language support

---

## Quick Start Checklist

- [ ] Press **Ctrl+Alt+V** to activate
- [ ] See **red pulsing dot** on microphone icon
- [ ] Position your **mouse cursor**
- [ ] Say **"create a note"** clearly
- [ ] Watch for **green success** notification
- [ ] See **sticky note** appear at cursor!
- [ ] Press **Ctrl+Alt+V** to deactivate

**Congratulations!** You're now using voice commands in Mero! 🎉

For questions or issues, check the troubleshooting section above or consult the main README.md.
