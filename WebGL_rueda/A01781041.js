// A01781041.js
// Michael Devlyn A01781041
// WebGL program to display a cube and a wheel, with transformations

"use strict";

// Importar m4 y v3 desde 3dLibs.js
import GUI from 'lil-gui';
import { m4, v3 } from './3dLibs.js';

// Shaders como cadenas de texto
const vertexShaderSource = `#version 300 es
in vec4 a_position;
in vec3 a_normal;
in vec4 a_color;

uniform mat4 u_worldViewProjection;
uniform mat4 u_worldInverseTranspose;
uniform vec3 u_lightWorldPosition;
uniform vec3 u_viewWorldPosition;

out vec3 v_normal;
out vec3 v_surfaceToLight;
out vec3 v_surfaceToView;
out vec4 v_color;

void main() {
  gl_Position = u_worldViewProjection * a_position;

  // Compute the normal in world space
  v_normal = mat3(u_worldInverseTranspose) * a_normal;

  // Compute the surface to light vector
  vec3 surfaceWorldPosition = (u_worldViewProjection * a_position).xyz;
  v_surfaceToLight = u_lightWorldPosition - surfaceWorldPosition;

  // Compute the surface to view vector
  v_surfaceToView = u_viewWorldPosition - surfaceWorldPosition;

  v_color = a_color;
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_surfaceToLight;
in vec3 v_surfaceToView;
in vec4 v_color;

out vec4 outColor;

void main() {
  // Normalize the interpolated normal
  vec3 normal = normalize(v_normal);

  // Compute the light direction and intensity
  vec3 lightDirection = normalize(v_surfaceToLight);
  float light = max(dot(normal, lightDirection), 0.0);

  // Compute the reflection for specular
  vec3 viewDirection = normalize(v_surfaceToView);
  vec3 halfVector = normalize(lightDirection + viewDirection);
  float specular = 0.0;
  if (light > 0.0) {
    specular = pow(max(dot(normal, halfVector), 0.0), 50.0);
  }

  // Combine the color
  vec3 color = v_color.rgb * light + specular;

  outColor = vec4(color, v_color.a);
}
`;

