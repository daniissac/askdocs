class ConversationManager {
    constructor() {
      this.MAX_CONVERSATIONS = 10;
      this.MAX_MESSAGES_PER_CONVERSATION = 50;
    }
  
    async createNewConversation(topic = 'New Conversation') {
      const conversation = {
        id: Date.now().toString(),
        topic,
        messages: [],
        createdAt: new Date().toISOString()
      };
  
      const conversations = await this.getConversations();
      const updatedConversations = [conversation, ...conversations].slice(0, this.MAX_CONVERSATIONS);
      await chrome.storage.local.set({ conversations: updatedConversations });
      return conversation;
    }
  
    async getConversations() {
      const { conversations = [] } = await chrome.storage.local.get(['conversations']);
      return conversations;
    }
  
    async getConversation(conversationId) {
      const conversations = await this.getConversations();
      return conversations.find(c => c.id === conversationId) || null;
    }
  
    async saveConversation(conversation) {
      const conversations = await this.getConversations();
      const index = conversations.findIndex(c => c.id === conversation.id);
      
      if (index !== -1) {
        conversations[index] = conversation;
      } else {
        conversations.unshift(conversation);
      }
      
      const updatedConversations = conversations.slice(0, this.MAX_CONVERSATIONS);
      await chrome.storage.local.set({ conversations: updatedConversations });
    }
  
    async addMessageToConversation(conversationId, message) {
      const conversation = await this.getConversation(conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }
  
      conversation.messages = [...conversation.messages, message]
        .slice(-this.MAX_MESSAGES_PER_CONVERSATION);
      
      await this.saveConversation(conversation);
      return conversation;
    }
  
    async deleteConversation(conversationId) {
      const conversations = await this.getConversations();
      const updatedConversations = conversations.filter(c => c.id !== conversationId);
      await chrome.storage.local.set({ conversations: updatedConversations });
    }
  
    async updateConversationTopic(conversationId, newTopic) {
      const conversation = await this.getConversation(conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }
  
      conversation.topic = newTopic;
      await this.saveConversation(conversation);
      return conversation;
    }
  }