
let ws = null;

function conectarWS(nombre) {
    ws = new WebSocket("ws://localhost:4444");
    ws.onopen = () => {
        ws.send(JSON.stringify({ 
            tipo: "registro", 
            rol: "gestor", 
            nombre: nombre 
        }));
        console.log("WebSocket conectado");
    };
    ws.onmessage = (e) => {
    const aviso = JSON.parse(e.data);
    const tbody = document.getElementById("listaAvisos");
    if (tbody) {
        const row = tbody.insertRow(0);

        var color = "";
        if (aviso.color === "rojo")       color = "#ffcccc";
        else if (aviso.color === "azul")  color = "#cce5ff";
        else if (aviso.color === "verde") color = "#ccffcc";



        var c0 = row.insertCell(0);
        var c1 = row.insertCell(1);
        var c2 = row.insertCell(2);

        c0.innerHTML = aviso.fecha || "";
        c1.innerHTML = aviso.origen || "";
        c2.innerHTML = aviso.texto || "";

        if (color) {
            c0.style.backgroundColor = color;
            c1.style.backgroundColor = color;
            c2.style.backgroundColor = color;
        }
    }
};
    ws.onclose = () => console.log("WebSocket cerrado");
}

function enviarAvisoNuevoRecurso(texto) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
            tipo: "avisoNuevoRecurso", 
            texto: texto 
        }));
    }
}


var seccionActual = "login";
var idgestor = null;
var idRecursoActual = null;
var origen = null;

var app = rpc("localhost", 3002, "gestion_sanitarios");
var totalPartes = app.procedure("totalPartes");
var totalAvisos = app.procedure("totalAvisos");

window.categorias = [];
window.modelos = [];
window.ubicaciones = [];

function cambiarSeccion(seccion) {
    document.getElementById(seccionActual).classList.remove("activa");
    document.getElementById(seccion).classList.add("activa");
    seccionActual = seccion;
}

function entrar() {
    var creds = { 
        login: document.getElementById("usuario").value,
        password: document.getElementById("password").value
    };
    rest.post("/api/gestores/login", creds, function (estado, respuesta) {
        if (estado == 200) {
            idgestor = respuesta.id;
            window.token = respuesta.token;
            rest.get("/api/gestores/" + idgestor, function (estado2, gestor) {
                if (estado2 == 200) {
                    document.getElementById("bienvenida").innerHTML =
                        "Bienvenido " + gestor.nombre + " " + gestor.apellidos;
                    cambiarSeccion("inicio");
                    cargarFiltros();
                    cargarRanking();
                    conectarWS(gestor.nombre + " " + gestor.apellidos);
                } else {
                    alert("Error cargando datos del gestor");
                }
            });
        } else {
            alert("Usuario o contraseña incorrectos");
        }
    });
}



function cargarFiltros() {
    rest.get("/api/categorias", function(status, lista) {
        if (status == 200) {
            window.categorias = lista;
            var html = document.getElementById("fCategoria");
            html.innerHTML = "<option value=''>Todos</option>";
            for (var i = 0; i < lista.length; i++) {
                html.innerHTML += "<option value='" + lista[i].id + "'>" + lista[i].nombre + "</option>";
            }
        }
    });
    rest.get("/api/ubicaciones", function(status, lista) {
        if (status == 200) {
            window.ubicaciones = lista;
            var html = document.getElementById("fUbicacion");
            html.innerHTML = "<option value=''>Todos</option>";
            for (var i = 0; i < lista.length; i++) {
                html.innerHTML += "<option value='" + lista[i].id + "'>" + lista[i].nombre + "</option>";
            }
        }
    });
    rest.get("/api/modelos", function(status, lista) {
        if (status == 200) {
            window.modelos = lista;
            var html = document.getElementById("fModelo");
            html.innerHTML = "<option value=''>Todos</option>";
            for (var i = 0; i < lista.length; i++) {
                html.innerHTML += "<option value='" + lista[i].id + "'>" + lista[i].nombre + "</option>";
            }
        }
    });
}


