import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ffzffhxexxtreuqksvdy.supabase.co' 
const SUPABASE_ANON_KEY = 'sb_publishable_5FHBhxV0i5sM4vzyRlI4Tg_jjC4Y6ip' 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// CONTRASEÑA DE SEGURIDAD PARA ANULAR VENTAS (PIN / PASSWORD MASTER)
const PIN_SEGURIDAD_ANULACION = "1234" 

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
let serviciosCache = []
let productosCache = []
let historialGlobalCache = []
let ventasMasterCache = []
let clientesDir = []
let historialCliCache = []
let carrito = []
let ventaCliente = null
let turnoClienteSeleccionado = null
let filtroActualTurnos = 'todos'

const byId = id => document.getElementById(id)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const money = n => '$' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })
const digits = s => String(s || '').replace(/\D/g, '')

// 1. VERIFICACIÓN DE SESIÓN
async function verificarSesion() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) {
        window.location.href = 'index.html'
    } else {
        inicializarSistema()
    }
}

verificarSesion()

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.href = 'index.html'
    })
}

async function inicializarSistema() {
    await cargarDatosBase()
    await cargarClientesDir()
    cargarTurnos()
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

// 2. NAVEGACIÓN ENTRE PESTAÑAS
window.cambiarPestana = function(pestana) {
    const activo = "bg-pink-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm w-full md:w-auto text-center"
    const inactivo = "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-gray-300 w-full md:w-auto text-center"
    ;['turnos', 'ventas', 'catalogo', 'estadisticas'].forEach(p => {
        const sec = document.getElementById(`seccion-${p}`)
        const btn = document.getElementById(`nav-btn-${p}`)
        if (sec) sec.classList.toggle('hidden', p !== pestana)
        if (btn) btn.className = p === pestana ? activo : inactivo
    })
    if (pestana === 'turnos') cargarTurnos()
    else if (pestana === 'ventas') { cargarDatosBase(); cargarClientesDir(); cargarVentas() }
    else if (pestana === 'catalogo') renderizarTablasCatalogoAdmin()
    else if (pestana === 'estadisticas') calcularEstadisticasVentas()
}

// 3. CARGAR DATOS BASE
async function cargarDatosBase() {
    try {
        const [servRes, prodRes] = await Promise.all([
            supabase.from('servicios').select('*').order('categoria', { ascending: true }),
            supabase.from('productos').select('*').order('categoria', { ascending: true })
        ])
        if (servRes.error) throw servRes.error
        if (prodRes.error) throw prodRes.error

        serviciosCache = servRes.data || []
        productosCache = prodRes.data || []

        poblarSelectorServiciosTurnos()
        poblarVentasProductos()
    } catch (err) {
        console.error("Error cargando base de datos:", err)
    }
}

function poblarSelectorServiciosTurnos() {
    if (!selectCatalogoServicio) return
    selectCatalogoServicio.innerHTML = `<option value="">-- Selecciona un servicio --</option>`
    serviciosCache.forEach(item => {
        const opt = document.createElement('option')
        opt.value = item.id
        opt.textContent = `[${item.categoria}] ${item.nombre} ${item.variante ? ' - ' + item.variante : ''} ($${item.precio})`
        selectCatalogoServicio.appendChild(opt)
    })

    selectCatalogoServicio.onchange = (e) => {
        const seleccionado = serviciosCache.find(i => i.id === e.target.value)
        if (seleccionado && inputPrecioCobrado) {
            inputPrecioCobrado.value = seleccionado.precio
        }
    }
}

// 4. AGENDAR NUEVO TURNO
if (turnoForm) {
    turnoForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        const nombre = byId('cliente-nombre-real').value.trim()
        const celular = byId('cliente-celular-real').value.trim()

        if (!nombre || !celular) {
            return alert("Por favor seleccione o escriba una clienta válida con nombre y celular.")
        }

        const servicioId = selectCatalogoServicio.value
        const precioBase = parseFloat(inputPrecioCobrado.value) || 0
        const vDesc = parseFloat(document.getElementById('turno-descuento').value) || 0
        const tipoDesc = document.getElementById('turno-desc-tipo').value
        const montoDesc = tipoDesc === '%' ? (precioBase * vDesc / 100) : vDesc
        const precioCobrado = Math.max(precioBase - montoDesc, 0)
        const metodoPago = document.getElementById('turno-metodo-pago').value
        const notas = document.getElementById('cliente-notas').value || "Sin notas"
        const fechaHoraInput = document.getElementById('fecha-hora').value

        const itemServicio = serviciosCache.find(i => i.id === servicioId)
        if (!itemServicio) return alert("Selecciona un servicio válido.")

        try {
            const fechaHoraFormateada = new Date(fechaHoraInput).toISOString()

            const { error } = await supabase.from('turnos').insert([{
                cliente_nombre: nombre,
                celular: celular,
                servicio_id: servicioId,
                servicio_nombre: `${itemServicio.nombre} (${metodoPago})`,
                variante: itemServicio.variante || 'Estándar',
                precio_cobrado: precioCobrado,
                notas: notas,
                fecha_hora: fechaHoraFormateada
            }])

            if (error) throw error

            turnoForm.reset()
            inputPrecioCobrado.value = ""
            document.getElementById('turno-descuento').value = 0
            turnoClienteSeleccionado = null
            renderFichaClienteTurno()
            cargarTurnos()
            cargarClientesDir()
            alert("¡Turno agendado con éxito!")
        } catch (error) {
            console.error("Error al guardar turno: ", error)
            alert("Hubo un error al guardar el turno.")
        }
    })
}

