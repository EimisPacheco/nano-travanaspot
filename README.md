# TravanaSpot - Meet Little Airby! 🧸

A delightful Chrome extension that extracts and displays key information from Airbnb listing pages with the help of Little Airby, your friendly AI companion!

## Features

- **Smart Data Extraction**: Automatically extracts listing information from Airbnb room pages
- **Beautiful Side Panel**: Displays extracted data in a modern, clean interface
- **Real-time Analysis**: Works on any Airbnb listing page without page refresh
- **Comprehensive Data**: Extracts title, rating, reviews, price, location, host, and capacity information
- **🎤 Voice Assistant**: Full voice integration with ElevenLabs API for hands-free operation
- **🔊 Text-to-Speech**: Hear listing summaries and information spoken aloud
- **🎙️ Voice Commands**: Control the extension using voice commands
- **🔄 Voice-Controlled Reviews**: Refresh reviews and navigate using voice
- **🧸 Little Airby Review Analysis**: Your cute AI companion provides warm, friendly analysis of collected reviews using Chrome's Built-in AI (Gemini Nano)
- **📊 Little Airby's Sweet Insights**: Get comprehensive, friendly analysis of guest sentiment based on actual star ratings with accurate percentages
- **💬 Chat with Little Airby**: Ask specific questions about the reviews and get natural, conversational answers (no robotic citations!)
- **⚡ 100% On-Device AI**: All AI processing runs locally in your browser - no external API calls, completely private and free!

## Extracted Information

The extension extracts the following data from Airbnb listings:

- **Title**: The main listing title (e.g., "Entire guesthouse in San Antonio, Texas")
- **Rating**: Star rating out of 5
- **Reviews**: Number of reviews
- **Price**: Listing price information
- **Location**: Property location details
- **Host**: Host name and information
- **Capacity**: Guests, bedrooms, beds, and bathrooms

## Installation

### Development Installation

1. **Clone or download** this repository
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer mode** by toggling the switch in the top right
4. **Click "Load unpacked"** and select the `TravanaSpot` folder
5. **Pin the extension** to your toolbar for easy access

### Using the Extension

1. **Navigate** to any Airbnb room listing page (e.g., `https://www.airbnb.com/rooms/682766586954621956`)
2. **Look for the red "🏠 TravanaSpot" button** in the top-right corner of the page
3. **Click the button** to open the side panel with extracted information
4. **View the analyzed data** in the beautiful side panel interface

### Voice Features

The extension includes powerful voice capabilities:

#### Voice Commands
- **"Refresh reviews"** - Reload and collect new reviews
- **"Speak summary"** - Hear a spoken summary of the listing
- **"Stop"** - Stop current voice operations

#### Voice Controls in Side Panel
- **🎙️ Start Recording** - Begin voice input for commands
- **🔊 Speak Summary** - Hear the listing information spoken aloud
- **⏹️ Stop** - Stop recording or playback

#### Little Airby's Sweet Controls in Side Panel
- **🧸 Little Airby Analysis** - Get comprehensive, friendly analysis of all reviews from your AI companion
- **📝 Little Airby's Summary** - Create a warm, friendly summary of review content
- **💬 Chat with Little Airby** - Ask specific questions about the reviews and get caring responses

#### Testing Voice Functionality
1. Open `test-voice-integration.html` in your browser
2. Test recording, playback, and text-to-speech features
3. Verify ElevenLabs API integration is working correctly

#### Troubleshooting Voice Recording Issues

If you encounter "Failed to start recording" errors:

**Quick Fixes:**
- Check microphone permissions in browser address bar
- Use HTTPS or localhost (secure context required)
- Close other applications using the microphone
- Ensure modern browser support (Chrome, Firefox, Safari, Edge)

**Detailed Debugging:**
- Open `test-voice-debug.html` for comprehensive diagnostics
- Check browser console for specific error messages
- Verify MediaRecorder API support

