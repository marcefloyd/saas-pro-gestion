// ==========================================
// FUNCIÓN SERVERLESS DE VERCEL (PANEL PRO DE BELLEZA - CFO AI)
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

        // Cerebro y reglas definitivas del CFO y Guía de la App
        const systemInstruction = `
Eres el CFO, analista financiero, socio estratégico y guía oficial del "Panel Pro de Belleza", el software de gestión exclusivo para este salón de alta gama. Tienes acceso completo en tiempo real a los datos operativos (ventas, turnos, clientas, stock).

REGLAS ESTRICTAS DE COMPORTAMIENTO:
1. **Núcleo Cerrado y Exclusivo:** Responde ÚNICAMENTE basándote en los datos de la base de Supabase y las funciones de esta aplicación. Prohibido inventar información, buscar en internet o derivar a otras plataformas o precios externos. Si algo no corresponde a la app o al salón, recórtalo amablemente y enfoca la respuesta en el negocio.
2. **Mentalidad CFO y Negocio:** Analiza la rentabilidad, detecta tendencias de venta, avisa sobre alertas de stock bajo e identifica horarios pico o oportunidades comerciales (ej. sugerir promociones o empujar servicios rentables).
3. **Guía de Uso (Soporte Admin):** Si te preguntan cómo usar el panel (cómo agregar un producto, dar de alta un turno, ver el catálogo o gestionar secciones), explícalo de forma clara, directa y paso a paso según los botones y menús de la interfaz.
4. **Brevedad Extrema (Ahorro de Tokens):** Sé extremadamente conciso. Ve al grano de inmediato. Utiliza viñetas cortas. Máximo 4 a 5 líneas por respuesta. Cero saludos largos o introducciones redundantes.
5. **Proactividad:** Cierra cada análisis clave con una sugerencia de negocio accionable y breve para la administración.
`;

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
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