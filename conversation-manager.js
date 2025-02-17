class ConversationManager {
    constructor() {
        this.conversations = null; // Cache conversations
        this.MAX_CONVERSATIONS = 10;
        this.MAX_MESSAGES_PER_CONVERSATION = 50;
        this.INTRO_MESSAGE = {
            role: 'assistant',
            content: [
                "Hello! I'm your documentation assistant. I can help you understand the current documentation page.",
                "",
                "Some things you can ask me:",
                "- Explain specific concepts or features",
                "- Find information about APIs or functions",
                "- Understand code examples",
                "- Clarify technical details",
                "- Navigate to related documentation",
                "",
                "Just ask your question, and I'll help you find the information you need!"
            ].join('\n')
        };
    }

    async getConversations() {
        // Cache conversations in memory
        if (this.conversations !== null) {
            return this.conversations;
        }

        try {
            const result = await chrome.storage.local.get(['conversations']);
            this.conversations = result.conversations || [];
            return this.conversations;
        } catch (error) {
            console.error('Error getting conversations:', error);
            this.conversations = [];
            return [];
        }
    }

    async createNewConversation(topic = 'New Conversation') {
        const conversation = {
            id: Date.now().toString(),
            topic,
            messages: [this.INTRO_MESSAGE],
            createdAt: new Date().toISOString()
        };

        await this.saveConversation(conversation);
        return conversation;
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
        this.conversations = updatedConversations; // Update cache
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
        this.conversations = updatedConversations; // Update cache
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