// 5. CARGAR TURNOS Y CALENDARIO
async function cargarTurnos() {
    try {
        const { data, error } = await supabase.from('turnos').select('*').order('fecha_hora', { ascending: true })
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
        if (btn) btn.className = (t === tipo) ? "bg-pink-600 text-white px-2.5 py-1 rounded-md font-medium" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2.5 py-1 rounded-md"
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
        turnosTabla.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">No hay turnos en este período.</td></tr>`
        return
    }

    let diaPrevio = ''
    filtrados.forEach(t => {
        const f = new Date(t.fecha_hora)
        if (rango && filtroActualTurnos !== 'dia' && f.toDateString() !== diaPrevio) {
            diaPrevio = f.toDateString()
            const h = document.createElement('tr')
            h.innerHTML = `<td colspan="4" class="px-2.5 py-1.5 bg-pink-50 dark:bg-gray-700 text-xs font-bold text-pink-700 dark:text-pink-300 capitalize">${f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</td>`
            turnosTabla.appendChild(h)
        }
        const fechaFmt = f.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
        const tr = document.createElement('tr')
        tr.innerHTML = `
            <td class="px-2.5 py-2.5 font-semibold">${t.cliente_nombre}<br><a href="https://wa.me/${t.celular.replace(/\D/g, '')}" target="_blank" class="text-[11px] text-green-500 font-bold">📱 ${t.celular}</a></td>
            <td class="px-2.5 py-2.5">${t.servicio_nombre} <br><span class="text-[11px] text-pink-500 font-semibold">${t.variante || ''}</span></td>
            <td class="px-2.5 py-2.5 font-medium">${fechaFmt}<br><strong class="text-emerald-500">$${t.precio_cobrado}</strong></td>
            <td class="px-2.5 py-2.5 text-right space-x-1 whitespace-nowrap">
                <button class="text-green-600 bg-green-50 dark:bg-green-950 px-2 py-1 rounded text-xs font-semibold" onclick="completarTurno('${t.id}')">Completar</button>
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
        celdaVacia.className = "h-20 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700 opacity-30"
        calendarioGrid.appendChild(celdaVacia)
    }

    for (let dia = 1; dia <= ultimoDiaMes; dia++) {
        const celda = document.createElement('div')
        celda.className = "h-20 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-1 overflow-y-auto text-[11px] flex flex-col justify-between"
        
        const numeroDia = document.createElement('div')
        numeroDia.className = "font-bold text-gray-800 dark:text-gray-200 text-right"
        numeroDia.textContent = dia
        celda.appendChild(numeroDia)

        const contenedorTurnosDia = document.createElement('div')
        contenedorTurnosDia.className = "space-y-0.5 mt-0.5"

        listaTurnosCache.forEach(turno => {
            const fTurno = new Date(turno.fecha_hora)
            if (fTurno.getDate() === dia && fTurno.getMonth() === mes && fTurno.getFullYear() === anio) {
                const horaStr = fTurno.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                const itemTurno = document.createElement('div')
                itemTurno.className = "bg-pink-100 dark:bg-pink-950 text-pink-800 dark:text-pink-200 p-0.5 rounded text-[9px] truncate font-semibold"
                itemTurno.title = `${horaStr} - ${turno.cliente_nombre} (${turno.servicio_nombre})`
                itemTurno.textContent = `${horaStr} ${turno.cliente_nombre}`
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

    if (confirm(`¿Marcar el turno de ${turno.cliente_nombre} como atendido e ingresarlo a Cierres Master?`)) {
        try {
            const ticket = Date.now().toString(36).toUpperCase().slice(-6)
            const ahora = new Date().toISOString()
            const precioCobrado = Number(turno.precio_cobrado) || 0

            const { error: eMaster } = await supabase.from('ventas_master').insert([{
                ticket: ticket,
                cliente: turno.cliente_nombre,
                celular: turno.celular,
                detalle_items: `1x ${turno.servicio_nombre} (${turno.variante || 'Estándar'})`,
                subtotal: precioCobrado,
                descuento: 0,
                total_cobrado: precioCobrado,
                metodo_pago: 'Turno / Servicio',
                estado: 'COMPLETADA',
                notas: turno.notas || 'Turno atendido',
                registrado_el: ahora
            }])
            if (eMaster) throw eMaster

            const { error: errorHistorial } = await supabase.from('historial_clientes').insert([{
                cliente: turno.cliente_nombre,
                celular: turno.celular,
                item_nombre: `${turno.servicio_nombre} (${turno.variante || 'Estándar'})`,
                variante: turno.variante || 'Estándar',
                precio_cobrado: precioCobrado,
                notas: `[VENTA #${ticket}] Turno atendido · ${turno.notas || 'Sin notas'}`,
                fecha_atencion: ahora
            }])
            if (errorHistorial) throw errorHistorial

            const { error: errorBorrar } = await supabase.from('turnos').delete().eq('id', id)
            if (errorBorrar) throw errorBorrar

            await Promise.all([cargarTurnos(), cargarVentas(), cargarHistorialGeneral()])
            alert(`¡Turno completado! Ticket #${ticket} registrado en el Master.`)
        } catch (e) { 
            console.error("Error al completar turno:", e)
            alert("Hubo un error al completar el turno.") 
        }
    }
}

window.cancelarTurno = async function(id) {
    if (confirm("¿Cancelar este turno de la agenda?")) {
        await supabase.from('turnos').delete().eq('id', id)
        cargarTurnos()
    }
}

// 6. GESTIÓN DE CATÁLOGO
function renderizarTablasCatalogoAdmin() {
    const tbServ = document.getElementById('tabla-servicios-admin')
    const tbProd = document.getElementById('tabla-productos-admin')
    if (!tbServ || !tbProd) return

    tbServ.innerHTML = serviciosCache.length ? serviciosCache.map(s => `
        <tr>
            <td class="px-2 py-2.5"><strong class="text-pink-600">${esc(s.categoria)}</strong><br>${esc(s.nombre)} <span class="text-[11px] text-gray-400">${esc(s.variante || '')}</span></td>
            <td class="px-2 py-2.5 font-bold text-emerald-500">${money(s.precio)}</td>
            <td class="px-2 py-2.5 text-right space-x-2 whitespace-nowrap">
                <button onclick="editarCatalogoItem('servicio', '${s.id}')" class="text-blue-500 text-xs font-bold">Editar</button>
                <button onclick="eliminarCatalogoItem('servicio', '${s.id}')" class="text-red-500 text-xs font-bold">Borrar</button>
            </td>
        </tr>`).join('') : `<tr><td colspan="3" class="text-center py-4 text-gray-500">Sin servicios.</td></tr>`

    tbProd.innerHTML = productosCache.length ? productosCache.map(p => `
        <tr>
            <td class="px-2 py-2.5"><strong class="text-indigo-600">${esc(p.categoria)}</strong><br>${esc(p.nombre)} <span class="text-[11px] text-gray-400">${esc(p.variante || '')}</span><br><span class="text-[11px] font-bold text-pink-600">Stock: ${p.stock}</span></td>
            <td class="px-2 py-2.5 font-bold text-emerald-500">${money(p.precio)}</td>
            <td class="px-2 py-2.5 text-right space-x-2 whitespace-nowrap">
                <button onclick="editarCatalogoItem('producto', '${p.id}')" class="text-blue-500 text-xs font-bold">Editar</button>
                <button onclick="eliminarCatalogoItem('producto', '${p.id}')" class="text-red-500 text-xs font-bold">Borrar</button>
            </td>
        </tr>`).join('') : `<tr><td colspan="3" class="text-center py-4 text-gray-500">Sin productos.</td></tr>`
}

