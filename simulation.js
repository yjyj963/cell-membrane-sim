const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

const modeSelect = document.getElementById('modeSelect');
const resetBtn = document.getElementById('resetBtn');
const outsideCountEl = document.getElementById('outsideCount');
const insideCountEl = document.getElementById('insideCount');
const modeDescEl = document.getElementById('modeDesc');
const legendBox = document.getElementById('legendBox');

const MEMBRANE_Y = canvas.height / 2;
const MEMBRANE_THICKNESS = 48;

let particles = [];
let channels = [];

const MODE_CONFIG = {
  simple: {
    desc: "<b>단순 확산:</b> 산소($O_2$) 같은 작은 지용성 분자는 인지질 2중층을 직접 통과합니다. 극성/대형 분자는 통과하지 못하고 튕깁니다.",
    legend: [
      { color: '#10b981', label: '산소/비극성 분자 (막 통과 가능)' },
      { color: '#ef4444', label: '극성 이온/대형 분자 (막 통과 불가)' }
    ]
  },
  facilitated: {
    desc: "<b>촉진 확산 (기질 특이성):</b> 포도당 수송체(GLUT)는 포도당만 통과시킵니다. 과당은 구조가 맞지 않아 통과하지 못합니다.",
    legend: [
      { color: '#3b82f6', label: '포도당 (수송 단백질 통과)' },
      { color: '#f97316', label: '과당 (특이성 결여, 통과 불가)' }
    ]
  },
  active: {
    desc: "<b>능동 수송:</b> ATP 에너지를 사용하여 농도 기울기를 거슬러 이온을 빠르게 위로 펌핑합니다.",
    legend: [
      { color: '#8b5cf6', label: '수송 이온' },
      { color: '#eab308', label: 'ATP 펌프 단백질' }
    ]
  },
  osmosis: {
    desc: "<b>삼투 현상:</b> 용질은 통과하지 못하며, 물 분자가 수분 퍼텐셜에 의해 빠르게 이동합니다.",
    legend: [
      { color: '#0284c7', label: '물 분자 (아쿠아포린/반투과막 통과)' },
      { color: '#dc2626', label: '불투과성 용질' }
    ]
  }
};

class Particle {
  constructor(x, y, type, speed = 3.5) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.vx = (Math.random() - 0.5) * speed;
    this.vy = (Math.random() - 0.5) * speed;
    
    // 속도가 0이 되어 멈추는 현상을 방지하기 위한 최소 속도 보장
    if (Math.abs(this.vx) < 0.8) this.vx = this.vx < 0 ? -1.2 : 1.2;
    if (Math.abs(this.vy) < 0.8) this.vy = this.vy < 0 ? -1.2 : 1.2;

    if (this.type === 'water') this.radius = 4;
    else if (this.type === 'impermeable' || this.type === 'fructose' || this.type === 'solute_large') this.radius = 8;
    else this.radius = 6;
  }

  update(mode) {
    this.x += this.vx;
    this.y += this.vy;

    // 캔버스 벽 충돌 반사
    if (this.x - this.radius < 0) { this.x = this.radius; this.vx *= -1; }
    if (this.x + this.radius > canvas.width) { this.x = canvas.width - this.radius; this.vx *= -1; }
    if (this.y - this.radius < 0) { this.y = this.radius; this.vy *= -1; }
    if (this.y + this.radius > canvas.height) { this.y = canvas.height - this.radius; this.vy *= -1; }

    const topMembrane = MEMBRANE_Y - MEMBRANE_THICKNESS / 2;
    const bottomMembrane = MEMBRANE_Y + MEMBRANE_THICKNESS / 2;

    // 세포막 영역에 들어왔을 때의 판별
    if (this.y + this.radius > topMembrane && this.y - this.radius < bottomMembrane) {
      let canPass = false;

      if (mode === 'simple') {
        if (this.type === 'permeable') canPass = true;
      } 
      else if (mode === 'facilitated') {
        let inChannel = channels.some(ch => Math.abs(this.x - ch.x) < ch.width / 2);
        if (inChannel && this.type === 'glucose') canPass = true;
      } 
      else if (mode === 'active') {
        let inChannel = channels.some(ch => Math.abs(this.x - ch.x) < ch.width / 2);
        if (inChannel) {
          this.vy = -5.0; // 강제로 위쪽(세포 밖)으로 튕겨냄
          canPass = true;
        }
      } 
      else if (mode === 'osmosis') {
        let inChannel = channels.some(ch => Math.abs(this.x - ch.x) < ch.width / 2);
        if (this.type === 'water' && (inChannel || Math.random() < 0.5)) canPass = true;
      }

      // 통과하지 못하는 물질은 막 경계에서 즉시 반사
      if (!canPass) {
        if (this.y < MEMBRANE_Y) {
          this.y = topMembrane - this.radius;
          this.vy = -Math.abs(this.vy);
        } else {
          this.y = bottomMembrane + this.radius;
          this.vy = Math.abs(this.vy);
        }
      }
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

    switch (this.type) {
      case 'permeable': ctx.fillStyle = '#10b981'; break;
      case 'impermeable': ctx.fillStyle = '#ef4444'; break;
      case 'glucose': ctx.fillStyle = '#3b82f6'; break;
      case 'fructose': ctx.fillStyle = '#f97316'; break;
      case 'active_ion': ctx.fillStyle = '#8b5cf6'; break;
      case 'water': ctx.fillStyle = '#0284c7'; break;
      case 'solute_large': ctx.fillStyle = '#dc2626'; break;
      default: ctx.fillStyle = '#64748b';
    }

    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.closePath();
  }
}

