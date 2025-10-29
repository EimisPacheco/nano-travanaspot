// TravanaSpot - Airbnb Listing Reviews Sentiment Analysis
// Service worker for handling side panel operations and review analysis

let currentListingData = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('TravanaSpot extension installed');
});

// Email sending function
async function sendEmailViaResend(emailData) {
  const RESEND_API_KEY = 're_hDDW8vmQ_6QqDVThLXXcsV32TbtbF5ndh';
  const API_ENDPOINT = 'https://api.resend.com/emails';
  
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('Email sent successfully from service worker!', data);
      return { success: true, data };
    } else {
      console.error('Failed to send email from service worker:', data);
      return { success: false, error: data };
    }
  } catch (error) {
    console.error('Error sending email from service worker:', error);
    return { success: false, error: error.message };
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle side panel opening
  if (message.type === 'open_side_panel') {
    // Store the extracted data
    currentListingData = message.data;

    // Open the side panel for the current tab
    (async () => {
      try {
        await chrome.sidePanel.open({ tabId: sender.tab.id });
        await chrome.sidePanel.setOptions({
          tabId: sender.tab.id,
          path: 'sidepanel.html',
          enabled: true
        });

        // Send data to side panel
        chrome.runtime.sendMessage({
          type: 'update_side_panel',
          data: currentListingData
        });

        // Send response back to content script
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error opening side panel:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    // Return true to indicate we'll send a response asynchronously
    return true;
  }
  
  // Handle data requests from side panel
  if (message.type === 'get_listing_data') {
    sendResponse({ data: currentListingData });
    return true;
  }
  
  // Handle reviews ready notification from content script
  if (message.type === 'reviews_ready') {
    console.log('Service Worker: Relaying reviews_ready message to side panel');
    // Relay the message to the side panel
    chrome.runtime.sendMessage({
      type: 'reviews_ready',
      reviews: message.reviews
    });
    return true;
  }
  
  // Handle email sending request
  if (message.type === 'send_email') {
    console.log('Service Worker: Received email send request');
    sendEmailViaResend(message.emailData).then(result => {
      sendResponse(result);
    });
    return true; // Keep the message channel open for async response
  }
}); 