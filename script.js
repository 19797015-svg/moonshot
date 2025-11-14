
const EMAILJS_CONFIG = {
    PUBLIC_KEY: 'j_0IQa3swAXcaU1ip',
    SERVICE_ID: 'service_8eia2oi',
    TEMPLATE_VERIFICACION: 'moonshot_verificacion',
    TEMPLATE_SOLICITUDES: 'moonshot_solicitudes'
};


let isEmailJSInitialized = false;
let codigoVerificacion = null;
let temporizadorVerificacion = null;
let tiempoRestante = 300;
let emailVerificado = null;


function inicializarEmailJS() {
    try {
        if (typeof emailjs === 'undefined') {
            console.error('❌ EmailJS SDK no está cargado');
            mostrarNotificacion('Error: EmailJS no está cargado. Recarga la página.', 'error');
            return false;
        }
        
        console.log('🔄 Inicializando EmailJS con PUBLIC_KEY:', EMAILJS_CONFIG.PUBLIC_KEY);
        emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
        isEmailJSInitialized = true;
        console.log('✅ EmailJS inicializado correctamente');
        return true;
    } catch (error) {
        console.error('❌ Error inicializando EmailJS:', error);
        mostrarNotificacion('Error al inicializar EmailJS: ' + error.message, 'error');
        isEmailJSInitialized = false;
        return false;
    }
}

document.querySelectorAll('.nav-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
        
        button.classList.add('active');
        const target = button.getAttribute('data-target');
        const targetSection = document.getElementById(target);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    });
});


document.getElementById('btn-enviar-codigo').addEventListener('click', async function() {
    if (!verificarEmailJSCargado()) return;
    
    const email = document.getElementById('email-verificacion').value.trim();
    
    if (!email || !validarEmail(email)) {
        mostrarErrorCampo('error-email-verificacion', 'Por favor, ingresa un correo electrónico válido');
        return;
    }
    
    await enviarCodigoVerificacion(email);
});

async function enviarCodigoVerificacion(email) {
    const btnEnviar = document.getElementById('btn-enviar-codigo');
    const originalText = btnEnviar.textContent;
    
    try {
        btnEnviar.textContent = 'Generando código...';
        btnEnviar.disabled = true;
        
        codigoVerificacion = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`🔐 Código generado para ${email}: ${codigoVerificacion}`);
       
        const templateParams = {
            to_email: email,
            codigo_verificacion: codigoVerificacion,
            fecha: obtenerFechaActual()
        };

        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_VERIFICACION,
            templateParams
        );
        
        document.getElementById('codigo-container').style.display = 'block';
        document.getElementById('btn-reenviar-codigo').style.display = 'none';
        
        iniciarTemporizador();
        mostrarNotificacion('✅ Código de verificación enviado a tu correo', 'success');
        
    } catch (error) {
        console.error('❌ Error al enviar código:', error);
        mostrarNotificacion('Error al enviar el código. Inténtalo de nuevo.', 'error');
    } finally {
        btnEnviar.textContent = originalText;
        btnEnviar.disabled = false;
    }
}



document.getElementById('prestamo-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!verificarEmailJSCargado()) return;
    
    if (!emailVerificado) {
        mostrarNotificacion('Por favor, verifica tu correo electrónico primero', 'error');
        return;
    }
    
    const publicKey = document.getElementById('public-key-prestamo').value.trim();
    const cantidad = document.getElementById('cantidad-prestamo').value.trim();
    
    if (!validarFormularioPrestamo(publicKey, cantidad)) return;
    
    await enviarSolicitudPrestamo(emailVerificado, publicKey, cantidad);
});

