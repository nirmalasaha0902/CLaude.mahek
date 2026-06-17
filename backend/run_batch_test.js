const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const prompt = `You are reading an engineering drawing for a shim manufacturing company.
CRITICAL INSTRUCTION: You must extract the EXACT dimensions explicitly written as text or numbers on the drawing's annotations. Do NOT attempt to measure visually, guess, or estimate sizes based on the image's visual scale or proportions. Read the numbers printed on the drawing EXACTLY as they are.

Extract these values and return ONLY valid JSON:
- shape: "rectangular" or "round" or "slotted" (use "slotted" if the shim has U-shaped or finger-like slots cut into it)
- part_name: string from title block or null. Look for "PART NAME" or "PART TITLE".
- drawing_no: string from DRG NO or PART NO field or null. Look for "SHN PART NO", "DRG NO", etc.
- L: the overall horizontal length of the shim in mm, as annotated on the horizontal axis of the drawing. Or 0.
- W: the overall vertical width/height of the shim in mm, as annotated on the vertical axis of the drawing. Or 0.
- D: outer diameter in mm if round or 0
- d: inner diameter in mm if the round shim has a large central cutout/hole, else 0
- parts: array of objects, each containing "thickness" (number in mm) and "quantity" (number). Extract this from the thickness/qty table if present (often titled "STOCK SIZE" or "Shim Table"). For example, if it has:
  Row 1: 2MM x 16MM x 45MM Qty 1
  Row 2: 1MM x 16MM x 45MM Qty 2
  Row 3: 0.5MM x 16MM x 45MM Qty 2
  Then parts should be: [{"thickness": 2, "quantity": 1}, {"thickness": 1, "quantity": 2}, {"thickness": 0.5, "quantity": 2}].
  If no table exists, look for any general thickness annotation (e.g., "THK 2.0", "T=3") and total quantity and return a single object.
- TH: number, fallback for thickness in mm if a table is missing. Look for "THK", "T=".
- quantity: number, fallback for quantity. Look for "QTY", "NOS".
- holes: array of objects with "diameter" (number) and "count" (number). Extract small bolt/mounting holes here.
- slots: array of objects describing each slot TYPE. Each slot object must have:
  - "slot_center_from_edge" (number in mm): This is the distance from the closed edge (opposite to where the slot opens) to the center of the slot's curved end (radius center).
  - "length" (number in mm): the straight-line depth/length of the slot (from the open edge of the shim to the center of the radius). If not explicitly annotated, calculate it as: total_dimension - slot_center_from_edge (where total_dimension is L if slot direction is horizontal, or W if slot direction is vertical).
  - "radius" (number in mm): the radius of the curved end of the slot. If a slot width or slot diameter is annotated (e.g. "= 6.6 = TYP", "6.6 TYP", "7CENT.", "7 CENT."), the radius is half of that slot width/diameter. For example, "7CENT." indicates a slot width of 7, so the radius is 7 / 2 = 3.5. Do NOT round these values.
  - "count" (number): how many identical slots of this type exist.
- slot_direction_dimension: "L" if slots open/extend horizontally (left or right), or "W" if slots open/extend vertically (top or bottom).
- material: string if visible anywhere on the drawing (e.g., "SPCC", "SS304", "BRASS") or null
- confidence: "high" or "medium" or "low"

Return ONLY JSON nothing else.`;

const uploadsDir = 'D:/mehekk/Code try/uploads';

async function testAll() {
    const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.png'));
    console.log(`Found ${files.length} PNG files to test.`);
    
    const results = {};

    for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`Testing ${file} (Size: ${stats.size} bytes)...`);
        
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const imagePart = {
                inlineData: {
                    data: fs.readFileSync(filePath).toString('base64'),
                    mimeType: 'image/png'
                }
            };
            const result = await model.generateContent([prompt, imagePart]);
            const text = result.response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : text;
            const parsed = JSON.parse(jsonString);
            
            results[file] = {
                size: stats.size,
                success: true,
                extracted: parsed
            };
            console.log(`Success ${file}: shape = ${parsed.shape}, L = ${parsed.L}, W = ${parsed.W}`);
        } catch (e) {
            results[file] = {
                size: stats.size,
                success: false,
                error: e.message
            };
            console.error(`Error processing ${file}:`, e.message);
        }
        // Small delay to prevent rate limits
        await new Promise(r => setTimeout(r, 6000));
    }

    fs.writeFileSync('batch_results.json', JSON.stringify(results, null, 2));
    console.log("Finished batch tests. Results saved to batch_results.json.");
}

testAll();