// Función principal
async function main() {
  // Obtener el contexto WebGL
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    console.error("WebGL2 no es soportado");
    return;
  }

  // Ajustar el tamaño del canvas
  resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Compilar shaders y crear programa
  const program = createProgramFromSources(gl, vertexShaderSource, fragmentShaderSource);
  const programInfo = {
    program: program,
    attribLocations: {
      a_position: gl.getAttribLocation(program, "a_position"),
      a_normal: gl.getAttribLocation(program, "a_normal"),
      a_color: gl.getAttribLocation(program, "a_color"),
    },
    uniformLocations: {
      u_worldViewProjection: gl.getUniformLocation(program, "u_worldViewProjection"),
      u_worldInverseTranspose: gl.getUniformLocation(program, "u_worldInverseTranspose"),
      u_lightWorldPosition: gl.getUniformLocation(program, "u_lightWorldPosition"),
      u_viewWorldPosition: gl.getUniformLocation(program, "u_viewWorldPosition"),
    },
  };

  // Cargar modelos
  const cubeBufferInfo = createCubeBufferInfo(gl);
  const wheelBufferInfo = await loadWheelModel(gl);

  // Configurar los objetos de la escena
  const cubeNode = {
    bufferInfo: cubeBufferInfo,
    vao: createVAOFromBufferInfo(gl, programInfo, cubeBufferInfo),
    localMatrix: m4.identity(),
    worldMatrix: m4.identity(),
    color: [1.0, 0.0, 0.0, 1.0], // Color rojo para el cubo
  };

  const wheelNode = {
    bufferInfo: wheelBufferInfo,
    vao: createVAOFromBufferInfo(gl, programInfo, wheelBufferInfo),
    localMatrix: m4.identity(),
    worldMatrix: m4.identity(),
    color: [0.0, 0.0, 1.0, 1.0], // Color azul para la rueda
  };

  // Parámetros de transformación
  const params = {
    pivotPosition: { x: 0, y: 0, z: 0 },
    wheelTranslation: { x: 2, y: 0, z: 0 },
    wheelRotation: { x: 0, y: 0, z: 0 },
    wheelScale: { x: 1, y: 1, z: 1 },
  };

  // Configurar los controles de la interfaz de usuario
  setupUI(params);

  // Comenzar el renderizado
  requestAnimationFrame(drawScene);

  function drawScene(time) {
    time *= 0.001; // Convertir a segundos

    // Limpiar el canvas y el buffer de profundidad
    gl.clearColor(0.9, 0.9, 0.9, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Habilitar pruebas de profundidad y culling de caras posteriores
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    gl.useProgram(programInfo.program);

    // Calcular las matrices de proyección y cámara
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projectionMatrix = m4.perspective(degToRad(60), aspect, 0.1, 100);
    const cameraPosition = [0, 5, 10];
    const target = [0, 0, 0];
    const up = [0, 1, 0];
    const cameraMatrix = m4.lookAt(cameraPosition, target, up);
    const viewMatrix = m4.inverse(cameraMatrix);
    const viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    const sharedUniforms = {
      u_lightWorldPosition: [10, 10, 10],
      u_viewWorldPosition: cameraPosition,
    };

    // Actualizar la matriz del cubo (pivote)
    cubeNode.localMatrix = m4.translation([params.pivotPosition.x, params.pivotPosition.y, params.pivotPosition.z]);
    m4.copy(cubeNode.localMatrix, cubeNode.worldMatrix);

    // Actualizar la matriz de la rueda
    let wheelMatrix = m4.identity();
    // Mover al punto pivote
    wheelMatrix = m4.translate(wheelMatrix, [params.pivotPosition.x, params.pivotPosition.y, params.pivotPosition.z]);
    // Aplicar traducción de la rueda relativa al pivote
    wheelMatrix = m4.translate(wheelMatrix, [params.wheelTranslation.x, params.wheelTranslation.y, params.wheelTranslation.z]);
    // Aplicar rotación alrededor del pivote
    wheelMatrix = m4.rotateX(wheelMatrix, degToRad(params.wheelRotation.x));
    wheelMatrix = m4.rotateY(wheelMatrix, degToRad(params.wheelRotation.y));
    wheelMatrix = m4.rotateZ(wheelMatrix, degToRad(params.wheelRotation.z));
    // Aplicar escala
    wheelMatrix = m4.scale(wheelMatrix, [params.wheelScale.x, params.wheelScale.y, params.wheelScale.z]);

    m4.copy(wheelMatrix, wheelNode.worldMatrix);

    // Establecer los uniformes compartidos
    gl.uniform3fv(programInfo.uniformLocations.u_lightWorldPosition, sharedUniforms.u_lightWorldPosition);
    gl.uniform3fv(programInfo.uniformLocations.u_viewWorldPosition, sharedUniforms.u_viewWorldPosition);

    // Dibujar el cubo (pivote)
    gl.bindVertexArray(cubeNode.vao);
    setUniforms(gl, programInfo, cubeNode, viewProjectionMatrix);
    gl.drawElements(gl.TRIANGLES, cubeNode.bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);

    // Dibujar la rueda
    gl.bindVertexArray(wheelNode.vao);
    setUniforms(gl, programInfo, wheelNode, viewProjectionMatrix);
    gl.drawArrays(gl.TRIANGLES, 0, wheelNode.bufferInfo.numElements);

    requestAnimationFrame(drawScene);
  }
}

// Funciones auxiliares y utilidades

