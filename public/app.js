class CloudBrowserClient {
    constructor() {
        this.sessionId = null;
        this.baseUrl = window.location.origin;
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        // Status elements
        this.statusElement = document.getElementById('status');
        this.sessionIdInput = document.getElementById('sessionId');
        this.browserContent = document.getElementById('browserContent');
        this.coordinateDisplay = document.getElementById('coordinateDisplay');

        // Session management
        this.createSessionBtn = document.getElementById('createSessionBtn');
        this.closeSessionBtn = document.getElementById('closeSessionBtn');

        // Navigation
        this.urlInput = document.getElementById('urlInput');
        this.navigateBtn = document.getElementById('navigateBtn');
        this.screenshotBtn = document.getElementById('screenshotBtn');

        // Interaction
        this.textInput = document.getElementById('textInput');
        this.typeBtn = document.getElementById('typeBtn');
        this.scrollInput = document.getElementById('scrollInput');
        this.scrollDownBtn = document.getElementById('scrollDownBtn');
        this.scrollUpBtn = document.getElementById('scrollUpBtn');

        // JavaScript execution
        this.scriptInput = document.getElementById('scriptInput');
        this.executeBtn = document.getElementById('executeBtn');
        this.scriptResult = document.getElementById('scriptResult');
    }

    attachEventListeners() {
        // Session management
        this.createSessionBtn.addEventListener('click', () => this.createSession());
        this.closeSessionBtn.addEventListener('click', () => this.closeSession());

        // Navigation
        this.navigateBtn.addEventListener('click', () => this.navigate());
        this.screenshotBtn.addEventListener('click', () => this.takeScreenshot());
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.navigate();
        });

        // Interaction
        this.typeBtn.addEventListener('click', () => this.typeText());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.typeText();
        });
        this.scrollDownBtn.addEventListener('click', () => this.scroll(true));
        this.scrollUpBtn.addEventListener('click', () => this.scroll(false));

        // JavaScript execution
        this.executeBtn.addEventListener('click', () => this.executeScript());

        // Mouse tracking for coordinates
        document.addEventListener('mousemove', (e) => this.updateCoordinates(e));
    }

    updateCoordinates(event) {
        const browserScreen = document.querySelector('.browser-screen');
        if (browserScreen && this.sessionId) {
            const rect = browserScreen.getBoundingClientRect();
            const x = Math.round(event.clientX - rect.left);
            const y = Math.round(event.clientY - rect.top);
            
            if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
                this.coordinateDisplay.textContent = `${x}, ${y}`;
                this.coordinateDisplay.classList.remove('hidden');
            } else {
                this.coordinateDisplay.classList.add('hidden');
            }
        }
    }

    async makeRequest(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('Request failed:', error);
            this.showError(error.message);
            throw error;
        }
    }

    async createSession() {
        try {
            this.setLoading(this.createSessionBtn, true);
            const response = await this.makeRequest('/api/session/create', {
                method: 'POST'
            });

            this.sessionId = response.sessionId;
            this.sessionIdInput.value = this.sessionId;
            this.updateStatus('connected', 'Connected - Session active');
            this.enableControls(true);
            
            this.showSuccess('Browser session created successfully!');
        } catch (error) {
            this.showError(`Failed to create session: ${error.message}`);
        } finally {
            this.setLoading(this.createSessionBtn, false);
        }
    }

    async closeSession() {
        if (!this.sessionId) return;

        try {
            this.setLoading(this.closeSessionBtn, true);
            await this.makeRequest(`/api/session/${this.sessionId}`, {
                method: 'DELETE'
            });

            this.sessionId = null;
            this.sessionIdInput.value = '';
            this.updateStatus('disconnected', 'Disconnected - Create a session to start');
            this.enableControls(false);
            this.clearBrowserDisplay();
            
            this.showSuccess('Session closed successfully!');
        } catch (error) {
            this.showError(`Failed to close session: ${error.message}`);
        } finally {
            this.setLoading(this.closeSessionBtn, false);
        }
    }

    async navigate() {
        if (!this.sessionId || !this.urlInput.value.trim()) return;

        try {
            this.setLoading(this.navigateBtn, true);
            const response = await this.makeRequest(`/api/session/${this.sessionId}/navigate`, {
                method: 'POST',
                body: JSON.stringify({ url: this.urlInput.value.trim() })
            });

            this.displayBrowserContent(response);
            this.showSuccess(`Navigated to ${response.url}`);
        } catch (error) {
            this.showError(`Navigation failed: ${error.message}`);
        } finally {
            this.setLoading(this.navigateBtn, false);
        }
    }

    async takeScreenshot() {
        if (!this.sessionId) return;

        try {
            this.setLoading(this.screenshotBtn, true);
            const response = await this.makeRequest(`/api/session/${this.sessionId}/screenshot`);
            
            this.displayBrowserContent(response);
            this.showSuccess('Screenshot updated');
        } catch (error) {
            this.showError(`Screenshot failed: ${error.message}`);
        } finally {
            this.setLoading(this.screenshotBtn, false);
        }
    }

    async typeText() {
        if (!this.sessionId || !this.textInput.value.trim()) return;

        try {
            this.setLoading(this.typeBtn, true);
            const response = await this.makeRequest(`/api/session/${this.sessionId}/type`, {
                method: 'POST',
                body: JSON.stringify({ text: this.textInput.value })
            });

            this.displayBrowserContent(response);
            this.textInput.value = '';
            this.showSuccess('Text typed successfully');
        } catch (error) {
            this.showError(`Type failed: ${error.message}`);
        } finally {
            this.setLoading(this.typeBtn, false);
        }
    }

    async scroll(down = true) {
        if (!this.sessionId) return;

        const deltaY = parseInt(this.scrollInput.value) || 100;
        const scrollAmount = down ? deltaY : -deltaY;
        const button = down ? this.scrollDownBtn : this.scrollUpBtn;

        try {
            this.setLoading(button, true);
            const response = await this.makeRequest(`/api/session/${this.sessionId}/scroll`, {
                method: 'POST',
                body: JSON.stringify({ deltaY: scrollAmount })
            });

            this.displayBrowserContent(response);
            this.showSuccess(`Scrolled ${down ? 'down' : 'up'}`);
        } catch (error) {
            this.showError(`Scroll failed: ${error.message}`);
        } finally {
            this.setLoading(button, false);
        }
    }

    async executeScript() {
        if (!this.sessionId || !this.scriptInput.value.trim()) return;

        try {
            this.setLoading(this.executeBtn, true);
            const response = await this.makeRequest(`/api/session/${this.sessionId}/execute`, {
                method: 'POST',
                body: JSON.stringify({ script: this.scriptInput.value })
            });

            this.displayBrowserContent(response.pageInfo);
            this.scriptResult.value = JSON.stringify(response.result, null, 2);
            this.showSuccess('Script executed successfully');
        } catch (error) {
            this.showError(`Script execution failed: ${error.message}`);
            this.scriptResult.value = `Error: ${error.message}`;
        } finally {
            this.setLoading(this.executeBtn, false);
        }
    }

    async handleScreenClick(event) {
        if (!this.sessionId) return;

        const rect = event.target.getBoundingClientRect();
        const x = Math.round(event.clientX - rect.left);
        const y = Math.round(event.clientY - rect.top);

        try {
            const response = await this.makeRequest(`/api/session/${this.sessionId}/click`, {
                method: 'POST',
                body: JSON.stringify({ x, y })
            });

            this.displayBrowserContent(response);
            this.showSuccess(`Clicked at (${x}, ${y})`);
        } catch (error) {
            this.showError(`Click failed: ${error.message}`);
        }
    }

    displayBrowserContent(pageInfo) {
        if (!pageInfo) return;

        this.browserContent.innerHTML = `
            <div class="w-full max-w-4xl">
                <img src="${pageInfo.screenshot}" 
                     alt="Browser Screenshot" 
                     class="browser-screen max-w-full border-4 border-gray-200 rounded-xl shadow-xl cursor-crosshair"
                     onclick="client.handleScreenClick(event)">
                <div class="mt-4 p-4 bg-gray-50 rounded-xl text-left">
                    <h4 class="text-lg font-semibold text-gray-800 mb-3">Page Information</h4>
                    <p class="mb-2"><span class="font-semibold text-gray-600">Title:</span> <span class="text-gray-800">${pageInfo.title || 'No title'}</span></p>
                    <p class="mb-2"><span class="font-semibold text-gray-600">URL:</span> <span class="text-blue-600 break-all">${pageInfo.url}</span></p>
                    <p><span class="font-semibold text-gray-600">Session:</span> <span class="font-mono text-sm text-gray-700">${pageInfo.sessionId}</span></p>
                </div>
            </div>
        `;
    }

    clearBrowserDisplay() {
        this.browserContent.innerHTML = `
            <div class="text-center">
                <h2 class="text-2xl font-bold text-gray-800 mb-4">No Browser Session Active</h2>
                <p class="text-gray-600">Create a new session to start controlling a remote browser</p>
            </div>
        `;
    }

    updateStatus(type, message) {
        this.statusElement.className = type === 'connected' 
            ? 'bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 font-semibold'
            : 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 font-semibold';
        this.statusElement.textContent = message;
    }

    enableControls(enabled) {
        const controls = [
            this.urlInput, this.navigateBtn, this.screenshotBtn,
            this.textInput, this.typeBtn, this.scrollInput,
            this.scrollDownBtn, this.scrollUpBtn,
            this.scriptInput, this.executeBtn
        ];

        controls.forEach(control => {
            control.disabled = !enabled;
        });

        this.closeSessionBtn.disabled = !enabled;
    }

    setLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            const originalText = button.textContent;
            button.dataset.originalText = originalText;
            button.innerHTML = `
                <div class="flex items-center justify-center">
                    <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Loading...
                </div>
            `;
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || button.textContent;
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 ${
            type === 'success' 
                ? 'bg-green-500 text-white' 
                : 'bg-red-500 text-white'
        }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Initialize the client when the page loads
const client = new CloudBrowserClient();

// Health check on page load
fetch('/api/health')
    .then(response => response.json())
    .then(data => {
        console.log('Server health:', data);
    })
    .catch(error => {
        console.error('Server health check failed:', error);
        client.showError('Unable to connect to server');
    });
