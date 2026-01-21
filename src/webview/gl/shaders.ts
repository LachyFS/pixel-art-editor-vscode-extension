export const vertexShaderSource = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

uniform mat3 u_matrix;

out vec2 v_texCoord;

void main() {
  vec3 position = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

export const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_textureSize;
uniform float u_zoom;
uniform bool u_showGrid;
uniform vec4 u_gridColor;

out vec4 outColor;

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);

  if (u_showGrid && u_zoom >= 4.0) {
    vec2 pixelCoord = v_texCoord * u_textureSize;
    vec2 gridLine = fract(pixelCoord);

    float lineWidth = 1.0 / u_zoom;
    float gridAlpha = 0.0;

    if (gridLine.x < lineWidth || gridLine.y < lineWidth) {
      gridAlpha = u_gridColor.a * min(1.0, (u_zoom - 4.0) / 4.0);
    }

    outColor = mix(texColor, vec4(u_gridColor.rgb, 1.0), gridAlpha);
  } else {
    outColor = texColor;
  }
}
`;

export function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}
