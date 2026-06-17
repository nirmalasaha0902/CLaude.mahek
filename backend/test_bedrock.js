const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
require('dotenv').config({ path: __dirname + '/.env' });
const fs = require('fs');

async function testBedrock() {
    const client = new BedrockRuntimeClient({
        region: process.env.CLAUDE_AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.CLAUDE_AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.CLAUDE_AWS_SECRET_ACCESS_KEY
        }
    });

    const aiModel = process.env.MODEL_NAME || 'us.anthropic.claude-opus-4-6-v1';

    // Create a dummy PDF base64 string (smallest possible PDF)
    const dummyPdf = "JVBERi0xLjEKJcKlwrHDqwoKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPj4KZW5kb2JqCgoyIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2VzCiAgICAgL0tpZHMgWzMgMCBSXQogICAgIC9Db3VudCAxCiAgICAgL01lZGlhQm94IFswIDAgMzAwIDE0NF0KICA+PgplbmRvYmoKCjMgMCBvYmoKICA8PCAvVHlwZSAvUGFnZQogICAgIC9QYXJlbnQgMiAwIFIKICAgICAvUmVzb3VyY2VzCiAgICAgIDw8IC9Gb250CiAgICAgICAgICAgPDwgL0YxCiAgICAgICAgICAgICAgIDw8IC9UeXBlIC9Gb250CiAgICAgICAgICAgICAgICAgIC9TdWJ0eXBlIC9UeXBlMQogICAgICAgICAgICAgICAgICAvQmFzZUZvbnQgL1RpbWVzLVJvbWFuCiAgICAgICAgICAgICAgID4+CiAgICAgICAgICAgPj4KICAgICAgPj4KICAgICAvQ29udGVudHMgNCAwIFIKICA+PgplbmRvYmoKCjQgMCBvYmoKICA8PCAvTGVuZ3RoIDU1ID4+CnN0cmVhbQogIEJUCiAgICAvRjEgMTggVGYKICAgIDAgMCBUZAogICAgKEhlbGxvIFdvcmxkKSBUagogIEVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE4IDAwMDAwIG4gCjAwMDAwMDAwNzcgMDAwMDAgbiAKMDAwMDAwMDE3OCAwMDAwMCBuIAowMDAwMDAwNDU3IDAwMDAwIG4gCnRyYWlsZXIKICA8PCAvUm9vdCAxIDAgUgogICAgIC9TaXplIDUKICA+PgpzdGFydHhyZWYKNTY1CiUlRU9GCg==";

    const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        temperature: 0.1,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "document",
                        source: {
                            type: "base64",
                            media_type: "application/pdf",
                            data: dummyPdf
                        }
                    },
                    { type: "text", text: "What is this?" }
                ]
            }
        ]
    };

    try {
        console.log(`Testing model: ${aiModel}`);
        const command = new InvokeModelCommand({
            modelId: aiModel,
            body: JSON.stringify(payload),
            contentType: "application/json",
            accept: "application/json"
        });

        const response = await client.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        console.log("Success:", responseBody.content[0].text);
    } catch (e) {
        console.error("Error invoking model:", e.message);
    }
}

testBedrock();
