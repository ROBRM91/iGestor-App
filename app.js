// app.js

// Definición de datos globales para la aplicación
let data = {
    tipoMovimientos: [],
    tipoCostos: [],
    categorias: [],
    subCategorias: [],
    conceptos: [],
    transacciones: [],
    pagos: [], // Almacena los pagos asociados a las transacciones
};

// Objeto para manejar el gráfico de gastos
let gastosPorCategoriaChart;

// Función para cargar los datos desde localStorage
function loadData() {
    const storedData = localStorage.getItem('budgetAppData');
    if (storedData) {
        data = JSON.parse(storedData);
    } else {
        // Inicializar datos base si no hay nada en localStorage
        data.tipoMovimientos = [
            { ID_TipoMovimiento: 'TM-001', TipoMovimiento: 'Ingreso' },
            { ID_TipoMovimiento: 'TM-002', TipoMovimiento: 'Gasto' }
        ];
        data.tipoCostos = [
            { ID_TipoCosto: 'TC-001', TipoCosto: 'Fijo', ID_TipoMovimiento_FK: 'TM-002' },
            { ID_TipoCosto: 'TC-002', TipoCosto: 'Variable', ID_TipoMovimiento_FK: 'TM-002' },
            { ID_TipoCosto: 'TC-003', TipoCosto: 'Recurrente', ID_TipoMovimiento_FK: 'TM-001' },
            { ID_TipoCosto: 'TC-004', TipoCosto: 'Único', ID_TipoMovimiento_FK: 'TM-001' }
        ];
        // Más datos de ejemplo para Categorías, SubCategorías, Conceptos si es necesario
    }
    console.log("Datos cargados:", data);
}

// Función para guardar los datos en localStorage
function saveData() {
    localStorage.setItem('budgetAppData', JSON.stringify(data));
    console.log("Datos guardados:", data);
}

// Función para generar IDs únicos
function generateId(prefix) {
    return prefix + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// --- LÓGICA DE NEGOCIO ---

// Calcula FechaCorte y FechaLimite
function calcularFechasCorteLimite(diaCorte, diaLimite, periodoMes, periodoAnio) {
    const mesIdx = parseInt(periodoMes) - 1; // Mes en base 0
    let fechaCorte = new Date(periodoAnio, mesIdx, diaCorte);
    let fechaLimite = new Date(periodoAnio, mesIdx, diaLimite);

    // Regla: Si DiaCorte > DiaLimite, el Mes de FechaLimite se aumenta en 1.
    if (diaCorte > diaLimite) {
        fechaLimite.setMonth(fechaLimite.getMonth() + 1);
    }

    return {
        fechaCorte: fechaCorte.toISOString().split('T')[0],
        fechaLimite: fechaLimite.toISOString().split('T')[0]
    };
}

// Calcula NoPlazos
function calcularNoPlazos(fechaActualStr, fechaLimiteStr) {
    const fechaActual = new Date(fechaActualStr);
    const fechaLimite = new Date(fechaLimiteStr);
    let noPlazos = 0;

    // Clonar la fecha actual para iterar
    let currentDate = new Date(fechaActual);
    currentDate.setDate(1); // Empezar siempre desde el primer día del mes actual

    while (currentDate <= fechaLimite) {
        // Verificar el día 15
        const day15 = new Date(currentDate.getFullYear(), currentDate.getMonth(), 15);
        if (day15 > fechaActual && day15 <= fechaLimite) {
            noPlazos++;
        }

        // Verificar fin de mes
        const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        if (lastDayOfMonth > fechaActual && lastDayOfMonth <= fechaLimite) {
            noPlazos++;
        }
        // Avanzar al siguiente mes
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    return noPlazos;
}


// Determina la Prioridad
function determinarPrioridad(noPlazos) {
    if (noPlazos <= 1) return 'Alta';
    if (noPlazos === 2) return 'Media';
    return 'Baja';
}

// Calcula el Estatus de una transacción
function calcularEstatusTransaccion(transaccion) {
    const pagosRelacionados = data.pagos.filter(p => p.ID_Concepto_FK === transaccion.ID_Concepto_FK);
    const totalPagado = pagosRelacionados.reduce((sum, p) => sum + parseFloat(p.MontoPago), 0);
    return parseFloat(transaccion.Monto) === totalPagado ? 'Pagado' : 'Pendiente';
}

// Actualiza los cálculos en todas las transacciones
function updateTransactionCalculations() {
    const today = new Date().toISOString().split('T')[0]; // Fecha actual para NoPlazos

    data.transacciones.forEach(transaccion => {
        if (transaccion.ID_TipoMovimiento_FK === 'TM-002') { // Solo para Gastos
            const { fechaCorte, fechaLimite } = calcularFechasCorteLimite(
                parseInt(transaccion.DiaCorte),
                parseInt(transaccion.DiaLimite),
                parseInt(transaccion.Periodo.split('-')[1]), // Mes
                parseInt(transaccion.Periodo.split('-')[0])  // Año
            );
            transaccion.FechaCorte = fechaCorte;
            transaccion.FechaLimite = fechaLimite;
            transaccion.NoPlazos = calcularNoPlazos(today, fechaLimite);
            transaccion.Prioridad = determinarPrioridad(transaccion.NoPlazos);
        } else { // Para Ingresos, borrar o dejar vacíos
            transaccion.FechaCorte = '';
            transaccion.FechaLimite = '';
            transaccion.NoPlazos = '';
            transaccion.Prioridad = '';
        }
        transaccion.Estatus = calcularEstatusTransaccion(transaccion);
    });
    saveData();
}

// --- RENDERING DE VISTAS ---

// Renderiza la vista del Dashboard
function renderDashboard() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = `
        <h1 class="mb-4 text-center text-primary-emphasis">Panel de Resumen Mensual</h1>

        <!-- Resumen del Mes -->
        <div class="row g-4 mb-5">
            <div class="col-md-6 col-lg-3">
                <div class="card shadow-sm h-100 border-success border-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Total de Ingresos <i class="bi bi-arrow-up-circle-fill float-end"></i></h5>
                        <p class="card-text fs-3" id="totalIngresos">$0.00</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3">
                <div class="card shadow-sm h-100 border-danger border-3">
                    <div class="card-body">
                        <h5 class="card-title text-danger">Total de Gastos <i class="bi bi-arrow-down-circle-fill float-end"></i></h5>
                        <p class="card-text fs-3" id="totalGastos">$0.00</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3">
                <div class="card shadow-sm h-100 border-primary border-3">
                    <div class="card-body">
                        <h5 class="card-title text-primary">Saldo Disponible <i class="bi bi-cash-coin float-end"></i></h5>
                        <p class="card-text fs-3" id="saldoDisponible">$0.00</p>
                        </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3">
                <div class="card shadow-sm h-100 border-info border-3">
                    <div class="card-body">
                        <h5 class="card-title text-info">Pagos Realizados <i class="bi bi-check-circle-fill float-end"></i></h5>
                        <p class="card-text fs-3" id="pagosRealizados">$0.00</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3">
                <div class="card shadow-sm h-100 border-warning border-3">
                    <div class="card-body">
                        <h5 class="card-title text-warning">Pagos Pendientes <i class="bi bi-exclamation-circle-fill float-end"></i></h5>
                        <p class="card-text fs-3" id="pagosPendientes">$0.00</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Próximos Vencimientos -->
        <div class="card shadow-sm mb-5">
            <div class="card-header bg-primary text-white">
                <h4 class="mb-0"><i class="bi bi-calendar-check me-2"></i>Próximos Vencimientos</h4>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-hover table-striped">
                        <thead>
                            <tr>
                                <th>Concepto</th>
                                <th>Monto</th>
                                <th>Fecha Límite</th>
                                <th>Estatus</th>
                                <th>Prioridad</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="proximosVencimientosTableBody">
                            <!-- Filas se cargarán con JS -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Distribución de Gastos -->
        <div class="card shadow-sm mb-5">
            <div class="card-header bg-success text-white">
                <h4 class="mb-0"><i class="bi bi-pie-chart-fill me-2"></i>Distribución de Gastos por Categoría</h4>
            </div>
            <div class="card-body">
                <div class="chart-container" style="position: relative; height:40vh; width:80vw; margin: auto;">
                    <canvas id="gastosPorCategoriaChart"></canvas>
                </div>
            </div>
        </div>
    `;
    updateDashboardSummary();
    renderProximosVencimientos();
    renderGastosPorCategoriaChart();
}

// Actualiza los resúmenes del Dashboard
function updateDashboardSummary() {
    const currentMonth = new Date().getMonth() + 1; // Mes actual (1-12)
    const currentYear = new Date().getFullYear();

    const ingresosMes = data.transacciones
        .filter(t => t.ID_TipoMovimiento_FK === 'TM-001' && parseInt(t.Periodo.split('-')[1]) === currentMonth && parseInt(t.Periodo.split('-')[0]) === currentYear)
        .reduce((sum, t) => sum + parseFloat(t.Monto), 0);

    const gastosMes = data.transacciones
        .filter(t => t.ID_TipoMovimiento_FK === 'TM-002' && parseInt(t.Periodo.split('-')[1]) === currentMonth && parseInt(t.Periodo.split('-')[0]) === currentYear)
        .reduce((sum, t) => sum + parseFloat(t.Monto), 0);

    const saldoDisponible = ingresosMes - gastosMes;

    const pagosRealizados = data.transacciones
        .filter(t => t.ID_TipoMovimiento_FK === 'TM-002' && parseInt(t.Periodo.split('-')[1]) === currentMonth && parseInt(t.Periodo.split('-')[0]) === currentYear && t.Estatus === 'Pagado')
        .reduce((sum, t) => sum + parseFloat(t.Monto), 0);

    const pagosPendientes = data.transacciones
        .filter(t => t.ID_TipoMovimiento_FK === 'TM-002' && parseInt(t.Periodo.split('-')[1]) === currentMonth && parseInt(t.Periodo.split('-')[0]) === currentYear && t.Estatus === 'Pendiente')
        .reduce((sum, t) => sum + parseFloat(t.Monto), 0);


    document.getElementById('totalIngresos').textContent = `$${ingresosMes.toFixed(2)}`;
    document.getElementById('totalGastos').textContent = `$${gastosMes.toFixed(2)}`;
    document.getElementById('saldoDisponible').textContent = `$${saldoDisponible.toFixed(2)}`;
    document.getElementById('pagosRealizados').textContent = `$${pagosRealizados.toFixed(2)}`;
    document.getElementById('pagosPendientes').textContent = `$${pagosPendientes.toFixed(2)}`;
}

// Renderiza la tabla de Próximos Vencimientos
function renderProximosVencimientos() {
    const tableBody = document.getElementById('proximosVencimientosTableBody');
    tableBody.innerHTML = ''; // Limpiar tabla

    const today = new Date();
    const vencimientos = data.transacciones
        .filter(t => t.ID_TipoMovimiento_FK === 'TM-002' && t.Estatus === 'Pendiente' && t.FechaLimite) // Solo gastos pendientes con fecha límite
        .sort((a, b) => new Date(a.FechaLimite) - new Date(b.FechaLimite)); // Ordenar por fecha límite

    if (vencimientos.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No hay próximos vencimientos.</td></tr>`;
        return;
    }

    const filteredVencimientos = vencimientos.filter(t => t.Prioridad === 'Alta' || new Date(t.FechaLimite) > today) // Vencimientos Alta prioridad o futuros
        .slice(0, 10); // Mostrar solo los 10 primeros más próximos

    filteredVencimientos.forEach(transaccion => {
        const concepto = data.conceptos.find(c => c.ID_Concepto === transaccion.ID_Concepto_FK)?.Concepto || 'N/A';
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${concepto}</td>
            <td>$${parseFloat(transaccion.Monto).toFixed(2)}</td>
            <td>${new Date(transaccion.FechaLimite).toLocaleDateString()}</td>
            <td><span class="badge ${transaccion.Estatus === 'Pagado' ? 'bg-success' : 'bg-warning'}">${transaccion.Estatus}</span></td>
            <td><span class="badge ${transaccion.Prioridad === 'Alta' ? 'bg-danger' : transaccion.Prioridad === 'Media' ? 'bg-warning' : 'bg-info'}">${transaccion.Prioridad}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openPaymentModal('${transaccion.ID_Concepto_FK}', ${transaccion.Monto})">
                    <i class="bi bi-cash-stack me-1"></i>Pagar
                </button>
            </td>
        `;
    });
}

