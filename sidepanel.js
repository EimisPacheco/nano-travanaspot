// TravanaSpot - Side Panel JavaScript
// Handles displaying extracted Airbnb listing data

let listingData = null;
let currentAnalysis = null;

// Toggle snippets visibility - defined early to be available globally
window.toggleSnippets = function(elementId, button) {
    console.log('toggleSnippets called for:', elementId);
    const element = document.getElementById(elementId);
    console.log('Element found:', !!element);
    console.log('Current display:', element ? element.style.display : 'N/A');
    
    if (element) {
        if (element.style.display === 'none' || element.style.display === '') {
            element.style.display = 'block';
            button.textContent = 'Show less';
            button.style.borderColor = '#6c757d';
            button.style.color = '#6c757d';
            console.log('Expanded snippets');
        } else {
            element.style.display = 'none';
            const count = element.querySelectorAll('.snippet').length;
            const originalColor = button.getAttribute('data-original-color') || '#28a745';
            button.textContent = `Show ${count} more`;
            button.style.borderColor = originalColor;
            button.style.color = originalColor;
            console.log('Collapsed snippets');
        }
    } else {
        console.error('Element not found:', elementId);
    }
};

// Function to render the listing data
function renderListingData(data) {
    const contentDiv = document.getElementById('content');
    
    if (!data || Object.keys(data).every(key => !data[key])) {
        contentDiv.innerHTML = `
            <div class="no-data">
                <h3>No Data Found</h3>
                <p>Unable to extract listing information from this page.</p>
                <p>Make sure you're on an Airbnb room listing page.</p>
            </div>
        `;
        return;
    }

    // Build the data sections
    let html = '';

    // Title and Location Section at the beginning
    if (data.title || data.location) {
        html += `
            <div class="data-section">
                <div class="data-item">
                    <div class="data-value title" style="font-size: 18px; font-weight: 700; color: #222; margin-bottom: 8px;">${data.title || 'Not available'}</div>
                </div>
                ${data.location ? `
                <div class="data-item">
                    <div class="data-value location" style="font-size: 14px; color: #666; margin-bottom: 12px;">📍 ${data.location}</div>
                </div>
                ` : ''}
            </div>
        `;
    }

    // Rating and Reviews Section
    if (data.rating || data.reviewCount) {
        html += `
            <div class="data-section">
                ${data.rating ? `
                <div class="data-item">
                    <div class="data-label">Rating:</div>
                    <div class="data-value rating">
                        <span class="stars">★★★★★</span>
                        <span>${data.rating}/5</span>
                    </div>
                </div>
                ` : ''}
                ${data.reviewCount ? `
                <div class="data-item">
                    <div class="data-label">Reviews:</div>
                    <div class="data-value">${data.reviewCount} reviews</div>
                </div>
                ` : ''}
            </div>
        `;
    }

    // Price Section
    if (data.price) {
        html += `
            <div class="data-section">
                <div class="data-item">
                    <div class="data-label">Price:</div>
                    <div class="data-value price">${data.price}</div>
                </div>
            </div>
        `;
    }

    // Host Section
    if (data.host) {
        html += `
            <div class="data-section">
                <div class="data-item">
                    <div class="data-label">Host:</div>
                    <div class="data-value">${data.host}</div>
                </div>
            </div>
        `;
    }

    // Capacity Section
    const capacityItems = [data.guests, data.bedrooms, data.beds, data.baths].filter(item => item);
    if (capacityItems.length > 0) {
        html += `
            <div class="data-section">
                <div class="data-item">
                    <div class="data-label">Capacity:</div>
                    <div class="data-value">
                        <div class="capacity-grid">
                            ${capacityItems.map(item => `
                                <div class="capacity-item">${item}</div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    contentDiv.innerHTML = html;
    
    // Handle reviews separately in the new reviews container
    renderReviewsSection(data.reviews || []);

    // Load reviews asynchronously (immediate check)
    loadReviewsAsync();

    // Also check again after 5 seconds (in case reviews are still being collected)
    setTimeout(() => {
        console.log('SidePanel: Secondary review check after 5 seconds...');
        loadReviewsAsync();
    }, 5000);

    // And one more check after 15 seconds for very slow collections
    setTimeout(() => {
        console.log('SidePanel: Final review check after 15 seconds...');
        loadReviewsAsync();
    }, 15000);
    
    // Add refresh button event listener
    setTimeout(() => {
        const refreshBtn = document.getElementById('refresh-reviews-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                console.log('SidePanel: Manual refresh button clicked (FORCE REFRESH)');
                this.textContent = '🔄 Refreshing...';
                this.disabled = true;
                loadReviewsAsync(true).finally(() => {  // true = force refresh
                    this.textContent = '🔄 Refresh Reviews';
                    this.disabled = false;
                });
            });
        }
    }, 100);
}

// Function to show error message
function showError(message) {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = `
        <div class="error">
            <strong>❌ Error</strong>
            <p>${message}</p>
        </div>
    `;
}

