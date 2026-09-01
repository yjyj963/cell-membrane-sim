const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

const modeSelect = document.getElementById('modeSelect');
const resetBtn = document.getElementById('resetBtn');
const outsideCountEl = document.getElementById('outsideCount');
const insideCountEl = document.getElementById('insideCount');
const modeDescEl = document.getElementById('modeDesc');
const legendBox = document.getElementById('legendBox');

const MEMBRANE_Y = canvas.height / 2;
const MEMBRANE_THICKNESS = 46;

let particles = [];
let channels = [];

const MODE_CONFIG = {
  simple: {
    desc: "<b>단순 확산:</b> 산소($O_2$)가 인지질 2중층을 통과하여 고농도에서 저농도로 이동합니다. <b>동적 평형(세포 안팎의 농도가 같아짐)</b>에 도달하면 순이동량이 0이 되어 농도가 일정하게 유지됩니다.",
    legend: [
      { color: '#10b981', label: '산소/비극성 분자 (막 통과 가능)' },
      { color: '#ef4444', label: '극성/대형 분자 (막 통과 불가)' }
    ]
  },
  facilitated: {
    desc: "<b>촉진 확산:</b> 포도당은 GLUT 통로를 통해 빠르게 이동하여 <b>동적 평형(50:50)</b>을 형성한 뒤 안정적으로 유지됩니다. 과당은 특이성이 맞지 않아 전혀 통과하지 못합니다.",
    legend: [
      { color: '#2563eb', label: '포도당 (GLUT 결합 및 통과)' },
      { color: '#ea580c', label: '과당 (특이성 결여, 통과 불가)' }
    ]
  },
  active: {
    desc: "<b>능동 수송:</b> ATP 펌프가 농도 기울기를 거슬러 세포 안의 이온을 밖으로 강제 수송합니다. 세포 밖 고농도, 세포 안 저농도 상태가 완성되면 안정화됩니다.",
    legend: [
      { color: '#9333ea', label: '수송 이온 (역방향 수송)' },
      { color: '#f59e0b', label: 'ATP 펌프 단백질' }
    ]
  },
  osmosis: {
    desc: "<b>삼투 현상:</b> 용질은 통과하지 못하며, 물 분자가 고농도 용질 구역(세포 안)으로 빠르게 유입되어 수분 퍼텐셜 평형에 도달하면 안정화됩니다.",
    legend: [
      { color: '#0284c7', label: '물 분자 (아쿠아포린 통과)' },
      { color: '#b91c1c', label: '막 불투과성 대형 용질' }
    ]
  }
};

class Particle {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    
    const speed = 3.2;
    this.vx = (Math.random() - 0.5) * speed;
    this.vy = (Math.random() - 0.5) * speed;

