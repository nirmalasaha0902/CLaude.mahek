const fs = require('fs');

async function testGeminiWord() {
    const aiModel = 'gemini-2.5-flash';
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
        console.error('No API key');
        return;
    }
    
    // A tiny dummy docx payload (just base64 of string "dummy")
    // If the mimeType is rejected, Gemini will return a 400 immediately.
    const payload = {
        contents: [{
            parts: [
                { text: 'What is this document?' },
                {
                    inlineData: {
                        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        data: Buffer.from('dummy data').toString('base64')
                    }
                }
            ]
        }]
    };
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        console.log("Word Response:", data);
    } catch (e) {
        console.error(e);
    }
}

testGeminiWord();
