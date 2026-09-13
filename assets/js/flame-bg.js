/* 炎の揺らめき背景（WebGL、ライブラリ不使用）
   - ページ全体の背後（z-index:-1）に固定 canvas を敷き、画面下から炎がそっと立ちのぼる。
   - 控えめ設定: 半解像度で描画、alpha 低め。prefers-reduced-motion なら1フレームだけ描いて止める。
   - WebGL が使えない環境では何もしない（背景色のまま）。
   - 強さを変えたい時は <script> より前に window.FLAME_INTENSITY = 0.0〜1.0 を置く（既定 0.55）。 */
(function () {
  if (document.getElementById('flame-bg')) return;
  var intensity = (typeof window.FLAME_INTENSITY === 'number') ? window.FLAME_INTENSITY : 0.55;
  if (intensity <= 0) return;

  var canvas = document.createElement('canvas');
  canvas.id = 'flame-bg';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);

  var gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true })
        || canvas.getContext('experimental-webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
  if (!gl) { canvas.parentNode.removeChild(canvas); return; }

  var vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var fs = [
    'precision mediump float;',
    'uniform vec2 u_res;uniform float u_time;uniform float u_int;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/u_res;',
    ' float ar=u_res.x/u_res.y;',
    ' float t=u_time*0.11;',
    ' vec2 p=vec2(uv.x*2.6*ar, uv.y*2.2-t*1.35);',
    ' float warp=fbm(p*1.4+vec2(t*0.7,-t*0.3));',
    ' float n=fbm(p+warp*0.75);',
    ' float h=1.0-uv.y;',                       /* 1 = 画面下端 */
    ' float body=h*h*1.7+0.04;',               /* 下ほど濃く */
    ' float flame=smoothstep(0.18,0.95,n*body);',
    ' vec3 c1=vec3(0.28,0.05,0.04);',           /* 暗い深紅 */
    ' vec3 c2=vec3(0.83,0.22,0.11);',           /* 緋色 */
    ' vec3 c3=vec3(0.91,0.45,0.15);',           /* 炎の橙 */
    ' vec3 c4=vec3(0.79,0.64,0.36);',           /* 金 */
    ' vec3 col=mix(c1,c2,smoothstep(0.0,0.55,flame));',
    ' col=mix(col,c3,smoothstep(0.5,0.85,flame));',
    ' col=mix(col,c4,smoothstep(0.85,1.0,flame)*0.45);',
    ' float side=1.0-0.35*smoothstep(0.25,0.5,abs(uv.x-0.5));', /* 中央やや弱め、端は残す */
    ' float a=flame*u_int*smoothstep(0.0,0.7,h)*side;',
    ' gl_FragColor=vec4(col*a,a);',            /* premultiplied */
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { return null; }
    return s;
  }
  var v = compile(gl.VERTEX_SHADER, vs), f = compile(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) { canvas.parentNode.removeChild(canvas); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.parentNode.removeChild(canvas); return; }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uRes = gl.getUniformLocation(prog, 'u_res');
  var uTime = gl.getUniformLocation(prog, 'u_time');
  var uInt = gl.getUniformLocation(prog, 'u_int');
  gl.uniform1f(uInt, intensity);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  var SCALE = 0.5; /* 半解像度で軽く */
  function resize() {
    var w = Math.max(1, Math.floor(window.innerWidth * SCALE));
    var hh = Math.max(1, Math.floor(window.innerHeight * SCALE));
    if (canvas.width !== w || canvas.height !== hh) {
      canvas.width = w; canvas.height = hh;
      gl.viewport(0, 0, w, hh);
      gl.uniform2f(uRes, w, hh);
    }
  }
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var start = performance.now();
  var last = 0;
  function draw(now) {
    resize();
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function loop(now) {
    if (now - last > 33) { last = now; draw(now); } /* 約30fps */
    requestAnimationFrame(loop);
  }
  if (reduced) { draw(start + 4000); return; }
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);
})();
