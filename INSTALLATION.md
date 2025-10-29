# TravanaSpot Installation Guide

## Quick Start

### Step 1: Prepare the Extension
1. **Download or clone** the TravanaSpot folder to your computer
2. **Generate icons** (optional but recommended):
   - Open `create-icons.html` in your browser
   - Download the three icon files (16x16, 48x48, 128x128)
   - Place them in the `images/` folder

### Step 2: Load the Extension in Chrome
1. **Open Chrome** and go to `chrome://extensions/`
2. **Enable Developer mode** by toggling the switch in the top-right corner
3. **Click "Load unpacked"** button
4. **Select the TravanaSpot folder** from your file system
5. **Verify the extension appears** in your extensions list

### Step 3: Test the Extension
1. **Navigate to an Airbnb listing page** (e.g., `https://www.airbnb.com/rooms/682766586954621956`)
2. **Look for the red "🏠 TravanaSpot" button** in the top-right corner
3. **Click the button** to open the side panel
4. **View the extracted listing information** in the beautiful interface

## Troubleshooting

### Extension Not Loading
- Ensure you selected the correct folder (the one containing `manifest.json`)
- Check that Developer mode is enabled
- Try refreshing the extensions page

### Button Not Appearing
- Make sure you're on an Airbnb room listing page (URL contains `/rooms/`)
- Refresh the page and wait for it to fully load
- Check the browser console for any error messages

### Side Panel Not Opening
- Ensure you're using Chrome version 116 or higher
- Check that the extension has the required permissions
- Try refreshing the extension in `chrome://extensions/`

### No Data Extracted
- Airbnb may have updated their page structure
- The extension may need updates for new layouts
- Check the browser console for extraction errors

## Features Overview

Once installed, TravanaSpot will:

✅ **Automatically detect** Airbnb listing pages  
✅ **Extract key information** like title, rating, reviews, price, etc.  
✅ **Display data** in a modern side panel interface  
✅ **Work without page refresh** on dynamic Airbnb pages  
✅ **Provide a summary** of the listing information  

## Uninstalling

To remove the extension:
1. Go to `chrome://extensions/`
2. Find TravanaSpot in the list
3. Click "Remove" or toggle it off

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Ensure you're on a supported Airbnb page
3. Try refreshing both the page and the extension
4. Verify Chrome version compatibility (116+)

## Development

For developers wanting to modify the extension:
1. Make your changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the TravanaSpot extension
4. Test your changes on an Airbnb listing page

The extension uses modern Chrome Extension APIs (Manifest V3) and follows best practices for content scripts and side panels. 