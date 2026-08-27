# Dashboard de Simulación: Modelo de Cola de Peticiones con Transformada de Laplace & Verificación RK4

> **Trabajo Universitario de Matemáticas Especiales**  
> Simulación Dinámica y Análisis de Capacidad de un Servidor Web (Nginx / Node.js) bajo Avalancha de Tráfico.

---

## 📌 Descripción del Proyecto

Esta aplicación web interactiva (Single-Page Application) modela el comportamiento transitorio y estacionario de la cola de peticiones $q(t)$ y el consumo de memoria RAM $M(t)$ de un servidor web ante un pico súbito de tráfico modelado mediante una función escalón de Heaviside $u(t)$.

El sistema está desarrollado en **HTML5 + CSS3 + JavaScript puro** (sin backend ni dependencias de compilación), listo para su despliegue inmediato en **GitHub Pages**.

---

## 📐 Modelo Matemático

### 1. Ecuación Diferencial Ordinaria (EDO)
Balance de flujo en el buffer del servidor:
$$\frac{dq(t)}{dt} + \alpha \cdot q(t) = \lambda_0 \cdot u(t), \quad q(0) = q_0 = 0$$

- $\lambda_0$: Tasa de llegada de peticiones en avalancha ($\text{req/s}$)
- $\alpha$: Coeficiente de evacuación / servicio del servidor ($\text{s}^{-1}$)
- $u(t)$: Función escalón unitario de Heaviside

### 2. Solución Analítica vía Transformada de Laplace
Aplicando la transformada $\mathcal{L}\{\cdot\}$ con la propiedad de la derivada:
$$s Q(s) - q(0) + \alpha Q(s) = \frac{\lambda_0}{s} \implies Q(s) = \frac{\lambda_0}{s(s+\alpha)}$$

Descomponiendo en fracciones parciales y aplicando la antitransformada $\mathcal{L}^{-1}\{\cdot\}$:
$$q(t) = \frac{\lambda_0}{\alpha} \left( 1 - e^{-\alpha t} \right) + q_0 e^{-\alpha t}$$

### 3. Modelo de Memoria RAM
$$M(t) = M_{\text{base}} + m_r \cdot q(t)$$

### 4. Métricas Clave y Regla Práctica de Control
- **Constante de tiempo:** $\tau = \frac{1}{\alpha}$ $[\text{s}]$
- **Cola en estado estacionario:** $q_{ss} = \lim_{t\to\infty} q(t) = \frac{\lambda_0}{\alpha}$ $[\text{req}]$
- **Tiempo de establecimiento al 98% (Regla estándar $4\tau$):**
  $$t_s = 4\tau = \frac{4}{\alpha} \quad [\text{s}]$$
  *(Evaluación analítica: $q(4\tau) = q_{ss}(1 - e^{-4}) \approx 98.17\% \cdot q_{ss}$)*
- **Memoria pico:** $M_{\text{peak}} = M_{\text{base}} + m_r \cdot \left(\frac{\lambda_0}{\alpha}\right)$ $[\text{MB}]$
- **Margen de seguridad:** $\Delta M = M_{\text{max}} - M_{\text{peak}}$ $[\text{MB}]$

### 5. Verificación Numérica mediante Runge-Kutta 4to Orden (RK4)
El integrador numérico implementado en JavaScript resuelve paso a paso:
$$f(t, q) = \lambda_0 - \alpha \cdot q(t)$$
Comparando la solución analítica con la numérica y reportando el **error máximo absoluto**:
$$E_{\max} = \max_{0 \le t \le t_{\max}} |q_{\text{analítico}}(t) - q_{\text{RK4}}(t)| \approx 10^{-5} \text{ req}$$

---

## 🚀 Características del Dashboard

1. **Panel de Control Reactivo:** Sliders e inputs sincronizados para los 7 parámetros ($\lambda_0, \alpha, q_0, m_r, M_{\text{base}}, M_{\text{max}}, t_{\text{max}}$).
2. **Gráfica 1 — $q(t)$ vs $t$:** Curva analítica, verificación por puntos RK4, asíntota $q_{ss}$ y marcador $t_s (98\%)$.
3. **Gráfica 2 — $M(t)$ vs $t$:** Curva de RAM, límite físico $M_{\text{max}}$, asíntota $M_{\text{peak}}$ y zona sombreada de margen de seguridad.
4. **Simulación Animada en Tiempo Real:** Gauge interactivo con semáforo de alerta y marcador dinámico a lo largo de las curvas.
5. **Botones de Escenarios Rápidos:**
   - 🟢 *Nominal (Seguro)*: Servidor con margen holgado de RAM.
   - 🚨 *Escenario de Crisis*: Simula sobrecarga severa ($\lambda_0 = 2000$) y alerta de colapso por saturación de RAM ($M_{\text{peak}} > M_{\text{max}}$).
   - ⚡ *Alta Concurrencia*: Servidor optimizado con alta tasa de drenaje y bajo consumo por request.
6. **Panel Teórico con KaTeX:** Fórmulas matemáticas completas en LaTeX con demostraciones, fracciones parciales, y teoremas de valor inicial y final.

---

## 📁 Estructura del Repositorio

```text
/servidor-buffer-dashboard
  ├── index.html       # Estructura semántica del dashboard y enlaces CDN
  ├── style.css        # Diseño moderno Dark Mode (estética Datadog / Grafana)
  ├── script.js        # Lógica matemática (Laplace, RK4, animación y Chart.js)
  └── README.md        # Documentación técnica y guía de despliegue
```

---

## 🌐 Instrucciones de Despliegue en GitHub Pages

Para publicar este proyecto de forma 100% gratuita:

1. Crea un nuevo repositorio en tu cuenta de GitHub (ejemplo: `servidor-buffer-dashboard`).
2. Sube los archivos `index.html`, `style.css`, `script.js` y `README.md` a la rama `main` (o `master`).
3. En el repositorio de GitHub, ve a **Settings** (Configuración) → pestaña **Pages** (a la izquierda).
4. En **Build and deployment**:
   - **Source:** *Deploy from a branch*
   - **Branch:** Selecciona `main` / `root`
   - Haz clic en **Save**.
5. En 1-2 minutos tu dashboard estará en línea en:
   `https://<tu-usuario>.github.io/<tu-repositorio>/`

---

## 🧪 Librerías Utilizadas (vía CDN)
- [Chart.js v4.4.1](https://www.chartjs.org/) + [chartjs-plugin-annotation v3.0.1](https://www.chartjs.org/chartjs-plugin-annotation/)
- [KaTeX v0.16.9](https://katex.org/) (Renderizado de fórmulas en LaTeX)
- [Google Fonts](https://fonts.google.com/) (Inter & JetBrains Mono)
