import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ffzffhxexxtreuqksvdy.supabase.co' 
const SUPABASE_ANON_KEY = 'sb_publishable_5FHBhxV0i5sM4vzyRlI4Tg_jjC4Y6ip' 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const logoutBtn = document.getElementById('logout-btn')
const turnoForm = document.getElementById('turno-form')
const turnosTabla = document.getElementById('turnos-tabla')
const tituloTablaTurnos = document.getElementById('titulo-tabla-turnos')
const selectCatalogoServicio = document.getElementById('select-catalogo-servicio')
const inputPrecioCobrado = document.getElementById('precio-cobrado')
const buscadorCelular = document.getElementById('buscador-celular')
const btnBuscar = document.getElementById('btn-buscar')
const btnLimpiar = document.getElementById('btn-limpiar')
const historialTabla = document.getElementById('historial-tabla')

const btnToggleCalendario = document.getElementById('btn-toggle-calendario')
const calendarioContainer = document.getElementById('calendario-container')
const iconoFlecha = document.getElementById('icono-flecha')
const mesAnioTitulo = document.getElementById('mes-anio-titulo')
const calendarioGrid = document.getElementById('calendario-grid')
const btnMesAnterior = document.getElementById('mes-anterior')
const btnMesSiguiente = document.getElementById('mes-siguiente')

let fechaActualCalendario = new Date()
let listaTurnosCache = []
let catalogoCache = []
let filtroActualTurnos = 'todos'

// 1. VERIFICACIÓN DE SESIÓN
async function verificarSesion() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) {
        window.location.href = 'login.html'
    } else {
        inicializarSistema()
    }
}

verificarSesion()

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.href = 'login.html'
    })
}

async function inicializarSistema() {
    await cargarCatalogo()
    cargarTurnos()
}

// MODO CLARO / OSCURO
const htmlElement = document.documentElement
const themeToggleBtn = document.getElementById('theme-toggle-btn')
if (themeToggleBtn) {
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        htmlElement.classList.add('dark')
        themeToggleBtn.textContent = '☀️'
    } else {
        htmlElement.classList.remove('dark')
        themeToggleBtn.textContent = '🌙'
    }

    themeToggleBtn.addEventListener('click', () => {
        if (htmlElement.classList.contains('dark')) {
            htmlElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
            themeToggleBtn.textContent = '🌙'
        } else {
            htmlElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
            themeToggleBtn.textContent = '☀️'
        }
    })
}

// CALENDARIO DESPLEGABLE
if (btnToggleCalendario) {
    btnToggleCalendario.addEventListener('click', () => {
        calendarioContainer.classList.toggle('hidden')
        if (calendarioContainer.classList.contains('hidden')) {
            iconoFlecha.textContent = "▼"
        } else {
            iconoFlecha.textContent = "▲"
            renderizarCalendario()
        }
    })
}

if (btnMesAnterior) {
    btnMesAnterior.addEventListener('click', () => {
        fechaActualCalendario.setMonth(fechaActualCalendario.getMonth() - 1)
        renderizarCalendario()
    })
}

if (btnMesSiguiente) {
    btnMesSiguiente.addEventListener('click', () => {
        fechaActualCalendario.setMonth(fechaActualCalendario.getMonth() + 1)
        renderizarCalendario()
    })
}

// 2. NAVEGACIÓN ENTRE PESTAÑAS
window.cambiarPestana = function(pestana) {
    const secTurnos = document.getElementById('seccion-turnos')
    const secCatalogo = document.getElementById('seccion-catalogo')
    const secEstadisticas = document.getElementById('seccion-estadisticas')

    secTurnos.classList.add('hidden')
    secCatalogo.classList.add('hidden')
    secEstadisticas.classList.add('hidden')

    document.getElementById('nav-btn-turnos').className = "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-md text-xs font-semibold"
    document.getElementById('nav-btn-catalogo').className = "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-md text-xs font-semibold"
    document.getElementById('nav-btn-estadisticas').className = "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-md text-xs font-semibold"

    if (pestana === 'turnos') {
        secTurnos.classList.remove('hidden')
        document.getElementById('nav-btn-turnos').className = "bg-pink-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold"
        cargarTurnos()
    } else if (pestana === 'catalogo') {
        secCatalogo.classList.remove('hidden')
        document.getElementById('nav-btn-catalogo').className = "bg-pink-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold"
        renderizarTablaCatalogoAdmin()
    } else if (pestana === 'estadisticas') {
        secEstadisticas.classList.remove('hidden')
        document.getElementById('nav-btn-estadisticas').className = "bg-pink-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold"
        calcularEstadisticasVentas()
    }
}