// Renderiza el gráfico de Distribución de Gastos
function renderGastosPorCategoriaChart() {
    if (gastosPorCategoriaChart) {
        gastosPorCategoriaChart.destroy(); // Destruir instancia previa del gráfico
    }

    const gastosPorCategoria = {};
    data.transacciones
        .filter(t => t.ID_TipoMovimiento_FK === 'TM-002') // Solo gastos
        .forEach(transaccion => {
            const concepto = data.conceptos.find(c => c.ID_Concepto === transaccion.ID_Concepto_FK);
            if (concepto) {
                const categoria = data.categorias.find(cat => cat.ID_Categoria === concepto.ID_Categoria_FK);
                if (categoria) {
                    const categoriaNombre = categoria.Categoría;
                    gastosPorCategoria[categoriaNombre] = (gastosPorCategoria[categoriaNombre] || 0) + parseFloat(transaccion.Monto);
                }
            }
        });

    const labels = Object.keys(gastosPorCategoria);
    const chartData = Object.values(gastosPorCategoria);
    const backgroundColors = labels.map(() => `hsl(${Math.random() * 360}, 70%, 50%)`); // Colores aleatorios

    const ctx = document.getElementById('gastosPorCategoriaChart');
    if (ctx) { // Asegurarse de que el canvas existe en el DOM
        gastosPorCategoriaChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: chartData,
                    backgroundColor: backgroundColors,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(tooltipItem) {
                                return tooltipItem.label + ': $' + tooltipItem.raw.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }
}


// Renderiza la vista de Transacciones
function renderTransactionsView() {
    console.log("Entering renderTransactionsView()"); // Log de depuración
    const contentDiv = document.getElementById('content');
    if (!contentDiv) {
        console.error("Error: contentDiv not found in renderTransactionsView()");
        return;
    }
    contentDiv.innerHTML = `
        <h1 class="mb-4 text-center text-primary-emphasis">Gestión de Transacciones</h1>

        <!-- Formulario Superior para Transacciones -->
        <div class="card shadow-sm mb-5">
            <div class="card-header bg-primary text-white">
                <h4 class="mb-0"><i class="bi bi-journal-plus me-2"></i>Nueva Transacción</h4>
            </div>
            <div class="card-body">
                <form id="transactionForm" class="row g-3 needs-validation" novalidate>
                    <input type="hidden" id="transactionId" value="">
                    <div class="col-md-3">
                        <label for="fechaTransaccion" class="form-label">Fecha Transacción</label>
                        <input type="date" class="form-control rounded-pill" id="fechaTransaccion" required>
                        <div class="invalid-feedback">
                            Por favor, ingrese la fecha de la transacción.
                        </div>
                    </div>
                    <div class="col-md-3">
                        <label for="idTipoMovimiento" class="form-label">Tipo Movimiento</label>
                        <select class="form-select rounded-pill" id="idTipoMovimiento" required>
                            <option value="">Seleccione...</option>
                        </select>
                        <div class="invalid-feedback">
                            Por favor, seleccione un tipo de movimiento.
                        </div>
                    </div>
                    <div class="col-md-3">
                        <label for="idTipoCosto" class="form-label">Tipo Costo</label>
                        <select class="form-select rounded-pill" id="idTipoCosto" required>
                            <option value="">Seleccione...</option>
                        </select>
                        <div class="invalid-feedback">
                            Por favor, seleccione un tipo de costo.
                        </div>
                    </div>
                    <div class="col-md-3">
                        <label for="idConcepto" class="form-label">Concepto</label>
                        <select class="form-select rounded-pill" id="idConcepto" required>
                            <option value="">Seleccione...</option>
                        </select>
                        <div class="invalid-feedback">
                            Por favor, seleccione un concepto.
                        </div>
                    </div>

                    <div class="col-md-3 d-none" id="fechaIngresoGroup">
                        <label for="fechaIngreso" class="form-label">Fecha Ingreso</label>
                        <input type="date" class="form-control rounded-pill" id="fechaIngreso">
                    </div>
                    <div class="col-md-3">
                        <label for="monto" class="form-label">Monto</label>
                        <input type="number" step="0.01" class="form-control rounded-pill" id="monto" required>
                        <div class="invalid-feedback">
                            Por favor, ingrese el monto.
                        </div>
                    </div>
                    <div class="col-md-3">
                        <label for="periodoMesAnio" class="form-label">Periodo (Mes/Año)</label>
                        <input type="month" class="form-control rounded-pill" id="periodoMesAnio" required>
                        <div class="invalid-feedback">
                            Por favor, ingrese el periodo.
                        </div>
                    </div>
                    <div class="col-md-3 d-none" id="diaCorteGroup">
                        <label for="diaCorte" class="form-label">Día de Corte</label>
                        <input type="number" min="1" max="31" class="form-control rounded-pill" id="diaCorte">
                    </div>
                    <div class="col-md-3 d-none" id="diaLimiteGroup">
                        <label for="diaLimite" class="form-label">Día Límite</label>
                        <input type="number" min="1" max="31" class="form-control rounded-pill" id="diaLimite">
                    </div>
                    <div class="col-md-6">
                        <label for="notas" class="form-label">Notas</label>
                        <textarea class="form-control rounded-lg" id="notas" rows="2"></textarea>
                    </div>

                    <div class="col-12 mt-4 text-end">
                        <button class="btn btn-primary rounded-pill me-2" type="submit"><i class="bi bi-save me-1"></i>Guardar Transacción</button>
                        <button class="btn btn-secondary rounded-pill" type="reset" onclick="resetTransactionForm()"><i class="bi bi-arrow-clockwise me-1"></i>Limpiar</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Botón para abrir el Modal de Pagos -->
        <div class="mb-4 text-end">
            <button class="btn btn-success rounded-pill" data-bs-toggle="modal" data-bs-target="#paymentModal"><i class="bi bi-cash me-1"></i>Registrar Pago</button>
        </div>

        <!-- Tabla Inferior de Transacciones -->
        <div class="card shadow-sm mb-5">
            <div class="card-header bg-secondary text-white">
                <h4 class="mb-0"><i class="bi bi-list-check me-2"></i>Lista de Transacciones</h4>
            </div>
            <div class="card-body">
                <!-- Filtros Avanzados -->
                <div class="row g-3 mb-4 filter-row">
                    <div class="col-md-3">
                        <input type="text" class="form-control rounded-pill" id="filterConcepto" placeholder="Filtrar por Concepto">
                    </div>
                    <div class="col-md-2">
                        <select class="form-select rounded-pill" id="filterTipoMovimiento">
                            <option value="">Tipo Movimiento</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <select class="form-select rounded-pill" id="filterTipoCosto">
                            <option value="">Tipo Costo</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <select class="form-select rounded-pill" id="filterEstatus">
                            <option value="">Estatus</option>
                            <option value="Pagado">Pagado</option>
                            <option value="Pendiente">Pendiente</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <select class="form-select rounded-pill" id="filterPrioridad">
                            <option value="">Prioridad</option>
                            <option value="Alta">Alta</option>
                            <option value="Media">Media</option>
                            <option value="Baja">Baja</option>
                        </select>
                    </div>
                    <div class="col-md-1">
                        <button class="btn btn-outline-primary rounded-pill" onclick="renderTransactionsTable()"><i class="bi bi-funnel me-1"></i>Filtrar</button>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-hover table-striped">
                        <thead>
                            <tr>
                                <th>ID Trans.</th>
                                <th>Fecha</th>
                                <th>Movimiento</th>
                                <th>Costo</th>
                                <th>Concepto</th>
                                <th>Monto</th>
                                <th>Periodo</th>
                                <th>Corte</th>
                                <th>Límite</th>
                                <th>Estatus</th>
                                <th>Prioridad</th>
                                <th>Plazos</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="transactionsTableBody">
                            <!-- Filas se cargarán con JS -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Modal de Pagos -->
        <div class="modal fade" id="paymentModal" tabindex="-1" aria-labelledby="paymentModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title" id="paymentModalLabel">Registrar Nuevo Pago</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="paymentForm" class="needs-validation" novalidate>
                            <input type="hidden" id="paymentId" value="">
                            <div class="mb-3">
                                <label for="paymentConcepto" class="form-label">Concepto</label>
                                <select class="form-select rounded-pill" id="paymentConcepto" required>
                                    <option value="">Seleccione un Concepto</option>
                                    <!-- Opciones se llenarán dinámicamente -->
                                </select>
                                <div class="invalid-feedback">
                                    Por favor, seleccione un concepto.
                                </div>
                            </div>
                            <div class="mb-3">
                                <label for="paymentMonto" class="form-label">Monto del Pago</label>
                                <input type="number" step="0.01" class="form-control rounded-pill" id="paymentMonto" required>
                                <div class="invalid-feedback">
                                    Por favor, ingrese el monto del pago.
                                </div>
                            </div>
                            <div class="text-end">
                                <button type="submit" class="btn btn-success rounded-pill"><i class="bi bi-check-lg me-1"></i>Guardar Pago</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
    console.log("Transactions view rendered."); // Log de depuración

    // Inicializar selectores de formulario de transacciones
    populateSelect('idTipoMovimiento', data.tipoMovimientos, 'ID_TipoMovimiento', 'TipoMovimiento');
    populateSelect('idTipoCosto', [], 'ID_TipoCosto', 'TipoCosto'); // Se llenará en cascada
    populateSelect('idConcepto', [], 'ID_Concepto', 'Concepto'); // Se llenará en cascada

    // Event listeners para el formulario de transacciones
    document.getElementById('idTipoMovimiento').addEventListener('change', filterTipoCostoOptions);
    document.getElementById('idTipoCosto').addEventListener('change', filterConceptoOptions);
    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);
    document.getElementById('idTipoMovimiento').addEventListener('change', toggleTransactionFields);

    // Inicializar selectores de filtros
    populateSelect('filterTipoMovimiento', data.tipoMovimientos, 'ID_TipoMovimiento', 'TipoMovimiento');
    populateSelect('filterTipoCosto', data.tipoCostos, 'ID_TipoCosto', 'TipoCosto');

    // Inicializar selectores del modal de pagos
    populateSelect('paymentConcepto', data.conceptos.filter(c => {
        const transaction = data.transacciones.find(t => t.ID_Concepto_FK === c.ID_Concepto && t.ID_TipoMovimiento_FK === 'TM-002' && t.Estatus === 'Pendiente');
        return transaction !== undefined;
    }), 'ID_Concepto', 'Concepto');

    document.getElementById('paymentForm').addEventListener('submit', handlePaymentSubmit);

    // Renderizar la tabla de transacciones
    renderTransactionsTable();
    filterTipoCostoOptions(); // Llamar para inicializar las opciones de Tipo Costo
}

// Alterna los campos FechaIngreso, DiaCorte y DiaLimite según el tipo de movimiento
function toggleTransactionFields() {
    const tipoMovimiento = document.getElementById('idTipoMovimiento').value;
    const fechaIngresoGroup = document.getElementById('fechaIngresoGroup');
    const diaCorteGroup = document.getElementById('diaCorteGroup');
    const diaLimiteGroup = document.getElementById('diaLimiteGroup');

    if (tipoMovimiento === 'TM-001') { // Ingreso
        fechaIngresoGroup.classList.remove('d-none');
        diaCorteGroup.classList.add('d-none');
        diaLimiteGroup.classList.add('d-none');
        document.getElementById('diaCorte').removeAttribute('required');
        document.getElementById('diaLimite').removeAttribute('required');
        document.getElementById('fechaIngreso').setAttribute('required', 'required');
    } else if (tipoMovimiento === 'TM-002') { // Gasto
        fechaIngresoGroup.classList.add('d-none');
        diaCorteGroup.classList.remove('d-none');
        diaLimiteGroup.classList.remove('d-none');
        document.getElementById('fechaIngreso').removeAttribute('required');
        document.getElementById('diaCorte').setAttribute('required', 'required');
        document.getElementById('diaLimite').setAttribute('required', 'required');
    } else { // Sin selección
        fechaIngresoGroup.classList.add('d-none');
        diaCorteGroup.classList.add('d-none');
        diaLimiteGroup.classList.add('d-none');
        document.getElementById('fechaIngreso').removeAttribute('required');
        document.getElementById('diaCorte').removeAttribute('required');
        document.getElementById('diaLimite').removeAttribute('required');
    }
}

// Filtra las opciones de Tipo Costo basadas en Tipo Movimiento
function filterTipoCostoOptions() {
    const idTipoMovimiento = document.getElementById('idTipoMovimiento').value;
    const tipoCostoSelect = document.getElementById('idTipoCosto');
    tipoCostoSelect.innerHTML = '<option value="">Seleccione...</option>';

    if (idTipoMovimiento) {
        const filteredTipoCostos = data.tipoCostos.filter(tc => tc.ID_TipoMovimiento_FK === idTipoMovimiento);
        populateSelect('idTipoCosto', filteredTipoCostos, 'ID_TipoCosto', 'TipoCosto');
    }
    filterConceptoOptions(); // También actualiza los conceptos
}

// Filtra las opciones de Concepto basadas en Tipo Movimiento y Tipo Costo
function filterConceptoOptions() {
    const idTipoMovimiento = document.getElementById('idTipoMovimiento').value;
    const idTipoCosto = document.getElementById('idTipoCosto').value;
    const conceptoSelect = document.getElementById('idConcepto');
    conceptoSelect.innerHTML = '<option value="">Seleccione...</option>';

    if (idTipoMovimiento && idTipoCosto) {
        const filteredConceptos = data.conceptos.filter(c =>
            c.ID_TipoMovimiento_FK === idTipoMovimiento &&
            c.ID_TipoCosto_FK === idTipoCosto
        );
        populateSelect('idConcepto', filteredConceptos, 'ID_Concepto', 'Concepto');
    }
}


// Maneja el envío del formulario de transacción
function handleTransactionSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    const form = event.target;
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }

    const idTransaccion = document.getElementById('transactionId').value || generateId('TRN');
    const tipoMovimientoFK = document.getElementById('idTipoMovimiento').value;
    const monto = parseFloat(document.getElementById('monto').value);

    let newTransaction = {
        ID_Transaccion: idTransaccion,
        FechaTransaccion: document.getElementById('fechaTransaccion').value,
        ID_TipoMovimiento_FK: tipoMovimientoFK,
        ID_TipoCosto_FK: document.getElementById('idTipoCosto').value,
        ID_Concepto_FK: document.getElementById('idConcepto').value,
        Monto: monto,
        Periodo: document.getElementById('periodoMesAnio').value,
        Notas: document.getElementById('notas').value,
    };

    if (tipoMovimientoFK === 'TM-001') { // Ingreso
        newTransaction.FechaIngreso = document.getElementById('fechaIngreso').value;
        newTransaction.DiaCorte = '';
        newTransaction.DiaLimite = '';
    } else { // Gasto
        newTransaction.FechaIngreso = '';
        newTransaction.DiaCorte = document.getElementById('diaCorte').value;
        newTransaction.DiaLimite = document.getElementById('diaLimite').value;
    }

    // Comprobar si es una edición o una nueva transacción
    const existingIndex = data.transacciones.findIndex(t => t.ID_Transaccion === idTransaccion);
    if (existingIndex > -1) {
        data.transacciones[existingIndex] = newTransaction;
    } else {
        data.transacciones.push(newTransaction);
    }

    updateTransactionCalculations();
    saveData();
    renderTransactionsTable();
    resetTransactionForm();
    form.classList.remove('was-validated'); // Limpiar validación
}

// Restablece el formulario de transacciones
function resetTransactionForm() {
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionId').value = '';
    document.getElementById('transactionForm').classList.remove('was-validated');
    document.getElementById('idTipoMovimiento').value = ''; // Resetear para que se oculte todo
    toggleTransactionFields();
    filterTipoCostoOptions(); // Resetear opciones de costo y concepto
}

// Edita una transacción
function editTransaction(id) {
    const transaction = data.transacciones.find(t => t.ID_Transaccion === id);
    if (transaction) {
        document.getElementById('transactionId').value = transaction.ID_Transaccion;
        document.getElementById('fechaTransaccion').value = transaction.FechaTransaccion;
        document.getElementById('idTipoMovimiento').value = transaction.ID_TipoMovimiento_FK;
        filterTipoCostoOptions(); // Actualizar Tipo Costo
        document.getElementById('idTipoCosto').value = transaction.ID_TipoCosto_FK;
        filterConceptoOptions(); // Actualizar Concepto
        document.getElementById('idConcepto').value = transaction.ID_Concepto_FK;
        document.getElementById('monto').value = transaction.Monto;
        document.getElementById('periodoMesAnio').value = transaction.Periodo;
        document.getElementById('notas').value = transaction.Notas;

        toggleTransactionFields(); // Mostrar/ocultar campos dinámicos
        if (transaction.ID_TipoMovimiento_FK === 'TM-001') {
            document.getElementById('fechaIngreso').value = transaction.FechaIngreso;
        } else {
            document.getElementById('diaCorte').value = transaction.DiaCorte;
            document.getElementById('diaLimite').value = transaction.DiaLimite;
        }
    }
}

// Elimina una transacción
function deleteTransaction(id) {
    if (confirm('¿Estás seguro de que quieres eliminar esta transacción?')) {
        data.transacciones = data.transacciones.filter(t => t.ID_Transaccion !== id);
        saveData();
        updateTransactionCalculations(); // Recalcular todo en caso de eliminacion
        renderTransactionsTable();
        updateDashboardSummary(); // Actualizar dashboard
        renderProximosVencimientos();
        renderGastosPorCategoriaChart();
    }
}

// Renderiza la tabla de Transacciones
function renderTransactionsTable() {
    const tableBody = document.getElementById('transactionsTableBody');
    tableBody.innerHTML = ''; // Limpiar tabla

    const filterConcepto = document.getElementById('filterConcepto').value.toLowerCase();
    const filterTipoMovimiento = document.getElementById('filterTipoMovimiento').value;
    const filterTipoCosto = document.getElementById('filterTipoCosto').value;
    const filterEstatus = document.getElementById('filterEstatus').value;
    const filterPrioridad = document.getElementById('filterPrioridad').value;

    const filteredTransactions = data.transacciones.filter(t => {
        const concepto = data.conceptos.find(c => c.ID_Concepto === t.ID_Concepto_FK)?.Concepto.toLowerCase() || '';
        const tipoMovimiento = t.ID_TipoMovimiento_FK;
        const tipoCosto = t.ID_TipoCosto_FK;
        const estatus = t.Estatus;
        const prioridad = t.Prioridad;

        return (
            (filterConcepto === '' || concepto.includes(filterConcepto)) &&
            (filterTipoMovimiento === '' || tipoMovimiento === filterTipoMovimiento) &&
            (filterTipoCosto === '' || tipoCosto === filterTipoCosto) &&
            (filterEstatus === '' || estatus === filterEstatus) &&
            (filterPrioridad === '' || prioridad === filterPrioridad)
        );
    });

    if (filteredTransactions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="13" class="text-center">No hay transacciones registradas o que coincidan con los filtros.</td></tr>`;
        return;
    }

    filteredTransactions.forEach(transaccion => {
        const tipoMovimiento = data.tipoMovimientos.find(tm => tm.ID_TipoMovimiento === transaccion.ID_TipoMovimiento_FK)?.TipoMovimiento || 'N/A';
        const tipoCosto = data.tipoCostos.find(tc => tc.ID_TipoCosto === transaccion.ID_TipoCosto_FK)?.TipoCosto || 'N/A';
        const concepto = data.conceptos.find(c => c.ID_Concepto === transaccion.ID_Concepto_FK)?.Concepto || 'N/A';

        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${transaccion.ID_Transaccion}</td>
            <td>${transaccion.FechaTransaccion}</td>
            <td>${tipoMovimiento}</td>
            <td>${tipoCosto}</td>
            <td>${concepto}</td>
            <td>$${parseFloat(transaccion.Monto).toFixed(2)}</td>
            <td>${transaccion.Periodo}</td>
            <td>${transaccion.FechaCorte || 'N/A'}</td>
            <td>${transaccion.FechaLimite || 'N/A'}</td>
            <td><span class="badge ${transaccion.Estatus === 'Pagado' ? 'bg-success' : 'bg-warning'}">${transaccion.Estatus}</span></td>
            <td><span class="badge ${transaccion.Prioridad === 'Alta' ? 'bg-danger' : transaccion.Prioridad === 'Media' ? 'bg-warning' : 'bg-info'}">${transaccion.Prioridad || 'N/A'}</span></td>
            <td>${transaccion.NoPlazos || 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-info me-1" onclick="editTransaction('${transaccion.ID_Transaccion}')"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteTransaction('${transaccion.ID_Transaccion}')"><i class="bi bi-trash"></i></button>
            </td>
        `;
    });
}

// Abre el modal de pagos con un concepto preseleccionado si se llama desde Vencimientos
function openPaymentModal(conceptoId = '', monto = 0) {
    const paymentConceptoSelect = document.getElementById('paymentConcepto');
    const paymentMontoInput = document.getElementById('paymentMonto');

    populateSelect('paymentConcepto', data.conceptos.filter(c => {
        const transaction = data.transacciones.find(t => t.ID_Concepto_FK === c.ID_Concepto && t.ID_TipoMovimiento_FK === 'TM-002' && t.Estatus === 'Pendiente');
        return transaction !== undefined;
    }), 'ID_Concepto', 'Concepto');

    if (conceptoId) {
        paymentConceptoSelect.value = conceptoId;
        paymentMontoInput.value = monto.toFixed(2);
    } else {
        paymentConceptoSelect.value = '';
        paymentMontoInput.value = '';
    }
    document.getElementById('paymentForm').classList.remove('was-validated');
}


// Maneja el envío del formulario de pago
function handlePaymentSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    const form = event.target;
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }

    const newPayment = {
        ID_Pago: generateId('PAG'),
        ID_Concepto_FK: document.getElementById('paymentConcepto').value,
        MontoPago: parseFloat(document.getElementById('paymentMonto').value),
        FechaPago: new Date().toISOString().split('T')[0] // Fecha actual del pago
    };

    data.pagos.push(newPayment);
    saveData();
    updateTransactionCalculations(); // Recalcular estatus de transacciones
    renderTransactionsTable();
    updateDashboardSummary(); // Actualizar dashboard
    renderProximosVencimientos(); // Actualizar vencimientos
    document.getElementById('paymentForm').reset();
    document.getElementById('paymentForm').classList.remove('was-validated');
    const paymentModal = bootstrap.Modal.getInstance(document.getElementById('paymentModal'));
    if (paymentModal) {
        paymentModal.hide(); // Cerrar modal
    }
}


// Renderiza la vista de Datos Base
function renderBaseDataView() {
    console.log("Entering renderBaseDataView()"); // Log de depuración
    const contentDiv = document.getElementById('content');
    if (!contentDiv) {
        console.error("Error: contentDiv not found in renderBaseDataView()");
        return;
    }
    contentDiv.innerHTML = `
        <h1 class="mb-4 text-center text-primary-emphasis">Gestión de Datos Base</h1>

        <!-- Tipo Movimiento -->
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-dark text-white">
                <h4 class="mb-0"><i class="bi bi-arrow-left-right me-2"></i>Tipos de Movimiento</h4>
            </div>
            <div class="card-body">
                <form id="tipoMovimientoForm" class="row g-3 needs-validation mb-3" novalidate>
                    <input type="hidden" id="tmId" value="">
                    <div class="col-md-6">
                        <label for="tipoMovimiento" class="form-label">Tipo Movimiento</label>
                        <input type="text" class="form-control rounded-pill" id="tipoMovimiento" required>
                        <div class="invalid-feedback">Ingrese el tipo de movimiento.</div>
                    </div>
                    <div class="col-md-6 text-end">
                        <button class="btn btn-primary rounded-pill me-2" type="submit"><i class="bi bi-save me-1"></i>Guardar</button>
                        <button class="btn btn-secondary rounded-pill" type="reset" onclick="resetBaseDataForm('tipoMovimientoForm', 'tmId')"><i class="bi bi-arrow-clockwise me-1"></i>Limpiar</button>
                    </div>
                </form>
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tipo Movimiento</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="tipoMovimientoTableBody"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Tipo Costo -->
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-dark text-white">
                <h4 class="mb-0"><i class="bi bi-coin me-2"></i>Tipos de Costo</h4>
            </div>
            <div class="card-body">
                <form id="tipoCostoForm" class="row g-3 needs-validation mb-3" novalidate>
                    <input type="hidden" id="tcId" value="">
                    <div class="col-md-6">
                        <label for="tipoCosto" class="form-label">Tipo Costo</label>
                        <input type="text" class="form-control rounded-pill" id="tipoCosto" required>
                        <div class="invalid-feedback">Ingrese el tipo de costo.</div>
                    </div>
                    <div class="col-md-6">
                        <label for="tcTipoMovimientoFK" class="form-label">Tipo Movimiento</label>
                        <select class="form-select rounded-pill" id="tcTipoMovimientoFK" required>
                            <option value="">Seleccione...</option>
                        </select>
                        <div class="invalid-feedback">Seleccione un tipo de movimiento.</div>
                    </div>
                    <div class="col-12 text-end">
                        <button class="btn btn-primary rounded-pill me-2" type="submit"><i class="bi bi-save me-1"></i>Guardar</button>
                        <button class="btn btn-secondary rounded-pill" type="reset" onclick="resetBaseDataForm('tipoCostoForm', 'tcId')"><i class="bi bi-arrow-clockwise me-1"></i>Limpiar</button>
                    </div>
                </form>
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tipo Costo</th>
                                <th>Tipo Movimiento</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="tipoCostoTableBody"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Categoría -->
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-dark text-white">
                <h4 class="mb-0"><i class="bi bi-tags-fill me-2"></i>Categorías</h4>
            </div>
            <div class="card-body">
                <form id="categoriaForm" class="row g-3 needs-validation mb-3" novalidate>
                    <input type="hidden" id="catId" value="">
                    <div class="col-md-6">
                        <label for="categoria" class="form-label">Categoría</label>
                        <input type="text" class="form-control rounded-pill" id="categoria" required>
                        <div class="invalid-feedback">Ingrese la categoría.</div>
                    </div>
                    <div class="col-md-3">
                        <label for="catTipoMovimientoFK" class="form-label">Tipo Movimiento</label>
                        <select class="form-select rounded-pill" id="catTipoMovimientoFK" required>
                            <option value="">Seleccione...</option>
                        </select>
                        <div class="invalid-feedback">Seleccione un tipo de movimiento.</div>
                    </div>
                    <div class="col-md-3">
                        <label for="catTipoCostoFK" class="form-label">Tipo Costo</label>
                        <select class="form-select rounded-pill" id="catTipoCostoFK" required>
                            <option value="">Seleccione...</option>
                        </select>
                        <div class="invalid-feedback">Seleccione un tipo de costo.</div>
                    </div>
                    <div class="col-12 text-end">
                        <button class="btn btn-primary rounded-pill me-2" type="submit"><i class="bi bi-save me-1"></i>Guardar</button>
                        <button class="btn btn-secondary rounded-pill" type="reset" onclick="resetBaseDataForm('categoriaForm', 'catId')"><i class="bi bi-arrow-clockwise me-1"></i>Limpiar</button>
                    </div>
                </form>
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Categoría</th>
                                <th>Tipo Movimiento</th>
                                <th>Tipo Costo</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="categoriaTableBody"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- SubCategoría -->
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-dark text-white">
                <h4 class="mb-0"><i class="bi bi-journal-text me-2"></i>Subcategorías</h4>
            </div>
            <div class="card-body">
                <form id="subCategoriaForm" class="row g-3 needs-validation mb-3" novalidate>
                    <input type="hidden" id="scId" value="">
                    <div class="col-md-6">
                        <label for="subCategoria" class="form-label">Subcategoría</label>
                        <input type="text" class="form-control rounded-pill" id="subCategoria" required>
                        <div class="invalid-feedback">Ingrese la subcategoría.</div>
                    </div>
                    <div class="col-md-3">
                        <label for="scTipoMovimientoFK" class="form-label">Tipo Movimiento</label>
                        <select class="form-select rounded-pill" id="scTipoMovimientoFK" required>
                            <option value="">Seleccione...</option>
                        </select>
                        <div class="invalid-feedback">Seleccione un tipo de movimiento.</div>
                    </div>
                    <div class="col-md-3">
                        <label for="scTipoCostoFK" class="form-label">Tipo Costo</label>
                        <select class="form-select rounded-pill" id="scTipoCostoFK" required>
                            <option value="">Seleccione...</option>
                        </select>
                        <div class="invalid-feedback">Seleccione un tipo de costo.</div>
                    </div>
                    <div class="col-md-6">
                        <label for="scCategoriaFK" class="form-label">Categoría</label>
                        <select class="form-select rounded-pill" id="scCategoriaFK" required>
                            <option value="">Seleccione...</option>
                        </select>
                        <div class="invalid-feedback">Seleccione una categoría.</div>
                    </div>
                    <div class="col-12 text-end">
                        <button class="btn btn-primary rounded-pill me-2" type="submit"><i class="bi bi-save me-1"></i>Guardar</button>
                        <button class="btn btn-secondary rounded-pill" type="reset" onclick="resetBaseDataForm('subCategoriaForm', 'scId')"><i class="bi bi-arrow-clockwise me-1"></i>Limpiar</button>
                    </div>
                </form>
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Subcategoría</th>
                                <th>Tipo Movimiento</th>
                                <th>Tipo Costo</th>
                                <th>Categoría</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="subCategoriaTableBody"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Conceptos -->
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-dark text-white">
                <h4 class="mb-0"><i class="bi bi-lightbulb-fill me-2"></i>Conceptos</h4>
            </div>
            <div class="card-body">
                <form id="conceptoForm" class="row g-3 needs-validation mb-3" novalidate>
                    <input type="hidden" id="conId" value="">
                    <div class="col-md-6">
                        <label for="concepto" class="form-label">Concepto</label>
                        <input type="text" class="form-control rounded-pill" id="concepto" required>
                        <div class="invalid-feedback">Ingrese el concepto.</div>
                    </div>
                    <div class="col-md-3">
                        <label for="conTipoMovimientoFK" class="form-label">Tipo Movimiento</label>
                        <select class="form-select rounded-pill" id="conTipoMovimientoFK" required>
                            <option value="">Seleccione...</option>
                        </select>
                        <div class="invalid-feedback">Seleccione un tipo de movimiento.</div>
                    </div>
                    <div class="col-md-3">
                        <label for="conTipoCostoFK" class="form-label">Tipo Costo</label>
                        <select class="form-select rounded-pill" id="conTipoCostoFK" required>
                            <option value="">Seleccione...</option>
                        </select>
                        <div class="invalid-feedback">Seleccione un tipo de costo.</div>
                    </div>
                    <div class="col-md-6">
                        <label for="conCategoriaFK" class="form-label">Categoría</label>
                        <select class="form-select rounded-pill" id="conCategoriaFK" required>
                            <option value="">Seleccione...</option>
                        </select>
                        <div class="invalid-feedback">Seleccione una categoría.</div>
                    </div>
                    <div class="col-md-6">
                        <label for="conSubCategoriaFK" class="form-label">Subcategoría</label>
                        <select class="form-select rounded-pill" id="conSubCategoriaFK" required>
                            <option value="">Seleccione...</option>
                        </select>
                        <div class="invalid-feedback">Seleccione una subcategoría.</div>
                    </div>
                    <div class="col-12 text-end">
                        <button class="btn btn-primary rounded-pill me-2" type="submit"><i class="bi bi-save me-1"></i>Guardar</button>
                        <button class="btn btn-secondary rounded-pill" type="reset" onclick="resetBaseDataForm('conceptoForm', 'conId')"><i class="bi bi-arrow-clockwise me-1"></i>Limpiar</button>
                    </div>
                </form>
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Concepto</th>
                                <th>Tipo Movimiento</th>
                                <th>Tipo Costo</th>
                                <th>Categoría</th>
                                <th>Subcategoría</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="conceptoTableBody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    console.log("Base Data view rendered."); // Log de depuración

    // Inicializar y poblar selectores en cascada
    populateSelect('tcTipoMovimientoFK', data.tipoMovimientos, 'ID_TipoMovimiento', 'TipoMovimiento');
    populateSelect('catTipoMovimientoFK', data.tipoMovimientos, 'ID_TipoMovimiento', 'TipoMovimiento');
    populateSelect('scTipoMovimientoFK', data.tipoMovimientos, 'ID_TipoMovimiento', 'TipoMovimiento');
    populateSelect('conTipoMovimientoFK', data.tipoMovimientos, 'ID_TipoMovimiento', 'TipoMovimiento');

    // Event listeners para cascading selects
    document.getElementById('catTipoMovimientoFK').addEventListener('change', () => filterBaseDataOptions('catTipoMovimientoFK', 'catTipoCostoFK', data.tipoCostos, 'ID_TipoCosto', 'TipoCosto', 'ID_TipoMovimiento_FK'));
    document.getElementById('scTipoMovimientoFK').addEventListener('change', () => filterBaseDataOptions('scTipoMovimientoFK', 'scTipoCostoFK', data.tipoCostos, 'ID_TipoCosto', 'TipoCosto', 'ID_TipoMovimiento_FK'));
    document.getElementById('conTipoMovimientoFK').addEventListener('change', () => filterBaseDataOptions('conTipoMovimientoFK', 'conTipoCostoFK', data.tipoCostos, 'ID_TipoCosto', 'TipoCosto', 'ID_TipoMovimiento_FK'));

    document.getElementById('scTipoCostoFK').addEventListener('change', () => filterBaseDataOptions(['scTipoMovimientoFK', 'scTipoCostoFK'], 'scCategoriaFK', data.categorias, 'ID_Categoria', 'Categoría', ['ID_TipoMovimiento_FK', 'ID_TipoCosto_FK']));
    document.getElementById('conTipoCostoFK').addEventListener('change', () => filterBaseDataOptions(['conTipoMovimientoFK', 'conTipoCostoFK'], 'conCategoriaFK', data.categorias, 'ID_Categoria', 'Categoría', ['ID_TipoMovimiento_FK', 'ID_TipoCosto_FK']));

    document.getElementById('conCategoriaFK').addEventListener('change', () => filterBaseDataOptions(['conTipoMovimientoFK', 'conTipoCostoFK', 'conCategoriaFK'], 'conSubCategoriaFK', data.subCategorias, 'ID_SubCategoria', 'SubCategoria', ['ID_TipoMovimiento_FK', 'ID_TipoCosto_FK', 'ID_Categoria_FK']));


    // Event listeners para formularios de datos base
    document.getElementById('tipoMovimientoForm').addEventListener('submit', (e) => handleBaseDataSubmit(e, 'tipoMovimientos', 'tmId', 'ID_TipoMovimiento', { TipoMovimiento: 'tipoMovimiento' }));
    document.getElementById('tipoCostoForm').addEventListener('submit', (e) => handleBaseDataSubmit(e, 'tipoCostos', 'tcId', 'ID_TipoCosto', { TipoCosto: 'tipoCosto', ID_TipoMovimiento_FK: 'tcTipoMovimientoFK' }));
    document.getElementById('categoriaForm').addEventListener('submit', (e) => handleBaseDataSubmit(e, 'categorias', 'catId', 'ID_Categoria', { Categoría: 'categoria', ID_TipoMovimiento_FK: 'catTipoMovimientoFK', ID_TipoCosto_FK: 'catTipoCostoFK' }));
    document.getElementById('subCategoriaForm').addEventListener('submit', (e) => handleBaseDataSubmit(e, 'subCategorias', 'scId', 'ID_SubCategoria', { SubCategoria: 'subCategoria', ID_TipoMovimiento_FK: 'scTipoMovimientoFK', ID_TipoCosto_FK: 'scTipoCostoFK', ID_Categoria_FK: 'scCategoriaFK' }));
    document.getElementById('conceptoForm').addEventListener('submit', (e) => handleBaseDataSubmit(e, 'conceptos', 'conId', 'ID_Concepto', { Concepto: 'concepto', ID_TipoMovimiento_FK: 'conTipoMovimientoFK', ID_TipoCosto_FK: 'conTipoCostoFK', ID_Categoria_FK: 'conCategoriaFK', ID_SubCategoria_FK: 'conSubCategoriaFK' }));

    // Renderizar tablas de datos base
    renderTipoMovimientoTable();
    renderTipoCostoTable();
    renderCategoriaTable();
    renderSubCategoriaTable();
    renderConceptoTable();

    // Llamar a los filtros iniciales para que los selects en cascada estén poblados
    filterBaseDataOptions('catTipoMovimientoFK', 'catTipoCostoFK', data.tipoCostos, 'ID_TipoCosto', 'TipoCosto', 'ID_TipoMovimiento_FK');
    filterBaseDataOptions('scTipoMovimientoFK', 'scTipoCostoFK', data.tipoCostos, 'ID_TipoCosto', 'TipoCosto', 'ID_TipoMovimiento_FK');
    filterBaseDataOptions('conTipoMovimientoFK', 'conTipoCostoFK', data.tipoCostos, 'ID_TipoCosto', 'TipoCosto', 'ID_TipoMovimiento_FK');
    filterBaseDataOptions(['scTipoMovimientoFK', 'scTipoCostoFK'], 'scCategoriaFK', data.categorias, 'ID_Categoria', 'Categoría', ['ID_TipoMovimiento_FK', 'ID_TipoCosto_FK']);
    filterBaseDataOptions(['conTipoMovimientoFK', 'conTipoCostoFK'], 'conCategoriaFK', data.categorias, 'ID_Categoria', 'Categoría', ['ID_TipoMovimiento_FK', 'ID_TipoCosto_FK']);
    filterBaseDataOptions(['conTipoMovimientoFK', 'conTipoCostoFK', 'conCategoriaFK'], 'conSubCategoriaFK', data.subCategorias, 'ID_SubCategoria', 'SubCategoria', ['ID_TipoMovimiento_FK', 'ID_TipoCosto_FK', 'ID_Categoria_FK']);

}

// Función genérica para poblar selects
function populateSelect(selectId, options, valueKey, textKey) {
    const select = document.getElementById(selectId);
    if (!select) return; // Si el select no existe en la vista actual, ignorar
    const currentValue = select.value; // Guardar el valor actual para mantener la selección si es posible
    select.innerHTML = '<option value="">Seleccione...</option>';
    options.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item[textKey];
        select.appendChild(option);
    });
    if (options.some(item => item[valueKey] === currentValue)) {
        select.value = currentValue; // Restaurar el valor si sigue siendo válido
    }
}

// Función genérica para filtrar opciones de selects en cascada
function filterBaseDataOptions(sourceSelectIds, targetSelectId, allOptions, targetValueKey, targetTextKey, filterKeys) {
    const sourceValues = Array.isArray(sourceSelectIds)
        ? sourceSelectIds.map(id => document.getElementById(id).value)
        : [document.getElementById(sourceSelectIds).value];

    const targetSelect = document.getElementById(targetSelectId);
    if (!targetSelect) return;

    targetSelect.innerHTML = '<option value="">Seleccione...</option>';

    if (sourceValues.every(val => val !== '')) {
        const filteredOptions = allOptions.filter(item => {
            return Array.isArray(filterKeys)
                ? filterKeys.every((key, index) => item[key] === sourceValues[index])
                : item[filterKeys] === sourceValues[0];
        });
        populateSelect(targetSelectId, filteredOptions, targetValueKey, targetTextKey);
    }
}

// Función genérica para manejar el envío de formularios de datos base
function handleBaseDataSubmit(event, dataKey, idFieldId, idPrefix, fieldMapping) {
    event.preventDefault();
    event.stopPropagation();

    const form = event.target;
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }

    const id = document.getElementById(idFieldId).value || generateId(idPrefix.split('-')[0].toUpperCase()); // ID_TipoMovimiento -> TM
    let newItem = { [idPrefix]: id };

    for (const key in fieldMapping) {
        newItem[key] = document.getElementById(fieldMapping[key]).value;
    }

    const existingIndex = data[dataKey].findIndex(item => item[idPrefix] === id);
    if (existingIndex > -1) {
        data[dataKey][existingIndex] = newItem;
    } else {
        data[dataKey].push(newItem);
    }

    saveData();
    // Re-renderizar todas las tablas para reflejar los cambios en cascada
    renderTipoMovimientoTable();
    renderTipoCostoTable();
    renderCategoriaTable();
    renderSubCategoriaTable();
    renderConceptoTable();
    resetBaseDataForm(form.id, idFieldId);
    form.classList.remove('was-validated'); // Limpiar validación

    // Actualizar selectores en otras vistas si están activas
    if (document.getElementById('idTipoMovimiento')) { // Si estamos en Transacciones
        populateSelect('idTipoMovimiento', data.tipoMovimientos, 'ID_TipoMovimiento', 'TipoMovimiento');
        filterTipoCostoOptions();
    }
    if (document.getElementById('paymentConcepto')) { // Si el modal de pagos está activo
        populateSelect('paymentConcepto', data.conceptos.filter(c => {
            const transaction = data.transacciones.find(t => t.ID_Concepto_FK === c.ID_Concepto && t.ID_TipoMovimiento_FK === 'TM-002' && t.Estatus === 'Pendiente');
            return transaction !== undefined;
        }), 'ID_Concepto', 'Concepto');
    }

    // Volver a poblar los selects en cascada en la vista de Datos Base después de un cambio
    const currentView = window.location.hash.substring(1) || 'dashboard';
    if (currentView === 'baseData') {
        filterBaseDataOptions('catTipoMovimientoFK', 'catTipoCostoFK', data.tipoCostos, 'ID_TipoCosto', 'TipoCosto', 'ID_TipoMovimiento_FK');
        filterBaseDataOptions('scTipoMovimientoFK', 'scTipoCostoFK', data.tipoCostos, 'ID_TipoCosto', 'TipoCosto', 'ID_TipoMovimiento_FK');
        filterBaseDataOptions('conTipoMovimientoFK', 'conTipoCostoFK', data.tipoCostos, 'ID_TipoCosto', 'TipoCosto', 'ID_TipoMovimiento_FK');
        filterBaseDataOptions(['scTipoMovimientoFK', 'scTipoCostoFK'], 'scCategoriaFK', data.categorias, 'ID_Categoria', 'Categoría', ['ID_TipoMovimiento_FK', 'ID_TipoCosto_FK']);
        filterBaseDataOptions(['conTipoMovimientoFK', 'conTipoCostoFK'], 'conCategoriaFK', data.categorias, 'ID_Categoria', 'Categoría', ['ID_TipoMovimiento_FK', 'ID_TipoCosto_FK']);
    }
}

