/**
 * TravanaSpot Chrome Extension - Browser AI Integration
 *
 * Uses Chrome's Built-in AI APIs (Gemini Nano) for analyzing Airbnb reviews
 *
 * ============================================================================
 * TWO-API ARCHITECTURE
 * ============================================================================
 *
 * 1. SUMMARIZER API (Summarizer)
 *    Purpose: Create narrative text summaries from reviews
 *    Use case: Prose descriptions, short concise summaries
 *    Token limit: ~1024 tokens per prompt (~4000 chars)
 *    Strategy: Hierarchical summarization (summary of summaries)
 *    Settings: type='teaser', format='plain-text', length='short'
 *
 * 2. PROMPT API (LanguageModel)
 *    Purpose: Extract structured JSON data from reviews
 *    Use case: keyword_analysis (9 aspects with sentiment), pros/cons, insights
 *    Token management: Uses tokensSoFar/maxTokens, clone() for fresh context
 *    Features: Semantic + keyword matching, JSON schema constraints
 *
 * ============================================================================
 * CRITICAL: CORRECT API INITIALIZATION PATTERNS
 * ============================================================================
 *
 * These patterns MUST be followed exactly per Chrome documentation:
 *
 * SUMMARIZER API:
 *   const options = { sharedContext, type, format, length };
 *   const availability = await Summarizer.availability();
 *   if (availability === 'unavailable') return;
 *   if (navigator.userActivation.isActive) {
 *     const summarizer = await Summarizer.create(options);
 *   }
 *
 * PROMPT API:
 *   const {available, ...} = await LanguageModel.params();
 *   if (available !== "no") {
 *     const session = await LanguageModel.create({systemPrompt});
 *   }
 *
 * KEY RULES:
 * - NEVER use "this.session" or "this.summarizer" during creation
 * - Create in LOCAL variables first
 * - Return for caller to store in class properties
 * - Check availability BEFORE attempting to create
 *
 * ============================================================================
 * REVIEW PROCESSING FLOW
 * ============================================================================
 *
 * 1. Truncate 100 reviews to max 500 chars each
 * 2. SUMMARIZER API: Chunk reviews → summarize chunks → recursive final summary
 * 3. PROMPT API: Clone session → chunk ALL 100 reviews → extract structured data
 * 4. Merge: Combine Summarizer prose + Prompt API structured data
 *
 * CHUNKING STRATEGY:
 * - Summarizer: ~750 tokens per chunk (3000 chars) for optimal quality
 * - Prompt API: Dynamic chunks based on available tokens (typically 10-20 reviews)
 *
 * SEMANTIC + KEYWORD MATCHING:
 * - "immaculate" → Cleanliness (semantic, no "clean" keyword)
 * - "walking distance to subway" → Location (semantic understanding)
 * - Must return ALL 9 aspects: Cleanliness, Location, HostCommunication,
 *   ValueForMoney, AccuracyOfListing, CheckInProcess, NoiseLevels,
 *   Comfort, Amenities
 *
 * ============================================================================
 */

class TravanaSpotBrowserAI {
  constructor() {
    this.languageModelSession = null;
    this.summarizerSession = null;
    this.isAnalyzing = false;

    // Review limits
    this.MAX_CHARS_PER_REVIEW = 500; // Max characters per review

    // In-memory JSON cache of processed reviews
    this.reviewCache = null; // Will store {reviews: [...], metadata: {...}}

    console.log('TravanaSpot: Little Airby (Browser AI) initialized with:', {
      maxCharsPerReview: this.MAX_CHARS_PER_REVIEW
    });
  }

  // Destroy all sessions and free resources
  async destroySessions() {
    console.log('TravanaSpot: Destroying AI sessions...');

    if (this.languageModelSession) {
      try {
        this.languageModelSession.destroy();
        console.log('TravanaSpot: Language Model session destroyed');
      } catch (error) {
        console.error('TravanaSpot: Error destroying Language Model session:', error);
      }
      this.languageModelSession = null;
    }

    if (this.summarizerSession) {
      try {
        this.summarizerSession.destroy();
        console.log('TravanaSpot: Summarizer session destroyed');
      } catch (error) {
        console.error('TravanaSpot: Error destroying Summarizer session:', error);
      }
      this.summarizerSession = null;
    }
  }

  /**
   * Clone Language Model session for fresh context
   *
   * Purpose:
   * - Reset token usage (tokensSoFar) back to 0
   * - Preserve systemPrompt from original session
   * - Avoid hitting maxTokens limit during long operations
   *
   * When to use:
   * - Before processing ALL 100 reviews in chunks (to ensure enough tokens)
   * - When switching between different analysis tasks
   *
   * Pattern:
   * - If session exists: clone() it, destroy old, use new
   * - If no session: create fresh one via initLanguageModelSession()
   */
  async cloneLanguageModelSession() {
    try {
      if (this.languageModelSession) {
        console.log('TravanaSpot: Cloning Language Model session for fresh context...');
        const clonedSession = await this.languageModelSession.clone();

        // Destroy old session to free resources
        this.languageModelSession.destroy();

        // Store cloned session
        this.languageModelSession = clonedSession;
        console.log('TravanaSpot: Language Model session cloned successfully');

        return this.languageModelSession;
      } else {
        // No existing session, create new one
        console.log('TravanaSpot: No existing session to clone, creating new one...');
        this.languageModelSession = await this.initLanguageModelSession();
        return this.languageModelSession;
      }
    } catch (error) {
      console.error('TravanaSpot: Error cloning Language Model session:', error);
      // Fallback: create new session
      this.languageModelSession = await this.initLanguageModelSession();
      return this.languageModelSession;
    }
  }

  /**
   * Initialize Language Model session (Prompt API)
   *
   * CORRECT PATTERN per Chrome Built-in AI documentation:
   * 1. Use LanguageModel.params() to check availability (NOT LanguageModel.availability())
   * 2. Check if available !== "no"
   * 3. Create session in LOCAL variable (no "this." in creation)
   * 4. Return the session for caller to store in this.languageModelSession
   *
   * Used for:
   * - Structured data extraction (keyword_analysis with semantic understanding)
   * - Chatbox question answering
   */
  async initLanguageModelSession() {
    const {available, defaultTemperature, defaultTopK, maxTopK} = await LanguageModel.params();
    console.log('TravanaSpot: Prompt API params:', {
      available,
      defaultTemperature,
      defaultTopK,
      maxTopK
    });

    if (available !== 'no') {
      const session = await LanguageModel.create({
        initialPrompts: [
          {
            role: 'system',
            content:
              'You are Little Airby, a friendly assistant helping travelers understand Airbnb reviews. Read questions CAREFULLY and answer EXACTLY what is asked. Distinguish between questions about the property itself versus the neighborhood around it. Be warm, honest, specific, and concise (2-3 sentences max).'
          },
          {
            role: 'user',
            content: 'What do guests say about the location?'
          },
          {
            role: 'assistant',
            content:
              "Based on the reviews, guests love the location! It's in a great walkable neighborhood with lots of restaurants and shops nearby. Several guests mentioned feeling safe and enjoying the easy access to downtown."
          },
          {
            role: 'user',
            content: 'What kind of food can I find around?'
          },
          {
            role: 'assistant',
            content:
              'Guests mentioned there are Italian restaurants, Mexican taquerias, and BBQ spots within walking distance. Some specifically recommended the pizza place two blocks away and the breakfast cafe on the corner.'
          }
        ]
      });

      console.log(
        'TravanaSpot: Language Model session created successfully with initialPrompts'
      );
      return session;
    } else {
      console.error('TravanaSpot: Prompt API is not available');
      throw new Error('Prompt API is not available. Please use Chrome Canary 128+ with Prompt API enabled.');
    }
  }

  /**
   * Initialize Summarizer session (Summarizer API)
   *
   * CORRECT PATTERN per Chrome Built-in AI documentation:
   * 1. Define options BEFORE checking availability
   * 2. Use Summarizer.availability() to check availability
   * 3. Check if availability === 'unavailable' (if so, throw error to trigger Prompt API fallback)
   * 4. Create summarizer in LOCAL variable (no "this." in creation)
   * 5. Return the summarizer for caller to store in this.summarizerSession
   *
   * Used for:
   * - Creating narrative summaries of review chunks
   * - Hierarchical summarization (summary of summaries)
   * - Generating comprehensive prose from all 100 reviews
   *
   * Settings:
   * - type: 'teaser' - Brief overview style (NOT 'tldr' or 'key-points')
   * - format: 'plain-text' - Plain text output
   * - length: 'short' - Short, concise summaries
   * - sharedContext: Domain context to guide summarization
   */
  async initSummarizerSession() {
    const options = {
      sharedContext:
        'These are Airbnb guest reviews for a vacation rental property. Focus on guest experiences, property quality, host interactions, location benefits, and any issues mentioned.',
      type: 'teaser',
      format: 'plain-text',
      length: 'short',
      outputLanguage: 'en'
    };

    const availability = await Summarizer.availability();
    console.log('TravanaSpot: Summarizer API availability:', availability);

    if (availability === 'unavailable') {
      // The Summarizer API isn't usable.
      console.log("TravanaSpot: Summarizer API is unavailable.");
      throw new Error('SUMMARIZER_UNAVAILABLE');
    }

    // Create the summarizer (availability is 'readily' or 'after-download')
    console.log("TravanaSpot: Initializing Summarizer...");
    const summarizer = await Summarizer.create(options);
    console.log('TravanaSpot: Summarizer session created successfully');
    return summarizer;
  }

  // Truncate review to max characters
  truncateReview(reviewText) {
    if (!reviewText || typeof reviewText !== 'string') return '';

    if (reviewText.length <= this.MAX_CHARS_PER_REVIEW) {
      return reviewText;
    }

    return reviewText.substring(0, this.MAX_CHARS_PER_REVIEW) + '...';
  }

  /**
   * Build in-memory JSON cache of reviews
   *
   * Purpose:
   * - Process and store 100 reviews (truncated to 500 chars each)
   * - Enables sequential search through ALL reviews for chatbox
   * - Avoids re-processing reviews for every question
   *
   * Cache structure:
   * {
   *   reviews: [
   *     {id: 0, text: "truncated review text", original_length: 1200},
   *     {id: 1, text: "truncated review text", original_length: 800},
   *     ...
   *   ],
   *   metadata: {
   *     total_reviews: 100,
   *     cached_at: timestamp,
   *     truncation_limit: 500
   *   }
   * }
   */
  buildReviewCache(reviews) {
    console.log('TravanaSpot: Building in-memory review cache...');

    const reviewsToCache = reviews.slice(0, 100);

    const cachedReviews = reviewsToCache.map((review, index) => {
      const text = (review.text || review.comments || '').trim();
      const truncated = this.truncateReview(text);

      return {
        id: index,
        text: truncated,
        original_length: text.length,
        was_truncated: text.length > this.MAX_CHARS_PER_REVIEW
      };
    }).filter(r => r.text.length > 10); // Remove empty reviews

    this.reviewCache = {
      reviews: cachedReviews,
      metadata: {
        total_reviews: cachedReviews.length,
        cached_at: new Date().toISOString(),
        truncation_limit: this.MAX_CHARS_PER_REVIEW,
        reviews_per_query: 10 // How many reviews to search at a time
      }
    };

    console.log(`TravanaSpot: ✅ Review cache built with ${cachedReviews.length} reviews`);
    console.log(`TravanaSpot: Cache metadata:`, this.reviewCache.metadata);

    return this.reviewCache;
  }

