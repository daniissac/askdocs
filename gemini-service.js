class GeminiService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1';
        this.systemPrompt = `You are a documentation assistant. Provide concise answers based on the documentation. Use markdown for code and lists. If information isn't available, say so clearly.`;
    }

    getBaseUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.origin + urlObj.pathname.split('/').slice(0, -1).join('/');
        } catch (error) {
            console.error('URL parsing error:', error);
            return url;
        }
    }

    async generateResponse(userQuery, documentationUrl) {
        const baseDocUrl = this.getBaseUrl(documentationUrl);
        const prompt = `Documentation Base URL: ${baseDocUrl}
Current Page: ${documentationUrl}

Question: ${userQuery}

Provide a focused answer. Use markdown formatting where appropriate.`;

        try {
            const response = await fetch(`${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: this.systemPrompt + '\n\n' + prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        topK: 20,
                        topP: 0.8,
                        maxOutputTokens: 1024,
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (errorData.error?.message?.includes('Resource has been exhausted')) {
                    throw new Error('API quota exceeded. Please try again later or check your API limits.');
                }
                throw new Error(errorData.error?.message || 'API request failed');
            }

            const data = await response.json();
            
            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error('Invalid response format from API');
            }

            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Gemini API error:', error);
            if (error.message.includes('quota')) {
                throw new Error('API quota exceeded. Please try again later.');
            }
            throw new Error('Failed to generate response. Please check your API key or try again later.');
        }
    }

    async validateApiKey() {
        try {
            const testResponse = await this.generateResponse('test', 'https://example.com/docs');
            return !!testResponse;
        } catch (error) {
            console.error('API key validation failed:', error);
            if (error.message.includes('quota')) {
                throw new Error('API quota exceeded. Please try again later.');
            }
            throw new Error('Invalid API key or API access error. Please check your API key.');
        }
    }
}