// Function to show loading state
function showLoading() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Analyzing Airbnb listing...</p>
        </div>
    `;
}

// Function to load reviews asynchronously
async function loadReviewsAsync(forceRefresh = false) {
    try {
        console.log('SidePanel: Starting review loading...', forceRefresh ? '(FORCE REFRESH)' : '(using cache if available)');
        
        // Send message to content script to extract reviews
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        console.log('SidePanel: Found active tab:', tabs[0]?.url);
        
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'extract_reviews',
            forceRefresh: forceRefresh
        });
        console.log('SidePanel: Received response:', response);
        
        if (response && response.reviews) {
            console.log(`SidePanel: Got ${response.reviews.length} reviews, updating section...`);
            // Update the reviews section
            updateReviewsSection(response.reviews);
        } else {
            console.log('SidePanel: No reviews in response or invalid response');
        }
    } catch (error) {
        console.error('SidePanel: Error loading reviews:', error);
    }
}

// Function to render reviews in the dedicated reviews container
function renderReviewsSection(reviews) {
    const reviewsContainer = document.getElementById('reviews-container');
    if (!reviewsContainer) return;
    
    if (reviews && reviews.length > 0) {
        const reviewsHtml = `
            <div class="reviews-section">
                <div class="reviews-header">📝 Guest Reviews (${reviews.length})</div>
                ${reviews.map(review => `
                    <div class="review-item">
                        <div class="review-header">
                            <div class="reviewer-name">${review.name || 'Guest'}</div>
                            <div class="review-date">${review.date || 'Recent'}</div>
                        </div>
                        ${review.location ? `<div class="review-location">📍 ${review.location}</div>` : ''}
                        ${review.rating ? `<div class="review-rating">${'★'.repeat(review.rating)}</div>` : ''}
                        <div class="review-text">${review.text || 'No review text available'}</div>
                    </div>
                `).join('')}
            </div>
        `;
        reviewsContainer.innerHTML = reviewsHtml;
    } else {
        reviewsContainer.innerHTML = `
            <div class="reviews-section">
                <div class="reviews-header">📝 Guest Reviews</div>
                <div class="no-reviews">Little Airby is waiting for reviews to analyze...</div>
            </div>
        `;
    }
}

// Function to update the reviews section
function updateReviewsSection(reviews) {
    console.log('SidePanel: updateReviewsSection called with:', reviews?.length, 'reviews');
    
    // Update the reviews container
    renderReviewsSection(reviews);
    
    if (reviews && reviews.length > 0) {
        console.log('SidePanel: Updating with reviews data...');
        
        // Update Little Airby status to show reviews are available
        updateAIStatus(`${reviews.length} reviews available for Little Airby analysis`);
        
        // Auto-trigger comprehensive analysis when reviews are loaded
        if (reviews.length >= 5) { // Only auto-analyze if we have enough reviews
            console.log('SidePanel: Auto-triggering comprehensive analysis...');
            // Ensure Little Airby is initialized before auto-analysis
            setTimeout(() => {
                if (!geminiAI) {
                    console.log('SidePanel: Initializing Little Airby before auto-analysis...');
                    initGeminiAI();
                    // Wait a bit more for initialization
                    setTimeout(() => {
                        autoTriggerAnalysis(reviews);
                    }, 500);
                } else {
                    autoTriggerAnalysis(reviews);
                }
            }, 1000); // Small delay to ensure UI is updated
        }
    } else {
        // Update Little Airby status to show no reviews
        updateAIStatus('No reviews available for Little Airby to analyze');
    }
}

// Update Little Airby status display
function updateAIStatus(message) {
    const aiAnalysisDiv = document.getElementById('ai-analysis');
    if (aiAnalysisDiv && !aiAnalysisDiv.querySelector('.loading')) {
        // Only update if not currently loading
        aiAnalysisDiv.style.display = 'block';
        aiAnalysisDiv.innerHTML = `<p style="text-align: center; color: #666; font-size: 12px;">${message}</p>`;
    }
}

// Generate comprehensive analysis HTML
function generateComprehensiveAnalysisHTML(analysis) {
    const sentiment = analysis.sentiment_analysis || {};
    const keywords = analysis.keyword_analysis || [];
    const prosCons = analysis.pros_and_cons || {};
    const insights = analysis.guest_insights || {};
    
    return `
        <div class="comprehensive-analysis">
            <!-- Header -->
            <div class="analysis-header">
                <h3>🧸 Little Airby's Sweet Insights</h3>
                <div class="trust-score">
                    <span class="trust-label">Trust Score:</span>
                    <span class="trust-value">${analysis.trust_score || 0}/100</span>
                </div>
            </div>

            <!-- Overall Summary -->
            <div class="summary-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4 style="margin: 0;">📝 Summary</h4>
                    <button id="tts-button" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                        <span id="tts-icon">🔊</span>
                        <span id="tts-text">Read Aloud</span>
                    </button>
                </div>
                <p id="summary-text">${analysis.summary || 'No summary available - check console for errors'}</p>
            </div>

            <!-- Sentiment Analysis -->
            <div class="sentiment-section">
                <h4>📊 Guest Sentiment</h4>
                <div class="sentiment-bars">
                    <div class="sentiment-item positive">
                        <span class="sentiment-icon">📈</span>
                        <span class="sentiment-label">Positive</span>
                        <div class="progress-bar">
                            <div class="progress-fill positive" style="width: ${sentiment.positive_percentage || 0}%"></div>
                        </div>
                        <span class="sentiment-percentage">${Math.round(sentiment.positive_percentage || 0)}%</span>
                    </div>
                    <div class="sentiment-item neutral">
                        <span class="sentiment-icon">➖</span>
                        <span class="sentiment-label">Neutral</span>
                        <div class="progress-bar">
                            <div class="progress-fill neutral" style="width: ${sentiment.neutral_percentage || 0}%"></div>
                        </div>
                        <span class="sentiment-percentage">${Math.round(sentiment.neutral_percentage || 0)}%</span>
                    </div>
                    <div class="sentiment-item negative">
                        <span class="sentiment-icon">📉</span>
                        <span class="sentiment-label">Negative</span>
                        <div class="progress-bar">
                            <div class="progress-fill negative" style="width: ${sentiment.negative_percentage || 0}%"></div>
                        </div>
                        <span class="sentiment-percentage">${Math.round(sentiment.negative_percentage || 0)}%</span>
                    </div>
                </div>
            </div>

            <!-- Keyword Analysis -->
            <div class="keyword-section">
                <h4>🔍 Top Highlights</h4>
                <p class="section-subtitle">Key aspects mentioned in reviews</p>
                ${keywords.length === 0 ? `
                    <div style="padding: 20px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; color: #856404;">
                        <div style="font-weight: bold; margin-bottom: 8px;">⚠️ Keyword Analysis Unavailable</div>
                        ${analysis.keyword_analysis_error ? `
                            <div style="font-size: 14px; margin-bottom: 8px;">
                                <strong>Reason:</strong> ${analysis.keyword_analysis_error}
                            </div>
                        ` : `
                            <div style="font-size: 14px; margin-bottom: 8px;">
                                The AI-powered keyword extraction failed. Using basic keyword detection instead.
                            </div>
                        `}
                        <div style="font-size: 12px; color: #856404; margin-top: 8px;">
                            💡 Pros and Cons below still provide valuable insights based on review analysis.
                        </div>
                    </div>
                ` : `
                <div class="keyword-grid">
                                                ${keywords.map((keyword, keywordIndex) => {
                                    const positiveLimited = keyword.positive_snippets ? keyword.positive_snippets.slice(0, 10) : [];
                                    const negativeLimited = keyword.negative_snippets ? keyword.negative_snippets.slice(0, 10) : [];
                                    const hasMorePositive = keyword.positive_snippets && keyword.positive_snippets.length > 3;
                                    const hasMoreNegative = keyword.negative_snippets && keyword.negative_snippets.length > 3;
                                    
                                    return `
                                <div class="keyword-card" data-keyword="${keyword.keyword}">
                                    <div class="keyword-header">
                                        <span class="keyword-name">${keyword.keyword}</span>
                                        <span class="keyword-stats">
                                            <span class="positive-count">${keyword.positive} positive</span>
                                            ${keyword.negative > 0 ? `<span class="negative-count">${keyword.negative} negative</span>` : ''}
                                        </span>
                                    </div>
                                    ${positiveLimited.length > 0 ? `
                                        <div class="snippets positive-snippets">
                                            <strong style="color: #28a745;">👍 Positive:</strong>
                                            <div class="snippet-list" id="positive-snippets-${keywordIndex}">
                                                ${positiveLimited.slice(0, 3).map((snippet, index) => `
                                                    <div class="snippet clickable-snippet" data-snippet="${snippet}" data-type="positive" data-keyword="${keyword.keyword}">
                                                        "${snippet}"
                                                        <span class="snippet-hint">Click to find in reviews</span>
                                                    </div>
                                                `).join('')}
                                            </div>
                                            ${hasMorePositive ? `
                                                <div class="snippet-list collapsed" id="positive-snippets-more-${keywordIndex}" style="display: none;">
                                                    ${positiveLimited.slice(3).map((snippet, index) => `
                                                        <div class="snippet clickable-snippet" data-snippet="${snippet}" data-type="positive" data-keyword="${keyword.keyword}">
                                                            "${snippet}"
                                                            <span class="snippet-hint">Click to find in reviews</span>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                                <button class="expand-btn" data-target="positive-snippets-more-${keywordIndex}" data-original-color="#28a745" style="margin-top: 8px; background: none; border: 1px solid #28a745; color: #28a745; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s;">
                                                    Show ${Math.min(positiveLimited.length - 3, 7)} more
                                                </button>
                                            ` : ''}
                                        </div>
                                    ` : ''}
                                    ${negativeLimited.length > 0 ? `
                                        <div class="snippets negative-snippets">
                                            <strong style="color: #dc3545;">👎 Negative:</strong>
                                            <div class="snippet-list" id="negative-snippets-${keywordIndex}">
                                                ${negativeLimited.slice(0, 3).map((snippet, index) => `
                                                    <div class="snippet clickable-snippet" data-snippet="${snippet}" data-type="negative" data-keyword="${keyword.keyword}">
                                                        "${snippet}"
                                                        <span class="snippet-hint">Click to find in reviews</span>
                                                    </div>
                                                `).join('')}
                                            </div>
                                            ${hasMoreNegative ? `
                                                <div class="snippet-list collapsed" id="negative-snippets-more-${keywordIndex}" style="display: none;">
                                                    ${negativeLimited.slice(3).map((snippet, index) => `
                                                        <div class="snippet clickable-snippet" data-snippet="${snippet}" data-type="negative" data-keyword="${keyword.keyword}">
                                                            "${snippet}"
                                                            <span class="snippet-hint">Click to find in reviews</span>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                                <button class="expand-btn" data-target="negative-snippets-more-${keywordIndex}" data-original-color="#dc3545" style="margin-top: 8px; background: none; border: 1px solid #dc3545; color: #dc3545; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s;">
                                                    Show ${Math.min(negativeLimited.length - 3, 7)} more
                                                </button>
                                            ` : ''}
                                        </div>
                                    ` : ''}
                                    ${positiveLimited.length === 0 && negativeLimited.length === 0 ? `
                                        <div style="color: #6c757d; font-size: 12px; font-style: italic; margin-top: 8px;">
                                            No mentions of this aspect found in reviews
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                                }).join('')}
                </div>
                `}
            </div>

            <!-- Pros and Cons -->
            <div class="pros-cons-section">
                <div class="pros-cons-grid">
                    <div class="pros-column">
                        <h4>👍 Pros</h4>
                        <ul class="pros-list">
                            ${(prosCons.pros || []).map(pro => `<li>${pro}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="cons-column">
                        <h4>👎 Cons</h4>
                        <ul class="cons-list">
                            ${(prosCons.cons || []).map(con => `<li>${con}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Guest Insights -->
            <div class="insights-section">
                <h4>👥 Guest Insights</h4>
                <div class="insights-grid">
                    <div class="insight-card">
                        <h5>✅ Recommended For</h5>
                        <div class="insight-tags">
                            ${(insights.recommended_for || []).map(item => `<span class="tag positive">${item}</span>`).join('')}
                        </div>
                    </div>
                    <div class="insight-card">
                        <h5>❌ Not Recommended For</h5>
                        <div class="insight-tags">
                            ${(insights.not_recommended_for || []).map(item => `<span class="tag negative">${item}</span>`).join('')}
                        </div>
                    </div>
                    <div class="insight-card">
                        <h5>⭐ Best Features</h5>
                        <div class="insight-tags">
                            ${(insights.best_features || []).map(item => `<span class="tag feature">${item}</span>`).join('')}
                        </div>
                    </div>
                    <div class="insight-card">
                        <h5>🔧 Areas for Improvement</h5>
                        <div class="insight-tags">
                            ${(insights.areas_for_improvement || []).map(item => `<span class="tag improvement">${item}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Analysis Info -->
            <div class="analysis-info">
                <small>Analysis based on ${analysis.reviews_analyzed || 0}${analysis.reviews_analyzed < 100 && analysis.reviews_analyzed > 0 ? ' (all available)' : ''} reviews | ${analysis.analysis_type || 'AI-powered'}</small>
            </div>
        </div>
    `;
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'update_side_panel') {
        listingData = message.data;
        renderListingData(listingData);
    } else if (message.type === 'reviews_ready') {
        console.log('SidePanel: Received notification that reviews are ready!', message.reviews?.length);
        if (message.reviews) {
            // Store reviews in listingData so AI functions can access them
            if (!listingData) {
                listingData = {};
            }
            listingData.reviews = message.reviews;
            console.log('SidePanel: Stored reviews in listingData:', listingData.reviews?.length);
            updateReviewsSection(message.reviews);
        }
    }
});

// Request data when side panel loads
document.addEventListener('DOMContentLoaded', () => {
    showLoading();
    
    // Set up refresh button listener
    setTimeout(() => {
        const refreshBtn = document.getElementById('refresh-reviews-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                console.log('SidePanel: Manual refresh button clicked (DOMContentLoaded - FORCE REFRESH)');
                this.textContent = '🔄 Refreshing...';
                this.disabled = true;
                loadReviewsAsync(true).finally(() => {  // true = force refresh
                    this.textContent = '🔄 Refresh Reviews';
                    this.disabled = false;
                });
            });
        }
    }, 500);
    
    // Try to get data from service worker
    chrome.runtime.sendMessage({ type: 'get_listing_data' }, (response) => {
        if (chrome.runtime.lastError) {
            showError('Unable to communicate with extension. Please refresh the page and try again.');
            return;
        }
        
        if (response && response.data) {
            listingData = response.data;
            renderListingData(listingData);
        } else {
            showError('No listing data available. Please click the TravanaSpot button on an Airbnb listing page.');
        }
    });
});

// Handle window focus to refresh data
window.addEventListener('focus', () => {
    if (!listingData) {
        chrome.runtime.sendMessage({ type: 'get_listing_data' }, (response) => {
            if (response && response.data) {
                listingData = response.data;
                renderListingData(listingData);
            }
        });
    }
});

// Little Airby Integration
let geminiAI = null;
    


// Initialize Little Airby assistant
function initGeminiAI() {
    try {
        if (window.TravanaSpotGeminiAI) {
            geminiAI = new window.TravanaSpotGeminiAI();
            console.log('SidePanel: Little Airby (Gemini AI) initialized');
        } else {
            console.error('SidePanel: Little Airby (TravanaSpotGeminiAI) not available');
        }
    } catch (error) {
        console.error('SidePanel: Failed to initialize Little Airby:', error);
    }
}

// Handle Little Airby analysis
async function handleAIAnalysis() {
    if (!geminiAI) {
        console.log('SidePanel: Gemini AI not initialized');
        return;
    }

    const analysisDiv = document.getElementById('ai-analysis');
    const analyzeBtn = document.getElementById('ai-analyze-btn');
    
    try {
        analyzeBtn.classList.add('analyzing');
        analyzeBtn.disabled = true;
        analysisDiv.style.display = 'block';
        analysisDiv.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>🧸 Little Airby is thinking...</p>
                <p style="font-size: 12px; color: #666;">Little Airby is carefully reading each review</p>
                <small>This may take 10-30 seconds for comprehensive analysis</small>
            </div>
        `;

        // Get current reviews from the page
        const reviews = await getCurrentReviews();
        
        if (!reviews || reviews.length === 0) {
            analysisDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p>❌ No reviews available for Little Airby to analyze.</p>
                    <p style="font-size: 12px; color: #666;">
                        Please collect reviews first by clicking "🔄 Refresh Reviews" 
                        or ensure you're on an Airbnb listing page with reviews.
                    </p>
                </div>
            `;
            return;
        }

        const analysis = await geminiAI.analyzeReviews(reviews);
        
        // Store the analysis globally for email functionality
        currentAnalysis = analysis;
        
        console.log('SidePanel: Analysis result type:', typeof analysis);
        console.log('SidePanel: Analysis result:', analysis);
        
        // Check if analysis is a string (old format) or object (new format)
        if (typeof analysis === 'string') {
            console.log('SidePanel: Using old string format');
            analysisDiv.innerHTML = `
                <h4>🧸 Little Airby's Analysis Results</h4>
                <div style="white-space: pre-wrap; font-size: 12px;">${analysis}</div>
            `;
        } else {
            console.log('SidePanel: Using new comprehensive format');
            analysisDiv.innerHTML = generateComprehensiveAnalysisHTML(analysis);

            // Add click handlers for snippet navigation
            setupSnippetClickHandlers();

            // Setup Text-to-Speech for summary
            setupTextToSpeech();
        }

    } catch (error) {
        console.error('SidePanel: Little Airby analysis failed:', error);
        console.error('SidePanel: Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        let errorMessage = error.message;
        if (error.message.includes('HTTP error! status: 400')) {
            errorMessage = 'API request format error - check console for details';
        } else if (error.message.includes('HTTP error! status: 401')) {
            errorMessage = 'API key authentication failed';
        } else if (error.message.includes('HTTP error! status: 403')) {
            errorMessage = 'API access denied - check API key and permissions';
        } else if (error.message.includes('HTTP error! status: 429')) {
            errorMessage = 'API rate limit exceeded - try again later';
        } else if (error.message.includes('HTTP error! status: 500')) {
            errorMessage = 'API server error - try again later';
        }
        
        analysisDiv.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p>❌ Little Airby Analysis Error</p>
                <p style="font-size: 12px; color: #666;">${errorMessage}</p>
                <p style="font-size: 10px; color: #999;">Check browser console for detailed error logs</p>
            </div>
        `;
    } finally {
        analyzeBtn.classList.remove('analyzing');
        analyzeBtn.disabled = false;
    }
}

// Handle Little Airby summary generation
async function handleAISummary() {
    if (!geminiAI) {
        console.log('SidePanel: Gemini AI not initialized');
        return;
    }

    const analysisDiv = document.getElementById('ai-analysis');
    const summaryBtn = document.getElementById('ai-summary-btn');
    
    try {
        summaryBtn.classList.add('analyzing');
        summaryBtn.disabled = true;
        analysisDiv.style.display = 'block';
        analysisDiv.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Generating summary...</p>
            </div>
        `;

        const reviews = await getCurrentReviews();
        
        if (!reviews || reviews.length === 0) {
            analysisDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p>❌ No reviews available for summary.</p>
                    <p style="font-size: 12px; color: #666;">
                        Please collect reviews first by clicking "🔄 Refresh Reviews" 
                        or ensure you're on an Airbnb listing page with reviews.
                    </p>
                </div>
            `;
            return;
        }

        const summary = await geminiAI.generateSummary(reviews);
        
        // Check if summary is a string (old format) or object (new format)
        if (typeof summary === 'string') {
            analysisDiv.innerHTML = `
                <h4>📝 Little Airby's Summary</h4>
                <div style="white-space: pre-wrap; font-size: 12px;">${summary}</div>
            `;
        } else {
            // New comprehensive analysis format
            analysisDiv.innerHTML = generateComprehensiveAnalysisHTML(summary);
        }

    } catch (error) {
        console.error('SidePanel: Little Airby summary failed:', error);
        console.error('SidePanel: Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        let errorMessage = error.message;
        if (error.message.includes('HTTP error! status: 400')) {
            errorMessage = 'API request format error - check console for details';
        } else if (error.message.includes('HTTP error! status: 401')) {
            errorMessage = 'API key authentication failed';
        } else if (error.message.includes('HTTP error! status: 403')) {
            errorMessage = 'API access denied - check API key and permissions';
        } else if (error.message.includes('HTTP error! status: 429')) {
            errorMessage = 'API rate limit exceeded - try again later';
        } else if (error.message.includes('HTTP error! status: 500')) {
            errorMessage = 'API server error - try again later';
        }
        
        analysisDiv.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p>❌ Little Airby Summary Error</p>
                <p style="font-size: 12px; color: #666;">${errorMessage}</p>
                <p style="font-size: 10px; color: #999;">Check browser console for detailed error logs</p>
            </div>
        `;
    } finally {
        summaryBtn.classList.remove('analyzing');
        summaryBtn.disabled = false;
    }
}

// Handle Little Airby question asking
async function handleAIQuestion() {
    console.log('SidePanel: handleAIQuestion called');
    console.log('SidePanel: Little Airby initialized:', !!geminiAI);
    
    if (!geminiAI) {
        console.log('SidePanel: Gemini AI not initialized');
        alert('Little Airby not initialized. Please try refreshing the page.');
        return;
    }

    const questionInput = document.getElementById('ai-question-input');
    const analysisDiv = document.getElementById('ai-analysis');
    const questionBtn = document.getElementById('ai-question-btn');
    
    console.log('SidePanel: Question input display:', questionInput?.style.display);
    
    // Toggle question input visibility
    if (questionInput.style.display === 'none') {
        questionInput.style.display = 'block';
        questionInput.focus();
        return;
    }

    const question = questionInput.value.trim();
    if (!question) {
        questionInput.style.display = 'none';
        return;
    }

    try {
        questionBtn.classList.add('analyzing');
        questionBtn.disabled = true;
        
        // Create or get Q&A container - insert it right after the question input
        let qaContainer = document.getElementById('qa-responses');
        if (!qaContainer) {
            console.log('SidePanel: Creating new Q&A responses container');
            qaContainer = document.createElement('div');
            qaContainer.id = 'qa-responses';
            qaContainer.style.cssText = 'margin-top: 16px;';
            
            // Insert after the question input
            const questionInput = document.getElementById('ai-question-input');
            if (questionInput && questionInput.parentNode) {
                console.log('SidePanel: Inserting Q&A container after question input');
                questionInput.parentNode.insertBefore(qaContainer, questionInput.nextSibling);
            } else {
                // Fallback: insert after ai-controls
                const aiControls = document.querySelector('.ai-controls');
                if (aiControls && aiControls.parentNode) {
                    aiControls.parentNode.insertBefore(qaContainer, aiControls.nextSibling);
                }
            }
        } else {
            console.log('SidePanel: Q&A container already exists');
        }
        
        // Show loading in Q&A container
        qaContainer.innerHTML = `
            <div class="loading" style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin: 0;">
                <div class="spinner" style="width: 30px; height: 30px; margin: 0 auto 10px;"></div>
                <p style="margin: 0; font-size: 13px;">Little Airby is thinking about your question...</p>
            </div>
        `;

        const reviews = await getCurrentReviews();
        
        if (!reviews || reviews.length === 0) {
            qaContainer.innerHTML = `
                <div class="qa-response" style="background: #fff3cd; padding: 16px; border-radius: 8px; border: 1px solid #ffeaa7; margin-top: 12px;">
                    <p style="margin: 0; color: #856404; font-weight: bold;">❌ No reviews available</p>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
                        Please collect reviews first by clicking "🔄 Refresh Reviews" 
                        or ensure you're on an Airbnb listing page with reviews.
                    </p>
                </div>
            `;
            questionBtn.classList.remove('analyzing');
            questionBtn.disabled = false;
            return;
        }

        // Pass listing data along with the question for better context
        const contextData = {
            location: listingData?.location || null,
            title: listingData?.title || null
        };
        
        const result = await geminiAI.askQuestion(reviews, question, contextData);
        
        // Debug log the result
        console.log('SidePanel: Q&A result type:', typeof result);
        console.log('SidePanel: Q&A result:', result);
        
        // Extract the answer text
        let answerText = '';
        if (typeof result === 'string') {
            answerText = result;
        } else if (result && typeof result === 'object') {
            answerText = result.summary || 'No answer available';
        } else {
            answerText = 'Unable to get response from Little Airby';
        }
        
        console.log('SidePanel: Answer text:', answerText);
        console.log('SidePanel: Answer text length:', answerText.length);
        
        // If answer is empty, provide a fallback
        if (!answerText || answerText.trim() === '') {
            answerText = '🤔 Little Airby received your question but couldn\'t generate a response. Please try asking again!';
        }
        
        // Create Q&A response element with compact design
        const qaResponse = `
            <div class="qa-response" style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-top: 12px;">
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="color: #ff385c; font-size: 14px;">💬</span>
                        <span style="color: #495057; font-size: 13px; font-style: italic;">"${escapeHtml(question)}"</span>
                    </div>
                </div>
                <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e9ecef;">
                    <div style="display: flex; align-items: flex-start; gap: 8px;">
                        <span style="font-size: 16px;">🧸</span>
                        <div style="flex: 1;">
                            <div style="color: #495057; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">
                                ${escapeHtml(answerText)}
                            </div>
                        </div>
                    </div>
                </div>
                <div style="text-align: right; margin-top: 8px;">
                    <small style="color: #999; font-size: 11px;">${new Date().toLocaleTimeString()}</small>
                </div>
            </div>
        `;
        
        // Clear loading and add the new response
        qaContainer.innerHTML = qaResponse;
        
        // Make sure the container is visible
        qaContainer.style.display = 'block';
        
        // Show clear Q&A button
        const clearBtn = document.getElementById('clear-qa-btn');
        if (clearBtn) {
            clearBtn.style.display = 'inline-flex';
        }

        questionInput.value = '';
        questionInput.style.display = 'none';

    } catch (error) {
        console.error('SidePanel: Little Airby question failed:', error);
        console.error('SidePanel: Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        let errorMessage = error.message;
        if (error.message.includes('HTTP error! status: 400')) {
            errorMessage = 'API request format error - check console for details';
        } else if (error.message.includes('HTTP error! status: 401')) {
            errorMessage = 'API key authentication failed';
        } else if (error.message.includes('HTTP error! status: 403')) {
            errorMessage = 'API access denied - check API key and permissions';
        } else if (error.message.includes('HTTP error! status: 429')) {
            errorMessage = 'API rate limit exceeded - try again later';
        } else if (error.message.includes('HTTP error! status: 500')) {
            errorMessage = 'API server error - try again later';
        }
        
        // Use Q&A responses container for error display
        let qaContainer = document.getElementById('qa-responses');
        if (!qaContainer) {
            qaContainer = document.createElement('div');
            qaContainer.id = 'qa-responses';
            qaContainer.style.cssText = 'margin-top: 16px;';
            
            // Insert after the question input
            const questionInput = document.getElementById('ai-question-input');
            if (questionInput && questionInput.parentNode) {
                questionInput.parentNode.insertBefore(qaContainer, questionInput.nextSibling);
            } else {
                // Fallback: insert after ai-controls
                const aiControls = document.querySelector('.ai-controls');
                if (aiControls && aiControls.parentNode) {
                    aiControls.parentNode.insertBefore(qaContainer, aiControls.nextSibling);
                }
            }
        }
        
        qaContainer.innerHTML = `
            <div class="qa-response" style="background: #fee; padding: 16px; border-radius: 8px; border: 1px solid #f5c6cb; margin-top: 12px;">
                <p style="margin: 0; color: #c33; font-weight: bold;">❌ Little Airby Question Error</p>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">${errorMessage}</p>
                <p style="margin: 5px 0 0 0; font-size: 10px; color: #999;">Check browser console for detailed error logs</p>
            </div>
        `;
    } finally {
        questionBtn.classList.remove('analyzing');
        questionBtn.disabled = false;
    }
}

// Handle email sending
async function handleEmailSend() {
    const emailInput = document.getElementById('email-input');
    const email = emailInput.value.trim();
    const emailContainer = document.getElementById('email-input-container');
    const sendBtn = document.getElementById('send-email-btn');
    
    if (!email || !email.includes('@')) {
        alert('Please enter a valid email address');
        return;
    }
    
    // Check if we have analysis data
    if (!currentAnalysis) {
        alert('Please wait for the analysis to complete first');
        return;
    }
    
    try {
        sendBtn.disabled = true;
        sendBtn.textContent = '📤 Sending...';
        
        // Create email sender instance
        const emailSender = new EmailSender();
        
        // Send the email with current data
        const result = await emailSender.sendAnalysisEmail(
            email,
            listingData || {},
            currentAnalysis,
            listingData?.reviews || []
        );
        
        if (result.success) {
            // Show success message
            emailContainer.innerHTML = `
                <div style="background: #d4edda; color: #155724; padding: 12px; border-radius: 6px; text-align: center;">
                    <p style="margin: 0; font-weight: bold;">✅ Email sent successfully!</p>
                    <p style="margin: 5px 0 0 0; font-size: 12px;">Check your inbox at ${escapeHtml(email)}</p>
                </div>
            `;
            
            // Hide after 3 seconds
            setTimeout(() => {
                emailContainer.style.display = 'none';
                emailContainer.innerHTML = `
                    <input type="email" id="email-input" class="ai-question-input" placeholder="Enter your email address to receive the analysis..." style="display: block;">
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button id="send-email-btn" class="ai-btn" style="background: #28a745; font-size: 12px; padding: 6px 12px;">
                            ✉️ Send
                        </button>
                        <button id="cancel-email-btn" class="ai-btn" style="background: #6c757d; font-size: 12px; padding: 6px 12px;">
                            Cancel
                        </button>
                    </div>
                `;
                // Re-setup listeners
                setupAIListeners();
            }, 3000);
        } else {
            throw new Error(result.error?.message || 'Failed to send email');
        }
    } catch (error) {
        console.error('SidePanel: Email sending failed:', error);
        alert(`Failed to send email: ${error.message}`);
        sendBtn.disabled = false;
        sendBtn.textContent = '✉️ Send';
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Get current reviews from the page
async function getCurrentReviews() {
    try {
        console.log('SidePanel: Getting current reviews...');
        console.log('SidePanel: listingData exists:', !!listingData);
        console.log('SidePanel: listingData.reviews exists:', !!(listingData && listingData.reviews));
        console.log('SidePanel: Current reviews count:', listingData?.reviews?.length || 0);
        
        // Try to get reviews from the current listing data
        if (listingData && listingData.reviews && listingData.reviews.length > 0) {
            console.log('SidePanel: Returning reviews from listingData:', listingData.reviews.length);
            return listingData.reviews;
        }
        
        console.log('SidePanel: No reviews in listingData, requesting from content script...');

        // If not available, request from content script using chrome.tabs.sendMessage
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
            console.error('SidePanel: No active tab found');
            return [];
        }

        console.log('SidePanel: Sending extract_reviews to tab:', tabs[0].id);

        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'extract_reviews' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('SidePanel: Error sending message to content script:', chrome.runtime.lastError);
                    resolve([]);
                    return;
                }

                console.log('SidePanel: Content script response:', response);
                if (response && response.reviews && response.reviews.length > 0) {
                    console.log('SidePanel: Got reviews from content script:', response.reviews.length);
                    // Store the reviews in listingData for future use
                    if (!listingData) {
                        listingData = {};
                    }
                    listingData.reviews = response.reviews;
                    resolve(response.reviews);
                } else {
                    console.log('SidePanel: No reviews available from content script');
                    resolve([]);
                }
            });
        });
    } catch (error) {
        console.error('SidePanel: Failed to get reviews:', error);
        return [];
    }
}