// 3. CARGAR CATÁLOGO EN SELECT
async function cargarCatalogo() {
    try {
        const { data, error } = await supabase.from('ejemplo_catalogo').select('*').order('categoria', { ascending: true })
        
        if (error) throw error
        catalogoCache = data || []

        if (selectCatalogoServicio) {
            selectCatalogoServicio.innerHTML = `<option value="">-- Selecciona un servicio o producto --</option>`
            catalogoCache.forEach(item => {
                const opt = document.createElement('option')
                opt.value = item.id
                opt.textContent = `[${item.categoria}] ${item.nombre} ${item.variante ? ' - ' + item.variante : ''} ($${item.precio})`
                selectCatalogoServicio.appendChild(opt)
            })

            selectCatalogoServicio.onchange = (e) => {
                const seleccionado = catalogoCache.find(i => i.id === e.target.value)
                if (seleccionado && inputPrecioCobrado) {
                    inputPrecioCobrado.value = seleccionado.precio
                }
            }
        }
    } catch (err) {
        console.error("Error cargando catálogo:", err)
    }
}

// 4. AGENDAR NUEVO TURNO
if (turnoForm) {
    turnoForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        const nombre = document.getElementById('cliente-nombre').value
        const celular = document.getElementById('cliente-celular').value
        const servicioId = selectCatalogoServicio.value
        const precioCobrado = parseFloat(inputPrecioCobrado.value) || 0
        const notas = document.getElementById('cliente-notas').value || "Sin notas"
        const fechaHoraInput = document.getElementById('fecha-hora').value

        const itemServicio = catalogoCache.find(i => i.id === servicioId)
        if (!itemServicio) return alert("Selecciona un servicio válido.")

        try {
            const fechaHoraFormateada = new Date(fechaHoraInput).toISOString()

            const { error } = await supabase.from('ejemplo_turnos').insert([{
                cliente: nombre,
                celular: celular,
                servicio_id: servicioId,
                servicio_nombre: itemServicio.nombre,
                variante: itemServicio.variante || 'Estándar',
                precio_cobrado: precioCobrado,
                notas: notas,
                fecha_hora: fechaHoraFormateada
            }])

            if (error) {
                console.error("DETALLE DEL ERROR SUPABASE:", error.message)
                alert("Error de Supabase: " + error.message)
                return
            }

            turnoForm.reset()
            inputPrecioCobrado.value = ""
            cargarTurnos()
            alert("¡Turno agendado con éxito!")
        } catch (error) {
            console.error("Error al guardar turno: ", error)
            alert("Hubo un error al guardar el turno.")
        }
    })
}

// 5. CARGAR TURNOS ACTIVOS Y CALENDARIO
async function cargarTurnos() {
    try {
        const { data, error } = await supabase.from('ejemplo_turnos').select('*').order('fecha_hora', { ascending: true })
        if (error) throw error
        listaTurnosCache = data || []
        pintarTablaTurnos()
        if (calendarioContainer && !calendarioContainer.classList.contains('hidden')) {
            renderizarCalendario()
        }
    } catch (err) { console.error(err) }
}

window.filtrarTurnos = function(tipo) {
    filtroActualTurnos = tipo
    ['todos', 'hoy', 'semana'].forEach(t => {
        const btn = document.getElementById(`btn-filtro-${t}`)
        if (btn) btn.className = (t === tipo) ? "bg-pink-600 text-white px-3 py-1.5 rounded-md font-medium" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-md"
    })
    pintarTablaTurnos()
}

