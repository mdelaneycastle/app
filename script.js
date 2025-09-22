class GeoGuesser {
    constructor() {
        this.currentRound = 1;
        this.totalRounds = 10;
        this.score = 0;
        this.gameLocations = [];
        this.currentLocation = null;
        this.userGuess = null;
        this.map = null;
        this.streetView = null;
        this.guessMap = null;
        this.guessMarker = null;
        this.geocoder = null;
        this.placesService = null;
        this.hintUsed = false;
        
        this.initializeGame();
    }

    initializeGame() {
        this.geocoder = new google.maps.Geocoder();
        this.setupEventListeners();
        this.showScreen('setup-screen');
    }

    setupEventListeners() {
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        document.getElementById('submit-guess').addEventListener('click', () => this.submitGuess());
        document.getElementById('next-round').addEventListener('click', () => this.nextRound());
        document.getElementById('play-again').addEventListener('click', () => this.resetGame());
        document.getElementById('get-hint').addEventListener('click', () => this.showHint());
        document.getElementById('close-hint').addEventListener('click', () => this.closeHint());
    }

    async startGame() {
        const location = document.getElementById('location-input').value.trim();
        const radius = parseInt(document.getElementById('radius-input').value);

        if (!location) {
            alert('Please enter a location');
            return;
        }

        try {
            await this.generateGameLocations(location, radius);
            this.showScreen('game-screen');
            this.loadRound();
        } catch (error) {
            alert('Error setting up game: ' + error.message);
        }
    }

    async generateGameLocations(location, radiusMiles) {
        return new Promise((resolve, reject) => {
            this.geocoder.geocode({ address: location }, (results, status) => {
                if (status === 'OK') {
                    const center = results[0].geometry.location;
                    this.gameLocations = this.generateRandomLocations(center, radiusMiles, this.totalRounds);
                    resolve();
                } else {
                    reject(new Error('Could not find location: ' + location));
                }
            });
        });
    }

    generateRandomLocations(center, radiusMiles, count) {
        const locations = [];
        const radiusInDegrees = radiusMiles / 69; // Rough conversion

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.random() * radiusInDegrees;
            
            const lat = center.lat() + (distance * Math.cos(angle));
            const lng = center.lng() + (distance * Math.sin(angle));
            
            locations.push({ lat, lng });
        }
        
        return locations;
    }

    loadRound() {
        this.currentLocation = this.gameLocations[this.currentRound - 1];
        document.getElementById('current-round').textContent = this.currentRound;
        this.hintUsed = false;
        document.getElementById('get-hint').disabled = false;
        document.getElementById('hint-panel').classList.add('hidden');
        
        this.initializeStreetView();
        this.initializeGuessMap();
    }

    initializeStreetView() {
        const streetViewOptions = {
            position: this.currentLocation,
            pov: {
                heading: Math.random() * 360,
                pitch: 0
            },
            zoom: 1,
            addressControl: false,
            fullscreenControl: true,
            motionTracking: false,
            motionTrackingControl: false,
            panControl: true,
            zoomControl: true,
            clickToGo: true,
            scrollwheel: true,
            disableDoubleClickZoom: false
        };
    
        this.streetView = new google.maps.StreetViewPanorama(
            document.getElementById('streetview'),
            streetViewOptions
        );
    
        // 👇 reattach the label hider every round
        hideStreetViewLabels();
    }

    initializeGuessMap() {
        this.guessMap = new google.maps.Map(document.getElementById('guess-map'), {
            zoom: 2,
            center: { lat: 20, lng: 0 },
            mapTypeControl: false,
            streetViewControl: false
        });

        this.guessMap.addListener('click', (event) => {
            this.placeGuessMarker(event.latLng);
        });

        // Initialize Places service for hints (fallback to simple text hints if Places API not available)
    }

    placeGuessMarker(position) {
        if (this.guessMarker) {
            this.guessMarker.setMap(null);
        }

        this.guessMarker = new google.maps.Marker({
            position: position,
            map: this.guessMap,
            title: 'Your Guess'
        });

        this.userGuess = position;
        document.getElementById('submit-guess').disabled = false;
    }

    submitGuess() {
        if (!this.userGuess) return;

        const distance = this.calculateDistance(this.currentLocation, this.userGuess);
        const roundScore = this.calculateScore(distance);
        this.score += roundScore;

        document.getElementById('current-score').textContent = this.score;

        this.showRoundResult(distance, roundScore);
    }

    calculateDistance(pos1, pos2) {
        const R = 3959; // Earth's radius in miles
        const dLat = this.toRad(pos2.lat() - pos1.lat);
        const dLon = this.toRad(pos2.lng() - pos1.lng);
        const lat1 = this.toRad(pos1.lat);
        const lat2 = this.toRad(pos2.lat());

        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(Value) {
        return Value * Math.PI / 180;
    }

    calculateScore(distance) {
        if (distance < 1) return 5000;
        if (distance < 10) return Math.round(5000 - (distance * 400));
        if (distance < 50) return Math.round(3000 - (distance * 50));
        if (distance < 200) return Math.round(1000 - (distance * 4));
        return 0;
    }

    showRoundResult(distance, roundScore) {
        const resultDetails = document.getElementById('result-details');
        resultDetails.innerHTML = `
            <p>Distance: ${distance.toFixed(1)} miles</p>
            <p>Round Score: ${roundScore} points</p>
            <p>Total Score: ${this.score} points</p>
        `;

        this.showResultMaps();
        this.showScreen('result-screen');
    }

    showResultMaps() {
        // Show user's guess
        const guessResultMap = new google.maps.Map(document.getElementById('guess-result-map'), {
            zoom: 10,
            center: this.userGuess
        });
        new google.maps.Marker({
            position: this.userGuess,
            map: guessResultMap,
            title: 'Your Guess'
        });

        // Show actual location
        const actualResultMap = new google.maps.Map(document.getElementById('actual-result-map'), {
            zoom: 10,
            center: this.currentLocation
        });
        new google.maps.Marker({
            position: this.currentLocation,
            map: actualResultMap,
            title: 'Actual Location'
        });
    }

    nextRound() {
        this.currentRound++;
        this.userGuess = null;
        
        if (this.currentRound > this.totalRounds) {
            this.showFinalScore();
        } else {
            this.showScreen('game-screen');
            this.loadRound();
        }
    }

    showFinalScore() {
        const finalScore = document.getElementById('final-score');
        const percentage = Math.round((this.score / 50000) * 100);
        finalScore.innerHTML = `
            <h3>Final Score: ${this.score} / 50,000</h3>
            <p>Accuracy: ${percentage}%</p>
        `;
        this.showScreen('final-screen');
    }

    resetGame() {
        this.currentRound = 1;
        this.score = 0;
        this.gameLocations = [];
        this.userGuess = null;
        document.getElementById('current-score').textContent = '0';
        document.getElementById('submit-guess').disabled = true;
        this.showScreen('setup-screen');
    }

    showHint() {
        if (this.hintUsed) return;
        
        this.hintUsed = true;
        document.getElementById('get-hint').disabled = true;
        document.getElementById('hint-panel').classList.remove('hidden');
        
        this.findNearbyPlaces();
    }

    closeHint() {
        document.getElementById('hint-panel').classList.add('hidden');
    }

    async findNearbyPlaces() {
        const hintContent = document.getElementById('hint-content');
        hintContent.innerHTML = '<div class="hint-loading">Looking for nearby places...</div>';

        const searches = [
            { type: 'supermarket', name: 'Supermarket' },
            { type: 'school', name: 'School' },
            { type: 'bar', name: 'Nearest Pub' }
        ];

        try {
            const results = await Promise.all(searches.map(search => this.searchNearbyPlaceNew(search)));
            this.displayHints(results);
        } catch (error) {
            hintContent.innerHTML = '<div class="hint-item">Error loading hints. Try again later.</div>';
        }
    }

    async searchNearbyPlaceNew(searchParams) {
        const apiKey = 'AIzaSyA3EgrMZPA95rxuy9xh-TxkxFhTn4sIH0U';
        const url = 'https://places.googleapis.com/v1/places:searchNearby';
        
        const requestBody = {
            includedTypes: [searchParams.type],
            locationRestriction: {
                circle: {
                    center: {
                        latitude: this.currentLocation.lat,
                        longitude: this.currentLocation.lng
                    },
                    radius: 2000
                }
            },
            maxResultCount: 1,
            rankPreference: 'DISTANCE'
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.displayName,places.location'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            
            if (data.places && data.places.length > 0) {
                const place = data.places[0];
                const distance = this.calculateDistance(
                    this.currentLocation,
                    { 
                        lat: () => place.location.latitude, 
                        lng: () => place.location.longitude 
                    }
                );
                
                return {
                    name: searchParams.name,
                    place: place.displayName?.text || 'Unknown place',
                    distance: distance
                };
            } else {
                return {
                    name: searchParams.name,
                    place: 'None found nearby',
                    distance: null
                };
            }
        } catch (error) {
            return {
                name: searchParams.name,
                place: 'Error searching',
                distance: null
            };
        }
    }

    displayHints(hints) {
        const hintContent = document.getElementById('hint-content');
        hintContent.innerHTML = hints.map(hint => `
            <div class="hint-item">
                <strong>${hint.name}:</strong> ${hint.place}
                ${hint.distance ? ` (${hint.distance.toFixed(1)} miles away)` : ''}
            </div>
        `).join('');
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new GeoGuesser();
});

// Auto-hide Street View road labels (road names, addresses, etc.)
function hideStreetViewLabels() {
    const streetview = document.getElementById("streetview");
    if (!streetview) return;

    const observer = new MutationObserver(() => {
        streetview.querySelectorAll(
            ".gm-iv-address, .gm-iv-short-address, .gm-iv-labels, .gm-iv-marker, .gm-iv-roadsign"
        ).forEach(el => {
            el.style.display = "none";
        });
    });

    observer.observe(streetview, {
        childList: true,
        subtree: true
    });
}

// Run once page is ready
window.addEventListener("load", hideStreetViewLabels);
