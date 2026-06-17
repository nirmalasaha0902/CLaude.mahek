const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');
require('dotenv').config();

const imgPath = path.join(__dirname, 'uploads', 'debug_last_drawing.png');
if (!fs.existsSync(imgPath)) {
    console.log("No last drawing found at: " + imgPath);
    process.exit(0);
}

const base64Image = fs.readFileSync(imgPath, 'base64');

async function createVisualCrops(imageAsBase64) {
    try {
        const buffer = Buffer.from(imageAsBase64, 'base64');
        const image = await Jimp.read(buffer);
        const width = image.width;
        const height = image.height;
        console.log(`[Visual Crops] Image size: ${width}x${height}`);

        // Crop 1: Title Block (Bottom-right: x: 60%-100%, y: 60%-100%)
        const titleBlockImg = image.clone().crop({
            x: Math.floor(width * 0.60),
            y: Math.floor(height * 0.60),
            w: Math.floor(width * 0.40),
            h: Math.floor(height * 0.40)
        });
        const titleBlockBase64 = (await titleBlockImg.getBuffer('image/png')).toString('base64');

        // Crop 2: Thickness Table / Notes (Upper/Middle-right: x: 60%-100%, y: 0%-60%)
        const tableImg = image.clone().crop({
            x: Math.floor(width * 0.60),
            y: 0,
            w: Math.floor(width * 0.40),
            h: Math.floor(height * 0.60)
        });
        const tableBase64 = (await tableImg.getBuffer('image/png')).toString('base64');

        return { titleBlockBase64, tableBase64 };
    } catch (err) {
        console.error("[Visual Crops] Failed to crop image:", err.message);
        return null;
    }
}

