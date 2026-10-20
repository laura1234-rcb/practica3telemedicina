var express = require("express");
var app = express();

// 1. Importar el cliente de Supabase
const { createClient } = require("@supabase/supabase-js");

// 2. Configurar con tu URL y tu Public Key (anon key)
const supabaseUrl = "https://tu-proyecto.supabase.co";
const supabaseKey = "TU_PUBLIC_ANON_KEY_AQUI"; // <--- Pega aquí tu public key
const supabase = createClient(supabaseUrl, supabaseKey);

var jwt = require("jwt-simple");
var clave = "miClaveSecretaDelGestor";

app.use("/appCliente", express.static("cliente_rest"));
app.use(express.json());
app.use("/rpc", express.static("cliente_rpc"));
app.use("/rest", express.static("cliente_rest"));

// La raíz redirige a la app
app.get("/", (req, res) => res.redirect("/appCliente/"));

// ------------------- GESTORES -------------------

app.post("/api/gestores/login", async (req, res) => {
    const { data, error } = await supabase
        .from("gestores")
        .select("id")
        .eq("usuario", req.body.login)
        .eq("password", req.body.password);

    if (error) {
        console.log("Error en login gestor:", error);
        return res.status(500).json("Error en la consulta");
    }
    if (data.length === 1) {
        var contenido = {
            usuario: data[0].id,
            expira: Date.now() + 60 * 60 * 1000
        };
        var token = jwt.encode(contenido, clave);
        res.status(200).json({ id: data[0].id, token: token });
    } else {
        res.status(403).json("Login incorrecto");
    }
});

