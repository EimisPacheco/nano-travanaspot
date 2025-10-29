# Testing Instructions for TravanaSpot

## Prerequisites
1. Chrome 128+ with AI features enabled
2. Navigate to `chrome://flags/#optimization-guide-on-device-model` and set to "Enabled BypassPerfRequirement"
3. Navigate to `chrome://flags/#prompt-api-for-gemini-nano` and set to "Enabled"
4. Restart Chrome
5. Download Gemini Nano model (happens automatically on first use, may take a few minutes)

## Installation
1. Download the TravanaSpot extension folder
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the TravanaSpot folder
6. Extension should now appear with a pink icon

## Testing Steps

### Basic Functionality Test
1. Navigate to any Airbnb listing page (example: https://www.airbnb.com/rooms/[any-listing-id])
2. Wait for page to fully load
3. Click the pink "TravanaSpot" button that appears in the top-right corner of the page
4. The Chrome sidepanel should open showing listing details (title, rating, location, capacity)

### Review Analysis Test
1. In the sidepanel, click the "📊 Analyze Reviews" button
2. The reviews modal will open automatically to collect reviews (you'll see it scrolling)
3. Wait 10-30 seconds for collection and analysis to complete
4. The modal should close automatically
5. Verify the sidepanel displays:
   - **Summary**: A concise paragraph summarizing guest feedback
   - **Sentiment Analysis**: Positive/neutral/negative percentages
   - **Keyword Analysis**: 9 aspects (Cleanliness, Location, HostCommunication, ValueForMoney, CheckInProcess, AccuracyOfListing, NoiseLevels, Comfort, Amenities) with positive/negative counts and review snippets
   - **Pros & Cons**: Bulleted lists of positive highlights and negative issues
   - **Guest Insights**: Four sections (Recommended For, Not Recommended For, Best Features, Areas for Improvement)

### Interactive Features Test
1. **Text-to-Speech**: Click the "🔊 Read Aloud" button next to the summary - the summary should be read aloud
2. **Chatbot**: Scroll to the chatbox, type a question like "Is parking available?" or "Is it noisy?" and click "Ask Little Airby" - you should get a relevant answer based on the reviews
3. **Email**: Click "📧 Email Analysis" button, enter your email address, click send - you should receive the analysis report
4. **Review Navigation**: Click any review snippet (text in quotes) - it should attempt to locate and highlight that review in the original reviews

### Edge Cases to Test
1. **Listing with few reviews** (<20): Should still work, just analyze fewer reviews
2. **Listing with many reviews** (>100): Should analyze exactly 100 reviews
3. **Multiple listings**: Test on 2-3 different properties to verify consistency
4. **Chatbot unknown info**: Ask something not mentioned in reviews (e.g., "What's the WiFi password?") - should respond "Sorry, this is not mentioned in the reviews"

## Expected Behavior
- Analysis completes in 10-30 seconds
- All sections populate with real data from reviews
- No console errors (check Developer Tools console)
- Reviews modal closes automatically after collection
- Chatbot provides truthful answers or admits when info is unavailable

## Troubleshooting
- If "Browser AI not available" error appears: Ensure Chrome flags are enabled and Gemini Nano is downloaded
- If analysis is very slow: Check Chrome DevTools console for token limit warnings
- If pros/cons are empty: Check console for "hasProsAndCons: true" message
- If modal won't close: Manually close with X button, check console for close attempt logs
