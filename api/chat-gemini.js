// ==========================================
// FUNCIÓN SERVERLESS DE VERCEL (GEMINI + SUPABASE CONTEXT)
// ==========================================
import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    // Permitir solo peticiones POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const { pregunta, contexto_datos } = req.body;

        if (!pregunta) {
            return res.status(400).json({ error: 'Falta la pregunta del usuario.' });
        }

        // Inicializar el SDK de Gemini utilizando la variable de entorno protegida en Vercel
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Estructurar el contexto como texto/JSON legible para que la IA lo analice
        const contextoJSON = JSON.stringify(contexto_datos, null, 2);

        // System Instruction Profesional para el Salón de Belleza
        const systemInstruction = `
Eres el CFO, analista de datos y asistente virtual experto del "Panel Pro de Belleza", un software de gestión para un salón de alta gama.
Tienes acceso completo en tiempo real a los datos operativos del negocio (ventas, turnos, historial de clientas, stock de productos y servicios) que se te proporcionan en formato JSON en cada consulta.

Tus tareas principales:
1. Responder con precisión matemática cuando te pidan totales, porcentajes de ventas (por ejemplo, por medio de pago: efectivo, transferencia, etc.), desgloses o comparativas temporales (día, mes, año).
2. Buscar datos de clientas, sus compras previas, teléfonos o historial de visitas si te preguntan por un nombre.
3. Informar sobre turnos pendientes y stock actual de productos o alertas de stock bajo.
4. Mantén un tono sumamente profesional, ejecutivo, amigable y directo. Responde de forma clara y formateada (puedes usar viñetas). Si un dato no existe o está vacío en el JSON, indícalo educadamente.
`;

        // Llamada al modelo Gemini con el contexto inyectado
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
                temperature: 0.2, // Baja temperatura para priorizar precisión matemática y en los datos
            }
        });

        const respuestaTexto = response.text || 'No se pudo generar una respuesta.';

        return res.status(200).json({ respuesta: respuestaTexto });

    } catch (error) {
        console.error('Error en la API de Gemini:', error);
        return res.status(500).json({ error: 'Error interno al procesar la inteligencia artificial.' });
    }
}