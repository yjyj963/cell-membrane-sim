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
    desc: "<b>단순 확산:</b> 산소($O_2$) 같은 작은 지용성 분자는 인지질 2중층을 직접 관통하여 고농도에서 저농도로 빠르게 이동합니다. 극성/대형 분자는 막을 통과하지 못합니다.",
    legend: [
      { color: '#10b981', label: '산소/비극성 분자 (막 직접 통과)' },
      { color: '#ef4444', label: '극성/대형 분자 (투과 불가)' }
    ]
  },
  facilitated: {
    desc: "<b>촉진 확산 (기질 특이성):</b> 포도당은 수송체(GLUT)에 결합하여 세포 안으로 신속하게 이동합니다. 반면 과당은 결합 부위 특이성이 맞지 않아 튕겨 나갑니다.",
    legend: [
      { color: '#3b82f6', label: '포도당 (GLUT 결합 및 통과)' },
      { color: '#f97316', label: '과당 (특이성 결여, 통과 불가)' }
    ]
  },
  active: {
    desc: "<b>능동 수송:</b> 세포질(하단)의 저농도 이온을 ATP 에너지를 소모하는 펌프 단백질이 포획하여 세포 밖(상단)으로 강제 펌핑합니다.",
    legend: [
      { color: '#8b5cf6', label: '수송 이온 (농도 기울기 역행)' },
      { color: '#f59e0b', label: 'ATP 펌프 (역방향 강제 배출)' }
    ]
  },
  osmosis: {
    desc: "<b>삼투 현상:</b> 용질은 막을 통과할 수 없습니다. 물 분자가 아쿠아포린(AQP)을 통해 고농도 용질 구역(세포 안)으로 빠르게 순이동합니다.",
    legend: [
      { color: '#0284c7', label: '물 분자 (아쿠아포린 통과)' },
      { color: '#dc2626', label: '불투과성 용질' }
    ]
  }
};

class Particle {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    
    // 기본 브라운 운동 속도
    const speed = 3.5;
    this.vx = (Math.random() - 0.5) * speed;
    this.vy = (Math.random() - 0.5) * speed;