  // Helper: Merge keyword analysis from multiple chunks
  mergeKeywordAnalysis(chunkKeywordArrays) {
    console.log(`TravanaSpot: Merging keyword analysis from ${chunkKeywordArrays.length} chunks`);

    const requiredAspects = ['Cleanliness', 'Location', 'HostCommunication', 'ValueForMoney', 'AccuracyOfListing', 'CheckInProcess', 'NoiseLevels', 'Comfort', 'Amenities'];

    // Initialize merged data for all 9 aspects
    const merged = {};
    requiredAspects.forEach(aspect => {
      merged[aspect] = {
        keyword: aspect,
        positive: 0,
        negative: 0,
        total_mentions: 0,
        positive_snippets: [],
        negative_snippets: []
      };
    });

    // Merge data from all chunks
    chunkKeywordArrays.forEach((chunkKeywords, chunkIndex) => {
      if (!Array.isArray(chunkKeywords)) {
        console.warn(`TravanaSpot: Chunk ${chunkIndex} has invalid keyword_analysis`);
        return;
      }

      chunkKeywords.forEach(item => {
        if (merged[item.keyword]) {
          merged[item.keyword].positive += item.positive || 0;
          merged[item.keyword].negative += item.negative || 0;
          merged[item.keyword].total_mentions += item.total_mentions || 0;

          // Merge snippets (limit to 10 each)
          if (item.positive_snippets) {
            merged[item.keyword].positive_snippets.push(...item.positive_snippets);
          }
          if (item.negative_snippets) {
            merged[item.keyword].negative_snippets.push(...item.negative_snippets);
          }
        }
      });
    });

    // Limit snippets and convert to array
    const result = requiredAspects.map(aspect => {
      const data = merged[aspect];
      return {
        ...data,
        positive_snippets: data.positive_snippets.slice(0, 10),
        negative_snippets: data.negative_snippets.slice(0, 10)
      };
    });

    console.log(`TravanaSpot: Merged result:`, result.map(k => `${k.keyword}(+${k.positive}/-${k.negative})`).join(', '));

    return result;
  }

