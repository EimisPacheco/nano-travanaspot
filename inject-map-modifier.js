// TravanaSpot - Map Modifier Script
// This script runs in the context of the webpage to interact with embedded Google Maps

(function() {
    'use strict';
    
    // Map modifier script loaded silently
    
    // Expose individual control functions for the panel buttons (available immediately)
    window.travanaSpotToggleSatellite = function() {
        const satelliteContainer = document.getElementById('travanaspot-satellite-overlay');
        if (satelliteContainer) {
            if (satelliteContainer.style.opacity === '1') {
                // Hide satellite, show original map
                satelliteContainer.style.opacity = '0';
                satelliteContainer.style.pointerEvents = 'none';
                
                // Show original map container
                if (satelliteContainer.originalMapContainer) {
                    satelliteContainer.originalMapContainer.style.display = '';
                    satelliteContainer.originalMapContainer.style.pointerEvents = 'auto';
                }
                
                // Reset fullscreen if satellite was in fullscreen
                if (satelliteContainer.style.position === 'fixed') {
                    satelliteContainer.style.position = 'absolute';
                    satelliteContainer.style.width = '100%';
                    satelliteContainer.style.height = '100%';
                    satelliteContainer.style.top = '0';
                    satelliteContainer.style.left = '0';
                    satelliteContainer.style.zIndex = '9999';
                    satelliteContainer.style.borderRadius = '8px';
                }
            } else {
                // Show satellite, hide original map
                satelliteContainer.style.opacity = '1';
                satelliteContainer.style.pointerEvents = 'auto';
                
                // Hide original map container
                if (satelliteContainer.originalMapContainer) {
                    satelliteContainer.originalMapContainer.style.display = 'none';
                    satelliteContainer.originalMapContainer.style.pointerEvents = 'none';
                }
            }
        } else {
            // Create overlay if it doesn't exist
            createSatelliteMapOverlay();
            // Try again after a short delay
            setTimeout(() => {
                const newSatelliteContainer = document.getElementById('travanaspot-satellite-overlay');
                if (newSatelliteContainer) {
                    newSatelliteContainer.style.opacity = '1';
                    newSatelliteContainer.style.pointerEvents = 'auto';
                    
                    if (newSatelliteContainer.originalMapContainer) {
                        newSatelliteContainer.originalMapContainer.style.display = 'none';
                        newSatelliteContainer.originalMapContainer.style.pointerEvents = 'none';
                    }
                }
            }, 500);
        }
    };
    
    window.travanaSpotToggleFullscreen = function() {
        const satelliteContainer = document.getElementById('travanaspot-satellite-overlay');
        if (satelliteContainer) {
            if (satelliteContainer.style.position === 'fixed') {
                // Exit fullscreen
                satelliteContainer.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 9999;
                    background: white;
                    opacity: ${satelliteContainer.style.opacity || '0'};
                    transition: opacity 0.3s ease;
                    pointer-events: ${satelliteContainer.style.pointerEvents || 'none'};
                    border-radius: 8px;
                `;
            } else {
                // Enter fullscreen
                satelliteContainer.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: 10000;
                    background: white;
                    opacity: ${satelliteContainer.style.opacity || '0'};
                    transition: opacity 0.3s ease;
                    pointer-events: ${satelliteContainer.style.pointerEvents || 'none'};
                    border-radius: 0;
                `;
            }
        } else {
            // Create overlay if it doesn't exist
            createSatelliteMapOverlay();
        }
    };
    
    // Function to replace static map with interactive map
    function replaceStaticMapWithInteractive() {
        // Method 1: Look for static map images
        const staticMapImages = document.querySelectorAll('img[src*="maps.googleapis.com/maps/api/staticmap"], img[data-testid="map/GoogleMapStatic"]');
        
        // Method 2: Look for Airbnb's map container
        const airbnbMapContainers = document.querySelectorAll('[data-testid*="map"], [class*="map"], [id*="map"]');
        
        // Method 3: Look for the specific Airbnb map structure
        const airbnbMapSection = document.querySelector('[data-section-id*="LOCATION"], [data-testid*="location"], [class*="location"]');
        
        let mapsProcessed = 0;
        
        // Process static map images
        staticMapImages.forEach((img, index) => {
            // Check if this image has already been processed
            if (img.dataset.travanaspotProcessed === 'true') {
                return;
            }
            
            // Extract coordinates from the static map URL
            const src = img.src;
            const centerMatch = src.match(/center=([^&]+)/);
            const zoomMatch = src.match(/zoom=(\d+)/);
            
            if (centerMatch) {
                const center = decodeURIComponent(centerMatch[1]);
                const zoom = zoomMatch ? parseInt(zoomMatch[1]) : 14;
                
                // Mark this image as processed
                img.dataset.travanaspotProcessed = 'true';
                
                // Create a container for the interactive map
                const mapContainer = document.createElement('div');
                mapContainer.style.width = '100%';
                mapContainer.style.height = '400px';
                mapContainer.style.position = 'relative';
                mapContainer.style.borderRadius = '8px';
                mapContainer.style.overflow = 'hidden';
                mapContainer.id = `travanaspot-interactive-map-${index}`;
                
                // Create a wrapper to maintain the original image's styling
                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';
                wrapper.style.width = '100%';
                wrapper.style.height = '400px';
                
                // Replace the static image with the container
                if (img.parentNode) {
                    img.parentNode.insertBefore(wrapper, img);
                    wrapper.appendChild(mapContainer);
                    img.style.display = 'none';
                    
                    console.log(`TravanaSpot: Created map container for image ${index}`);
                    
                    // Load Google Maps API if not already loaded
                    if (typeof google === 'undefined' || !google.maps) {
                        console.log('TravanaSpot: Loading Google Maps API...');
                        const script = document.createElement('script');
                        script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyCrpUPhpbPzRI4hYC7xE02WKsrxQv0HClI&libraries=places&callback=travanaSpotMapCallback`;
                        script.onerror = (error) => {
                            console.error('TravanaSpot: Failed to load Google Maps API:', error);
                        };
                        
                        // Create a global callback function
                        window.travanaSpotMapCallback = function() {
                            console.log('TravanaSpot: Google Maps API loaded successfully');
                            createInteractiveMap(mapContainer, center, zoom);
                        };
                        
                        document.head.appendChild(script);
                    } else {
                        console.log('TravanaSpot: Google Maps API already loaded');
                        createInteractiveMap(mapContainer, center, zoom);
                    }
                    
                    mapsProcessed++;
                } else {
                    console.error(`TravanaSpot: Could not find parent node for image ${index}`);
                }
            } else {
                console.log(`TravanaSpot: Could not extract coordinates from image ${index}`);
            }
        });
        
        // Method 4: Try to find coordinates from the page content
        if (mapsProcessed === 0) {
            // console.log('TravanaSpot: No static maps found, trying to extract coordinates from page content...');
            
            // Look for coordinates in the page text
            const pageText = document.body.textContent;
            const coordPatterns = [
                /(\d+\.\d+),\s*(\d+\.\d+)/g,  // 29.4553, -98.5327
                /lat[itude]*[:\s]*(\d+\.\d+).*?lng[itude]*[:\s]*(\d+\.\d+)/gi,  // latitude: 29.4553 longitude: -98.5327
                /coordinates[:\s]*(\d+\.\d+)[,\s]*(\d+\.\d+)/gi  // coordinates: 29.4553, -98.5327
            ];
            
            let foundCoords = null;
            for (const pattern of coordPatterns) {
                const match = pageText.match(pattern);
                if (match) {
                    foundCoords = match[0];
                    console.log(`TravanaSpot: Found coordinates in page text: ${foundCoords}`);
                    break;
                }
            }
            
            // If we found coordinates, try to create a map in the location section
            if (foundCoords && airbnbMapSection) {
                console.log('TravanaSpot: Creating map in location section...');
                
                const mapContainer = document.createElement('div');
                mapContainer.style.width = '100%';
                mapContainer.style.height = '400px';
                mapContainer.style.position = 'relative';
                mapContainer.style.borderRadius = '8px';
                mapContainer.style.overflow = 'hidden';
                mapContainer.style.margin = '20px 0';
                mapContainer.id = 'travanaspot-location-map';
                
                // Insert the map container into the location section
                airbnbMapSection.appendChild(mapContainer);
                
                // Extract coordinates
                const coords = foundCoords.match(/(\d+\.\d+)[,\s]*(\d+\.\d+)/);
                if (coords) {
                    const center = `${coords[1]},${coords[2]}`;
                    const zoom = 14;
                    
                    console.log(`TravanaSpot: Creating map with coordinates: ${center}`);
                    
                    // Load Google Maps API if not already loaded
                    if (typeof google === 'undefined' || !google.maps) {
                        console.log('TravanaSpot: Loading Google Maps API...');
                        const script = document.createElement('script');
                        script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyCrpUPhpbPzRI4hYC7xE02WKsrxQv0HClI&libraries=places&callback=travanaSpotMapCallback`;
                        script.onerror = (error) => {
                            console.error('TravanaSpot: Failed to load Google Maps API:', error);
                        };
                        
                        // Create a global callback function
                        window.travanaSpotMapCallback = function() {
                            console.log('TravanaSpot: Google Maps API loaded successfully');
                            createInteractiveMap(mapContainer, center, zoom);
                        };
                        
                        document.head.appendChild(script);
                    } else {
                        console.log('TravanaSpot: Google Maps API already loaded');
                        createInteractiveMap(mapContainer, center, zoom);
                    }
                    
                    mapsProcessed++;
                }
            }
        }
        
        // console.log(`TravanaSpot: Total maps processed: ${mapsProcessed}`);
        return mapsProcessed;
    }
    
    // Function to create interactive map
    function createInteractiveMap(container, center, zoom) {
        try {
            console.log(`TravanaSpot: Creating interactive map for coordinates: ${center}, zoom: ${zoom}`);
            
            const [lat, lng] = center.split(',').map(coord => parseFloat(coord.trim()));
            
            if (isNaN(lat) || isNaN(lng)) {
                throw new Error(`Invalid coordinates: ${center}`);
            }
            
            console.log(`TravanaSpot: Parsed coordinates - lat: ${lat}, lng: ${lng}`);
            
            const mapOptions = {
                center: { lat, lng },
                zoom: zoom,
                mapTypeId: google.maps.MapTypeId.SATELLITE, // Start with satellite view
                mapTypeControl: true,
                streetViewControl: true,
                fullscreenControl: true,
                zoomControl: true,
                scrollwheel: true,
                disableDoubleClickZoom: false
            };
            
            console.log('TravanaSpot: Creating Google Maps instance...');
            const map = new google.maps.Map(container, mapOptions);
            
            // Add a marker at the center
            const marker = new google.maps.Marker({
                position: { lat, lng },
                map: map,
                title: 'Property Location',
                animation: google.maps.Animation.DROP
            });
            
            console.log(`TravanaSpot: Successfully created interactive satellite map at ${lat}, ${lng}`);
            
            // Store the map instance for potential future modifications
            container.travanaSpotMap = map;
            
            // Add a success indicator
            const successDiv = document.createElement('div');
            successDiv.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(0, 128, 0, 0.8);
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000;
            `;
            successDiv.textContent = '🛰️ Satellite View Active';
            container.appendChild(successDiv);
            
            // Remove the success indicator after 3 seconds
            setTimeout(() => {
                if (successDiv.parentNode) {
                    successDiv.remove();
                }
            }, 3000);
            
        } catch (error) {
            console.error('TravanaSpot: Error creating interactive map:', error);
            
            // Show error message on the container
            container.innerHTML = `
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    background: #f8f9fa;
                    color: #dc3545;
                    font-size: 14px;
                    text-align: center;
                    padding: 20px;
                ">
                    <div>
                        <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
                        <div>Failed to load interactive map</div>
                        <div style="font-size: 12px; margin-top: 5px;">${error.message}</div>
                    </div>
                </div>
            `;
        }
    }
    
    // Function to find and modify Google Maps instances (new overlay approach)
    function findAndModifyGoogleMaps() {
        let mapsModified = 0;
        
        // console.log('TravanaSpot: Starting map modification (overlay approach)...');
        
        // Method 1: Replace static maps with interactive ones (keep this)
        replaceStaticMapWithInteractive();
        
        // Method 2: Create satellite map overlay on existing interactive maps
        createSatelliteMapOverlay();
        
        // Method 3: Add floating controls
        addFloatingMapControls();
        
        return mapsModified;
    }
    
    // Function to replace the original map with satellite view
    function createSatelliteMapOverlay() {
        try {
            // Find the main Google Maps container
            const mapContainer = document.querySelector('[data-testid="map/GoogleMap"]');
            if (!mapContainer) {
                // console.log('TravanaSpot: No Google Maps container found');
                return;
            }
            
            // Creating satellite replacement...
            
            // Remove existing overlay if any
            const existingOverlay = document.getElementById('travanaspot-satellite-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
            
            // Create satellite map container
            const satelliteContainer = document.createElement('div');
            satelliteContainer.id = 'travanaspot-satellite-overlay';
            satelliteContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
                background: white;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
                border-radius: 8px;
                overflow: hidden;
            `;
            
            // Store reference to original map container
            satelliteContainer.originalMapContainer = mapContainer;
            
            // Create the satellite map iframe
            const satelliteFrame = document.createElement('iframe');
            satelliteFrame.style.cssText = `
                width: 100%;
                height: 100%;
                border: none;
                border-radius: 8px;
                pointer-events: auto;
            `;
            
            // Extract city from the Airbnb listing
            const city = extractCityFromListing();
            const embedUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyB9jxCpFclGwigqmjBZkam0OfRipy8x5sw&q=${encodeURIComponent(city)}&zoom=15&maptype=satellite`;
            satelliteFrame.src = embedUrl;
            
            satelliteContainer.appendChild(satelliteFrame);
            
            // No controls on the map itself - all controls are in the floating panel
            
            // No controls on the map itself - all controls are in the floating panel
            
            // Add to the map container's parent to ensure proper positioning
            const mapParent = mapContainer.parentElement;
            if (mapParent) {
                mapParent.style.position = 'relative';
                mapParent.appendChild(satelliteContainer);
            } else {
                mapContainer.appendChild(satelliteContainer);
            }
            
            // Satellite map overlay created
            
        } catch (e) {
            // Error creating satellite overlay
        }
    }
    
    // Function to extract city from the Airbnb listing
    function extractCityFromListing() {
        try {
            // Extracting city from Airbnb listing...
            
            // Method 1: Look for the location in the listing title/header
            const titleElement = document.querySelector('h1[elementtiming="LCP-target"]');
            if (titleElement) {
                const titleText = titleElement.textContent;
                // Found title
                
                // Look for "in [City], [State]" pattern
                const cityMatch = titleText.match(/in\s+([^,]+),\s*([^,]+)/i);
                if (cityMatch) {
                    const city = cityMatch[1].trim();
                    const state = cityMatch[2].trim();
                    return `${city}, ${state}`;
                }
            }
            
            // Method 2: Look for location in the overview section
            const overviewSection = document.querySelector('[data-section-id="OVERVIEW_DEFAULT_V2"]');
            if (overviewSection) {
                const locationElement = overviewSection.querySelector('h2');
                if (locationElement) {
                    const locationText = locationElement.textContent;
                    // Found location
                    
                    // Look for city, state pattern
                    const cityMatch = locationText.match(/([^,]+),\s*([^,]+)/);
                    if (cityMatch) {
                        const city = cityMatch[1].trim();
                        const state = cityMatch[2].trim();
                        return `${city}, ${state}`;
                    }
                }
            }
            
            // Method 3: Look for any text with city, state pattern
            const allText = document.body.textContent;
            const cityMatches = allText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})/g);
            if (cityMatches && cityMatches.length > 0) {
                // Take the first match that looks like a city
                const firstMatch = cityMatches[0];
                console.log(`TravanaSpot: Found city pattern: ${firstMatch}`);
                return firstMatch;
            }
            
            // Method 4: Look for city in the page URL or meta tags
            const metaLocation = document.querySelector('meta[property="og:title"], meta[name="description"]');
            if (metaLocation) {
                const metaText = metaLocation.getAttribute('content') || metaLocation.getAttribute('value');
                if (metaText) {
                    const cityMatch = metaText.match(/in\s+([^,]+),\s*([^,]+)/i);
                    if (cityMatch) {
                        const city = cityMatch[1].trim();
                        const state = cityMatch[2].trim();
                        console.log(`TravanaSpot: Extracted city from meta: ${city}, ${state}`);
                        return `${city}, ${state}`;
                    }
                }
            }
            
            // Fallback: Default to San Antonio
            console.log('TravanaSpot: Could not extract city, using default: San Antonio, Texas');
            return 'San Antonio, Texas';
            
        } catch (e) {
            console.log('TravanaSpot: Error extracting city:', e.message);
            return 'San Antonio, Texas'; // Default fallback
        }
    }
    
    // Function to add floating controls
    function addFloatingMapControls() {
        try {
            // Remove existing controls if any
            const existingControls = document.getElementById('travanaspot-floating-controls');
            if (existingControls) {
                existingControls.remove();
            }
            
            // Find map area - use more flexible selectors
            const mapArea = document.querySelector('[data-testid="map/GoogleMap"]') ||
                           document.querySelector('div[style*="cursor: url"]') ||
                           document.querySelector('canvas[width][height]') ||
                           document.querySelector('iframe[src*="maps"]') ||
                           document.querySelector('[data-section-id*="LOCATION"]') ||
                           document.querySelector('[class*="map"]');
            
            // If no specific map area found, just add controls to the page
            if (!mapArea) {
                // Add controls anyway - they'll work with the satellite overlay
            }
            
            // Create floating controls
            
            // Create floating controls
            const controls = document.createElement('div');
            controls.id = 'travanaspot-floating-controls';
            controls.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 8px;
                background: rgba(0, 0, 0, 0.8);
                padding: 12px;
                border-radius: 8px;
                backdrop-filter: blur(10px);
            `;
            
            // Satellite toggle button
            const satelliteBtn = document.createElement('button');
            satelliteBtn.innerHTML = '🛰️ Toggle Satellite';
            satelliteBtn.style.cssText = `
                background: #ff385c;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
                transition: background-color 0.2s;
            `;
            
            satelliteBtn.addEventListener('click', function() {
                const satelliteContainer = document.getElementById('travanaspot-satellite-overlay');
                if (satelliteContainer) {
                    if (satelliteContainer.style.opacity === '1') {
                        // Hide satellite, show original map
                        satelliteContainer.style.opacity = '0';
                        satelliteContainer.style.pointerEvents = 'none';
                        
                        // Show original map container
                        if (satelliteContainer.originalMapContainer) {
                            satelliteContainer.originalMapContainer.style.display = '';
                            satelliteContainer.originalMapContainer.style.pointerEvents = 'auto';
                        }
                        
                        // Reset fullscreen button state if satellite was in fullscreen
                        if (satelliteContainer.style.position === 'fixed') {
                            satelliteContainer.style.position = 'absolute';
                            satelliteContainer.style.width = '100%';
                            satelliteContainer.style.height = '100%';
                            satelliteContainer.style.top = '0';
                            satelliteContainer.style.left = '0';
                            satelliteContainer.style.zIndex = '9999';
                            satelliteContainer.style.borderRadius = '8px';
                            
                            // Update fullscreen button state
                            fullscreenBtn.innerHTML = '⛶ Fullscreen Map';
                            fullscreenBtn.style.background = '#3b82f6';
                        }
                        
                        satelliteBtn.style.background = '#ff385c';
                    } else {
                        // Show satellite, hide original map
                        satelliteContainer.style.opacity = '1';
                        satelliteContainer.style.pointerEvents = 'auto';
                        
                        // Hide original map container
                        if (satelliteContainer.originalMapContainer) {
                            satelliteContainer.originalMapContainer.style.display = 'none';
                            satelliteContainer.originalMapContainer.style.pointerEvents = 'none';
                        }
                        
                        satelliteBtn.style.background = '#22c55e';
                    }
                } else {
                    createSatelliteMapOverlay();
                }
            });
            
            // Add fullscreen button to floating controls
            const fullscreenBtn = document.createElement('button');
            fullscreenBtn.innerHTML = '⛶ Fullscreen Map';
            fullscreenBtn.style.cssText = `
                background: #3b82f6;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
                transition: background-color 0.2s;
            `;
            
            fullscreenBtn.addEventListener('click', function() {
                const satelliteContainer = document.getElementById('travanaspot-satellite-overlay');
                if (satelliteContainer) {
                    if (satelliteContainer.style.position === 'fixed') {
                        // Exit fullscreen
                        satelliteContainer.style.cssText = `
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            z-index: 1000;
                            background: transparent;
                            opacity: ${satelliteContainer.style.opacity || '0'};
                            transition: opacity 0.3s ease;
                            pointer-events: ${satelliteContainer.style.pointerEvents || 'none'};
                        `;
                        fullscreenBtn.innerHTML = '⛶ Fullscreen Map';
                        fullscreenBtn.style.background = '#3b82f6';
                    } else {
                        // Enter fullscreen
                        satelliteContainer.style.cssText = `
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100vw;
                            height: 100vh;
                            z-index: 10000;
                            background: transparent;
                            opacity: ${satelliteContainer.style.opacity || '0'};
                            transition: opacity 0.3s ease;
                            pointer-events: ${satelliteContainer.style.pointerEvents || 'none'};
                        `;
                        fullscreenBtn.innerHTML = '⛶ Exit Fullscreen';
                        fullscreenBtn.style.background = '#ef4444';
                    }
                } else {
                    createSatelliteMapOverlay();
                }
            });
            
            // Removed fullscreen and satellite buttons as requested
            // controls.appendChild(fullscreenBtn);
            // controls.appendChild(satelliteBtn);
            
            // Don't append controls since we're not adding any buttons
            // document.body.appendChild(controls);
            
            // Floating map controls added
            
        } catch (e) {
            // Error adding floating controls
        }
    }
    

    
    // Function to wait for Google Maps to load and then modify
    function waitForGoogleMapsAndModify() {
        let attempts = 0;
        const maxAttempts = 20;
        
        const attemptModification = () => {
            attempts++;
            console.log(`TravanaSpot: Attempt ${attempts} to modify maps`);
            
            const mapsModified = findAndModifyGoogleMaps();
            
            if (mapsModified > 0) {
                console.log(`TravanaSpot: Successfully modified ${mapsModified} map(s) to satellite view`);
                return true;
            }
            
            if (attempts >= maxAttempts) {
                console.log('TravanaSpot: Failed to modify maps after maximum attempts');
                return false;
            }
            
            // Try again in 1 second
            setTimeout(attemptModification, 1000);
        };
        
        attemptModification();
    }
    
    // Function to be called from the content script
    window.travanaSpotModifyMaps = function() {
        // Map modification requested
        
        // Check if we're on the test page
        const isTestPage = window.location.href.includes('test-map-functionality.html');
        
        // Show a visual indicator that the extension is working
        const indicator = document.createElement('div');
        indicator.id = 'travanaspot-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            background: #ff385c;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 10001;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        indicator.textContent = '🛰️ Loading...';
        document.body.appendChild(indicator);
        
        // Remove indicator after 3 seconds
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.remove();
            }
        }, 3000);
        
        // Try to modify maps
        const mapsProcessed = findAndModifyGoogleMaps();
        
        // Always create satellite overlay for panel controls to work
        createSatelliteMapOverlay();
    };
    

    

    

    
    // Function to reset maps to default view
    window.travanaSpotResetMaps = function() {
        // Remove our interactive maps and show original static maps
        const ourMaps = document.querySelectorAll('[id^="travanaspot-interactive-map-"]');
        ourMaps.forEach((container, index) => {
            // Find the original static image that was hidden
            const originalImg = container.previousElementSibling;
            if (originalImg && originalImg.tagName === 'IMG' && originalImg.src.includes('staticmap')) {
                originalImg.style.display = '';
                container.remove();
            }
        });
        
        // Reset any interactive maps to default view
        if (typeof google !== 'undefined' && google.maps) {
            const allMaps = document.querySelectorAll('[id^="travanaspot-interactive-map-"]');
            allMaps.forEach((container, index) => {
                if (container.travanaSpotMap) {
                    container.travanaSpotMap.setMapTypeId(google.maps.MapTypeId.ROADMAP);
                }
            });
        }
    };
    

    
    // Auto-execute if the script is loaded after the page is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => window.travanaSpotModifyMaps(), 1000);
        });
    } else {
        setTimeout(() => window.travanaSpotModifyMaps(), 1000);
    }
    
})(); 