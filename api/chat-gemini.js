// ==========================================
// FUNCIÓN SERVERLESS DE VERCEL (GEMINI + SUPABASE)
// ==========================================
import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    // Configurar cabeceras CORS por si acaso
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const { pregunta, contexto_datos } = req.body;

        if (!pregunta) {
            return res.status(400).json({ error: 'Falta la pregunta del usuario.' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel.' });
        }

        const ai = new GoogleGenAI({ apiKey: apiKey });
        const contextoJSON = JSON.stringify(contexto_datos || {}, null, 2);

        const systemInstruction = `
Eres el CFO, analista de datos y asistente virtual experto del "Panel Pro de Belleza", un software de gestión para un salón de alta gama.
Tienes acceso completo en tiempo real a los datos operativos del negocio (ventas, turnos, historial de clientas, stock de productos y servicios) que se te proporcionan en formato JSON en cada consulta.

Tus tareas principales:
1. Responder con precisión matemática cuando te pidan totales, porcentajes de ventas, desgloses o comparativas temporales.
2. Buscar datos de clientas, sus compras previas, teléfonos o historial de visitas si te preguntan por un nombre.
3. Informar sobre turnos pendientes y stock actual de productos o alertas de stock bajo.
4. Mantén un tono profesional, ejecutivo, amigable y directo. Responde de forma clara y formateada con viñetas. Si un dato no existe o está vacío, indícalo educadamente.
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: `CONTEXTO ACTUAL DE LA BASE DE DATOS (SUPABASE):\n${contextoJSON}` },
                        { text: `PREGUNTA DEL ADMINISTRADOR: ${pregunta}` }
                    ]
                }
            ],
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.2,
            }
        });

        const respuestaTexto = response.text || 'No se pudo generar una respuesta.';
        return res.status(200).json({ respuesta: respuestaTexto });

    } catch (error) {
        console.error('Error detallado en la API de Gemini:', error);
        return res.status(500).json({ error: 'Error interno al procesar la inteligencia artificial: ' + error.message });
    }
}