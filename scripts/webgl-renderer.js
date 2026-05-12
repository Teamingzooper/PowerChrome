(function () {
  window.__powerMode = window.__powerMode || {};

  let gl = null;
  let program = null;
  let posBuf = null;
  let sizeBuf = null;
  let colorBuf = null;
  let available = false;
  let viewportLoc = null;
  let posLoc = -1, sizeLoc = -1, colorLoc = -1;

  const VS = '#version 300 es\n' +
    'in vec2 a_pos;\n' +
    'in float a_size;\n' +
    'in vec3 a_color;\n' +
    'uniform vec2 u_viewport;\n' +
    'out vec3 v_color;\n' +
    'void main() {\n' +
    '  vec2 clip = (a_pos / u_viewport) * 2.0 - 1.0;\n' +
    '  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);\n' +
    '  gl_PointSize = a_size;\n' +
    '  v_color = a_color;\n' +
    '}';

  const FS = '#version 300 es\n' +
    'precision mediump float;\n' +
    'in vec3 v_color;\n' +
    'out vec4 outColor;\n' +
    'void main() {\n' +
    '  vec2 c = gl_PointCoord - vec2(0.5);\n' +
    '  float d = length(c);\n' +
    '  if (d > 0.5) discard;\n' +
    '  float a = smoothstep(0.5, 0.30, d);\n' +
    '  outColor = vec4(v_color, a);\n' +
    '}';

  function compile(g, src, type) {
    const sh = g.createShader(type);
    g.shaderSource(sh, src);
    g.compileShader(sh);
    if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) {
      console.warn('[PowerChrome] shader compile failed', g.getShaderInfoLog(sh));
      g.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function tryInit(canvas) {
    try {
      gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
      if (!gl) {
        available = false;
        return false;
      }
      const vs = compile(gl, VS, gl.VERTEX_SHADER);
      const fs = compile(gl, FS, gl.FRAGMENT_SHADER);
      if (!vs || !fs) {
        available = false;
        return false;
      }
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('[PowerChrome] program link failed', gl.getProgramInfoLog(program));
        available = false;
        return false;
      }
      posBuf = gl.createBuffer();
      sizeBuf = gl.createBuffer();
      colorBuf = gl.createBuffer();
      posLoc = gl.getAttribLocation(program, 'a_pos');
      sizeLoc = gl.getAttribLocation(program, 'a_size');
      colorLoc = gl.getAttribLocation(program, 'a_color');
      viewportLoc = gl.getUniformLocation(program, 'u_viewport');
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      available = true;
      return true;
    } catch (e) {
      console.warn('[PowerChrome] webgl init failed', e);
      available = false;
      return false;
    }
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return [1, 1, 1];
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
  }

  function render(pool, canvas) {
    if (!available || !gl) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(viewportLoc, canvas.width, canvas.height);

    const positions = [];
    const sizes = [];
    const colors = [];
    const dpr = (typeof devicePixelRatio !== 'undefined') ? devicePixelRatio : 1;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.alive) continue;
      positions.push(p.x * dpr, p.y * dpr);
      sizes.push(Math.max(1, p.size * 2 * dpr));
      const rgb = hexToRgb(p.color);
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      colors.push(rgb[0] * a, rgb[1] * a, rgb[2] * a);
    }
    if (!positions.length) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(sizeLoc);
    gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, positions.length / 2);
  }

  window.__powerMode.webgl = {
    tryInit: tryInit,
    render: render,
    get available() { return available; }
  };
})();
