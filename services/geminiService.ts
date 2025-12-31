
import { GoogleGenAI } from "@google/genai";
import { EditMode } from "../types";

export async function processEcommerceImage(
  base64Image: string,
  mode: EditMode,
  extraPrompt?: string
): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let prompt = "";
  const commonModelInstructions = "The model should have a natural pose, professional look, and be placed against a solid pure white high-end studio background. CRITICAL COMPOSITION RULE: Provide generous empty white space at the very top and very bottom of the image. The model must have ample headroom (space above the head) and footroom (space below the feet). The model should be perfectly centered vertically. Ensure product details, color, fabric texture, and fit remain 100% identical to the source.";

  switch (mode) {
    case EditMode.WHITE_BG:
      prompt = "Remove the background of this product and replace it with a clean, high-end studio-quality solid pure white background. Keep the product's natural lighting and realistic soft shadows at the bottom. COMPOSITION: Center the product perfectly and leave significant white space/padding at BOTH the top and bottom of the frame.";
      break;
    case EditMode.COLOR_RECOLOR:
      prompt = `PROFESSIONAL RECOLORING TASK: Change the color of this product to exactly ${extraPrompt}. 
      CRITICAL RULES:
      1. Only change the color of the main product. 
      2. PRESERVE ALL ORIGINAL TEXTURES, shadows, highlights, and material details. If it is fabric, the weave must remain visible. 
      3. The lighting must look natural as if the product was manufactured in this color.
      4. Maintain a clean pure white background.
      5. Do not change the shape or structure of the product.`;
      break;
    case EditMode.ON_MODEL:
      prompt = `Show a professional fashion model wearing this product. ${commonModelInstructions} ${extraPrompt || ""}`;
      break;
    case EditMode.MODEL_FRONT:
      prompt = `Show a professional fashion model wearing this product in a direct FRONT-FACING pose. ${commonModelInstructions} ${extraPrompt || ""}`;
      break;
    case EditMode.MODEL_BACK:
      prompt = `Show a professional fashion model wearing this product in a direct REAR-FACING pose. ${commonModelInstructions} ${extraPrompt || ""}`;
      break;
    case EditMode.MODEL_SIDE:
      prompt = `Show a professional fashion model wearing this product in a 90-degree SIDE PROFILE pose. ${commonModelInstructions} ${extraPrompt || ""}`;
      break;
    case EditMode.MODEL_3_4:
      prompt = `Show a professional fashion model wearing this product in a 45-degree 3/4 VIEW pose. ${commonModelInstructions} ${extraPrompt || ""}`;
      break;
  }

  try {
    const parts: any[] = [
      {
        inlineData: {
          data: base64Image.split(',')[1],
          mimeType: 'image/png',
        },
      },
      { text: prompt }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "3:4" 
        }
      }
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("No candidates returned from Gemini");
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Gemini Image API Error:", error);
    throw error;
  }
}
