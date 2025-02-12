class AskDocsUI {
    constructor() {
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
        
        this.conversationManager = new ConversationManager();
        this.currentConversationId = null;
        
        this.initialize();
    }

    async getDocumentationContent() {
        return new Promise((resolve, reject) => {
          // Query for the active tab
          chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (!tabs[0]?.id) {
              reject(new Error('No active tab found'));
              return;
            }
    
            try {
              // Execute content script to extract content
              const results = await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                function: () => {
                  // Common selectors for documentation sites
                  const docSelectors = [
                    'main',
                    'article',
                    '[role="main"]',
                    '.main-content',
                    '.documentation',
                    '.content',
                    '.markdown-body',
                    '.documentation-content',
                    '#readme',
                    '.devsite-article-body',
                    '.docs-content'
                  ];
    
                  // Try each selector
                  for (const selector of docSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                      return element.innerText;
                    }
                  }
    
                  // Fallback to body content
                  return document.body.innerText;
                }
              });
    
              if (!results || !results[0]) {
                reject(new Error('Failed to extract content'));
                return;
              }
    
              const content = results[0].result;
              // Trim and clean up the content
              const cleanContent = content
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 15000); // Limit content length
    
              resolve(cleanContent);
            } catch (error) {
              console.error('Content extraction error:', error);
              reject(error);
            }
          });
        });
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
  
    async handleApiKeySave() {
      const apiKey = this.apiKeyInput.value.trim();
      if (!apiKey) {
        this.showError('Please enter a valid API key');
        return;
      }
  
      try {
        this.showLoading();
        await this.validateApiKey(apiKey);
        await chrome.storage.local.set({ geminiApiKey: apiKey });
        this.geminiService = new GeminiService(apiKey);
        await this.createNewConversation();
        this.showChatView();
      } catch (error) {
        this.showError('Invalid API key. Please check and try again.');
      } finally {
        this.hideLoading();
      }
    }
  
    showError(message) {
      const errorElement = document.getElementById('setup-error');
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  
    async validateApiKey(apiKey) {
      const service = new GeminiService(apiKey);
      await service.generateResponse('Test message');
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
      messageElement.textContent = message.content;
      this.messagesContainer.appendChild(messageElement);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
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
          console.log('Getting doc content...');
          const docContent = await this.getDocumentationContent();
          console.log('Doc content received:', docContent);
    
          console.log('Generating response...');
          const response = await this.geminiService.generateResponse(message, docContent);
          console.log('Response received:', response);
    
          if (!response) {
            throw new Error('Empty response received');
          }
    
          const botMessage = { role: 'assistant', content: response };
          this.addMessageToUI(botMessage);
          
          await this.conversationManager.addMessageToConversation(
            this.currentConversationId, 
            userMessage
          );
          await this.conversationManager.addMessageToConversation(
            this.currentConversationId, 
            botMessage
          );
        } catch (error) {
          console.error('Error in handleMessageSend:', error);
          const errorMessage = { 
            role: 'assistant', 
            content: `Error: ${error.message}. Please try again.`
          };
          this.addMessageToUI(errorMessage);
        } finally {
          this.hideLoading();
        }
      }
  }
  
  // Initialize the UI when the popup loads
  document.addEventListener('DOMContentLoaded', () => {
    new AskDocsUI();
  });