window.abrirModalCatalogo = function(tipoTabla, id = null) {
    document.getElementById('form-modal-catalogo').reset()
    document.getElementById('cat-id').value = id || ''
    document.getElementById('cat-tipo-tabla').value = tipoTabla
    const wrapStock = document.getElementById('campo-stock-wrap')
    wrapStock.style.display = tipoTabla === 'producto' ? 'block' : 'none'
    document.getElementById('cat-stock').required = tipoTabla === 'producto'

    if (id) {
        const item = (tipoTabla === 'servicio' ? serviciosCache : productosCache).find(i => i.id === id)
        if (item) {
            document.getElementById('cat-categoria').value = item.categoria
            document.getElementById('cat-nombre').value = item.nombre
            document.getElementById('cat-variante').value = item.variante || ''
            document.getElementById('cat-precio').value = item.precio
            if (tipoTabla === 'producto') document.getElementById('cat-stock').value = item.stock
            document.getElementById('modal-titulo-cat').textContent = `Editar ${tipoTabla === 'servicio' ? 'Servicio' : 'Producto'}`
        }
    } else {
        document.getElementById('modal-titulo-cat').textContent = `Nuevo ${tipoTabla === 'servicio' ? 'Servicio' : 'Producto'}`
    }
    document.getElementById('modal-catalogo').classList.remove('hidden')
}

window.cerrarModalCatalogo = function() {
    document.getElementById('modal-catalogo').classList.add('hidden')
}

window.editarCatalogoItem = (tabla, id) => abrirModalCatalogo(tabla, id)

const formModalCat = document.getElementById('form-modal-catalogo')
if (formModalCat) {
    formModalCat.onsubmit = async (e) => {
        e.preventDefault()
        const id = document.getElementById('cat-id').value
        const tabla = document.getElementById('cat-tipo-tabla').value
        const categoria = document.getElementById('cat-categoria').value
        const nombre = document.getElementById('cat-nombre').value
        const variante = document.getElementById('cat-variante').value
        const precio = parseFloat(document.getElementById('cat-precio').value)
        const stock = tabla === 'producto' ? parseInt(document.getElementById('cat-stock').value) || 0 : null

        const payload = tabla === 'producto' ? { categoria, nombre, variante, precio, stock } : { categoria, nombre, variante, precio }

        if (id) {
            await supabase.from(tabla === 'servicio' ? 'servicios' : 'productos').update(payload).eq('id', id)
        } else {
            await supabase.from(tabla === 'servicio' ? 'servicios' : 'productos').insert([payload])
        }
        cerrarModalCatalogo()
        await cargarDatosBase()
        renderizarTablasCatalogoAdmin()
    }
}

window.eliminarCatalogoItem = async function(tabla, id) {
    if (confirm("¿Estás seguro de eliminar este ítem?")) {
        await supabase.from(tabla === 'servicio' ? 'servicios' : 'productos').delete().eq('id', id)
        await cargarDatosBase()
        renderizarTablasCatalogoAdmin()
    }
}

// 7. ESTADÍSTICAS Y MÉTRICAS
async function calcularEstadisticasVentas() {
    try {
        const { data: historial, error } = await supabase.from('historial_clientes').select('*')
        if (error) throw error

        let totalRecaudado = 0
        let totalServicios = historial ? historial.length : 0
        let conteoVariantes = {}

        if (historial) {
            historial.forEach(h => {
                totalRecaudado += Number(h.precio_cobrado || 0)
                const clave = h.item_nombre || 'General'
                if (!conteoVariantes[clave]) {
                    conteoVariantes[clave] = { cantidad: 0, recaudacion: 0 }
                }
                conteoVariantes[clave].cantidad += 1
                conteoVariantes[clave].recaudacion += Number(h.precio_cobrado || 0)
            })
        }

        document.getElementById('stat-recaudacion').textContent = `$ ${totalRecaudado.toLocaleString()}`
        document.getElementById('stat-servicios-vendidos').textContent = totalServicios

        let servicioEstrella = "Sin registros"
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
                tbodyEst.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">Aún no hay registros.</td></tr>`
                return
            }

            keys.forEach(k => {
                const info = conteoVariantes[k]
                const tr = document.createElement('tr')
                tr.innerHTML = `
                    <td class="px-3 py-2.5 font-semibold" colspan="2">${k}</td>
                    <td class="px-3 py-2.5 font-bold">${info.cantidad} unidades</td>
                    <td class="px-3 py-2.5 font-black text-emerald-500">$ ${info.recaudacion.toLocaleString()}</td>
                `
                tbodyEst.appendChild(tr)
            })
        }
    } catch (e) { console.error("Error calculando estadísticas:", e) }
}