// Set up Little Airby event listeners
function setupAIListeners() {
    const questionBtn = document.getElementById('ai-question-btn');
    const questionInput = document.getElementById('ai-question-input');
    const emailBtn = document.getElementById('email-analysis-btn');
    const emailContainer = document.getElementById('email-input-container');
    const emailInput = document.getElementById('email-input');
    const sendEmailBtn = document.getElementById('send-email-btn');
    const cancelEmailBtn = document.getElementById('cancel-email-btn');

    console.log('SidePanel: Setting up Little Airby listeners...');
    console.log('SidePanel: Question button found:', !!questionBtn);
    console.log('SidePanel: Question input found:', !!questionInput);
    console.log('SidePanel: Email button found:', !!emailBtn);

    if (questionBtn) {
        questionBtn.addEventListener('click', () => {
            console.log('SidePanel: Ask Question button clicked');
            handleAIQuestion();
        });
        console.log('SidePanel: Click listener added to question button');
    }
    
    if (questionInput) {
        questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('SidePanel: Enter key pressed in question input');
                handleAIQuestion();
            }
        });
    }
    
    // Email functionality
    if (emailBtn) {
        emailBtn.addEventListener('click', () => {
            console.log('SidePanel: Email button clicked');
            // Hide question input if visible
            questionInput.style.display = 'none';
            // Toggle email input
            if (emailContainer.style.display === 'none') {
                emailContainer.style.display = 'block';
                emailInput.focus();
            } else {
                emailContainer.style.display = 'none';
            }
        });
    }
    
    // Clear Q&A button functionality
    const clearQABtn = document.getElementById('clear-qa-btn');
    if (clearQABtn) {
        clearQABtn.addEventListener('click', () => {
            const qaContainer = document.getElementById('qa-responses');
            if (qaContainer) {
                qaContainer.remove();
                clearQABtn.style.display = 'none';
            }
        });
    }
    
    if (sendEmailBtn) {
        sendEmailBtn.addEventListener('click', () => {
            handleEmailSend();
        });
    }
    
    if (cancelEmailBtn) {
        cancelEmailBtn.addEventListener('click', () => {
            emailContainer.style.display = 'none';
            emailInput.value = '';
        });
    }
    
    if (emailInput) {
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleEmailSend();
            }
        });
    }
}

