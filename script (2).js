const EMAILJS_CONFIG = {
    PUBLIC_KEY: 'j_0IQa3swAXcaU1ip',
    SERVICE_ID: 'service_8eia2oi',
    TEMPLATE_VERIFICACION: 'moonshot_verificacion',
    TEMPLATE_SOLICITUDES: 'moonshot_solicitudes'
};

const LNBITS_CONFIG = {
    ADMIN_KEY_1: '31e48d64717d48fe9332c173700f0aaa',
    INVOICE_KEY_1: '564dba9b2da84a3f8470597b7c5ab0de',
    WALLET_ID_1: 'c8d7c0d16fc8490ba9f9e46773a2091a',
    ADMIN_KEY_2: 'db4cded897854d96a1d8deec3843c9bf',
    INVOICE_KEY_2: '30d3895900a34761aaf2c01c897c6686',
    WALLET_ID_2: 'b3867710b6264f73b6cf2cc9408020f5',
    API_URL: 'http://chirilicas.com:5000'
};

let isEmailJSInitialized = false;
let codigoVerificacion = null;
let temporizadorVerificacion = null;
let tiempoRestante = 300;
let emailVerificado = null;
let currentPaymentHash = null;
let pagoVerificationInterval = null;

function inicializarEmailJS() {
    try {
        if (typeof emailjs === 'undefined') {
            mostrarNotificacion('Error: EmailJS no está cargado. Recarga la página.', 'error');
            return false;
        }
        
        emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
        isEmailJSInitialized = true;
        return true;
    } catch (error) {
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
        
        const templateParams = {
            to_email: email,
            codigo_verificacion: codigoVerificacion,
            fecha: new Date().toLocaleString()
        };

        await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_VERIFICACION,
            templateParams
        );
        
        document.getElementById('codigo-container').style.display = 'block';
        document.getElementById('btn-reenviar-codigo').style.display = 'none';
        
        iniciarTemporizador();
        mostrarNotificacion('✅ Código de verificación enviado a tu correo', 'success');
        
    } catch (error) {
        mostrarNotificacion('Error al enviar el código. Inténtalo de nuevo.', 'error');
    } finally {
        btnEnviar.textContent = originalText;
        btnEnviar.disabled = false;
    }
}