// 8. BUSCAR EN HISTORIAL (CON ANULACIÓN SEGURA SIN BORRAR)
window.verHistorialPorBusqueda = async function(parametro) {
    const texto = parametro || buscadorCelular.value.trim()
    if (!texto) return alert("Ingrese un nombre o celular.")

    if (parametro) buscadorCelular.value = parametro
    historialTabla.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500">Buscando...</td></tr>`

    try {
        const { data, error } = await supabase.from('historial_clientes').select('*').or(`cliente.ilike.%${texto}%,celular.ilike.%${texto}%`).order('fecha_atencion', { ascending: false })
        if (error) throw error

        historialTabla.innerHTML = ""
        if (!data || data.length === 0) {
            historialTabla.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500">No se encontraron registros para "${texto}".</td></tr>`
            return
        }

        data.forEach(item => {
            const fechaFmt = new Date(item.fecha_atencion).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
            
            let ticketAsociado = null
            if (item.notas && item.notas.includes('[VENTA #')) {
                const matchTicket = item.notas.match(/\[VENTA #([A-Z0-9]+)\]/)
                if (matchTicket) ticketAsociado = matchTicket[1]
            }

            const tr = document.createElement('tr')
            tr.innerHTML = `
                <td class="px-2.5 py-2.5 font-bold">${item.cliente}</td>
                <td class="px-2.5 py-2.5">${item.celular}</td>
                <td class="px-2.5 py-2.5">${(item.notas || '').startsWith('[VENTA') ? '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold mr-1">🛒 VENTA</span>' : ''}${item.item_nombre} <br><span class="text-[10px] text-gray-400">${esc(item.notas)}</span></td>
                <td class="px-2.5 py-2.5 font-medium"><strong class="text-emerald-500">$${item.precio_cobrado}</strong><br><span class="text-[11px] text-gray-400">${fechaFmt}</span></td>
                <td class="px-2.5 py-2.5 text-right">
                    <button onclick="anularRegistroHistorial('${item.id}', '${ticketAsociado || ''}')" class="text-red-500 text-xs font-bold bg-red-50 dark:bg-red-950 px-2 py-1 rounded">Anular</button>
                </td>
            `
            historialTabla.appendChild(tr)
        })
    } catch (e) { console.error(e) }
}
if (btnBuscar) btnBuscar.onclick = () => window.verHistorialPorBusqueda()
if (buscadorCelular) buscadorCelular.onkeypress = (e) => { if (e.key === 'Enter') window.verHistorialPorBusqueda() }
if (btnLimpiar) btnLimpiar.onclick = () => { buscadorCelular.value = ''; historialTabla.innerHTML = `<tr><td colspan="5" class="px-4 py-3 text-center text-gray-500">Ingrese un nombre o número para buscar en el historial.</td></tr>` }

// Función puente para disparar la anulación de la venta master desde el historial de clientas
window.anularVentaMasterDesdeHistorial = async function(ticket) {
    await window.anularVentaMaster(ticket)
    window.verHistorialPorBusqueda(buscadorCelular.value.trim())
}

window.eliminarHistorialDirecto = async function(id) {
    if (confirm("¿Borrar este registro del historial?")) {
        await supabase.from('historial_clientes').delete().eq('id', id)
        window.verHistorialPorBusqueda(buscadorCelular.value.trim())
    }
}

// 9. PANEL DE CLIENTES Y BÚSQUEDA INTELIGENTE
const clienteKey = (n, c) => `${String(n || '').trim().toLowerCase()}_${digits(c)}`

async function cargarClientesDir() {
    const [h, t] = await Promise.all([
        supabase.from('historial_clientes').select('id,cliente,celular,item_nombre,precio_cobrado,fecha_atencion,notas'),
        supabase.from('turnos').select('cliente_nombre,celular')
    ])
    historialCliCache = h.data || []
    const mapa = new Map()
    for (const r of [...historialCliCache, ...(t.data || [])]) {
        const cliNombre = r.cliente || r.cliente_nombre
        if (!cliNombre || cliNombre === 'Consumidor final') continue
        const cliCel = r.celular || ''
        const key = clienteKey(cliNombre, cliCel)
        if (!mapa.has(key)) mapa.set(key, { key, nombre: cliNombre, celular: cliCel })
    }
    clientesDir = [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
}

function seleccionarClienteTurno(c) {
    turnoClienteSeleccionado = c ? { nombre: c.nombre, celular: c.celular, key: c.key, nuevo: false } : null
    const inputBuscar = byId('turno-cliente-buscar')
    if (inputBuscar) {
        inputBuscar.value = ''
        inputBuscar.removeAttribute('required')
    }
    byId('turno-cliente-sug').classList.add('hidden')
    renderFichaClienteTurno()
}

function renderFichaClienteTurno() {
    const box = byId('turno-cliente-ficha')
    const inputNombreReal = byId('cliente-nombre-real')
    const inputCelReal = byId('cliente-celular-real')
    const inputBuscar = byId('turno-cliente-buscar')

    if (!turnoClienteSeleccionado) {
        box.innerHTML = `<p class="text-[11px] text-gray-500">👤 Escribí arriba para buscar o registrar clienta.</p>`
        inputNombreReal.value = ''
        inputCelReal.value = ''
        if (inputBuscar) inputBuscar.setAttribute('required', 'required')
        return
    }

    if (turnoClienteSeleccionado.nuevo) {
        box.innerHTML = `
            <p class="text-xs font-bold text-pink-600 mb-1">➕ Nueva clienta a registrar</p>
            <input id="tc-nombre" placeholder="Nombre y apellido" value="${esc(turnoClienteSeleccionado.nombre)}" class="w-full mb-1 p-1.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-xs">
            <input id="tc-cel" placeholder="Celular / WhatsApp" value="${esc(turnoClienteSeleccionado.celular)}" class="w-full p-1.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-xs">
            <button type="button" onclick="seleccionarClienteTurnoNull()" class="text-[10px] text-gray-500 mt-1 underline">Cancelar</button>`
        
        byId('tc-nombre').oninput = e => { turnoClienteSeleccionado.nombre = e.target.value; inputNombreReal.value = e.target.value }
        byId('tc-cel').oninput = e => { turnoClienteSeleccionado.celular = e.target.value; inputCelReal.value = e.target.value }
        inputNombreReal.value = turnoClienteSeleccionado.nombre
        inputCelReal.value = turnoClienteSeleccionado.celular
        if (inputBuscar) inputBuscar.removeAttribute('required')
        return
    }

    inputNombreReal.value = turnoClienteSeleccionado.nombre
    inputCelReal.value = turnoClienteSeleccionado.celular
    if (inputBuscar) inputBuscar.removeAttribute('required')

    const filas = historialCliCache.filter(r => {
        const rKey = clienteKey(r.cliente, r.celular)
        return rKey === turnoClienteSeleccionado.key || String(r.cliente || '').trim().toLowerCase() === String(turnoClienteSeleccionado.nombre || '').trim().toLowerCase()
    }).sort((a, b) => new Date(b.fecha_atencion) - new Date(a.fecha_atencion))

    const gastado = filas.reduce((s, r) => s + Number(r.precio_cobrado || 0), 0)
    const fmt = d => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' })
    
    box.innerHTML = `
        <div class="flex justify-between items-start">
            <div><p class="font-bold text-xs">${esc(turnoClienteSeleccionado.nombre)}</p><p class="text-[11px] text-green-500 font-bold">📱 ${esc(turnoClienteSeleccionado.celular)}</p></div>
            <button type="button" onclick="seleccionarClienteTurnoNull()" class="text-gray-400 hover:text-red-500 font-bold text-xs" title="Quitar">✕</button>
        </div>
        <div class="grid grid-cols-2 gap-1 text-center mt-1.5 text-[11px]">
            <div class="bg-gray-50 dark:bg-gray-900 rounded p-1"><b class="block text-pink-600">${filas.length}</b>visitas previas</div>
            <div class="bg-gray-50 dark:bg-gray-900 rounded p-1"><b class="block text-emerald-500">${money(gastado)}</b>histórico</div>
        </div>
        ${filas.length ? `<p class="text-[10px] text-gray-500 mt-1">Último servicio: ${esc(filas[0].item_nombre)} (${fmt(filas[0].fecha_atencion)})</p>` : '<p class="text-[10px] text-gray-500 mt-1">Sin visitas registradas aún.</p>'}`
}
window.seleccionarClienteTurnoNull = () => seleccionarClienteTurno(null)

function initTurnoClienteBuscador() {
    const inp = byId('turno-cliente-buscar'), box = byId('turno-cliente-sug')
    if (!inp || !box) return

    if (!turnoClienteSeleccionado) inp.setAttribute('required', 'required')

    inp.addEventListener('input', () => {
        const txt = inp.value.trim(), q = txt.toLowerCase(), qd = digits(txt)
        if (!txt) return box.classList.add('hidden')
        const res = clientesDir.filter(c => c.nombre.toLowerCase().includes(q) || (qd && digits(c.celular).includes(qd))).slice(0, 6)
        box.innerHTML = res.map(c => `<button type="button" data-k="${esc(c.key)}" class="w-full text-left px-3 py-2 text-xs hover:bg-pink-50 dark:hover:bg-gray-700 flex justify-between gap-2"><span class="font-semibold">${esc(c.nombre)}</span><span class="text-[11px] text-green-500">${esc(c.celular)}</span></button>`).join('')
            + `<button type="button" data-nuevo="1" class="w-full text-left px-3 py-2 text-xs text-pink-600 font-semibold hover:bg-pink-50 dark:hover:bg-gray-700 border-t dark:border-gray-700">➕ Clienta nueva: «${esc(txt)}»</button>`
        box.classList.remove('hidden')
    })

    box.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return
        if (b.dataset.nuevo) {
            const txt = inp.value.trim()
            const esNumero = /^\d+$/.test(txt)
            turnoClienteSeleccionado = { 
                nombre: esNumero ? '' : txt, 
                celular: esNumero ? txt : '', 
                nuevo: true 
            }
            inp.value = ''; box.classList.add('hidden'); renderFichaClienteTurno()
        } else seleccionarClienteTurno(clientesDir.find(c => c.key === b.dataset.k))
    })
    document.addEventListener('click', e => { if (!e.target.closest('#turno-cliente-wrap')) box.classList.add('hidden') })
}
initTurnoClienteBuscador()

function seleccionarCliente(c) {
    ventaCliente = c ? { nombre: c.nombre, celular: c.celular, key: c.key, nuevo: false } : null
    byId('venta-cliente-buscar').value = ''
    byId('venta-cliente-sug').classList.add('hidden')
    renderFichaCliente()
}

function renderFichaCliente() {
    const box = byId('venta-cliente-ficha')
    if (!ventaCliente) {
        box.innerHTML = `<p class="text-xs text-gray-500">🧾 Consumidor final.</p>`
        return
    }
    if (ventaCliente.nuevo) {
        box.innerHTML = `
            <p class="text-xs font-bold text-pink-600 mb-1.5">➕ Clienta nueva</p>
            <input id="vc-nombre" placeholder="Nombre" value="${esc(ventaCliente.nombre)}" class="w-full mb-1.5 p-1.5 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-xs">
            <input id="vc-cel" placeholder="Celular" value="${esc(ventaCliente.celular)}" class="w-full p-1.5 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-xs">
            <button type="button" onclick="seleccionarClienteNull()" class="text-[11px] text-gray-500 mt-1 underline">Cancelar</button>`
        byId('vc-nombre').oninput = e => ventaCliente.nombre = e.target.value
        byId('vc-cel').oninput = e => ventaCliente.celular = e.target.value
        return
    }
    const filas = historialCliCache.filter(r => {
        const rKey = clienteKey(r.cliente, r.celular)
        return rKey === ventaCliente.key || String(r.cliente || '').trim().toLowerCase() === String(ventaCliente.nombre || '').trim().toLowerCase()
    }).sort((a, b) => new Date(b.fecha_atencion) - new Date(a.fecha_atencion))

    const gastado = filas.reduce((s, r) => s + Number(r.precio_cobrado || 0), 0)
    const compras = filas.filter(r => (r.notas || '').startsWith('[VENTA')).length
    const fmt = d => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' })
    box.innerHTML = `
        <div class="flex justify-between items-start">
            <div><p class="font-bold text-xs">${esc(ventaCliente.nombre)}</p><p class="text-[11px] text-green-500 font-bold">📱 ${esc(ventaCliente.celular)}</p></div>
            <button type="button" onclick="seleccionarClienteNull()" class="text-gray-400 hover:text-red-500 font-bold text-xs" title="Quitar">✕</button>
        </div>
        <div class="grid grid-cols-3 gap-1 text-center mt-2 text-[11px]">
            <div class="bg-gray-50 dark:bg-gray-900 rounded p-1"><b class="block text-pink-600">${filas.length}</b>visitas</div>
            <div class="bg-gray-50 dark:bg-gray-900 rounded p-1"><b class="block text-pink-600">${compras}</b>compras</div>
            <div class="bg-gray-50 dark:bg-gray-900 rounded p-1"><b class="block text-emerald-500">${money(gastado)}</b>total</div>
        </div>
        ${filas.length ? `<p class="text-[10px] text-gray-500 mt-1.5">Último: ${esc(filas[0].item_nombre)} (${fmt(filas[0].fecha_atencion)})</p>` : '<p class="text-[10px] text-gray-500 mt-1.5">Sin registros.</p>'}`
}
window.seleccionarClienteNull = () => seleccionarCliente(null)

function poblarVentasProductos() {
    const selCat = byId('venta-filtro-categoria')
    if (!selCat || !byId('venta-select-producto')) return
    const previa = selCat.value
    const cats = [...new Set(productosCache.map(i => i.categoria))].sort()
    selCat.innerHTML = `<option value="">Todas las categorías</option>` + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')
    selCat.value = cats.includes(previa) ? previa : ''
    filtrarSelectorVentas()
}

function filtrarSelectorVentas() {
    const sel = byId('venta-select-producto')
    const cat = byId('venta-filtro-categoria').value
    const q = byId('venta-buscar-producto').value.trim().toLowerCase()
    const previo = sel.value
    
    const lista = productosCache.filter(i => 
        (!cat || i.categoria === cat) && 
        (!q || `${i.nombre} ${i.variante || ''} ${i.categoria}`.toLowerCase().includes(q))
    )

    sel.innerHTML = `<option value="">-- Elegí un producto (${lista.length}) --</option>` + lista.map(i => {
        const sin = Number(i.stock) <= 0
        return `<option value="${esc(i.id)}" ${sin ? 'disabled' : ''}>${esc(i.nombre)}${i.variante ? ' - ' + esc(i.variante) : ''} · ${money(i.precio)} · ${sin ? 'SIN STOCK' : 'stock ' + i.stock}</option>`
    }).join('')
    sel.value = lista.some(i => String(i.id) === previo) ? previo : ''
    actualizarInfoProducto()
}

const itemSeleccionado = () => productosCache.find(i => String(i.id) === byId('venta-select-producto').value)
const enCarrito = id => carrito.filter(l => String(l.id) === String(id)).reduce((s, l) => s + l.cantidad, 0)

function actualizarInfoProducto() {
    const item = itemSeleccionado(), info = byId('venta-info-producto')
    if (!item) { info.textContent = ''; return }
    const disp = Number(item.stock) - enCarrito(item.id)
    info.textContent = `Disponible: ${disp} u.${disp <= 5 ? ' ⚠️ stock bajo' : ''}`
    info.className = 'text-[11px] min-h-[1rem] ' + (disp <= 5 ? 'text-amber-500 font-bold' : 'text-gray-500')
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
    const l = carrito[i], item = productosCache.find(x => String(x.id) === String(l.id))
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
            <td class="px-2 py-2 font-semibold">${esc(l.nombre)}<br><span class="text-[11px] text-pink-500">${esc(l.variante)}</span></td>
            <td class="px-2 py-2">${money(l.precio)}</td>
            <td class="px-2 py-2 text-center whitespace-nowrap">
                <button onclick="ventaCant(${i},-1)" class="bg-gray-200 dark:bg-gray-700 w-5 h-5 rounded font-bold">−</button>
                <span class="mx-1.5 font-bold">${l.cantidad}</span>
                <button onclick="ventaCant(${i},1)" class="bg-gray-200 dark:bg-gray-700 w-5 h-5 rounded font-bold">+</button>
            </td>
            <td class="px-2 py-2 text-right font-bold text-emerald-500">${money(l.precio * l.cantidad)}</td>
            <td class="px-2 py-2 text-right"><button onclick="ventaQuitar(${i})" class="text-red-500 font-bold">✕</button></td>
        </tr>`).join('') : `<tr><td colspan="5" class="text-center py-5 text-gray-500">El carrito está vacío.</td></tr>`
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

async function confirmarVenta() {
    if (!carrito.length) return alert('El carrito está vacío.')
    let nombre = 'Consumidor final', celular = '-'
    if (ventaCliente) {
        nombre = (ventaCliente.nombre || '').trim()
        celular = (ventaCliente.celular || '').trim()
        if (!nombre || !celular) return alert('Completá nombre y celular de la clienta.')
    }
    const btn = byId('venta-btn-confirmar')
    btn.disabled = true
    try {
        const { data: frescos, error: eStock } = await supabase.from('productos').select('id,stock').in('id', [...new Set(carrito.map(l => l.id))])
        if (eStock) throw eStock
        const obtenerProd = id => frescos.find(f => String(f.id) === String(id)) || {}

        for (const id of new Set(carrito.map(l => l.id))) {
            const prodCat = obtenerProd(id)
            const stockActual = Number(prodCat.stock ?? 0)
            if (stockActual < enCarrito(id)) {
                const l = carrito.find(x => String(x.id) === String(id))
                alert(`Stock insuficiente de "${l.nombre}". Disponible: ${Math.max(stockActual, 0)}`)
                await cargarDatosBase()
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

        const detalleItemsStr = carrito.map(l => `${l.cantidad}x ${l.nombre} (${l.variante})`).join(', ')

        const { error: eMaster } = await supabase.from('ventas_master').insert([{
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

        const filasHistorial = []
        carrito.forEach(l => {
            for (let i = 0; i < l.cantidad; i++) filasHistorial.push({
                cliente: nombre, celular, item_nombre: `${l.nombre} (${l.variante})`, variante: l.variante,
                precio_cobrado: Math.round(l.precio * factor * 100) / 100, notas: notasHistorial, fecha_atencion: ahora
            })
        })
        const dif = Math.round((total - filasHistorial.reduce((s, f) => s + f.precio_cobrado, 0)) * 100) / 100
        filasHistorial[filasHistorial.length - 1].precio_cobrado = Math.round((filasHistorial[filasHistorial.length - 1].precio_cobrado + dif) * 100) / 100

        const { error: eHist } = await supabase.from('historial_clientes').insert(filasHistorial)
        if (eHist) throw eHist

        for (const id of new Set(carrito.map(l => l.id))) {
            const prodCat = obtenerProd(id)
            const stockActual = Number(prodCat.stock ?? 0)
            const nuevoStock = stockActual - enCarrito(id)
            await supabase.from('productos').update({ stock: nuevoStock }).eq('id', id)
        }

        carrito = []; ventaCliente = null
        ;['venta-descuento', 'venta-recibido', 'venta-nota'].forEach(id => byId(id).value = id === 'venta-descuento' ? 0 : '')
        renderCarrito(); renderFichaCliente()
        await Promise.all([cargarDatosBase(), cargarClientesDir(), cargarVentas(), cargarHistorialGeneral()])
        alert(`¡Venta #${ticket} registrada con éxito por ${money(total)}!`)
    } catch (e) {
        console.error(e)
        alert('Error al registrar la venta: ' + (e.message || e))
    } finally { btn.disabled = false }
}