app.post("/api/gestores", async (req, res) => {
    const existe = await supabase
        .from("gestores")
        .select("id")
        .eq("usuario", req.body.usuario);

    if (existe.error) {
        return res.status(500).json("Error en la consulta");
    }
    if (existe.data.length > 0) {
        return res.status(403).json("Usuario ya existe");
    }

    const { error } = await supabase.from("gestores").insert({
        nombre: req.body.nombre,
        apellidos: req.body.apellidos,
        usuario: req.body.usuario,
        password: req.body.password
    });

    if (error) {
        console.log("Error al crear gestor:", error);
        return res.status(500).json("Error al crear el gestor");
    }
    res.status(201).json("Gestor creado");
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

app.put("/api/gestores/:id", async (req, res) => {
    var id = req.params.id;

    const existe = await supabase
        .from("gestores")
        .select("id")
        .eq("usuario", req.body.usuario)
        .neq("id", id);

    if (existe.error) {
        return res.status(500).json("Error en la consulta");
    }
    if (existe.data.length > 0) {
        return res.status(403).json("Usuario ya existe");
    }

    var cambios = {
        nombre: req.body.nombre,
        apellidos: req.body.apellidos,
        usuario: req.body.usuario
    };
    if (req.body.password) {
        cambios.password = req.body.password;
    }

    const { data, error } = await supabase
        .from("gestores")
        .update(cambios)
        .eq("id", id)
        .select("id");

    if (error) {
        return res.status(500).json("Error al actualizar el gestor");
    }
    if (data.length === 0) {
        return res.status(404).json("Gestor no encontrado");
    }
    res.status(200).json("Gestor actualizado");
});

app.get("/api/gestores/:id", async (req, res) => {
    const { data, error } = await supabase
        .from("gestores")
        .select("id, nombre, apellidos, usuario")
        .eq("id", req.params.id);

    if (error) {
        return res.status(500).json("Error en la consulta");
    }
    if (data.length === 1) {
        res.status(200).json(data[0]);
    } else {
        res.status(404).json("Gestor no encontrado");
    }
});

// ------------------- SANITARIOS -------------------

app.get("/api/sanitarios/:id", async (req, res) => {
    const { data, error } = await supabase
        .from("sanitarios")
        .select("id, nombre, apellidos, usuario")
        .eq("id", req.params.id);

    if (error) {
        console.log("Error sanitario:", error.message);
        return res.status(500).json("Error en la consulta");
    }
    if (data.length === 1) {
        res.status(200).json(data[0]);
    } else {
        res.status(404).json("Sanitario no encontrado");
    }
});

// ------------------- LISTADOS FIJOS -------------------

app.get("/api/ubicaciones", async (req, res) => {
    const { data, error } = await supabase.from("ubicaciones").select("*");
    if (error) {
        return res.status(500).json("Error en la consulta");
    }
    res.status(200).json(data);
});

app.get("/api/categorias", async (req, res) => {
    const { data, error } = await supabase.from("categorias").select("*");
    if (error) {
        return res.status(500).json("Error en la consulta");
    }
    res.status(200).json(data);
});

app.get("/api/modelos", async (req, res) => {
    const { data, error } = await supabase.from("modelos").select("*");
    if (error) {
        return res.status(500).json("Error en la consulta");
    }
    res.status(200).json(data);
});

// ------------------- RECURSOS -------------------

app.get("/api/recursos", async (req, res) => {
    var q = req.query;
    var consulta;

    if (q.categoria && q.categoria !== "") {
        // Equivale al INNER JOIN con modelos
        consulta = supabase
            .from("recurso")
            .select("*, modelos!inner(categoria)")
            .eq("modelos.categoria", q.categoria);
    } else {
        consulta = supabase.from("recurso").select("*");
    }

    if (q.modelo && q.modelo !== "") {
        consulta = consulta.eq("modelo", q.modelo);
    }
    if (q.ubicacion && q.ubicacion !== "") {
        consulta = consulta.eq("ubicacion", q.ubicacion);
    }
    if (q.estado && q.estado !== "") {
        consulta = consulta.eq("estado", q.estado);
    }

    const { data, error } = await consulta;

    if (error) {
        console.log("Error al buscar recursos:", error);
        return res.status(500).json("Error en la consulta");
    }
    // Quita el campo "modelos" que añade el join
    var filas = data.map(function (fila) {
        var { modelos, ...resto } = fila;
        return resto;
    });
    res.status(200).json(filas);
});

app.get("/api/recursos/:id/reservas", async (req, res) => {
    const { data, error } = await supabase
        .from("reservas")
        .select("*")
        .eq("recurso", req.params.id);

    if (error) {
        return res.status(500).json("Error en la consulta");
    }
    res.status(200).json(data);
});

app.get("/api/recursos/:id/resenyas", async (req, res) => {
    const { data, error } = await supabase
        .from("resenyas")
        .select("*")
        .eq("recurso", req.params.id);

    if (error) {
        return res.status(500).json("Error en la consulta");
    }
    res.status(200).json(data);
});

app.get("/api/recursos/:id/partes", async (req, res) => {
    const { count, error } = await supabase
        .from("partes_mantenimiento")
        .select("*", { count: "exact", head: true })
        .eq("recurso", req.params.id);

    if (error) {
        return res.status(500).json("Error en la consulta");
    }
    res.status(200).json(count);
});

app.get("/api/recursos/:id", async (req, res) => {
    const { data, error } = await supabase
        .from("recurso")
        .select("*")
        .eq("id", req.params.id);

    if (error) {
        return res.status(500).json("Error en la consulta");
    }
    if (data.length === 1) {
        res.status(200).json(data[0]);
    } else {
        res.status(404).json("Recurso no encontrado");
    }
});

app.post("/api/recursos", async (req, res) => {
    var nuevo = req.body;
    if (!nuevo.modelo || !nuevo.numero_serie || !nuevo.ubicacion || nuevo.estado === undefined) {
        return res.status(400).json("Faltan datos obligatorios");
    }

    const { data, error } = await supabase
        .from("recurso")
        .insert({
            modelo: nuevo.modelo,
            ubicacion: nuevo.ubicacion,
            numero_serie: nuevo.numero_serie,
            estado: nuevo.estado
        })
        .select("id");

    if (error) {
        console.log("Error al crear recurso:", error);
        return res.status(500).json("Error al crear el recurso");
    }
    res.status(201).json(data[0].id);
});

app.put("/api/recursos/:id", async (req, res) => {
    const { data, error } = await supabase
        .from("recurso")
        .update({
            modelo: req.body.modelo,
            ubicacion: req.body.ubicacion,
            numero_serie: req.body.numero_serie,
            estado: req.body.estado
        })
        .eq("id", req.params.id)
        .select("id");

    if (error) {
        return res.status(500).json("Error al actualizar el recurso");
    }
    if (data.length === 0) {
        return res.status(404).json("Recurso no existe");
    }
    res.status(200).json("Recurso actualizado");
});

app.delete("/api/recursos/:id", async (req, res) => {
    const { data, error } = await supabase
        .from("recurso")
        .delete()
        .eq("id", req.params.id)
        .select("id");

    if (error) {
        return res.status(500).json("Error al borrar el recurso");
    }
    if (data.length === 0) {
        return res.status(404).json("Recurso no encontrado");
    }
    res.status(200).json("Recurso borrado");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
    console.log("Servidor REST en puerto " + PORT);
});
