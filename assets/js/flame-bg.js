/* 背景演出（WebGL、ライブラリ不使用）
   ページ全体の背後（z-index:-1）に固定 canvas を敷く。シーンは window.FLAME_SCENE で切替:
   - （未指定）: 画面下から炎がそっと立ちのぼる（ルール・Link）。
   - "comet"  : ホーム。暗い緋色の空＋星＋右から左へ流れてくる彗星＋タイトル背後の「フレア」
                （トレーラーのタイトル出しのように、金〜緋色の光がふわっと広がり炎の筋と火の粉が散る）。
                フレアの中心は .flare-anchor（無ければ .game-title / h1）の位置に追従する。
   - "ending" : 記録ページ。エンディングの空のように、暗い宇宙に琥珀と青緑の星雲が
                ゆっくり「もわもわ」と揺らぐ＋星の瞬き。
   控えめ設定: 半解像度で描画、約30fps。prefers-reduced-motion なら1フレームだけ描いて止める。
   WebGL が使えない環境では何もしない。強さ: window.FLAME_INTENSITY = 0.0〜1.0（既定 0.55）。 */
(function () {
  if (document.getElementById('flame-bg')) return;
  var intensity = (typeof window.FLAME_INTENSITY === 'number') ? window.FLAME_INTENSITY : 0.55;
  if (intensity <= 0) return;
  var scene = (window.FLAME_SCENE === 'comet') ? 1 : (window.FLAME_SCENE === 'ending') ? 2 : 0;

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
    'uniform vec2 u_res;uniform float u_time;uniform float u_int;uniform float u_scene;uniform vec2 u_focus;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'float fbm3(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    /* 星: 疎らに瞬く。sp はスケール済み座標 */
    'float stars(vec2 sp,float tm){vec2 cell=floor(sp);float r0=hash(cell);',
    ' vec2 pos=cell+vec2(hash(cell+1.3),hash(cell+7.1));float sd=length(sp-pos);float sz=0.13+0.13*hash(cell+3.7);',
    ' return (smoothstep(sz,0.0,sd)+smoothstep(sz*2.6,0.0,sd)*0.22)*step(0.90,r0)*(0.55+0.45*sin(tm*1.7+r0*60.0));}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/u_res;',
    ' float ar=u_res.x/u_res.y;',
    ' float t=u_time*0.11;',
    ' vec3 c1=vec3(0.28,0.05,0.04);',           /* 暗い深紅 */
    ' vec3 c2=vec3(0.83,0.22,0.11);',           /* 緋色 */
    ' vec3 c3=vec3(0.91,0.45,0.15);',           /* 炎の橙 */
    ' vec3 c4=vec3(0.79,0.64,0.36);',           /* 金 */
    ' vec3 rgb=vec3(0.0); float a=0.0;',
    ' if(u_scene<0.5){',
    /* ---- 既定: 下からの炎 ---- */
    '  vec2 p=vec2(uv.x*2.6*ar, uv.y*2.2-t*1.35);',
    '  float warp=fbm(p*1.4+vec2(t*0.7,-t*0.3));',
    '  float n=fbm(p+warp*0.75);',
    '  float h=1.0-uv.y;',
    '  float body=h*h*1.7+0.04;',
    '  float flame=smoothstep(0.18,0.95,n*body);',
    '  vec3 col=mix(c1,c2,smoothstep(0.0,0.55,flame));',
    '  col=mix(col,c3,smoothstep(0.5,0.85,flame));',
    '  col=mix(col,c4,smoothstep(0.85,1.0,flame)*0.45);',
    '  float side=1.0-0.35*smoothstep(0.25,0.5,abs(uv.x-0.5));',
    '  float fa=flame*smoothstep(0.0,0.7,h)*side;',
    '  rgb=col*fa; a=fa;',
    ' } else if(u_scene<1.5){',
    /* ---- ホーム: 暗い緋色の空 ---- */
    '  float sky=smoothstep(0.35,1.0,uv.y);',
    '  float skyA=sky*0.70*(0.85+0.15*fbm3(vec2(uv.x*3.0*ar+t*0.2,uv.y*2.0)));',
    '  vec3 skyC=mix(vec3(0.11,0.02,0.02),vec3(0.30,0.04,0.04),sky);',
    '  rgb=skyC*skyA; a=skyA;',
    /* 星 */
    '  float star=stars(vec2(uv.x*ar,uv.y)*42.0,u_time)*smoothstep(0.25,0.85,uv.y);',
    '  rgb+=vec3(1.0,0.93,0.85)*star*0.9*(1.0-a); a=min(1.0,a+star*0.6);',
    /* 彗星: 左に頭、右上へ湾曲する炎の尾（右から左へ流れてくるイメージ） */
    '  vec2 q=vec2(uv.x*ar,uv.y);',
    '  vec2 H=vec2(0.21*ar,0.68);',
    '  vec2 dir=normalize(vec2(1.0,0.42)); vec2 per=vec2(-dir.y,dir.x);',
    '  vec2 d=q-H; float x=dot(d,dir); float y=dot(d,per);',
    '  y-=0.30*x*x;',
    '  float L=0.95*ar+0.2;',
    '  float w=0.012+0.075*x;',
    '  float along=smoothstep(L,0.0,x)*step(0.0,x);',
    '  float strands=fbm(vec2(x*5.0-t*2.2, y*36.0+3.0));',
    '  float tail=smoothstep(w,0.0,abs(y)-w*0.35*(strands-0.5))*along*(0.45+0.75*strands);',
    '  float rr=dot(d,d);',
    '  float head=exp(-rr*1400.0)*0.85+exp(-rr*180.0)*0.30;',
    '  float flick=0.92+0.08*noise(vec2(u_time*2.5,1.0));',
    '  float cm=(tail+head)*flick;',
    '  vec3 cc=mix(c1,c2,smoothstep(0.0,0.35,cm));',
    '  cc=mix(cc,c3,smoothstep(0.3,0.7,cm));',
    '  cc=mix(cc,vec3(1.0,0.90,0.70),smoothstep(1.0,1.7,cm));',
    '  float ca=clamp(cm,0.0,1.0)*0.68;',
    '  rgb=rgb*(1.0-ca)+cc*ca; a=a*(1.0-ca)+ca;',
    /* フレア: タイトル背後で金〜緋色の光がふわっと広がり、炎の筋が放射状に揺らぐ */
    '  vec2 F=vec2(u_focus.x*ar,u_focus.y);',
    '  vec2 fd=q-F; float fr=length(fd); float ang=atan(fd.y,fd.x);',
    '  float pulse=0.9+0.1*sin(u_time*0.9)+0.05*noise(vec2(u_time*1.6,4.0));',
    '  float halo=exp(-fr*fr*7.0)*0.55+exp(-fr*fr*2.2)*0.20;',           /* 広い暖色の光 */
    '  float rays=fbm(vec2(ang*2.2+t*0.6, fr*4.5-t*2.4));',               /* 放射状の炎の筋 */
    '  float wisps=smoothstep(0.42,0.85,rays)*exp(-fr*fr*4.5)*smoothstep(0.02,0.12,fr);',
    '  float flare=(halo+wisps*0.75)*pulse;',
    /* 火の粉: 上へ漂う小さな粒。フレアの近くにだけ */
    '  vec2 e=vec2(q.x*20.0+sin(q.y*6.0+u_time*0.5)*0.3, q.y*20.0-u_time*1.1);',
    '  vec2 ec=floor(e); float er=hash(ec+11.0); vec2 ep=ec+vec2(hash(ec+2.9),hash(ec+5.3));',
    '  float ed=length(e-ep);',
    '  float ember=smoothstep(0.09,0.0,ed)*step(0.80,er)*(0.4+0.6*sin(u_time*3.0+er*40.0))*exp(-fr*fr*3.0);',
    '  vec3 fc=mix(c2,c3,smoothstep(0.15,0.55,flare));',
    '  fc=mix(fc,vec3(1.0,0.86,0.55),smoothstep(0.55,1.0,flare));',
    '  float fa2=clamp(flare,0.0,1.0)*0.62;',
    '  rgb=rgb*(1.0-fa2)+fc*fa2; a=a*(1.0-fa2)+fa2;',
    '  rgb+=vec3(1.0,0.75,0.35)*ember*0.9; a=min(1.0,a+ember*0.8);',
    ' } else {',
    /* ---- 記録ページ: エンディングの空（琥珀と青緑の星雲がゆっくり揺らぐ） ---- */
    '  vec2 q=vec2(uv.x*ar,uv.y);',
    '  vec2 p=q*2.2;',
    '  vec2 w1=vec2(fbm(p+vec2(t*0.35,t*0.2)), fbm(p+vec2(5.2,1.3)-t*0.25));',   /* ドメインワープ＝もわもわ */
    '  float neb=fbm(p+1.6*w1+vec2(0.0,t*0.15));',
    '  float mask=smoothstep(0.22,0.70,fbm3(q*0.9+vec2(2.0,t*0.08)));',         /* 雲のかたまり */
    '  float amber=smoothstep(0.34,0.76,neb)*mask;',
    '  float teal=smoothstep(0.34,0.74,fbm(p*1.3+1.6*w1.yx+vec2(9.0,-t*0.12)))*(1.0-mask*0.5);',
    '  vec3 nc=vec3(0.0);',
    '  nc+=vec3(0.88,0.52,0.18)*amber;',                                          /* 琥珀 */
    '  nc+=vec3(0.18,0.58,0.54)*teal;',                                       /* 青緑 */
    '  nc+=vec3(0.45,0.08,0.06)*smoothstep(0.55,0.9,neb)*0.5;',                   /* ほのかな緋 */
    '  float na=clamp(amber*1.0+teal*0.8,0.0,1.0);',
    '  float vig=1.0-0.35*smoothstep(0.4,0.75,length(uv-vec2(0.5,0.55)));',       /* 端をやや暗く */
    '  rgb=nc*na*vig; a=na*vig;',
    '  float star=stars(q*46.0,u_time)*(0.6+0.4*(1.0-na));',
    '  rgb+=vec3(0.95,0.95,1.0)*star*0.85*(1.0-a); a=min(1.0,a+star*0.6);',
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
  var uFocus = gl.getUniformLocation(prog, 'u_focus');
  gl.uniform1f(gl.getUniformLocation(prog, 'u_int'), intensity);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_scene'), scene);
  gl.uniform2f(uFocus, 0.5, 0.6);
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
  /* フレアの中心をタイトル要素に合わせる（uv: 左下原点） */
  var anchor = document.querySelector('.flare-anchor') || document.querySelector('.game-title') || document.querySelector('h1');
  function updateFocus() {
    if (scene !== 1 || !anchor) return;
    var r = anchor.getBoundingClientRect();
    var cx = (r.left + r.right) / 2 / window.innerWidth;
    var cy = 1.0 - ((r.top + r.bottom) / 2 / window.innerHeight);
    gl.uniform2f(uFocus, cx, cy);
  }
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var start = performance.now();
  var last = 0;
  function draw(now) {
    resize();
    updateFocus();
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