async function cargarVentas() {
    const { data, error } = await supabase.from('ventas_master').select('*').order('registrado_el', { ascending: false }).limit(100)
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
        return `<div class="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${esAnulada ? 'opacity-50 line-through' : ''}">
            <div>
                <p class="font-semibold text-xs">
                    #${v.ticket} · ${esc(v.cliente)} 
                    ${esAnulada ? '<span class="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold ml-1 no-underline">ANULADA</span>' : ''}
                    <span class="text-[11px] text-gray-400 font-normal ml-1">${fechaFmt}</span>
                </p>
                <p class="text-[11px] text-gray-500">${esc(v.detalle_items)}</p>
                <p class="text-[11px] text-pink-500">${esc(v.metodo_pago)} · Total: ${money(v.total_cobrado)}</p>
            </div>
            <div class="flex items-center gap-3">
                <strong class="${esAnulada ? 'text-gray-400' : 'text-emerald-500'} text-xs">${money(v.total_cobrado)}</strong>
                ${!esAnulada ? `<button onclick="anularVentaMaster('${v.ticket}')" class="text-red-500 text-xs font-bold no-underline">Anular</button>` : ''}
            </div>
        </div>`
    }).join('') : `<p class="text-center text-gray-500 py-4">Todavía no hay ventas registradas.</p>`
}