// Función para compilar shaders y crear programa
function createProgramFromSources(gl, vertexShaderSource, fragmentShaderSource) {
  const program = gl.createProgram();
  const vShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);

  // Verificar estado de enlace
  const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!linked) {
    const info = gl.getProgramInfoLog(program);
    console.error('No se pudo enlazar el programa WebGL.\n' + info);
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

// Función para compilar un shader
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  // Verificar estado de compilación
  const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compiled) {
    const info = gl.getShaderInfoLog(shader);
    console.error('No se pudo compilar el shader.\n' + info);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Función para crear bufferInfo del cubo
function createCubeBufferInfo(gl) {
  // Datos de vértices del cubo
  const positions = [
    // Frente
    -1, -1,  1,
     1, -1,  1,
     1,  1,  1,
    -1,  1,  1,
    // Atrás
    -1, -1, -1,
    -1,  1, -1,
     1,  1, -1,
     1, -1, -1,
    // Arriba
    -1,  1, -1,
    -1,  1,  1,
     1,  1,  1,
     1,  1, -1,
    // Abajo
    -1, -1, -1,
     1, -1, -1,
     1, -1,  1,
    -1, -1,  1,
    // Derecha
     1, -1, -1,
     1,  1, -1,
     1,  1,  1,
     1, -1,  1,
    // Izquierda
    -1, -1, -1,
    -1, -1,  1,
    -1,  1,  1,
    -1,  1, -1,
  ];

  const normals = [
    // Frente
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    // Atrás
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    // Arriba
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    // Abajo
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    // Derecha
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    // Izquierda
    -1, 0, 0,
    -1, 0, 0,
    -1, 0, 0,
    -1, 0, 0,
  ];

  const indices = [
    0,  1,  2,    0,  2,  3,    // Frente
    4,  5,  6,    4,  6,  7,    // Atrás
    8,  9, 10,    8, 10, 11,    // Arriba
    12, 13, 14,   12, 14, 15,   // Abajo
    16, 17, 18,   16, 18, 19,   // Derecha
    20, 21, 22,   20, 22, 23,   // Izquierda
  ];

  const colors = [];
  for (let i = 0; i < 24; i++) {
    colors.push(1.0, 0.0, 0.0, 1.0); // Color rojo para el cubo
  }

  const bufferInfo = {
    attribs: {
      a_position: { numComponents: 3, data: new Float32Array(positions) },
      a_normal: { numComponents: 3, data: new Float32Array(normals) },
      a_color: { numComponents: 4, data: new Float32Array(colors) },
    },
    indices: new Uint16Array(indices),
    numElements: indices.length,
  };

  return bufferInfo;
}

// Función para crear VAO desde bufferInfo
function createVAOFromBufferInfo(gl, programInfo, bufferInfo) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  for (const [attribName, attrib] of Object.entries(bufferInfo.attribs)) {
    const location = programInfo.attribLocations[attribName];
    if (location === undefined) continue;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, attrib.data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, attrib.numComponents, gl.FLOAT, false, 0, 0);
  }

  if (bufferInfo.indices) {
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, bufferInfo.indices, gl.STATIC_DRAW);
  }

  gl.bindVertexArray(null);
  return vao;
}

// Función para establecer los uniformes
function setUniforms(gl, programInfo, node, viewProjectionMatrix) {
  // Calcular las matrices
  const worldViewProjectionMatrix = m4.multiply(viewProjectionMatrix, node.worldMatrix);
  const worldInverseMatrix = m4.inverse(node.worldMatrix);
  const worldInverseTransposeMatrix = m4.transpose(worldInverseMatrix);

  // Establecer los uniformes
  gl.uniformMatrix4fv(programInfo.uniformLocations.u_worldViewProjection, false, new Float32Array(worldViewProjectionMatrix));
  gl.uniformMatrix4fv(programInfo.uniformLocations.u_worldInverseTranspose, false, new Float32Array(worldInverseTransposeMatrix));
}

// Función para ajustar el tamaño del canvas
function resizeCanvasToDisplaySize(canvas) {
  const displayWidth  = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  if (canvas.width  !== displayWidth ||
      canvas.height !== displayHeight) {

    canvas.width  = displayWidth;
    canvas.height = displayHeight;
  }
}

// Función para convertir grados a radianes
function degToRad(degrees) {
  return degrees * Math.PI / 180;
}

// Función para cargar el modelo de la rueda
async function loadWheelModel(gl) {
  // Obtener el contenido del archivo OBJ
  const response = await fetch('wheel.obj'); // Asegúrate de que el archivo wheel.obj esté en el mismo directorio
  const objText = await response.text();

  // Usar la función loadObj
  const modelData = loadObj(objText);

  // Crear buffers
  const bufferInfo = {
    attribs: {
      a_position: { numComponents: 3, data: new Float32Array(modelData.a_position.data) },
      a_normal: { numComponents: 3, data: new Float32Array(modelData.a_normal.data) },
      a_color: { numComponents: 4, data: new Float32Array(modelData.a_color.data) },
    },
    numElements: modelData.a_position.data.length / 3,
  };

  return bufferInfo;
}