function buscar() {
    var c = document.getElementById("fCategoria").value;
    var m = document.getElementById("fModelo").value;
    var u = document.getElementById("fUbicacion").value;
    var e = document.getElementById("fEstado").value;
    var url = "/api/recursos?categoria=" + c + "&modelo=" + m + "&ubicacion=" + u + "&estado=" + e;
    rest.get(url, function(estado, lista) {
        if (estado != 200) {
            alert("Error al obtener recursos del servidor");
            return;
        }
        var tabla = document.getElementById("tablaRecursos");
        tabla.innerHTML = "";
        if (lista.length == 0) {
            tabla.innerHTML = "<tr><td colspan='7'>No hay resultados</td></tr>";
            return;
        }
        function nombrePorId(array, id) {
            if (!array) return id;
            for (var i = 0; i < array.length; i++) {
                if (array[i].id == id) return array[i].nombre;
            }
            return id;
        }
        for (var i = 0; i < lista.length; i++) {
            var r = lista[i];
            var modeloObj = null;
            for (var j = 0; j < window.modelos.length; j++) {
                if (window.modelos[j].id == r.modelo) {
                    modeloObj = window.modelos[j];
                    break;
                }
            }
            var categoriaId = modeloObj ? modeloObj.categoria : null;
            var categoriaNombre = nombrePorId(window.categorias, categoriaId);
            var modeloNombre = nombrePorId(window.modelos, r.modelo);
            var ubicacionNombre = nombrePorId(window.ubicaciones, r.ubicacion);
            var estadoTexto = "";
            if (r.estado == 0) estadoTexto = "Operativo";
            else if (r.estado == 1) estadoTexto = "Baja";
            else if (r.estado == 2) estadoTexto = "Mantenimiento";
            else estadoTexto = "Desconocido";
            tabla.innerHTML += "<tr>" +
                "<td>" + r.numero_serie + "</td>" +
                "<td>" + categoriaNombre + "</td>" +
                "<td>" + modeloNombre + "</td>" +
                "<td>" + ubicacionNombre + "</td>" +
                "<td>" + estadoTexto + "</td>" +
                "<td><button onclick='verFicha(" + r.id + ")'>Abrir</button></td>" +
                "<td><button onclick='borrarRecurso(" + r.id + ")'>Borrar</button></td>" +
            "</tr>";
        }
    });
}

function logout() {
    if (ws) ws.close();
    idgestor = null;
        window.token = null;

    cambiarSeccion("login");
}

function registrarse() {
    origen = "login";
    idgestor = null;
    document.getElementById("tituloRegistro").innerHTML = "Registro de Gestor";
    document.getElementById("nombre").value = "";
    document.getElementById("apellidos").value = "";
    document.getElementById("usu").value = "";
    document.getElementById("pass").value = "";
    cambiarSeccion("registro");
}

function editardatos() {
    origen = "inicio";
    document.getElementById("tituloRegistro").innerHTML = "Editar mis datos";
    rest.get("/api/gestores/" + idgestor, function(status, gestor) {
        if (status == 200) {
            document.getElementById("nombre").value = gestor.nombre;
            document.getElementById("apellidos").value = gestor.apellidos;
            document.getElementById("usu").value = gestor.usuario;
            document.getElementById("pass").value = "";
            cambiarSeccion("registro");
        }
    });
}

function guardar() {
    var datosParaEnviar = {
        nombre: document.getElementById("nombre").value,
        apellidos: document.getElementById("apellidos").value,
        usuario: document.getElementById("usu").value,
        password: document.getElementById("pass").value
    };
    if (idgestor == null) {
        rest.post("/api/gestores", datosParaEnviar, function(status, respuesta) {
            if (status == 201) { 
                alert("Gestor creado con éxito");
                cambiarSeccion("login"); 
            } else {
                alert("Error al crear: " + respuesta);
            }
        });
    } else {
        rest.put("/api/gestores/" + idgestor, datosParaEnviar, function(status, respuesta) {
            if (status == 200) { 
                alert("Datos actualizados");
                document.getElementById("bienvenida").innerHTML = 
                    "Bienvenido " + datosParaEnviar.nombre + " " + datosParaEnviar.apellidos;
                cambiarSeccion("inicio"); 
            } else {
                alert("Error al actualizar: " + respuesta);
            }
        });
    }
}

function cancelar() {
    if (origen === "inicio") {
        cambiarSeccion("inicio");
    } else {
        cambiarSeccion("login");
    }
    origen = null;
}

function nuevoRecurso() {
    idRecursoActual = null;
    document.getElementById("rSerie").value = "";
    llenarSelectoresFicha();
    cambiarSeccion("ficha");
}

