// Email sending functionality for TravanaSpot
class EmailSender {
  async sendAnalysisEmail(recipientEmail, listingData, analysis, reviews) {
    try {
      // Import the email template generator
      const emailHTML = generateEmailHTML(listingData, analysis, reviews);
      
      const emailContent = {
        from: 'Little Airby <onboarding@resend.dev>',
        to: [recipientEmail],
        subject: `🧸 Your Airbnb Analysis: ${listingData.title || 'Property Review Analysis'}`,
        html: emailHTML
      };

      // Send message to service worker to handle the API call
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'send_email',
          emailData: emailContent
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending email via service worker:', chrome.runtime.lastError);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      console.error('Error preparing email:', error);
      return { success: false, error: error.message };
    }
  }
}

// Make it available globally for the extension
window.EmailSender = EmailSender;