async function enviarSolicitudPrestamo(email, publicKey, cantidad) {
    const form = document.getElementById('prestamo-form');
    const submitBtn = document.getElementById('btn-enviar-prestamo');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.textContent = 'Enviando...';
        submitBtn.disabled = true;
        
       
        const templateParams = {
            from_email: email,
            public_key: publicKey,
            cantidad: cantidad,
            tipo_solicitud: 'prestamo',
            fecha: obtenerFechaActual()
        };

        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_SOLICITUDES,
            templateParams
        );
        
        document.getElementById('success-prestamo').style.display = 'block';
        form.reset();
        
        setTimeout(() => {
            resetearVerificacion();
        }, 5000);
        
    } catch (error) {
        console.error('❌ Error al enviar préstamo:', error);
        mostrarNotificacion('Error al enviar la solicitud. Inténtalo de nuevo.', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}


document.getElementById('p2p-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!verificarEmailJSCargado()) return;
    
    const publicKeyDestino = document.getElementById('public-key-destino').value.trim();
    const cantidadSatoshis = document.getElementById('cantidad-satoshis').value.trim();
    
    if (!validarFormularioP2P(publicKeyDestino, cantidadSatoshis)) return;
    
    await enviarTransaccionP2P(publicKeyDestino, cantidadSatoshis);
});

async function enviarTransaccionP2P(publicKeyDestino, cantidadSatoshis) {
    const form = document.getElementById('p2p-form');
    const submitBtn = form.querySelector('.btn');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.textContent = 'Enviando...';
        submitBtn.disabled = true;
        
        
        const templateParams = {
            public_key_destino: publicKeyDestino,
            cantidad_satoshis: cantidadSatoshis,
            tipo_solicitud: 'p2p',
            fecha: obtenerFechaActual()
        };

        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_SOLICITUDES,
            templateParams
        );
        
        mostrarNotificacion('¡Solicitud enviada correctamente! Ahora realiza el depósito.', 'success');
        document.getElementById('public-key-container').style.display = 'block';
        form.reset();
        
    } catch (error) {
        console.error('❌ Error al enviar P2P:', error);
        mostrarNotificacion('Error al enviar la transacción. Inténtalo de nuevo.', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}


function verificarEmailJSCargado() {
    return typeof emailjs !== 'undefined' && isEmailJSInitialized;
}

document.getElementById('btn-verificar-codigo').addEventListener('click', function() {
    const codigoIngresado = document.getElementById('codigo-verificacion').value.trim();
    verificarCodigo(codigoIngresado);
});

document.getElementById('btn-reenviar-codigo').addEventListener('click', async function() {
    const email = document.getElementById('email-verificacion').value.trim();
    if (email && validarEmail(email)) {
        await enviarCodigoVerificacion(email);
    }
});

function verificarCodigo(codigoIngresado) {
    if (!codigoIngresado || codigoIngresado.length !== 6) {
        mostrarErrorCampo('error-codigo-verificacion', 'Por favor, ingresa el código de 6 dígitos');
        return;
    }
    
    if (codigoIngresado === codigoVerificacion) {
        emailVerificado = document.getElementById('email-verificacion').value.trim();
        detenerTemporizador();
        
        document.getElementById('paso-verificacion').style.display = 'none';
        document.getElementById('prestamo-form').style.display = 'block';
        document.getElementById('verificacion-exitosa').style.display = 'block';
        document.getElementById('email-prestamo').value = emailVerificado;
        
        mostrarNotificacion('✅ Correo verificado correctamente', 'success');
    } else {
        mostrarErrorCampo('error-codigo-verificacion', 'Código incorrecto. Inténtalo de nuevo.');
    }
}


function iniciarTemporizador() {
    tiempoRestante = 300;
    const contadorElement = document.getElementById('tiempo-restante');
    const btnReenviar = document.getElementById('btn-reenviar-codigo');
    
    actualizarTiempoDisplay(contadorElement);
    btnReenviar.style.display = 'none';
    
    temporizadorVerificacion = setInterval(() => {
        tiempoRestante--;
        if (tiempoRestante <= 0) {
            detenerTemporizador();
            contadorElement.textContent = '00:00';
            document.getElementById('contador-tiempo').classList.add('expirado');
            btnReenviar.style.display = 'block';
            mostrarNotificacion('El código ha expirado', 'warning');
            codigoVerificacion = null;
        } else {
            actualizarTiempoDisplay(contadorElement);
        }
    }, 1000);
}

function detenerTemporizador() {
    if (temporizadorVerificacion) {
        clearInterval(temporizadorVerificacion);
        temporizadorVerificacion = null;
    }
}

function actualizarTiempoDisplay(element) {
    const minutos = Math.floor(tiempoRestante / 60);
    const segundos = tiempoRestante % 60;
    element.textContent = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
}



function validarFormularioPrestamo(publicKey, cantidad) {
    let isValid = true;
    
    if (!publicKey) {
        mostrarErrorCampo('error-public-key-prestamo', 'La llave pública es requerida');
        isValid = false;
    } else {
        ocultarErrorCampo('error-public-key-prestamo');
    }
    
    if (!cantidad) {
        mostrarErrorCampo('error-cantidad-prestamo', 'La cantidad es requerida');
        isValid = false;
    } else {
        ocultarErrorCampo('error-cantidad-prestamo');
    }
    
    return isValid;
}

function validarFormularioP2P(publicKeyDestino, cantidadSatoshis) {
    let isValid = true;
    
    if (!publicKeyDestino) {
        mostrarErrorCampo('error-public-key-destino', 'La llave pública del destinatario es requerida');
        isValid = false;
    } else {
        ocultarErrorCampo('error-public-key-destino');
    }
    
    if (!cantidadSatoshis) {
        mostrarErrorCampo('error-cantidad-satoshis', 'La cantidad de satoshis es requerida');
        isValid = false;
    } else {
        ocultarErrorCampo('error-cantidad-satoshis');
    }
    
    return isValid;
}



function resetearVerificacion() {
    emailVerificado = null;
    codigoVerificacion = null;
    detenerTemporizador();
    
    document.getElementById('paso-verificacion').style.display = 'block';
    document.getElementById('prestamo-form').style.display = 'none';
    document.getElementById('verificacion-exitosa').style.display = 'none';
    document.getElementById('codigo-container').style.display = 'none';
    document.getElementById('email-verificacion').value = '';
    document.getElementById('codigo-verificacion').value = '';
    document.getElementById('success-prestamo').style.display = 'none';
    document.getElementById('contador-tiempo').classList.remove('expirado');
    document.getElementById('btn-reenviar-codigo').style.display = 'none';
}

function validarEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function obtenerFechaActual() {
    return new Date().toLocaleString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function mostrarErrorCampo(elementId, mensaje) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = mensaje;
        element.style.display = 'block';
    }
}

