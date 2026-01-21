export interface TextureInfo {
  texture: WebGLTexture;
  width: number;
  height: number;
}

export function createTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
  const texture = gl.createTexture();
  if (!texture) return null;

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  return texture;
}

export function loadImageToTexture(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  image: HTMLImageElement
): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
}

export function updateTextureFromImageData(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  imageData: ImageData
): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
}

export function updateTexturePixel(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  x: number,
  y: number,
  color: [number, number, number, number]
): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const data = new Uint8Array(color);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
}
