var express = require("express");
var app = express();

var conexion = require("./conexion_mysql.js");

var jwt = require("jwt-simple");
var clave = "miClaveSecretaDelGestor";

app.use("/appCliente", express.static("cliente"));
app.use(express.json());
app.use("/rpc", express.static("cliente_rpc"));
app.use("/rest", express.static("cliente_rest"));

// ------------------- GESTORES -------------------

app.post("/api/gestores/login", function (req, res) {
    var login = req.body.login;
    var password = req.body.password;
    conexion.query(
        "SELECT id FROM gestores WHERE usuario = ? AND password = ?",
        [login, password],
        function (err, filas) {
            if (err) {
                console.log("Error en login gestor:", err);
                res.status(500).json("Error en la consulta");
                return;
            }
            if (filas.length === 1) {
                var contenido = {
                    usuario: filas[0].id,
                    expira: Date.now() + 60 * 60 * 1000
                };
                var token = jwt.encode(contenido, clave);
                res.status(200).json({ id: filas[0].id, token: token });
            } else {
                res.status(403).json("Login incorrecto");
            }
        }
    );
});

app.post("/api/gestores", function (req, res) {
    conexion.query(
        "SELECT id FROM gestores WHERE usuario = ?",
        [req.body.usuario],
        function (err, filas) {
            if (err) {
                res.status(500).json("Error en la consulta");
                return;
            }
            if (filas.length > 0) {
                res.status(403).json("Usuario ya existe");
                return;
            }
            var sql = "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES (?, ?, ?, ?)";
            var valores = [req.body.nombre, req.body.apellidos, req.body.usuario, req.body.password];
            conexion.query(sql, valores, function (err, resultado) {
                if (err) {
                    console.log("Error al crear gestor:", err);
                    res.status(500).json("Error al crear el gestor");
                    return;
                }
                res.status(201).json("Gestor creado");
            });
        }
    );
});

// Desde aquí, todas las rutas /api necesitan token
app.use("/api", function (req, res, next) {
    var token = req.query.token;
    if (!token) {
        res.status(401).json("No se ha encontrado token");
        return;
    }
    try {
        var contenidoToken = jwt.decode(token, clave);
    } catch (error) {
        res.status(401).json("El token es incorrecto");
        return;
    }
    if (!contenidoToken || !contenidoToken.expira || !contenidoToken.usuario) {
        res.status(401).json("El formato del token no es adecuado");
        return;
    }
    if (contenidoToken.expira < Date.now()) {
        res.status(401).json("El token ha expirado");
        return;
    }
    next();
});

app.put("/api/gestores/:id", function (req, res) {
    var id = req.params.id;
    conexion.query(
        "SELECT id FROM gestores WHERE usuario = ? AND id <> ?",
        [req.body.usuario, id],
        function (err, filas) {
            if (err) {
                res.status(500).json("Error en la consulta");
                return;
            }
            if (filas.length > 0) {
                res.status(403).json("Usuario ya existe");
                return;
            }

            var sql, valores;
            if (req.body.password) {
                sql = "UPDATE gestores SET nombre = ?, apellidos = ?, usuario = ?, password = ? WHERE id = ?";
                valores = [req.body.nombre, req.body.apellidos, req.body.usuario, req.body.password, id];
            } else {
                sql = "UPDATE gestores SET nombre = ?, apellidos = ?, usuario = ? WHERE id = ?";
                valores = [req.body.nombre, req.body.apellidos, req.body.usuario, id];
            }

            conexion.query(sql, valores, function (err, resultado) {
                if (err) {
                    res.status(500).json("Error al actualizar el gestor");
                    return;
                }
                if (resultado.affectedRows === 0) {
                    res.status(404).json("Gestor no encontrado");
                    return;
                }
                res.status(200).json("Gestor actualizado");
            });
        }
    );
});

app.get("/api/gestores/:id", function (req, res) {
    conexion.query(
        "SELECT id, nombre, apellidos, usuario FROM gestores WHERE id = ?",
        [req.params.id],
        function (err, filas) {
            if (err) {
                res.status(500).json("Error en la consulta");
                return;
            }
            if (filas.length === 1) {
                res.status(200).json(filas[0]);
            } else {
                res.status(404).json("Gestor no encontrado");
            }
        }
    );
});

// ------------------- SANITARIOS -------------------

app.get("/api/sanitarios/:id", function (req, res) {
    conexion.query(
        "SELECT id, nombre, apellidos, usuario FROM sanitarios WHERE id = ?",
        [req.params.id],
        function (err, filas) {
            if (err) {
                console.log("Error sanitario:", err.message);
                res.status(500).json("Error en la consulta");
                return;
            }
            if (filas.length === 1) {
                res.status(200).json(filas[0]);
            } else {
                res.status(404).json("Sanitario no encontrado");
            }
        }
    );
});

// ------------------- LISTADOS FIJOS -------------------

app.get("/api/ubicaciones", function (req, res) {
    conexion.query("SELECT * FROM ubicaciones", function (err, filas) {
        if (err) {
            res.status(500).json("Error en la consulta");
            return;
        }
        res.status(200).json(filas);
    });
});

