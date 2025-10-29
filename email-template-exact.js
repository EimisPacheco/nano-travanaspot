// Email template generator for TravanaSpot - EXACT panel copy
function generateEmailHTML(listingData, analysis, reviews) {
  // Helper function to escape HTML
  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const sentiment = analysis.sentiment_analysis || {};
  const keywords = analysis.keyword_analysis || [];
  const prosCons = analysis.pros_and_cons || {};
  const insights = analysis.guest_insights || {};

  // Main email template - copying exact panel structure
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TravanaSpot - Little Airby Review Analysis</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🏠 TravanaSpot</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Airbnb Listing Reviews Sentiment Analysis</p>
        </div>
        
        <!-- Listing Info -->
        <div style="background: white; padding: 20px; border-bottom: 2px solid #f0f0f0;">
          <h2 style="color: #333; margin: 0 0 10px 0; font-size: 20px;">${escapeHtml(listingData.title || 'Airbnb Listing')}</h2>
          <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap; color: #666; font-size: 14px;">
            ${listingData.rating ? `<span>⭐ ${escapeHtml(listingData.rating)} stars</span>` : ''}
            ${listingData.reviewCount ? `<span>💬 ${escapeHtml(listingData.reviewCount)} reviews</span>` : ''}
            ${listingData.price ? `<span>💰 ${escapeHtml(listingData.price)}</span>` : ''}
            ${listingData.location ? `<span>📍 ${escapeHtml(listingData.location)}</span>` : ''}
          </div>
        </div>
        
        <!-- Main Content -->
        <div style="background: white; padding: 20px;">
          
          <!-- Header with Trust Score -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #2c3e50; font-size: 18px;">🧸 Little Airby's Sweet Insights</h3>
            ${analysis.trust_score ? `
              <div style="background: #f8f9fa; padding: 5px 10px; border-radius: 15px; font-size: 12px;">
                <span style="color: #6c757d;">Trust Score:</span>
                <span style="font-weight: bold; color: #28a745;">${analysis.trust_score}/100</span>
              </div>
            ` : ''}
          </div>
          
          <!-- Overall Summary -->
          ${analysis.summary ? `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; margin-bottom: 20px;">
              <p style="margin: 0; color: #495057; line-height: 1.5;">${escapeHtml(analysis.summary)}</p>
            </div>
          ` : ''}
          
          <!-- Sentiment Analysis -->
          <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 14px; font-weight: 600;">📊 Guest Sentiment</h4>
            <div>
              <!-- Positive -->
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="width: 20px; text-align: center;">📈</span>
                <span style="width: 60px; font-weight: 500; font-size: 12px;">Positive</span>
                <div style="flex: 1; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; margin: 0 10px;">
                  <div style="height: 100%; background: #28a745; width: ${sentiment.positive_percentage || 0}%; border-radius: 4px;"></div>
                </div>
                <span style="width: 35px; text-align: right; font-weight: bold; font-size: 12px;">${Math.round(sentiment.positive_percentage || 0)}%</span>
              </div>
              <!-- Neutral -->
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="width: 20px; text-align: center;">➖</span>
                <span style="width: 60px; font-weight: 500; font-size: 12px;">Neutral</span>
                <div style="flex: 1; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; margin: 0 10px;">
                  <div style="height: 100%; background: #6c757d; width: ${sentiment.neutral_percentage || 0}%; border-radius: 4px;"></div>
                </div>
                <span style="width: 35px; text-align: right; font-weight: bold; font-size: 12px;">${Math.round(sentiment.neutral_percentage || 0)}%</span>
              </div>
              <!-- Negative -->
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="width: 20px; text-align: center;">📉</span>
                <span style="width: 60px; font-weight: 500; font-size: 12px;">Negative</span>
                <div style="flex: 1; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; margin: 0 10px;">
                  <div style="height: 100%; background: #dc3545; width: ${sentiment.negative_percentage || 0}%; border-radius: 4px;"></div>
                </div>
                <span style="width: 35px; text-align: right; font-weight: bold; font-size: 12px;">${Math.round(sentiment.negative_percentage || 0)}%</span>
              </div>
            </div>
          </div>
          
          <!-- Top Highlights -->
          ${keywords && keywords.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 5px 0; color: #2c3e50; font-size: 14px; font-weight: 600;">🔍 Top Highlights</h4>
            <p style="margin: 0 0 15px 0; color: #6c757d; font-size: 11px; font-style: italic;">Key aspects mentioned in reviews</p>
            <div>
              ${keywords.slice(0, 5).map(keyword => `
                <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; color: #2c3e50; text-transform: capitalize; font-size: 13px;">${escapeHtml(keyword.keyword)}</span>
                    <span style="font-size: 11px;">
                      <span style="color: #28a745;">${keyword.positive} positive</span>
                      ${keyword.negative > 0 ? `<span style="color: #dc3545; margin-left: 8px;">${keyword.negative} negative</span>` : ''}
                    </span>
                  </div>
                  ${keyword.positive_snippets && keyword.positive_snippets.length > 0 ? `
                    <div style="margin-bottom: 8px;">
                      <strong style="color: #28a745; font-size: 11px;">👍 Positive:</strong>
                      ${keyword.positive_snippets.slice(0, 3).map(snippet => `
                        <div style="background: #f8f9fa; padding: 4px 8px; margin: 4px 0; border-radius: 4px; border-left: 3px solid #007bff; font-style: italic; font-size: 11px; color: #495057;">
                          "${escapeHtml(snippet)}"
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                  ${keyword.negative_snippets && keyword.negative_snippets.length > 0 ? `
                    <div>
                      <strong style="color: #dc3545; font-size: 11px;">👎 Negative:</strong>
                      ${keyword.negative_snippets.slice(0, 3).map(snippet => `
                        <div style="background: #f8f9fa; padding: 4px 8px; margin: 4px 0; border-radius: 4px; border-left: 3px solid #dc3545; font-style: italic; font-size: 11px; color: #495057;">
                          "${escapeHtml(snippet)}"
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          <!-- Pros and Cons -->
          <div style="margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 50%; vertical-align: top; padding-right: 7.5px;">
                  <h4 style="margin: 0 0 10px 0; color: #28a745; font-size: 14px; font-weight: 600;">👍 Pros</h4>
                  <ul style="margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.4;">
                    ${(prosCons.pros || []).map(pro => `
                      <li style="color: #28a745; margin-bottom: 4px;">${escapeHtml(pro)}</li>
                    `).join('')}
                  </ul>
                </td>
                <td style="width: 50%; vertical-align: top; padding-left: 7.5px;">
                  <h4 style="margin: 0 0 10px 0; color: #dc3545; font-size: 14px; font-weight: 600;">👎 Cons</h4>
                  <ul style="margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.4;">
                    ${(prosCons.cons || []).map(con => `
                      <li style="color: #dc3545; margin-bottom: 4px;">${escapeHtml(con)}</li>
                    `).join('')}
                  </ul>
                </td>
              </tr>
            </table>
          </div>
          
          <!-- Guest Insights -->
          <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 14px; font-weight: 600;">👥 Guest Insights</h4>
            <table style="width: 100%; border-collapse: separate; border-spacing: 10px;">
              <tr>
                <td style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 10px; vertical-align: top;">
                  <h5 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #495057;">✅ Recommended For</h5>
                  <div>
                    ${(insights.recommended_for || []).map(item => `
                      <span style="display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 500; background: #d4edda; color: #155724; margin: 2px;">${escapeHtml(item)}</span>
                    `).join('')}
                  </div>
                </td>
                <td style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 10px; vertical-align: top;">
                  <h5 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #495057;">❌ Not Recommended For</h5>
                  <div>
                    ${(insights.not_recommended_for || []).map(item => `
                      <span style="display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 500; background: #f8d7da; color: #721c24; margin: 2px;">${escapeHtml(item)}</span>
                    `).join('')}
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 10px; vertical-align: top;">
                  <h5 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #495057;">⭐ Best Features</h5>
                  <div>
                    ${(insights.best_features || []).map(item => `
                      <span style="display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 500; background: #d1ecf1; color: #0c5460; margin: 2px;">${escapeHtml(item)}</span>
                    `).join('')}
                  </div>
                </td>
                <td style="background: white; border: 1px solid #e9ecef; border-radius: 6px; padding: 10px; vertical-align: top;">
                  <h5 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #495057;">🔧 Areas for Improvement</h5>
                  <div>
                    ${(insights.areas_for_improvement || []).map(item => `
                      <span style="display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 500; background: #fff3cd; color: #856404; margin: 2px;">${escapeHtml(item)}</span>
                    `).join('')}
                  </div>
                </td>
              </tr>
            </table>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; padding-top: 15px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 10px;">
            <p>Analysis based on ${analysis.reviews_analyzed || 0}${analysis.reviews_analyzed < 100 && analysis.reviews_analyzed > 0 ? ' (all available)' : ''} reviews | ${analysis.analysis_type === 'little_airby_powered' ? 'Little Airby Powered' : 'AI-powered'}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateEmailHTML };
}