// Setup click handlers for snippet navigation
function setupSnippetClickHandlers() {
    const clickableSnippets = document.querySelectorAll('.clickable-snippet');
    
    clickableSnippets.forEach(snippet => {
        snippet.addEventListener('click', function() {
            const snippetText = this.getAttribute('data-snippet');
            const keyword = this.getAttribute('data-keyword');
            const type = this.getAttribute('data-type');
            
            console.log('SidePanel: Snippet clicked:', {
                snippet: snippetText,
                keyword: keyword,
                type: type
            });
            
            // Find and highlight the corresponding review
            findAndHighlightReview(snippetText, keyword, type);
        });
    });
    
    // Also setup expand/collapse button handlers
    const expandButtons = document.querySelectorAll('.expand-btn');
    console.log('SidePanel: Found', expandButtons.length, 'expand buttons');
    
    expandButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            console.log('SidePanel: Expand button clicked for:', targetId);
            window.toggleSnippets(targetId, this);
        });
    });
}

// Find and highlight the review containing the snippet
function findAndHighlightReview(snippetText, keyword, type) {
    const reviewsSection = document.querySelector('.reviews-section');
    if (!reviewsSection) {
        console.log('SidePanel: Reviews section not found');
        return;
    }

    const reviewItems = reviewsSection.querySelectorAll('.review-item');
    let foundReview = null;
    let bestMatch = null;
    let bestMatchScore = 0;

    // First, remove any existing highlights
    reviewItems.forEach(item => {
        item.classList.remove('highlighted-review');
    });

    // Search for the snippet in reviews
    reviewItems.forEach((reviewItem, index) => {
        const reviewText = reviewItem.querySelector('.review-text')?.textContent || '';
        
        // Check for exact match first
        if (reviewText.includes(snippetText)) {
            foundReview = reviewItem;
            console.log('SidePanel: Found exact match in review', index + 1);
            return;
        }
        
        // Check for partial match (for shorter snippets)
        const words = snippetText.toLowerCase().split(' ').filter(word => word.length > 3);
        let matchScore = 0;
        
        words.forEach(word => {
            if (reviewText.toLowerCase().includes(word)) {
                matchScore++;
            }
        });
        
        if (matchScore > bestMatchScore && matchScore > 0) {
            bestMatchScore = matchScore;
            bestMatch = reviewItem;
        }
    });

    // Highlight the found review
    const reviewToHighlight = foundReview || bestMatch;
    
    if (reviewToHighlight) {
        // Add highlight class
        reviewToHighlight.classList.add('highlighted-review');
        
        // Scroll to the review
        reviewToHighlight.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
        
        // Show a brief notification
        showSnippetNotification(snippetText, keyword, type);
        
        console.log('SidePanel: Highlighted review for snippet:', snippetText);
    } else {
        console.log('SidePanel: No matching review found for snippet:', snippetText);
        showSnippetNotification(snippetText, keyword, type, true);
    }
}