// Función para parsear el contenido del archivo OBJ
function loadObj(objText) {
  // Implementar la función loadObj del Objetivo 2
  // Aquí está la implementación:

  // [Incluye la implementación de la función loadObj proporcionada en el Objetivo 2]

  // Arrays para almacenar datos temporales
  const positions = [];
  const normals = [];
  const texCoords = [];

  // Arrays para los datos finales
  const finalPositions = [];
  const finalNormals = [];
  const finalTexCoords = [];
  const finalColors = [];

  // Dividir el contenido en líneas
  const lines = objText.split('\n');

  // Expresiones regulares para identificar las líneas
  const vertexPattern = /^v\s+([\d\.\-eE]+)\s+([\d\.\-eE]+)\s+([\d\.\-eE]+)/;
  const normalPattern = /^vn\s+([\d\.\-eE]+)\s+([\d\.\-eE]+)\s+([\d\.\-eE]+)/;
  const texCoordPattern = /^vt\s+([\d\.\-eE]+)\s+([\d\.\-eE]+)/;
  const facePattern = /^f\s+(.+)/;

  // Parsear cada línea
  for (let line of lines) {
    line = line.trim();
    let result;

    if (line.startsWith('v ')) {
      // Vértice
      result = vertexPattern.exec(line);
      if (result) {
        positions.push(
          parseFloat(result[1]),
          parseFloat(result[2]),
          parseFloat(result[3])
        );
      }
    } else if (line.startsWith('vn')) {
      // Normal
      result = normalPattern.exec(line);
      if (result) {
        normals.push(
          parseFloat(result[1]),
          parseFloat(result[2]),
          parseFloat(result[3])
        );
      }
    } else if (line.startsWith('vt')) {
      // Coordenada de textura
      result = texCoordPattern.exec(line);
      if (result) {
        texCoords.push(
          parseFloat(result[1]),
          parseFloat(result[2])
        );
      }
    } else if (line.startsWith('f')) {
      // Cara
      result = facePattern.exec(line);
      if (result) {
        const faceVertices = result[1].trim().split(/\s+/);
        if (faceVertices.length !== 3) {
          console.warn('Solo se soportan caras triangulares.');
          continue;
        }

        for (let fv of faceVertices) {
          // Manejar los diferentes formatos de índices
          const indicesPattern = /^(\d+)\/\/(\d+)$/;
          const indicesResult = indicesPattern.exec(fv);
          if (indicesResult) {
            const positionIndex = parseInt(indicesResult[1]) - 1;
            const normalIndex = parseInt(indicesResult[2]) - 1;

            // Añadir posición
            finalPositions.push(
              positions[positionIndex * 3],
              positions[positionIndex * 3 + 1],
              positions[positionIndex * 3 + 2]
            );

            // Añadir normal
            if (normalIndex !== null) {
              finalNormals.push(
                normals[normalIndex * 3],
                normals[normalIndex * 3 + 1],
                normals[normalIndex * 3 + 2]
              );
            } else {
              // Si no hay normal, añadir un valor por defecto
              finalNormals.push(0, 0, 0);
            }

            // Añadir coordenada de textura (no tenemos, así que usamos valores por defecto)
            finalTexCoords.push(0, 0);

            // Añadir color por defecto (gris)
            finalColors.push(0.5, 0.5, 0.5, 1);
          }
        }
      }
    }
  }

  // Construir el objeto final
  const obj = {
    a_position: {
      numComponents: 3,
      data: finalPositions,
    },
    a_normal: {
      numComponents: 3,
      data: finalNormals,
    },
    a_texCoord: {
      numComponents: 2,
      data: finalTexCoords,
    },
    a_color: {
      numComponents: 4,
      data: finalColors,
    },
  };

  return obj;
}

// Función para configurar los controles de la interfaz de usuario
function setupUI(params) {
  const gui = new GUI();

  const pivotFolder = gui.addFolder('Posición del Pivote');
  pivotFolder.add(params.pivotPosition, 'x', -5, 5);
  pivotFolder.add(params.pivotPosition, 'y', -5, 5);
  pivotFolder.add(params.pivotPosition, 'z', -5, 5);

  const wheelTransFolder = gui.addFolder('Traducción de la Rueda');
  wheelTransFolder.add(params.wheelTranslation, 'x', -5, 5);
  wheelTransFolder.add(params.wheelTranslation, 'y', -5, 5);
  wheelTransFolder.add(params.wheelTranslation, 'z', -5, 5);

  const wheelRotFolder = gui.addFolder('Rotación de la Rueda');
  wheelRotFolder.add(params.wheelRotation, 'x', 0, 360);
  wheelRotFolder.add(params.wheelRotation, 'y', 0, 360);
  wheelRotFolder.add(params.wheelRotation, 'z', 0, 360);

  const wheelScaleFolder = gui.addFolder('Escala de la Rueda');
  wheelScaleFolder.add(params.wheelScale, 'x', 0.1, 5);
  wheelScaleFolder.add(params.wheelScale, 'y', 0.1, 5);
  wheelScaleFolder.add(params.wheelScale, 'z', 0.1, 5);
}

main();