function verFicha(id) {
    idRecursoActual = id;
    llenarSelectoresFicha();
    rest.get("/api/recursos/" + id, function(status, recurso) {
        if (status == 200) {
            document.getElementById("rSerie").value = recurso.numero_serie;
            document.getElementById("rCategoria").value = obtenerCategoriaPorModelo(recurso.modelo);
            document.getElementById("rModelo").value = recurso.modelo;
            document.getElementById("rUbicacion").value = recurso.ubicacion;
            document.getElementById("rEstado").value = recurso.estado;
        }
    });
    cargarReservas(id);
    cargarResenyas(id);
    cambiarSeccion("ficha");
}

function obtenerCategoriaPorModelo(idModelo) {
    var modelo = window.modelos.find(m => m.id == idModelo);
    return modelo ? modelo.categoria : "";
}

function llenarSelectoresFicha() {
    rest.get("/api/categorias", function(status, lista) {
        var sel = document.getElementById("rCategoria");
        sel.innerHTML = "";
        lista.forEach(item => {
            sel.innerHTML += `<option value="${item.id}">${item.nombre}</option>`;
        });
    });
    rest.get("/api/modelos", function(status, lista) {
        var sel = document.getElementById("rModelo");
        sel.innerHTML = "";
        lista.forEach(item => {
            sel.innerHTML += `<option value="${item.id}">${item.nombre}</option>`;
        });
    });
    rest.get("/api/ubicaciones", function(status, lista) {
        var sel = document.getElementById("rUbicacion");
        sel.innerHTML = "";
        lista.forEach(item => {
            sel.innerHTML += `<option value="${item.id}">${item.nombre}</option>`;
        });
    });
}

function cargarReservas(id) {
    rest.get("/api/recursos/" + id + "/reservas", function(status, listaReservas) {
        if (status != 200) {
            console.error("Error al cargar reservas");
            return;
        }
        var tabla = document.getElementById("tablaReservasFicha");
        tabla.innerHTML = "";
        if (!listaReservas || listaReservas.length === 0) {
            tabla.innerHTML = "<tr><td colspan='5'>No hay reservas</td></tr>";
            return;
        }
        var ahora = new Date();
        var html = "";
        var procesadas = 0;
        function determinarColor(reserva) {
            if (reserva.fecha_fin) return "finalizada";
            else if (!reserva.fecha_inicio) return "pendiente";
            else {
                var fechaInicio = new Date(reserva.fecha_inicio);
                var horasUso = (ahora - fechaInicio) / (1000 * 60 * 60);
                if (horasUso > reserva.horas_estimadas) return "enuso-excedido";
                else return "enuso-normal";
            }
        }
        for (var i = 0; i < listaReservas.length; i++) {
            var res = listaReservas[i];
            rest.get("/api/sanitarios/" + res.sanitario, function(index) {
                return function(statusSan, sanitario) {
                    var resActual = listaReservas[index];
                    var fechaPeticion = new Date(resActual.fecha_peticion).toLocaleString();
                    var fechaInicio = resActual.fecha_inicio ? new Date(resActual.fecha_inicio).toLocaleString() : '';
                    var fechaFin = resActual.fecha_fin ? new Date(resActual.fecha_fin).toLocaleString() : '';
                    var nombreSanitario = "Sanitario " + resActual.sanitario;
                    if (statusSan == 200 && sanitario) {
                        nombreSanitario = sanitario.nombre + " " + sanitario.apellidos;
                    }
                    var color = determinarColor(resActual);
                    html += "<tr class='" + color + "'>" +
                        "<td>" + nombreSanitario + "</td>" +
                        "<td>" + resActual.horas_estimadas + "h</td>" +
                        "<td>" + fechaPeticion + "</td>" +
                        "<td>" + fechaInicio + "</td>" +
                        "<td>" + fechaFin + "</td>" +
                        "<td><button onclick='verTotalPartes(" + resActual.recurso + ")'>Partes</button></td>" +
                    "</tr>";
                    procesadas++;
                    if (procesadas === listaReservas.length) {
                        tabla.innerHTML = html;
                    }
                };
            }(i));
        }
    });
}