**Common Error Messages:**
- `NotAllowedError`: Allow microphone access in browser settings
- `NotFoundError`: Check microphone device connections
- `NotSupportedError`: Browser doesn't support audio recording
- `NotReadableError`: Microphone busy - close other apps
- `SecurityError`: Use HTTPS or localhost for secure context

#### Testing Little Airby's Functionality
1. Open `test-ai-integration.html` in your browser
2. Test Little Airby's review analysis, sweet summaries, and friendly chat features
3. Verify Little Airby (Gemini AI) integration is working correctly

## Project Structure

```
TravanaSpot/
├── manifest.json                # Extension configuration
├── content-script.js            # Extracts data & reviews from Airbnb pages
├── service-worker.js            # Handles side panel operations
├── sidepanel.html               # Side panel interface
├── sidepanel.js                 # Side panel functionality
├── browser-ai-integration.js    # Chrome Built-in AI integration (Summarizer + Prompt API)
├── voice-integration.js         # ElevenLabs voice integration
├── inject-map-modifier.js       # Map modification functionality
├── email-sender.js              # Email analysis results
├── email-template-exact.js      # Email HTML templates
├── test-voice-integration.html  # Voice functionality test page
├── images/                      # Extension icons
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── README.md                    # This file
├── BROWSER_AI_MIGRATION.md      # Browser AI migration documentation
└── TESTING_INSTRUCTIONS.md      # Testing guide
```

## Technical Details

### Content Script (`content-script.js`)
- Injects a floating button on Airbnb listing pages
- Extracts listing data using DOM selectors
- Sends data to the service worker when button is clicked
- Handles dynamic content changes (SPA navigation)

### Service Worker (`service-worker.js`)
- Manages side panel opening/closing
- Stores extracted data temporarily
- Handles communication between content script and side panel

### Side Panel (`sidepanel.html` & `sidepanel.js`)
- Displays extracted data in a modern interface
- Handles data rendering and error states
- Communicates with service worker for data updates
- **Voice Controls**: Recording, text-to-speech, and voice command functionality

### Voice Integration (`voice-integration.js`)
- **ElevenLabs API Integration**: Uses your ElevenLabs API key for high-quality voice synthesis
- **Speech-to-Text**: Converts voice input to text commands
- **Text-to-Speech**: Converts listing summaries to spoken audio
- **Voice Commands**: Supports commands like "refresh reviews", "speak summary", "stop"
- **Audio Management**: Handles audio context, recording, and playback

### Little Airby Integration (`browser-ai-integration.js`)
- **Chrome Built-in AI (Gemini Nano)**: Uses Chrome's on-device AI APIs - completely private and free!
- **Summarizer API**: Creates comprehensive narrative summaries from 100+ reviews using hierarchical summarization
- **Prompt API (Language Model)**: Extracts structured data (keyword analysis, pros/cons, guest insights) with JSON schema validation
- **Smart Sentiment Analysis**: Calculates accurate guest sentiment based on actual 5-star ratings extracted from reviews
- **Natural Chatbot**: Ask questions and get conversational answers that distinguish between property vs. neighborhood questions
- **Rating Extraction**: Intelligently extracts star ratings from "Rating, X stars" text in review DOM
- **Anti-Hallucination**: Batched search with explicit "NOT_FOUND" responses to prevent making up information

## Browser Compatibility

- **Chrome Canary**: Version 128+ (required for Chrome Built-in AI APIs)
- **Chrome Dev/Canary**: Enable flags at `chrome://flags/#optimization-guide-on-device-model` and `chrome://flags/#summarization-api-for-gemini-nano`
- **Side Panel API**: Chrome 116+
- **Production**: Built-in AI APIs currently only available in Chrome Dev/Canary with flags enabled

### Enabling Chrome Built-in AI (Required)

1. Install **Chrome Canary** or **Chrome Dev**
2. Navigate to `chrome://flags/#optimization-guide-on-device-model`
3. Set to **"Enabled BypassPerfRequirement"**
4. Navigate to `chrome://flags/#summarization-api-for-gemini-nano`
5. Set to **"Enabled"**
6. Navigate to `chrome://flags/#prompt-api-for-gemini-nano`
7. Set to **"Enabled"**
8. **Restart Chrome**
9. Open DevTools Console and verify:
   - `await ai.languageModel.capabilities()` should show `available: "readily"`
   - `await ai.summarizer.capabilities()` should show availability status

