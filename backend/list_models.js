const { BedrockClient, ListInferenceProfilesCommand } = require("@aws-sdk/client-bedrock");
require("dotenv").config({ path: __dirname + "/.env" });

async function listProfiles() {
    const client = new BedrockClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    });

    const command = new ListInferenceProfilesCommand({});

    try {
        const response = await client.send(command);
        response.inferenceProfileSummaries.forEach(p => {
            console.log(p.inferenceProfileId, p.status);
        });
    } catch (e) {
        console.error(e);
    }
}

listProfiles();
