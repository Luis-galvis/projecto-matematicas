/**
 * ============================================================================
 * SIMULADOR DE COLA DE PETICIONES Y CONSUMO DE RAM CON TRANSFORMADA DE LAPLACE
 * ============================================================================
 * Proyecto de Matemáticas Especiales: Modelado de Servidor Web (Nginx / Node.js)
 * 
 * Ecuación Diferencial:
 *    dq(t)/dt + α · q(t) = λ₀ · u(t),   con q(0) = q₀
 * 
 * Solución por Transformada de Laplace:
 *    Q(s) = λ₀ / [s(s + α)] + q₀ / (s + α)
 *    q(t) = (λ₀/α) · (1 - e^(-αt)) + q₀ · e^(-αt)
 * 
 * Modelo de Memoria RAM:
 *    M(t) = M_base + m_r · q(t)
 * 
 * Verificación Numérica:
 *    Runge-Kutta 4to Orden (RK4) para dq/dt = λ₀ - α·q
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // --------------------------------------------------------------------------
  // 1. REFERENCIAS AL DOM
  // --------------------------------------------------------------------------
  const dom = {
    // Inputs y Sliders
    lambda: { range: document.getElementById('param-lambda'), num: document.getElementById('num-lambda') },
    alpha: { range: document.getElementById('param-alpha'), num: document.getElementById('num-alpha') },
    q0: { range: document.getElementById('param-q0'), num: document.getElementById('num-q0') },
    mr: { range: document.getElementById('param-mr'), num: document.getElementById('num-mr') },
    mbase: { range: document.getElementById('param-mbase'), num: document.getElementById('num-mbase') },
    mmax: { range: document.getElementById('param-mmax'), num: document.getElementById('num-mmax') },
    tmax: { range: document.getElementById('param-tmax'), num: document.getElementById('num-tmax') },

    // KPIs y Resultados
    kpiStatus: document.getElementById('kpi-system-status'),
    kpiStatusSub: document.getElementById('kpi-status-sub'),
    cardStatus: document.getElementById('card-status'),
    statusIcon: document.getElementById('status-icon'),
    globalDot: document.getElementById('global-status-dot'),
    kpiTau: document.getElementById('kpi-tau'),
    kpiQss: document.getElementById('kpi-qss'),
    kpiTs: document.getElementById('kpi-ts'),
    kpiMpeak: document.getElementById('kpi-mpeak'),
    kpiMpeakGb: document.getElementById('kpi-mpeak-gb'),
    kpiSafetyMb: document.getElementById('kpi-safety-mb'),
    kpiSafetyPct: document.getElementById('kpi-safety-pct'),
    cardSafety: document.getElementById('card-safety-margin'),
    kpiRk4Error: document.getElementById('kpi-rk4-error'),

    // Botones de presets
    btnNominal: document.getElementById('preset-nominal'),
    btnCrisis: document.getElementById('preset-crisis'),
    btnOpt: document.getElementById('preset-optimized'),
    btnResetParams: document.getElementById('btn-reset-params'),

    // Gauge y Simulación Animada
    liveTime: document.getElementById('live-time-display'),
    gaugeLabelCurrent: document.getElementById('gauge-label-current'),
    gaugeLabelMax: document.getElementById('gauge-label-max'),
    gaugeFill: document.getElementById('gauge-ram-fill'),
    gaugeLegend: document.getElementById('gauge-status-legend'),
    btnToggleSim: document.getElementById('btn-toggle-sim'),
    btnPlayIcon: document.getElementById('btn-play-icon'),
    btnPlayText: document.getElementById('btn-play-text'),
    btnResetSim: document.getElementById('btn-reset-sim'),
    selectSpeed: document.getElementById('select-speed'),

    // Tabs de Matemáticas
    mathTabs: document.querySelectorAll('.math-tab'),
    mathContents: document.querySelectorAll('.math-tab-content')
  };

  // --------------------------------------------------------------------------
  // 2. ESTADO GLOBAL DE PARÁMETROS
  // --------------------------------------------------------------------------
  const state = {
    lambda: 500,     // λ₀: Tasa de llegada [req/s]
    alpha: 0.5,      // α: Tasa de servicio [s⁻¹]
    q0: 0,           // q₀: Longitud inicial de cola [req]
    mr: 4.0,         // m_r: RAM por petición [MB/req]
    mbase: 1024,     // M_base: RAM base OS/Runtime [MB]
    mmax: 8192,      // M_max: Capacidad física instalada [MB]
    tmax: 20,        // t_max: Tiempo máximo visualizado [s]

    // Estado de la animación en vivo
    simulating: false,
    simTime: 0,
    simSpeed: 1.0,
    animFrameId: null,
    lastTimestamp: null
  };

  // --------------------------------------------------------------------------
  // 3. MODELO MATEMÁTICO PURO
  // --------------------------------------------------------------------------

  /**
   * Solución Analítica de la EDO obtenida con Transformada de Laplace:
   * EDO: dq/dt + α·q = λ₀, con q(0) = q₀
   * Laplace: sQ(s) - q₀ + αQ(s) = λ₀/s => Q(s) = λ₀/[s(s+α)] + q₀/(s+α)
   * Antitransformada: q(t) = (λ₀/α)·(1 - e^(-αt)) + q₀·e^(-αt)
   */
  function calculateAnalyticQueue(t, lambda, alpha, q0) {
    if (alpha <= 0) return q0 + lambda * t; // Caso degenerado sin servicio
    return (lambda / alpha) * (1 - Math.exp(-alpha * t)) + q0 * Math.exp(-alpha * t);
  }

  /**
   * Modelo de consumo de memoria RAM:
   * M(t) = M_base + m_r · q(t)
   */
  function calculateRAM(q, mbase, mr) {
    return mbase + mr * q;
  }

  /**
   * Integrador Numérico Runge-Kutta de 4to Orden (RK4)
   * Resuelve: dq/dt = f(t, q) = λ₀ - α·q
   * Realiza pasos de integración finos (h = 0.002s) y muestrea para la gráfica.
   */
  function solveRK4(lambda, alpha, q0, tmax, plotPoints = 120) {
    const timePoints = [];
    const qPoints = [];
    
    // Función derivada f(t, q) = dq/dt
    const f = (t, q) => lambda - alpha * q;

    // Subpaso fino de integración RK4 para máxima precisión numérica
    const h = 0.002; 
    const plotInterval = tmax / plotPoints;

    let t = 0;
    let q = q0;
    let nextPlotTime = 0;

    timePoints.push(0);
    qPoints.push(q0);
    nextPlotTime += plotInterval;

    while (t < tmax) {
      const step = Math.min(h, tmax - t);
      
      const k1 = f(t, q);
      const k2 = f(t + 0.5 * step, q + 0.5 * step * k1);
      const k3 = f(t + 0.5 * step, q + 0.5 * step * k2);
      const k4 = f(t + step, q + step * k3);

      q = q + (step / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      t = t + step;

      if (t >= nextPlotTime || Math.abs(t - tmax) < 1e-6) {
        timePoints.push(Number(t.toFixed(4)));
        qPoints.push(q);
        nextPlotTime += plotInterval;
      }
    }

    return { timePoints, qPoints };
  }

  /**
   * Cálculo de métricas derivadas del sistema
   */
  function computeDerivedMetrics() {
    const { lambda, alpha, q0, mr, mbase, mmax } = state;

    // Constante de tiempo: τ = 1/α
    const tau = 1 / alpha;

    // Estado estacionario asintótico: q_ss = λ₀/α
    const q_ss = lambda / alpha;

    // Tiempo al 98% según la regla práctica de control de sistemas: t_s = 4τ = 4/α
    const t_s = 4 / alpha;

    // Memoria pico en estado estacionario: M_peak = M_base + m_r · q_ss
    const m_peak = mbase + mr * q_ss;

    // Margen de seguridad: M_max - M_peak
    const safetyMarginMb = mmax - m_peak;
    const safetyMarginPct = (safetyMarginMb / mmax) * 100;

    // Estado del sistema: Seguro (M_peak <= M_max) o Colapso (M_peak > M_max)
    const isSafe = m_peak <= mmax;
    const isCritical = m_peak > mmax;

    return {
      tau,
      q_ss,
      t_s,
      m_peak,
      safetyMarginMb,
      safetyMarginPct,
      isSafe,
      isCritical
    };
  }

  // --------------------------------------------------------------------------
  // 4. CONFIGURACIÓN DE CHART.JS
  // --------------------------------------------------------------------------
  let chartQueue = null;
  let chartRAM = null;

  function initCharts() {
    const ctxQueue = document.getElementById('chart-queue').getContext('2d');
    const ctxRAM = document.getElementById('chart-ram').getContext('2d');

    const commonChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            title: (items) => `Tiempo t = ${Number(items[0].parsed.x).toFixed(2)} s`
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          title: {
            display: true,
            text: 'Tiempo t [segundos]',
            color: '#94a3b8',
            font: { family: "'Inter', sans-serif", size: 12, weight: 600 }
          },
          grid: { color: 'rgba(51, 65, 85, 0.35)' },
          ticks: { color: '#64748b', font: { family: "'JetBrains Mono', monospace" } }
        },
        y: {
          min: 0,
          grid: { color: 'rgba(51, 65, 85, 0.35)' },
          ticks: { color: '#64748b', font: { family: "'JetBrains Mono', monospace" } }
        }
      }
    };

    // --- GRÁFICA 1: Longitud de Cola q(t) ---
    chartQueue = new Chart(ctxQueue, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Solución Analítica q(t)',
            data: [],
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.12)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.1,
            pointRadius: 0
          },
          {
            label: 'Verificación Numérica [RK4]',
            data: [],
            borderColor: '#c084fc',
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointRadius: 1.5,
            pointHoverRadius: 4,
            pointBackgroundColor: '#c084fc',
            fill: false,
            tension: 0
          },
          {
            label: 'Tiempo Actual (Simulación)',
            data: [],
            borderColor: '#ffffff',
            backgroundColor: '#06b6d4',
            pointRadius: 6,
            pointHoverRadius: 8,
            showLine: false
          }
        ]
      },
      options: {
        ...commonChartOptions,
        scales: {
          ...commonChartOptions.scales,
          y: {
            ...commonChartOptions.scales.y,
            title: {
              display: true,
              text: 'Peticiones en Cola q(t) [req]',
              color: '#06b6d4',
              font: { family: "'Inter', sans-serif", size: 12, weight: 600 }
            }
          }
        },
        plugins: {
          ...commonChartOptions.plugins,
          annotation: {
            annotations: {
              lineQss: {
                type: 'line',
                scaleID: 'y',
                value: 1000,
                borderColor: '#f59e0b',
                borderWidth: 2,
                borderDash: [6, 6],
                label: {
                  display: true,
                  content: 'q_ss = 1,000 req',
                  position: 'end',
                  backgroundColor: 'rgba(245, 158, 11, 0.9)',
                  color: '#ffffff',
                  font: { family: "'JetBrains Mono', monospace", size: 11, weight: 'bold' }
                }
              },
              lineTs: {
                type: 'line',
                scaleID: 'x',
                value: 8.0,
                borderColor: '#38bdf8',
                borderWidth: 2,
                borderDash: [4, 4],
                label: {
                  display: true,
                  content: 't_s = 4τ = 8.00s (98%)',
                  position: 'start',
                  backgroundColor: 'rgba(14, 165, 233, 0.9)',
                  color: '#ffffff',
                  font: { family: "'JetBrains Mono', monospace", size: 11, weight: 'bold' }
                }
              }
            }
          }
        }
      }
    });

    // --- GRÁFICA 2: Consumo de Memoria RAM M(t) ---
    chartRAM = new Chart(ctxRAM, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Consumo RAM M(t)',
            data: [],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.1,
            pointRadius: 0
          },
          {
            label: 'Punto Actual RAM',
            data: [],
            borderColor: '#ffffff',
            backgroundColor: '#10b981',
            pointRadius: 6,
            pointHoverRadius: 8,
            showLine: false
          }
        ]
      },
      options: {
        ...commonChartOptions,
        scales: {
          ...commonChartOptions.scales,
          y: {
            ...commonChartOptions.scales.y,
            title: {
              display: true,
              text: 'Memoria RAM M(t) [MB]',
              color: '#10b981',
              font: { family: "'Inter', sans-serif", size: 12, weight: 600 }
            }
          }
        },
        plugins: {
          ...commonChartOptions.plugins,
          annotation: {
            annotations: {
              lineMmax: {
                type: 'line',
                scaleID: 'y',
                value: 8192,
                borderColor: '#ef4444',
                borderWidth: 2.5,
                label: {
                  display: true,
                  content: 'LÍMITE FÍSICO M_max = 8,192 MB',
                  position: 'start',
                  backgroundColor: 'rgba(239, 68, 68, 0.92)',
                  color: '#ffffff',
                  font: { family: "'JetBrains Mono', monospace", size: 11, weight: 'bold' }
                }
              },
              lineMpeak: {
                type: 'line',
                scaleID: 'y',
                value: 5024,
                borderColor: '#10b981',
                borderWidth: 2,
                borderDash: [6, 6],
                label: {
                  display: true,
                  content: 'M_peak = 5,024 MB',
                  position: 'end',
                  backgroundColor: 'rgba(16, 185, 129, 0.9)',
                  color: '#ffffff',
                  font: { family: "'JetBrains Mono', monospace", size: 11, weight: 'bold' }
                }
              },
              boxSafetyMargin: {
                type: 'box',
                yScaleID: 'y',
                yMin: 5024,
                yMax: 8192,
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderColor: 'transparent'
              }
            }
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // 5. ACTUALIZACIÓN DEL DASHBOARD Y GRÁFICAS
  // --------------------------------------------------------------------------
  function updateDashboard() {
    const metrics = computeDerivedMetrics();
    const { lambda, alpha, q0, mr, mbase, mmax, tmax } = state;

    // 1. Resolver analíticamente y con RK4
    const rk4Result = solveRK4(lambda, alpha, q0, tmax, 120);

    const analyticQueueData = [];
    const rk4QueueData = [];
    const ramData = [];
    let maxRk4Error = 0;

    for (let i = 0; i < rk4Result.timePoints.length; i++) {
      const t = rk4Result.timePoints[i];
      const qAnalytic = calculateAnalyticQueue(t, lambda, alpha, q0);
      const qRk4 = rk4Result.qPoints[i];
      const mVal = calculateRAM(qAnalytic, mbase, mr);

      analyticQueueData.push({ x: t, y: qAnalytic });
      rk4QueueData.push({ x: t, y: qRk4 });
      ramData.push({ x: t, y: mVal });

      const err = Math.abs(qAnalytic - qRk4);
      if (err > maxRk4Error) {
        maxRk4Error = err;
      }
    }

    // 2. Actualizar KPIs del encabezado
    dom.kpiTau.innerHTML = `${metrics.tau.toFixed(2)} <span class="kpi-unit">s</span>`;
    dom.kpiQss.innerHTML = `${Math.round(metrics.q_ss).toLocaleString()} <span class="kpi-unit">req</span>`;
    dom.kpiTs.innerHTML = `${metrics.t_s.toFixed(2)} <span class="kpi-unit">s</span>`;
    dom.kpiMpeak.innerHTML = `${Math.round(metrics.m_peak).toLocaleString()} <span class="kpi-unit">MB</span>`;
    dom.kpiMpeakGb.innerText = `(${(metrics.m_peak / 1024).toFixed(2)} GB)`;

    // Actualizar referencias en la tarjeta de Python
    if (pyDom.jsValQss) pyDom.jsValQss.innerText = `${Math.round(metrics.q_ss).toLocaleString()} req`;
    if (pyDom.jsValTs) {
      const qAtTs = calculateAnalyticQueue(metrics.t_s, lambda, alpha, q0);
      pyDom.jsValTs.innerText = `${qAtTs.toFixed(2)} req`;
    }

    // KPI RK4 Error
    dom.kpiRk4Error.innerHTML = `${maxRk4Error.toExponential(2)} <span class="kpi-unit">req</span>`;

    // KPI Margen de Seguridad & Estado
    if (metrics.isSafe) {
      dom.kpiStatus.innerText = 'SISTEMA SEGURO';
      dom.kpiStatusSub.innerText = 'Operación dentro de límites de RAM';
      dom.cardStatus.className = 'kpi-card status-card status-safe';
      dom.statusIcon.innerText = '🛡️';
      dom.globalDot.className = 'server-status-dot pulse-active';

      dom.kpiSafetyMb.innerHTML = `+${Math.round(metrics.safetyMarginMb).toLocaleString()} <span class="kpi-unit">MB</span>`;
      dom.kpiSafetyMb.className = 'kpi-main-val text-emerald';
      dom.kpiSafetyPct.innerText = `${metrics.safetyMarginPct.toFixed(1)}% de RAM libre en régimen permanente`;
    } else {
      dom.kpiStatus.innerText = '🚨 COLAPSO (OOM)';
      dom.kpiStatusSub.innerText = 'Riesgo inminente de caída por RAM';
      dom.cardStatus.className = 'kpi-card status-card status-danger';
      dom.statusIcon.innerText = '🔥';
      dom.globalDot.className = 'server-status-dot status-critical';

      dom.kpiSafetyMb.innerHTML = `-${Math.round(Math.abs(metrics.safetyMarginMb)).toLocaleString()} <span class="kpi-unit">MB</span>`;
      dom.kpiSafetyMb.className = 'kpi-main-val text-danger';
      dom.kpiSafetyPct.innerText = `Déficit de ${Math.abs(metrics.safetyMarginPct).toFixed(1)}% sobre RAM física instalada`;
    }

    // 3. Actualizar Anotaciones y Datos en Gráfica 1 (Cola)
    chartQueue.data.datasets[0].data = analyticQueueData;
    chartQueue.data.datasets[1].data = rk4QueueData;

    const annQ = chartQueue.options.plugins.annotation.annotations;
    annQ.lineQss.value = metrics.q_ss;
    annQ.lineQss.label.content = `q_ss = ${Math.round(metrics.q_ss).toLocaleString()} req`;

    annQ.lineTs.value = metrics.t_s;
    annQ.lineTs.label.content = `t_s = 4τ = ${metrics.t_s.toFixed(2)}s (98%)`;
    chartQueue.options.scales.x.max = tmax;
    chartQueue.options.scales.y.max = Math.ceil(Math.max(metrics.q_ss, q0) * 1.15 / 100) * 100;

    chartQueue.update();

    // 4. Actualizar Anotaciones y Datos en Gráfica 2 (RAM)
    chartRAM.data.datasets[0].data = ramData;

    const annRAM = chartRAM.options.plugins.annotation.annotations;
    annRAM.lineMmax.value = mmax;
    annRAM.lineMmax.label.content = `LÍMITE FÍSICO M_max = ${mmax.toLocaleString()} MB`;

    annRAM.lineMpeak.value = metrics.m_peak;
    annRAM.lineMpeak.label.content = `M_peak = ${Math.round(metrics.m_peak).toLocaleString()} MB`;

    if (metrics.isSafe) {
      chartRAM.data.datasets[0].borderColor = '#10b981';
      chartRAM.data.datasets[0].backgroundColor = 'rgba(16, 185, 129, 0.12)';
      annRAM.lineMpeak.borderColor = '#10b981';
      annRAM.boxSafetyMargin.backgroundColor = 'rgba(16, 185, 129, 0.08)';
      annRAM.boxSafetyMargin.yMin = metrics.m_peak;
      annRAM.boxSafetyMargin.yMax = mmax;
    } else {
      chartRAM.data.datasets[0].borderColor = '#ef4444';
      chartRAM.data.datasets[0].backgroundColor = 'rgba(239, 68, 68, 0.18)';
      annRAM.lineMpeak.borderColor = '#f87171';
      annRAM.boxSafetyMargin.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      annRAM.boxSafetyMargin.yMin = mmax;
      annRAM.boxSafetyMargin.yMax = metrics.m_peak;
    }

    chartRAM.options.scales.x.max = tmax;
    const maxYRAM = Math.max(mmax, metrics.m_peak) * 1.15;
    chartRAM.options.scales.y.max = Math.ceil(maxYRAM / 1024) * 1024;

    chartRAM.update();

    // 5. Actualizar Gauge de RAM en tiempo real
    updateLiveGauge(state.simTime);
  }

  // --------------------------------------------------------------------------
  // 6. SIMULACIÓN ANIMADA EN TIEMPO REAL
  // --------------------------------------------------------------------------
  function updateLiveGauge(currentTime) {
    const { lambda, alpha, q0, mr, mbase, mmax } = state;
    const currentQ = calculateAnalyticQueue(currentTime, lambda, alpha, q0);
    const currentM = calculateRAM(currentQ, mbase, mr);

    const ramPct = Math.min(100, (currentM / mmax) * 100);

    dom.liveTime.innerText = `t = ${currentTime.toFixed(2)} s`;
    dom.gaugeLabelCurrent.innerText = `M(t): ${Math.round(currentM).toLocaleString()} MB`;
    dom.gaugeLabelMax.innerText = `${mmax.toLocaleString()} MB`;
    dom.gaugeFill.style.width = `${ramPct}%`;

    if (currentM > mmax) {
      dom.gaugeFill.style.background = '#ef4444';
      dom.gaugeLegend.innerText = `⚠️ CRÍTICO: ${ramPct.toFixed(1)}% (Saturación de RAM superada)`;
      dom.gaugeLegend.className = 'gauge-status-text text-danger';
    } else if (ramPct > 80) {
      dom.gaugeFill.style.background = '#f59e0b';
      dom.gaugeLegend.innerText = `Carga elevada: ${ramPct.toFixed(1)}% de RAM utilizada`;
      dom.gaugeLegend.className = 'gauge-status-text';
    } else {
      dom.gaugeFill.style.background = 'linear-gradient(90deg, #10b981 0%, #34d399 100%)';
      dom.gaugeLegend.innerText = `Carga normal: ${ramPct.toFixed(1)}% de RAM utilizada`;
      dom.gaugeLegend.className = 'gauge-status-text';
    }

    // Actualizar marcadores de posición en vivo en los gráficos
    if (chartQueue && chartRAM) {
      chartQueue.data.datasets[2].data = [{ x: currentTime, y: currentQ }];
      chartRAM.data.datasets[1].data = [{ x: currentTime, y: currentM }];
      chartQueue.update('none');
      chartRAM.update('none');
    }
  }

  function simStep(timestamp) {
    if (!state.simulating) return;

    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const deltaMs = timestamp - state.lastTimestamp;
    state.lastTimestamp = timestamp;

    state.simTime += (deltaMs / 1000) * state.simSpeed;

    if (state.simTime >= state.tmax) {
      state.simTime = state.tmax;
      updateLiveGauge(state.simTime);
      pauseSimulation();
      return;
    }

    updateLiveGauge(state.simTime);
    state.animFrameId = requestAnimationFrame(simStep);
  }

  function startSimulation() {
    if (state.simTime >= state.tmax) {
      state.simTime = 0;
    }
    state.simulating = true;
    state.lastTimestamp = null;
    dom.btnToggleSim.classList.add('playing');
    dom.btnPlayIcon.innerText = '⏸';
    dom.btnPlayText.innerText = 'Pausar Animación';
    state.animFrameId = requestAnimationFrame(simStep);
  }

  function pauseSimulation() {
    state.simulating = false;
    dom.btnToggleSim.classList.remove('playing');
    dom.btnPlayIcon.innerText = '▶';
    dom.btnPlayText.innerText = 'Reanudar Animación';
    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }
  }

  function resetSimulation() {
    pauseSimulation();
    state.simTime = 0;
    dom.btnPlayText.innerText = 'Iniciar Animación';
    updateLiveGauge(0);
  }

  // --------------------------------------------------------------------------
  // 7. VINCULACIÓN BIDIRECCIONAL DE CONTROLES (Sliders + Inputs)
  // --------------------------------------------------------------------------
  function bindParam(key, min, max, step) {
    const pair = dom[key];
    if (!pair) return;

    const syncValue = (val) => {
      let numVal = parseFloat(val);
      if (isNaN(numVal)) numVal = min;
      numVal = Math.max(min, Math.min(max, numVal));

      state[key] = numVal;
      pair.range.value = numVal;
      pair.num.value = numVal;

      updateDashboard();
    };

    pair.range.addEventListener('input', (e) => syncValue(e.target.value));
    pair.num.addEventListener('input', (e) => syncValue(e.target.value));
    pair.num.addEventListener('change', (e) => syncValue(e.target.value));
  }

  function initControls() {
    bindParam('lambda', 50, 4000, 10);
    bindParam('alpha', 0.05, 3.0, 0.05);
    bindParam('q0', 0, 1500, 10);
    bindParam('mr', 0.5, 16.0, 0.25);
    bindParam('mbase', 256, 4096, 128);
    bindParam('mmax', 1024, 32768, 512);
    bindParam('tmax', 5, 60, 1);

    // Botón de toggle de animación
    dom.btnToggleSim.addEventListener('click', () => {
      if (state.simulating) {
        pauseSimulation();
      } else {
        startSimulation();
      }
    });

    dom.btnResetSim.addEventListener('click', resetSimulation);

    dom.selectSpeed.addEventListener('change', (e) => {
      state.simSpeed = parseFloat(e.target.value) || 1.0;
    });

    // Reset a defaults
    dom.btnResetParams.addEventListener('click', () => {
      setPreset({
        lambda: 500,
        alpha: 0.5,
        q0: 0,
        mr: 4.0,
        mbase: 1024,
        mmax: 8192,
        tmax: 20
      });
    });

    // Preset 1: Nominal
    dom.btnNominal.addEventListener('click', () => {
      setPreset({
        lambda: 500,
        alpha: 0.5,
        q0: 0,
        mr: 4.0,
        mbase: 1024,
        mmax: 8192,
        tmax: 20
      });
    });

    // Preset 2: Crisis / Colapso
    dom.btnCrisis.addEventListener('click', () => {
      setPreset({
        lambda: 2000, // Avalancha severa que causa M_peak = 17024 MB > 8192 MB
        alpha: 0.5,
        q0: 0,
        mr: 4.0,
        mbase: 1024,
        mmax: 8192,
        tmax: 20
      });
    });

    // Preset 3: Alta Concurrencia Optimizado
    dom.btnOpt.addEventListener('click', () => {
      setPreset({
        lambda: 1500,
        alpha: 1.2,
        q0: 0,
        mr: 2.0,
        mbase: 1024,
        mmax: 8192,
        tmax: 15
      });
    });
  }

  function setPreset(params) {
    Object.assign(state, params);
    for (const key in params) {
      if (dom[key]) {
        dom[key].range.value = params[key];
        dom[key].num.value = params[key];
      }
    }
    resetSimulation();
    updateDashboard();
  }

  // --------------------------------------------------------------------------
  // 8. TABS DE MATEMÁTICAS & RENDERIZADO KATEX
  // --------------------------------------------------------------------------
  function initMathTabs() {
    dom.mathTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-tab');

        dom.mathTabs.forEach(t => t.classList.remove('active'));
        dom.mathContents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
          targetContent.classList.add('active');
        }

        renderKaTeX();
      });
    });
  }

  function renderKaTeX() {
    if (window.renderMathInElement) {
      window.renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }
  }

  // --------------------------------------------------------------------------
  // 10. VERIFICACIÓN SIMBÓLICA EN PYTHON (SYMPY VIA PYODIDE)
  // --------------------------------------------------------------------------
  let pyodideInstance = null;
  let isPyodideLoading = false;

  const pyDom = {
    btnRun: document.getElementById('btn-run-python'),
    loadingBar: document.getElementById('python-loading-bar'),
    loadingText: document.getElementById('py-loading-text'),
    statusTag: document.getElementById('py-status-tag'),
    execTime: document.getElementById('py-exec-time'),
    formulaOut: document.getElementById('py-formula-out'),
    valQss: document.getElementById('py-val-qss'),
    valTs: document.getElementById('py-val-ts'),
    jsValQss: document.getElementById('js-val-qss'),
    jsValTs: document.getElementById('js-val-ts'),
    matchBanner: document.getElementById('py-match-banner'),
    matchMsg: document.getElementById('py-match-msg'),
    btnCopyPy: document.getElementById('btn-copy-py'),
    codeDisplay: document.getElementById('py-code-display')
  };

  async function runPythonVerification() {
    if (isPyodideLoading) return;

    pyDom.btnRun.disabled = true;
    pyDom.loadingBar.style.display = 'flex';
    pyDom.matchBanner.className = 'py-match-banner';
    pyDom.matchMsg.innerText = 'Ejecutando script de SymPy en WebAssembly...';

    const startTime = performance.now();

    try {
      // 1. Inicializar Pyodide y SymPy la primera vez
      if (!pyodideInstance) {
        pyDom.loadingText.innerText = 'Inicializando Pyodide (Python 3.12 WebAssembly)...';
        pyDom.statusTag.innerText = 'Cargando Pyodide...';
        pyodideInstance = await loadPyodide();

        pyDom.loadingText.innerText = 'Descargando paquete SymPy (~5 MB por única vez)...';
        pyDom.statusTag.innerText = 'Instalando SymPy...';
        await pyodideInstance.loadPackage('sympy');
      }

      pyDom.statusTag.innerText = 'Python 3.12 + SymPy (Activo)';
      pyDom.loadingText.innerText = 'Resolviendo EDO simbólicamente con SymPy dsolve...';

      // 2. Parámetros actuales para sustitución
      const lambdaVal = state.lambda;
      const alphaVal = state.alpha;
      const q0Val = state.q0;
      const tsVal = (4 / state.alpha);

      // 3. Código Python a ejecutar
      const pythonScript = `
import sympy as sp
import json

# Símbolos y función
t, alpha, lam0, q0 = sp.symbols('t alpha lambda0 q0', positive=True)
q = sp.Function('q')

# EDO: dq/dt + alpha*q = lam0 con condición inicial q(0) = q0
edo = sp.Eq(q(t).diff(t) + alpha*q(t), lam0)

# Resolución simbólica directa e independiente
solucion = sp.dsolve(edo, q(t), ics={q(0): q0})
q_t_simbolico = sp.simplify(solucion.rhs)

# Sustitución de valores numéricos del caso de estudio
valores = {lam0: ${lambdaVal}, alpha: sp.Rational(${Math.round(alphaVal * 100)}, 100), q0: ${q0Val}}
q_t_numerico = q_t_simbolico.subs(valores)
q_t_lambda = sp.lambdify(t, q_t_numerico, 'numpy')

# Evaluación en régimen permanente (t -> oo) y en t = t_s (98%)
q_ss_calc = sp.limit(q_t_numerico, t, sp.oo)
q_ts_calc = q_t_lambda(${tsVal.toFixed(4)})

res = json.dumps({
    "q_t_str": str(q_t_simbolico),
    "q_t_latex": sp.latex(q_t_simbolico),
    "q_ss": float(q_ss_calc),
    "q_ts": float(q_ts_calc)
})
res
`;

      const rawResult = await pyodideInstance.runPythonAsync(pythonScript);
      const res = JSON.parse(rawResult);

      const endTime = performance.now();
      const elapsedMs = Math.round(endTime - startTime);
      pyDom.execTime.innerText = `${elapsedMs} ms`;

      // 4. Mostrar resultados simbólicos en LaTeX
      pyDom.formulaOut.innerHTML = `$$q(t) = ${res.q_t_latex}$$`;

      // 5. Comparar valores numéricos
      const jsQss = state.lambda / state.alpha;
      const jsQts = calculateAnalyticQueue(tsVal, state.lambda, state.alpha, state.q0);

      pyDom.valQss.innerText = `${Math.round(res.q_ss).toLocaleString()} req`;
      pyDom.valTs.innerText = `${res.q_ts.toFixed(2)} req`;
      pyDom.jsValQss.innerText = `${Math.round(jsQss).toLocaleString()} req`;
      pyDom.jsValTs.innerText = `${jsQts.toFixed(2)} req`;

      const diffQss = Math.abs(res.q_ss - jsQss);
      const diffTs = Math.abs(res.q_ts - jsQts);

      if (diffQss < 0.05 && diffTs < 0.05) {
        pyDom.matchBanner.className = 'py-match-banner success';
        pyDom.matchMsg.innerHTML = `✓ <strong>Verificación exitosa:</strong> SymPy (Python) resolvió $q(t)$ simbólicamente y coincide al 100% con la solución de Laplace y JavaScript.`;
      } else {
        pyDom.matchBanner.className = 'py-match-banner';
        pyDom.matchMsg.innerText = `Solución ejecutada. Diferencia de orden: ${(diffQss + diffTs).toExponential(2)}`;
      }

      renderKaTeX();

    } catch (err) {
      console.error('Error al ejecutar Pyodide:', err);
      pyDom.statusTag.innerText = 'Error en Python';
      pyDom.matchBanner.className = 'py-match-banner';
      pyDom.matchMsg.innerText = `Error al ejecutar SymPy: ${err.message || err}`;
    } finally {
      pyDom.btnRun.disabled = false;
      pyDom.loadingBar.style.display = 'none';
    }
  }

  function initPythonSection() {
    if (!pyDom.btnRun) return;

    pyDom.btnRun.addEventListener('click', runPythonVerification);

    if (pyDom.btnCopyPy) {
      pyDom.btnCopyPy.addEventListener('click', () => {
        const codeText = pyDom.codeDisplay.innerText;
        navigator.clipboard.writeText(codeText).then(() => {
          pyDom.btnCopyPy.innerText = '✓ ¡Copiado!';
          setTimeout(() => { pyDom.btnCopyPy.innerText = '📋 Copiar'; }, 2000);
        });
      });
    }
  }

  // --------------------------------------------------------------------------
  // 11. TOUR INTERACTIVO / TUTORIAL GUIADO (HUD NO INTRUSIVO)
  // --------------------------------------------------------------------------
  const tourSteps = [
    {
      target: '.scenario-presets',
      title: '1. 🚀 Escenarios Rápidos Preconfigurados',
      body: 'Permite alternar al instante entre condiciones normales (Nominal Seguro), sobrecarga crítica de memoria (Escenario de Crisis) y servidor optimizado de alta concurrencia.',
      hint: 'Prueba haciendo clic en "Escenario de Crisis" para ver cómo el sistema detecta el colapso.'
    },
    {
      target: '.kpi-grid',
      title: '2. 📊 Panel de Indicadores Clave (KPIs)',
      body: 'Muestra en tiempo real el estado del clúster (SEGURO vs COLAPSO), la constante inercial (τ = 1/α), el tiempo al 98% (ts = 4τ), la memoria pico (M_peak) y el error numérico exacto de Runge-Kutta 4.',
      hint: 'El error RK4 es menor a 10⁻⁵, confirmando la exactitud de la solución analítica de Laplace.'
    },
    {
      target: '.sidebar-panel .params-form',
      title: '3. ⚙️ Parámetros del Sistema (Sliders & Inputs)',
      body: 'Ajusta la tasa de llegada (λ₀), capacidad de drenaje (α), cola inicial (q₀), RAM por request (m_r) y la memoria física del host (M_max). Al mover cualquier valor, todo se recalcula en tiempo real.',
      hint: 'Puedes arrastrar cualquier slider o escribir directamente en las cajas numéricas.'
    },
    {
      target: '.sim-player-card',
      title: '4. ⏱️ Simulación Animada y Medidor de RAM',
      body: 'Haz clic en "Iniciar Animación" para ver el avance continuo de t = 0 a t_max. El medidor Gauge se llena y cambia de color (verde/ámbar/rojo) según el porcentaje de RAM física utilizada.',
      hint: 'Puedes ajustar la velocidad de reproducción a 0.5x, 1x, 2x o 4x.'
    },
    {
      target: '.charts-container',
      title: '5. 📈 Gráficas de Longitud de Cola y Memoria RAM',
      body: 'La Gráfica 1 superpone la solución analítica de Laplace con los puntos RK4 y marca ts (98%). La Gráfica 2 muestra la curva de RAM M(t), el límite físico M_max y el área sombreada del margen de seguridad.',
      hint: 'Pasa el cursor sobre las curvas para ver los valores exactos en cada segundo.'
    },
    {
      target: '#python-verification-card',
      title: '6. 🐍 Verificación Simbólica en Python (SymPy)',
      body: 'Ejecuta Python real con SymPy vía WebAssembly/Pyodide directamente en tu navegador para resolver la EDO simbólicamente de forma independiente.',
      hint: 'Haz clic en "▶ Ejecutar Verificación en Python" para resolver la ecuación con SymPy.'
    },
    {
      target: '.math-section',
      title: '7. 📐 Desarrollo Matemático y Guía de Uso',
      body: 'Sección formal con fórmulas LaTeX (KaTeX): deducción de la EDO, transformada Q(s), fracciones parciales, regla práctica 4τ, algoritmo RK4, teoremas de límites y guía rápida.',
      hint: 'Haz clic en las pestañas para explorar cada demostración paso a paso.'
    }
  ];

  let currentTourStep = 0;

  const tourDom = {
    hud: document.getElementById('tour-hud'),
    badge: document.getElementById('tour-step-badge'),
    title: document.getElementById('tour-title'),
    body: document.getElementById('tour-body'),
    hint: document.getElementById('tour-hint'),
    indicators: document.getElementById('tour-indicators'),
    btnClose: document.getElementById('tour-btn-close'),
    btnPrev: document.getElementById('tour-btn-prev'),
    btnNext: document.getElementById('tour-btn-next'),
    btnStart: document.getElementById('btn-start-tour')
  };

  function initTour() {
    if (!tourDom.btnStart) return;

    // Crear indicadores de puntos
    tourDom.indicators.innerHTML = '';
    tourSteps.forEach((_, idx) => {
      const dot = document.createElement('div');
      dot.className = `tour-dot ${idx === 0 ? 'active' : ''}`;
      dot.addEventListener('click', () => {
        currentTourStep = idx;
        renderTourStep(currentTourStep);
      });
      tourDom.indicators.appendChild(dot);
    });

    tourDom.btnStart.addEventListener('click', startTour);
    tourDom.btnClose.addEventListener('click', closeTour);
    tourDom.btnPrev.addEventListener('click', prevTourStep);
    tourDom.btnNext.addEventListener('click', nextTourStep);
  }

  function startTour() {
    currentTourStep = 0;
    tourDom.hud.classList.add('active');
    renderTourStep(currentTourStep);
  }

  function closeTour() {
    tourDom.hud.classList.remove('active');
    clearTourFocus();
  }

  function clearTourFocus() {
    document.querySelectorAll('.tour-target-focus').forEach(el => el.classList.remove('tour-target-focus'));
  }

  function renderTourStep(stepIdx) {
    clearTourFocus();
    const step = tourSteps[stepIdx];
    if (!step) return;

    tourDom.badge.innerText = `Paso ${stepIdx + 1} de ${tourSteps.length}`;
    tourDom.title.innerText = step.title;
    tourDom.body.innerText = step.body;
    tourDom.hint.innerHTML = `💡 <strong>Tip:</strong> ${step.hint}`;

    // Actualizar botones
    tourDom.btnPrev.style.display = stepIdx === 0 ? 'none' : 'inline-block';
    tourDom.btnNext.innerText = stepIdx === tourSteps.length - 1 ? 'Finalizar 🎉' : 'Siguiente';

    // Actualizar dots
    const dots = tourDom.indicators.querySelectorAll('.tour-dot');
    dots.forEach((dot, idx) => {
      dot.className = `tour-dot ${idx === stepIdx ? 'active' : ''}`;
    });

    // Resaltar elemento objetivo y desplazarlo al centro
    const targetEl = document.querySelector(step.target);
    if (targetEl) {
      targetEl.classList.add('tour-target-focus');
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function nextTourStep() {
    if (currentTourStep < tourSteps.length - 1) {
      currentTourStep++;
      renderTourStep(currentTourStep);
    } else {
      closeTour();
    }
  }

  function prevTourStep() {
    if (currentTourStep > 0) {
      currentTourStep--;
      renderTourStep(currentTourStep);
    }
  }

  // --------------------------------------------------------------------------
  // 12. INICIALIZACIÓN DE LA APLICACIÓN
  // --------------------------------------------------------------------------
  initCharts();
  initControls();
  initMathTabs();
  initPythonSection();
  initTour();
  updateDashboard();

  // Renderizar fórmulas con KaTeX una vez cargadas las librerías
  setTimeout(() => {
    renderKaTeX();
  }, 200);

});