    if (this.type === 'water') this.radius = 4;
    else if (this.type === 'impermeable' || this.type === 'fructose' || this.type === 'solute_large') this.radius = 8;
    else this.radius = 6;
  }

  update(mode, netDirection) {
    const topMembrane = MEMBRANE_Y - MEMBRANE_THICKNESS / 2;
    const bottomMembrane = MEMBRANE_Y + MEMBRANE_THICKNESS / 2;

    // --- 통로 유도(Attraction) 로직 (평형 전까지만 한 방향으로 강하게 유도) ---
    if (mode === 'facilitated' && this.type === 'glucose') {
      let nearestChannel = channels.reduce((prev, curr) => 
        Math.abs(curr.x - this.x) < Math.abs(prev.x - this.x) ? curr : prev, channels[0]);
      
      // 위쪽이 많을 때는 아래로, 아래쪽이 많을 때는 위로 유인
      if (netDirection > 0 && this.y < topMembrane && this.y > topMembrane - 80) {
        this.vx += (nearestChannel.x - this.x) * 0.05;
        this.vy = Math.abs(this.vy) + 0.4;
      } else if (netDirection < 0 && this.y > bottomMembrane && this.y < bottomMembrane + 80) {
        this.vx += (nearestChannel.x - this.x) * 0.05;
        this.vy = -Math.abs(this.vy) - 0.4;
      }
    } 
    else if (mode === 'active' && this.type === 'active_ion') {
      let nearestChannel = channels.reduce((prev, curr) => 
        Math.abs(curr.x - this.x) < Math.abs(prev.x - this.x) ? curr : prev, channels[0]);
      if (this.y > bottomMembrane && this.y < bottomMembrane + 90) {
        this.vx += (nearestChannel.x - this.x) * 0.06;
        this.vy = -Math.abs(this.vy) - 0.6;
      }
    }
    else if (mode === 'osmosis' && this.type === 'water') {
      if (netDirection > 0 && this.y < topMembrane && this.y > topMembrane - 70) {
        this.vy = Math.abs(this.vy) + 0.4;
      }
    }

    // 위치 갱신
    this.x += this.vx;
    this.y += this.vy;

    // 속도 유지
    this.vx *= 0.98;
    this.vy *= 0.98;
    if (Math.abs(this.vx) < 0.8) this.vx = (Math.random() - 0.5) * 3;
    if (Math.abs(this.vy) < 0.8) this.vy = (Math.random() - 0.5) * 3;

    // 외곽 벽 충돌
    if (this.x - this.radius < 0) { this.x = this.radius; this.vx = Math.abs(this.vx); }
    if (this.x + this.radius > canvas.width) { this.x = canvas.width - this.radius; this.vx = -Math.abs(this.vx); }
    if (this.y - this.radius < 0) { this.y = this.radius; this.vy = Math.abs(this.vy); }
    if (this.y + this.radius > canvas.height) { this.y = canvas.height - this.radius; this.vy = -Math.abs(this.vy); }

    // --- 세포막 충돌 및 통과 판별 ---
    if (this.y + this.radius > topMembrane && this.y - this.radius < bottomMembrane) {
      
      // 1. 단순 확산
      if (mode === 'simple') {
        if (this.type === 'permeable') {
          // 평형 상태 도달 시 양방향 균등 통과, 평형 전에는 고농도->저농도 우선 통과
          if (netDirection > 0 && this.y < MEMBRANE_Y) this.vy = 3.2;
          else if (netDirection < 0 && this.y > MEMBRANE_Y) this.vy = -3.2;
          // 평형(netDirection === 0) 시 관성대로 자연스럽게 통과
        } else {
          this.bounce(topMembrane, bottomMembrane);
        }
      }

      // 2. 촉진 확산
      else if (mode === 'facilitated') {
        let inChannel = channels.some(ch => Math.abs(this.x - ch.x) < ch.width / 2);
        if (inChannel && this.type === 'glucose') {
          if (netDirection > 0 && this.y < MEMBRANE_Y) this.vy = 4.0;
          else if (netDirection < 0 && this.y > MEMBRANE_Y) this.vy = -4.0;
        } else {
          this.bounce(topMembrane, bottomMembrane);
        }
      }

      // 3. 능동 수송
      else if (mode === 'active') {
        let inChannel = channels.some(ch => Math.abs(this.x - ch.x) < ch.width / 2);
        if (inChannel && this.type === 'active_ion' && this.y > MEMBRANE_Y) {
          this.vy = -5.5; // 아래에서 위로 강제 배출
        } else {
          this.bounce(topMembrane, bottomMembrane);
        }
      }

      // 4. 삼투 현상
      else if (mode === 'osmosis') {
        let inChannel = channels.some(ch => Math.abs(this.x - ch.x) < ch.width / 2);
        if (this.type === 'water') {
          if (netDirection > 0 && this.y < MEMBRANE_Y) this.vy = 3.5;
        } else {
          this.bounce(topMembrane, bottomMembrane);
        }
      }
    }
  }

  bounce(top, bottom) {
    if (this.y < MEMBRANE_Y) {
      this.y = top - this.radius;
      this.vy = -Math.abs(this.vy);
    } else {
      this.y = bottom + this.radius;
      this.vy = Math.abs(this.vy);
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

    switch (this.type) {
      case 'permeable': ctx.fillStyle = '#10b981'; break;
      case 'impermeable': ctx.fillStyle = '#ef4444'; break;
      case 'glucose': ctx.fillStyle = '#2563eb'; break;
      case 'fructose': ctx.fillStyle = '#ea580c'; break;
      case 'active_ion': ctx.fillStyle = '#9333ea'; break;
      case 'water': ctx.fillStyle = '#0284c7'; break;
      case 'solute_large': ctx.fillStyle = '#b91c1c'; break;
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

  const topZone = MEMBRANE_Y - MEMBRANE_THICKNESS / 2 - 25;
  const bottomZoneStart = MEMBRANE_Y + MEMBRANE_THICKNESS / 2 + 25;
  const bottomZoneHeight = canvas.height - bottomZoneStart - 10;

  if (mode === 'simple') {
    // 산소 32개(밖) : 4개(안) -> 평형 시 약 18:18
    for (let i = 0; i < 32; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'permeable'));
    for (let i = 0; i < 20; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'impermeable'));
    for (let i = 0; i < 4; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * bottomZoneHeight + bottomZoneStart, 'permeable'));
  } 
  else if (mode === 'facilitated') {
    channels.push({ x: canvas.width * 0.22, width: 44, name: 'GLUT' });
    channels.push({ x: canvas.width * 0.50, width: 44, name: 'GLUT' });
    channels.push({ x: canvas.width * 0.78, width: 44, name: 'GLUT' });

    // 포도당 28개(밖) : 2개(안) -> 평형 시 약 15:15
    for (let i = 0; i < 28; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'glucose'));
    for (let i = 0; i < 20; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'fructose'));
    for (let i = 0; i < 2; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * bottomZoneHeight + bottomZoneStart, 'glucose'));
  } 
  else if (mode === 'active') {
    channels.push({ x: canvas.width * 0.30, width: 48, name: 'ATP 펌프' });
    channels.push({ x: canvas.width * 0.70, width: 48, name: 'ATP 펌프' });

    for (let i = 0; i < 35; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'active_ion'));
    for (let i = 0; i < 15; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * bottomZoneHeight + bottomZoneStart, 'active_ion'));
  } 
  else if (mode === 'osmosis') {
    channels.push({ x: canvas.width * 0.25, width: 32, name: 'AQP' });
    channels.push({ x: canvas.width * 0.50, width: 32, name: 'AQP' });
    channels.push({ x: canvas.width * 0.75, width: 32, name: 'AQP' });

    for (let i = 0; i < 40; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'water'));
    for (let i = 0; i < 10; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * bottomZoneHeight + bottomZoneStart, 'water'));
    for (let i = 0; i < 20; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * bottomZoneHeight + bottomZoneStart, 'solute_large'));
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
    ctx.fillRect(ch.x - ch.width / 2, top - 8, ch.width, MEMBRANE_THICKNESS + 16);
    ctx.clearRect(ch.x - ch.width / 3.5, top - 8, ch.width / 1.75, MEMBRANE_THICKNESS + 16);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ch.name, ch.x, MEMBRANE_Y + 4);
  });

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('세포 외액 (Outside)', 14, 24);
  ctx.fillText('세포막 (Phospholipid Bilayer)', 14, MEMBRANE_Y - 8);
  ctx.fillText('세포질 (Inside)', 14, canvas.height - 18);
}

