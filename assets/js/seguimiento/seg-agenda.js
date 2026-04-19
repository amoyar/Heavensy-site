/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-agenda.js
   Modal agenda completo: servicios, especialistas, calendario, horarios, cobro, recordatorio, CIE-10 móvil, bottom sheet. Vars _segPn/_segPnFormDp.
═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   MODAL AGENDA — Próxima Sesión
   Reutiliza endpoints existentes del módulo /api/agenda
═══════════════════════════════════════════════════════ */
var _segAgenda = {
  modo:          'sesion',   // 'sesion' | 'recordatorio'
  servicios:     [],         // lista de servicios de la empresa
  svcSelec:      null,       // { service_id, resource_id, name, duration, price }
  especialistas: [],         // especialistas con ese servicio
  espSelec:      null,       // { resource_id, resource_name, service_id }
  cal:           { anio: null, mes: null },
  diaSelec:      null,       // 'YYYY-MM-DD'
  slotsDisp:     {},         // { 'YYYY-MM-DD': [ {start, end}, ... ] }
  horaSelec:     null,       // { start, end }
};

var MESES_AGENDA = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var DIAS_AGENDA  = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

function segAbrirModalAgenda() {
  // Resetear estado
  _segAgenda.svcSelec    = null;
  _segAgenda.espSelec    = null;
  _segAgenda.diaSelec    = null;
  _segAgenda.horaSelec   = null;
  _segAgenda.slotsDisp   = {};

  var now = new Date();
  _segAgenda.cal = { anio: now.getFullYear(), mes: now.getMonth() };

  // Resetear UI
  document.getElementById('seg-agenda-horas-wrap').classList.add('seg-hidden');
  document.getElementById('seg-agenda-horas').innerHTML = '';
  document.getElementById('seg-agenda-resumen').classList.add('seg-hidden');
  document.getElementById('seg-agenda-confirmar-btn').disabled = true;
  _segAgendaCanal = 'whatsapp';
  _segAgendaSesionCanal = 'whatsapp';
  // Resetear chips de canal en recordatorio
  document.querySelectorAll('#seg-agenda-canal-chips .seg-canal-chip').forEach(function(c) {
    c.classList.toggle('active', c.dataset.canal === 'whatsapp');
  });
  // Resetear chips de canal en sesión
  document.querySelectorAll('#seg-agenda-sesion-canal-chips .seg-canal-chip').forEach(function(c) {
    c.classList.toggle('active', c.dataset.canal === 'whatsapp');
  });
  segAgendaModo('sesion');

  // Abrir modal
  document.getElementById('seg-agenda-modal').classList.remove('seg-hidden');

  // Cargar servicios de la empresa
  segFetch('/api/agenda/company?limit=5', {},
    function(data) {
      _segAgenda.servicios = data.services || [];
      segAgendaRenderServicios();
      segAgendaRenderCal();
    },
    function() {
      document.getElementById('seg-agenda-servicios').innerHTML =
        '<span style="font-size:10px;color:#ef4444">Error cargando servicios</span>';
    }
  );
}

function segCerrarModalAgenda() {
  document.getElementById('seg-agenda-modal').classList.add('seg-hidden');
}

function segAgendaModo(modo) {
  _segAgenda.modo = modo;
  document.getElementById('seg-agenda-modo-sesion').classList.toggle('activo', modo === 'sesion');
  document.getElementById('seg-agenda-modo-recordatorio').classList.toggle('activo', modo === 'recordatorio');
  document.getElementById('seg-agenda-sesion-wrap').classList.toggle('seg-hidden', modo !== 'sesion');
  document.getElementById('seg-agenda-recordatorio-wrap').classList.toggle('seg-hidden', modo !== 'recordatorio');
  // Cambiar texto del botón según modo
  var btn = document.getElementById('seg-agenda-confirmar-btn');
  if (btn) {
    if (modo === 'recordatorio') {
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar';
    } else {
      btn.innerHTML = '<i class="fas fa-calendar-check"></i> Agendar';
    }
  }
  segAgendaActualizarConfirmar();
}

