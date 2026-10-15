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
let historialGlobalCache = []
let filtroActualTurnos = 'todos'
const byId = id => document.getElementById(id)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const money = n => '$' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })
const digits = s => String(s || '').replace(/\D/g, '')

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
    cargarClientesDir()
    cargarVentas()
    cargarHistorialGeneral()
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

// 2. NAVEGACIÓN ENTRE PESTAÑAS (5 PANELERAS)
window.cambiarPestana = function(pestana) {
    const activo = "bg-pink-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold"
    const inactivo = "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-md text-xs font-semibold"
    ;['turnos', 'ventas', 'historial', 'catalogo', 'estadisticas'].forEach(p => {
        const sec = document.getElementById(`seccion-${p}`)
        const btn = document.getElementById(`nav-btn-${p}`)
        if (sec) sec.classList.toggle('hidden', p !== pestana)
        if (btn) btn.className = p === pestana ? activo : inactivo
    })
    if (pestana === 'turnos') cargarTurnos()
    else if (pestana === 'ventas') { cargarCatalogo(); cargarClientesDir(); cargarVentas() }
    else if (pestana === 'historial') cargarHistorialGeneral()
    else if (pestana === 'catalogo') renderizarTablaCatalogoAdmin()
    else if (pestana === 'estadisticas') calcularEstadisticasVentas()
}