function pintarTablaTurnos() {
    if (!turnosTabla) return
    turnosTabla.innerHTML = ""

    // Blindaje por si listaTurnosCache no es un array válido
    if (!Array.isArray(listaTurnosCache)) {
        listaTurnosCache = []
    }

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const finSemana = new Date()
    finSemana.setDate(hoy.getDate() + 7)

    const filtrados = listaTurnosCache.filter(t => {
        const f = new Date(t.fecha_hora)
        if (filtroActualTurnos === 'hoy') return f.getDate() === hoy.getDate() && f.getMonth() === hoy.getMonth()
        if (filtroActualTurnos === 'semana') return f >= hoy && f <= finSemana
        return true
    })

    if (filtrados.length === 0) {
        turnosTabla.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">No hay turnos registrados.</td></tr>`
        return
    }

    filtrados.forEach(t => {
        const fechaFmt = new Date(t.fecha_hora).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
        const tr = document.createElement('tr')
        tr.innerHTML = `
            <td class="px-3 py-3 font-semibold">${t.cliente}<br><a href="https://wa.me/${t.celular.replace(/\D/g, '')}" target="_blank" class="text-xs text-green-500 font-bold">📱 ${t.celular}</a></td>
            <td class="px-3 py-3">${t.servicio_nombre} <br><span class="text-xs text-pink-500 font-semibold">${t.variante || ''}</span></td>
            <td class="px-3 py-3 font-medium">${fechaFmt}<br><strong class="text-emerald-500">$${t.precio_cobrado}</strong></td>
            <td class="px-3 py-3 text-right space-x-1">
                <button class="text-green-500 bg-green-50 dark:bg-green-950 px-2 py-1 rounded text-xs font-semibold" onclick="completarTurno('${t.id}')">Completar</button>
                <button class="text-red-500 bg-red-50 dark:bg-red-950 px-2 py-1 rounded text-xs font-semibold" onclick="cancelarTurno('${t.id}')">Cancelar</button>
            </td>
        `
        turnosTabla.appendChild(tr)
    })
}

function renderizarCalendario() {
    if (!calendarioGrid) return
    calendarioGrid.innerHTML = ""
    const anio = fechaActualCalendario.getFullYear()
    const mes = fechaActualCalendario.getMonth()
    const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    if (mesAnioTitulo) mesAnioTitulo.textContent = `${nombresMeses[mes]} ${anio}`

    const primerDiaMes = new Date(anio, mes, 1).getDay()
    const diaInicioSemana = primerDiaMes === 0 ? 6 : primerDiaMes - 1
    const ultimoDiaMes = new Date(anio, mes + 1, 0).getDate()

    for (let i = 0; i < diaInicioSemana; i++) {
        const celdaVacia = document.createElement('div')
        celdaVacia.className = "h-24 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700 opacity-30"
        calendarioGrid.appendChild(celdaVacia)
    }

    for (let dia = 1; dia <= ultimoDiaMes; dia++) {
        const celda = document.createElement('div')
        celda.className = "h-24 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-1 overflow-y-auto text-xs flex flex-col justify-between"
        
        const numeroDia = document.createElement('div')
        numeroDia.className = "font-bold text-gray-800 dark:text-gray-200 text-right"
        numeroDia.textContent = dia
        celda.appendChild(numeroDia)

        const contenedorTurnosDia = document.createElement('div')
        contenedorTurnosDia.className = "space-y-1 mt-1"

        listaTurnosCache.forEach(turno => {
            const fTurno = new Date(turno.fecha_hora)
            if (fTurno.getDate() === dia && fTurno.getMonth() === mes && fTurno.getFullYear() === anio) {
                const horaStr = fTurno.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                const itemTurno = document.createElement('div')
                itemTurno.className = "bg-pink-100 dark:bg-pink-950 text-pink-800 dark:text-pink-200 p-1 rounded text-[10px] truncate font-semibold"
                itemTurno.title = `${horaStr} - ${turno.cliente} (${turno.servicio_nombre})`
                itemTurno.textContent = `${horaStr} ${turno.cliente}`
                contenedorTurnosDia.appendChild(itemTurno)
            }
        })

        celda.appendChild(contenedorTurnosDia)
        calendarioGrid.appendChild(celda)
    }
}

window.completarTurno = async function(id) {
    const turno = listaTurnosCache.find(t => t.id == id)
    if (!turno) {
        console.error("No se encontró el turno en la caché local con id:", id)
        return alert("Error: No se encontró el turno en memoria.")
    }

    if (confirm(`¿Marcar el turno de ${turno.cliente} como atendido y registrarlo en las estadísticas de ventas?`)) {
        try {
            console.log("Intentando guardar en historial:", turno)

            // 1. Insertar en historial sin campos extraños
            const { error: errorHistorial } = await supabase.from('ejemplo_historial').insert([{
                cliente: turno.cliente,
                celular: turno.celular,
                servicio_id: turno.servicio_id || null,
                servicio_nombre: turno.servicio_nombre,
                variante: turno.variante || 'Estándar',
                precio_cobrado: Number(turno.precio_cobrado) || 0,
                notas: turno.notas || 'Sin notas',
                fecha_atencion: turno.fecha_hora
            }])

            if (errorHistorial) {
                console.error("Error al insertar en historial:", errorHistorial)
                alert("Error al guardar en el historial: " + errorHistorial.message)
                return
            }

            // 2. Borrar de turnos activos
            const { error: errorBorrar } = await supabase.from('ejemplo_turnos').delete().eq('id', id)

            if (errorBorrar) {
                console.error("Error al borrar de turnos activos:", errorBorrar)
                alert("Se guardó en historial pero costó borrar el turno activo.")
            }

            console.log("¡Turno completado con éxito!")
            cargarTurnos()
        } catch (e) { 
            console.error("Excepción general al completar turno:", e)
            alert("Hubo un error inesperado al completar el turno.") 
        }
    }
}