// Restablece el formulario de datos base
function resetBaseDataForm(formId, idFieldId) {
    document.getElementById(formId).reset();
    document.getElementById(idFieldId).value = '';
    document.getElementById(formId).classList.remove('was-validated');

    // Resetear selects en cascada para Datos Base
    if (formId === 'categoriaForm' || formId === 'subCategoriaForm' || formId === 'conceptoForm') {
        const selectsToReset = {
            'categoriaForm': ['catTipoMovimientoFK', 'catTipoCostoFK'],
            'subCategoriaForm': ['scTipoMovimientoFK', 'scTipoCostoFK', 'scCategoriaFK'],
            'conceptoForm': ['conTipoMovimientoFK', 'conTipoCostoFK', 'conCategoriaFK', 'conSubCategoriaFK']
        };
        selectsToReset[formId].forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.value = '';
                // Limpiar opciones de selects dependientes
                if (selectId === 'catTipoMovimientoFK' || selectId === 'scTipoMovimientoFK' || selectId === 'conTipoMovimientoFK') {
                    const dependentCostoSelect = document.getElementById(selectId.replace('TipoMovimientoFK', 'TipoCostoFK'));
                    if (dependentCostoSelect) dependentCostoSelect.innerHTML = '<option value="">Seleccione...</option>';
                }
                if (selectId === 'scTipoCostoFK' || selectId === 'conTipoCostoFK') {
                    const dependentCategoriaSelect = document.getElementById(selectId.replace('TipoCostoFK', 'CategoriaFK'));
                    if (dependentCategoriaSelect) dependentCategoriaSelect.innerHTML = '<option value="">Seleccione...</option>';
                }
                if (selectId === 'conCategoriaFK') {
                    const dependentSubCategoriaSelect = document.getElementById('conSubCategoriaFK');
                    if (dependentSubCategoriaSelect) dependentSubCategoriaSelect.innerHTML = '<option value="">Seleccione...</option>';
                }
            }
        });
        // Llama a las funciones de filtro para restablecer los selects con las opciones correctas
        const currentView = window.location.hash.substring(1) || 'dashboard';
        if (currentView === 'baseData') {
            filterBaseDataOptions('catTipoMovimientoFK', 'catTipoCostoFK', data.tipoCostos, 'ID_TipoCosto', 'TipoCosto', 'ID_TipoMovimiento_FK');
            filterBaseDataOptions('scTipoMovimientoFK', 'scTipoCostoFK', data.tipoCostos, 'ID_TipoCosto', 'TipoCosto', 'ID_TipoMovimiento_FK');
            filterBaseDataOptions('conTipoMovimientoFK', 'conTipoCostoFK', data.tipoCostos, 'ID_TipoCosto', 'TipoCosto', 'ID_TipoMovimiento_FK');
            filterBaseDataOptions(['scTipoMovimientoFK', 'scTipoCostoFK'], 'scCategoriaFK', data.categorias, 'ID_Categoria', 'Categoría', ['ID_TipoMovimiento_FK', 'ID_TipoCosto_FK']);
            filterBaseDataOptions(['conTipoMovimientoFK', 'conTipoCostoFK'], 'conCategoriaFK', data.categorias, 'ID_Categoria', 'Categoría', ['ID_TipoMovimiento_FK', 'ID_TipoCosto_FK']);
            filterBaseDataOptions(['conTipoMovimientoFK', 'conTipoCostoFK', 'conCategoriaFK'], 'conSubCategoriaFK', data.subCategorias, 'ID_SubCategoria', 'SubCategoria', ['ID_TipoMovimiento_FK', 'ID_TipoCosto_FK', 'ID_Categoria_FK']);
        }
    }
}


