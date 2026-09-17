/**
 * Instanced-rect shader: one draw call renders N rectangles (candle bodies,
 * wicks, or volume bars) from a small per-instance buffer that only covers
 * the currently visible candles — never the whole dataset.
 */
export const RECT_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aQuadPos;
layout(location = 1) in vec4 aRect; // x, y, width, height — all in clip space [-1,1]
layout(location = 2) in float aColorFlag; // 0 = down, 1 = up

out float vColorFlag;

void main() {
  vec2 pos = aRect.xy + aQuadPos * aRect.zw;
  gl_Position = vec4(pos, 0.0, 1.0);
  vColorFlag = aColorFlag;
}
`;

export const RECT_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in float vColorFlag;
out vec4 fragColor;

uniform vec3 uUpColor;
uniform vec3 uDownColor;
uniform float uAlpha;

void main() {
  vec3 c = mix(uDownColor, uUpColor, vColorFlag);
  fragColor = vec4(c, uAlpha);
}
`;