    if (this.type === 'water') this.radius = 4;
    else if (this.type === 'impermeable' || this.type === 'fructose' || this.type === 'solute_large') this.radius = 8;
    else this.radius = 6;
  }

  update(mode) {
    const topMembrane = MEMBRANE_Y - MEMBRANE_THICKNESS / 2;
    const bottomMembrane = MEMBRANE_Y + MEMBRANE_THICKNESS / 2;

    // --- 통로 근접 시 유인(Attraction) 로직 ---
    if (mode === 'facilitated' && this.type === 'glucose' && this.y < topMembrane) {
      // 가장 가까운 GLUT 통로 탐색
      let nearestChannel = channels.reduce((prev, curr) => 
        Math.abs(curr.x - this.x) < Math.abs(prev.x - this.x) ? curr : prev, channels[0]);
      
      // 막 근처에 오면 통로 중심 방향으로 유인
      if (nearestChannel && this.y > topMembrane - 90) {
        let dx = nearestChannel.x - this.x;
        this.vx += dx * 0.05;
        this.vy = Math.abs(this.vy) + 0.5; // 아래로 유도
      }
    } 
    else if (mode === 'active' && this.type === 'active_ion' && this.y > bottomMembrane) {
      // 능동 수송: 아래쪽 이온을 펌프로 유인
      let nearestChannel = channels.reduce((prev, curr) => 
        Math.abs(curr.x - this.x) < Math.abs(prev.x - this.x) ? curr : prev, channels[0]);
      
      if (nearestChannel && this.y < bottomMembrane + 100) {
        let dx = nearestChannel.x - this.x;
        this.vx += dx * 0.06;
        this.vy = -Math.abs(this.vy) - 0.6; // 위로 유도
      }
    }
    else if (mode === 'osmosis' && this.type === 'water' && this.y < topMembrane) {
      // 삼투: 위쪽 물 분자를 막 통로로 유도
      if (this.y > topMembrane - 70) {
        this.vy = Math.abs(this.vy) + 0.4;
      }
    }

    // 위치 업데이트
    this.x += this.vx;
    this.y += this.vy;

    // 속도 감쇠 및 유지
    this.vx *= 0.98;
    this.vy *= 0.98;
    if (Math.abs(this.vx) < 1.0) this.vx = (Math.random() - 0.5) * 3;
    if (Math.abs(this.vy) < 1.0) this.vy = (Math.random() - 0.5) * 3;

    // 외곽 벽 충돌
    if (this.x - this.radius < 0) { this.x = this.radius; this.vx = Math.abs(this.vx); }
    if (this.x + this.radius > canvas.width) { this.x = canvas.width - this.radius; this.vx = -Math.abs(this.vx); }
    if (this.y - this.radius < 0) { this.y = this.radius; this.vy = Math.abs(this.vy); }
    if (this.y + this.radius > canvas.height) { this.y = canvas.height - this.radius; this.vy = -Math.abs(this.vy); }

    // --- 세포막 상호작용 판별 ---
    if (this.y + this.radius > topMembrane && this.y - this.radius < bottomMembrane) {
      
      // 1. 단순 확산
      if (mode === 'simple') {
        if (this.type === 'permeable') {
          // 위쪽에 있을 때는 아래로 직진 통과
          if (this.y < MEMBRANE_Y) this.vy = 3.5;
        } else {
          this.bounce(topMembrane, bottomMembrane);
        }
      }

      // 2. 촉진 확산
      else if (mode === 'facilitated') {
        let inChannel = channels.some(ch => Math.abs(this.x - ch.x) < ch.width / 2);
        if (inChannel && this.type === 'glucose') {
          // 통로 통과 시 빠르게 세포질(아래)로 배출
          this.vy = 4.5;
          // 통로 중간에 걸리지 않도록 x좌표 보정
        } else {
          this.bounce(topMembrane, bottomMembrane);
        }
      }

      // 3. 능동 수송
      else if (mode === 'active') {
        let inChannel = channels.some(ch => Math.abs(this.x - ch.x) < ch.width / 2);
        if (inChannel && this.type === 'active_ion') {
          // ATP 소모를 통해 위(세포 밖)로 고속 배출
          this.vy = -6.0;
        } else {
          this.bounce(topMembrane, bottomMembrane);
        }
      }

      // 4. 삼투 현상
      else if (mode === 'osmosis') {
        let inChannel = channels.some(ch => Math.abs(this.x - ch.x) < ch.width / 2);
        if (this.type === 'water') {
          if (inChannel || Math.random() < 0.8) {
            // 물 분자는 아래(고장액 구역)로 빠른 수송
            if (this.y < MEMBRANE_Y) this.vy = 4.0;
          }
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
    for (let i = 0; i < 35; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'permeable'));
    for (let i = 0; i < 20; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'impermeable'));
    for (let i = 0; i < 4; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * bottomZoneHeight + bottomZoneStart, 'permeable'));
  } 
  else if (mode === 'facilitated') {
    // 통로 너비를 46px로 확장하고 3개 배치하여 반응 속도 증대
    channels.push({ x: canvas.width * 0.22, width: 46, name: 'GLUT' });
    channels.push({ x: canvas.width * 0.50, width: 46, name: 'GLUT' });
    channels.push({ x: canvas.width * 0.78, width: 46, name: 'GLUT' });

    for (let i = 0; i < 30; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'glucose'));
    for (let i = 0; i < 20; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'fructose'));
  } 
  else if (mode === 'active') {
    channels.push({ x: canvas.width * 0.30, width: 50, name: 'ATP 펌프' });
    channels.push({ x: canvas.width * 0.70, width: 50, name: 'ATP 펌프' });

    for (let i = 0; i < 40; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'active_ion'));
    for (let i = 0; i < 15; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * bottomZoneHeight + bottomZoneStart, 'active_ion'));
  } 
  else if (mode === 'osmosis') {
    channels.push({ x: canvas.width * 0.25, width: 34, name: 'AQP' });
    channels.push({ x: canvas.width * 0.50, width: 34, name: 'AQP' });
    channels.push({ x: canvas.width * 0.75, width: 34, name: 'AQP' });

    for (let i = 0; i < 45; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * topZone + 10, 'water'));
    for (let i = 0; i < 10; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * bottomZoneHeight + bottomZoneStart, 'water'));
    for (let i = 0; i < 20; i++) particles.push(new Particle(Math.random() * (canvas.width - 30) + 15, Math.random() * bottomZoneHeight + bottomZoneStart, 'solute_large'));
  }
}

function drawMembrane() {
  const top = MEMBRANE_Y - MEMBRANE_THICKNESS / 2;
  
  // 인지질 이중층 본체
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(0, top, canvas.width, MEMBRANE_THICKNESS);

  // 막 경계선
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, top); ctx.lineTo(canvas.width, top);
  ctx.moveTo(0, top + MEMBRANE_THICKNESS); ctx.lineTo(canvas.width, top + MEMBRANE_THICKNESS);
  ctx.stroke();

  // 단백질 통로/펌프 렌더링
  channels.forEach(ch => {
    ctx.fillStyle = modeSelect.value === 'active' ? '#f59e0b' : '#6366f1';
    ctx.fillRect(ch.x - ch.width / 2, top - 8, ch.width, MEMBRANE_THICKNESS + 16);
    
    // 입구 열린 공간 표시
    ctx.clearRect(ch.x - ch.width / 3.5, top - 8, ch.width / 1.75, MEMBRANE_THICKNESS + 16);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ch.name, ch.x, MEMBRANE_Y + 4);
  });

  // 구역 표시
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