window.anularVentaMaster = async function(ticket) {
    const v = ventasMasterCache.find(x => x.ticket === ticket)
    if (!v || v.estado === 'ANULADA') return

    const passwordIngresado = prompt(`🔒 SEGURIDAD: Ingrese la contraseña de autorización para anular la venta #${ticket}:`)
    if (passwordIngresado === null) return
    if (passwordIngresado !== PIN_SEGURIDAD_ANULACION) {
        return alert("❌ Contraseña incorrecta. Operación cancelada por seguridad.")
    }

    if (!confirm(`✔ Contraseña aceptada. ¿Desea anular definitivamente la venta #${ticket} por ${money(v.total_cobrado)}? Esto devolverá el stock al catálogo.`)) return

    try {
        const { error: eUpd } = await supabase.from('ventas_master').update({ estado: 'ANULADA' }).eq('ticket', ticket)
        if (eUpd) throw eUpd

        await supabase.from('historial_clientes').delete().ilike('notas', `[VENTA #${ticket}]%`)

        if (v.detalle_items) {
            const itemsVenta = v.detalle_items.split(',').map(i => i.trim())
            for (const itemStr of itemsVenta) {
                const match = itemStr.match(/^(\d+)x\s+(.+)$/)
                if (match) {
                    const cantDevolver = parseInt(match[1])
                    const nombreCompleto = match[2]
                    const productoCat = productosCache.find(c => nombreCompleto.toLowerCase().includes(c.nombre.toLowerCase()))
                    if (productoCat) {
                        const nuevoStock = Number(productoCat.stock || 0) + cantDevolver
                        await supabase.from('productos').update({ stock: nuevoStock }).eq('id', productoCat.id)
                    }
                }
            }
        }

        await Promise.all([cargarDatosBase(), cargarClientesDir(), cargarVentas(), cargarHistorialGeneral()])
        alert(`Venta #${ticket} anulada correctamente y stock devuelto.`)
        if (!byId('modal-buscador-master').classList.contains('hidden')) {
            filtrarBuscadorMaster()
        }
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
        box.innerHTML = res.map(c => `<button type="button" data-k="${esc(c.key)}" class="w-full text-left px-3 py-2 text-xs hover:bg-pink-50 dark:hover:bg-gray-700 flex justify-between gap-2"><span class="font-semibold">${esc(c.nombre)}</span><span class="text-[11px] text-green-500">${esc(c.celular)}</span></button>`).join('')
            + `<button type="button" data-nuevo="1" class="w-full text-left px-3 py-2 text-xs text-pink-600 font-semibold hover:bg-pink-50 dark:hover:bg-gray-700 border-t dark:border-gray-700">➕ Clienta nueva: «${esc(txt)}»</button>`
        box.classList.remove('hidden')
    })
    box.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return
        if (b.dataset.nuevo) {
            const txt = inp.value.trim()
            const esNumero = /^\d+$/.test(txt)
            ventaCliente = { 
                nombre: esNumero ? '' : txt, 
                celular: esNumero ? txt : '', 
                nuevo: true 
            }
            inp.value = ''; box.classList.add('hidden'); renderFichaCliente()
        } else seleccionarCliente(clientesDir.find(c => c.key === b.dataset.k))
    })
    document.addEventListener('click', e => { if (!e.target.closest('#venta-cliente-wrap')) box.classList.add('hidden') })

    renderFichaCliente(); renderCarrito()
}
initVentas()

