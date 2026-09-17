import { RECT_FRAGMENT_SHADER, RECT_VERTEX_SHADER } from "./shaders";

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

const FLOATS_PER_INSTANCE = 5; // x, y, w, h, colorFlag

/**
 * Renders any number of axis-aligned rectangles (candle bodies, wicks,
 * volume bars) in a single instanced draw call. The instance buffer only
 * ever holds the currently visible rectangles, so draw cost is bounded by
 * screen width, not total dataset size.
 */
export class InstancedRectProgram {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private instanceBuffer: WebGLBuffer;
  private instanceCapacity = 0;
  private uUpColor: WebGLUniformLocation | null;
  private uDownColor: WebGLUniformLocation | null;
  private uAlpha: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const vs = compileShader(gl, gl.VERTEX_SHADER, RECT_VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, RECT_FRAGMENT_SHADER);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;

    const quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    // Two triangles covering the unit square (0,0) - (1,1).
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);

    this.instanceBuffer = gl.createBuffer()!;

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    const stride = FLOATS_PER_INSTANCE * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);

    gl.bindVertexArray(null);

    this.uUpColor = gl.getUniformLocation(program, "uUpColor");
    this.uDownColor = gl.getUniformLocation(program, "uDownColor");
    this.uAlpha = gl.getUniformLocation(program, "uAlpha");
  }

  /** `data` is packed as [x,y,w,h,colorFlag] per instance, in clip space. */
  draw(data: Float32Array, instanceCount: number, upColor: [number, number, number], downColor: [number, number, number], alpha = 1): void {
    if (instanceCount <= 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    if (data.length > this.instanceCapacity) {
      this.instanceCapacity = data.length;
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    }

    gl.uniform3f(this.uUpColor, ...upColor);
    gl.uniform3f(this.uDownColor, ...downColor);
    gl.uniform1f(this.uAlpha, alpha);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteBuffer(this.instanceBuffer);
  }
}

export { FLOATS_PER_INSTANCE };