app.get("/api/categorias", function (req, res) {
    conexion.query("SELECT * FROM categorias", function (err, filas) {
        if (err) {
            res.status(500).json("Error en la consulta");
            return;
        }
        res.status(200).json(filas);
    });
});

app.get("/api/modelos", function (req, res) {
    conexion.query("SELECT * FROM modelos", function (err, filas) {
        if (err) {
            res.status(500).json("Error en la consulta");
            return;
        }
        res.status(200).json(filas);
    });
});

// ------------------- RECURSOS -------------------

app.get("/api/recursos", function (req, res) {
    var condiciones = [];
    var valores = [];
    var sql = "SELECT recurso.* FROM recurso";

    if (req.query.categoria && req.query.categoria !== "") {
        sql += " INNER JOIN modelos ON recurso.modelo = modelos.id";
        condiciones.push("modelos.categoria = ?");
        valores.push(req.query.categoria);
    }
    if (req.query.modelo && req.query.modelo !== "") {
        condiciones.push("recurso.modelo = ?");
        valores.push(req.query.modelo);
    }
    if (req.query.ubicacion && req.query.ubicacion !== "") {
        condiciones.push("recurso.ubicacion = ?");
        valores.push(req.query.ubicacion);
    }
    if (req.query.estado && req.query.estado !== "") {
        condiciones.push("recurso.estado = ?");
        valores.push(req.query.estado);
    }

    if (condiciones.length > 0) {
        sql += " WHERE " + condiciones.join(" AND ");
    }

    conexion.query(sql, valores, function (err, filas) {
        if (err) {
            console.log("Error al buscar recursos:", err);
            res.status(500).json("Error en la consulta");
            return;
        }
        res.status(200).json(filas);
    });
});

app.get("/api/recursos/:id/reservas", function (req, res) {
    conexion.query(
        "SELECT * FROM reservas WHERE recurso = ?",
        [req.params.id],
        function (err, filas) {
            if (err) {
                res.status(500).json("Error en la consulta");
                return;
            }
            res.status(200).json(filas);
        }
    );
});

app.get("/api/recursos/:id/resenyas", function (req, res) {
    conexion.query(
        "SELECT * FROM resenyas WHERE recurso = ?",
        [req.params.id],
        function (err, filas) {
            if (err) {
                res.status(500).json("Error en la consulta");
                return;
            }
            res.status(200).json(filas);
        }
    );
});


app.get("/api/recursos/:id/partes", function (req, res) {
    conexion.query(
        "SELECT COUNT(*) AS total FROM partes_mantenimiento WHERE recurso = ?",
        [req.params.id],
        function (err, filas) {
            if (err) {
                res.status(500).json("Error en la consulta");
                return;
            }
            res.status(200).json(Number(filas[0].total));
        }
    );
});

app.get("/api/recursos/:id", function (req, res) {
    conexion.query(
        "SELECT * FROM recurso WHERE id = ?",
        [req.params.id],
        function (err, filas) {
            if (err) {
                res.status(500).json("Error en la consulta");
                return;
            }
            if (filas.length === 1) {
                res.status(200).json(filas[0]);
            } else {
                res.status(404).json("Recurso no encontrado");
            }
        }
    );
});

app.post("/api/recursos", function (req, res) {
    var nuevo = req.body;
    if (!nuevo.modelo || !nuevo.numero_serie || !nuevo.ubicacion || nuevo.estado === undefined) {
        res.status(400).json("Faltan datos obligatorios");
        return;
    }
    var sql = "INSERT INTO recurso (modelo, ubicacion, numero_serie, estado) VALUES (?, ?, ?, ?)";
    var valores = [nuevo.modelo, nuevo.ubicacion, nuevo.numero_serie, nuevo.estado];
    conexion.query(sql, valores, function (err, resultado) {
        if (err) {
            console.log("Error al crear recurso:", err);
            res.status(500).json("Error al crear el recurso");
            return;
        }
        res.status(201).json(resultado.insertId);
    });
});

app.put("/api/recursos/:id", function (req, res) {
    var id = req.params.id;
    var sql = "UPDATE recurso SET modelo = ?, ubicacion = ?, numero_serie = ?, estado = ? WHERE id = ?";
    var valores = [req.body.modelo, req.body.ubicacion, req.body.numero_serie, req.body.estado, id];
    conexion.query(sql, valores, function (err, resultado) {
        if (err) {
            res.status(500).json("Error al actualizar el recurso");
            return;
        }
        if (resultado.affectedRows === 0) {
            res.status(404).json("Recurso no existe");
            return;
        }
        res.status(200).json("Recurso actualizado");
    });
});

app.delete("/api/recursos/:id", function (req, res) {
    conexion.query(
        "DELETE FROM recurso WHERE id = ?",
        [req.params.id],
        function (err, resultado) {
            if (err) {
                res.status(500).json("Error al borrar el recurso");
                return;
            }
            if (resultado.affectedRows === 0) {
                res.status(404).json("Recurso no encontrado");
                return;
            }
            res.status(200).json("Recurso borrado");
        }
    );
});



app.listen(3000, function () {
    console.log("Servidor REST en puerto 3000");
});