async function cargarHistorialGeneral() {
    try {
        const { data, error } = await supabase.from('historial_clientes').select('*').order('fecha_atencion', { ascending: false })
        if (error) throw error
        historialGlobalCache = data || []
    } catch (e) {
        console.error("Error cargando historial general:", e)
    }
}

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
    const periodoSel = byId('master-filtro-periodo').value
    const tbody = byId('tabla-buscador-master')
    if (!tbody) return

    const ahora = new Date()
    const filtrados = ventasMasterCache.filter(v => {
        if (estadoSel !== 'todos' && v.estado !== estadoSel) return false

        const fRegistro = new Date(v.registrado_el)
        if (periodoSel === 'dia') {
            if (fRegistro.toDateString() !== ahora.toDateString()) return false
        } else if (periodoSel === 'semana') {
            const ini = new Date(ahora); ini.setDate(ahora.getDate() - 7)
            if (fRegistro < ini) return false
        } else if (periodoSel === 'mes') {
            if (fRegistro.getMonth() !== ahora.getMonth() || fRegistro.getFullYear() !== ahora.getFullYear()) return false
        } else if (periodoSel === 'anio') {
            if (fRegistro.getFullYear() !== ahora.getFullYear()) return false
        }

        if (texto) {
            const combo = `${v.ticket} ${v.cliente} ${v.celular} ${v.detalle_items} ${v.metodo_pago} ${v.notas}`.toLowerCase()
            if (!combo.includes(texto)) return false
        }
        return true
    })

    const totalFiltrado = filtrados.filter(v => v.estado === 'COMPLETADA').reduce((s, v) => s + Number(v.total_cobrado || 0), 0)
    byId('master-resumen-label').textContent = `Total registros (${filtrados.length}):`
    byId('master-resumen-total').textContent = money(totalFiltrado)

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-500">No se encontraron registros para este período.</td></tr>`
        return
    }

    tbody.innerHTML = filtrados.map(v => {
        const esAnulada = v.estado === 'ANULADA'
        const fechaFmt = new Date(v.registrado_el).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
        return `
            <tr class="${esAnulada ? 'bg-red-50/50 dark:bg-red-950/20 text-gray-400' : ''}">
                <td class="px-3 py-2.5 text-xs">
                    <strong class="text-pink-600">#${v.ticket}</strong><br>
                    <span class="text-gray-400 font-normal">${fechaFmt}</span>
                </td>
                <td class="px-3 py-2.5 font-bold text-xs">
                    ${esc(v.cliente)}<br>
                    <span class="text-[11px] text-green-500 font-normal">📱 ${esc(v.celular)}</span>
                </td>
                <td class="px-3 py-2.5 text-xs">
                    ${esc(v.detalle_items)}
                    ${v.notas && v.notas !== 'Sin notas' ? `<br><span class="text-[10px] text-gray-400">Nota: ${esc(v.notas)}</span>` : ''}
                </td>
                <td class="px-3 py-2.5 text-xs">
                    <span class="font-semibold">${esc(v.metodo_pago)}</span><br>
                    ${esAnulada ? '<span class="bg-red-100 text-red-700 text-[10px] px-1 py-0.5 rounded font-bold">ANULADA</span>' : '<span class="bg-emerald-100 text-emerald-700 text-[10px] px-1 py-0.5 rounded font-bold">COMPLETADA</span>'}
                </td>
                <td class="px-3 py-2.5 text-right font-black text-xs ${esAnulada ? 'line-through text-gray-400' : 'text-emerald-500'}">
                    ${money(v.total_cobrado)}<br>
                    ${!esAnulada ? `<button onclick="anularVentaMaster('${v.ticket}')" class="text-red-500 text-[11px] font-bold no-underline mt-1">Anular</button>` : ''}
                </td>
            </tr>
        `
    }).join('')
}

