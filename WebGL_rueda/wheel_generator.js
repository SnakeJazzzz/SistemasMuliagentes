// Michael Devlyn A01781041
// Para ejecutar ingresar en terminal: node wheel_generator.js [número_de_lados] [radio] [ancho]

const fs = require('fs');

// Obtener los argumentos de línea de comandos
let args = process.argv.slice(2);

let nSides = 8;  // Número de lados por defecto
let radius = 1;  // Radio por defecto
let width = 0.5; // Ancho por defecto

// Validar y asignar los argumentos proporcionados
if (args.length >= 1) {
    let n = parseInt(args[0]);
    if (n >= 3 && n <= 360) {
        nSides = n;
    } else {
        console.error('El número de lados debe ser un entero entre 3 y 360.');
        process.exit(1);
    }
}

if (args.length >= 2) {
    let r = parseFloat(args[1]);
    if (r > 0) {
        radius = r;
    } else {
        console.error('El radio debe ser un número flotante positivo.');
        process.exit(1);
    }
}

if (args.length >= 3) {
    let w = parseFloat(args[2]);
    if (w > 0) {
        width = w;
    } else {
        console.error('El ancho debe ser un número flotante positivo.');
        process.exit(1);
    }
}

//wheel_generator.js
// Arrays para almacenar vértices, normales y caras
let vertices = [];
let normals = [];
let faces = [];

// Generar los vértices
let angleStep = (2 * Math.PI) / nSides;

// Vértices del frente y atrás
for (let i = 0; i < nSides; i++) {
    let angle = i * angleStep;
    let x = radius * Math.cos(angle);
    let y = radius * Math.sin(angle);

    // Cara frontal (z = width/2)
    vertices.push([x, y, width / 2]);

    // Cara trasera (z = -width/2)
    vertices.push([x, y, -width / 2]);
}

// Vértices centrales para las tapas frontal y trasera
vertices.push([0, 0, width / 2]);   // Centro frontal
vertices.push([0, 0, -width / 2]);  // Centro trasero

let centerFrontIndex = vertices.length - 2;
let centerBackIndex = vertices.length - 1;

// Generar las caras laterales (cintura)
for (let i = 0; i < nSides; i++) {
    let next = (i + 1) % nSides;

    // Índices de los vértices
    let v1 = i * 2;          // Cara frontal actual
    let v2 = next * 2;       // Cara frontal siguiente
    let v3 = next * 2 + 1;   // Cara trasera siguiente
    let v4 = i * 2 + 1;      // Cara trasera actual

    // Primera cara del cuadrilátero lateral (triángulo v1, v2, v3)
    let normal1 = calculateNormal(vertices[v1], vertices[v2], vertices[v3]);
    normals.push(normal1);
    let normalIndex1 = normals.length - 1;

    faces.push({
        vertices: [v1, v2, v3],
        normals: [normalIndex1, normalIndex1, normalIndex1],
    });

    // Segunda cara del cuadrilátero lateral (triángulo v1, v3, v4)
    let normal2 = calculateNormal(vertices[v1], vertices[v3], vertices[v4]);
    normals.push(normal2);
    let normalIndex2 = normals.length - 1;

    faces.push({
        vertices: [v1, v3, v4],
        normals: [normalIndex2, normalIndex2, normalIndex2],
    });
}

// Generar las caras frontal y trasera
// Normal frontal (0, 0, 1)
normals.push([0, 0, 1]);
let normalFrontIndex = normals.length - 1;

// Caras frontales
for (let i = 0; i < nSides; i++) {
    let next = (i + 1) % nSides;

    let v1 = centerFrontIndex;   // Centro frontal
    let v2 = i * 2;              // Cara frontal actual
    let v3 = next * 2;           // Cara frontal siguiente

    faces.push({
        vertices: [v1, v2, v3],
        normals: [normalFrontIndex, normalFrontIndex, normalFrontIndex],
    });
}

// Normal trasera (0, 0, -1)
normals.push([0, 0, -1]);
let normalBackIndex = normals.length - 1;

// Caras traseras
for (let i = 0; i < nSides; i++) {
    let next = (i + 1) % nSides;

    let v1 = centerBackIndex;    // Centro trasero
    let v2 = next * 2 + 1;       // Cara trasera siguiente
    let v3 = i * 2 + 1;          // Cara trasera actual

    faces.push({
        vertices: [v1, v2, v3],
        normals: [normalBackIndex, normalBackIndex, normalBackIndex],
    });
}

// Función para calcular la normal de una cara
function calculateNormal(p1, p2, p3) {
    // Vector u = p2 - p1
    let u = [
        p2[0] - p1[0],
        p2[1] - p1[1],
        p2[2] - p1[2],
    ];

    // Vector v = p3 - p1
    let v = [
        p3[0] - p1[0],
        p3[1] - p1[1],
        p3[2] - p1[2],
    ];

    // Producto cruz u x v
    let nx = u[1] * v[2] - u[2] * v[1];
    let ny = u[2] * v[0] - u[0] * v[2];
    let nz = u[0] * v[1] - u[1] * v[0];

    // Normalizar el vector
    let length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return [nx / length, ny / length, nz / length];
}

// Generar el contenido del archivo OBJ
let objContent = '';

// Agregar los vértices
for (let i = 0; i < vertices.length; i++) {
    let v = vertices[i];
    objContent += `v ${v[0]} ${v[1]} ${v[2]}\n`;
}

// Agregar las normales
for (let i = 0; i < normals.length; i++) {
    let n = normals[i];
    objContent += `vn ${n[0]} ${n[1]} ${n[2]}\n`;
}

// Agregar las caras
for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    let v = face.vertices;
    let n = face.normals;
    objContent += `f ${v[0]+1}//${n[0]+1} ${v[1]+1}//${n[1]+1} ${v[2]+1}//${n[2]+1}\n`;
}

// Escribir el archivo OBJ
fs.writeFileSync('wheel.obj', objContent);

console.log('Archivo wheel.obj generado exitosamente.');