import axios from 'axios';

export const askAI = async (messages) => {   // ← No destructuring
    try {
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new Error("Messages array is empty or invalid.");
        }

        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "openai/gpt-4o-mini",
                messages: messages,
                temperature: 0.0,        // Good for structured JSON extraction
                max_tokens: 1000
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost",   // Optional but recommended
                    "X-Title": "InterviewIQ"              // Optional
                },
            }
        );

        const content = response?.data?.choices?.[0]?.message?.content?.trim();

        if (!content) {
            throw new Error("AI returned empty response.");
        }

        return content;

    } catch (error) {
        console.error("OpenRouter API Error:", error.response?.data || error.message);
        throw new Error(`OpenRouter API Error: ${error.message}`);
    }
};