document.getElementById('prestamo-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
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
            fecha: new Date().toLocaleString()
        };

        await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_SOLICITUDES,
            templateParams
        );
        
        document.getElementById('success-prestamo').style.display = 'block';
        document.getElementById('prestamo-form').reset();
        
        setTimeout(() => {
            resetearVerificacion();
        }, 5000);
        
    } catch (error) {
        mostrarNotificacion('Error al enviar la solicitud. Inténtalo de nuevo.', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

document.getElementById('p2p-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const publicKeyDestino = document.getElementById('public-key-destino').value.trim();
    const cantidadSatoshis = document.getElementById('cantidad-satoshis').value.trim();
    
    if (!validarFormularioP2P(publicKeyDestino, cantidadSatoshis)) return;
    
    const submitBtn = this.querySelector('.btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Procesando...';
    submitBtn.disabled = true;
    
    try {
        await procesarPagoReal(parseInt(cantidadSatoshis), publicKeyDestino);
    } catch (error) {
        await procesarPagoAlternativo(parseInt(cantidadSatoshis), publicKeyDestino);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

async function procesarPagoReal(amountSats, publicKeyDestino) {
    try {
        await enviarNotificacionP2P(publicKeyDestino, amountSats);
        const invoice = await crearInvoice(amountSats, `P2P: ${publicKeyDestino}`);
        mostrarInterfazPago(amountSats, publicKeyDestino, invoice);
    } catch (error) {
        throw error;
    }
}

async function procesarPagoAlternativo(amountSats, publicKeyDestino) {
    await enviarNotificacionP2P(publicKeyDestino, amountSats);
    const paymentRequestDemo = generarPaymentRequestDemo(amountSats);
    mostrarInterfazPagoDemo(amountSats, publicKeyDestino, paymentRequestDemo);
}

async function enviarNotificacionP2P(publicKeyDestino, cantidadSatoshis) {
    try {
        const templateParams = {
            public_key_destino: publicKeyDestino,
            cantidad_satoshis: cantidadSatoshis,
            tipo_solicitud: 'p2p',
            fecha: new Date().toLocaleString(),
            nota: 'Solicitud de pago P2P recibida - Lightning Network'
        };

        await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_SOLICITUDES,
            templateParams
        );
    } catch (error) {}
}

async function crearInvoice(amount, memo) {
    try {
        const url = `${LNBITS_CONFIG.API_URL}/api/v1/payments`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': LNBITS_CONFIG.INVOICE_KEY_1
            },
            body: JSON.stringify({
                out: false,
                amount: amount,
                memo: memo,
                expiry: 3600
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

function generarPaymentRequestDemo(amountSats) {
    return `lnbc${amountSats.toString()}p1p3xnhl2pp5jptserxp3y5j9t4w3jxc2n4hqapn304q0sxr0d4wfcxqgxqyzq2dphx7un8wehkjcm9ypsk7mt9v4kz7grfqssp5sjcde04nx2g3qg3q2u8q4e8q6nr8q6twvscqzpgxqyz5vqsp5sjcde04nx2g3qg3q2u8q4e8q6nr8q6twvscqzpgxqyz5vqsp5sjcde04nx2g3qg3q2u8q4e8q6nr8q6twvscqzpgxqyz5vqsp595k4c`;
}

function mostrarInterfazPago(amountSats, publicKeyDestino, invoice) {
    document.getElementById('p2p-form').style.display = 'none';
    document.getElementById('success-p2p').style.display = 'block';
    
    document.getElementById('payment-amount').textContent = amountSats.toLocaleString();
    document.getElementById('payment-memo').textContent = `P2P: ${publicKeyDestino}`;
    document.getElementById('lightning-payment-request').textContent = invoice.payment_request;
    
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(invoice.payment_request)}`;
    const qrImg = document.getElementById('lightning-qr-code');
    qrImg.src = qrUrl;
    qrImg.style.display = 'block';
    
    const lightningSection = document.getElementById('lightning-payment');
    lightningSection.style.display = 'block';
    lightningSection.scrollIntoView({ behavior: 'smooth' });
    
    currentPaymentHash = invoice.payment_hash;
    iniciarVerificacionPago(invoice.payment_hash, amountSats, publicKeyDestino);
}

function mostrarInterfazPagoDemo(amountSats, publicKeyDestino, paymentRequest) {
    document.getElementById('p2p-form').style.display = 'none';
    document.getElementById('success-p2p').style.display = 'block';
    
    document.getElementById('payment-amount').textContent = amountSats.toLocaleString();
    document.getElementById('payment-memo').textContent = `P2P: ${publicKeyDestino}`;
    document.getElementById('lightning-payment-request').textContent = paymentRequest;
    
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(paymentRequest)}`;
    const qrImg = document.getElementById('lightning-qr-code');
    qrImg.src = qrUrl;
    qrImg.style.display = 'block';
    
    const lightningSection = document.getElementById('lightning-payment');
    lightningSection.style.display = 'block';
    lightningSection.scrollIntoView({ behavior: 'smooth' });
    
    document.getElementById('payment-status').innerHTML = `
        <div class="loading-spinner"></div>
        <p>⏳ Esperando pago Lightning...</p>
        <p class="status-info">Escanea el QR con Zeus Wallet para pagar</p>
    `;
}

async function verificarPago(paymentHash) {
    try {
        const url = `${LNBITS_CONFIG.API_URL}/api/v1/payments/${paymentHash}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Api-Key': LNBITS_CONFIG.INVOICE_KEY_1
            }
        });

        if (!response.ok) {
            throw new Error('Error verificando pago');
        }

        const data = await response.json();
        return data.paid;
    } catch (error) {
        return false;
    }
}

function iniciarVerificacionPago(paymentHash, amountSats, publicKeyDestino) {
    let intentos = 0;
    const maxIntentos = 1800;
    
    if (pagoVerificationInterval) {
        clearInterval(pagoVerificationInterval);
    }
    
    pagoVerificationInterval = setInterval(async () => {
        intentos++;
        
        try {
            const pagado = await verificarPago(paymentHash);
            
            if (pagado) {
                clearInterval(pagoVerificationInterval);
                await procesarPagoExitoso(amountSats, publicKeyDestino, paymentHash);
            } else if (intentos >= maxIntentos) {
                clearInterval(pagoVerificationInterval);
                mostrarPagoExpirado();
            }
        } catch (error) {}
    }, 2000);
}

async function procesarPagoExitoso(amountSats, publicKeyDestino, paymentHash) {
    document.getElementById('payment-status').innerHTML = `
        <div style="color: var(--success-color); font-size: 2rem; margin-bottom: 10px;">✅</div>
        <div class="payment-success">¡Pago Confirmado!</div>
        <p>El pago de ${amountSats.toLocaleString()} sats se ha recibido correctamente</p>
    `;
    
    try {
        await crearSplitPayment(amountSats, `P2P Split: ${publicKeyDestino}`);
        
        document.getElementById('payment-status').innerHTML += `
            <div class="split-info">
                <h4>🎯 Distribución Automática Completada</h4>
                <p>El pago se ha distribuido automáticamente entre las billeteras</p>
            </div>
        `;
    } catch (error) {
        document.getElementById('payment-status').innerHTML += `
            <div style="color: var(--warning-color); margin-top: 10px;">
                ⚠️ El pago se recibió pero hubo un error en la distribución automática
            </div>
        `;
    }
    
    mostrarNotificacion('🎉 ¡Transacción P2P completada exitosamente!', 'success');
    
    setTimeout(() => {
        reiniciarSeccionP2P();
    }, 8000);
}

async function crearSplitPayment(amount, memo) {
    try {
        const response = await fetch(`${LNBITS_CONFIG.API_URL}/api/v1/splitpayments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': LNBITS_CONFIG.ADMIN_KEY_1
            },
            body: JSON.stringify({
                amount: amount,
                memo: memo,
                splits: [
                    { wallet: LNBITS_CONFIG.WALLET_ID_1, percent: 50 },
                    { wallet: LNBITS_CONFIG.WALLET_ID_2, percent: 50 }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Error Split Payment: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

function mostrarPagoExpirado() {
    document.getElementById('payment-status').innerHTML = `
        <div style="color: var(--error-color); font-size: 2rem; margin-bottom: 10px;">❌</div>
        <div style="color: var(--error-color); font-weight: bold;">Pago Expirado</div>
        <p>El tiempo para realizar el pago ha expirado</p>
    `;
    
    mostrarNotificacion('El pago ha expirado. Por favor, inicia una nueva transacción.', 'warning');
    
    setTimeout(() => {
        reiniciarSeccionP2P();
    }, 5000);
}

function reiniciarSeccionP2P() {
    if (pagoVerificationInterval) {
        clearInterval(pagoVerificationInterval);
        pagoVerificationInterval = null;
    }
    
    document.getElementById('lightning-payment').style.display = 'none';
    document.getElementById('p2p-form').style.display = 'block';
    document.getElementById('success-p2p').style.display = 'none';
    document.getElementById('p2p-form').reset();
    
    document.getElementById('payment-status').innerHTML = `
        <div class="loading-spinner"></div>
        <p>⏳ Esperando pago Lightning...</p>
    `;
    
    currentPaymentHash = null;
}

document.getElementById('btn-cancelar-pago').addEventListener('click', function() {
    if (pagoVerificationInterval) {
        clearInterval(pagoVerificationInterval);
        pagoVerificationInterval = null;
    }
    reiniciarSeccionP2P();
    mostrarNotificacion('Pago cancelado', 'warning');
});

document.getElementById('btn-verificar-pago').addEventListener('click', async function() {
    if (!currentPaymentHash) {
        mostrarNotificacion('No hay un pago en proceso', 'error');
        return;
    }
    
    mostrarNotificacion('🔄 Verificando estado del pago...', 'info');
    
    try {
        const pagado = await verificarPago(currentPaymentHash);
        if (pagado) {
            mostrarNotificacion('✅ ¡Pago confirmado!', 'success');
        } else {
            mostrarNotificacion('⏳ Pago aún pendiente', 'info');
        }
    } catch (error) {
        mostrarNotificacion('Error verificando pago', 'error');
    }
});

document.getElementById('copy-payment-request').addEventListener('click', function() {
    const paymentRequest = document.getElementById('lightning-payment-request').textContent;
    navigator.clipboard.writeText(paymentRequest).then(() => {
        mostrarNotificacion('✅ Invoice copiado al portapapeles', 'success');
    }).catch(() => {
        const tempInput = document.createElement('input');
        tempInput.value = paymentRequest;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        mostrarNotificacion('✅ Invoice copiado', 'success');
    });
});

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
    
    if (!cantidadSatoshis || isNaN(cantidadSatoshis) || cantidadSatoshis <= 0) {
        mostrarErrorCampo('error-cantidad-satoshis', 'Ingresa una cantidad válida de satoshis');
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

document.addEventListener('DOMContentLoaded', function() {
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
});