// Edita un item de datos base
function editBaseDataItem(dataKey, idKey, item) {
    const formId = {
        'tipoMovimientos': 'tipoMovimientoForm',
        'tipoCostos': 'tipoCostoForm',
        'categorias': 'categoriaForm',
        'subCategorias': 'subCategoriaForm',
        'conceptos': 'conceptoForm'
    }[dataKey];

    const idFieldId = {
        'tipoMovimientos': 'tmId',
        'tipoCostos': 'tcId',
        'categorias': 'catId',
        'subCategorias': 'scId',
        'conceptos': 'conId'
    }[dataKey];

    const fieldMapping = {
        'tipoMovimientos': { TipoMovimiento: 'tipoMovimiento' },
        'tipoCostos': { TipoCosto: 'tipoCosto', ID_TipoMovimiento_FK: 'tcTipoMovimientoFK' },
        'categorias': { Categoría: 'categoria', ID_TipoMovimiento_FK: 'catTipoMovimientoFK', ID_TipoCosto_FK: 'catTipoCostoFK' },
        'subCategorias': { SubCategoria: 'subCategoria', ID_TipoMovimiento_FK: 'scTipoMovimientoFK', ID_TipoCosto_FK: 'scTipoCostoFK', ID_Categoria_FK: 'scCategoriaFK' },
        'conceptos': { Concepto: 'concepto', ID_TipoMovimiento_FK: 'conTipoMovimientoFK', ID_TipoCosto_FK: 'conTipoCostoFK', ID_Categoria_FK: 'conCategoriaFK', ID_SubCategoria_FK: 'conSubCategoriaFK' }
    }[dataKey];

    document.getElementById(idFieldId).value = item[idKey];
    for (const key in fieldMapping) {
        document.getElementById(fieldMapping[key]).value = item[key];
    }

    // Para selects en cascada, disparar los eventos de cambio para que se pueblen correctamente
    if (formId === 'categoriaForm') {
        document.getElementById('catTipoMovimientoFK').dispatchEvent(new Event('change'));
        document.getElementById('catTipoCostoFK').value = item.ID_TipoCosto_FK; // Establecer después del filtrado
    } else if (formId === 'subCategoriaForm') {
        document.getElementById('scTipoMovimientoFK').dispatchEvent(new Event('change'));
        document.getElementById('scTipoCostoFK').value = item.ID_TipoCosto_FK;
        document.getElementById('scTipoCostoFK').dispatchEvent(new Event('change')); // Disparar para cargar categorías
        document.getElementById('scCategoriaFK').value = item.ID_Categoria_FK;
    } else if (formId === 'conceptoForm') {
        document.getElementById('conTipoMovimientoFK').dispatchEvent(new Event('change'));
        document.getElementById('conTipoCostoFK').value = item.ID_TipoCosto_FK;
        document.getElementById('conTipoCostoFK').dispatchEvent(new Event('change')); // Disparar para cargar categorías
        document.getElementById('conCategoriaFK').value = item.ID_Categoria_FK;
        document.getElementById('conCategoriaFK').dispatchEvent(new Event('change')); // Disparar para cargar subcategorías
        document.getElementById('conSubCategoriaFK').value = item.ID_SubCategoria_FK;
    }
}