window.imprimirReporteMaster = function() {
    window.print()
}
// NUEVA FUNCIÓN: Anula de forma segura sin borrar físicamente del sistema
window.anularRegistroHistorial = async function(idHistorial, ticket) {
    const passwordIngresado = prompt(`🔒 SEGURIDAD: Ingrese la contraseña de autorización para anular este registro:`)
    if (passwordIngresado === null) return
    if (passwordIngresado !== PIN_SEGURIDAD_ANULACION) {
        return alert("❌ Contraseña incorrecta. Operación cancelada por seguridad.")
    }

    if (!confirm("✔ Contraseña aceptada. ¿Desea anular este registro? Quedará marcado como anulado en el sistema y no se eliminará.")) return

    try {
        if (ticket) {
            await supabase.from('ventas_master').update({ estado: 'ANULADA' }).eq('ticket', ticket)
        }

        const registroActual = historialCliCache.find(r => r.id == idHistorial) || {}
        const notaAnulada = `[ANULADO] ${registroActual.notas || 'Sin notas previa'}`
        
        const { error } = await supabase.from('historial_clientes').update({ 
            precio_cobrado: 0, 
            notas: notaAnulada 
        }).eq('id', idHistorial)

        if (error) throw error

        alert("Registro anulado correctamente. Queda trazado en el sistema con monto $0 y marcado como anulado.")
        window.verHistorialPorBusqueda(buscadorCelular.value.trim())
        await cargarVentas()
    } catch (e) {
        console.error(e)
        alert("Hubo un error al anular el registro.")
    }
}// ==========================================
// ASISTENTE INTELIGENTE CON API DE GEMINI Y SUPABASE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('chat-toggle-btn')
    const closeBtn = document.getElementById('chat-close-btn')
    const chatWindow = document.getElementById('chat-window')
    const enviarBtn = document.getElementById('chat-enviar-btn')
    const inputMsg = document.getElementById('chat-input')
    const contenedorMsgs = document.getElementById('chat-mensajes')

    if (!toggleBtn || !chatWindow) return

    toggleBtn.onclick = () => chatWindow.classList.toggle('hidden')
    closeBtn.onclick = () => chatWindow.classList.add('hidden')

    const enviarMensaje = async () => {
        const texto = inputMsg.value.trim()
        if (!texto) return

        agregarMensajeUI(texto, 'usuario')
        inputMsg.value = ''
        contenedorMsgs.scrollTop = contenedorMsgs.scrollHeight

        const idCarga = agregarMensajeUI('Analizando con IA...', 'ia', true)

        try {
            // 1. Recopilar datos frescos de Supabase antes de consultar a Gemini
            const contextoNegocio = await obtenerContextoSupabaseParaIA()

            // 2. Enviar la pregunta y el contexto fresco a tu endpoint / API de Gemini
            const respuestaIA = await consultarGeminiConContexto(texto, contextoNegocio)
            
            reemplazarMensajeCarga(idCarga, respuestaIA)
        } catch (err) {
            console.error(err)
            reemplazarMensajeCarga(idCarga, 'Disculpa, tuve un problema al procesar la consulta con la IA.')
        }
    }

    enviarBtn.onclick = enviarMensaje
    inputMsg.onkeypress = (e) => { if (e.key === 'Enter') enviarMensaje() }

    function agregarMensajeUI(msg, tipo) {
        const div = document.createElement('div')
        const id = 'msg-' + Date.now()
        div.id = id
        div.className = tipo === 'usuario' 
            ? 'ml-auto bg-pink-600 text-white p-2.5 rounded-xl rounded-tr-none max-w-[85%]' 
            : 'bg-gray-100 dark:bg-gray-800 p-2.5 rounded-xl rounded-tl-none max-w-[85%] text-gray-800 dark:text-gray-200'
        div.textContent = msg
        contenedorMsgs.appendChild(div)
        contenedorMsgs.scrollTop = contenedorMsgs.scrollHeight
        return id
    }

    function reemplazarMensajeCarga(id, textoFinal) {
        const el = document.getElementById(id)
        if (el) el.textContent = textoFinal
        contenedorMsgs.scrollTop = contenedorMsgs.scrollHeight
    }

    // 📊 FUNCIÓN QUE EMPAQUETA TODOS LOS DATOS DE SUPABASE EN JSON/TEXTO
    async function obtenerContextoSupabaseParaIA() {
        const [resVentas, resTurnos, resHistorial, resProd, resServ] = await Promise.all([
            supabase.from('ventas_master').select('*'),
            supabase.from('turnos').select('*'),
            supabase.from('historial_clientes').select('*'),
            supabase.from('productos').select('*'),
            supabase.from('servicios').select('*')
        ])

        return {
            ventas: resVentas.data || [],
            turnos: resTurnos.data || [],
            historial_clientas: resHistorial.data || [],
            productos: resProd.data || [],
            servicios: resServ.data || [],
            fecha_actual: new Date().toISOString()
        }
    }

    // 🤖 FUNCIÓN QUE LLAMA A TU API / BACKEND CON GEMINI
    async function consultarGeminiConContexto(preguntaUsuario, contexto) {
        // Aquí realizas el fetch a tu función serverless en Vercel (por ejemplo, /api/chat-gemini)
        // que es la encargada de invocar la SDK de Google Gemini manteniendo oculta tu API Key.
        const response = await fetch('/api/chat-gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pregunta: preguntaUsuario,
                contexto_datos: contexto
            })
        })

        if (!response.ok) throw new Error('Error en la comunicación con el servidor de IA')
        
        const data = await response.json()
        return data.respuesta || 'No se obtuvo respuesta de la IA.'
    }
})