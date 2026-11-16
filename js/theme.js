// RetroMesh — Темы оформления
// ════════════════════════════════════════
//  THEME SYSTEM
// ════════════════════════════════════════
const THEME_PRESETS=[
  {name:'GREEN',  color:'#33ff00'},
  {name:'CYAN',   color:'#00ffee'},
  {name:'BLUE',   color:'#3399ff'},
  {name:'PURPLE', color:'#bb66ff'},
  {name:'PINK',   color:'#ff44aa'},
  {name:'RED',    color:'#ff4444'},
  {name:'ORANGE', color:'#ff9900'},
  {name:'AMBER',  color:'#ffdd00'},
];

function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return{r,g,b};
}
function lighten(hex,f){
  const{r,g,b}=hexToRgb(hex);
  return '#'+[r,g,b].map(v=>Math.min(255,Math.round(v+(255-v)*f)).toString(16).padStart(2,'0')).join('');
}
function darken(hex,f){
  const{r,g,b}=hexToRgb(hex);
  return '#'+[r,g,b].map(v=>Math.round(v*f).toString(16).padStart(2,'0')).join('');
}
// Derive scan rgba from accent
function scanColor(hex){
  const{r,g,b}=hexToRgb(hex);
  return `rgba(${r},${g},${b},.014)`;
}
// Text/dim colors derived from accent
function txtColor(hex){
  const{r,g,b}=hexToRgb(hex);
  // Mix accent with white for readable text
  return '#'+[r,g,b].map(v=>Math.min(255,Math.round(v*0.55+180)).toString(16).padStart(2,'0')).join('');
}
function dimColor(hex){
  const{r,g,b}=hexToRgb(hex);
  return '#'+[r,g,b].map(v=>Math.round(v*0.35+30).toString(16).padStart(2,'0')).join('');
}

function applyThemeColor(hex){
  const r=document.documentElement.style;
  r.setProperty('--g0', hex);
  r.setProperty('--g1', darken(hex,.78));
  r.setProperty('--g2', darken(hex,.42));
  r.setProperty('--g3', darken(hex,.22));
  r.setProperty('--g4', darken(hex,.12));
  r.setProperty('--bdr', darken(hex,.28));
  r.setProperty('--txt', txtColor(hex));
  r.setProperty('--dim', dimColor(hex));
  r.setProperty('--scan', scanColor(hex));
  // Bg stays dark, just a slight tint
  const{r:cr,g:cg,b:cb}=hexToRgb(hex);
  r.setProperty('--bg',  `rgb(${Math.round(cr*.03)},${Math.round(cg*.03)},${Math.round(cb*.03)})`);
  r.setProperty('--s1',  `rgb(${Math.round(cr*.06)},${Math.round(cg*.07)},${Math.round(cb*.06)})`);
  r.setProperty('--s2',  `rgb(${Math.round(cr*.07)},${Math.round(cg*.09)},${Math.round(cb*.07)})`);
  // Update active dot
  document.querySelectorAll('.theme-dot').forEach(d=>{
    d.classList.toggle('active', d.dataset.color===hex);
  });
  $('theme-color-inp').value=hex;
}

function saveThemeColor(hex){
  localStorage.setItem('rm_theme', hex);
  applyThemeColor(hex);
}

function initTheme(){
  // Build preset dots
  const wrap=$('theme-presets');
  wrap.innerHTML='';
  THEME_PRESETS.forEach(p=>{
    const d=document.createElement('div');
    d.className='theme-dot';
    d.title=p.name;
    d.dataset.color=p.color;
    d.style.background=p.color;
    d.style.boxShadow=`0 0 8px ${p.color}66`;
    d.onclick=()=>saveThemeColor(p.color);
    wrap.appendChild(d);
  });
  // Load saved or default
  const saved=localStorage.getItem('rm_theme')||'#33ff00';
  applyThemeColor(saved);
}

initTheme();