// Elimina un item de datos base
function deleteBaseDataItem(dataKey, idKey, id) {
    if (confirm(`¿Estás seguro de que quieres eliminar este elemento? Ten en cuenta que esto podría afectar a las transacciones.`)) {
        data[dataKey] = data[dataKey].filter(item => item[idKey] !== id);
        saveData();
        updateTransactionCalculations(); // Recalcular todo en caso de eliminacion
        // Re-renderizar todas las tablas para reflejar los cambios
        renderTipoMovimientoTable();
        renderTipoCostoTable();
        renderCategoriaTable();
        renderSubCategoriaTable();
        renderConceptoTable();
        updateDashboardSummary(); // Actualizar dashboard
        renderProximosVencimientos();
        renderGastosPorCategoriaChart();

        // Si eliminamos un tipo de movimiento, costo, categoría o subcategoría,
        // necesitamos limpiar las transacciones que dependan de ellos
        if (dataKey === 'tipoMovimientos' || dataKey === 'tipoCostos' || dataKey === 'categorias' || dataKey === 'subCategorias' || dataKey === 'conceptos') {
            data.transacciones = data.transacciones.filter(t => {
                if (dataKey === 'tipoMovimientos' && t.ID_TipoMovimiento_FK === id) return false;
                if (dataKey === 'tipoCostos' && t.ID_TipoCosto_FK === id) return false;
                // Para Conceptos, necesitaríamos más lógica para verificar si su categoría/subcategoría fue eliminada
                const concepto = data.conceptos.find(c => c.ID_Concepto === t.ID_Concepto_FK);
                if (!concepto) return false; // Eliminar transacción si su concepto ya no existe

                const categoria = data.categorias.find(c => c.ID_Categoria === concepto.ID_Categoria_FK);
                if (!categoria) return false; // Eliminar si su categoría no existe

                const subCategoria = data.subCategorias.find(sc => sc.ID_SubCategoria === concepto.ID_SubCategoria_FK);
                if (concepto.ID_SubCategoria_FK && !subCategoria) return false; // Eliminar si su subcategoría no existe y está asignada

                return true;
            });
            saveData();
            updateTransactionCalculations();
        }
    }
}