function calculateNetDirection(mode) {
  let targetType = 'permeable';
  if (mode === 'facilitated') targetType = 'glucose';
  else if (mode === 'active') targetType = 'active_ion';
  else if (mode === 'osmosis') targetType = 'water';

  let outCount = 0, inCount = 0;
  particles.forEach(p => {
    if (p.type === targetType) {
      if (p.y < MEMBRANE_Y) outCount++;
      else inCount++;
    }
  });

  // 확산/촉진확산: 안팎 개수 차이가 2개 이내면 평형 도달로 판별 (netDirection = 0)
  if (mode === 'simple' || mode === 'facilitated') {
    if (Math.abs(outCount - inCount) <= 2) return 0;
    return outCount > inCount ? 1 : -1; // 1: 아래로 순이동, -1: 위로 순이동
  }
  // 능동 수송: 아래에 입자가 남아있으면 위로 배출
  else if (mode === 'active') {
    return inCount > 2 ? -1 : 0;
  }
  // 삼투: 물 분자 평형 판별
  else if (mode === 'osmosis') {
    return inCount < 32 ? 1 : 0;
  }
  return 0;
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
  const netDir = calculateNetDirection(mode);

  particles.forEach(p => {
    p.update(mode, netDir);
    p.draw();
  });

  updateCounts();
  requestAnimationFrame(loop);
}

modeSelect.addEventListener('change', initSimulation);
resetBtn.addEventListener('click', initSimulation);

initSimulation();
loop();
