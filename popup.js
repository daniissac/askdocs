// Helper function to extract content from a page
function extractPageContent() {
  // Prioritized selectors for documentation sites
  const docSelectors = [
    // Documentation specific selectors
    'article[role="main"]',
    'main[role="main"]',
    '.documentation-content',
    '.markdown-body',
    '.docs-content',
    '.content-body',
    
    // Common documentation containers
    'article',
    'main',
    '.main-content',
    '.article-content',
    '.post-content',
    
    // Fallback selectors
    '#content',
    '.content',
    '[role="main"]'
  ];

  let allContent = '';
  
  // Try each selector and aggregate text content
  for (const selector of docSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      // Get all text nodes while preserving structure
      const content = Array.from(element.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, code, pre'))
        .map(el => {
          // Add markdown-style formatting
          if (el.tagName.match(/^H\d$/)) {
            const level = el.tagName[1];
            return `\n${'#'.repeat(level)} ${el.textContent}\n`;
          }
          if (el.tagName === 'LI') return `- ${el.textContent}`;
          if (el.tagName === 'CODE') return `\`${el.textContent}\``;
          if (el.tagName === 'PRE') return `\n\`\`\`\n${el.textContent}\n\`\`\`\n`;
          return el.textContent;
        })
        .join('\n')
        .trim();

      if (content.length > 0) {
        allContent += content + '\n\n';
      }
    }
  }

  // Only fall back to body content if we didn't find any structured content
  if (allContent.length > 100) {
    return allContent.trim();
  }

  const mainContent = document.body.innerText;
  return mainContent.length > 100 ? mainContent : '';
}

class AskDocsUI {
    constructor() {
        try {
            // Initialize UI elements
            this.setupView = document.getElementById('setup-view');
            this.chatView = document.getElementById('chat-view');
            this.loadingView = document.getElementById('loading');
            this.messagesContainer = document.getElementById('messages');
            this.conversationList = document.getElementById('conversation-list');
            this.apiKeyInput = document.getElementById('api-key');
            this.saveKeyButton = document.getElementById('save-key');
            this.userInput = document.getElementById('user-input');
            this.sendButton = document.getElementById('send');
            this.newChatButton = document.getElementById('new-chat');
            
            // Validate elements
            if (!this.setupView || !this.chatView || !this.loadingView || 
                !this.messagesContainer || !this.conversationList ||
                !this.apiKeyInput || !this.saveKeyButton || !this.userInput ||
                !this.sendButton || !this.newChatButton) {
                throw new Error('Required DOM elements not found');
            }

            // Initialize managers
            this.conversationManager = new ConversationManager();
            this.currentConversationId = null;

            // Initialize app
            this.initialize().catch(error => {
                console.error('Initialization error:', error);
                this.showError('Failed to initialize application');
            });
        } catch (error) {
            console.error('Constructor error:', error);
            document.body.innerHTML = '<div class="error">Failed to load application. Please reload.</div>';
        }
    }