// Renderiza la tabla de Tipo Movimiento
function renderTipoMovimientoTable() {
    const tableBody = document.getElementById('tipoMovimientoTableBody');
    if (!tableBody) return; // Si no estamos en la vista, ignorar
    tableBody.innerHTML = '';
    data.tipoMovimientos.forEach(item => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${item.ID_TipoMovimiento}</td>
            <td>${item.TipoMovimiento}</td>
            <td>
                <button class="btn btn-sm btn-info me-1" onclick="editBaseDataItem('tipoMovimientos', 'ID_TipoMovimiento', ${JSON.stringify(item).replace(/"/g, '&quot;')})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteBaseDataItem('tipoMovimientos', 'ID_TipoMovimiento', '${item.ID_TipoMovimiento}')"><i class="bi bi-trash"></i></button>
            </td>
        `;
    });
}

// Renderiza la tabla de Tipo Costo
function renderTipoCostoTable() {
    const tableBody = document.getElementById('tipoCostoTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    data.tipoCostos.forEach(item => {
        const tipoMovimiento = data.tipoMovimientos.find(tm => tm.ID_TipoMovimiento === item.ID_TipoMovimiento_FK)?.TipoMovimiento || 'N/A';
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${item.ID_TipoCosto}</td>
            <td>${item.TipoCosto}</td>
            <td>${tipoMovimiento}</td>
            <td>
                <button class="btn btn-sm btn-info me-1" onclick="editBaseDataItem('tipoCostos', 'ID_TipoCosto', ${JSON.stringify(item).replace(/"/g, '&quot;')})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteBaseDataItem('tipoCostos', 'ID_TipoCosto', '${item.ID_TipoCosto}')"><i class="bi bi-trash"></i></button>
            </td>
        `;
    });
}