function segAgendaRenderServicios() {
  var el = document.getElementById('seg-agenda-servicios');
  if (!_segAgenda.servicios.length) {
    el.innerHTML = '<span style="font-size:10px;color:#9ca3af">Sin servicios configurados</span>';
    return;
  }
  el.innerHTML = _segAgenda.servicios.map(function(svc) {
    var nombre = svc.name.replace(/'/g, "\\'");
    return '<span class="seg-agenda-svc-chip" onclick="segAgendaSelecSvc(\'' + nombre + '\')">' +
      segEscape(svc.name) + '</span>';
  }).join('');
}

function segAgendaSelecSvc(nombre) {
  var svc = _segAgenda.servicios.find(function(s) { return s.name === nombre; });
  if (!svc) return;

  // Marcar chip activo
  document.querySelectorAll('.seg-agenda-svc-chip').forEach(function(c) {
    c.classList.toggle('activo', c.textContent === nombre);
  });

  // Determinar especialistas para este servicio
  var especialistas = svc.specialists || [];
  _segAgenda.especialistas = especialistas;
  _segAgenda.horaSelec = null;
  _segAgenda.diaSelec  = null;
  _segAgenda.slotsDisp = {};

  // Si hay un solo especialista seleccionarlo automáticamente
  if (especialistas.length === 1) {
    _segAgenda.espSelec = especialistas[0];
    _segAgenda.svcSelec = {
      service_id:    especialistas[0].service_id,
      resource_id:   especialistas[0].resource_id,
      resource_name: especialistas[0].resource_name,
      name:          svc.name,
      duration:      svc.duration,
      price:         svc.price,
    };
    document.getElementById('seg-agenda-especialista-wrap').classList.add('seg-hidden');
  } else {
    // Mostrar selector de especialista
    _segAgenda.svcSelec = null;
    _segAgenda.espSelec = null;
    segAgendaRenderEspecialistas(especialistas, svc);
    document.getElementById('seg-agenda-especialista-wrap').classList.remove('seg-hidden');
  }

  // Cargar slots del mes actual
  segAgendaCargarMes();
  // Esconder placeholder
  var ph = document.getElementById('seg-agenda-placeholder');
  if (ph) ph.classList.add('seg-hidden');
  segAgendaActualizarConfirmar();
}

function segAgendaRenderEspecialistas(especialistas, svc) {
  var el = document.getElementById('seg-agenda-especialistas');
  el.innerHTML = especialistas.map(function(esp) {
    var rid   = esp.resource_id.replace(/'/g, "\\'");
    var rname = esp.resource_name.replace(/'/g, "\\'");
    var sid   = esp.service_id.replace(/'/g, "\\'");
    var sname = svc.name.replace(/'/g, "\\'");
    return '<span class="seg-agenda-svc-chip" onclick="segAgendaSelecEsp(\'' +
      rid + '\',\'' + rname + '\',\'' + sid + '\',\'' + sname + '\',' +
      svc.duration + ',' + (svc.price || 0) + ')">' +
      segEscape(esp.resource_name) + '</span>';
  }).join('');
}

function segAgendaSelecEsp(resource_id, resource_name, service_id, svc_name, duration, price) {
  _segAgenda.espSelec = { resource_id: resource_id, resource_name: resource_name, service_id: service_id };
  _segAgenda.svcSelec = { service_id: service_id, resource_id: resource_id,
    resource_name: resource_name, name: svc_name, duration: duration, price: price };
  document.querySelectorAll('#seg-agenda-especialistas .seg-agenda-svc-chip').forEach(function(c) {
    c.classList.toggle('activo', c.textContent === resource_name);
  });
  _segAgenda.diaSelec  = null;
  _segAgenda.horaSelec = null;
  _segAgenda.slotsDisp = {};
  segAgendaCargarMes();
  segAgendaActualizarConfirmar();
}

function segAgendaCargarMes() {
  if (!_segAgenda.svcSelec) return;
  var anio = _segAgenda.cal.anio;
  var mes  = _segAgenda.cal.mes;
  var from = anio + '-' + String(mes + 1).padStart(2,'0') + '-01';
  var rid  = _segAgenda.svcSelec.resource_id;
  var sid  = _segAgenda.svcSelec.service_id;

  // Obtener slots del mes completo
  segFetch('/api/agenda/availability/' + rid + '/' + sid + '?from=' + from + '&limit=60', {},
    function(data) {
      _segAgenda.slotsDisp = {};
      (data.slots || []).forEach(function(s) {
        if (!_segAgenda.slotsDisp[s.date]) _segAgenda.slotsDisp[s.date] = [];
        _segAgenda.slotsDisp[s.date].push(s);
      });
      segAgendaRenderCal();
    },
    function() {}
  );
}

function segAgendaCalNav(dir) {
  _segAgenda.cal.mes += dir;
  if (_segAgenda.cal.mes > 11) { _segAgenda.cal.mes = 0;  _segAgenda.cal.anio++; }
  if (_segAgenda.cal.mes < 0)  { _segAgenda.cal.mes = 11; _segAgenda.cal.anio--; }
  segAgendaCargarMes();
  segAgendaRenderCal();
}

function segAgendaRenderCal() {
  var anio   = _segAgenda.cal.anio;
  var mes    = _segAgenda.cal.mes;
  var mesEl  = document.getElementById('seg-agenda-cal-mes');
  var gridEl = document.getElementById('seg-agenda-cal-grid');
  if (mesEl) mesEl.textContent = MESES_AGENDA[mes] + ' ' + anio;

  var hoy        = new Date();
  var primerDia  = new Date(anio, mes, 1);
  var diasMes    = new Date(anio, mes + 1, 0).getDate();
  // Lunes=0 ... Domingo=6
  var offsetLunes = (primerDia.getDay() + 6) % 7;

  var html = DIAS_AGENDA.map(function(d) {
    return '<div class="seg-agenda-cal-head">' + d + '</div>';
  }).join('');

  for (var i = 0; i < offsetLunes; i++) html += '<div class="seg-agenda-cal-day vacio"></div>';

  for (var d = 1; d <= diasMes; d++) {
    var fecha     = anio + '-' + String(mes+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var esHoy     = (anio === hoy.getFullYear() && mes === hoy.getMonth() && d === hoy.getDate());
    var esPasado  = new Date(anio, mes, d) < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    var tieneSlot = !!(_segAgenda.slotsDisp[fecha] && _segAgenda.slotsDisp[fecha].length);
    var esSelec   = _segAgenda.diaSelec === fecha;

    var cls = 'seg-agenda-cal-day';
    if (esSelec)  cls += ' seleccionado';
    else if (esHoy)    cls += ' hoy';
    if (esPasado) cls += ' pasado';
    else if (!tieneSlot && _segAgenda.svcSelec) cls += ' sin-slots';
    else if (tieneSlot) cls += ' con-slots';

    var onclick = (!esPasado && tieneSlot)
      ? ' onclick="segAgendaSelecDia(\'' + fecha + '\')"'
      : '';

    html += '<div class="' + cls + '"' + onclick + '>' + d + '</div>';
  }

  if (gridEl) gridEl.innerHTML = html;
}

function segAgendaSelecDia(fecha) {
  _segAgenda.diaSelec  = fecha;
  _segAgenda.horaSelec = null;
  segAgendaRenderCal();

  var horasEl = document.getElementById('seg-agenda-horas');
  var wrapEl  = document.getElementById('seg-agenda-horas-wrap');
  var timerEl = document.getElementById('seg-agenda-timer-wrap');

  if (!_segAgenda.svcSelec) return;

  // Mostrar spinner mientras carga disponibilidad fresca
  wrapEl.classList.remove('seg-hidden');
  timerEl.classList.add('seg-hidden');
  horasEl.innerHTML = '<span style="color:#888;font-size:12px">' +
    '<i class="fas fa-spinner fa-spin"></i> Verificando disponibilidad...</span>';

  var svc = _segAgenda.svcSelec;

  function _renderSlots(slots) {
    _segAgenda.slotsDisp[fecha] = slots;
    if (!slots.length) {
      wrapEl.classList.add('seg-hidden');
      timerEl.classList.add('seg-hidden');
      horasEl.innerHTML = '';
      return;
    }
    horasEl.innerHTML = slots.map(function(s) {
      return '<span class="seg-agenda-hora-chip" onclick="segAgendaSelecHora(\'' +
        s.start + '\',\'' + s.end + '\')">' + s.start + '</span>';
    }).join('');
    segAgendaActualizarConfirmar();
  }

  segFetch('/api/agenda/availability/' + svc.resource_id + '/' + svc.service_id +
    '?date=' + fecha, {},
    function(data) { _renderSlots(data.slots || []); },
    function()     { _renderSlots(_segAgenda.slotsDisp[fecha] || []); }
  );
}

function segAgendaSelecHora(start, end) {
  _segAgenda.horaSelec = { start: start, end: end };
  segAgendaAviso(null); // limpiar aviso al seleccionar nueva hora
  document.querySelectorAll('.seg-agenda-hora-chip').forEach(function(c) {
    c.classList.toggle('activo', c.textContent === start);
  });
  // Mostrar timer al seleccionar hora
  document.getElementById('seg-agenda-timer-wrap').classList.remove('seg-hidden');
  segAgendaActualizarConfirmar();
}

function segAgendaActualizarConfirmar() {
  var btn     = document.getElementById('seg-agenda-confirmar-btn');
  var resumen = document.getElementById('seg-agenda-resumen');
  if (!btn) return;

  if (_segAgenda.modo === 'recordatorio') {
    var diaRec = _segAgenda.diaSelec;
    var ok = !!diaRec;
    btn.disabled = !ok;
    if (ok && resumen) {
      resumen.classList.remove('seg-hidden');
      // Formatear fecha igual que modo sesión
      var partes2   = diaRec.split('-');
      var fechaObj2 = new Date(parseInt(partes2[0]), parseInt(partes2[1]) - 1, parseInt(partes2[2]));
      var diasN2    = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
      var mesesN2   = ['enero','febrero','marzo','abril','mayo','junio',
                       'julio','agosto','septiembre','octubre','noviembre','diciembre'];
      var horaRec   = segAgendaTpGetValue ? segAgendaTpGetValue() : '';
      var fechaFmt2 = diasN2[fechaObj2.getDay()] + ', ' +
                      fechaObj2.getDate() + ' de ' + mesesN2[fechaObj2.getMonth()];
      resumen.innerHTML = '<i class="fas fa-calendar-check" style="color:#9961FF;margin-right:4px"></i>' +
        '📅 ' + fechaFmt2 + (horaRec ? ' · ' + horaRec : '') +
        ' <span style="color:#9961FF;font-weight:600">· Recordatorio</span>';
    }
    return;
  }

  var ok = !!(_segAgenda.svcSelec && _segAgenda.diaSelec && _segAgenda.horaSelec);
  btn.disabled = !ok;
  if (ok && resumen) {
    resumen.classList.remove('seg-hidden');
    var svc = _segAgenda.svcSelec;

    // Formatear fecha como "miércoles, 8 de abril"
    var partes    = _segAgenda.diaSelec.split('-');
    var fechaObj  = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
    var diasNombre = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    var mesesNombre = ['enero','febrero','marzo','abril','mayo','junio',
                       'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    var fechaFmt  = diasNombre[fechaObj.getDay()] + ', ' +
                    fechaObj.getDate() + ' de ' + mesesNombre[fechaObj.getMonth()];

    // Leer cobro del dropdown
    var timerVal  = parseInt(document.getElementById('seg-agenda-timer').value) || 0;
    var cobroLabel = document.getElementById('seg-agenda-dd-label');
    var cobro     = (timerVal > 0 && cobroLabel) ? cobroLabel.textContent.trim() : null;

    resumen.innerHTML = '<i class="fas fa-check-circle" style="color:#16a34a;margin-right:4px"></i>' +
      '📅 ' + fechaFmt + ' · ' +
      '<strong>' + segEscape(svc.name) + '</strong>' +
      (cobro ? ' · Cobro: ' + cobro : '');
  } else if (resumen) {
    resumen.classList.add('seg-hidden');
  }
}

function segAgendaAviso(msg) {
  var el  = document.getElementById('seg-agenda-aviso');
  var txt = document.getElementById('seg-agenda-aviso-msg');
  if (!el || !txt) return;
  if (msg) {
    txt.textContent = msg;
    el.classList.remove('seg-hidden');
  } else {
    el.classList.add('seg-hidden');
    txt.textContent = '';
  }
}



function segConfirmarAgenda() {
  if (_segAgenda.modo === 'recordatorio') {
    segConfirmarRecordatorio();
    return;
  }
  if (!_segAgenda.svcSelec || !_segAgenda.diaSelec || !_segAgenda.horaSelec) return;

  var btn = document.getElementById('seg-agenda-confirmar-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';

  var svc   = _segAgenda.svcSelec;
  var timer = parseInt(document.getElementById('seg-agenda-timer').value) || 0;
  var link  = (document.getElementById('seg-agenda-link-pago').value || '').trim();

  function resetBtn() {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-calendar-check"></i> Agendar';
  }

  // ── Capa 2: validar disponibilidad fresca antes del POST ──────────────────
  segFetch('/api/agenda/availability/' + svc.resource_id + '/' + svc.service_id +
    '?date=' + _segAgenda.diaSelec, {},
    function(avData) {
      var horaSelec = _segAgenda.horaSelec.start;
      var slots     = avData.slots || [];
      var aun_disp  = slots.some(function(s) { return s.start === horaSelec; });

      if (!aun_disp) {
        resetBtn();
        // Refrescar chips con disponibilidad actual
        var horasEl = document.getElementById('seg-agenda-horas');
        _segAgenda.slotsDisp[_segAgenda.diaSelec] = slots;
        _segAgenda.horaSelec = null;
        segAgendaActualizarConfirmar();
        if (horasEl) {
          horasEl.innerHTML = slots.map(function(s) {
            return '<span class="seg-agenda-hora-chip" onclick="segAgendaSelecHora(\'' +
              s.start + '\',\'' + s.end + '\')">' + s.start + '</span>';
          }).join('');
        }
        segAgendaAviso('Este horario ya no está disponible — fue reservado recientemente. Selecciona otro.');
        return;
      }

      // Slot confirmado disponible — proceder con la reserva
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
      _hacerReserva();
    },
    function() {
      // Si falla la validación, proceder igual (el POST detectará el 409)
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
      _hacerReserva();
    }
  );

  // Crear reserva en el módulo Agenda
  function _hacerReserva() {
  segFetch('/api/agenda/reservations', {
    method: 'POST',
    body: JSON.stringify({
      resource_id: svc.resource_id,
      service_id:  svc.service_id,
      contact_id:  SEG.clienteId,
      date:        _segAgenda.diaSelec,
      start:       _segAgenda.horaSelec.start,
      notes:       'Agendado desde Seguimiento'
    })
  },
  function(data) {
    resetBtn();
    var appointment_id = data.appointment_id || data.id || '';

    // Guardar en el registro de seguimiento
    var proxData = {
      appointment_id: appointment_id,
      service_name:   svc.name,
      resource_name:  svc.resource_name || '',
      fecha:          _segAgenda.diaSelec,
      hora:           _segAgenda.horaSelec.start,
      precio:         svc.price || null,
      link_pago:      link,
      timer_horas:    timer,
    };

    if (SEG.registroId) {
      segFetch('/api/seguimiento/registros/' + SEG.registroId, {
        method: 'PUT',
        body: JSON.stringify({ proxima_sesion_data: proxData })
      }, function() {}, function() {});
    }

    // Crear mensaje programado de cobro si hay timer
    if (timer > 0 && link && SEG.registroId) {
      var fechaHora = new Date(_segAgenda.diaSelec + 'T' + _segAgenda.horaSelec.start);
      fechaHora.setHours(fechaHora.getHours() - timer);
      var msgText = '🔔 Recordatorio de pago:\n' +
        'Para confirmar su sesión de ' + svc.name + ' el ' + _segAgenda.diaSelec +
        ' a las ' + _segAgenda.horaSelec.start + ', por favor realice el pago:\n' + link;

      segFetch('/api/seguimiento/mensajes-programados', {
        method: 'POST',
        body: JSON.stringify({
          company_id:  SEG.companyId,
          cliente_id:  SEG.clienteId,
          registro_id: SEG.registroId,
          fecha_envio: fechaHora.toISOString().slice(0,16),
          mensaje:     msgText,
          canal:       'whatsapp',
          tipo:        'cobro_sesion',
        })
      }, function() {}, function() {});
    }

    // Actualizar UI
    segActualizarProximaSesionUI(proxData);
    segAgendaAviso(null); segCerrarModalAgenda();
    segMarcarCambios();

    // Enviar notificación de confirmación al cliente (si no es "ninguno")
    if (_segAgendaSesionCanal && _segAgendaSesionCanal !== 'ninguno') {
      var partesFmt  = _segAgenda.diaSelec.split('-');
      var fechaFmtN  = new Date(parseInt(partesFmt[0]), parseInt(partesFmt[1])-1, parseInt(partesFmt[2]));
      var diasNomN   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
      var mesesNomN  = ['enero','febrero','marzo','abril','mayo','junio',
                        'julio','agosto','septiembre','octubre','noviembre','diciembre'];
      var fechaLeg   = diasNomN[fechaFmtN.getDay()] + ', ' +
                       fechaFmtN.getDate() + ' de ' + mesesNomN[fechaFmtN.getMonth()];
      var cobroLabel = (document.getElementById('seg-agenda-dd-label') || {}).textContent || '';
      var cobroInfo  = (timer > 0 && link)
        ? '\n\n🔔 Le enviaremos un recordatorio de confirmación ' + cobroLabel + ' de su sesión.\nLink de confirmación:\n' + link
        : (timer > 0
          ? '\n\n🔔 Le enviaremos un recordatorio de confirmación ' + cobroLabel + ' de su sesión.'
          : '');
      var msgConf = '📅 ¡Sesión agendada!\n\n' +
        'Servicio: ' + svc.name + '\n' +
        'Fecha: ' + fechaLeg + '\n' +
        'Hora: ' + _segAgenda.horaSelec.start + cobroInfo + '\n\n' +
        'Si necesita reprogramar, por favor avísenos con anticipación. 🙏';

      segFetch('/api/seguimiento/registros/' + SEG.registroId + '/enviar', {
        method: 'POST',
        body: JSON.stringify({
          resumen:       msgConf,
          canal:         _segAgendaSesionCanal,
          company_id:    SEG.companyId,
          cliente_email: (SEG.contexto && SEG.contexto.cliente && SEG.contexto.cliente.email) || '',
          etiquetas:     []
        })
      }, function() {}, function() {});
    }

    // Avisar si hubo advertencia de email
    if (data.email_warning || data.warnings) {
      segToast('✅ Sesión agendada · ⚠️ Notificación por email no enviada', 5000);
    } else {
      var canalLabel = { whatsapp: 'WhatsApp', email: 'email', ninguno: null }[_segAgendaSesionCanal];
      segToast('✅ Sesión agendada' + (canalLabel ? ' · Notificación enviada por ' + canalLabel : ''));
    }
  },
  function(err) {
    resetBtn();
    // Detectar si el slot ya está reservado (409 duplicate)
    if (err && (err.status === 409 || (err.data && err.data.code === 'duplicate'))) {
      // Limpiar hora seleccionada y refrescar slots del día
      _segAgenda.horaSelec = null;
      segAgendaActualizarConfirmar();
      segAgendaAviso('Esta hora ya fue reservada o confirmada. Selecciona otro horario.');
      if (_segAgenda.diaSelec && _segAgenda.svcSelec) {
        segFetch('/api/agenda/availability/' + _segAgenda.svcSelec.resource_id +
          '/' + _segAgenda.svcSelec.service_id + '?date=' + _segAgenda.diaSelec, {},
          function(data) {
            var slots = data.slots || [];
            _segAgenda.slotsDisp[_segAgenda.diaSelec] = slots;
            segAgendaSelecDia(_segAgenda.diaSelec);
          },
          function() {}
        );
      }
    } else {
      segToast('❌ Error al agendar. Intente nuevamente.');
    }
  });
  } // fin _hacerReserva
}

/* Canal de envío del recordatorio */
var _segAgendaCanal = 'whatsapp';
var _segAgendaSesionCanal = 'whatsapp'; // canal para notificación de sesión agendada

function segAgendaSesionSetCanal(canal, el) {
  _segAgendaSesionCanal = canal;
  document.querySelectorAll('#seg-agenda-sesion-canal-chips .seg-canal-chip').forEach(function(c) {
    c.classList.toggle('active', c === el);
  });
}

function segAgendaSetCanal(canal, el) {
  _segAgendaCanal = canal;
  document.querySelectorAll('#seg-agenda-canal-chips .seg-canal-chip').forEach(function(c) {
    c.classList.remove('active');
  });
  if (el) el.classList.add('active');
}

function segConfirmarRecordatorio() {
  if (!_segAgenda.diaSelec) return;
  var hora  = segAgendaTpGetValue();
  var link  = (document.getElementById('seg-agenda-link-agenda').value || '').trim();
  var msg   = (document.getElementById('seg-agenda-msg-rec').value || '').trim();

  if (!msg) {
    msg = '🔔 Recordatorio: Le informamos que es momento de agendar su próxima sesión.' +
      (link ? '\\n\\nAgenda aquí: ' + link : '');
  }

  var canal = _segAgendaCanal || 'whatsapp';

  if (SEG.registroId) {
    segFetch('/api/seguimiento/mensajes-programados', {
      method: 'POST',
      body: JSON.stringify({
        company_id:  SEG.companyId,
        cliente_id:  SEG.clienteId,
        registro_id: SEG.registroId,
        fecha_envio: _segAgenda.diaSelec + 'T' + hora,
        mensaje:     msg,
        canal:       canal,
        tipo:        'recordatorio_agenda',
      })
    }, function() {}, function() {});
  }

  segCerrarModalAgenda();
  segToast('✅ Recordatorio programado para el ' + _segAgenda.diaSelec);
}

function segActualizarProximaSesionUI(data) {
  // Actualizar el campo de próxima sesión visible en el panel
  var el = document.getElementById('seg-proxima-sesion-display');
  if (!el) return;
  el.textContent = data.fecha + ' ' + data.hora + ' — ' + data.service_name;
}

/* ─────────────────────────────────────────
   TIMEPICKER AGENDA RECORDATORIO
───────────────────────────────────────── */
var _segAgendaTp = { hora: 10, min: 0 };

function segAgendaTpToggle() {
  var tp = document.getElementById('seg-agenda-timepicker');
  if (!tp) return;
  if (tp.classList.contains('seg-hidden')) {
    segAgendaTpRender();
    tp.classList.remove('seg-hidden');
  } else {
    tp.classList.add('seg-hidden');
  }
}

function segAgendaTpRender() {
  var horasEl = document.getElementById('seg-agenda-tp-horas');
  var minsEl  = document.getElementById('seg-agenda-tp-minutos');
  if (!horasEl || !minsEl) return;
  var curH = _segAgendaTp.hora;
  var curM = _segAgendaTp.min;
  var htmlH = '';
  for (var h = 0; h <= 23; h++) {
    var cls = 'seg-tp-item' + (h === curH ? ' active' : '');
    htmlH += '<div class="' + cls + '" onclick="segAgendaTpSelHora(' + h + ')">' +
      String(h).padStart(2,'0') + '</div>';
  }
  horasEl.innerHTML = htmlH;
  var htmlM = '';
  for (var m = 0; m < 60; m += 5) {
    var cls2 = 'seg-tp-item' + (m === curM ? ' active' : '');
    htmlM += '<div class="' + cls2 + '" onclick="segAgendaTpSelMin(' + m + ')">' +
      String(m).padStart(2,'0') + '</div>';
  }
  minsEl.innerHTML = htmlM;
  setTimeout(function() {
    var hA = horasEl.querySelector('.active');
    var mA = minsEl.querySelector('.active');
    if (hA) hA.scrollIntoView({ block: 'nearest' });
    if (mA) mA.scrollIntoView({ block: 'nearest' });
  }, 30);
}

function segAgendaTpSelHora(h) {
  _segAgendaTp.hora = h;
  segAgendaTpActualizar();
  document.querySelectorAll('#seg-agenda-tp-horas .seg-tp-item').forEach(function(el, i) {
    el.classList.toggle('active', i === h);
  });
}

function segAgendaTpSelMin(m) {
  _segAgendaTp.min = m;
  segAgendaTpActualizar();
  document.querySelectorAll('#seg-agenda-tp-minutos .seg-tp-item').forEach(function(el, i) {
    el.classList.toggle('active', i * 5 === m);
  });
  setTimeout(function() {
    var tp = document.getElementById('seg-agenda-timepicker');
    if (tp) tp.classList.add('seg-hidden');
  }, 150);
}

function segAgendaTpActualizar() {
  var horaStr = String(_segAgendaTp.hora).padStart(2,'0') + ':' +
                String(_segAgendaTp.min).padStart(2,'0');
  var display = document.getElementById('seg-agenda-hora-display');
  if (display) display.textContent = horaStr;
}

function segAgendaTpGetValue() {
  return String(_segAgendaTp.hora).padStart(2,'0') + ':' +
         String(_segAgendaTp.min).padStart(2,'0');
}

// Cerrar al click fuera
document.addEventListener('click', function(e) {
  var wrap = document.getElementById('seg-agenda-hora-wrap');
  var tp   = document.getElementById('seg-agenda-timepicker');
  if (tp && wrap && !wrap.contains(e.target)) tp.classList.add('seg-hidden');
});

function segAgendaDdToggle() {
  var wrap = document.getElementById('seg-agenda-timer-wrap-dd');
  var list = document.getElementById('seg-agenda-dd-list');
  if (!wrap || !list) return;
  var abierto = !list.classList.contains('seg-hidden');
  if (abierto) {
    list.classList.add('seg-hidden');
    wrap.classList.remove('abierto');
  } else {
    list.classList.remove('seg-hidden');
    wrap.classList.add('abierto');
  }
}

function segAgendaDdSelect(valor, label) {
  var hidden = document.getElementById('seg-agenda-timer');
  if (hidden) hidden.value = valor;
  var lbl = document.getElementById('seg-agenda-dd-label');
  if (lbl) lbl.textContent = label;
  document.querySelectorAll('.seg-agenda-dd-item').forEach(function(el) {
    el.classList.toggle('activo', el.textContent.trim() === label);
  });
  var list = document.getElementById('seg-agenda-dd-list');
  var wrap = document.getElementById('seg-agenda-timer-wrap-dd');
  if (list) list.classList.add('seg-hidden');
  if (wrap) wrap.classList.remove('abierto');
  // Refrescar resumen
  segAgendaActualizarConfirmar();
}

// Cerrar al click fuera
document.addEventListener('click', function(e) {
  var wrap = document.getElementById('seg-agenda-timer-wrap-dd');
  var list = document.getElementById('seg-agenda-dd-list');
  if (list && wrap && !wrap.contains(e.target)) {
    list.classList.add('seg-hidden');
    wrap.classList.remove('abierto');
  }
});


/* ─────────────────────────────────────────
   BOTTOM SHEET DIAGNÓSTICOS — MÓVIL
───────────────────────────────────────── */
function _segEsMobil() {
  return window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth <= 900);
}

function segDiagSheetAbrir(matches, query) {
  var overlay = document.getElementById('seg-diag-sheet-overlay');
  var sheet   = document.getElementById('seg-diag-sheet');
  var input   = document.getElementById('seg-diag-sheet-input');
  if (!overlay || !sheet) return;

  // Guardar matches actuales para filtrar
  segDiagSheetAbrir._matches = matches || [];

  // Snapshot del editor y largo del query para restaurar al seleccionar (fix pérdida de contenido en móvil)
  var _edSnap = _segGetEditor();
  segDiagSheetAbrir._editorSnapshot = _edSnap ? _edSnap.innerHTML : null;
  segDiagSheetAbrir._queryLen       = (query || '').length;

  // Renderizar lista
  segDiagSheetRenderizar(segDiagSheetAbrir._matches);

  // Mostrar
  overlay.classList.remove('seg-hidden');
  sheet.classList.remove('seg-hidden');
  requestAnimationFrame(function() {
    sheet.classList.add('visible');
  });

  // Pre-cargar query en el buscador (lo que ya escribió el usuario)
  if (input) {
    input.value = query || '';
    setTimeout(function() { input.focus(); }, 300);
  }
}

function segDiagSheetRenderizar(matches) {
  var list = document.getElementById('seg-diag-sheet-list');
  if (!list) return;

  if (!matches || !matches.length) {
    list.innerHTML = '<div class="seg-diag-sheet-empty">Sin resultados — prueba con otro término</div>';
    return;
  }

  list.innerHTML = matches.map(function(d, i) {
    return '<div class="seg-diag-sheet-item" onclick="segDiagSheetSelec(' + i + ')">' +
      '<span class="seg-diag-sheet-codigo">' + segEscape(d.codigo || '—') + '</span>' +
      '<span class="seg-diag-sheet-nombre">' + segEscape(d.nombre) + '</span>' +
      '</div>';
  }).join('');
}

function segDiagSheetFiltrar(q) {
  // Filtrar desde todos los matches originales
  var todos = segDiagSheetAbrir._matches || [];
  if (!q || !q.trim()) {
    segDiagSheetRenderizar(todos);
    return;
  }
  var qn = q.trim().toLowerCase()
    .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
    .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');
  var filtrados = todos.filter(function(d) {
    var n = (d.nombre || '').toLowerCase()
      .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
      .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');
    return n.indexOf(qn) !== -1 || (d.codigo || '').toLowerCase().indexOf(qn) !== -1;
  });
  segDiagSheetRenderizar(filtrados);
}

function segDiagSheetSelec(idx) {
  var list  = document.getElementById('seg-diag-sheet-list');
  var visibles = (segDiagSheetAbrir._matches || []).filter(function(d) {
    var input = document.getElementById('seg-diag-sheet-input');
    var q = input ? input.value.trim() : '';
    if (!q) return true;
    var qn = q.toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
      .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');
    var n = (d.nombre||'').toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
      .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');
    return n.indexOf(qn) !== -1 || (d.codigo||'').toLowerCase().indexOf(qn) !== -1;
  });
  var match = visibles[idx];
  if (!match) return;

  // En móvil: restaurar el contenido del editor al estado previo al sheet
  // (antes se hacía textContent='' lo que borraba todo el contenido escrito)
  var editor = _segGetEditor();
  if (editor && _segEsMobil()) {
    if (segDiagSheetAbrir._editorSnapshot !== null && segDiagSheetAbrir._editorSnapshot !== undefined) {
      editor.innerHTML = segDiagSheetAbrir._editorSnapshot;
    }
  }

  segDiagSheetCerrar();
  var chipNombre = match.nombre + ' (' + match.codigo + ')';
  _segDiagConfirmarChip(chipNombre, match.nombre);
}

function segDiagSheetCerrar() {
  var overlay = document.getElementById('seg-diag-sheet-overlay');
  var sheet   = document.getElementById('seg-diag-sheet');
  if (!sheet) return;
  sheet.classList.remove('visible');
  setTimeout(function() {
    if (overlay) overlay.classList.add('seg-hidden');
    if (sheet) sheet.classList.add('seg-hidden');
    // Limpiar modo diag
    _segDiagMode = false;
    _segDiagDropdownCerrar();
  }, 280);
}


function segAbrirCie10Movil() {
  // Leer texto del editor como query inicial
  var editor = _segGetEditor();
  var query  = (editor ? (editor.textContent || editor.innerText || '') : '').trim();

  // Limpiar el texto del editor del contenido usado como query
  // (no borramos — el usuario decide qué hacer)

  _segDiagMode = true;
  _segDiagMatches = [];

  // Abrir bottom sheet vacío primero
  segDiagSheetAbrir([]);

  // Pre-rellenar el buscador con el texto del editor
  var input = document.getElementById('seg-diag-sheet-input');
  if (input && query) {
    input.value = query;
  }

  // Buscar con el texto del editor como query, o fallback genérico
  var q = query.length >= 2 ? query : 'trastorno';
  segFetch('/api/seguimiento/diagnosticos?q=' + encodeURIComponent(q) + '&limit=20', {},
    function(data) {
      var matches = data.diagnosticos || [];
      segDiagSheetAbrir._matches = matches;
      segDiagSheetRenderizar(matches);
    },
    function() {}
  );
}

/* ─────────────────────────────────────────
   TOOLTIP JS — evita problemas con overflow:hidden
───────────────────────────────────────── */
(function() {
  var tip = document.createElement('div');
  tip.id = 'seg-tooltip';
  tip.style.cssText = [
    'position:fixed',
    'background:#f5f3ff',
    'color:#7D84C1',
    'border:1px solid #c4b5fd',
    'font-size:10px',
    'font-weight:600',
    'padding:4px 8px',
    'border-radius:6px',
    'white-space:nowrap',
    'z-index:99999',
    'pointer-events:none',
    'box-shadow:0 2px 8px rgba(153,97,255,.15)',
    'display:none',
    'font-family:inherit'
  ].join(';');
  document.body.appendChild(tip);

  document.addEventListener('mouseover', function(e) {
    var el = e.target.closest('[data-seg-tooltip]');
    if (el) {
      tip.textContent = el.getAttribute('data-seg-tooltip');
      tip.style.display = 'block';
    }
  });
  document.addEventListener('mousemove', function(e) {
    if (tip.style.display === 'block') {
      tip.style.left = (e.clientX + 10) + 'px';
      tip.style.top  = (e.clientY - 28) + 'px';
    }
  });
  document.addEventListener('mouseout', function(e) {
    if (!e.relatedTarget || !e.relatedTarget.closest('[data-seg-tooltip]')) {
      tip.style.display = 'none';
    }
  });
})();