window.cancelarTurno = async function(id) {
    if (confirm("¿Cancelar este turno?")) {
        await supabase.from('ejemplo_turnos').delete().eq('id', id)
        cargarTurnos()
    }
}

// 6. GESTIÓN DE CATÁLOGO (ADMIN)
function renderizarTablaCatalogoAdmin() {
    const tbody = document.getElementById('tabla-catalogo-admin')
    if (!tbody) return
    tbody.innerHTML = ""

    if (catalogoCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500">Sin ítems en catálogo.</td></tr>`
        return
    }

    catalogoCache.forEach(item => {
        const tr = document.createElement('tr')
        tr.innerHTML = `
            <td class="px-3 py-3 font-bold text-pink-500">${item.categoria}</td>
            <td class="px-3 py-3 font-semibold">${item.nombre}</td>
            <td class="px-3 py-3 text-xs">${item.variante || 'N/A'}</td>
            <td class="px-3 py-3 font-bold text-emerald-500">$${item.precio}</td>
            <td class="px-3 py-3">${item.stock}</td>
            <td class="px-3 py-3 text-right space-x-2">
                <button onclick="editarProducto('${item.id}')" class="text-blue-500 text-xs font-bold">Editar</button>
                <button onclick="eliminarProducto('${item.id}')" class="text-red-500 text-xs font-bold">Borrar</button>
            </td>
        `
        tbody.appendChild(tr)
    })
}

window.abrirModalProducto = function() {
    document.getElementById('form-producto-catalogo').reset()
    document.getElementById('prod-id').value = ""
    document.getElementById('modal-titulo-prod').textContent = "Nuevo Ítem en Catálogo"
    document.getElementById('modal-producto').classList.remove('hidden')
}

window.cerrarModalProducto = function() {
    document.getElementById('modal-producto').classList.add('hidden')
}

window.editarProducto = function(id) {
    const item = catalogoCache.find(i => i.id === id)
    if (!item) return
    document.getElementById('prod-id').value = item.id
    document.getElementById('prod-categoria').value = item.categoria
    document.getElementById('prod-nombre').value = item.nombre
    document.getElementById('prod-variante').value = item.variante || ''
    document.getElementById('prod-precio').value = item.precio
    document.getElementById('prod-stock').value = item.stock
    document.getElementById('modal-titulo-prod').textContent = "Editar Ítem"
    document.getElementById('modal-producto').classList.remove('hidden')
}

const formProd = document.getElementById('form-producto-catalogo')
if (formProd) {
    formProd.onsubmit = async (e) => {
        e.preventDefault()
        const id = document.getElementById('prod-id').value
        const categoria = document.getElementById('prod-categoria').value
        const nombre = document.getElementById('prod-nombre').value
        const variante = document.getElementById('prod-variante').value
        const precio = parseFloat(document.getElementById('prod-precio').value)
        const stock = parseInt(document.getElementById('prod-stock').value)

        if (id) {
            await supabase.from('ejemplo_catalogo').update({ categoria, nombre, variante, precio, stock }).eq('id', id)
        } else {
            await supabase.from('ejemplo_catalogo').insert([{ categoria, nombre, variante, precio, stock }])
        }
        cerrarModalProducto()
        cargarCatalogo()
        renderizarTablaCatalogoAdmin()
    }
}

window.eliminarProducto = async function(id) {
    if (confirm("¿Eliminar este servicio del catálogo?")) {
        await supabase.from('ejemplo_catalogo').delete().eq('id', id)
        cargarCatalogo()
        renderizarTablaCatalogoAdmin()
    }
}

