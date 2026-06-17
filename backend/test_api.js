const apiKey = 'AIzaSyBk7Zq8ies0B46AajU5iD7dY1gakiFS0uw';

async function testGemini(model) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: 'Hello' }
                    ]
                }]
            })
        });
        const text = await res.text();
        console.log(model, '->', res.status, text.substring(0, 100));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
testGemini('gemini-2.5-flash');
testGemini('gemini-3.5-flash');
    try {
        const res = await fetch('https://opencode.ai/zen/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer YOUR_API_KEY_HERE',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ model: model, messages: [{ role: 'user', content: 'test' }] })
        });
        const text = await res.text();
        console.log(model, '->', res.status, text.substring(0, 100));
    } catch (e) {
        console.log(model, '-> Error', e.message);
    }
}