  // Helper: Extract structured data from a single chunk of reviews
  async extractChunkData(reviewChunk, chunkIndex, totalChunks) {
    try {
      console.log(`TravanaSpot: [Chunk ${chunkIndex + 1}/${totalChunks}] Starting extraction for ${reviewChunk.length} reviews`);

      const schema = {
      type: 'object',
      properties: {
        keyword_analysis: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              keyword: { type: 'string' },
              positive: { type: 'number' },
              negative: { type: 'number' },
              total_mentions: { type: 'number' },
              positive_snippets: { type: 'array', items: { type: 'string' } },
              negative_snippets: { type: 'array', items: { type: 'string' } }
            },
            required: ['keyword', 'positive', 'negative', 'total_mentions', 'positive_snippets', 'negative_snippets']
          }
        },
        pros_and_cons: {
          type: 'object',
          properties: {
            pros: { type: 'array', items: { type: 'string' } },
            cons: { type: 'array', items: { type: 'string' } }
          },
          required: ['pros', 'cons']
        },
        guest_insights: {
          type: 'object',
          properties: {
            recommended_for: { type: 'array', items: { type: 'string' } },
            not_recommended_for: { type: 'array', items: { type: 'string' } },
            best_features: { type: 'array', items: { type: 'string' } },
            areas_for_improvement: { type: 'array', items: { type: 'string' } }
          },
          required: ['recommended_for', 'not_recommended_for', 'best_features', 'areas_for_improvement']
        }
      },
      required: ['keyword_analysis', 'pros_and_cons', 'guest_insights']
    };

      const reviewSample = reviewChunk.join('\n---\n');
      console.log(`TravanaSpot: [Chunk ${chunkIndex + 1}/${totalChunks}] Review sample length: ${reviewSample.length} chars`);

      const prompt = `Analyze these Airbnb reviews using BOTH semantic understanding AND keyword matching. Return ONLY valid JSON.

CRITICAL: You MUST return ALL 9 aspects in keyword_analysis, even if some have 0 mentions.

TASK: Search for these 9 aspects by understanding MEANING (semantic) AND looking for keywords:

1. Cleanliness - KEYWORDS: clean, spotless, tidy, hygiene, dirty, dust, stain, filthy, messy
   SEMANTIC: maintenance quality, organization, freshness

2. Location - KEYWORDS: location, area, convenient, central, far, near, proximity, accessible, neighborhood
   SEMANTIC: travel ease, surroundings, safety

3. HostCommunication - KEYWORDS: host, communication, responsive, helpful, friendly, reach, contact, reply
   SEMANTIC: host interaction quality, availability

4. ValueForMoney - KEYWORDS: value, price, worth, expensive, cheap, overpriced, deal, cost
   SEMANTIC: price fairness, cost-benefit ratio

5. CheckInProcess - KEYWORDS: check-in, arrival, entry, keys, access, instructions, smooth, easy, difficult
   SEMANTIC: arrival experience

6. AccuracyOfListing - KEYWORDS: described, photos, accurate, misleading, expected, shown, reality
   SEMANTIC: expectation vs reality match

7. NoiseLevels - KEYWORDS: noise, noisy, quiet, loud, peaceful, sound, hear, walls, neighbors
   SEMANTIC: sound disturbance, tranquility

8. Comfort - KEYWORDS: comfortable, cozy, bed, mattress, pillow, soft, hard, uncomfortable, temperature, AC
   SEMANTIC: physical comfort, relaxation

9. Amenities - KEYWORDS: WiFi, kitchen, pool, parking, facilities, amenities, equipment, appliances, coffee
   SEMANTIC: available features and services

SEMANTIC EXAMPLES (understand meaning beyond exact words):
✓ "immaculate" → Cleanliness positive (no "clean" keyword)
✓ "walking distance to subway" → Location positive
✓ "John was always available" → HostCommunication positive
✓ "worth every penny" → ValueForMoney positive
✓ "exactly as advertised" → AccuracyOfListing positive
✓ "couldn't hear a sound" → NoiseLevels positive
✓ "slept like a baby" → Comfort positive
✓ "everything we needed" → Amenities positive

For each aspect, count BOTH:
- Exact keyword matches (e.g., "clean")
- Semantic matches (e.g., "immaculate", "pristine", "spotless")

Extract 3-5 EXACT quotes (under 80 chars) per aspect.

ALSO EXTRACT:
- pros_and_cons: Extract 5-7 pros (positive highlights) and 3-5 cons (negative issues) as short phrases
- guest_insights: Analyze who this property is good for:
  * recommended_for: Guest types who would enjoy (e.g., "Families with children", "Business travelers", "Couples")
  * not_recommended_for: Guest types who might not enjoy (e.g., "Light sleepers", "Budget travelers")
  * best_features: Top 3-5 standout features (e.g., "Excellent location", "Spotless cleanliness")
  * areas_for_improvement: 2-4 areas needing attention (e.g., "Weak WiFi signal", "Noisy at night")

JSON FORMAT (MUST include all fields):
{
  "keyword_analysis": [{"keyword":"Cleanliness","positive":10,"negative":2,"total_mentions":12,"positive_snippets":["The apartment was immaculate"],"negative_snippets":["Dust on shelves"]}, ...all 9 aspects...],
  "pros_and_cons": {
    "pros": ["Spotless and well-maintained", "Perfect central location", "Responsive and friendly host", "Great value for money", "Easy check-in process"],
    "cons": ["Thin walls, could hear neighbors", "WiFi signal weak in bedroom", "No parking available"]
  },
  "guest_insights": {
    "recommended_for": ["Couples seeking romantic getaway", "Business travelers", "Solo adventurers"],
    "not_recommended_for": ["Large families", "Light sleepers"],
    "best_features": ["Excellent location near subway", "Spotless cleanliness", "Comfortable beds"],
    "areas_for_improvement": ["Improve WiFi speed", "Add soundproofing", "Provide parking info"]
  }
}

REVIEWS:
${reviewSample}`;

      const promptTokens = this.estimateTokens(prompt);
      console.log(`TravanaSpot: [Chunk ${chunkIndex + 1}/${totalChunks}] Prompt tokens: ~${promptTokens}`);

      // Check token availability before calling API
      const availableTokens = this.languageModelSession.maxTokens - this.languageModelSession.tokensSoFar;
      console.log(`TravanaSpot: [Chunk ${chunkIndex + 1}/${totalChunks}] Available tokens: ${availableTokens}/${this.languageModelSession.maxTokens}`);

      if (promptTokens > availableTokens) {
        throw new Error(`Insufficient tokens: need ~${promptTokens}, have ${availableTokens}. Try using fewer reviews per chunk.`);
      }

      console.log(`TravanaSpot: [Chunk ${chunkIndex + 1}/${totalChunks}] Calling Prompt API...`);

      const response = await this.languageModelSession.prompt(prompt, {
        responseConstraint: schema,
        omitResponseConstraintInput: true
      });

      console.log(`TravanaSpot: [Chunk ${chunkIndex + 1}/${totalChunks}] Received response, length: ${response.length} chars`);
      console.log(`TravanaSpot: [Chunk ${chunkIndex + 1}/${totalChunks}] Response preview:`, response.substring(0, 200));

      // Parse JSON response
      let jsonText = response.trim();
      if (jsonText.startsWith('```')) {
        console.log(`TravanaSpot: [Chunk ${chunkIndex + 1}/${totalChunks}] Response has markdown code blocks, extracting...`);
        const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match && match[1]) {
          jsonText = match[1].trim();
        }
      }

      console.log(`TravanaSpot: [Chunk ${chunkIndex + 1}/${totalChunks}] Parsing JSON...`);
      const parsed = JSON.parse(jsonText);

      console.log(`TravanaSpot: [Chunk ${chunkIndex + 1}/${totalChunks}] ✅ Successfully parsed! Found ${parsed.keyword_analysis?.length || 0} keywords`);

      return parsed;

    } catch (error) {
      console.error(`TravanaSpot: [Chunk ${chunkIndex + 1}/${totalChunks}] ❌ FAILED with error:`, error.message);
      console.error(`TravanaSpot: [Chunk ${chunkIndex + 1}/${totalChunks}] Error type:`, error.name);
      console.error(`TravanaSpot: [Chunk ${chunkIndex + 1}/${totalChunks}] Full error:`, error);

      // Re-throw to be caught by the main loop
      throw error;
    }
  }

  // Extract structured data (keyword analysis, pros/cons) using Prompt API
  async extractStructuredData(truncatedReviews, summaryText) {
    // Track the specific error for precise messaging
    this.keywordAnalysisError = null;

    try {
      // Initialize Language Model session
      this.languageModelSession = await this.initLanguageModelSession();

      console.log(`TravanaSpot: Starting structured data extraction from ${truncatedReviews.length} reviews`);

      // STRATEGY: Process ALL reviews in chunks, then merge results
      // Similar to Summarizer API approach but for keyword extraction

      // Calculate optimal chunk size based on token limits
      const availableTokens = this.languageModelSession.maxTokens - this.languageModelSession.tokensSoFar;
      const promptOverhead = 2500; // Estimate for prompt structure and response
      const tokensPerReview = 150; // Conservative estimate per truncated review
      const reviewsPerChunk = Math.max(10, Math.floor((availableTokens - promptOverhead) / tokensPerReview / 3)); // Divide by 3 for multiple chunks

      console.log(`TravanaSpot: Processing reviews in chunks of ~${reviewsPerChunk} reviews each`);
      console.log(`TravanaSpot: Prompt API session tokens: ${this.languageModelSession.tokensSoFar}/${this.languageModelSession.maxTokens}`);

      // Split reviews into chunks
      const chunks = [];
      for (let i = 0; i < truncatedReviews.length; i += reviewsPerChunk) {
        chunks.push(truncatedReviews.slice(i, i + reviewsPerChunk));
      }

      console.log(`TravanaSpot: Created ${chunks.length} chunks from ${truncatedReviews.length} reviews`);

      // Process each chunk and collect keyword analysis
      const chunkResults = [];
      for (let i = 0; i < chunks.length; i++) {
        try {
          console.log(`TravanaSpot: Starting chunk ${i + 1}/${chunks.length}...`);
          const chunkData = await this.extractChunkData(chunks[i], i, chunks.length);

          if (chunkData && chunkData.keyword_analysis) {
            console.log(`TravanaSpot: Chunk ${i + 1}/${chunks.length} returned ${chunkData.keyword_analysis.length} keywords`);
            chunkResults.push(chunkData);
          } else {
            console.warn(`TravanaSpot: Chunk ${i + 1}/${chunks.length} returned invalid data:`, chunkData);
          }
        } catch (error) {
          console.error(`TravanaSpot: Chunk ${i + 1}/${chunks.length} failed with error:`, error.message);
          console.error(`TravanaSpot: Full error:`, error);
          // Continue with other chunks even if one fails
        }
      }

      if (chunkResults.length === 0) {
        throw new Error('All chunks failed to process');
      }

      console.log(`TravanaSpot: Successfully processed ${chunkResults.length}/${chunks.length} chunks`);

      // Merge keyword analysis from all chunks
      const mergedKeywordAnalysis = this.mergeKeywordAnalysis(chunkResults.map(r => r.keyword_analysis));

      // Merge pros_and_cons from all chunks (combine and deduplicate)
      const allPros = new Set();
      const allCons = new Set();
      chunkResults.forEach(chunk => {
        if (chunk.pros_and_cons) {
          chunk.pros_and_cons.pros?.forEach(pro => allPros.add(pro));
          chunk.pros_and_cons.cons?.forEach(con => allCons.add(con));
        }
      });

      // Merge guest_insights from all chunks (take most common suggestions)
      const insightCounts = {
        recommended_for: {},
        not_recommended_for: {},
        best_features: {},
        areas_for_improvement: {}
      };

      chunkResults.forEach(chunk => {
        if (chunk.guest_insights) {
          ['recommended_for', 'not_recommended_for', 'best_features', 'areas_for_improvement'].forEach(key => {
            chunk.guest_insights[key]?.forEach(item => {
              insightCounts[key][item] = (insightCounts[key][item] || 0) + 1;
            });
          });
        }
      });

      // Take top items from each category
      const mergedInsights = {
        recommended_for: Object.keys(insightCounts.recommended_for).sort((a, b) => insightCounts.recommended_for[b] - insightCounts.recommended_for[a]).slice(0, 5),
        not_recommended_for: Object.keys(insightCounts.not_recommended_for).sort((a, b) => insightCounts.not_recommended_for[b] - insightCounts.not_recommended_for[a]).slice(0, 3),
        best_features: Object.keys(insightCounts.best_features).sort((a, b) => insightCounts.best_features[b] - insightCounts.best_features[a]).slice(0, 5),
        areas_for_improvement: Object.keys(insightCounts.areas_for_improvement).sort((a, b) => insightCounts.areas_for_improvement[b] - insightCounts.areas_for_improvement[a]).slice(0, 4)
      };

      // Return merged data from all chunks
      return {
        keyword_analysis: mergedKeywordAnalysis,
        pros_and_cons: {
          pros: Array.from(allPros).slice(0, 7),
          cons: Array.from(allCons).slice(0, 5)
        },
        guest_insights: mergedInsights
      };

    } catch (error) {
      console.error('TravanaSpot: Failed to extract structured data from chunks:', error);

      this.keywordAnalysisError = `Chunked extraction failed: ${error.message}. Using fallback keyword detection.`;

      const fallback = this.createFallbackStructuredData(truncatedReviews);
      fallback._errorReason = this.keywordAnalysisError;
      return fallback;
    }
  }

  // Create fallback structured data if Prompt API fails
  createFallbackStructuredData(reviews) {
    console.log('TravanaSpot: Creating fallback structured data');
    console.log(`TravanaSpot: Fallback received ${reviews.length} reviews`);
    console.log(`TravanaSpot: First review sample:`, reviews[0]?.substring(0, 100));

    // Simple keyword extraction from reviews
    const keywords = {
      'Cleanliness': { positive: [], negative: [] },
      'Location': { positive: [], negative: [] },
      'HostCommunication': { positive: [], negative: [] },
      'ValueForMoney': { positive: [], negative: [] },
      'AccuracyOfListing': { positive: [], negative: [] },
      'CheckInProcess': { positive: [], negative: [] },
      'NoiseLevels': { positive: [], negative: [] },
      'Comfort': { positive: [], negative: [] },
      'Amenities': { positive: [], negative: [] }
    };

    const positiveWords = ['great', 'excellent', 'amazing', 'perfect', 'wonderful', 'clean', 'comfortable'];
    const negativeWords = ['bad', 'poor', 'dirty', 'noisy', 'disappointing', 'issue', 'problem'];

    const pros = new Set();
    const cons = new Set();

    reviews.forEach(reviewText => {
      const lowerText = reviewText.toLowerCase();

      // Keyword detection
      if (lowerText.includes('clean')) {
        const sentiment = this.detectSentiment(reviewText);
        if (sentiment === 'positive' && keywords['Cleanliness'].positive.length < 10) {
          keywords['Cleanliness'].positive.push(this.extractSnippet(reviewText, 'clean'));
        } else if (sentiment === 'negative' && keywords['Cleanliness'].negative.length < 10) {
          keywords['Cleanliness'].negative.push(this.extractSnippet(reviewText, 'clean'));
        }
      }

      if (lowerText.includes('location') || lowerText.includes('area')) {
        const sentiment = this.detectSentiment(reviewText);
        if (sentiment === 'positive' && keywords['Location'].positive.length < 10) {
          keywords['Location'].positive.push(this.extractSnippet(reviewText, 'location'));
        } else if (sentiment === 'negative' && keywords['Location'].negative.length < 10) {
          keywords['Location'].negative.push(this.extractSnippet(reviewText, 'location'));
        }
      }

      if (lowerText.includes('host') || lowerText.includes('communication')) {
        const sentiment = this.detectSentiment(reviewText);
        if (sentiment === 'positive' && keywords['HostCommunication'].positive.length < 10) {
          keywords['HostCommunication'].positive.push(this.extractSnippet(reviewText, 'host'));
        } else if (sentiment === 'negative' && keywords['HostCommunication'].negative.length < 10) {
          keywords['HostCommunication'].negative.push(this.extractSnippet(reviewText, 'host'));
        }
      }

      if (lowerText.includes('value') || lowerText.includes('price') || lowerText.includes('money')) {
        const sentiment = this.detectSentiment(reviewText);
        if (sentiment === 'positive' && keywords['ValueForMoney'].positive.length < 10) {
          keywords['ValueForMoney'].positive.push(this.extractSnippet(reviewText, 'value'));
        }
      }

      if (lowerText.includes('check') || lowerText.includes('arrival')) {
        const sentiment = this.detectSentiment(reviewText);
        if (sentiment === 'positive' && keywords['CheckInProcess'].positive.length < 10) {
          keywords['CheckInProcess'].positive.push(this.extractSnippet(reviewText, 'check'));
        }
      }

      if (lowerText.includes('noise') || lowerText.includes('noisy') || lowerText.includes('quiet') || lowerText.includes('loud') || lowerText.includes('sound')) {
        const sentiment = this.detectSentiment(reviewText);
        if (sentiment === 'positive' && keywords['NoiseLevels'].positive.length < 10) {
          keywords['NoiseLevels'].positive.push(this.extractSnippet(reviewText, 'quiet'));
        } else if (sentiment === 'negative' && keywords['NoiseLevels'].negative.length < 10) {
          keywords['NoiseLevels'].negative.push(this.extractSnippet(reviewText, 'noise'));
        }
      }

      if (lowerText.includes('comfort') || lowerText.includes('bed') || lowerText.includes('cozy') || lowerText.includes('mattress')) {
        const sentiment = this.detectSentiment(reviewText);
        if (sentiment === 'positive' && keywords['Comfort'].positive.length < 10) {
          keywords['Comfort'].positive.push(this.extractSnippet(reviewText, 'comfort'));
        } else if (sentiment === 'negative' && keywords['Comfort'].negative.length < 10) {
          keywords['Comfort'].negative.push(this.extractSnippet(reviewText, 'comfort'));
        }
      }

      if (lowerText.includes('amenities') || lowerText.includes('wifi') || lowerText.includes('kitchen') || lowerText.includes('pool') || lowerText.includes('parking') || lowerText.includes('facilities')) {
        const sentiment = this.detectSentiment(reviewText);
        if (sentiment === 'positive' && keywords['Amenities'].positive.length < 10) {
          keywords['Amenities'].positive.push(this.extractSnippet(reviewText, 'amenities'));
        } else if (sentiment === 'negative' && keywords['Amenities'].negative.length < 10) {
          keywords['Amenities'].negative.push(this.extractSnippet(reviewText, 'amenities'));
        }
      }

      // Extract pros
      if (positiveWords.some(word => lowerText.includes(word)) && pros.size < 7) {
        const snippet = reviewText.substring(0, 100);
        if (snippet.length > 20) pros.add(snippet);
      }

      // Extract cons
      if (negativeWords.some(word => lowerText.includes(word)) && cons.size < 7) {
        const snippet = reviewText.substring(0, 100);
        if (snippet.length > 20) cons.add(snippet);
      }
    });

    // Build keyword_analysis array - ALWAYS include all 9 aspects
    const keyword_analysis = [];
    Object.entries(keywords).forEach(([keyword, data]) => {
      keyword_analysis.push({
        keyword: keyword,
        positive: data.positive.length,
        negative: data.negative.length,
        total_mentions: data.positive.length + data.negative.length,
        positive_snippets: data.positive,
        negative_snippets: data.negative
      });
    });

    console.log(`TravanaSpot: Fallback created ${keyword_analysis.length} keyword aspects:`, keyword_analysis.map(k => `${k.keyword}(+${k.positive}/-${k.negative})`).join(', '));

    // Build guest_insights based on actual review content
    const guest_insights = {
      recommended_for: [],
      not_recommended_for: [],
      best_features: [],
      areas_for_improvement: []
    };

    // Detect recommended_for based on semantic indicators
    const allReviewsText = reviews.join(' ').toLowerCase();

    if (allReviewsText.match(/famil(y|ies)|kid|child|toddler|baby|daughter|son/i)) {
      guest_insights.recommended_for.push('Families with children');
    }
    if (allReviewsText.match(/couple|romantic|anniversary|honeymoon/i)) {
      guest_insights.recommended_for.push('Couples');
    }
    if (allReviewsText.match(/business|work|conference|meeting/i)) {
      guest_insights.recommended_for.push('Business travelers');
    }
    if (allReviewsText.match(/solo|alone|myself|independent/i)) {
      guest_insights.recommended_for.push('Solo travelers');
    }
    if (allReviewsText.match(/group|friends|reunion|party/i)) {
      guest_insights.recommended_for.push('Groups of friends');
    }

    // Detect not_recommended_for
    if (allReviewsText.match(/noise|noisy|loud|hear|sound/i)) {
      guest_insights.not_recommended_for.push('Light sleepers');
    }
    if (allReviewsText.match(/stairs|climb|steep|uphill|no elevator|walk up/i)) {
      guest_insights.not_recommended_for.push('Guests with mobility issues');
    }
    if (allReviewsText.match(/small|tiny|cramped|tight/i) && allReviewsText.match(/space|room/i)) {
      guest_insights.not_recommended_for.push('Large groups');
    }

    // Best features from keyword analysis
    const topKeywords = keyword_analysis
      .filter(k => k.positive > k.negative)
      .sort((a, b) => b.positive - a.positive)
      .slice(0, 5);

    guest_insights.best_features = topKeywords.map(k => k.keyword);

    // Areas for improvement from negative mentions
    const improvementAreas = keyword_analysis
      .filter(k => k.negative > 0)
      .sort((a, b) => b.negative - a.negative)
      .slice(0, 3);

    guest_insights.areas_for_improvement = improvementAreas.map(k => k.keyword);

    return {
      keyword_analysis: keyword_analysis, // Return actual data, even if empty
      pros_and_cons: {
        pros: Array.from(pros).slice(0, 7).map(p => p + '...'),
        cons: Array.from(cons).slice(0, 7).map(c => c + '...')
      },
      guest_insights: guest_insights
    };
  }

  // Detect sentiment of text
  detectSentiment(text) {
    const lowerText = text.toLowerCase();
    const positiveWords = ['great', 'excellent', 'amazing', 'perfect', 'wonderful', 'love', 'clean', 'comfortable', 'beautiful'];
    const negativeWords = ['bad', 'poor', 'terrible', 'dirty', 'noisy', 'disappointing', 'issue', 'problem', 'awful'];

    let positiveCount = 0;
    let negativeCount = 0;

    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveCount++;
    });

    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeCount++;
    });

    return positiveCount > negativeCount ? 'positive' : 'negative';
  }

  // Extract a snippet containing keyword
  extractSnippet(text, keyword) {
    const lowerText = text.toLowerCase();
    const keywordIndex = lowerText.indexOf(keyword.toLowerCase());

    if (keywordIndex === -1) {
      return text.substring(0, Math.min(100, text.length));
    }

    // Extract sentence containing the keyword
    const start = Math.max(0, keywordIndex - 50);
    const end = Math.min(text.length, keywordIndex + 100);
    let snippet = text.substring(start, end).trim();

    // Trim to sentence boundaries if possible
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  }

  // Estimate token count (rough approximation: 1 token ≈ 4 characters)
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  // Create optimized chunks based on Summarizer API token limits
  // Based on Chrome's scale-summarization best practices:
  // - Recommended: ~750 tokens per chunk for optimal quality
  // - Average token = ~4 characters
  // - Split at natural boundaries (reviews), not mid-sentence
  // - Include chunk overlap to preserve context between chunks
  createOptimizedChunks(reviews, chunkOverlap = 1) {
    const MAX_TOKENS_PER_CHUNK = 750; // Chrome's recommended size for best quality
    const MAX_CHARS_PER_CHUNK = MAX_TOKENS_PER_CHUNK * 4; // ~3000 chars

    const chunks = [];
    let currentChunk = [];
    let currentChunkSize = 0;

    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i];
      const reviewLength = review.length;
      const separator = '\n---\n'; // 5 chars

      // If adding this review would exceed limit, save current chunk and start new one
      if (currentChunkSize + reviewLength + separator.length > MAX_CHARS_PER_CHUNK && currentChunk.length > 0) {
        chunks.push([...currentChunk]);

        // Implement chunk overlap to preserve context between chunks
        // Keep last review(s) from previous chunk in next chunk
        if (chunkOverlap > 0 && currentChunk.length > chunkOverlap) {
          const overlapReviews = currentChunk.slice(-chunkOverlap);
          const overlapSize = overlapReviews.reduce((sum, r) => sum + r.length + separator.length, 0);

          currentChunk = [...overlapReviews];
          currentChunkSize = overlapSize;
        } else {
          currentChunk = [];
          currentChunkSize = 0;
        }
      }

      currentChunk.push(review);
      currentChunkSize += reviewLength + separator.length;
    }

    // Add the last chunk if it has content
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  // Measure estimated input usage for summarization
  // Returns estimated tokens needed for the text
  measureInputUsage(text, context = '') {
    const totalText = text + (context ? '\n' + context : '');
    const estimatedTokens = this.estimateTokens(totalText);

    return {
      estimatedTokens,
      estimatedChars: totalText.length,
      fitsInSingleRequest: estimatedTokens <= 750 // Chrome's recommended chunk size
    };
  }

  // Recursive summarization for very large text
  // Based on Chrome's scale-summarization guide
  async recursiveSummarize(summaries, context, depth = 0) {
    const MAX_RECURSION_DEPTH = 5; // Prevent infinite loops

    if (depth >= MAX_RECURSION_DEPTH) {
      console.warn('TravanaSpot: Max recursion depth reached, returning combined summaries');
      return summaries.join('\n\n');
    }

    const combinedText = summaries.join('\n\n');
    const measurement = this.measureInputUsage(combinedText, context);

    console.log(`TravanaSpot: Recursion level ${depth + 1}: ${summaries.length} summaries, ~${measurement.estimatedTokens} tokens`);

    // If fits in single request, summarize directly
    if (measurement.fitsInSingleRequest) {
      console.log(
        `TravanaSpot: Fits in single request, creating final summary at level ${depth + 1}`
      );
      return await this.summarizerSession.summarize(combinedText, {
        context,
        outputLanguage: 'en'
      });
    }

    // Otherwise, chunk and summarize recursively
    console.log(`TravanaSpot: Too large, chunking for recursive summarization at level ${depth + 1}`);
    const chunks = this.createOptimizedChunks(summaries, 0); // No overlap for summaries
    const nextLevelSummaries = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i].join('\n\n');
      try {
        const summary = await this.summarizerSession.summarize(chunkText, {
          context: `Level ${depth + 1} intermediate summary. ${context}`,
          outputLanguage: 'en'
        });
        nextLevelSummaries.push(summary);
        console.log(`TravanaSpot: Level ${depth + 1} chunk ${i + 1}/${chunks.length} summarized`);
      } catch (error) {
        console.error(`TravanaSpot: Error in level ${depth + 1} chunk ${i + 1}:`, error);
      }
    }

    // Recursively summarize the next level
    return await this.recursiveSummarize(nextLevelSummaries, context, depth + 1);
  }

  // Analyze reviews using Summarizer API with optimized chunking
  async analyzeReviews(reviews, userQuestion = null) {
    if (!reviews || reviews.length === 0) {
      throw new Error('No reviews to analyze');
    }

    if (this.isAnalyzing) {
      throw new Error('Analysis already in progress');
    }

    this.isAnalyzing = true;

    try {
      console.log('TravanaSpot: Starting review analysis with Summarizer API...');
      console.log('TravanaSpot: Total reviews received:', reviews.length);

      // Limit to 100 reviews max
      const reviewsToAnalyze = reviews.slice(0, 100);

      // Truncate each review to max length (500 chars) but KEEP the rating field
      const truncatedReviews = reviewsToAnalyze
        .map((review) => {
          const text = (review.text || review.comments || '').trim();
          return {
            text: this.truncateReview(text),
            rating: review.rating || 0,
            name: review.name || 'Anonymous'
          };
        })
        .filter((review) => review.text.length > 10);

      console.log(`TravanaSpot: Processing ${truncatedReviews.length} reviews after truncation`);

      // Log rating distribution
      const withRatings = truncatedReviews.filter((r) => r.rating && r.rating > 0).length;
      console.log(`TravanaSpot: ${withRatings}/${truncatedReviews.length} reviews have ratings`);

      // Calculate total size
      const totalChars = truncatedReviews.reduce((sum, r) => sum + r.text.length, 0);
      const estimatedTokens = this.estimateTokens(totalChars);
      console.log(`TravanaSpot: Total size: ${totalChars} chars (~${estimatedTokens} tokens)`);

      // Initialize summarizer session
      this.summarizerSession = await this.initSummarizerSession();

      // STRATEGY: Multi-level hierarchical summarization
      // Summarizer API limits: ~1024 tokens per prompt (~4000 chars)
      // Level 1: Split into chunks that fit within token limit (~3600 chars each with buffer)
      // Level 2: Summarize each chunk to get intermediate summaries
      // Level 3: Combine and create final summary

      // Extract just text for chunking (we'll use full objects for sentiment later)
      const reviewTexts = truncatedReviews.map((r) => r.text);
      const chunks = this.createOptimizedChunks(reviewTexts);
      console.log(`TravanaSpot: Created ${chunks.length} optimized chunks for Summarizer API`);

      // Log chunk details
      chunks.forEach((chunk, idx) => {
        const chunkText = chunk.join('\n---\n');
        const chunkTokens = this.estimateTokens(chunkText);
        console.log(`TravanaSpot: Chunk ${idx + 1}: ${chunk.length} reviews, ${chunkText.length} chars, ~${chunkTokens} tokens`);
      });

      // Level 1: Summarize each chunk
      const chunkSummaries = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i].join('\n---\n');
        const chunkTokens = this.estimateTokens(chunkText);

        console.log(`TravanaSpot: Summarizing chunk ${i + 1}/${chunks.length} (~${chunkTokens} tokens)`);

        try {
          const summary = await this.summarizerSession.summarize(chunkText, {
            context:
              'These are Airbnb guest reviews. Extract key points about guest experiences, including specific pros, cons, and overall sentiment.',
            outputLanguage: 'en'
          });

          chunkSummaries.push(summary);
          const summaryTokens = this.estimateTokens(summary);
          console.log(`TravanaSpot: Chunk ${i + 1} summarized to ${summary.length} chars (~${summaryTokens} tokens)`);
          console.log(`TravanaSpot: Chunk ${i + 1} summary preview:`, summary.substring(0, 150) + '...');
        } catch (error) {
          console.error(`TravanaSpot: Error summarizing chunk ${i + 1}:`, error);
          // Continue with other chunks even if one fails
        }
      }

      if (chunkSummaries.length === 0) {
        throw new Error('All chunk summarizations failed');
      }

      console.log(`TravanaSpot: Successfully summarized ${chunkSummaries.length}/${chunks.length} chunks`);

      // Level 2: Use recursive summarization to handle large combined summaries
      // This implements the "summary of summaries" approach from Chrome's guide
      console.log('TravanaSpot: Creating final summary using recursive summarization...');

      const finalSummary = await this.recursiveSummarize(
        chunkSummaries,
        'These are summaries of Airbnb guest reviews. Create a comprehensive final summary covering all key points, pros, cons, and overall guest sentiment.'
      );

      console.log('TravanaSpot: Final summary created:', finalSummary.substring(0, 200) + '...');

      // Clone or create fresh Prompt API session for structured data extraction
      // This ensures we have maximum tokens available for extraction
      console.log('TravanaSpot: Preparing fresh Prompt API session for structured data extraction...');
      await this.cloneLanguageModelSession();

      // Now use Prompt API to extract structured keyword analysis and pros/cons
      console.log('TravanaSpot: Extracting structured data using Prompt API...');
      const structuredData = await this.extractStructuredData(truncatedReviews, finalSummary);

      // Combine summarizer results with structured data from Prompt API
      const baseParsed = this.parseSummaryToStructure(
        finalSummary,
        truncatedReviews.length,
        truncatedReviews
      );

      console.log('TravanaSpot: Structured data from Prompt API:', {
        hasKeywordAnalysis: !!structuredData.keyword_analysis,
        keywordCount: structuredData.keyword_analysis?.length || 0,
        hasProsAndCons: !!structuredData.pros_and_cons,
        hasGuestInsights: !!structuredData.guest_insights
      });

      const structuredAnalysis = {
        ...baseParsed,
        keyword_analysis: structuredData.keyword_analysis || [],
        pros_and_cons: structuredData.pros_and_cons || baseParsed.pros_and_cons,
        // Use Prompt API guest_insights if available, otherwise use parsed ones
        guest_insights: structuredData.guest_insights || baseParsed.guest_insights,
        // Include error reason if there was one
        keyword_analysis_error: structuredData._errorReason || null
      };

      console.log('TravanaSpot: Final structured analysis:', {
        keywordAnalysisCount: structuredAnalysis.keyword_analysis?.length || 0,
        prosCount: structuredAnalysis.pros_and_cons?.pros?.length || 0,
        consCount: structuredAnalysis.pros_and_cons?.cons?.length || 0,
        keywordError: structuredAnalysis.keyword_analysis_error
      });

      // Build review cache for chatbox questions (improved sequential search)
      this.buildReviewCache(reviews);

      // Destroy Summarizer session - no longer needed (only used during analysis)
      if (this.summarizerSession) {
        console.log('TravanaSpot: Destroying Summarizer session (no longer needed)...');
        await this.summarizerSession.destroy();
        this.summarizerSession = null;
      }

      // Destroy Prompt API session - will be recreated fresh for chatbox questions
      if (this.languageModelSession) {
        console.log('TravanaSpot: Destroying Prompt API session (will recreate for chatbox)...');
        await this.languageModelSession.destroy();
        this.languageModelSession = null;
      }

      this.isAnalyzing = false;
      console.log('TravanaSpot: ✅ Analysis completed successfully, sessions destroyed');

      return structuredAnalysis;

    } catch (error) {
      this.isAnalyzing = false;
      console.error('TravanaSpot: Summarizer API analysis failed:', error);

      // If Summarizer is unavailable, use Prompt API as fallback
      if (error.message === 'SUMMARIZER_UNAVAILABLE') {
        console.log('TravanaSpot: ⚠️ Summarizer API unavailable, using Prompt API fallback...');
        console.log('TravanaSpot: Processing with Prompt API for structured data extraction...');

        try {
          const truncatedReviews = reviews.slice(0, 100).map(review => {
            const text = (review.text || review.comments || '').trim();
            return this.truncateReview(text);
          }).filter(text => text.length > 10);

          console.log(`TravanaSpot: Processing ${truncatedReviews.length} reviews with Prompt API only`);

          // Clone or create fresh Prompt API session
          console.log('TravanaSpot: Initializing Prompt API session...');
          await this.cloneLanguageModelSession();
          console.log('TravanaSpot: ✅ Prompt API session ready');

          // Extract structured data using chunks
          console.log('TravanaSpot: Extracting structured data from reviews...');
          const structuredData = await this.extractStructuredData(truncatedReviews, '');
          console.log('TravanaSpot: ✅ Structured data extracted');

          // Use fallback for summary and sentiment (no Summarizer available)
          console.log('TravanaSpot: Generating fallback summary...');
          const fallback = this.fallbackReviewAnalysis(reviews.slice(0, 100));
          console.log('TravanaSpot: ✅ Fallback summary generated');

          // Combine Prompt API keyword_analysis with fallback summary/sentiment
          const result = {
            ...fallback,
            keyword_analysis: structuredData.keyword_analysis || fallback.keyword_analysis,
            pros_and_cons: structuredData.pros_and_cons || fallback.pros_and_cons,
            guest_insights: structuredData.guest_insights || fallback.guest_insights,
            message: '✅ Analysis completed using Prompt API (Summarizer API unavailable)',
            keyword_analysis_error: structuredData._errorReason || null
          };

          console.log('TravanaSpot: ✅ Analysis completed successfully using Prompt API fallback');
          return result;

        } catch (promptError) {
          console.error('TravanaSpot: ❌ Prompt API also failed:', promptError);
          console.error('TravanaSpot: Error details:', promptError.message, promptError.stack);
          console.log('TravanaSpot: Using complete fallback (basic keyword detection)');
          // Both APIs failed, use complete fallback
          const fallbackResult = this.fallbackReviewAnalysis(reviews.slice(0, 100));
          fallbackResult.message = '⚠️ Using basic analysis (both AI APIs unavailable)';
          return fallbackResult;
        }
      }

      // For any other errors, return fallback analysis
      console.log('TravanaSpot: Using fallback analysis due to unexpected error');
      const fallbackResult = this.fallbackReviewAnalysis(reviews.slice(0, 100));
      fallbackResult.message = '⚠️ Using basic analysis (error occurred)';
      return fallbackResult;
    }
  }

  // Parse summary text into structured analysis format
  parseSummaryToStructure(summaryText, totalReviews, reviews = []) {
    console.log('TravanaSpot: Parsing summary into structured format');

    const analysis = {
      trust_score: 75,
      sentiment_analysis: {
        positive_percentage: 60,
        neutral_percentage: 30,
        negative_percentage: 10,
        overall_sentiment: 'positive'
      },
      keyword_analysis: [],
      pros_and_cons: {
        pros: [],
        cons: []
      },
      guest_insights: {
        recommended_for: [],
        not_recommended_for: [],
        best_features: [],
        areas_for_improvement: []
      },
      summary: summaryText,
      reviews_analyzed: totalReviews,
      analysis_type: 'summarizer_api_powered'
    };

    try {
      // Calculate sentiment from ACTUAL REVIEW RATINGS or TEXT ANALYSIS
      let positiveReviews = 0;
      let neutralReviews = 0;
      let negativeReviews = 0;

      // Check if reviews have ratings
      const hasRatings = reviews && reviews.length > 0 && reviews.some((r) => r.rating && r.rating > 0);

      console.log(
        `TravanaSpot: Sentiment analysis - ${reviews?.length || 0} reviews, hasRatings: ${hasRatings}`
      );

      if (hasRatings) {
        // METHOD 1: Use actual star ratings (most accurate)
        reviews.forEach((review) => {
          const rating = review.rating || 0;

          if (rating >= 4.5) {
            positiveReviews++;
          } else if (rating >= 3.5) {
            neutralReviews++;
          } else {
            negativeReviews++;
          }
        });
      } else {
        // METHOD 2: Fallback to analyzing review text sentiment
        console.log('TravanaSpot: No ratings found, analyzing review text sentiment');

        const positiveWords = [
          'excellent',
          'great',
          'amazing',
          'wonderful',
          'perfect',
          'loved',
          'love',
          'beautiful',
          'clean',
          'comfortable',
          'recommend',
          'fantastic',
          'awesome'
        ];
        const negativeWords = [
          'poor',
          'bad',
          'terrible',
          'disappointing',
          'dirty',
          'uncomfortable',
          'noisy',
          'issue',
          'problem',
          'complaint',
          'avoid',
          'worst',
          'horrible'
        ];

        reviews?.forEach((review) => {
          if (!review.text) return;

          const lowerText = review.text.toLowerCase();
          let positiveCount = 0;
          let negativeCount = 0;

          positiveWords.forEach((word) => {
            if (lowerText.includes(word)) positiveCount++;
          });

          negativeWords.forEach((word) => {
            if (lowerText.includes(word)) negativeCount++;
          });

          // Classify based on keyword counts
          if (positiveCount > negativeCount + 1) {
            positiveReviews++;
          } else if (negativeCount > positiveCount + 1) {
            negativeReviews++;
          } else {
            neutralReviews++;
          }
        });
      }

      const totalReviewsForSentiment =
        positiveReviews + neutralReviews + negativeReviews || 1;

      // Calculate percentages
      analysis.sentiment_analysis.positive_percentage = Math.round(
        (positiveReviews / totalReviewsForSentiment) * 100
      );
      analysis.sentiment_analysis.negative_percentage = Math.round(
        (negativeReviews / totalReviewsForSentiment) * 100
      );
      analysis.sentiment_analysis.neutral_percentage =
        100 -
        analysis.sentiment_analysis.positive_percentage -
        analysis.sentiment_analysis.negative_percentage;

      console.log('TravanaSpot: Sentiment breakdown:', {
        positive: positiveReviews,
        neutral: neutralReviews,
        negative: negativeReviews,
        percentages: {
          positive: analysis.sentiment_analysis.positive_percentage,
          neutral: analysis.sentiment_analysis.neutral_percentage,
          negative: analysis.sentiment_analysis.negative_percentage
        }
      });

      // Determine overall sentiment
      if (analysis.sentiment_analysis.positive_percentage > analysis.sentiment_analysis.negative_percentage + 20) {
        analysis.sentiment_analysis.overall_sentiment = 'positive';
        analysis.trust_score = 80;
      } else if (analysis.sentiment_analysis.negative_percentage > analysis.sentiment_analysis.positive_percentage + 20) {
        analysis.sentiment_analysis.overall_sentiment = 'negative';
        analysis.trust_score = 60;
      } else {
        analysis.sentiment_analysis.overall_sentiment = 'neutral';
        analysis.trust_score = 70;
      }

      // Define word lists for pros/cons extraction from summary
      const lowerSummary = summaryText.toLowerCase();
      const positiveWords = [
        'excellent',
        'great',
        'amazing',
        'wonderful',
        'perfect',
        'loved',
        'beautiful',
        'clean',
        'comfortable',
        'recommend'
      ];
      const negativeWords = [
        'poor',
        'bad',
        'terrible',
        'disappointing',
        'dirty',
        'uncomfortable',
        'noisy',
        'issue',
        'problem',
        'complaint'
      ];

      // Count positive/negative mentions for context
      let positiveCount = 0;
      let negativeCount = 0;

      positiveWords.forEach((word) => {
        const matches = (lowerSummary.match(new RegExp(word, 'g')) || []).length;
        positiveCount += matches;
      });

      negativeWords.forEach((word) => {
        const matches = (lowerSummary.match(new RegExp(word, 'g')) || []).length;
        negativeCount += matches;
      });

      // Extract pros and cons from key points
      const lines = summaryText
        .split('\n')
        .filter((line) => line.trim().length > 0);

      lines.forEach((line) => {
        const trimmedLine = line.replace(/^[\-\*\•\d\.\)]\s*/, '').trim();

        if (trimmedLine.length < 10) return;

        // Check if line mentions positive aspects
        const hasPositive = positiveWords.some((word) =>
          trimmedLine.toLowerCase().includes(word)
        );
        const hasNegative = negativeWords.some((word) =>
          trimmedLine.toLowerCase().includes(word)
        );

        if (hasPositive && !hasNegative && analysis.pros_and_cons.pros.length < 7) {
          analysis.pros_and_cons.pros.push(trimmedLine);
        } else if (hasNegative && !hasPositive && analysis.pros_and_cons.cons.length < 7) {
          analysis.pros_and_cons.cons.push(trimmedLine);
        }
      });

      // Extract comprehensive guest insights by ACTIVELY SEARCHING for these aspects
      // Only include if evidence is found in reviews - no fake data

      // RECOMMENDED FOR - Search for positive indicators (expanded for semantic coverage)
      const familyIndicators = ['family', 'families', 'children', 'kids', 'child', 'baby', 'toddler', 'parents', 'daughter', 'son', 'infant', 'young ones', 'little ones'];
      if (familyIndicators.some(word => lowerSummary.includes(word))) {
        analysis.guest_insights.recommended_for.push('Families with children');
      }

      const coupleIndicators = ['couple', 'romantic', 'honeymoon', 'anniversary', 'partner', 'spouse', 'husband', 'wife', 'boyfriend', 'girlfriend', 'significant other'];
      if (coupleIndicators.some(word => lowerSummary.includes(word))) {
        analysis.guest_insights.recommended_for.push('Couples');
      }

      const businessIndicators = ['business', 'work', 'professional', 'meeting', 'conference', 'remote work', 'working remotely', 'work trip', 'corporate', 'job'];
      if (businessIndicators.some(word => lowerSummary.includes(word))) {
        analysis.guest_insights.recommended_for.push('Business travelers');
      }

      const soloIndicators = ['solo', 'alone', 'myself', 'single traveler', 'independent', 'by myself', 'on my own', 'traveling alone'];
      if (soloIndicators.some(word => lowerSummary.includes(word))) {
        analysis.guest_insights.recommended_for.push('Solo travelers');
      }

      const groupIndicators = ['group', 'friends', 'gathering', 'reunion', 'multiple guests', 'several of us', 'gang', 'crew', 'party of'];
      if (groupIndicators.some(word => lowerSummary.includes(word))) {
        analysis.guest_insights.recommended_for.push('Groups of friends');
      }

      // NOT RECOMMENDED FOR - Search for negative indicators or limitations
      const noiseIndicators = ['noise', 'noisy', 'loud', 'sound', 'hearing', 'disturbance', 'neighbor'];
      if (noiseIndicators.some(word => lowerSummary.includes(word)) && negativeCount > 0) {
        analysis.guest_insights.not_recommended_for.push('Light sleepers (noise reported)');
      }

      const accessibilityIndicators = ['stairs', 'steps', 'access', 'mobility', 'elevator', 'lift', 'wheelchair'];
      if (accessibilityIndicators.some(word => lowerSummary.includes(word)) && negativeCount > 0) {
        analysis.guest_insights.not_recommended_for.push('Guests with mobility issues');
      }

      const luxuryIndicators = ['basic', 'simple', 'budget', 'no frills', 'minimal'];
      if (luxuryIndicators.some(word => lowerSummary.includes(word))) {
        analysis.guest_insights.not_recommended_for.push('Guests seeking luxury amenities');
      }

      const spaceIndicators = ['space', 'small', 'cramped', 'tight', 'compact', 'limited space', 'cozy'];
      if (spaceIndicators.some(word => lowerSummary.includes(word)) && negativeCount > 0) {
        analysis.guest_insights.not_recommended_for.push('Large groups needing space');
      }

      const quietIndicators = ['quiet', 'peaceful', 'calm', 'residential', 'tranquil'];
      if (quietIndicators.some(word => lowerSummary.includes(word))) {
        analysis.guest_insights.not_recommended_for.push('Party seekers (quiet neighborhood)');
      }

      // BEST FEATURES - Search for positive mentions (expanded semantic coverage)
      const cleanIndicators = ['clean', 'spotless', 'tidy', 'immaculate', 'sanitary', 'hygiene', 'pristine', 'fresh', 'well-maintained', 'organized', 'neat'];
      if (cleanIndicators.some(word => lowerSummary.includes(word)) && positiveCount > 0) {
        analysis.guest_insights.best_features.push('Cleanliness');
      }

      const locationIndicators = ['location', 'convenient', 'central', 'walking distance', 'nearby', 'close to', 'accessible', 'proximity', 'easy to get', 'steps from', 'minutes from', 'neighborhood', 'area', 'situated'];
      if (locationIndicators.some(word => lowerSummary.includes(word)) && positiveCount > 0) {
        analysis.guest_insights.best_features.push('Location');
      }

      const hostIndicators = ['host', 'responsive', 'helpful', 'communication', 'welcoming', 'attentive', 'friendly host', 'answered', 'replied', 'available', 'accommodating', 'hospitable'];
      if (hostIndicators.some(word => lowerSummary.includes(word)) && positiveCount > 0) {
        analysis.guest_insights.best_features.push('Host communication');
      }

      const valueIndicators = ['value', 'price', 'affordable', 'worth', 'reasonable', 'good deal', 'money', 'bang for buck', 'priced well', 'fair price', 'budget'];
      if (valueIndicators.some(word => lowerSummary.includes(word)) && positiveCount > 0) {
        analysis.guest_insights.best_features.push('Value for money');
      }

      const amenitiesIndicators = ['amenities', 'facilities', 'equipped', 'provided', 'kitchen', 'appliances', 'supplies', 'essentials', 'toiletries', 'towels', 'linens', 'coffee', 'stocked'];
      if (amenitiesIndicators.some(word => lowerSummary.includes(word)) && positiveCount > 0) {
        analysis.guest_insights.best_features.push('Amenities');
      }

      const comfortIndicators = ['comfortable', 'cozy', 'relaxing', 'bed', 'sleep well', 'restful', 'comfy', 'soft', 'pleasant', 'inviting', 'homey'];
      if (comfortIndicators.some(word => lowerSummary.includes(word)) && positiveCount > 0) {
        analysis.guest_insights.best_features.push('Comfort');
      }

      // AREAS FOR IMPROVEMENT - Search for negative mentions or issues
      if (noiseIndicators.some(word => lowerSummary.includes(word)) && negativeCount > 0) {
        analysis.guest_insights.areas_for_improvement.push('Noise levels');
      }

      const wifiIndicators = ['wifi', 'internet', 'connection', 'signal', 'connectivity'];
      if (wifiIndicators.some(word => lowerSummary.includes(word)) && negativeCount > 0) {
        analysis.guest_insights.areas_for_improvement.push('WiFi connectivity');
      }

      const maintenanceIndicators = ['maintenance', 'repair', 'broken', 'fix', 'worn', 'outdated'];
      if (maintenanceIndicators.some(word => lowerSummary.includes(word))) {
        analysis.guest_insights.areas_for_improvement.push('Maintenance');
      }

      const parkingIndicators = ['parking', 'park', 'garage', 'street parking'];
      if (parkingIndicators.some(word => lowerSummary.includes(word)) && negativeCount > 0) {
        analysis.guest_insights.areas_for_improvement.push('Parking availability');
      }

      const temperatureIndicators = ['temperature', 'heating', 'cooling', 'ac', 'air conditioning', 'hot', 'cold'];
      if (temperatureIndicators.some(word => lowerSummary.includes(word)) && negativeCount > 0) {
        analysis.guest_insights.areas_for_improvement.push('Temperature control');
      }

      const cleanlinessIssueIndicators = ['dirty', 'stain', 'dust', 'not clean', 'needs cleaning'];
      if (cleanlinessIssueIndicators.some(word => lowerSummary.includes(word))) {
        analysis.guest_insights.areas_for_improvement.push('Cleanliness standards');
      }

      const communicationIssueIndicators = ['unresponsive', 'no reply', 'communication issue', 'hard to reach'];
      if (communicationIssueIndicators.some(word => lowerSummary.includes(word))) {
        analysis.guest_insights.areas_for_improvement.push('Host responsiveness');
      }

      // NO FORCED DEFAULTS - All data must come from actual reviews
      // The Prompt API extraction and fallback methods will provide the real data
      // If arrays are empty, it means reviews don't contain that information - which is honest data

      // Create comprehensive summary (minimum 2000 characters)
      analysis.summary = this.generateComprehensiveSummary(summaryText, analysis, totalReviews);

    } catch (parseError) {
      console.warn('TravanaSpot: Error parsing summary:', parseError);
    }

    return analysis;
  }

  // Generate comprehensive summary (minimum 2000 characters)
  generateComprehensiveSummary(summaryText, analysis, totalReviews) {
    const posPerc = analysis.sentiment_analysis.positive_percentage;
    const negPerc = analysis.sentiment_analysis.negative_percentage;
    const sentiment = analysis.sentiment_analysis.overall_sentiment;

    // Build a detailed, comprehensive summary
    let comprehensive = `Based on analyzing ${totalReviews} guest reviews, `;

    // Overall impression
    if (sentiment === 'positive' && posPerc >= 80) {
      comprehensive += `this property has received overwhelmingly positive feedback from guests. The vast majority of visitors (${posPerc}%) had excellent experiences, with only ${negPerc}% reporting any concerns. `;
    } else if (sentiment === 'positive') {
      comprehensive += `guests have generally positive experiences at this property. Approximately ${posPerc}% of guests expressed satisfaction with their stay, while ${negPerc}% mentioned some areas that could be improved. `;
    } else if (sentiment === 'neutral') {
      comprehensive += `the property receives mixed reviews from guests. While ${posPerc}% had positive experiences, ${negPerc}% encountered issues during their stay, suggesting an inconsistent guest experience. `;
    } else {
      comprehensive += `many guests have expressed concerns about this property. Only ${posPerc}% reported positive experiences, while ${negPerc}% of reviews highlighted significant issues that should be carefully considered before booking. `;
    }

    // Add summary content
    comprehensive += summaryText + ' ';

    // Detailed pros section
    if (analysis.pros_and_cons.pros.length > 0) {
      comprehensive += `\n\nGuests particularly appreciate several aspects of this property. ${analysis.pros_and_cons.pros.slice(0, 5).join('. ')}. These positive attributes contribute to the overall guest satisfaction and make this property stand out for visitors seeking these particular features. `;
    }

    // Detailed cons section
    if (analysis.pros_and_cons.cons.length > 0) {
      comprehensive += `However, some guests have raised concerns that potential visitors should be aware of. ${analysis.pros_and_cons.cons.slice(0, 5).join('. ')}. While these issues don't affect all guests equally, they're worth considering based on your specific needs and expectations. `;
    }

    // Best features expansion
    if (analysis.guest_insights.best_features.length > 0) {
      comprehensive += `\n\nThe property's standout features that guests consistently praise include ${analysis.guest_insights.best_features.join(', ')}. These elements seem to be reliably maintained and contribute significantly to positive guest experiences throughout their stays. `;
    }

    // Areas for improvement expansion
    if (analysis.guest_insights.areas_for_improvement.length > 0) {
      comprehensive += `Areas where the property could enhance the guest experience include ${analysis.guest_insights.areas_for_improvement.join(', ')}. Addressing these aspects could lead to even higher guest satisfaction and more consistent positive reviews. `;
    }

    // Recommended for expansion
    if (analysis.guest_insights.recommended_for.length > 0) {
      comprehensive += `\n\nBased on the feedback patterns, this property appears to be particularly well-suited for ${analysis.guest_insights.recommended_for.join(', ')}. These guest types have historically reported the highest satisfaction levels and found the property's offerings aligned well with their needs. `;
    }

    // Not recommended for expansion
    if (analysis.guest_insights.not_recommended_for.length > 0) {
      comprehensive += `Conversely, ${analysis.guest_insights.not_recommended_for.join(', ')} might want to carefully review the details and recent guest feedback, as some past visitors with similar profiles have noted challenges or mismatches with their expectations. `;
    }

    // Value and final verdict
    comprehensive += `\n\nIn terms of value for money, `;
    if (posPerc >= 75) {
      comprehensive += `the majority of guests feel they received good to excellent value for their investment. The property delivers on its promises and provides a satisfying experience that justifies the cost. `;
    } else if (posPerc >= 50) {
      comprehensive += `guest opinions are somewhat divided. While many feel they received fair value, others expected more for the price point. Setting appropriate expectations based on the listing details and recent reviews is recommended. `;
    } else {
      comprehensive += `several guests have questioned whether the property delivers adequate value for the price charged. Prospective guests should carefully evaluate whether this property meets their requirements and expectations at the current rate. `;
    }

    // Conclusion
    comprehensive += `Overall, with a trust score of ${analysis.trust_score} out of 100 and ${posPerc}% positive sentiment, `;
    if (analysis.trust_score >= 80) {
      comprehensive += `this property demonstrates a strong track record of guest satisfaction. The consistent positive feedback across multiple aspects suggests a reliable choice for travelers seeking accommodation in this area. `;
    } else if (analysis.trust_score >= 65) {
      comprehensive += `this property shows moderate performance with room for improvement. While many guests have enjoyed their stays, the mixed feedback suggests that experiences can vary. Reading recent reviews and confirming key details with the host before booking is advisable. `;
    } else {
      comprehensive += `this property shows significant challenges in meeting guest expectations. Potential guests should thoroughly research alternatives and carefully weigh the feedback before making a booking decision. `;
    }

    // Ensure minimum 2000 characters by adding more context if needed
    while (comprehensive.length < 2000) {
      comprehensive += `The analysis of ${totalReviews} reviews provides a comprehensive view of guest experiences. Patterns in the feedback suggest that the property has both strengths and areas for development. Prospective guests are encouraged to read through recent individual reviews to understand the full picture and determine if this property aligns with their specific needs, preferences, and travel purposes. Every traveler has unique requirements, and what works well for some may not suit others. The detailed breakdown of guest sentiment across different aspects can help inform your booking decision. `;
    }

    return comprehensive.trim();
  }

  /**
   * Ask a question about reviews using Language Model (Prompt API)
   *
   * IMPROVED LOGIC:
   * 1. Build/use in-memory JSON cache of 100 reviews (truncated to 500 chars each)
   * 2. Search sequentially through reviews in batches of 10
   * 3. Stop when answer is found OR all reviews searched
   * 4. Anti-hallucination: Explicitly instruct to say "not mentioned" if no answer
   * 5. Destroy session after use to free browser resources
   */
  async askQuestion(reviews, question, contextData = {}) {
    if (!reviews || reviews.length === 0) {
      return 'No reviews available to answer your question.';
    }

    try {
      console.log('TravanaSpot: Answering question with Prompt API:', question);

      // Build or use existing review cache
      if (!this.reviewCache) {
        this.buildReviewCache(reviews);
      }

      const totalReviews = this.reviewCache.reviews.length;
      const batchSize = 10; // Search 10 reviews at a time
      let answerFound = false;
      let finalAnswer = null;

      console.log(`TravanaSpot: Searching through ${totalReviews} cached reviews in batches of ${batchSize}`);

      // Initialize Language Model session ONCE for all batches
      this.languageModelSession = await this.initLanguageModelSession();

      // Sequential search through all reviews in batches
      for (let startIndex = 0; startIndex < totalReviews; startIndex += batchSize) {
        const batchNumber = Math.floor(startIndex / batchSize) + 1;
        const totalBatches = Math.ceil(totalReviews / batchSize);

        const reviewBatch = this.reviewCache.reviews.slice(startIndex, startIndex + batchSize);
        const reviewTexts = reviewBatch.map(r => r.text).join('\n---\n');

        console.log(`TravanaSpot: Searching batch ${batchNumber}/${totalBatches} (reviews ${startIndex + 1}-${startIndex + reviewBatch.length})`);

        // Enhanced prompt with better question understanding
        const prompt = `QUESTION: "${question}"

REVIEWS FROM GUESTS:
${reviewTexts}

CRITICAL INSTRUCTIONS:
1. Read the question CAREFULLY and understand EXACTLY what is being asked
2. If asking about "places to avoid AROUND" → Answer about NEIGHBORHOOD safety/areas, NOT property problems
3. If asking about "food nearby" → Mention SPECIFIC food types (Italian, Mexican, BBQ, etc.), not just "restaurants"
4. If asking about "things to do AROUND" → Focus on NEIGHBORHOOD attractions/activities
5. ONLY use information actually in these reviews
6. If answer NOT found, say: "NOT_FOUND_IN_THIS_BATCH"
7. NO review number citations
8. Answer the EXACT question asked, not something similar

Your answer:`;

        // Check token availability
        const promptTokens = this.estimateTokens(prompt);
        const availableTokens = this.languageModelSession.maxTokens - this.languageModelSession.tokensSoFar;

        if (promptTokens > availableTokens) {
          console.warn(`TravanaSpot: Insufficient tokens for batch ${batchNumber}, stopping search`);
          break;
        }

        // Query this batch
        const response = await this.languageModelSession.prompt(prompt);
        console.log(`TravanaSpot: Batch ${batchNumber} response:`, response.substring(0, 100) + '...');

        // Check if answer was found in this batch
        if (!response.includes('NOT_FOUND_IN_THIS_BATCH')) {
          console.log(`TravanaSpot: ✅ Answer found in batch ${batchNumber}!`);
          finalAnswer = response;
          answerFound = true;
          break; // Stop searching, we found the answer
        } else {
          console.log(`TravanaSpot: Answer not found in batch ${batchNumber}, continuing...`);
        }
      }

      // Destroy session to free resources
      if (this.languageModelSession) {
        console.log('TravanaSpot: Destroying Prompt API session to free resources...');
        await this.languageModelSession.destroy();
        this.languageModelSession = null;
      }

      // Return final result
      if (answerFound && finalAnswer) {
        return finalAnswer;
      } else {
        return 'Sorry, this information is not mentioned in the reviews. The guests did not discuss this topic in their feedback.';
      }

    } catch (error) {
      console.error('TravanaSpot: Question answering failed:', error);

      // Clean up session on error
      if (this.languageModelSession) {
        try {
          await this.languageModelSession.destroy();
          this.languageModelSession = null;
        } catch (destroyError) {
          console.error('TravanaSpot: Error destroying session:', destroyError);
        }
      }

      return `Sorry, I encountered an error: ${error.message}. Please make sure you have enabled the Prompt API in Chrome.`;
    }
  }

  // Generate summary using Summarizer API
  async generateSummary(reviews) {
    return this.analyzeReviews(reviews);
  }

  // Fallback analysis when AI is not available
  fallbackReviewAnalysis(reviews) {
    console.log('TravanaSpot: Using fallback review analysis');

    const reviewTexts = reviews.map(r => r.text || r.comments || '').filter(t => t.length > 10);

    // Simple keyword-based sentiment analysis
    const positiveWords = ['great', 'excellent', 'amazing', 'perfect', 'love', 'wonderful', 'fantastic', 'clean', 'comfortable', 'beautiful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'dirty', 'uncomfortable', 'noisy', 'poor', 'disappointing'];

    let positiveCount = 0;
    let negativeCount = 0;

    reviewTexts.forEach(text => {
      const lowerText = text.toLowerCase();
      positiveWords.forEach(word => {
        if (lowerText.includes(word)) positiveCount++;
      });
      negativeWords.forEach(word => {
        if (lowerText.includes(word)) negativeCount++;
      });
    });

    const total = positiveCount + negativeCount || 1;
    const positivePercentage = Math.round((positiveCount / total) * 100);
    const negativePercentage = Math.round((negativeCount / total) * 100);
    const neutralPercentage = 100 - positivePercentage - negativePercentage;

    // Extract themes from reviews and create professional statements
    const themes = {
      cleanliness: { positive: 0, negative: 0 },
      location: { positive: 0, negative: 0 },
      host: { positive: 0, negative: 0 },
      value: { positive: 0, negative: 0 },
      comfort: { positive: 0, negative: 0 },
      amenities: { positive: 0, negative: 0 },
      noiseLevels: { positive: 0, negative: 0 }
    };

    reviewTexts.forEach(text => {
      const lowerText = text.toLowerCase();

      if (lowerText.includes('clean') || lowerText.includes('tidy') || lowerText.includes('spotless')) {
        if (positiveWords.some(w => lowerText.includes(w))) themes.cleanliness.positive++;
        if (negativeWords.some(w => lowerText.includes(w))) themes.cleanliness.negative++;
      }
      if (lowerText.includes('location') || lowerText.includes('area') || lowerText.includes('convenient')) {
        if (positiveWords.some(w => lowerText.includes(w))) themes.location.positive++;
        if (negativeWords.some(w => lowerText.includes(w))) themes.location.negative++;
      }
      if (lowerText.includes('host') || lowerText.includes('communication') || lowerText.includes('responsive')) {
        if (positiveWords.some(w => lowerText.includes(w))) themes.host.positive++;
        if (negativeWords.some(w => lowerText.includes(w))) themes.host.negative++;
      }
      if (lowerText.includes('value') || lowerText.includes('price') || lowerText.includes('worth')) {
        if (positiveWords.some(w => lowerText.includes(w))) themes.value.positive++;
        if (negativeWords.some(w => lowerText.includes(w))) themes.value.negative++;
      }
      if (lowerText.includes('comfortable') || lowerText.includes('cozy') || lowerText.includes('bed')) {
        if (positiveWords.some(w => lowerText.includes(w))) themes.comfort.positive++;
        if (negativeWords.some(w => lowerText.includes(w))) themes.comfort.negative++;
      }
      if (lowerText.includes('amenities') || lowerText.includes('kitchen') || lowerText.includes('facilities')) {
        if (positiveWords.some(w => lowerText.includes(w))) themes.amenities.positive++;
        if (negativeWords.some(w => lowerText.includes(w))) themes.amenities.negative++;
      }
      if (lowerText.includes('noise') || lowerText.includes('noisy') || lowerText.includes('quiet') || lowerText.includes('loud') || lowerText.includes('peaceful')) {
        // For noise, "quiet" and "peaceful" are positive, "noisy" and "loud" are negative
        if (lowerText.includes('quiet') || lowerText.includes('peaceful')) themes.noiseLevels.positive++;
        if (lowerText.includes('noisy') || lowerText.includes('loud') || lowerText.includes('noise')) themes.noiseLevels.negative++;
      }
    });

    // Generate professional pros statements
    const actualPros = [];
    if (themes.cleanliness.positive > 2) actualPros.push('Excellent cleanliness standards maintained');
    if (themes.location.positive > 2) actualPros.push('Convenient location with good accessibility');
    if (themes.host.positive > 2) actualPros.push('Responsive and helpful host communication');
    if (themes.value.positive > 2) actualPros.push('Good value for money');
    if (themes.comfort.positive > 2) actualPros.push('Comfortable and welcoming atmosphere');
    if (themes.amenities.positive > 2) actualPros.push('Well-equipped with necessary amenities');
    if (themes.noiseLevels.positive > 2) actualPros.push('Quiet and peaceful environment');

    // Generate professional cons statements
    const actualCons = [];
    if (themes.cleanliness.negative > 1) actualCons.push('Some guests noted cleanliness concerns');
    if (themes.location.negative > 1) actualCons.push('Location may not suit all preferences');
    if (themes.host.negative > 1) actualCons.push('Host responsiveness could be improved');
    if (themes.value.negative > 1) actualCons.push('Value perception varies among guests');
    if (themes.comfort.negative > 1) actualCons.push('Comfort levels received mixed feedback');
    if (themes.amenities.negative > 1) actualCons.push('Amenities may need updating');
    if (themes.noiseLevels.negative > 1) actualCons.push('Noise levels mentioned as a concern');

    // Build guest_insights based on actual review content
    const guest_insights = {
      recommended_for: [],
      not_recommended_for: [],
      best_features: [],
      areas_for_improvement: []
    };

    // Detect recommended_for based on semantic indicators
    const allReviewsText = reviewTexts.join(' ').toLowerCase();

    if (allReviewsText.match(/famil(y|ies)|kid|child|toddler|baby|daughter|son/i)) {
      guest_insights.recommended_for.push('Families with children');
    }
    if (allReviewsText.match(/couple|romantic|anniversary|honeymoon/i)) {
      guest_insights.recommended_for.push('Couples');
    }
    if (allReviewsText.match(/business|work|conference|meeting/i)) {
      guest_insights.recommended_for.push('Business travelers');
    }
    if (allReviewsText.match(/solo|alone|myself|independent/i)) {
      guest_insights.recommended_for.push('Solo travelers');
    }
    if (allReviewsText.match(/group|friends|reunion|party/i)) {
      guest_insights.recommended_for.push('Groups of friends');
    }

    // Detect not_recommended_for
    if (allReviewsText.match(/noise|noisy|loud|hear|sound/i)) {
      guest_insights.not_recommended_for.push('Light sleepers');
    }
    if (allReviewsText.match(/stairs|climb|steep|uphill|no elevator|walk up/i)) {
      guest_insights.not_recommended_for.push('Guests with mobility issues');
    }
    if (allReviewsText.match(/small|tiny|cramped|tight/i) && allReviewsText.match(/space|room/i)) {
      guest_insights.not_recommended_for.push('Large groups');
    }

    // Best features from themes
    const bestFeatures = [];
    if (themes.cleanliness.positive > 2) bestFeatures.push('Cleanliness');
    if (themes.location.positive > 2) bestFeatures.push('Location');
    if (themes.host.positive > 2) bestFeatures.push('Host Communication');
    if (themes.value.positive > 2) bestFeatures.push('Value for Money');
    if (themes.comfort.positive > 2) bestFeatures.push('Comfort');
    if (themes.amenities.positive > 2) bestFeatures.push('Amenities');
    if (themes.noiseLevels.positive > 2) bestFeatures.push('Quiet Environment');
    guest_insights.best_features = bestFeatures;

    // Areas for improvement from negative themes
    const improvements = [];
    if (themes.cleanliness.negative > 1) improvements.push('Cleanliness');
    if (themes.location.negative > 1) improvements.push('Location');
    if (themes.host.negative > 1) improvements.push('Host Communication');
    if (themes.value.negative > 1) improvements.push('Value for Money');
    if (themes.comfort.negative > 1) improvements.push('Comfort');
    if (themes.amenities.negative > 1) improvements.push('Amenities');
    if (themes.noiseLevels.negative > 1) improvements.push('Noise Levels');
    guest_insights.areas_for_improvement = improvements;

    return {
      success: true,
      analysis_type: 'basic_analysis',
      trust_score: Math.min(90, Math.max(50, positivePercentage + 10)),
      sentiment_analysis: {
        positive_percentage: positivePercentage,
        neutral_percentage: neutralPercentage,
        negative_percentage: negativePercentage,
        overall_sentiment: positivePercentage > negativePercentage ? 'positive' : 'negative'
      },
      keyword_analysis: [], // Will be populated by Prompt API if available
      pros_and_cons: {
        pros: actualPros.slice(0, 7),
        cons: actualCons.slice(0, 7)
      },
      guest_insights: guest_insights,
      summary: `Based on analyzing ${reviews.length} guest reviews, this property demonstrates ${positivePercentage}% positive sentiment overall. ${actualPros.length > 0 ? 'Key strengths include: ' + actualPros.slice(0, 3).join(', ') + '. ' : ''}${actualCons.length > 0 ? 'Areas noted for potential improvement: ' + actualCons.slice(0, 3).join(', ') + '.' : ''} The property appears to ${positivePercentage >= 75 ? 'consistently meet guest expectations' : positivePercentage >= 50 ? 'generally satisfy most guests with some areas for enhancement' : 'have mixed reviews that potential guests should carefully consider'}.`,
      reviews_analyzed: reviews.length,
      message: 'Basic analysis (Browser AI not available - showing real data only)'
    };
  }

  // Cleanup sessions
  async destroy() {
    if (this.languageModelSession) {
      try {
        await this.languageModelSession.destroy();
        console.log('TravanaSpot: Language Model session destroyed');
      } catch (error) {
        console.error('TravanaSpot: Error destroying Language Model session:', error);
      }
      this.languageModelSession = null;
    }

    if (this.summarizerSession) {
      try {
        await this.summarizerSession.destroy();
        console.log('TravanaSpot: Summarizer session destroyed');
      } catch (error) {
        console.error('TravanaSpot: Error destroying Summarizer session:', error);
      }
      this.summarizerSession = null;
    }
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TravanaSpotBrowserAI;
} else {
  window.TravanaSpotGeminiAI = TravanaSpotBrowserAI; // Keep same name for compatibility
  window.TravanaSpotBrowserAI = TravanaSpotBrowserAI;
}