function updateLegendAndDesc(mode) {
  const conf = MODE_CONFIG[mode];
  modeDescEl.innerHTML = conf.desc;
  legendBox.innerHTML = '<strong>물질 범례</strong><br>';
  conf.legend.forEach(item => {
    const div = document.createElement('div');
    div.className = 'legend-item';
    div.innerHTML = `<span class="legend-dot" style="background-color: ${item.color};"></span><span>${item.label}</span>`;
    legendBox.appendChild(div);
  });
}

function initSimulation() {
  const mode = modeSelect.value;
  particles = [];
  channels = [];
  updateLegendAndDesc(mode);

  const topZone = MEMBRANE_Y - MEMBRANE_THICKNESS / 2 - 15;
  const bottomZoneStart = MEMBRANE_Y + MEMBRANE_THICKNESS / 2 + 15;
  const bottomZoneHeight = canvas.height - bottomZoneStart - 10;

  if (mode === 'simple') {
    for (let i = 0; i < 30; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'permeable'));
    for (let i = 0; i < 20; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'impermeable'));
    for (let i = 0; i < 6; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * bottomZoneHeight + bottomZoneStart, 'permeable'));
  } 
  else if (mode === 'facilitated') {
    channels.push({ x: canvas.width * 0.35, width: 36, name: 'GLUT' });
    channels.push({ x: canvas.width * 0.65, width: 36, name: 'GLUT' });

    for (let i = 0; i < 25; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'glucose'));
    for (let i = 0; i < 20; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'fructose'));
  } 
  else if (mode === 'active') {
    channels.push({ x: canvas.width * 0.3, width: 40, name: 'ATP 펌프' });
    channels.push({ x: canvas.width * 0.7, width: 40, name: 'ATP 펌프' });

    for (let i = 0; i < 35; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'active_ion'));
    for (let i = 0; i < 15; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * bottomZoneHeight + bottomZoneStart, 'active_ion'));
  } 
  else if (mode === 'osmosis') {
    channels.push({ x: canvas.width * 0.3, width: 28, name: 'AQP' });
    channels.push({ x: canvas.width * 0.7, width: 28, name: 'AQP' });

    for (let i = 0; i < 40; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'water'));
    for (let i = 0; i < 12; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * bottomZoneHeight + bottomZoneStart, 'water'));
    for (let i = 0; i < 18; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * bottomZoneHeight + bottomZoneStart, 'solute_large'));
  }
}

function drawMembrane() {
  const top = MEMBRANE_Y - MEMBRANE_THICKNESS / 2;
  
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(0, top, canvas.width, MEMBRANE_THICKNESS);

  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, top); ctx.lineTo(canvas.width, top);
  ctx.moveTo(0, top + MEMBRANE_THICKNESS); ctx.lineTo(canvas.width, top + MEMBRANE_THICKNESS);
  ctx.stroke();

  channels.forEach(ch => {
    ctx.fillStyle = modeSelect.value === 'active' ? '#f59e0b' : '#6366f1';
    ctx.fillRect(ch.x - ch.width / 2, top - 6, ch.width, MEMBRANE_THICKNESS + 12);
    ctx.clearRect(ch.x - ch.width / 4, top - 6, ch.width / 2, MEMBRANE_THICKNESS + 12);

    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ch.name, ch.x, MEMBRANE_Y + 3);
  });

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('세포 외액 (Outside)', 14, 24);
  ctx.fillText('세포막 (Phospholipid Bilayer)', 14, MEMBRANE_Y - 8);
  ctx.fillText('세포질 (Inside)', 14, canvas.height - 18);
}

function updateCounts() {
  let outCount = 0, inCount = 0;
  particles.forEach(p => {
    if (p.y < MEMBRANE_Y) outCount++;
    else inCount++;
  });
  outsideCountEl.textContent = outCount;
  insideCountEl.textContent = inCount;
}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMembrane();

  const mode = modeSelect.value;
  particles.forEach(p => {
    p.update(mode);
    p.draw();
  });

  updateCounts();
  requestAnimationFrame(loop);
}

modeSelect.addEventListener('change', initSimulation);
resetBtn.addEventListener('click', initSimulation);

initSimulation();
loop();
