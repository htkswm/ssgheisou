/* 炎と彗星の背景（WebGL、ライブラリ不使用）
   - ページ全体の背後（z-index:-1）に固定 canvas を敷く。
   - 既定シーン: 画面下から炎がそっと立ちのぼる（全ページ）。
   - window.FLAME_SCENE = "comet" のページ（ホーム）: 緋色の空＋星＋炎の尾を引く彗星＋下の炎。
     『緋色の野望』のロゴ背後の「炎と彗星」と、最終ステージの宇宙の雰囲気を意識。
   - 控えめ設定: 半解像度で描画、約30fps。prefers-reduced-motion なら1フレームだけ描いて止める。
   - WebGL が使えない環境では何もしない（背景色のまま）。
   - 強さ: window.FLAME_INTENSITY = 0.0〜1.0（既定 0.55）。<script src=flame-bg.js> より前に置く。 */
(function () {
  if (document.getElementById('flame-bg')) return;
  var intensity = (typeof window.FLAME_INTENSITY === 'number') ? window.FLAME_INTENSITY : 0.55;
  if (intensity <= 0) return;
  var scene = (window.FLAME_SCENE === 'comet') ? 1 : 0;

  var canvas = document.createElement('canvas');
  canvas.id = 'flame-bg';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);

  var opts = { alpha: true, antialias: false, premultipliedAlpha: true };
  var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl) { canvas.parentNode.removeChild(canvas); return; }

  var vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var fs = [
    'precision mediump float;',
    'uniform vec2 u_res;uniform float u_time;uniform float u_int;uniform float u_scene;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'float fbm3(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/u_res;',
    ' float ar=u_res.x/u_res.y;',
    ' float t=u_time*0.11;',
    ' vec3 c1=vec3(0.28,0.05,0.04);',           /* 暗い深紅 */
    ' vec3 c2=vec3(0.83,0.22,0.11);',           /* 緋色 */
    ' vec3 c3=vec3(0.91,0.45,0.15);',           /* 炎の橙 */
    ' vec3 c4=vec3(0.79,0.64,0.36);',           /* 金 */
    /* ---- 下からの炎 ---- */
    ' vec2 p=vec2(uv.x*2.6*ar, uv.y*2.2-t*1.35);',
    ' float warp=fbm(p*1.4+vec2(t*0.7,-t*0.3));',
    ' float n=fbm(p+warp*0.75);',
    ' float h=1.0-uv.y;',
    ' float body=h*h*1.7+0.04;',
    ' float flame=smoothstep(0.18,0.95,n*body);',
    ' vec3 col=mix(c1,c2,smoothstep(0.0,0.55,flame));',
    ' col=mix(col,c3,smoothstep(0.5,0.85,flame));',
    ' col=mix(col,c4,smoothstep(0.85,1.0,flame)*0.45);',
    ' float side=1.0-0.35*smoothstep(0.25,0.5,abs(uv.x-0.5));',
    ' float fa=flame*smoothstep(0.0,0.7,h)*side*(u_scene>0.5?0.8:1.0);',
    ' vec3 rgb=col*fa; float a=fa;',
    ' if(u_scene>0.5){',
    /* ---- 緋色の空: 上ほど深紅、中央は暗く ---- */
    '  float sky=smoothstep(0.35,1.0,uv.y);',
    '  float skyA=sky*0.75*(0.85+0.15*fbm3(vec2(uv.x*3.0*ar+t*0.2,uv.y*2.0)));',
    '  vec3 skyC=mix(vec3(0.20,0.03,0.03),vec3(0.55,0.06,0.05),sky);',
    '  rgb=rgb*(1.0-skyA)+skyC*skyA; a=a*(1.0-skyA)+skyA;',
    /* ---- 星: 疎らに瞬く ---- */
    '  vec2 sp=vec2(uv.x*ar,uv.y)*42.0;',
    '  vec2 cell=floor(sp); float r0=hash(cell);',
    '  vec2 pos=cell+vec2(hash(cell+1.3),hash(cell+7.1));',
    '  float sd=length(sp-pos);',
    '  float star=smoothstep(0.10,0.0,sd)*step(0.94,r0)*(0.55+0.45*sin(u_time*1.7+r0*60.0))*smoothstep(0.3,0.9,uv.y);',
    '  vec3 starC=vec3(1.0,0.93,0.85)*star*0.75;',
    '  rgb+=starC*(1.0-a); a=min(1.0,a+star*0.6);',
    /* ---- 彗星: 右上に頭、左上へ湾曲する炎の尾 ---- */
    '  vec2 q=vec2(uv.x*ar,uv.y);',
    '  vec2 H=vec2(0.74*ar,0.70);',
    '  vec2 dir=normalize(vec2(-1.0,0.42)); vec2 per=vec2(-dir.y,dir.x);',
    '  vec2 d=q-H; float x=dot(d,dir); float y=dot(d,per);',
    '  y-=0.30*x*x;',                               /* 尾を上へ湾曲 */
    '  float L=0.95*ar+0.2;',
    '  float w=0.012+0.075*x;',
    '  float along=smoothstep(L,0.0,x)*step(0.0,x);',
    '  float strands=fbm(vec2(x*5.0-t*2.2, y*36.0+3.0));',
    '  float tail=smoothstep(w,0.0,abs(y)-w*0.35*(strands-0.5))*along*(0.45+0.75*strands);',
    '  float rr=dot(d,d);',
    '  float head=exp(-rr*1400.0)*1.4+exp(-rr*180.0)*0.55;',
    '  float flick=0.92+0.08*noise(vec2(u_time*2.5,1.0));',
    '  float cm=(tail+head)*flick;',
    '  vec3 cc=mix(c1,c2,smoothstep(0.0,0.35,cm));',
    '  cc=mix(cc,c3,smoothstep(0.3,0.7,cm));',
    '  cc=mix(cc,vec3(1.0,0.96,0.82),smoothstep(0.75,1.3,cm));',
    '  float ca=clamp(cm,0.0,1.0)*0.85;',
    '  rgb=rgb*(1.0-ca)+cc*ca; a=a*(1.0-ca)+ca;',
    ' }',
    ' gl_FragColor=vec4(rgb*u_int/0.55,a*u_int/0.55);',
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
  gl.uniform1f(gl.getUniformLocation(prog, 'u_int'), intensity);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_scene'), scene);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  var SCALE = 0.5;
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
    if (now - last > 33) { last = now; draw(now); }
    requestAnimationFrame(loop);
  }
  if (reduced) { draw(start + 4000); return; }
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);
})();
