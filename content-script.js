// TravanaSpot - Airbnb Listing Reviews Sentiment Analysis
// Content script that extracts listing information and reviews for AI-powered sentiment analysis

let buttonAdded = false;
let observerActive = false;
let mapModifierScriptInjected = false;
let cachedReviews = null; // Cache for collected reviews

// Safe message sending function with retries
function safeSendMessage(message, callback, retryCount = 0) {
  const maxRetries = 3;

  try {
    // Check if chrome.runtime is still valid
    if (!chrome.runtime || !chrome.runtime.id) {
      console.error('TravanaSpot: Extension context invalidated');
      alert('TravanaSpot: Extension was reloaded. Please refresh this page.');
      return;
    }

    console.log('TravanaSpot: Sending message:', message.type);

    chrome.runtime.sendMessage(message, function(response) {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || chrome.runtime.lastError;
        console.error('TravanaSpot: Message sending error:', errorMsg);

        // Retry logic for connection issues
        if (errorMsg.includes('Could not establish connection') && retryCount < maxRetries) {
          console.log(`TravanaSpot: Retrying... (${retryCount + 1}/${maxRetries})`);
          setTimeout(() => {
            safeSendMessage(message, callback, retryCount + 1);
          }, 500 * (retryCount + 1)); // Exponential backoff
        } else if (errorMsg.includes('Could not establish connection')) {
          console.error('TravanaSpot: Service worker not responding after retries');
          alert('TravanaSpot: Could not connect to extension. Please:\n1. Go to chrome://extensions/\n2. Find TravanaSpot\n3. Click the refresh icon\n4. Refresh this page');
        } else if (errorMsg.includes('Extension context invalidated')) {
          console.error('TravanaSpot: Extension was reloaded - please refresh the page');
          alert('TravanaSpot: Extension was updated. Please refresh this page.');
        }
      } else {
        console.log('TravanaSpot: Message sent successfully:', message.type);
        if (callback) {
          callback(response);
        }
      }
    });
  } catch (error) {
    console.error('TravanaSpot: Error sending message:', error);
    alert('TravanaSpot: Unexpected error. Please refresh the page.');
  }
}

// Function to update button status
function updateButtonStatus(text, color) {
  const button = document.getElementById('travanaspot-button');
  if (button) {
    button.textContent = text;
    button.style.background = color;
  }
}

// Function to notify side panel that reviews are ready
function notifySidePanelReviewsReady(reviews) {
  console.log(`TravanaSpot: Notifying side panel that ${reviews.length} reviews are ready`);
  
  // Try to send the message with retries
  let attempts = 0;
  const maxAttempts = 3;
  
  const trySend = () => {
    attempts++;
    safeSendMessage({
      type: 'reviews_ready',
      reviews: reviews
    }, (response) => {
      if (chrome.runtime.lastError && attempts < maxAttempts) {
        console.log(`TravanaSpot: Retrying reviews_ready message (attempt ${attempts + 1}/${maxAttempts})...`);
        setTimeout(trySend, 1000 * attempts); // Exponential backoff
      } else if (!chrome.runtime.lastError) {
        console.log('TravanaSpot: Successfully sent reviews_ready message');
      }
    });
  };
  
  trySend();
}

// Function to extract Airbnb listing information
function extractAirbnbData() {
  const data = {
    title: '',
    rating: '',
    reviewCount: '',
    price: '',
    location: '',
    host: '',
    guests: '',
    bedrooms: '',
    beds: '',
    baths: ''
  };

  try {
    // Extract title - use more specific selectors
    const titleElement = document.querySelector('h1[elementtiming="LCP-target"]');
    if (titleElement && titleElement.textContent) {
      data.title = titleElement.textContent.trim();
    }

    // Extract rating and review count - use more conservative approach
    const ratingElements = document.querySelectorAll('[data-testid*="rating"], [aria-label*="stars"]');
    for (const element of ratingElements) {
      try {
        const text = element.textContent || element.getAttribute('aria-label') || '';
        const ratingMatch = text.match(/(\d+\.?\d*)/);
        if (ratingMatch && !data.rating) {
          data.rating = ratingMatch[1];
        }
        
        const reviewMatch = text.match(/(\d+)\s*reviews?/i);
        if (reviewMatch && !data.reviewCount) {
          data.reviewCount = reviewMatch[1];
        }
      } catch (e) {
        // Skip this element if there's an error
      }
    }

    // Extract price - look for pricing information
    const priceElement = document.querySelector('[data-testid="price"]');
    if (priceElement && priceElement.textContent) {
      data.price = priceElement.textContent.trim();
    }

    // Extract location from the overview section
    const locationElement = document.querySelector('[data-section-id="OVERVIEW_DEFAULT_V2"] h2');
    if (locationElement && locationElement.textContent) {
      data.location = locationElement.textContent.trim();
    }

    // Extract capacity information from the overview list
    const capacityList = document.querySelector('.lgx66tx');
    if (capacityList) {
      try {
        const capacityItems = capacityList.querySelectorAll('li');
        capacityItems.forEach(item => {
          try {
            const text = item.textContent.toLowerCase();
            if (text.includes('guest')) {
              data.guests = item.textContent.trim();
            } else if (text.includes('bedroom')) {
              data.bedrooms = item.textContent.trim();
            } else if (text.includes('bed') && !text.includes('bedroom')) {
              data.beds = item.textContent.trim();
            } else if (text.includes('bath')) {
              data.baths = item.textContent.trim();
            }
          } catch (e) {
            // Skip this item if there's an error
          }
        });
      } catch (e) {
        // Skip capacity extraction if there's an error
      }
    }

    // Extract host information if available
    const hostElement = document.querySelector('[data-testid="host"]');
    if (hostElement && hostElement.textContent) {
      data.host = hostElement.textContent.trim();
    }

  } catch (error) {
    console.error('Error extracting Airbnb data:', error);
  }

  // Extract reviews (this will be handled asynchronously)
  data.reviews = [];
  
  return data;
}