function cargarResenyas(id) {
    rest.get("/api/recursos/" + id + "/resenyas", function(status, listaResenyas) {
        if (status != 200) {
            console.error("Error al cargar reseñas");
            return;
        }
        var contenedor = document.getElementById("listaResenyasFicha");
        var html = '<table border="1" style="width:100%; border-collapse:collapse;">';
        html += '<thead><tr><th>Fecha</th><th>Sanitario</th><th>Valoración</th><th>Comentario</th></tr></thead>';
        html += '<tbody>';
        if (!listaResenyas || listaResenyas.length === 0) {
            html += '<tr><td colspan="4" style="text-align:center;">No hay reseñas todavía</td></tr>';
            html += '</tbody></table>';
            contenedor.innerHTML = html;
            return;
        }
        var procesadas = 0;
        var filas = [];
        for (var i = 0; i < listaResenyas.length; i++) {
            var res = listaResenyas[i];
            rest.get("/api/sanitarios/" + res.sanitario, function(index) {
                return function(statusSan, sanitario) {
                    var resActual = listaResenyas[index];
                    var fecha = new Date(resActual.fecha).toLocaleString();
                    var nombreSanitario = "Sanitario " + resActual.sanitario;
                    if (statusSan == 200 && sanitario) {
                        nombreSanitario = sanitario.nombre + " " + sanitario.apellidos;
                    }
                    var valoracionTexto = resActual.valor + "/5";
                    filas[index] = '<tr>' +
                        '<td>' + fecha + '</td>' +
                        '<td>' + nombreSanitario + '</td>' +
                        '<td style="text-align:center;">' + valoracionTexto + '</td>' +
                        '<td>' + resActual.descripcion + '</td>' +
                    '</tr>';
                    procesadas++;
                    if (procesadas === listaResenyas.length) {
                        for (var j = 0; j < filas.length; j++) {
                            html += filas[j];
                        }
                        html += '</tbody></table>';
                        contenedor.innerHTML = html;
                    }
                };
            }(i));
        }
    });
}

function guardarRecurso() {
    var datos = {
        modelo: parseInt(document.getElementById("rModelo").value),
        numero_serie: document.getElementById("rSerie").value,
        ubicacion: parseInt(document.getElementById("rUbicacion").value),
        estado: parseInt(document.getElementById("rEstado").value)
    };
    if (idRecursoActual == null) {
        rest.post("/api/recursos", datos, function(status, respuesta) {
            if (status == 201) {
                rest.get("/api/modelos", function(sMod, modelos) {
                    var modelo = modelos.find(m => m.id === datos.modelo);
                    rest.get("/api/categorias", function(sCat, categorias) {
                        var categoria = categorias.find(c => c.id === modelo.categoria);
                        var textoAviso = `SE HA CREADO UN NUEVO RECURSO ${categoria.nombre} MODELO ${modelo.nombre} CON CÓDIGO ${datos.numero_serie}`;
                        enviarAvisoNuevoRecurso(textoAviso);
                    });
                });
                alert("Recurso creado");
                cambiarSeccion("inicio");
                buscar();
            } else {
                alert("Error al crear recurso");
            }
        });
    } else {
        rest.put("/api/recursos/" + idRecursoActual, datos, function(status) {
            if (status == 200) {
                alert("Recurso actualizado");
                cambiarSeccion("inicio");
                buscar();
            } else {
                alert("Error al actualizar recurso");
            }
        });
    }
}

function borrarRecurso(id) {
    if (confirm("¿Seguro que quieres borrar este recurso?")) {
        rest.delete("/api/recursos/" + id, function(status) {
            if (status == 200) {
                
                alert("Recurso eliminado");
                buscar();
            } else {
                alert("Error al borrar recurso");
            }
        });
    }
}




function verTotalPartes(idRecurso) {
    totalPartes(idRecurso, function(total) {
        alert("Total de partes: " + total);
    });
}


var MINISTERIO = "https://undefined.ua.es/telemedicina/api/datos"; 
var id_area = 11; 

var AREAS = ["", "Alergología", "Anestesiología", "Cardiología", "Cirugía General", "Dermatología",
    "Aparato Digestivo", "Endocrinología", "Ginecología", "Hematología", "Medicina Interna",
    "Neumología", "Neurología", "Oftalmología", "Oncología", "Pediatría", "Psiquiatría",
    "Traumatología", "Urología"];

function enviarMinisterio() {
    if (!confirm("Se enviarán todas las reservas al Ministerio. ¿Continuar?")) return;
    rest.get("/api/recursos", function (estado, recursos) {
        if (estado != 200) {
            alert("Error al obtener los recursos");
            return;
        }
        var realizadas = [];
        var faltan = recursos.length;
        if (faltan === 0) {
            alert("No hay recursos");
            return;
        }
        recursos.forEach(function (rec) {
            rest.get("/api/recursos/" + rec.id + "/reservas", function (st, lista) {
                if (st == 200) {
                    lista.forEach(function (r) {
                        if (r.fecha_inicio) realizadas.push({ reserva: r, recurso: rec });
                    });
                }
                faltan--;
                if (faltan === 0) agruparPorArea(realizadas);
            });
        });
    });
}


