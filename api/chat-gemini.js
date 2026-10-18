// ==========================================
// FUNCIÓN SERVERLESS DE VERCEL (GEMINI VIA FETCH DIRECTO)
// ==========================================
export default async function handler(req, res) {
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

        // Llamada directa a la API oficial de Gemini por HTTP POST (Sin dependencias raras)
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemInstruction }]
                },
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: `CONTEXTO ACTUAL DE LA BASE DE DATOS (SUPABASE):\n${contextoJSON}` },
                            { text: `PREGUNTA DEL ADMINISTRADOR: ${pregunta}` }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.2
                }
            })
        });

        const data = await geminiResponse.json();

        if (!geminiResponse.ok) {
            throw new Error(data.error?.message || 'Error al comunicarse con la API de Gemini.');
        }

        const respuestaTexto = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar una respuesta.';

        return res.status(200).json({ respuesta: respuestaTexto });

    } catch (error) {
        console.error('Error detallado:', error);
        return res.status(500).json({ error: 'Error interno: ' + error.message });
    }
}