// Renderiza la tabla de Categoría
function renderCategoriaTable() {
    const tableBody = document.getElementById('categoriaTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    data.categorias.forEach(item => {
        const tipoMovimiento = data.tipoMovimientos.find(tm => tm.ID_TipoMovimiento === item.ID_TipoMovimiento_FK)?.TipoMovimiento || 'N/A';
        const tipoCosto = data.tipoCostos.find(tc => tc.ID_TipoCosto === item.ID_TipoCosto_FK)?.TipoCosto || 'N/A';
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${item.ID_Categoria}</td>
            <td>${item.Categoría}</td>
            <td>${tipoMovimiento}</td>
            <td>${tipoCosto}</td>
            <td>
                <button class="btn btn-sm btn-info me-1" onclick="editBaseDataItem('categorias', 'ID_Categoria', ${JSON.stringify(item).replace(/"/g, '&quot;')})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteBaseDataItem('categorias', 'ID_Categoria', '${item.ID_Categoria}')"><i class="bi bi-trash"></i></button>
            </td>
        `;
    });
}

// Renderiza la tabla de SubCategoría
function renderSubCategoriaTable() {
    const tableBody = document.getElementById('subCategoriaTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    data.subCategorias.forEach(item => {
        const tipoMovimiento = data.tipoMovimientos.find(tm => tm.ID_TipoMovimiento === item.ID_TipoMovimiento_FK)?.TipoMovimiento || 'N/A';
        const tipoCosto = data.tipoCostos.find(tc => tc.ID_TipoCosto === item.ID_TipoCosto_FK)?.TipoCosto || 'N/A';
        const categoria = data.categorias.find(cat => cat.ID_Categoria === item.ID_Categoria_FK)?.Categoría || 'N/A';
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${item.ID_SubCategoria}</td>
            <td>${item.SubCategoria}</td>
            <td>${tipoMovimiento}</td>
            <td>${tipoCosto}</td>
            <td>${categoria}</td>
            <td>
                <button class="btn btn-sm btn-info me-1" onclick="editBaseDataItem('subCategorias', 'ID_SubCategoria', ${JSON.stringify(item).replace(/"/g, '&quot;')})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteBaseDataItem('subCategorias', 'ID_SubCategoria', '${item.ID_SubCategoria}')"><i class="bi bi-trash"></i></button>
            </td>
        `;
    });
}