// 3. CARGAR CATÁLOGO EN SELECT
async function cargarCatalogo() {
    try {
        const { data, error } = await supabase.from('ejemplo_catalogo').select('*').order('categoria', { ascending: true })
        if (error) throw error
        catalogoCache = data || []
        poblarVentas()

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

            if (error) throw error

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

let fechaRefTurnos = new Date()
const TITULOS_TURNOS = { todos: 'Próximos Turnos (General)', dia: 'Turnos del Día', semana: 'Turnos de la Semana', mes: 'Turnos del Mes' }

function rangoTurnos() {
    const ref = new Date(fechaRefTurnos)
    ref.setHours(0, 0, 0, 0)
    if (filtroActualTurnos === 'dia') {
        const fin = new Date(ref); fin.setDate(fin.getDate() + 1)
        return [ref, fin]
    }
    if (filtroActualTurnos === 'semana') {
        const ini = new Date(ref)
        ini.setDate(ref.getDate() - (ref.getDay() === 0 ? 6 : ref.getDay() - 1))
        const fin = new Date(ini); fin.setDate(ini.getDate() + 7)
        return [ini, fin]
    }
    if (filtroActualTurnos === 'mes') {
        return [new Date(ref.getFullYear(), ref.getMonth(), 1), new Date(ref.getFullYear(), ref.getMonth() + 1, 1)]
    }
    return null
}

window.filtrarTurnos = function(tipo) {
    filtroActualTurnos = tipo
    fechaRefTurnos = new Date()
    ;['todos', 'dia', 'semana', 'mes'].forEach(t => {
        const btn = byId(`btn-filtro-${t}`)
        if (btn) btn.className = (t === tipo) ? "bg-pink-600 text-white px-3 py-1.5 rounded-md font-medium" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-200"
    })
    byId('nav-rango-turnos').classList.toggle('hidden', tipo === 'todos')
    pintarTablaTurnos()
}

window.moverRangoTurnos = function(dir) {
    const d = new Date(fechaRefTurnos)
    if (dir === 0) fechaRefTurnos = new Date()
    else {
        if (filtroActualTurnos === 'dia') d.setDate(d.getDate() + dir)
        else if (filtroActualTurnos === 'semana') d.setDate(d.getDate() + 7 * dir)
        else if (filtroActualTurnos === 'mes') { d.setDate(1); d.setMonth(d.getMonth() + dir) }
        fechaRefTurnos = d
    }
    pintarTablaTurnos()
}

function pintarTablaTurnos() {
    if (!turnosTabla) return
    turnosTabla.innerHTML = ""
    if (!Array.isArray(listaTurnosCache)) listaTurnosCache = []
    if (tituloTablaTurnos) tituloTablaTurnos.textContent = TITULOS_TURNOS[filtroActualTurnos]

    const rango = rangoTurnos()
    const filtrados = listaTurnosCache.filter(t => {
        if (!rango) return true
        const f = new Date(t.fecha_hora)
        return f >= rango[0] && f < rango[1]
    })

    const lbl = byId('rango-turnos-label')
    if (lbl && rango) {
        let txt
        if (filtroActualTurnos === 'dia') txt = rango[0].toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
        else if (filtroActualTurnos === 'semana') {
            const ult = new Date(rango[0]); ult.setDate(ult.getDate() + 6)
            const o = { day: 'numeric', month: 'short' }
            txt = `${rango[0].toLocaleDateString('es-AR', o)} al ${ult.toLocaleDateString('es-AR', o)}`
        } else txt = rango[0].toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
        const suma = filtrados.reduce((s, t) => s + Number(t.precio_cobrado || 0), 0)
        lbl.textContent = `${txt} · ${filtrados.length} turno(s) · ${money(suma)}`
    }

    if (filtrados.length === 0) {
        turnosTabla.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">No hay turnos ${rango ? 'en este período' : 'registrados'}.</td></tr>`
        return
    }

    let diaPrevio = ''
    filtrados.forEach(t => {
        const f = new Date(t.fecha_hora)
        if (rango && filtroActualTurnos !== 'dia' && f.toDateString() !== diaPrevio) {
            diaPrevio = f.toDateString()
            const h = document.createElement('tr')
            h.innerHTML = `<td colspan="4" class="px-3 py-1.5 bg-pink-50 dark:bg-gray-700 text-xs font-bold text-pink-700 dark:text-pink-300 capitalize">${f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</td>`
            turnosTabla.appendChild(h)
        }
        const fechaFmt = f.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
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
    if (!turno) return alert("Error: No se encontró el turno.")

    if (confirm(`¿Marcar el turno de ${turno.cliente} como atendido y registrarlo en las estadísticas de ventas?`)) {
        try {
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

            if (errorHistorial) throw errorHistorial

            const { error: errorBorrar } = await supabase.from('ejemplo_turnos').delete().eq('id', id)
            if (errorBorrar) throw errorBorrar

            cargarTurnos()
        } catch (e) { 
            console.error("Error al completar turno:", e)
            alert("Hubo un error al completar el turno.") 
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

// 8. BUSCADOR RÁPIDO DE HISTORIAL (EN SECCIÓN TURNOS)
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
                <td class="px-3 py-3">${(item.notas || '').startsWith('[VENTA') ? '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold mr-1">🛒 VENTA</span>' : ''}${item.servicio_nombre} <span class="text-xs text-pink-500 font-semibold">(${item.variante || ''})</span></td>
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

// ================= 9. PANEL DE VENTAS (POS) CON RESPALDO MASTER =================
let carrito = [], ventaCliente = null, clientesDir = [], historialCliCache = [], ventasMasterCache = []
const clienteKey = (n, c) => digits(c) || String(n || '').toLowerCase()

async function cargarClientesDir() {
    const [h, t] = await Promise.all([
        supabase.from('ejemplo_historial').select('id,cliente,celular,servicio_nombre,variante,precio_cobrado,fecha_atencion,notas'),
        supabase.from('ejemplo_turnos').select('cliente,celular')
    ])
    historialCliCache = h.data || []
    const mapa = new Map()
    for (const r of [...historialCliCache, ...(t.data || [])]) {
        if (!r.cliente || r.cliente === 'Consumidor final') continue
        const key = clienteKey(r.cliente, r.celular)
        if (!mapa.has(key)) mapa.set(key, { key, nombre: r.cliente, celular: r.celular || '' })
    }
    clientesDir = [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
}

function seleccionarCliente(c) {
    ventaCliente = c ? { nombre: c.nombre, celular: c.celular, key: c.key, nuevo: false } : null
    byId('venta-cliente-buscar').value = ''
    byId('venta-cliente-sug').classList.add('hidden')
    renderFichaCliente()
}

function renderFichaCliente() {
    const box = byId('venta-cliente-ficha')
    if (!ventaCliente) {
        box.innerHTML = `<p class="text-xs text-gray-500">🧾 Consumidor final (la venta no queda en ninguna ficha).</p>`
        return
    }
    if (ventaCliente.nuevo) {
        box.innerHTML = `
            <p class="text-xs font-bold text-pink-600 mb-2">➕ Clienta nueva (se crea su ficha al confirmar)</p>
            <input id="vc-nombre" placeholder="Nombre" value="${esc(ventaCliente.nombre)}" class="w-full mb-2 p-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm">
            <input id="vc-cel" placeholder="Celular" value="${esc(ventaCliente.celular)}" class="w-full p-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm">
            <button type="button" onclick="seleccionarClienteNull()" class="text-xs text-gray-500 mt-2 underline">Cancelar</button>`
        byId('vc-nombre').oninput = e => ventaCliente.nombre = e.target.value
        byId('vc-cel').oninput = e => ventaCliente.celular = e.target.value
        return
    }
    const filas = historialCliCache.filter(r => clienteKey(r.cliente, r.celular) === ventaCliente.key)
        .sort((a, b) => new Date(b.fecha_atencion) - new Date(a.fecha_atencion))
    const gastado = filas.reduce((s, r) => s + Number(r.precio_cobrado || 0), 0)
    const compras = filas.filter(r => (r.notas || '').startsWith('[VENTA')).length
    const fmt = d => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' })
    box.innerHTML = `
        <div class="flex justify-between items-start">
            <div><p class="font-bold">${esc(ventaCliente.nombre)}</p><p class="text-xs text-green-500 font-bold">📱 ${esc(ventaCliente.celular)}</p></div>
            <button type="button" onclick="seleccionarClienteNull()" class="text-gray-400 hover:text-red-500 font-bold" title="Quitar">✕</button>
        </div>
        <div class="grid grid-cols-3 gap-1 text-center mt-2 text-xs">
            <div class="bg-gray-50 dark:bg-gray-900 rounded p-1"><b class="block text-pink-600">${filas.length}</b>registros</div>
            <div class="bg-gray-50 dark:bg-gray-900 rounded p-1"><b class="block text-pink-600">${compras}</b>productos</div>
            <div class="bg-gray-50 dark:bg-gray-900 rounded p-1"><b class="block text-emerald-500">${money(gastado)}</b>gastado</div>
        </div>
        ${filas.length ? `<p class="text-[11px] text-gray-500 mt-2">Último: ${esc(filas[0].servicio_nombre)} (${fmt(filas[0].fecha_atencion)})</p>` : '<p class="text-[11px] text-gray-500 mt-2">Sin registros previos.</p>'}`
}
window.seleccionarClienteNull = () => seleccionarCliente(null)

function poblarVentas() {
    const selCat = byId('venta-filtro-categoria')
    if (!selCat || !byId('venta-select-producto')) return
    const previa = selCat.value
    const cats = [...new Set(catalogoCache.map(i => i.categoria))].sort()
    selCat.innerHTML = `<option value="">Todas las categorías</option>` + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')
    selCat.value = cats.includes(previa) ? previa : ''
    filtrarSelectorVentas()
}

function filtrarSelectorVentas() {
    const sel = byId('venta-select-producto')
    const cat = byId('venta-filtro-categoria').value
    const q = byId('venta-buscar-producto').value.trim().toLowerCase()
    const previo = sel.value
    const lista = catalogoCache.filter(i => (!cat || i.categoria === cat) && (!q || `${i.nombre} ${i.variante || ''} ${i.categoria}`.toLowerCase().includes(q)))
    sel.innerHTML = `<option value="">-- Elegí un producto (${lista.length}) --</option>` + lista.map(i => {
        const sin = Number(i.stock) <= 0
        return `<option value="${esc(i.id)}" ${sin ? 'disabled' : ''}>${esc(i.nombre)}${i.variante ? ' - ' + esc(i.variante) : ''} · ${money(i.precio)} · ${sin ? 'SIN STOCK' : 'stock ' + i.stock}</option>`
    }).join('')
    sel.value = lista.some(i => String(i.id) === previo) ? previo : ''
    actualizarInfoProducto()
}

const itemSeleccionado = () => catalogoCache.find(i => String(i.id) === byId('venta-select-producto').value)
const enCarrito = id => carrito.filter(l => String(l.id) === String(id)).reduce((s, l) => s + l.cantidad, 0)

function actualizarInfoProducto() {
    const item = itemSeleccionado(), info = byId('venta-info-producto')
    if (!item) { info.textContent = ''; return }
    const disp = Number(item.stock) - enCarrito(item.id)
    info.textContent = `Disponible: ${disp} u.${disp <= 5 ? ' ⚠️ stock bajo' : ''}`
    info.className = 'text-xs min-h-[1rem] ' + (disp <= 5 ? 'text-amber-500 font-bold' : 'text-gray-500')
}

function agregarAlCarrito() {
    const item = itemSeleccionado()
    if (!item) return alert('Elegí un producto.')
    const cant = parseInt(byId('venta-cantidad').value) || 0
    const precio = parseFloat(byId('venta-precio-unit').value)
    if (cant < 1) return alert('La cantidad debe ser al menos 1.')
    if (isNaN(precio) || precio < 0) return alert('Precio inválido.')
    const disp = Number(item.stock) - enCarrito(item.id)
    if (cant > disp) return alert(`Stock insuficiente. Disponible: ${disp}`)
    const linea = carrito.find(l => String(l.id) === String(item.id) && l.precio === precio)
    if (linea) linea.cantidad += cant
    else carrito.push({ id: item.id, nombre: item.nombre, variante: item.variante || 'Estándar', precio, cantidad: cant })
    byId('venta-cantidad').value = 1
    renderCarrito()
}

window.ventaCant = function(i, d) {
    const l = carrito[i], item = catalogoCache.find(x => String(x.id) === String(l.id))
    if (d > 0 && item && enCarrito(l.id) >= Number(item.stock)) return alert('No hay más stock disponible.')
    l.cantidad += d
    if (l.cantidad < 1) carrito.splice(i, 1)
    renderCarrito()
}
window.ventaQuitar = i => { carrito.splice(i, 1); renderCarrito() }

function renderCarrito() {
    const tb = byId('venta-carrito')
    tb.innerHTML = carrito.length ? carrito.map((l, i) => `
        <tr>
            <td class="px-3 py-2 font-semibold">${esc(l.nombre)}<br><span class="text-xs text-pink-500">${esc(l.variante)}</span></td>
            <td class="px-3 py-2">${money(l.precio)}</td>
            <td class="px-3 py-2 text-center whitespace-nowrap">
                <button onclick="ventaCant(${i},-1)" class="bg-gray-200 dark:bg-gray-700 w-6 h-6 rounded font-bold">−</button>
                <span class="mx-2 font-bold">${l.cantidad}</span>
                <button onclick="ventaCant(${i},1)" class="bg-gray-200 dark:bg-gray-700 w-6 h-6 rounded font-bold">+</button>
            </td>
            <td class="px-3 py-2 text-right font-bold text-emerald-500">${money(l.precio * l.cantidad)}</td>
            <td class="px-3 py-2 text-right"><button onclick="ventaQuitar(${i})" class="text-red-500 font-bold">✕</button></td>
        </tr>`).join('') : `<tr><td colspan="5" class="text-center py-6 text-gray-500">El carrito está vacío. Agregá productos desde el selector.</td></tr>`
    actualizarTotales()
    actualizarInfoProducto()
}

function calcTotales() {
    const subtotal = carrito.reduce((s, l) => s + l.precio * l.cantidad, 0)
    const v = parseFloat(byId('venta-descuento').value) || 0
    let descuento = byId('venta-desc-tipo').value === '%' ? subtotal * v / 100 : v
    descuento = Math.min(Math.max(descuento, 0), subtotal)
    return { subtotal, descuento, total: subtotal - descuento }
}

function actualizarTotales() {
    const t = calcTotales()
    byId('venta-subtotal').textContent = money(t.subtotal)
    byId('venta-desc-monto').textContent = '- ' + money(t.descuento)
    byId('venta-total').textContent = money(t.total)
    const rec = parseFloat(byId('venta-recibido').value)
    byId('venta-vuelto').textContent = isNaN(rec) || t.total <= 0 ? '' : (rec >= t.total ? 'Vuelto: ' + money(rec - t.total) : 'Faltan ' + money(t.total - rec))
}

// --- Confirmar venta impactando en Historial + Tabla Maestra Master ---
async function confirmarVenta() {
    if (!carrito.length) return alert('El carrito está vacío.')
    let nombre = 'Consumidor final', celular = '-'
    if (ventaCliente) {
        nombre = (ventaCliente.nombre || '').trim()
        celular = (ventaCliente.celular || '').trim()
        if (!nombre || !celular) return alert('Completá nombre y celular de la clienta nueva.')
    }
    const btn = byId('venta-btn-confirmar')
    btn.disabled = true
    try {
        const { data: frescos, error: eStock } = await supabase.from('ejemplo_catalogo').select('id,stock').in('id', [...new Set(carrito.map(l => l.id))])
        if (eStock) throw eStock
        const stockDe = id => Number((frescos.find(f => String(f.id) === String(id)) || {}).stock ?? -1)
        for (const id of new Set(carrito.map(l => l.id))) {
            if (stockDe(id) < enCarrito(id)) {
                const l = carrito.find(x => String(x.id) === String(id))
                alert(`Stock insuficiente de "${l.nombre}". Disponible: ${Math.max(stockDe(id), 0)}`)
                await cargarCatalogo()
                return
            }
        }

        const { subtotal, descuento, total } = calcTotales()
        const factor = subtotal > 0 ? total / subtotal : 1
        const ticket = Date.now().toString(36).toUpperCase().slice(-6)
        const metodoPago = byId('venta-metodo').value
        const notaExtra = byId('venta-nota').value.trim()
        const notasHistorial = `[VENTA #${ticket}] ${metodoPago}${notaExtra ? ' · ' + notaExtra : ''}`
        const ahora = new Date().toISOString()

        // 1. Armar detalle de ítems para la tabla master
        const detalleItemsStr = carrito.map(l => `${l.cantidad}x ${l.nombre} (${l.variante})`).join(', ')

        // 2. Insertar fila maestra en ejemplo_ventas_master (Respaldo robusto)
        const { error: eMaster } = await supabase.from('ejemplo_ventas_master').insert([{
            ticket: ticket,
            cliente: nombre,
            celular: celular,
            detalle_items: detalleItemsStr,
            subtotal: Math.round(subtotal * 100) / 100,
            descuento: Math.round(descuento * 100) / 100,
            total_cobrado: Math.round(total * 100) / 100,
            metodo_pago: metodoPago,
            estado: 'COMPLETADA',
            notas: notaExtra || 'Sin notas',
            registrado_el: ahora
        }])
        if (eMaster) throw eMaster

        // 3. Insertar filas en ejemplo_historial (Para fichas de clientas y estadísticas)
        const filasHistorial = []
        carrito.forEach(l => {
            for (let i = 0; i < l.cantidad; i++) filasHistorial.push({
                cliente: nombre, celular, servicio_id: l.id, servicio_nombre: l.nombre, variante: l.variante,
                precio_cobrado: Math.round(l.precio * factor * 100) / 100, notas: notasHistorial, fecha_atencion: ahora
            })
        })
        const dif = Math.round((total - filasHistorial.reduce((s, f) => s + f.precio_cobrado, 0)) * 100) / 100
        filasHistorial[filasHistorial.length - 1].precio_cobrado = Math.round((filasHistorial[filasHistorial.length - 1].precio_cobrado + dif) * 100) / 100

        const { error: eHist } = await supabase.from('ejemplo_historial').insert(filasHistorial)
        if (eHist) throw eHist

        // 4. Descontar stock del catálogo
        let fallos = 0
        for (const id of new Set(carrito.map(l => l.id))) {
            const { error } = await supabase.from('ejemplo_catalogo').update({ stock: stockDe(id) - enCarrito(id) }).eq('id', id)
            if (error) fallos++
        }

        carrito = []; ventaCliente = null
        ;['venta-descuento', 'venta-recibido', 'venta-nota'].forEach(id => byId(id).value = id === 'venta-descuento' ? 0 : '')
        renderCarrito(); renderFichaCliente()
        await Promise.all([cargarCatalogo(), cargarClientesDir(), cargarVentas(), cargarHistorialGeneral()])
        alert(`¡Venta #${ticket} registrada con éxito por ${money(total)}!`)
    } catch (e) {
        console.error(e)
        alert('Error al registrar la venta: ' + (e.message || e))
    } finally { btn.disabled = false }
}

async function cargarVentas() {
    const { data, error } = await supabase.from('ejemplo_ventas_master').select('*').order('registrado_el', { ascending: false }).limit(100)
    if (error) return console.error(error)
    ventasMasterCache = data || []
    renderVentas()
}

function renderVentas() {
    const hoy = new Date().toDateString(), ahora = new Date()
    const completadas = ventasMasterCache.filter(v => v.estado === 'COMPLETADA')
    const deHoy = completadas.filter(v => new Date(v.registrado_el).toDateString() === hoy)
    const delMes = completadas.filter(v => { const f = new Date(v.registrado_el); return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear() })
    
    byId('vs-hoy').textContent = money(deHoy.reduce((s, v) => s + Number(v.total_cobrado || 0), 0))
    byId('vs-tickets').textContent = deHoy.length
    byId('vs-unidades').textContent = deHoy.reduce((s, v) => s + (v.detalle_items.match(/\d+x/g) || []).reduce((acc, m) => acc + parseInt(m), 0), 0)
    byId('vs-mes').textContent = money(delMes.reduce((s, v) => s + Number(v.total_cobrado || 0), 0))

    byId('venta-historial-lista').innerHTML = ventasMasterCache.length ? ventasMasterCache.slice(0, 20).map(v => {
        const esAnulada = v.estado === 'ANULADA'
        const fechaFmt = new Date(v.registrado_el).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
        return `<div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${esAnulada ? 'opacity-50 line-through' : ''}">
            <div>
                <p class="font-semibold">
                    #${v.ticket} · ${esc(v.cliente)} 
                    ${esAnulada ? '<span class="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold ml-1 no-underline">ANULADA</span>' : ''}
                    <span class="text-xs text-gray-400 font-normal ml-1">${fechaFmt}</span>
                </p>
                <p class="text-xs text-gray-500">${esc(v.detalle_items)}</p>
                <p class="text-xs text-pink-500">${esc(v.metodo_pago)} · Total: ${money(v.total_cobrado)}</p>
            </div>
            <div class="flex items-center gap-3">
                <strong class="${esAnulada ? 'text-gray-400' : 'text-emerald-500'}">${money(v.total_cobrado)}</strong>
                ${!esAnulada ? `<button onclick="anularVentaMaster('${v.ticket}')" class="text-red-500 text-xs font-bold no-underline">Anular</button>` : ''}
            </div>
        </div>`
    }).join('') : `<p class="text-center text-gray-500 py-4">Todavía no hay ventas registradas.</p>`
}

// --- Anular venta maestra con devolución de stock y marca de auditoría ---
window.anularVentaMaster = async function(ticket) {
    const v = ventasMasterCache.find(x => x.ticket === ticket)
    if (!v || v.estado === 'ANULADA') return
    if (!confirm(`¿Anular la venta #${ticket} por ${money(v.total_cobrado)}? Esto marcará la venta como ANULADA en el respaldo y devolverá el stock al catálogo.`)) return

    try {
        // 1. Marcar como ANULADA en ejemplo_ventas_master (Nunca borramos la traza fiscal/operativa)
        const { error: eUpd } = await supabase.from('ejemplo_ventas_master').update({ estado: 'ANULADA' }).eq('ticket', ticket)
        if (eUpd) throw eUpd

        // 2. Borrar las líneas correspondientes de ejemplo_historial para que no sigan sumando en estadísticas
        await supabase.from('ejemplo_historial').delete().ilike('notas', `[VENTA #${ticket}]%`)

        // 3. Devolver stock al catálogo analizando el detalle de ítems o buscando en el historial anterior
        // Como guardamos el detalle completo en master, busquemos los ítems que conformaban la venta en el historial antes de borrarlo, 
        // o mejor aún, devolvamos el stock consultando los productos vendidos en esa venta.
        // Vamos a extraer los productos del carrito o buscar en la tabla de historial los que tenían esa nota.
        // Para asegurar precisión, hagamos la devolución por medio de una consulta rápida a los ítems asociados:
        const { data: itemsVendidos } = await supabase.from('ejemplo_historial').select('servicio_id,precio_cobrado').ilike('notas', `[VENTA #${ticket}]%`)
        
        // Devolvemos el stock por cada ítem encontrado
        if (itemsVendidos && itemsVendidos.length > 0) {
            for (const item of itemsVendidos) {
                if (item.servicio_id) {
                    const { data: cat } = await supabase.from('ejemplo_catalogo').select('stock').eq('id', item.servicio_id).single()
                    if (cat) {
                        await supabase.from('ejemplo_catalogo').update({ stock: Number(cat.stock) + 1 }).eq('id', item.servicio_id)
                    }
                }
            }
        }

        await Promise.all([cargarCatalogo(), cargarClientesDir(), cargarVentas(), cargarHistorialGeneral()])
        alert(`Venta #${ticket} anulada correctamente y stock devuelto.`)
    } catch (e) {
        console.error(e)
        alert('Error al anular la venta: ' + (e.message || e))
    }
}

function initVentas() {
    if (!byId('seccion-ventas')) return
    byId('venta-filtro-categoria').onchange = filtrarSelectorVentas
    byId('venta-buscar-producto').oninput = filtrarSelectorVentas
    byId('venta-select-producto').onchange = () => {
        const item = itemSeleccionado()
        byId('venta-precio-unit').value = item ? item.precio : ''
        actualizarInfoProducto()
    }
    byId('venta-btn-agregar').onclick = agregarAlCarrito
    byId('venta-btn-vaciar').onclick = () => { carrito = []; renderCarrito() }
    byId('venta-btn-confirmar').onclick = confirmarVenta
    ;['venta-descuento', 'venta-desc-tipo', 'venta-recibido'].forEach(id => byId(id).addEventListener('input', actualizarTotales))

    const inp = byId('venta-cliente-buscar'), box = byId('venta-cliente-sug')
    inp.addEventListener('input', () => {
        const txt = inp.value.trim(), q = txt.toLowerCase(), qd = digits(txt)
        if (!txt) return box.classList.add('hidden')
        const res = clientesDir.filter(c => c.nombre.toLowerCase().includes(q) || (qd && digits(c.celular).includes(qd))).slice(0, 8)
        box.innerHTML = res.map(c => `<button type="button" data-k="${esc(c.key)}" class="w-full text-left px-3 py-2 text-sm hover:bg-pink-50 dark:hover:bg-gray-700 flex justify-between gap-2"><span class="font-semibold">${esc(c.nombre)}</span><span class="text-xs text-green-500">${esc(c.celular)}</span></button>`).join('')
            + `<button type="button" data-nuevo="1" class="w-full text-left px-3 py-2 text-sm text-pink-600 font-semibold hover:bg-pink-50 dark:hover:bg-gray-700 border-t dark:border-gray-700">➕ Clienta nueva: «${esc(txt)}»</button>`
        box.classList.remove('hidden')
    })
    box.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return
        if (b.dataset.nuevo) {
            const txt = inp.value.trim()
            ventaCliente = { nombre: digits(txt).length >= 6 ? '' : txt, celular: digits(txt).length >= 6 ? txt : '', nuevo: true }
            inp.value = ''; box.classList.add('hidden'); renderFichaCliente()
        } else seleccionarCliente(clientesDir.find(c => c.key === b.dataset.k))
    })
    document.addEventListener('click', e => { if (!e.target.closest('#venta-cliente-wrap')) box.classList.add('hidden') })

    renderFichaCliente(); renderCarrito()
}
initVentas()

// ================= 10. 5TO PANEL: HISTORIAL Y REPORTES AVANZADOS =================
async function cargarHistorialGeneral() {
    try {
        const { data, error } = await supabase.from('ejemplo_historial').select('*').order('fecha_atencion', { ascending: false })
        if (error) throw error
        historialGlobalCache = data || []
        renderizarHistorialAvanzado()
    } catch (e) {
        console.error("Error cargando historial general:", e)
    }
}

window.renderizarHistorialAvanzado = function() {
    const tbody = byId('tabla-historial-avanzado')
    if (!tbody) return

    const tipoFiltro = byId('filtrar-tipo-reg').value
    const pagoFiltro = byId('filtrar-pago-reg').value
    const periodoFiltro = byId('filtrar-periodo-reg').value
    const textoFiltro = byId('filtrar-texto-reg').value.trim().toLowerCase()

    const ahora = new Date()
    const filtrados = historialGlobalCache.filter(item => {
        const esVenta = (item.notas || '').startsWith('[VENTA')
        
        if (tipoFiltro === 'servicios' && esVenta) return false
        if (tipoFiltro === 'ventas' && !esVenta) return false

        if (pagoFiltro !== 'todos') {
            const nota = item.notas || ''
            if (!nota.includes(pagoFiltro)) return false
        }

        const fItem = new Date(item.fecha_atencion)
        if (periodoFiltro === 'dia') {
            if (fItem.toDateString() !== ahora.toDateString()) return false
        } else if (periodoFiltro === 'semana') {
            const ini = new Date(ahora); ini.setDate(ahora.getDate() - 7)
            if (fItem < ini) return false
        } else if (periodoFiltro === 'mes') {
            if (fItem.getMonth() !== ahora.getMonth() || fItem.getFullYear() !== ahora.getFullYear()) return false
        } else if (periodoFiltro === 'anio') {
            if (fItem.getFullYear() !== ahora.getFullYear()) return false
        }

        if (textoFiltro) {
            const combo = `${item.cliente} ${item.celular} ${item.servicio_nombre} ${item.variante || ''} ${item.notas || ''}`.toLowerCase()
            if (!combo.includes(textoFiltro)) return false
        }

        return true
    })

    const totalRecaudado = filtrados.reduce((s, i) => s + Number(i.precio_cobrado || 0), 0)
    const cantidadOps = filtrados.length
    const promedio = cantidadOps > 0 ? totalRecaudado / cantidadOps : 0

    byId('rep-total').textContent = money(totalRecaudado)
    byId('rep-cantidad').textContent = cantidadOps
    byId('rep-promedio').textContent = money(promedio)

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-500">No se encontraron registros con los filtros seleccionados.</td></tr>`
        return
    }

    tbody.innerHTML = filtrados.map(item => {
        const esVenta = (item.notas || '').startsWith('[VENTA')
        const fechaFmt = new Date(item.fecha_atencion).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
        return `
            <tr>
                <td class="px-3 py-3 text-xs text-gray-500">${fechaFmt}</td>
                <td class="px-3 py-3 font-semibold">
                    ${esVenta ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">🛒 Venta</span>' : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-800">💅 Servicio</span>'}
                </td>
                <td class="px-3 py-3 font-bold">${esc(item.cliente)}<br><span class="text-xs text-green-500 font-normal">📱 ${esc(item.celular)}</span></td>
                <td class="px-3 py-3">${esc(item.servicio_nombre)} <span class="text-xs text-pink-500 font-semibold">(${esc(item.variante || 'Estándar')})</span></td>
                <td class="px-3 py-3 text-xs text-gray-500 truncate max-w-xs" title="${esc(item.notas)}">${esc(item.notas || 'Sin notas')}</td>
                <td class="px-3 py-3 text-right font-black text-emerald-500">${money(item.precio_cobrado)}</td>
            </tr>
        `
    }).join('')
}

window.exportarHistorialExcel = function() {
    if (!historialGlobalCache.length) return alert('No hay datos para exportar.')
    
    let csv = '\uFEFFFecha,Tipo,Clienta,Celular,Item,Variante,Monto,Notas\n'
    historialGlobalCache.forEach(i => {
        const tipo = (i.notas || '').startsWith('[VENTA') ? 'Venta' : 'Servicio'
        const fecha = new Date(i.fecha_atencion).toLocaleString('es-AR')
        const notasLimpias = (i.notas || '').replace(/"/g, '""').replace(/\n/g, ' ')
        csv += `"${fecha}","${tipo}","${i.cliente}","${i.celular}","${i.servicio_nombre}","${i.variante || 'Estándar'}",${i.precio_cobrado},"${notasLimpias}"\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Reporte_Historial_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
}
// ================= 11. BUSCADOR MASTER Y REPORTE IMPRIMIBLE =================
window.abrirBuscadorMaestro = function() {
    byId('modal-buscador-master').classList.remove('hidden')
    filtrarBuscadorMaster()
}

window.cerrarBuscadorMaestro = function() {
    byId('modal-buscador-master').classList.add('hidden')
}

window.filtrarBuscadorMaster = function() {
    const texto = (byId('master-input-buscar').value || '').trim().toLowerCase()
    const estadoSel = byId('master-filtro-estado').value
    const tbody = byId('tabla-buscador-master')
    if (!tbody) return

    const filtrados = ventasMasterCache.filter(v => {
        if (estadoSel !== 'todos' && v.estado !== estadoSel) return false
        if (texto) {
            const combo = `${v.ticket} ${v.cliente} ${v.celular} ${v.detalle_items} ${v.metodo_pago} ${v.notas}`.toLowerCase()
            if (!combo.includes(texto)) return false
        }
        return true
    })

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-500">No se encontraron registros en el respaldo master.</td></tr>`
        return
    }

    tbody.innerHTML = filtrados.map(v => {
        const esAnulada = v.estado === 'ANULADA'
        const fechaFmt = new Date(v.registrado_el).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
        return `
            <tr class="${esAnulada ? 'bg-red-50/50 dark:bg-red-950/20 text-gray-400' : ''}">
                <td class="px-3 py-3 text-xs">
                    <strong class="text-pink-600">#${v.ticket}</strong><br>
                    <span class="text-gray-400 font-normal">${fechaFmt}</span>
                </td>
                <td class="px-3 py-3 font-bold">
                    ${esc(v.cliente)}<br>
                    <span class="text-xs text-green-500 font-normal">📱 ${esc(v.celular)}</span>
                </td>
                <td class="px-3 py-3 text-xs">
                    ${esc(v.detalle_items)}
                    ${v.notas && v.notas !== 'Sin notas' ? `<br><span class="text-[11px] text-gray-400">Nota: ${esc(v.notas)}</span>` : ''}
                </td>
                <td class="px-3 py-3 text-xs">
                    <span class="font-semibold">${esc(v.metodo_pago)}</span><br>
                    ${esAnulada ? '<span class="bg-red-100 text-red-700 text-[10px] px-1 py-0.5 rounded font-bold">ANULADA</span>' : '<span class="bg-emerald-100 text-emerald-700 text-[10px] px-1 py-0.5 rounded font-bold">COMPLETADA</span>'}
                </td>
                <td class="px-3 py-3 text-right font-black ${esAnulada ? 'line-through text-gray-400' : 'text-emerald-500'}">
                    ${money(v.total_cobrado)}
                </td>
            </tr>
        `
    }).join('')
}

window.imprimirReporteMaster = function() {
    window.print()
}