async function executeAIScan(imageAsBase64, mimeType, prompt, crops = null) {
    const MAX_RETRIES = 2;
    let lastError = null;
    let aiText = null;

    const prepareOpenCodePayload = (promptText) => {
        const content = [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + imageAsBase64 } }
        ];
        if (crops) {
            content.push(
                { type: 'image_url', image_url: { url: 'data:image/png;base64,' + crops.titleBlockBase64 } },
                { type: 'image_url', image_url: { url: 'data:image/png;base64,' + crops.tableBase64 } }
            );
        }
        return {
            model: 'minimax-m3-free',
            messages: [{ role: 'user', content }]
        };
    };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

        try {
            console.log(`[AI Scan] Attempt ${attempt}/${MAX_RETRIES} via OpenCode (minimax-m3-free)...`);
            const payload = prepareOpenCodePayload(prompt);
            const response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + (process.env.OPENCODE_API_KEY || ''),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`OpenCode API Error: ${response.status}`);
            }

            const data = await response.json();
            if (data.choices && data.choices[0] && data.choices[0].message) {
                aiText = data.choices[0].message.content;
                lastError = null;
                break;
            } else {
                throw new Error('Invalid response from OpenCode API');
            }
        } catch (retryError) {
            clearTimeout(timeoutId);
            console.warn(`[AI Scan] Attempt ${attempt} failed:`, retryError.message);
            lastError = retryError;
            
            const errMsg = retryError.message || '';
            const isTransient = errMsg.includes('503') || errMsg.includes('500') || errMsg.includes('502') || errMsg.includes('504') || errMsg.includes('429') || errMsg.includes('ECONNRESET') || errMsg.includes('high demand') || errMsg.includes('quota') || errMsg.toLowerCase().includes('abort');

            if (isTransient && attempt < MAX_RETRIES) {
                console.log(`[AI Scan] Waiting 2s before retry...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                break;
            }
        }
    }

    if (lastError) throw lastError;

    const cleanedText = aiText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : cleanedText;
    return JSON.parse(jsonString);
}

function crossValidateDimensions(combined) {
    const warnings = combined._warnings || [];
    
    const filterDims = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr
            .map(x => parseFloat(x))
            .filter(x => !isNaN(x) && x > 0 && x <= 2000);
    };

    const validHoriz = filterDims(combined.all_horizontal_dimensions);
    const validVert = filterDims(combined.all_vertical_dimensions);

    if (combined.shape === 'rectangular' || combined.shape === 'slotted') {
        const L = parseFloat(combined.L) || 0;
        const W = parseFloat(combined.W) || 0;

        if (validHoriz.length > 0) {
            const maxH = Math.max(...validHoriz);
            if (maxH > L) {
                warnings.push(`Auto-corrected length from ${L} to ${maxH} based on horizontal axis outer dimension.`);
                combined.L = maxH;
            }
        }

        if (validVert.length > 0) {
            const maxV = Math.max(...validVert);
            if (maxV > W) {
                warnings.push(`Auto-corrected width from ${W} to ${maxV} based on vertical axis outer dimension.`);
                combined.W = maxV;
            }
        }
    } else if (combined.shape === 'circular') {
        const D = parseFloat(combined.D) || 0;
        const allDims = [...validHoriz, ...validVert];
        if (allDims.length > 0) {
            const maxD = Math.max(...allDims);
            if (maxD > D) {
                warnings.push(`Auto-corrected outer diameter from Ø${D} to Ø${maxD} based on outer dimension.`);
                combined.D = maxD;
            }
        }
    }

    const currentL = parseFloat(combined.L) || 0;
    const currentW = parseFloat(combined.W) || 0;
    const currentD = parseFloat(combined.D) || 0;

    if (combined.shape === 'circular') {
        const d = parseFloat(combined.d) || 0;
        if (d > 0 && d >= currentD) {
            warnings.push(`Warning: Inner diameter d(${d}) >= outer diameter D(${currentD}).`);
            const allDims = [...validHoriz, ...validVert];
            if (allDims.length > 0) {
                const maxDim = Math.max(...allDims);
                if (maxDim > currentD && maxDim > d) {
                    combined.D = maxDim;
                    warnings.push(`Auto-corrected D to ${maxDim} based on inner diameter guard.`);
                }
            }
        }
    }

    if (Array.isArray(combined.holes)) {
        combined.holes.forEach(hole => {
            const dia = parseFloat(hole.diameter) || 0;
            if (dia > 0) {
                if (combined.shape === 'rectangular' || combined.shape === 'slotted') {
                    if (dia >= currentL || dia >= currentW) {
                        warnings.push(`Warning: Hole diameter Ø${dia} exceeds/equals part dimensions ${currentL}x${currentW}.`);
                        if (validHoriz.length > 0) {
                            const maxH = Math.max(...validHoriz);
                            if (maxH > currentL && maxH > dia) {
                                combined.L = maxH;
                                warnings.push(`Auto-corrected L to ${maxH} based on hole diameter guard.`);
                            }
                        }
                        if (validVert.length > 0) {
                            const maxV = Math.max(...validVert);
                            if (maxV > currentW && maxV > dia) {
                                combined.W = maxV;
                                warnings.push(`Auto-corrected W to ${maxV} based on hole diameter guard.`);
                            }
                        }
                    }
                } else if (combined.shape === 'circular') {
                    if (dia >= currentD) {
                        warnings.push(`Warning: Hole diameter Ø${dia} exceeds/equals outer diameter Ø${currentD}.`);
                        const allDims = [...validHoriz, ...validVert];
                        if (allDims.length > 0) {
                            const maxDim = Math.max(...allDims);
                            if (maxDim > currentD && maxDim > dia) {
                                combined.D = maxDim;
                                warnings.push(`Auto-corrected D to ${maxDim} based on hole diameter guard.`);
                            }
                        }
                    }
                }
            }
        });
    }

    combined._warnings = warnings;
}

const promptStage1 = `You are reading an engineering drawing for a shim manufacturing company.
This is STAGE 1 of the scanning process. Your goal is strictly to extract text, note blocks, title blocks, and tables. Do NOT attempt to trace outlines or measure overall physical sizes.

You have been provided:
1. The full drawing (Image 1)
2. A high-resolution crop of the bottom-right Title Block (Image 2)
3. A high-resolution crop of the middle-right / upper-right Thickness Table / Notes section (Image 3)

Read these images carefully, looking for:
- Part Name: Look in the Title Block (Image 2) or notes. Look for "PART NAME", "PART TITLE", "UNIT DESCRIPTION".
- Drawing Number: Look in the Title Block (Image 2) or notes. Look for "DRG NO", "PART NO", "SHN PART NO".
- Material: Look for base material annotations (e.g. "SPCC", "SS304", "BRASS", "M.S.", "MS", "MILD STEEL").
- Thickness & Quantity Table: Look at the table (Image 3 or 2) titled "STOCK SIZE", "Shim Table", etc.
  - Read decimal points extremely carefully. A thickness of "0.5" is NOT "5".
  - Extract each row exactly as a thickness and quantity pair.
  - If no table exists, look for a general note like "THK 2.0", "QTY 5".

Extract these values and return ONLY valid JSON:
{
  "part_name": "string or null",
  "drawing_no": "string or null",
  "material": "string or null",
  "parts": [
    {"thickness": number, "quantity": number}
  ],
  "TH": number,
  "quantity": number
}`;

const promptStage2 = `You are reading an engineering drawing for a shim manufacturing company.
This is STAGE 2 of the scanning process. Your goal is strictly to visually trace the physical outline of the drawing's orthographic views to isolate the absolute overall dimensions and physical features of the part.

CRITICAL DIMENSION RULES (PITCH VS OVERALL SIZE):
- The length (L) and width (W) MUST represent the absolute outer edges of the physical shim boundary.
- Do NOT confuse hole center-to-center pitch distances (such as "=70=", "=50=", or spacing dimensions) with the overall length or width of the part. Pitch dimensions show spacing between holes and are always smaller than overall dimensions.
- Look at the extension lines and dimension lines at the outermost boundaries of the drawing views (e.g., a square outline of 90x90 has outermost dimension lines labeled 90. Pitch lines between holes are labeled =70=).
- Do NOT confuse coordinate offsets or pitch spacing with overall length (L) and width (W).

FEW-SHOT ANNOTATION EXAMPLES:
Example 1: LOCKING PLATE-01 (Square Plate with 4 holes)
- Outer horizontal dimension at the border: "90"
- Outer vertical dimension at the border: "90"
- Pitch annotations between hole centers: "=70=" vertically and "=70=" horizontally
- Extraction: L = 90, W = 90 (Ignore the "=70=" pitch values for L and W. The part size is 90x90).

Example 2: SHIM-01 (Rectangular Shim with 4 holes)
- Outer horizontal dimension: "50"
- Outer vertical dimension: "20"
- Pitch/coordinate annotations: "12.5" horizontally, "8.5" vertically
- Extraction: L = 50, W = 20 (Ignore the smaller hole pitch/position measurements. The part size is 50x20. Do not misread "20" as "2").

Extract these values and return ONLY valid JSON:
{
  "shape": "rectangular" or "circular" or "slotted",
  "L": number, // overall horizontal length in mm, or 0 if circular
  "W": number, // overall vertical width/height in mm, or 0 if circular
  "D": number, // outer diameter in mm if circular, else 0
  "d": number, // inner diameter in mm if circular with central cutout, else 0
  "holes": [
    {"diameter": number, "count": number}
  ],
  "slots": [
    {
      "slot_center_from_edge": number,
      "length": number, // 0 if not explicitly written
      "radius": number, // curved end radius
      "count": number
    }
  ],
  "slot_direction_dimension": "L" or "W" or null,
  "all_horizontal_dimensions": [number, ...], // list of ALL numbers annotated on the horizontal axis / width direction
  "all_vertical_dimensions": [number, ...] // list of ALL numbers annotated on the vertical axis / height direction
}`;

async function testScan() {
    console.log("=== STARTING SEQUENTIAL TWO-STAGE SCAN TEST ===");
    try {
        console.log("1. Generating visual crops...");
        const crops = await createVisualCrops(base64Image);
        if (!crops) {
            console.error("Crops generation failed");
            return;
        }

        console.log("2. Running Stage 1 scan...");
        const step1 = await executeAIScan(base64Image, 'image/png', promptStage1, crops);
        console.log("Stage 1 Scan Output:", JSON.stringify(step1, null, 2));

        console.log("3. Running Stage 2 scan...");
        const step2 = await executeAIScan(base64Image, 'image/png', promptStage2, null);
        console.log("Stage 2 Scan Output:", JSON.stringify(step2, null, 2));

        console.log("4. Combining results...");
        const combined = {
            shape: step2.shape || step1.shape || 'rectangular',
            part_name: step1.part_name,
            drawing_no: step1.drawing_no,
            L: parseFloat(step2.L) || 0,
            W: parseFloat(step2.W) || 0,
            D: parseFloat(step2.D) || 0,
            d: parseFloat(step2.d) || 0,
            parts: step1.parts,
            TH: parseFloat(step1.TH) || 0,
            quantity: parseInt(step1.quantity) || 1,
            holes: step2.holes || [],
            slots: step2.slots || [],
            slot_direction_dimension: step2.slot_direction_dimension || null,
            all_horizontal_dimensions: step2.all_horizontal_dimensions || [],
            all_vertical_dimensions: step2.all_vertical_dimensions || [],
            _warnings: []
        };

        console.log("5. Running cross-validation heuristics...");
        crossValidateDimensions(combined);

        console.log("\n=== FINAL RECONSTRUCTED OUTPUT ===");
        console.log(JSON.stringify(combined, null, 2));
    } catch (err) {
        console.error("Scan error:", err);
    }
}

testScan();
