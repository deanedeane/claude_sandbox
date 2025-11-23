# DownShift - Mobility PWA

A local-first Progressive Web Application designed as a pre-sleep mobility companion. DownShift functions as an intelligent, adaptive coach for a 15-minute nightly flexibility routine.

## Features

### 🗺️ Body Map
- Interactive body diagram with tap-to-toggle status (Normal, Tight, Pain)
- Persistent state tracking across sessions
- Visual feedback with color coding

### ✅ Check-In
- Text or voice input for current status
- Adjustable session duration (5-30 minutes)
- Session focus selection (Relaxation/Sleep or Recovery/Mobility)
- LLM integration for personalized routine generation

### ▶️ Session Player
- Large, readable timer optimized for viewing from 2 meters away
- Automatic wake lock to keep screen active during session
- Text-to-Speech exercise announcements
- Audible chime notifications between exercises
- Simple stick figure visualizations
- Form cues and avoidance tips

### 📊 Feedback & History
- Post-session feedback (Too Easy, Just Right, Too Hard)
- Adaptive intensity adjustment based on feedback
- Session history with detailed tracking

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Storage**: IndexedDB + localStorage for local-first persistence
- **APIs**:
  - Wake Lock API (keep screen active)
  - Web Speech API (TTS and voice input)
  - Web Audio API (chimes)
- **LLM Integration**: OpenAI GPT-4 or Anthropic Claude
- **PWA**: Service Worker, Web App Manifest

## Installation

### Local Setup

1. Clone or download this repository
2. Serve the `downshift` directory with any web server:
   ```bash
   # Using Python
   cd downshift
   python -m http.server 8000

   # Using Node.js
   npx http-server -p 8000

   # Using PHP
   php -S localhost:8000
   ```
3. Open `http://localhost:8000` in your browser
4. For PWA features, you'll need HTTPS (or localhost)

### Installing as PWA

1. Open the app in Chrome/Edge/Safari
2. Look for the "Install" prompt or use browser menu > "Install DownShift"
3. The app will be added to your home screen

## Configuration

### LLM API Key

The app requires an LLM API key to generate personalized routines:

1. Get an API key from:
   - **OpenAI**: https://platform.openai.com/api-keys
   - **Anthropic**: https://console.anthropic.com/

2. Enter your API key in the Check-In view
3. The key is stored locally in your browser and never sent anywhere except the LLM provider

**Note**: API usage will incur costs from your chosen provider. Each routine generation typically uses ~1000-2000 tokens.

### Icons

The app references icon files in the `icons/` directory. You'll need to add your own icon images:

Required sizes:
- icon-72.png (72x72)
- icon-96.png (96x96)
- icon-128.png (128x128)
- icon-144.png (144x144)
- icon-152.png (152x152)
- icon-192.png (192x192)
- icon-384.png (384x384)
- icon-512.png (512x512)

You can generate these using any image editing tool. Recommended: dark background with amber/gold icon to match the app theme.

## Usage Guide

### First Time Setup

1. **Body Map**: Tap body areas to mark which areas feel tight or have pain
2. **Check-In**: Add your API key and describe how you're feeling
3. **Generate**: The LLM will create a personalized routine
4. **Session**: Follow along with the timer and visual guides
5. **Feedback**: Rate the session to help future routines adapt

### Daily Use

1. Update your Body Map if anything has changed
2. Check in with today's status
3. Start your session
4. Provide feedback

### Tips

- Use the app 30-60 minutes before bed for best results
- Keep your device within arm's reach but visible from the floor
- Enable Do Not Disturb to avoid interruptions
- The wake lock will keep your screen on during sessions

## Design Philosophy

- **Circadian-Friendly**: True black background with warm amber tones to minimize blue light
- **Professional Tone**: Concise, "physio-speak" - no gamification
- **Minimalist UI**: Large text, high contrast, optimized for distance viewing
- **Local-First**: All data stored on device, no cloud dependency
- **Privacy-First**: No tracking, no analytics, no data collection

## Browser Compatibility

### Fully Supported
- Chrome/Edge 87+ (Desktop & Android)
- Safari 15.4+ (iOS & macOS)

### Partial Support
- Firefox 126+ (Wake Lock not supported)
- Samsung Internet 15+

### Required APIs
- IndexedDB (storage)
- Service Worker (PWA)
- Wake Lock API (screen on during session)
- Web Speech API (voice input & TTS)
- Web Audio API (chimes)

## Offline Support

The app caches all core functionality for offline use. However, routine generation requires an internet connection to reach the LLM API.

A fallback routine is available if LLM generation fails.

## Troubleshooting

### Wake Lock Not Working
- Ensure you're using a supported browser
- Check that the app has proper permissions
- Wake lock only works when page is visible

### Voice Input Not Working
- Grant microphone permissions when prompted
- Check browser compatibility
- Use text input as alternative

### LLM Generation Failing
- Verify your API key is correct
- Check internet connection
- Ensure you have API credits with your provider
- Use the fallback routine option

### App Not Installing
- Requires HTTPS (localhost is okay for testing)
- Clear browser cache and try again
- Check browser console for errors

## Privacy & Data

- **All data stays on your device** - stored in IndexedDB
- **API key stored locally** in localStorage
- **No server** - purely client-side application
- **No tracking** - no analytics, no cookies, no external requests except to your chosen LLM provider

## License

This project is provided as-is for personal use.

## Credits

Built with vanilla JavaScript. No frameworks, no build tools, no dependencies (except your chosen LLM API).

---

**Remember**: This is a mobility companion, not medical advice. Consult a healthcare professional for any persistent pain or injury concerns.