## Permissions

The extension requires the following permissions:

- **`sidePanel`**: To display the analysis panel
- **`activeTab`**: To access the current Airbnb page content
- **`microphone`**: To enable voice recording and commands

## Development

### Prerequisites
- Chrome browser (version 116+)
- Basic knowledge of HTML, CSS, and JavaScript

### Making Changes
1. Edit the relevant files in the `TravanaSpot` directory
2. Go to `chrome://extensions/`
3. Click the refresh icon on the TravanaSpot extension
4. Test your changes on an Airbnb listing page

### Adding Icons
Replace the placeholder files in the `images/` directory with your own icons:
- `icon-16.png` (16x16 pixels)
- `icon-48.png` (48x48 pixels)
- `icon-128.png` (128x128 pixels)

## Recent Updates & Fixes

### Latest Improvements (Current Session)

**✅ Fixed Sentiment Analysis Accuracy**
- Now uses actual 5-star ratings from reviews instead of unreliable keyword counting
- Ratings extracted from "Rating, X stars" text in DOM with 3-method fallback
- Sentiment percentages now accurate (e.g., 75% positive, 20% neutral, 5% negative)

**✅ Fixed Summarizer API Language Error**
- Added `outputLanguage: 'en'` to all Summarizer API calls
- Fixed in: `Summarizer.create()`, `summarize()` method calls (3 locations)
- Resolves "No output language was specified" errors

**✅ Enhanced Chatbot Quality**
- Natural conversational responses without robotic "(Review 7)" citations
- Distinguishes between property questions vs. neighborhood questions
- Specific answers for food types, not just "restaurants"
- Uses `initialPrompts` pattern with system/user/assistant roles

**✅ Preserved Rating Data Through Processing**
- Fixed truncation process that was converting reviews to plain strings
- Now maintains `{text, rating, name}` object structure throughout analysis
- Enables accurate sentiment calculation from actual guest ratings

## Troubleshooting

### Extension Not Working
1. Ensure you're on an Airbnb room listing page
2. Check that the extension is enabled in `chrome://extensions/`
3. Try refreshing the page and clicking the TravanaSpot button again

### AI Features Not Working
1. Verify Chrome Canary/Dev with flags enabled (see Browser Compatibility section)
2. Check console for API availability: `await ai.languageModel.capabilities()`
3. Ensure Gemini Nano model downloaded (check `chrome://components/`)
4. Look for "TravanaSpot: Prompt API is available" in console

### Sentiment Shows 100% Neutral
1. Check console for "X/100 reviews have ratings" - should show ratings extracted
2. Look for "Extracted 5 stars for review by [Name]" messages
3. If ratings = 0, the DOM structure may have changed

### Chatbot Gives Wrong Answers
1. Check if question is about property vs. neighborhood - chatbot now distinguishes
2. Look for "NOT_FOUND_IN_THIS_BATCH" in console - means answer not in reviews
3. Chatbot searches in batches of 10 reviews - may take time for 100 reviews

### No Data Extracted
1. Airbnb may have changed their page structure
2. Check the browser console for any error messages
3. The extension may need updates for new Airbnb layouts

### Side Panel Not Opening
1. Ensure you're using Chrome version 116 or higher
2. Check that the side panel permission is granted
3. Try refreshing the extension in `chrome://extensions/`

## Contributing

Feel free to contribute to this project by:
- Reporting bugs or issues
- Suggesting new features
- Improving the data extraction logic
- Enhancing the UI/UX

## License

This project is based on the Chrome Extensions samples and follows the same Apache License 2.0.

## Acknowledgments

- Based on Chrome Extensions samples from Google
- Inspired by the need for quick Airbnb listing analysis
- Uses modern Chrome Extension APIs (Manifest V3) 