// Extract reviews from the page asynchronously
function extractReviewsAsync() {
  return new Promise((resolve) => {
    const reviews = [];
    
    try {
      // Update button to show review collection status
      updateButtonStatus('Collecting Reviews...', '#ffa500');
      
      // First, try to click the "Show all reviews" button to open the reviews modal
      const showAllReviewsButton = Array.from(document.querySelectorAll('button')).find(button => {
        try {
          const text = button.textContent || '';
          return text.includes('Show all') && text.includes('reviews');
        } catch (e) {
          return false;
        }
      });
      
      if (showAllReviewsButton) {
        console.log('TravanaSpot: Found "Show all reviews" button, clicking...');
        showAllReviewsButton.click();
        
        // Wait for the reviews modal/page to open and then scroll to collect reviews
        setTimeout(() => {
          collectReviewsWithScrolling().then(collectedReviews => {
            // Cache the collected reviews
            cachedReviews = collectedReviews;
            console.log(`TravanaSpot: Cached ${collectedReviews.length} reviews for side panel`);
            
            // Notify side panel that reviews are ready
            notifySidePanelReviewsReady(collectedReviews);
            
            // Reset button after 3 seconds
            setTimeout(() => updateButtonStatus('TravanaSpot', '#ff385c'), 3000);
            resolve(collectedReviews);
          });
        }, 3000); // Increased wait time
      } else {
        // Check if we're already on the reviews page
        if (window.location.href.includes('/reviews')) {
          console.log('TravanaSpot: Already on reviews page, starting collection...');
          collectReviewsWithScrolling().then(collectedReviews => {
            // Cache the collected reviews
            cachedReviews = collectedReviews;
            console.log(`TravanaSpot: Cached ${collectedReviews.length} reviews for side panel`);
            
            // Notify side panel that reviews are ready
            notifySidePanelReviewsReady(collectedReviews);
            
            // Reset button after 3 seconds
            setTimeout(() => updateButtonStatus('TravanaSpot', '#ff385c'), 3000);
            resolve(collectedReviews);
          });
        } else {
          // If no button found, try to extract what's available
          const extractedReviews = extractReviewsFromDOM();
          cachedReviews = extractedReviews; // Cache even basic extractions
          
          // Notify side panel that reviews are ready
          if (extractedReviews.length > 0) {
            notifySidePanelReviewsReady(extractedReviews);
          }
          
          updateButtonStatus('TravanaSpot', '#ff385c');
          resolve(extractedReviews);
        }
      }
      
      async function collectReviewsWithScrolling() {
        const allReviews = [];
        let attempts = 0;
        const maxAttempts = 30; // Increased from 20
        let consecutiveNoNewReviews = 0;
        
        console.log('TravanaSpot: Starting enhanced review collection...');
        
        // Increase threshold to 10 consecutive attempts to ensure we try harder to get 100 reviews
        while (allReviews.length < 100 && attempts < maxAttempts && consecutiveNoNewReviews < 10) {
          attempts++;
          const previousCount = allReviews.length;
          
          // Extract current visible reviews
          const currentReviews = extractReviewsFromDOM();
          
          // Add new reviews (avoid duplicates)
          currentReviews.forEach(review => {
            const isDuplicate = allReviews.some(existing => 
              existing.name === review.name && existing.text === review.text
            );
            if (!isDuplicate && review.name && review.text) {
              allReviews.push(review);
            }
          });
          
          console.log(`TravanaSpot: Attempt ${attempts}: Found ${currentReviews.length} reviews visible, total collected: ${allReviews.length}`);
          
          // Update button with current progress
          if (allReviews.length > 0) {
            updateButtonStatus(`Collecting... (${allReviews.length})`, '#ffa500');
          }
          
          // If we have enough reviews, stop
          if (allReviews.length >= 100) {
            console.log('TravanaSpot: Reached 100 reviews target');
            break;
          }
          
          // Check if we got new reviews this iteration
          if (allReviews.length === previousCount) {
            consecutiveNoNewReviews++;
            console.log(`TravanaSpot: No new reviews found (${consecutiveNoNewReviews}/10)`);
            
            // Don't check for end indicators until we've made at least 5 attempts
            if (consecutiveNoNewReviews >= 5) {
              // Check if we might have reached the end of all available reviews
              const endOfReviewsIndicators = document.querySelectorAll(
                '[data-testid*="end-of-reviews"], [class*="no-more-reviews"], [class*="all-reviews-shown"]'
              );
              
              // Also check for common "no more reviews" text patterns
              const pageText = document.body.innerText.toLowerCase();
              const endPhrases = [
                'showing all reviews',
                'no more reviews',
                'all reviews shown',
                'end of reviews',
                `showing ${allReviews.length} reviews`,
                `${allReviews.length} reviews`
              ];
              
              const hasEndPhrase = endPhrases.some(phrase => pageText.includes(phrase));
              
              if (endOfReviewsIndicators.length > 0 || hasEndPhrase) {
                console.log('TravanaSpot: Detected end of available reviews');
                console.log(`TravanaSpot: Total reviews available on this listing: ${allReviews.length}`);
                break; // Exit the loop as we've collected all available reviews
              }
            }
          } else {
            consecutiveNoNewReviews = 0;
            console.log(`TravanaSpot: Found new reviews! Resetting counter.`);
          }
          
          // Enhanced scrolling strategy
          let scrolled = false;
          
          // Strategy 1: Look for main content areas first
          const mainContentSelectors = [
            'main',
            '[role="main"]',
            '.main-content',
            '[data-testid="main-content"]',
            '#content',
            '.content',
            '[data-testid="reviews-section"]',
            '[data-section-id="REVIEWS_DEFAULT"]'
          ];
          
          for (const selector of mainContentSelectors) {
            const element = document.querySelector(selector);
            if (element && element.scrollHeight > element.clientHeight + 10) {
              console.log(`TravanaSpot: Found main content element: ${selector}`);
              const before = element.scrollTop;
              element.scrollTo({
                top: element.scrollTop + 1000,
                behavior: 'smooth'
              });
              await new Promise(resolve => setTimeout(resolve, 500));
              const after = element.scrollTop;
              console.log(`TravanaSpot: Main content scrolled from ${before} to ${after}`);
              if (after > before) {
                scrolled = true;
                break;
              }
            }
          }
          
          // Strategy 2: If main content didn't work, try window scroll
          if (!scrolled) {
            console.log('TravanaSpot: Main content scroll failed, trying window scroll...');
            const beforeWindow = window.pageYOffset;
            window.scrollTo({
              top: window.pageYOffset + 1000,
              behavior: 'smooth'
            });
            await new Promise(resolve => setTimeout(resolve, 500));
            const afterWindow = window.pageYOffset;
            console.log(`TravanaSpot: Window scrolled from ${beforeWindow} to ${afterWindow}`);
            if (afterWindow > beforeWindow) {
              scrolled = true;
            }
          }
          
          // Strategy 3: If still no scroll, find the largest scrollable element
          if (!scrolled) {
            console.log('TravanaSpot: Window scroll failed, finding largest scrollable element...');
            let largestScrollable = null;
            let largestScrollPotential = 0;
            
            // Scan all elements for scrollability
            const allElements = document.querySelectorAll('*');
            for (const element of allElements) {
              const scrollPotential = element.scrollHeight - element.clientHeight;
              if (scrollPotential > 50 && scrollPotential > largestScrollPotential) { // Must have at least 50px of scroll
                const style = window.getComputedStyle(element);
                if (style.overflowY !== 'hidden' && style.overflow !== 'hidden') {
                  largestScrollable = element;
                  largestScrollPotential = scrollPotential;
                }
              }
            }
            
            if (largestScrollable) {
              console.log(`TravanaSpot: Found largest scrollable element with ${largestScrollPotential}px potential:`, 
                largestScrollable.tagName, largestScrollable.className?.substring(0, 50));
              const before = largestScrollable.scrollTop;
              largestScrollable.scrollTo({
                top: largestScrollable.scrollTop + 1000,
                behavior: 'smooth'
              });
              await new Promise(resolve => setTimeout(resolve, 500));
              const after = largestScrollable.scrollTop;
              console.log(`TravanaSpot: Largest element scrolled from ${before} to ${after}`);
              if (after > before) {
                scrolled = true;
              }
            }
          }
          
          // Strategy 4: Aggressive approach - try all elements with significant scroll potential
          if (!scrolled) {
            console.log('TravanaSpot: Trying aggressive scrolling on all significant elements...');
            const scrollableElements = [];
            const allElements = document.querySelectorAll('*');
            
            for (const element of allElements) {
              const scrollPotential = element.scrollHeight - element.clientHeight;
              if (scrollPotential > 20) { // Lower threshold for aggressive mode
                scrollableElements.push({
                  element,
                  potential: scrollPotential,
                  tag: element.tagName,
                  className: element.className?.substring(0, 30)
                });
              }
            }
            
            // Sort by scroll potential
            scrollableElements.sort((a, b) => b.potential - a.potential);
            console.log(`TravanaSpot: Found ${scrollableElements.length} scrollable elements`);
            
            // Try the top 3 candidates
            for (let i = 0; i < Math.min(3, scrollableElements.length); i++) {
              const candidate = scrollableElements[i];
              console.log(`TravanaSpot: Trying candidate ${i + 1}: ${candidate.tag}.${candidate.className} (${candidate.potential}px)`);
              
              const before = candidate.element.scrollTop;
              candidate.element.scrollTop += 800;
              await new Promise(resolve => setTimeout(resolve, 300));
              const after = candidate.element.scrollTop;
              
              if (after > before) {
                console.log(`TravanaSpot: Success! Scrolled from ${before} to ${after}`);
                scrolled = true;
                break;
              }
            }
          }
          
          // Strategy 5: Last resort - try scrolling by simulating key presses
          if (!scrolled) {
            console.log('TravanaSpot: Last resort - simulating Page Down key...');
            try {
              const event = new KeyboardEvent('keydown', {
                key: 'PageDown',
                code: 'PageDown',
                keyCode: 34,
                which: 34,
                bubbles: true
              });
              document.dispatchEvent(event);
              await new Promise(resolve => setTimeout(resolve, 500));
              scrolled = true; // Assume it worked
            } catch (e) {
              console.log('TravanaSpot: Key simulation failed:', e);
            }
          }
          
          if (!scrolled) {
            console.log('TravanaSpot: All scroll strategies failed!');
          }
          
          // Wait for content to load after scrolling - increased wait time
          await new Promise(resolve => setTimeout(resolve, 3000)); // Increased from 2500ms
          
          // Look for and wait for loading indicators
          const loadingIndicators = document.querySelectorAll(
            '[class*="loading"], [class*="spinner"], [data-testid*="loading"], [aria-label*="Loading"], [role="progressbar"]'
          );
          if (loadingIndicators.length > 0) {
            console.log(`TravanaSpot: Found ${loadingIndicators.length} loading indicators, waiting...`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Increased from 2500ms
          }
          
          // Additional check for lazy-loaded content
          const lazyImages = document.querySelectorAll('img[loading="lazy"]:not([src]), img[data-src]:not([src])');
          if (lazyImages.length > 0) {
            console.log(`TravanaSpot: ${lazyImages.length} lazy images still loading, waiting...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          // Additional wait if we're close to 100 reviews to ensure we don't miss any
          if (allReviews.length > 70 && allReviews.length < 100) {
            console.log(`TravanaSpot: Close to 100 reviews (${allReviews.length}), adding extra wait time...`);
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
        
        // Final push: If we're between 50-99 reviews AND we haven't hit the limit, try more aggressive techniques
        if (allReviews.length >= 50 && allReviews.length < 95) {
          console.log(`TravanaSpot: Close to target (${allReviews.length}), making final aggressive push...`);
          
          // Try clicking "Show more" buttons if any exist
          const showMoreButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
            const text = btn.textContent?.toLowerCase() || '';
            return text.includes('show more') || text.includes('load more') || text.includes('view more');
          });
          
          for (const btn of showMoreButtons) {
            if (btn.offsetParent !== null) { // Check if button is visible
              console.log('TravanaSpot: Found and clicking "Show more" button');
              btn.click();
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }
          
          // Final aggressive scrolling attempts - but stop if we have 95+ reviews
          for (let finalAttempt = 0; finalAttempt < 8 && allReviews.length < 95; finalAttempt++) {
            console.log(`TravanaSpot: Final push attempt ${finalAttempt + 1}/8`);
            
            // Try different scroll strategies
            if (finalAttempt % 2 === 0) {
              // Even attempts: Scroll to bottom
              window.scrollTo(0, document.body.scrollHeight);
            } else {
              // Odd attempts: Scroll up then down (sometimes triggers loading)
              window.scrollTo(0, 0);
              await new Promise(resolve => setTimeout(resolve, 500));
              window.scrollTo(0, document.body.scrollHeight);
            }
            
            await new Promise(resolve => setTimeout(resolve, 4000)); // Even longer wait
            
            // Extract any new reviews
            const finalReviews = extractReviewsFromDOM();
            finalReviews.forEach(review => {
              const isDuplicate = allReviews.some(existing =>
                existing.name === review.name && existing.text === review.text
              );
              if (!isDuplicate && review.name && review.text && allReviews.length < 95) {
                allReviews.push(review);
              }
            });
            
            console.log(`TravanaSpot: After final push ${finalAttempt + 1}: ${allReviews.length} reviews`);
            
            // If we haven't gained any reviews in 3 attempts, likely no more available
            if (finalAttempt >= 3) {
              const reviewsBeforePush = allReviews.length;
              if (finalAttempt === 3) {
                console.log(`TravanaSpot: Tracking review count at attempt 3: ${reviewsBeforePush}`);
              } else if (finalAttempt === 6 && allReviews.length === reviewsBeforePush) {
                console.log('TravanaSpot: No new reviews in final push attempts, stopping');
                break;
              }
            }
          }
        }
        
        console.log(`TravanaSpot: Review collection completed after ${attempts} attempts`);
        console.log(`TravanaSpot: Final review count: ${allReviews.length} reviews`);
        
        // Log detailed summary if we collected fewer than 100 reviews
        if (allReviews.length < 100 && allReviews.length > 0) {
          console.log(`TravanaSpot: ⚠️ Only ${allReviews.length} reviews collected (target: 100)`);
          console.log('TravanaSpot: Possible reasons:');
          console.log('  - The listing may have fewer than 100 total reviews');
          console.log('  - Reviews may be loading dynamically and not all were captured');
          console.log('  - Some reviews might be hidden or require additional interaction');
          console.log(`  - Total scrolling attempts: ${attempts}`);
          console.log(`  - Consecutive no-new-reviews: ${consecutiveNoNewReviews}`);
          
          // Check for total review count in the page
          const reviewCountElements = document.querySelectorAll('[data-testid*="review-count"], [aria-label*="reviews"], [class*="review-count"]');
          reviewCountElements.forEach(el => {
            const text = el.textContent || el.getAttribute('aria-label') || '';
            const match = text.match(/(\d+)\s*review/i);
            if (match) {
              console.log(`TravanaSpot: Page indicates ${match[1]} total reviews available`);
            }
          });
        } else if (allReviews.length >= 100) {
          console.log('TravanaSpot: ✅ Successfully collected target of 100 reviews!');
        }
        
        // Show success message with review count
        if (allReviews.length > 0) {
          updateButtonStatus(`Reviews: ${allReviews.length}`, '#28a745');
          console.log(`TravanaSpot: ✅ Successfully collected ${allReviews.length} reviews!`);
          console.log('TravanaSpot: Sample reviews:', allReviews.slice(0, 3).map(r => ({
            name: r.name,
            location: r.location,
            date: r.date,
            textPreview: r.text?.substring(0, 100) + '...'
          })));
        } else {
          updateButtonStatus('No Reviews', '#dc3545');
          console.log('TravanaSpot: ⚠️ No reviews were collected');
        }
        
        // Try to close the reviews modal automatically after collection
        console.log('TravanaSpot: Attempting to close reviews modal...');
        try {
          // Wait a moment for any final renders
          await new Promise(resolve => setTimeout(resolve, 500));

          // Try multiple strategies to find and click the close button
          const closeSelectors = [
            // Airbnb-specific close buttons
            'button[aria-label="Close"]',
            'button[aria-label="close"]',
            '[data-testid="modal-container"] button[aria-label*="Close"]',
            '[role="dialog"] button[aria-label*="Close"]',
            // Generic close buttons
            '[data-testid*="close-button"]',
            'button[title="Close"]',
            'button[title="close"]',
            '.modal-close',
            '.close-button',
            '[aria-label*="Close modal"]'
          ];

          let modalClosed = false;
          for (const selector of closeSelectors) {
            const closeButtons = document.querySelectorAll(selector);
            for (const closeButton of closeButtons) {
              // Check if button is visible and clickable
              if (closeButton.offsetParent !== null &&
                  closeButton.getBoundingClientRect().width > 0 &&
                  closeButton.getBoundingClientRect().height > 0) {
                console.log(`TravanaSpot: Found close button with selector: ${selector}`);
                closeButton.click();
                console.log('TravanaSpot: ✅ Clicked close button - modal should close');
                modalClosed = true;
                await new Promise(resolve => setTimeout(resolve, 1000));
                break;
              }
            }
            if (modalClosed) break;
          }

          if (!modalClosed) {
            console.log('TravanaSpot: ⚠️ Could not find visible close button - modal may stay open');
            console.log('TravanaSpot: User can manually close the modal using the X button');
          }
        } catch (e) {
          console.log('TravanaSpot: Error attempting to close modal:', e);
        }
        
        return allReviews.slice(0, 100); // Ensure we don't exceed 100
      }
      
      function extractReviewsFromDOM() {
        const reviews = [];

        try {
          // Look for review elements with the specific structure you provided
          const reviewElements = document.querySelectorAll('[data-review-id]');

          if (reviewElements.length > 0) {

            // Use the specific review structure
            reviewElements.forEach((element, index) => {
              try {
                // Stop if we already have 100 reviews
                if (reviews.length >= 100) return;

                const review = {};

                // Extract reviewer name - try multiple selectors
                let nameElement = element.querySelector('h2[elementtiming="LCP-target"]');
                if (!nameElement) nameElement = element.querySelector('h2');
                if (!nameElement) nameElement = element.querySelector('[class*="name"]');

                if (nameElement && nameElement.textContent) {
                  review.name = nameElement.textContent.trim();
                }

                // Extract location
                const locationElement = element.querySelector('.s15w4qkt');
                if (locationElement && locationElement.textContent) {
                  review.location = locationElement.textContent.trim();
                }

                // Extract date and stay details
                const dateElement = element.querySelector('.c5dn5hn');
                if (dateElement && dateElement.textContent) {
                  const dateText = dateElement.textContent.trim();
                  // Extract just the date part (e.g., "June 2025")
                  const dateMatch = dateText.match(/([A-Za-z]+ \d{4})/);
                  if (dateMatch) {
                    review.date = dateMatch[1];
                  }
                  review.stayDetails = dateText;
                }

                // Extract review text - try multiple selectors
                let textElement = element.querySelector('.r1bctolv span');
                if (!textElement) textElement = element.querySelector('span[class*="text"]');
                if (!textElement) {
                  // Try to find the longest span with actual text
                  const spans = Array.from(element.querySelectorAll('span'));
                  const textSpans = spans.filter(s => s.textContent && s.textContent.trim().length > 20);
                  if (textSpans.length > 0) {
                    textElement = textSpans.reduce((longest, current) =>
                      current.textContent.length > longest.textContent.length ? current : longest
                    );
                  }
                }

                if (textElement && textElement.textContent) {
                  review.text = textElement.textContent.trim();
                }

                // Extract rating from "Rating, X stars" text (most reliable)
                let starCount = 0;

                // Method 1: Look for "Rating, 4 stars" text in span elements
                const ratingTextElements = element.querySelectorAll('span');
                for (const span of ratingTextElements) {
                  const text = span.textContent;
                  if (text && text.includes('Rating,') && text.includes('star')) {
                    // Extract number from "Rating, 4 stars" or "Rating, 5 stars"
                    const match = text.match(/Rating,\s*(\d+)\s*star/);
                    if (match) {
                      starCount = parseInt(match[1]);
                      break;
                    }
                  }
                }

                // Method 2: Count star SVGs (fallback)
                if (starCount === 0) {
                  const starSvgs = element.querySelectorAll('svg[viewBox="0 0 32 32"]');
                  // Only count if reasonable number (1-5 stars)
                  if (starSvgs.length > 0 && starSvgs.length <= 5) {
                    starCount = starSvgs.length;
                  }
                }

                // Method 3: Default to 5 stars if review exists but no rating found
                // (Airbnb requires rating to post review, so if text exists, assume 5 stars)
                if (starCount === 0 && review.text && review.text.length > 20) {
                  starCount = 5;
                }

                if (starCount > 0) {
                  review.rating = starCount;
                  console.log(`TravanaSpot: Extracted ${starCount} stars for review by ${review.name || 'Anonymous'}`);
                } else {
                  console.warn(`TravanaSpot: No rating found for review by ${review.name || 'Anonymous'}`);
                }

                // Only add review if it has meaningful content AND we haven't reached 100
                if (reviews.length < 100) {
                  if (review.name && review.text) {
                    reviews.push(review);
                  } else if (review.text && review.text.length > 20) {
                    // Even without a name, if there's substantial text, include it
                    review.name = 'Anonymous';
                    reviews.push(review);
                  }
                }
              } catch (e) {
                // Skip this review if there's an error
                console.log('TravanaSpot: Error processing review:', e);
              }
            });

            const reviewsWithRatings = reviews.filter(r => r.rating && r.rating > 0).length;
            console.log(`TravanaSpot: Extracted ${reviews.length} reviews from DOM (${reviewsWithRatings} with ratings)`);

            // Log first 3 reviews to debug rating extraction
            if (reviews.length > 0) {
              console.log('TravanaSpot: Sample reviews:', reviews.slice(0, 3).map(r => ({
                name: r.name,
                rating: r.rating,
                textPreview: r.text?.substring(0, 50) + '...'
              })));
            }

          } else {
            // Fallback: look for any review-like elements with multiple selectors
            const fallbackSelectors = [
              '[data-testid*="review"]',
              '[class*="review-item"]',
              '[class*="review-card"]',
              '[id*="review"]',
              'article[role="article"]',
              'div[role="article"]'
            ];
            
            const allFallbackElements = new Set();
            fallbackSelectors.forEach(selector => {
              document.querySelectorAll(selector).forEach(el => allFallbackElements.add(el));
            });
            
            Array.from(allFallbackElements).forEach((element, index) => {
              try {
                if (reviews.length >= 100) return; // Stop at 100 reviews
                
                const review = {};
                
                // Extract reviewer name
                const nameElement = element.querySelector('h2, strong, b');
                if (nameElement && nameElement.textContent) {
                  review.name = nameElement.textContent.trim();
                }
                
                // Extract review date
                const dateElement = element.querySelector('time, [class*="date"]');
                if (dateElement && dateElement.textContent) {
                  review.date = dateElement.textContent.trim();
                }
                
                // Extract review text
                const textElement = element.querySelector('p, div[class*="text"], span[class*="text"]');
                if (textElement && textElement.textContent) {
                  review.text = textElement.textContent.trim();
                }
                
                // Only add review if it has meaningful content
                if (review.name || review.text) {
                  reviews.push(review);
                }
              } catch (e) {
                // Skip this review if there's an error
                console.log('TravanaSpot: Error processing fallback review:', e);
              }
            });
          }
        } catch (e) {
          console.log('TravanaSpot: Error extracting reviews from DOM:', e);
        }
        
        return reviews;
      }
      
    } catch (error) {
      console.error('Error extracting reviews:', error);
      updateButtonStatus('TravanaSpot', '#ff385c');
      resolve([]);
    }
  });
}

// Function to trigger map modification
function triggerMapModification() {
  if (!mapModifierScriptInjected) {
    injectMapModifierScript();
    // Wait a bit for the script to load
    setTimeout(() => {
      if (window.travanaSpotModifyMaps) {
        window.travanaSpotModifyMaps();
      }
    }, 1000);
  } else {
    if (window.travanaSpotModifyMaps) {
      window.travanaSpotModifyMaps();
    }
  }
}

// Function to inject the map modifier script
function injectMapModifierScript() {
  if (mapModifierScriptInjected) {
    // console.log('TravanaSpot: Map modifier script already injected');
    return;
  }

  // console.log('TravanaSpot: Attempting to inject map modifier script...');
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject-map-modifier.js');
  script.id = 'travanaspot-map-modifier-script';
  
  script.onload = () => {
    // console.log('TravanaSpot: Map modifier script injected successfully');
    mapModifierScriptInjected = true;
    
    // Check if functions are available after injection (logging disabled)
    // setTimeout(() => {
    //   console.log('TravanaSpot: Post-injection function check:', {
    //     modifyMaps: typeof window.travanaSpotModifyMaps,
    //     toggleSatellite: typeof window.travanaSpotToggleSatellite,
    //     toggleFullscreen: typeof window.travanaSpotToggleFullscreen
    //   });
    // }, 100);
  };
  
  script.onerror = (error) => {
    console.error('TravanaSpot: Failed to inject map modifier script:', error);
    mapModifierScriptInjected = false;
  };
  
  // Remove existing script if any
  const existingScript = document.getElementById('travanaspot-map-modifier-script');
  if (existingScript) {
    existingScript.remove();
    mapModifierScriptInjected = false;
  }
  
  (document.head || document.documentElement).appendChild(script);
}

// Function to create and add the TravanaSpot button
function addTravanaSpotButton() {
  try {
    // Prevent multiple button additions
    if (buttonAdded) {
      return;
    }

    // Check if we're on an Airbnb room page or test page
    const isAirbnbPage = window.location.href.includes('airbnb.com/rooms/');
    const isTestPage = window.location.href.includes('test-map-functionality.html');
    
    if (!isAirbnbPage && !isTestPage) {
      console.log('TravanaSpot: Not on Airbnb page, current URL:', window.location.href);
      return;
    }

    // console.log('TravanaSpot: Attempting to add button...');

    // Remove existing button if it exists
    const existingButton = document.getElementById('travanaspot-button');
    if (existingButton) {
      existingButton.remove();
    }

    // Create button using DOMParser like in the cookbook example
    const button = new DOMParser().parseFromString(
      '<button id="travanaspot-button" style="position: fixed; top: 80px; right: 20px; z-index: 100000; background: #ff385c; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-size: 14px; min-width: 120px;">🏠 TravanaSpot Panel</button>',
      'text/html'
    ).body.firstElementChild;

    // Add click event listener
    button.addEventListener('click', function () {
      console.log('TravanaSpot: Button clicked, opening side panel...');
      
      try {
        // Check if chrome.runtime is still valid
        if (!chrome.runtime || !chrome.runtime.id) {
          console.error('TravanaSpot: Extension context invalidated. Please refresh the page.');
          alert('TravanaSpot extension needs to be refreshed. Please reload this page.');
          return;
        }
        
        const airbnbData = extractAirbnbData();
        safeSendMessage({ 
          type: 'open_side_panel',
          data: airbnbData
        });
      } catch (error) {
        console.error('TravanaSpot: Error in button click:', error);
        if (error.message.includes('context invalidated')) {
          alert('TravanaSpot extension was updated or reloaded. Please refresh this page to continue.');
        }
      }
    });

    // Add hover effects
    button.addEventListener('mouseenter', function() {
      this.style.background = '#e31c5f';
      this.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', function() {
      this.style.background = '#ff385c';
      this.style.transform = 'scale(1)';
    });

    // Add button to page
    document.body.append(button);
    buttonAdded = true;
    
    // console.log('TravanaSpot: Button added successfully');
    
    // Inject map modifier script when button is added
    injectMapModifierScript();
    
  } catch (error) {
    console.error('TravanaSpot: Error adding button:', error);
  }
}

// Debounced function to prevent excessive calls
let debounceTimer;
function debouncedAddButton() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (window.location.href.includes('airbnb.com/rooms/') || 
        window.location.href.includes('test-map-functionality.html')) {
      addTravanaSpotButton();
    }
  }, 500); // Wait 500ms after last change for faster response
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addTravanaSpotButton);
} else {
  addTravanaSpotButton();
}

// Also try to add button after a short delay to handle dynamic loading
setTimeout(addTravanaSpotButton, 2000);

// Try multiple times to ensure button appears
setTimeout(addTravanaSpotButton, 3000);
setTimeout(addTravanaSpotButton, 5000);
setTimeout(addTravanaSpotButton, 8000);

// Add keyboard shortcut to open panel (Ctrl+Shift+T)
document.addEventListener('keydown', function(event) {
  if (event.ctrlKey && event.shiftKey && event.key === 'T') {
    console.log('TravanaSpot: Keyboard shortcut pressed, opening side panel...');
    const airbnbData = extractAirbnbData();
    safeSendMessage({ 
      type: 'open_side_panel',
      data: airbnbData
    });
  }
});

// Add global function to open panel manually
window.openTravanaSpotPanel = function() {
  console.log('TravanaSpot: Manual panel open requested...');
  const airbnbData = extractAirbnbData();
  safeSendMessage({ 
    type: 'open_side_panel',
    data: airbnbData
  });
};

// Add global function to manually create button
window.createTravanaSpotButton = function() {
  console.log('TravanaSpot: Manual button creation requested...');
  buttonAdded = false; // Reset flag
  addTravanaSpotButton();
};

// Make functions accessible in the main window context
document.addEventListener('DOMContentLoaded', function() {
  // Inject script to make functions globally accessible
  const script = document.createElement('script');
  script.textContent = `
    window.openTravanaSpotPanel = function() {
      console.log('TravanaSpot: Panel open requested from main context...');
      // Send a custom event that the content script can listen to
      document.dispatchEvent(new CustomEvent('travanaspot-open-panel'));
    };
    
    window.createTravanaSpotButton = function() {
      console.log('TravanaSpot: Button creation requested from main context...');
      // Send a custom event that the content script can listen to
      document.dispatchEvent(new CustomEvent('travanaspot-create-button'));
    };
    
    console.log('TravanaSpot: Global functions injected into main context');
  `;
  document.head.appendChild(script);
});

// Listen for events from the main context
document.addEventListener('travanaspot-open-panel', function() {
  console.log('TravanaSpot: Received panel open request...');
  const airbnbData = extractAirbnbData();
  safeSendMessage({ 
    type: 'open_side_panel',
    data: airbnbData
  });
});

document.addEventListener('travanaspot-create-button', function() {
  console.log('TravanaSpot: Received button creation request...');
  buttonAdded = false; // Reset flag
  addTravanaSpotButton();
});

// Handle dynamic content changes (for SPAs) - with performance optimization
const observer = new MutationObserver((mutations) => {
  // Only process if we're on an Airbnb room page or test page and button hasn't been added
  if ((window.location.href.includes('airbnb.com/rooms/') || 
       window.location.href.includes('test-map-functionality.html')) && !buttonAdded) {
    // Check if any mutations are relevant (body changes, new elements added)
    const relevantMutations = mutations.filter(mutation => 
      mutation.type === 'childList' && 
      (mutation.target === document.body || mutation.target.closest('body'))
    );
    
    if (relevantMutations.length > 0) {
      debouncedAddButton();
    }
  }
});

// Start observing only if we're on an Airbnb page or test page
if (window.location.href.includes('airbnb.com/rooms/') || 
    window.location.href.includes('test-map-functionality.html')) {
  observer.observe(document.body, {
    childList: true,
    subtree: true // Watch entire subtree to catch more changes
  });
  observerActive = true;
}

// Handle messages from side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'modify_maps') {
    console.log('TravanaSpot: Received map modification request');
    // Call the map modification function in the injected script
    if (window.travanaSpotModifyMaps) {
      window.travanaSpotModifyMaps();
    } else {
      console.log('TravanaSpot: Map modifier function not available, injecting script');
      injectMapModifierScript();
      // Wait a bit for the script to load and then call the function
      setTimeout(() => {
        if (window.travanaSpotModifyMaps) {
          window.travanaSpotModifyMaps();
        }
      }, 1000);
    }
  } else if (message.type === 'reset_maps') {
    console.log('TravanaSpot: Received map reset request');
    // Reset maps to default view (this would need to be implemented in the injected script)
    if (window.travanaSpotResetMaps) {
      window.travanaSpotResetMaps();
    }
  } else if (message.type === 'extract_reviews') {
    console.log('TravanaSpot: Received extract_reviews request from side panel');
    
    // Check if this is a force refresh request
    const forceRefresh = message.forceRefresh || false;
    
    // Check if we have cached reviews first (unless force refresh)
    if (!forceRefresh && cachedReviews && cachedReviews.length > 0) {
      console.log(`TravanaSpot: Using cached reviews (${cachedReviews.length} reviews)`);
      console.log('TravanaSpot: Sample cached reviews:', cachedReviews.slice(0, 2));
      sendResponse({reviews: cachedReviews});
      return true;
    }
    
    if (forceRefresh) {
      console.log('TravanaSpot: Force refresh requested, clearing cache...');
      cachedReviews = null;
    }
    
    console.log('TravanaSpot: No cached reviews, starting fresh collection...');
    // Extract reviews asynchronously and send response
    extractReviewsAsync().then(reviews => {
      console.log(`TravanaSpot: Sending ${reviews.length} reviews to side panel`);
      console.log('TravanaSpot: Sample reviews being sent:', reviews.slice(0, 2));
      sendResponse({reviews: reviews});
    }).catch(error => {
      console.error('TravanaSpot: Error in extractReviewsAsync:', error);
      sendResponse({reviews: []});
    });
    return true; // Keep the message channel open for async response
  }
});

// Handle URL changes for SPAs
let currentUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    buttonAdded = false; // Reset flag for new page
    mapModifierScriptInjected = false; // Reset map script flag for new page
    cachedReviews = null; // Clear cached reviews for new page

    
    if (currentUrl.includes('airbnb.com/rooms/') || 
        currentUrl.includes('test-map-functionality.html')) {
      if (!observerActive) {
        observer.observe(document.body, {
          childList: true,
          subtree: false
        });
        observerActive = true;
      }
      addTravanaSpotButton();
    } else {
      // Stop observing if we're not on an Airbnb room page
      if (observerActive) {
        observer.disconnect();
        observerActive = false;
      }
      // Remove button if it exists
      const existingButton = document.getElementById('travanaspot-button');
      if (existingButton) {
        existingButton.remove();
      }
    }
  }
});

// Observe URL changes
urlObserver.observe(document, {
  subtree: true,
  childList: true
});

 