// Renderiza la tabla de Conceptos
function renderConceptoTable() {
    const tableBody = document.getElementById('conceptoTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    data.conceptos.forEach(item => {
        const tipoMovimiento = data.tipoMovimientos.find(tm => tm.ID_TipoMovimiento === item.ID_TipoMovimiento_FK)?.TipoMovimiento || 'N/A';
        const tipoCosto = data.tipoCostos.find(tc => tc.ID_TipoCosto === item.ID_TipoCosto_FK)?.TipoCosto || 'N/A';
        const categoria = data.categorias.find(cat => cat.ID_Categoria === item.ID_Categoria_FK)?.Categoría || 'N/A';
        const subCategoria = data.subCategorias.find(sc => sc.ID_SubCategoria === item.ID_SubCategoria_FK)?.SubCategoria || 'N/A';
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${item.ID_Concepto}</td>
            <td>${item.Concepto}</td>
            <td>${tipoMovimiento}</td>
            <td>${tipoCosto}</td>
            <td>${categoria}</td>
            <td>${subCategoria}</td>
            <td>
                <button class="btn btn-sm btn-info me-1" onclick="editBaseDataItem('conceptos', 'ID_Concepto', ${JSON.stringify(item).replace(/"/g, '&quot;')})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteBaseDataItem('conceptos', 'ID_Concepto', '${item.ID_Concepto}')"><i class="bi bi-trash"></i></button>
            </td>
        `;
    });
}

// --- NAVEGACIÓN SPA ---

// Función para navegar entre vistas
function navigateTo(view) {
    console.log('Navigating to:', view); // Log de depuración
    // Actualizar la URL sin recargar la página
    history.pushState(null, '', `#${view}`);
    renderView(view);
}

// Renderiza la vista actual
function renderView(view) {
    console.log('Rendering view:', view); // Log de depuración
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    navLinks.forEach(link => link.classList.remove('active'));

    const currentLink = document.querySelector(`.nav-link[id="nav${view.charAt(0).toUpperCase() + view.slice(1)}Link"]`);
    if (currentLink) {
        currentLink.classList.add('active');
    } else if (view === 'dashboard') { // Handle default for brand link
         document.getElementById('navDashboardLink')?.classList.add('active');
    }

    // Asegurarse de que los cálculos estén actualizados antes de renderizar
    updateTransactionCalculations();

    const contentDiv = document.getElementById('content');
    if (contentDiv) {
        console.log('Content div found. Updating innerHTML for:', view); // Log de depuración
        switch (view) {
            case 'dashboard':
                renderDashboard();
                break;
            case 'transactions':
                renderTransactionsView();
                break;
            case 'baseData':
                renderBaseDataView();
                break;
            default:
                renderDashboard(); // Vista por defecto
                break;
        }
    } else {
        console.error('Error: El elemento con ID "content" no se encontró en el DOM.');
    }
}

// Manejar la navegación inicial y los cambios de hash
window.addEventListener('popstate', () => {
    const view = window.location.hash.substring(1) || 'dashboard';
    renderView(view);
});

// Inicialización de la aplicación al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    updateTransactionCalculations(); // Recalcular todo al inicio para tener datos frescos

    // Attach event listeners for navigation links
    document.getElementById('navBrandLink').addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('dashboard');
    });
    document.getElementById('navDashboardLink').addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('dashboard');
    });
    document.getElementById('navTransactionsLink').addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('transactions');
    });
    document.getElementById('navBaseDataLink').addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('baseData');
    });

    const initialView = window.location.hash.substring(1) || 'dashboard';
    renderView(initialView);
});