function ocultarErrorCampo(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

function mostrarNotificacion(mensaje, tipo = 'info') {
  
    const notificacionesExistentes = document.querySelectorAll('.notificacion');
    notificacionesExistentes.forEach(notif => notif.remove());
    
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion ${tipo}`;
    notificacion.textContent = mensaje;
    document.body.appendChild(notificacion);
    
    setTimeout(() => {
        if (notificacion.parentNode) {
            notificacion.parentNode.removeChild(notificacion);
        }
    }, 5000);
}


document.getElementById('copy-public-key').addEventListener('click', function() {
    const publicKey = document.getElementById('nuestra-public-key').textContent;
    
    navigator.clipboard.writeText(publicKey).then(() => {
        const originalText = this.textContent;
        this.textContent = '¡Copiada!';
        this.classList.add('copied');
        
        setTimeout(() => {
            this.textContent = originalText;
            this.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Error al copiar: ', err);
        mostrarNotificacion('Error al copiar la llave. Por favor, cópiala manualmente.', 'error');
    });
});


document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando Moonshot Platform...');
    
    if (typeof emailjs !== 'undefined') {
        inicializarEmailJS();
    }
    
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            const errorId = `error-${this.id}`;
            ocultarErrorCampo(errorId);
        });
    });
    
    console.log('✅ Moonshot Platform inicializada');
});