function cargarRanking() {
    var tabla = document.getElementById("tablaRanking");
    rest.get(MINISTERIO, function (estado, datos) {
        if (estado != 200 || datos === null || typeof datos !== "object") {
            tabla.innerHTML = "<tr><td colspan='3'>No se pudo obtener el ranking</td></tr>";
            return;
        }
        console.log("Respuesta del Ministerio:", datos);

        var total = {};
        function sumar(idArea, n) {
            idArea = parseInt(idArea);
            if (!(idArea >= 1 && idArea <= 18)) return;                
            if (typeof n !== "number" || !isFinite(n) || n < 0) return; 
            total[idArea] = (total[idArea] || 0) + n;
        }
        function contar(idArea, v) {
            if (v === null || typeof v !== "object") return;
            if (Array.isArray(v.datos)) sumar(idArea, v.datos.length);  
            else if (v.nombre !== undefined) sumar(idArea, 1);          
        }

        if (Array.isArray(datos)) {
            datos.forEach(function (e) { if (e) contar(e.id_area, e); });
        } else {
            Object.keys(datos).forEach(function (k) {
                var v = datos[k];
                if (Array.isArray(v)) v.forEach(function (x) { contar(k, x); });
                else contar(k, v);
            });
        }

                var lista = [];
        for (var a = 1; a <= 18; a++) {
            lista.push({ area: a, total: total[a] || 0 });
        }
        lista.sort(function (a, b) { return b.total - a.total || a.area - b.area; });

        var html = "";
        for (var i = 0; i < lista.length; i++) {
            html += "<tr><td>" + (i + 1) + "</td>" +
                "<td>" + AREAS[lista[i].area] + "</td>" +
                "<td>" + lista[i].total + "</td></tr>";
        }
        tabla.innerHTML = html || "<tr><td colspan='3'>Sin datos</td></tr>";
    });
}

function categoriaDeModelo(idModelo) {
    var modelo = window.modelos.find(function (m) { return m.id == idModelo; });
    if (!modelo) return "";
    var cat = window.categorias.find(function (c) { return c.id == modelo.categoria; });
    return cat ? cat.nombre : "";
}

function agruparPorArea(realizadas) {
    if (realizadas.length === 0) {
        alert("No hay reservas realizadas que enviar");
        return;
    }
    var porArea = {};
    porArea[id_area] = [];
    var errores = 0;
    var faltan = realizadas.length;
    realizadas.forEach(function (item) {
        rest.get("/api/sanitarios/" + item.reserva.sanitario, function (st, san) {
            if (st == 200 && san) {
                porArea[id_area].push({
                    nombre: san.nombre,
                    apellidos: san.apellidos,
                    "categoría": categoriaDeModelo(item.recurso.modelo),
                    horas_estimadas: item.reserva.horas_estimadas,
                    fec_pet: item.reserva.fecha_peticion,
                    fec_ini: item.reserva.fecha_inicio,
                    fecha_fin: item.reserva.fecha_fin
                });
            } else {
                errores++;
            }
            faltan--;
            if (faltan === 0) {
                if (errores > 0) alert(errores + " reserva(s) no se enviarán porque no se pudo obtener el sanitario");
                if (porArea[id_area].length === 0) return;
                enviarPorAreas(porArea);
            }
        });
    });
}

function enviarPorAreas(porArea) {
    var ids = Object.keys(porArea);
    if (ids.length === 0) {
        alert("No se pudo obtener el área de los sanitarios");
        return;
    }
    var hoy = new Date().toLocaleDateString("sv-SE");      var faltan = ids.length;
    var fallos = 0;
    ids.forEach(function (id) {
        var cuerpo = { id_area: parseInt(id), fecha: hoy, datos: porArea[id] };
        rest.post(MINISTERIO, cuerpo, function (estado) {
            if (estado < 200 || estado >= 300) fallos++;
            faltan--;
            if (faltan === 0) {
                cargarRanking()
                alert(fallos > 0 ? "Fallaron " + fallos + " envíos al Ministerio" : "Reservas enviadas al Ministerio");
            }
        });
    });
}














