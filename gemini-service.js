class GeminiService {
    constructor(apiKey) {
      this.apiKey = apiKey;
      this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    }
  
    async generateResponse(prompt, context = '') {
      try {
        console.log('Sending request with prompt:', prompt, 'and context:', context);
        
        const response = await fetch(`${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Context: ${context}\n\nQuestion: ${prompt}\n\nPlease provide a helpful response based on the context above.`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              }
            ]
          })
        });
  
        console.log('Raw response:', response);
  
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error response:', errorText);
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
  
        const data = await response.json();
        console.log('Parsed response data:', data);
  
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
          console.error('Invalid response structure:', data);
          throw new Error('Invalid response format from API');
        }
  
        const textResponse = data.candidates[0].content.parts[0].text;
        console.log('Extracted response text:', textResponse);
  
        if (!textResponse) {
          throw new Error('Empty response from API');
        }
  
        return textResponse;
  
      } catch (error) {
        console.error('Error in generateResponse:', error);
        throw error;
      }
    }
  }
  