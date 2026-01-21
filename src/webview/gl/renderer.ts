import {
  vertexShaderSource,
  fragmentShaderSource,
  createShader,
  createProgram,
} from './shaders';
import { createTexture, loadImageToTexture, updateTextureFromImageData } from './texture';

export interface RendererState {
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
}

export class WebGLRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject | null = null;

  private imageWidth = 0;
  private imageHeight = 0;

  private locations: {
    a_position: number;
    a_texCoord: number;
    u_matrix: WebGLUniformLocation | null;
    u_texture: WebGLUniformLocation | null;
    u_textureSize: WebGLUniformLocation | null;
    u_zoom: WebGLUniformLocation | null;
    u_showGrid: WebGLUniformLocation | null;
    u_gridColor: WebGLUniformLocation | null;
  } | null = null;

  private state: RendererState = {
    zoom: 1,
    panX: 0,
    panY: 0,
    showGrid: true,
  };

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      throw new Error('WebGL2 not supported');
    }

    this.gl = gl;
    this.init();
  }

  private init(): void {
    const gl = this.gl;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to create shaders');
    }

    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) {
      throw new Error('Failed to create program');
    }

    this.locations = {
      a_position: gl.getAttribLocation(this.program, 'a_position'),
      a_texCoord: gl.getAttribLocation(this.program, 'a_texCoord'),
      u_matrix: gl.getUniformLocation(this.program, 'u_matrix'),
      u_texture: gl.getUniformLocation(this.program, 'u_texture'),
      u_textureSize: gl.getUniformLocation(this.program, 'u_textureSize'),
      u_zoom: gl.getUniformLocation(this.program, 'u_zoom'),
      u_showGrid: gl.getUniformLocation(this.program, 'u_showGrid'),
      u_gridColor: gl.getUniformLocation(this.program, 'u_gridColor'),
    };

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1,
      ]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(this.locations.a_position);
    gl.vertexAttribPointer(this.locations.a_position, 2, gl.FLOAT, false, 0, 0);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0, 1, 1, 1, 0, 0,
        0, 0, 1, 1, 1, 0,
      ]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(this.locations.a_texCoord);
    gl.vertexAttribPointer(this.locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);

    this.texture = createTexture(gl);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  loadImage(image: HTMLImageElement): void {
    if (!this.texture) return;

    this.imageWidth = image.width;
    this.imageHeight = image.height;
    loadImageToTexture(this.gl, this.texture, image);
    this.centerImage();
    this.render();
  }

  updateFromImageData(imageData: ImageData): void {
    if (!this.texture) return;

    this.imageWidth = imageData.width;
    this.imageHeight = imageData.height;
    updateTextureFromImageData(this.gl, this.texture, imageData);
    this.render();
  }

  private centerImage(): void {
    this.state.panX = 0;
    this.state.panY = 0;

    const canvasAspect = this.canvas.width / this.canvas.height;
    const imageAspect = this.imageWidth / this.imageHeight;

    if (imageAspect > canvasAspect) {
      this.state.zoom = (this.canvas.width / this.imageWidth) * 0.9;
    } else {
      this.state.zoom = (this.canvas.height / this.imageHeight) * 0.9;
    }
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    this.render();
  }

  setZoom(zoom: number): void {
    this.state.zoom = Math.max(0.1, Math.min(64, zoom));
    this.render();
  }

  getZoom(): number {
    return this.state.zoom;
  }

  setPan(x: number, y: number): void {
    this.state.panX = x;
    this.state.panY = y;
    this.render();
  }

  getPan(): { x: number; y: number } {
    return { x: this.state.panX, y: this.state.panY };
  }

  setShowGrid(show: boolean): void {
    this.state.showGrid = show;
    this.render();
  }

  screenToImage(screenX: number, screenY: number): { x: number; y: number } {
    const canvasRect = this.canvas.getBoundingClientRect();

    // Account for CSS scaling (canvas may be displayed at different size than its internal resolution)
    const cssScaleX = this.canvas.width / canvasRect.width;
    const cssScaleY = this.canvas.height / canvasRect.height;

    const canvasX = (screenX - canvasRect.left) * cssScaleX;
    const canvasY = (screenY - canvasRect.top) * cssScaleY;

    // Convert to NDC space [-1, 1]
    const ndcX = (canvasX / this.canvas.width) * 2 - 1;
    const ndcY = -((canvasY / this.canvas.height) * 2 - 1);

    // Inverse of the transformation matrix used in render()
    // Matrix applies: scaleX = zoom * imageWidth / canvasWidth, then panX
    // So inverse is: subtract pan, then divide by scale
    const scaleX = (this.state.zoom * this.imageWidth) / this.canvas.width;
    const scaleY = (this.state.zoom * this.imageHeight) / this.canvas.height;

    // Remove pan, then remove scale to get back to quad space [-1, 1]
    const quadX = (ndcX - this.state.panX) / scaleX;
    const quadY = (ndcY - this.state.panY) / scaleY;

    // Convert from quad space [-1, 1] to pixel coordinates
    // quadX of -1 maps to pixel 0, quadX of 1 maps to pixel imageWidth
    const pixelX = Math.floor(((quadX + 1) / 2) * this.imageWidth);
    const pixelY = Math.floor(((1 - quadY) / 2) * this.imageHeight);

    return { x: pixelX, y: pixelY };
  }

  isPixelInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.imageWidth && y >= 0 && y < this.imageHeight;
  }

  getImageSize(): { width: number; height: number } {
    return { width: this.imageWidth, height: this.imageHeight };
  }

  render(): void {
    const gl = this.gl;

    if (!this.program || !this.locations || !this.vao || !this.texture) return;

    gl.clearColor(0.1, 0.1, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    const scaleX = (this.state.zoom * this.imageWidth) / this.canvas.width;
    const scaleY = (this.state.zoom * this.imageHeight) / this.canvas.height;

    const matrix = new Float32Array([
      scaleX, 0, 0,
      0, scaleY, 0,
      this.state.panX, this.state.panY, 1,
    ]);

    gl.uniformMatrix3fv(this.locations.u_matrix, false, matrix);
    gl.uniform1i(this.locations.u_texture, 0);
    gl.uniform2f(this.locations.u_textureSize, this.imageWidth, this.imageHeight);
    gl.uniform1f(this.locations.u_zoom, this.state.zoom);
    gl.uniform1i(this.locations.u_showGrid, this.state.showGrid ? 1 : 0);
    gl.uniform4f(this.locations.u_gridColor, 0.5, 0.5, 0.5, 0.5);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
  }
}
