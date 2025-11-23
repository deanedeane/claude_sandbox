# DownShift - Quick Start Guide

## Step 1: Generate Icons

Before deploying, generate the PWA icons:

1. Open `generate-icons.html` in your browser
2. Click "Generate Icons"
3. Click "Download All"
4. Save all downloaded icons to the `icons/` directory

## Step 2: Set Up Local Server

The app requires a web server. Choose one:

### Option A: Python (recommended for testing)
```bash
cd downshift
python3 -m http.server 8000
```
Then open: `http://localhost:8000`

### Option B: Node.js
```bash
npx http-server downshift -p 8000
```
Then open: `http://localhost:8000`

### Option C: PHP
```bash
cd downshift
php -S localhost:8000
```
Then open: `http://localhost:8000`

## Step 3: Get an API Key

DownShift requires an LLM API key for routine generation:

### Option A: OpenAI (GPT-4)
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Expected cost: ~$0.01-0.03 per routine generation

### Option B: Anthropic (Claude)
1. Go to https://console.anthropic.com/
2. Create a new API key
3. Expected cost: ~$0.01-0.02 per routine generation

**Save this key** - you'll enter it in the app's Check-In screen.

## Step 4: Test the App

### Test Checklist

1. **Body Map**
   - [ ] Click on different body parts
   - [ ] Verify colors change (Normal → Tight → Pain → Normal)
   - [ ] Refresh page and verify state persists

2. **Check-In**
   - [ ] Enter your API key
   - [ ] Type or use voice input for status
   - [ ] Adjust duration slider (5-30 minutes)
   - [ ] Select session focus (Sleep or Recovery)
   - [ ] Click "Generate Routine"

3. **Session Player**
   - [ ] Verify timer counts down
   - [ ] Check that screen stays awake (Wake Lock)
   - [ ] Listen for audio chime between exercises
   - [ ] Confirm TTS announces exercise names
   - [ ] Verify stick figure displays
   - [ ] Check that form cues are visible
   - [ ] Test exit button

4. **Feedback**
   - [ ] Select difficulty rating
   - [ ] Add optional notes
   - [ ] Submit feedback

5. **History**
   - [ ] View completed session
   - [ ] Verify all session details are saved

### Browser Testing

Test in multiple browsers:
- [ ] Chrome/Edge (Desktop)
- [ ] Chrome (Android)
- [ ] Safari (iOS)
- [ ] Safari (macOS)

### PWA Features

- [ ] Install prompt appears
- [ ] App installs to home screen
- [ ] App launches in standalone mode
- [ ] Service worker caches assets
- [ ] App works offline (except LLM generation)

## Step 5: Deploy (Optional)

For production use, deploy to a hosting service with HTTPS:

### Option A: GitHub Pages
1. Push to GitHub repository
2. Enable GitHub Pages in Settings
3. Access via: `https://yourusername.github.io/downshift/`

### Option B: Netlify
1. Drag and drop the `downshift` folder to Netlify
2. Get instant HTTPS URL

### Option C: Vercel
```bash
npm i -g vercel
cd downshift
vercel
```

### Option D: Your own server
1. Upload files via FTP/SSH
2. Ensure HTTPS is configured
3. Point to `index.html`

## Troubleshooting

### Issue: Wake Lock not working
**Solution**: Ensure you're on HTTPS (or localhost) and using a supported browser.

### Issue: Voice input not working
**Solution**: Grant microphone permissions. Check browser compatibility.

### Issue: LLM generation fails
**Solution**:
- Verify API key is correct
- Check internet connection
- Ensure you have credits with your LLM provider
- Try the fallback routine option

### Issue: App won't install as PWA
**Solution**:
- Requires HTTPS (localhost works for testing)
- Clear browser cache
- Check that manifest.json and sw.js are accessible
- Verify all icons exist

### Issue: Service Worker not registering
**Solution**:
- Check browser console for errors
- Verify the `scope` in sw.js registration matches your deployment path
- Make sure sw.js is in the root of the app directory

## Development Tips

### Debugging

Open browser DevTools (F12) and check:
- **Console**: For JavaScript errors
- **Application > Storage**: View IndexedDB data
- **Application > Service Workers**: Verify registration
- **Application > Manifest**: Check PWA manifest

### Clearing Data

To reset the app during testing:
```javascript
// In browser console:
indexedDB.deleteDatabase('DownShiftDB');
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Testing LLM Integration

The app includes a fallback routine that activates if LLM generation fails. This is useful for testing without using API credits.

### Modifying the System Prompt

Edit `js/llm.js` and update the `SYSTEM_PROMPT` constant to change how the LLM generates routines.

## Usage Tips

### Best Practices
- Use 30-60 minutes before bed
- Update Body Map regularly
- Provide honest feedback to improve adaptation
- Keep device within reach but visible from floor
- Enable Do Not Disturb mode

### Privacy
- All data stored locally on your device
- API key never leaves your device (except to call LLM)
- No tracking, analytics, or external services
- Export/import data for backup (coming soon)

## Next Steps

1. Test all features thoroughly
2. Generate proper icons with your preferred design
3. Customize colors in `css/app.css` if desired
4. Deploy to production with HTTPS
5. Install on your phone's home screen
6. Use nightly and provide feedback!

---

**Need Help?** Check the main README.md for detailed documentation.

**Found a Bug?** The app logs errors to the browser console - check there first.

**Want to Contribute?** This is a self-contained vanilla JS app - no build process needed!