// Show notification for snippet navigation
function showSnippetNotification(snippetText, keyword, type, notFound = false) {
    // Remove any existing notification
    const existingNotification = document.querySelector('.snippet-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'snippet-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${notFound ? '#f8d7da' : '#d4edda'};
        color: ${notFound ? '#721c24' : '#155724'};
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid ${notFound ? '#f5c6cb' : '#c3e6cb'};
        font-size: 12px;
        max-width: 300px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;

    const icon = notFound ? '⚠️' : '🔍';
    const message = notFound 
        ? `Snippet not found in reviews: "${snippetText.substring(0, 50)}..."`
        : `Found in reviews: "${snippetText.substring(0, 50)}..."`;

    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span>${icon}</span>
            <div>
                <strong>${keyword}</strong> (${type})
                <br>
                <small>${message}</small>
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
}

// Flag to prevent duplicate auto-triggers
let autoAnalysisTriggered = false;

// Auto-trigger comprehensive analysis
async function autoTriggerAnalysis(reviews) {
    if (!geminiAI) {
        console.log('SidePanel: Little Airby not initialized for auto-analysis');
        return;
    }

    // Prevent duplicate auto-triggers
    if (autoAnalysisTriggered) {
        console.log('SidePanel: Auto-analysis already triggered, skipping duplicate call');
        return;
    }

    const analysisDiv = document.getElementById('ai-analysis');
    if (!analysisDiv) {
        console.log('SidePanel: Analysis div not found');
        return;
    }

    try {
        // Mark as triggered to prevent duplicates
        autoAnalysisTriggered = true;
        console.log('SidePanel: Starting auto-analysis with', reviews.length, 'reviews');
        
        // Show loading state with spinning wheel
        analysisDiv.style.display = 'block';
        analysisDiv.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>🧸 Little Airby is thinking...</p>
                <p style="font-size: 12px; color: #666;">Little Airby is analyzing ${reviews.length} reviews</p>
                <small>This may take 10-30 seconds for comprehensive analysis</small>
            </div>
        `;

        // Perform comprehensive analysis
        const analysis = await geminiAI.analyzeReviews(reviews);
        
        // Store the analysis globally for email functionality
        currentAnalysis = analysis;
        
        console.log('SidePanel: Auto-analysis completed');
        console.log('SidePanel: Analysis result type:', typeof analysis);
        
        // Check if analysis is a string (old format) or object (new format)
        if (typeof analysis === 'string') {
            console.log('SidePanel: Using old string format for auto-analysis');
            analysisDiv.innerHTML = `
                <h4>🧸 Little Airby's Auto-Generated Analysis</h4>
                <div style="white-space: pre-wrap; font-size: 12px;">${analysis}</div>
            `;
        } else {
            console.log('SidePanel: Using new comprehensive format for auto-analysis');
            analysisDiv.innerHTML = generateComprehensiveAnalysisHTML(analysis);

            // Add click handlers for snippet navigation
            setupSnippetClickHandlers();

            // Setup Text-to-Speech for summary
            setupTextToSpeech();
        }

        // Show success notification
        showAutoAnalysisNotification(reviews.length, analysis.analysis_type);

    } catch (error) {
        console.error('SidePanel: Little Airby auto-analysis failed:', error);
        console.error('SidePanel: Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        // Only show error if it's a real failure, not "already in progress"
        if (!error.message.includes('already in progress')) {
            let errorDetail = 'Unable to complete automatic analysis';
            
            // Provide more specific error messages
            if (error.message.includes('No reviews to analyze')) {
                errorDetail = 'No reviews available for analysis';
            } else if (error.message.includes('API key')) {
                errorDetail = 'API key issue detected';
            } else if (error.message.includes('HTTP error')) {
                errorDetail = 'Network or API error occurred';
            }
            
            // Extract more detailed error information
            let technicalDetails = '';
            if (error.stack) {
                const relevantStack = error.stack.split('\n').slice(0, 3).join('\n');
                technicalDetails = relevantStack;
            }
            
            analysisDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p>⚠️ Analysis Error</p>
                    <p style="font-size: 12px; color: #666;">${errorDetail}</p>
                    <p style="font-size: 11px; color: #999;">Check browser console for full details</p>
                    <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; text-align: left;">
                        <p style="font-size: 11px; color: #dc3545; margin: 0 0 5px 0;"><strong>Error:</strong> ${error.message}</p>
                        <pre style="font-size: 10px; color: #666; margin: 0; white-space: pre-wrap; word-break: break-all;">${technicalDetails}</pre>
                    </div>
                    <p style="font-size: 10px; color: #999; margin-top: 10px;">Open console (F12) and look for "===== RECEIVED FROM AI =====" to see what the AI returned</p>
                </div>
            `;
        }
    }
}