    async initialize() {
        const apiKey = await this.getStoredApiKey();
        if (!apiKey) {
            this.showSetupView();
        } else {
            this.geminiService = new GeminiService(apiKey);
            this.showChatView();
            await this.loadConversations();
        }
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.saveKeyButton.addEventListener('click', () => this.handleApiKeySave());
        this.sendButton.addEventListener('click', () => this.handleMessageSend());
        this.newChatButton.addEventListener('click', () => this.createNewConversation());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleMessageSend();
            }
        });
    }

    async getStoredApiKey() {
        const result = await chrome.storage.local.get(['geminiApiKey']);
        return result.geminiApiKey;
    }

    showSetupView() {
        this.setupView.style.display = 'block';
        this.chatView.style.display = 'none';
        this.loadingView.style.display = 'none';
    }

    showChatView() {
        this.setupView.style.display = 'none';
        this.chatView.style.display = 'flex';
        this.loadingView.style.display = 'none';
    }

    showLoading() {
        this.loadingView.style.display = 'block';
        this.sendButton.disabled = true;
    }

    hideLoading() {
        this.loadingView.style.display = 'none';
        this.sendButton.disabled = false;
    }

    showError(message) {
        const errorElement = document.getElementById('setup-error');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    async createNewConversation() {
        const conversation = await this.conversationManager.createNewConversation();
        this.currentConversationId = conversation.id;
        await this.loadConversations();
        this.clearMessages();
    }

    async loadConversations() {
        const conversations = await this.conversationManager.getConversations();
        this.conversationList.innerHTML = '';
        
        conversations.forEach(conv => {
            const element = document.createElement('div');
            element.className = `conversation-item ${conv.id === this.currentConversationId ? 'active' : ''}`;
            element.textContent = conv.topic || `Conversation ${new Date(conv.createdAt).toLocaleDateString()}`;
            element.addEventListener('click', () => this.switchConversation(conv.id));
            this.conversationList.appendChild(element);
        });

        if (conversations.length > 0 && !this.currentConversationId) {
            this.currentConversationId = conversations[0].id;
            await this.loadMessages(this.currentConversationId);
        }
    }

    async switchConversation(conversationId) {
        this.currentConversationId = conversationId;
        await this.loadConversations();
        await this.loadMessages(conversationId);
    }

    async loadMessages(conversationId) {
        const conversation = await this.conversationManager.getConversation(conversationId);
        this.clearMessages();
        
        conversation.messages.forEach(message => {
            this.addMessageToUI(message);
        });
    }

    clearMessages() {
        this.messagesContainer.innerHTML = '';
    }

    addMessageToUI(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.role === 'user' ? 'user-message' : 'bot-message'}`;
        
        if (message.role === 'assistant') {
            // Special handling for intro message
            if (message === this.conversationManager.INTRO_MESSAGE) {
                messageElement.innerHTML = message.content
                    .split('\n')
                    .map(line => {
                        if (line.startsWith('-')) {
                            return `<li>${line.substring(2)}</li>`;
                        }
                        if (line === '') {
                            return '<br>';
                        }
                        return `<p>${line}</p>`;
                    })
                    .join('');
            } else {
                // Regular message formatting
                messageElement.innerHTML = message.content
                    .replace(/`{3}([^`]+)`{3}/g, '<pre><code>$1</code></pre>')
                    .replace(/`([^`]+)`/g, '<code>$1</code>')
                    .replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*([^\*]+)\*/g, '<em>$1</em>')
                    .replace(/- ([^\n]+)/g, '<li>$1</li>')
                    .replace(/\n/g, '<br>');
            }
        } else {
            messageElement.textContent = message.content;
        }
        
        this.messagesContainer.appendChild(messageElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    async handleApiKeySave() {
        const apiKey = this.apiKeyInput.value.trim();
        if (!apiKey) {
            this.showError('Please enter a valid API key');
            return;
        }

        try {
            this.showLoading();
            await this.validateAndSaveApiKey(apiKey);
        } catch (error) {
            this.showError('Invalid API key. Please check and try again.');
        } finally {
            this.hideLoading();
        }
    }

    async validateAndSaveApiKey(apiKey) {
        try {
            const geminiService = new GeminiService(apiKey);
            await geminiService.validateApiKey();
            
            // Only save if validation succeeds
            await chrome.storage.local.set({ geminiApiKey: apiKey });
            this.geminiService = geminiService;
            this.showChatView();
            return true;
        } catch (error) {
            console.error('API key validation failed:', error);
            const setupError = document.getElementById('setup-error');
            setupError.textContent = error.message;
            setupError.style.display = 'block';
            return false;
        }
    }

    async handleMessageSend() {
        const message = this.userInput.value.trim();
        if (!message) return;

        if (!this.currentConversationId) {
            await this.createNewConversation();
        }

        const userMessage = { role: 'user', content: message };
        this.addMessageToUI(userMessage);
        
        this.userInput.value = '';
        this.showLoading();

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.url) {
                throw new Error('No active tab found');
            }

            // Get base URL instead of full URL
            const baseUrl = this.geminiService.getBaseUrl(tab.url);
            const response = await this.geminiService.generateResponse(message, baseUrl);
            
            if (!response) {
                throw new Error('Empty response received');
            }

            const botMessage = { role: 'assistant', content: response };
            this.addMessageToUI(botMessage);
            
            await Promise.all([
                this.conversationManager.addMessageToConversation(
                    this.currentConversationId, 
                    userMessage
                ),
                this.conversationManager.addMessageToConversation(
                    this.currentConversationId, 
                    botMessage
                )
            ]);
        } catch (error) {
            console.error('Message handling error:', error);
            this.addMessageToUI({ 
                role: 'assistant', 
                content: `Error: ${error.message}. Please try again.`
            });
        } finally {
            this.hideLoading();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AskDocsUI();
});