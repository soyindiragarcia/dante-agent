import axios from 'axios';

// Gemini Flash 2.0 — gratis para visión
export async function analyzeImageWithGemini(base64, mediaType, userPrompt = null) {
  const prompt = userPrompt ||
    'Describe esta imagen detalladamente en español. Incluye todo lo que ves: texto visible, objetos, personas, colores, contexto, números, logos. Sé muy específico y completo.';

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{
        parts: [
          { inline_data: { mime_type: mediaType, data: base64 } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    }
  );

  const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini no devolvió respuesta');
  console.log(`🔮 Gemini Vision: imagen analizada (${text.length} chars)`);
  return text;
}