// Show notification for auto-analysis completion
function showAutoAnalysisNotification(reviewCount, analysisType = 'ai_powered') {
    const notification = document.createElement('div');
    notification.className = 'auto-analysis-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d4edda;
        color: #155724;
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid #c3e6cb;
        font-size: 12px;
        max-width: 300px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;

    const analysisTypeText = (analysisType === 'ai_powered' || analysisType === 'little_airby_powered') ? 'Little Airby Powered' : 'Enhanced Analysis';
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span>🧸</span>
            <div>
                <strong>Auto-Analysis Complete!</strong>
                <br>
                <small>Analyzed ${reviewCount} reviews with ${analysisTypeText}</small>
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ============================================================================
// Text-to-Speech Functionality (Web Speech API)
// ============================================================================

let currentSpeechUtterance = null;
let isSpeaking = false;

function setupTextToSpeech() {
    const ttsButton = document.getElementById('tts-button');
    const summaryText = document.getElementById('summary-text');

    if (!ttsButton || !summaryText) {
        console.log('TTS: Button or summary text not found');
        return;
    }

    // Check if browser supports Speech Synthesis
    if (!('speechSynthesis' in window)) {
        console.warn('TTS: Speech Synthesis not supported in this browser');
        ttsButton.style.display = 'none';
        return;
    }

    console.log('TTS: Setting up Text-to-Speech functionality');

    ttsButton.addEventListener('click', () => {
        if (isSpeaking) {
            stopSpeech();
        } else {
            startSpeech(summaryText.textContent);
        }
    });
}

function startSpeech(text) {
    console.log('TTS: Starting speech synthesis');

    // Stop any ongoing speech
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }

    // Create new speech utterance
    currentSpeechUtterance = new SpeechSynthesisUtterance(text);

    // Configure speech parameters
    currentSpeechUtterance.rate = 1.0;  // Speed (0.1 to 10)
    currentSpeechUtterance.pitch = 1.0; // Pitch (0 to 2)
    currentSpeechUtterance.volume = 1.0; // Volume (0 to 1)
    currentSpeechUtterance.lang = 'en-US'; // Language

    // Event handlers
    currentSpeechUtterance.onstart = () => {
        console.log('TTS: Speech started');
        isSpeaking = true;
        updateTTSButton('pause');
    };

    currentSpeechUtterance.onend = () => {
        console.log('TTS: Speech ended');
        isSpeaking = false;
        updateTTSButton('play');
    };

    currentSpeechUtterance.onerror = (event) => {
        console.error('TTS: Speech error:', event.error);
        isSpeaking = false;
        updateTTSButton('play');
    };

    // Start speaking
    window.speechSynthesis.speak(currentSpeechUtterance);
}

function stopSpeech() {
    console.log('TTS: Stopping speech synthesis');

    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }

    isSpeaking = false;
    updateTTSButton('play');
}

function updateTTSButton(state) {
    const ttsIcon = document.getElementById('tts-icon');
    const ttsText = document.getElementById('tts-text');
    const ttsButton = document.getElementById('tts-button');

    if (!ttsIcon || !ttsText || !ttsButton) return;

    if (state === 'pause') {
        ttsIcon.textContent = '⏸️';
        ttsText.textContent = 'Stop';
        ttsButton.style.background = '#f44336'; // Red
    } else {
        ttsIcon.textContent = '🔊';
        ttsText.textContent = 'Read Aloud';
        ttsButton.style.background = '#4CAF50'; // Green
    }
}

// Clean up speech when page unloads
window.addEventListener('beforeunload', () => {
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
});

// Initialize functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize after a short delay to ensure scripts are loaded
    setTimeout(() => {
        initGeminiAI();
        setupAIListeners();
    }, 1000);
}); 