// 7. ESTADÍSTICAS Y MÉTRICAS
async function calcularEstadisticasVentas() {
    try {
        const { data: historial, error } = await supabase.from('ejemplo_historial').select('*')
        if (error) throw error

        let totalRecaudado = 0
        let totalServicios = historial ? historial.length : 0
        let conteoVariantes = {}

        if (historial) {
            historial.forEach(h => {
                totalRecaudado += Number(h.precio_cobrado || 0)
                const clave = `${h.servicio_nombre} (${h.variante || 'Estándar'})`
                if (!conteoVariantes[clave]) {
                    conteoVariantes[clave] = { cantidad: 0, recaudacion: 0 }
                }
                conteoVariantes[clave].cantidad += 1
                conteoVariantes[clave].recaudacion += Number(h.precio_cobrado || 0)
            })
        }

        document.getElementById('stat-recaudacion').textContent = `$ ${totalRecaudado.toLocaleString()}`
        document.getElementById('stat-servicios-vendidos').textContent = totalServicios

        let servicioEstrella = "Sin ventas registradas"
        let maxCant = -1
        for (let k in conteoVariantes) {
            if (conteoVariantes[k].cantidad > maxCant) {
                maxCant = conteoVariantes[k].cantidad
                servicioEstrella = k
            }
        }
        document.getElementById('stat-servicio-estrella').textContent = servicioEstrella

        const tbodyEst = document.getElementById('tabla-estadisticas-detalle')
        if (tbodyEst) {
            tbodyEst.innerHTML = ""
            const keys = Object.keys(conteoVariantes)
            if (keys.length === 0) {
                tbodyEst.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">Aún no hay ventas en el historial.</td></tr>`
                return
            }

            keys.forEach(k => {
                const parts = k.split(' (')
                const nombreServ = parts[0]
                const varianteServ = parts[1].replace(')', '')
                const info = conteoVariantes[k]

                const tr = document.createElement('tr')
                tr.innerHTML = `
                    <td class="px-3 py-3 font-semibold">${nombreServ}</td>
                    <td class="px-3 py-3 text-pink-500 font-bold">${varianteServ}</td>
                    <td class="px-3 py-3 font-bold">${info.cantidad} unidades</td>
                    <td class="px-3 py-3 font-black text-emerald-500">$ ${info.recaudacion.toLocaleString()}</td>
                `
                tbodyEst.appendChild(tr)
            })
        }
    } catch (e) { console.error("Error calculando estadísticas:", e) }
}

// 8. BUSCADOR DE HISTORIAL
window.verHistorialPorBusqueda = async function(parametro) {
    const texto = parametro || buscadorCelular.value.trim()
    if (!texto) return alert("Ingrese un nombre o celular.")

    if (parametro) buscadorCelular.value = parametro
    historialTabla.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500">Buscando...</td></tr>`

    try {
        const { data, error } = await supabase.from('ejemplo_historial').select('*').or(`cliente.ilike.%${texto}%,celular.ilike.%${texto}%`).order('completado_el', { ascending: false })
        if (error) throw error

        historialTabla.innerHTML = ""
        if (!data || data.length === 0) {
            historialTabla.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500">No se encontraron registros para "${texto}".</td></tr>`
            return
        }

        data.forEach(item => {
            const fechaFmt = new Date(item.fecha_atencion).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
            const tr = document.createElement('tr')
            tr.innerHTML = `
                <td class="px-3 py-3 font-bold">${item.cliente}</td>
                <td class="px-3 py-3">${item.celular}</td>
                <td class="px-3 py-3">${item.servicio_nombre} <span class="text-xs text-pink-500 font-semibold">(${item.variante || ''})</span></td>
                <td class="px-3 py-3 font-medium"><strong class="text-emerald-500">$${item.precio_cobrado}</strong><br><span class="text-xs text-gray-400">${fechaFmt}</span></td>
                <td class="px-3 py-3 text-right">
                    <button onclick="eliminarHistorial('${item.id}')" class="text-red-500 text-xs font-bold">Borrar</button>
                </td>
            `
            historialTabla.appendChild(tr)
        })
    } catch (e) { console.error(e) }
}

if (btnBuscar) btnBuscar.onclick = () => window.verHistorialPorBusqueda()
if (buscadorCelular) buscadorCelular.onkeypress = (e) => { if (e.key === 'Enter') window.verHistorialPorBusqueda() }
if (btnLimpiar) btnLimpiar.onclick = () => { buscadorCelular.value = ''; historialTabla.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500">Ingrese un nombre o número para buscar.</td></tr>` }

window.eliminarHistorial = async function(id) {
    if (confirm("¿Borrar este registro del historial?")) {
        await supabase.from('ejemplo_historial').delete().eq('id', id)
        window.verHistorialPorBusqueda(buscadorCelular.value.trim())
    }
}