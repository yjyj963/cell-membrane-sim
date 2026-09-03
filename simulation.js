const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

const modeSelect = document.getElementById('modeSelect');
const resetBtn = document.getElementById('resetBtn');
const outsideCountEl = document.getElementById('outsideCount');
const insideCountEl = document.getElementById('insideCount');
const modeDescEl = document.getElementById('modeDesc');
const legendBox = document.getElementById('legendBox');

const MEMBRANE_Y = canvas.height / 2;
const MEMBRANE_THICKNESS = 62;
const HEAD_RADIUS = 6.5;

let particles = [];
let proteins = [];

const MODE_CONFIG = {
  all: {
    desc: "<b>교과서 종합 모드:</b><br>• <b>작은 분자(산소)/소수성:</b> 인지질 2중층을 직접 쉽게 통과<br>• <b>포도당:</b> 운반체 단백질을 통해서만 통과 (과당은 통과 불가)<br>• <b>이온:</b> 전하 때문에 인지질은 통과 못하며, 통로단백질을 통해 이동",
    legend: [
      { type: 'circle', color: '#ef4444', label: '산소/소수성 분자 (직접 통과)' },
      { type: 'hex', color: '#db2777', label: '포도당 (운반체단백질 통과)' },
      { type: 'hex', color: '#f97316', label: '과당 (특이성 결여, 통과 불가)' },
      { type: 'circle', color: '#84cc16', label: '이온(Na+/K+) (통로단백질 통과)' }
    ]
  },
  simple: {
    desc: "<b>단순 확산:</b> 기체 및 작은 비극성 분자는 친수성 머리와 소수성 꼬리로 이루어진 인지질 2중층을 직접 투과하여 농도가 높은 곳에서 낮은 곳으로 이동합니다.",
    legend: [
      { type: 'circle', color: '#ef4444', label: '산소 분자 (직접 투과)' },
      { type: 'circle', color: '#84cc16', label: '이온 (소수성 코어 통과 불가)' }
    ]
  },
  carrier: {
    desc: "<b>운반체 단백질 촉진 확산:</b> 운반체 단백질은 특정 입체 구조를 가진 포도당과만 결합하여 통과시킵니다. 구조가 다른 과당은 결합하지 못하고 튕겨 나옵니다.",
    legend: [
      { type: 'hex', color: '#db2777', label: '포도당 (운반체 결합 후 통과)' },
      { type: 'hex', color: '#f97316', label: '과당 (특이성 결여, 반사)' }
    ]
  },
  channel: {
    desc: "<b>통로 단백질 촉진 확산:</b> 친수성 구멍이 형성되어 있어 전하를 띤 이온들이 인지질의 방해를 받지 않고 농도 기울기에 따라 신속하게 통과합니다.",
    legend: [
      { type: 'circle', color: '#84cc16', label: '이온 (통로단백질 신속 통과)' },
      { type: 'circle', color: '#64748b', label: '불투과성 대형 입자' }
    ]
  },
  active: {
    desc: "<b>능동 수송:</b> ATP 에너지를 이용하여 세포 내 저농도 이온을 세포 밖 고농도 환경으로 강제 펌핑합니다.",
    legend: [
      { type: 'circle', color: '#84cc16', label: '수송 이온 (농도 기울기 역행)' },
      { type: 'rect', color: '#f97316', label: 'ATP 펌프 단백질' }
    ]
  }
};

// 교과서 스타일 단백질 정의
function setupProteins(mode) {
  proteins = [];
  if (mode === 'all') {
    proteins.push({ type: 'carrier', x: 440, width: 68, name: '운반체단백질' });
    proteins.push({ type: 'channel', x: 670, width: 64, name: '통로단백질' });
  } else if (mode === 'carrier') {
    proteins.push({ type: 'carrier', x: 340, width: 70, name: '운반체단백질 1' });
    proteins.push({ type: 'carrier', x: 550, width: 70, name: '운반체단백질 2' });
  } else if (mode === 'channel') {
    proteins.push({ type: 'channel', x: 340, width: 66, name: '통로단백질 1' });
    proteins.push({ type: 'channel', x: 560, width: 66, name: '통로단백질 2' });
  } else if (mode === 'active') {
    proteins.push({ type: 'pump', x: 380, width: 72, name: 'ATP 펌프' });
    proteins.push({ type: 'pump', x: 600, width: 72, name: 'ATP 펌프' });
  }
}

class Particle {
  constructor(x, y, kind) {
    this.x = x;
    this.y = y;
    this.kind = kind; // 'oxygen', 'glucose', 'fructose', 'ion', 'blocked'
    
    const baseSpeed = 3.2;
    this.vx = (Math.random() - 0.5) * baseSpeed;
    this.vy = (Math.random() - 0.5) * baseSpeed;

    if (this.kind === 'oxygen') this.radius = 5.5;
    else if (this.kind === 'ion') this.radius = 6;
    else this.radius = 8; // 포도당, 과당
  }

  update(mode, netDir) {
    const topMembrane = MEMBRANE_Y - MEMBRANE_THICKNESS / 2;
    const bottomMembrane = MEMBRANE_Y + MEMBRANE_THICKNESS / 2;

    // --- 수송체 유도(Attraction) 로직 ---
    if (this.kind === 'glucose') {
      let carrier = proteins.find(p => p.type === 'carrier');
      if (carrier && this.y < topMembrane && this.y > topMembrane - 90 && netDir >= 0) {
        this.vx += (carrier.x - this.x) * 0.05;
        this.vy = Math.abs(this.vy) + 0.4;
      }
    } else if (this.kind === 'ion' && mode !== 'active') {
      let ch = proteins.find(p => p.type === 'channel');
      if (ch && this.y < topMembrane && this.y > topMembrane - 80 && netDir >= 0) {
        this.vx += (ch.x - this.x) * 0.05;
        this.vy = Math.abs(this.vy) + 0.4;
      }
    } else if (this.kind === 'ion' && mode === 'active') {
      let pump = proteins.find(p => p.type === 'pump');
      if (pump && this.y > bottomMembrane && this.y < bottomMembrane + 90) {
        this.vx += (pump.x - this.x) * 0.06;
        this.vy = -Math.abs(this.vy) - 0.6;
      }
    }

    this.x += this.vx;
    this.y += this.vy;

    // 감속 보정 및 최저 속도 유지
    this.vx *= 0.985;
    this.vy *= 0.985;
    if (Math.abs(this.vx) < 0.8) this.vx = (Math.random() - 0.5) * 3;
    if (Math.abs(this.vy) < 0.8) this.vy = (Math.random() - 0.5) * 3;

    // 벽면 충돌
    if (this.x - this.radius < 0) { this.x = this.radius; this.vx = Math.abs(this.vx); }
    if (this.x + this.radius > canvas.width) { this.x = canvas.width - this.radius; this.vx = -Math.abs(this.vx); }
    if (this.y - this.radius < 0) { this.y = this.radius; this.vy = Math.abs(this.vy); }
    if (this.y + this.radius > canvas.height) { this.y = canvas.height - this.radius; this.vy = -Math.abs(this.vy); }

    // 막 접촉 판별
    if (this.y + this.radius > topMembrane && this.y - this.radius < bottomMembrane) {
      let canPass = false;

      // 1. 산소 (인지질 층 직접 투과)
      if (this.kind === 'oxygen') {
        canPass = true;
        if (netDir > 0 && this.y < MEMBRANE_Y) this.vy = 3.5;
        else if (netDir < 0 && this.y > MEMBRANE_Y) this.vy = -3.5;
      }

      // 2. 포도당 (운반체 단백질 위치만 투과)
      else if (this.kind === 'glucose') {
        let insideCarrier = proteins.some(p => p.type === 'carrier' && Math.abs(this.x - p.x) < p.width / 2.3);
        if (insideCarrier) {
          canPass = true;
          if (netDir >= 0 && this.y < MEMBRANE_Y) this.vy = 4.2;
        }
      }

      // 3. 이온 (통로 단백질 또는 펌프 투과)
      else if (this.kind === 'ion') {
        let insideChannel = proteins.some(p => p.type === 'channel' && Math.abs(this.x - p.x) < p.width / 2.5);
        let insidePump = proteins.some(p => p.type === 'pump' && Math.abs(this.x - p.x) < p.width / 2.5);
        
        if (insideChannel) {
          canPass = true;
          if (netDir >= 0 && this.y < MEMBRANE_Y) this.vy = 4.5;
        } else if (insidePump) {
          canPass = true;
          this.vy = -6.0; // 밖으로 배출
        }
      }

      // 통과 불가 시 반사 (과당, 인지질에 부딪힌 이온 등)
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
    ctx.save();
    if (this.kind === 'glucose' || this.kind === 'fructose') {
      // 6각형 (포도당: 핑크), 5각형 (과당: 주황)
      ctx.fillStyle = this.kind === 'glucose' ? '#db2777' : '#ea580c';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      drawPolygon(ctx, this.x, this.y, this.radius, this.kind === 'glucose' ? 6 : 5);
    } else {
      // 원형 분자 (산소: 적색, 이온: 연두)
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.kind === 'oxygen' ? '#ef4444' : (this.kind === 'ion' ? '#84cc16' : '#64748b');
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.closePath();
    }
    ctx.restore();
  }
}

function drawPolygon(c, x, y, radius, sides) {
  c.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (i * 2 * Math.PI) / sides;
    const px = x + radius * Math.cos(a);
    const py = y + radius * Math.sin(a);
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  c.fill();
  c.stroke();
}

// 교과서풍 인지질 2중층(Phospholipid Bilayer) 그리기
function drawPhospholipidBilayer() {
  const topY = MEMBRANE_Y - MEMBRANE_THICKNESS / 2;
  const botY = MEMBRANE_Y + MEMBRANE_THICKNESS / 2;
  const step = 14;

  for (let x = 8; x < canvas.width; x += step) {
    // 단백질이 배치된 곳은 인지질을 그리지 않음
    let inProtein = proteins.some(p => Math.abs(x - p.x) < p.width / 1.8);
    if (inProtein) continue;

    // 1. 소수성 꼬리 (Hydrophobic tails) - 2가닥 구불구불한 선
    ctx.strokeStyle = '#c29d62';
    ctx.lineWidth = 1.6;

    // 상층 꼬리 (아래로 뻗음)
    ctx.beginPath();
    ctx.moveTo(x - 2, topY + HEAD_RADIUS);
    ctx.quadraticCurveTo(x - 5, topY + 16, x - 2, topY + 25);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 2, topY + HEAD_RADIUS);
    ctx.quadraticCurveTo(x + 5, topY + 16, x + 2, topY + 25);
    ctx.stroke();

    // 하층 꼬리 (위로 뻗음)
    ctx.beginPath();
    ctx.moveTo(x - 2, botY - HEAD_RADIUS);
    ctx.quadraticCurveTo(x - 5, botY - 16, x - 2, botY - 25);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 2, botY - HEAD_RADIUS);
    ctx.quadraticCurveTo(x + 5, botY - 16, x + 2, botY - 25);
    ctx.stroke();

    // 2. 친수성 머리 (Hydrophilic heads) - 둥근 주황/황갈색 볼
    drawHead(x, topY);
    drawHead(x, botY);
  }
}

function drawHead(x, y) {
  let grad = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, HEAD_RADIUS);
  grad.addColorStop(0, '#fbd38d');
  grad.addColorStop(1, '#b7791f');

  ctx.beginPath();
  ctx.arc(x, y, HEAD_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#975a16';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.closePath();
}

// 교과서풍 막 단백질(운반체 & 통로) 그리기
function drawProteins() {
  const topY = MEMBRANE_Y - MEMBRANE_THICKNESS / 2 - 6;
  const h = MEMBRANE_THICKNESS + 12;

  proteins.forEach(p => {
    ctx.save();
    if (p.type === 'carrier') {
      // 1. 운반체 단백질 (주황빛 조개/튤립 모양)
      let grad = ctx.createLinearGradient(p.x - p.width / 2, topY, p.x + p.width / 2, topY + h);
      grad.addColorStop(0, '#f97316');
      grad.addColorStop(0.5, '#fdba74');
      grad.addColorStop(1, '#ea580c');

      ctx.fillStyle = grad;
      ctx.strokeStyle = '#c2410c';
      ctx.lineWidth = 2;

      // 좌측 엽
      ctx.beginPath();
      ctx.ellipse(p.x - p.width / 4, MEMBRANE_Y, p.width / 3.8, h / 1.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 우측 엽
      ctx.beginPath();
      ctx.ellipse(p.x + p.width / 4, MEMBRANE_Y, p.width / 3.8, h / 1.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 결합 포켓
      ctx.fillStyle = '#ffedd5';
      ctx.beginPath();
      ctx.arc(p.x, MEMBRANE_Y, 8, 0, Math.PI * 2);
      ctx.fill();

      // 라벨
      ctx.fillStyle = '#7c2d12';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, p.x, MEMBRANE_Y + h / 2 + 18);
    } 
    else if (p.type === 'channel') {
      // 2. 통로 단백질 (푸른빛 원통형 채널)
      let grad = ctx.createLinearGradient(p.x - p.width / 2, topY, p.x + p.width / 2, topY + h);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(0.5, '#bae6fd');
      grad.addColorStop(1, '#0284c7');

      ctx.fillStyle = grad;
      ctx.strokeStyle = '#0369a1';
      ctx.lineWidth = 2;

      // 좌측 배럴
      ctx.beginPath();
      ctx.roundRect(p.x - p.width / 2, topY, p.width / 2.3, h, 8);
      ctx.fill();
      ctx.stroke();

      // 우측 배럴
      ctx.beginPath();
      ctx.roundRect(p.x + p.width / 2 - p.width / 2.3, topY, p.width / 2.3, h, 8);
      ctx.fill();
      ctx.stroke();

      // 중앙 친수성 채널 공간 (블루 하이라이트)
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(p.x - 5, topY + 4, 10, h - 8);

      ctx.fillStyle = '#075985';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, p.x, MEMBRANE_Y + h / 2 + 18);
    }
    else if (p.type === 'pump') {
      // 3. ATP 펌프 단백질
      ctx.fillStyle = '#eab308';
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(p.x - p.width / 2, topY, p.width, h, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#713f12';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, p.x, MEMBRANE_Y);
      ctx.fillText('ATP', p.x, MEMBRANE_Y + h / 2 + 16);
    }
    ctx.restore();
  });
}

function drawBackgroundAndLabels() {
  // 세포 밖 (연파랑)
  ctx.fillStyle = '#dbeafe';
  ctx.fillRect(0, 0, canvas.width, MEMBRANE_Y);

  // 세포 안 (연크림 노랑)
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(0, MEMBRANE_Y, canvas.width, canvas.height - MEMBRANE_Y);

  // 텍스트 라벨
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('세포 밖 (Outside)', 20, 32);

  ctx.fillStyle = '#78350f';
  ctx.fillText('세포 안 (Inside)', 20, canvas.height - 20);

  // 우측 "인지질 이중층" 브래킷 표시 (교과서 스타일)
  const topY = MEMBRANE_Y - MEMBRANE_THICKNESS / 2;
  const botY = MEMBRANE_Y + MEMBRANE_THICKNESS / 2;
  const bx = canvas.width - 25;

  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx - 6, topY);
  ctx.lineTo(bx, topY);
  ctx.lineTo(bx, botY);
  ctx.lineTo(bx - 6, botY);
  ctx.stroke();

  ctx.fillStyle = '#92400e';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('인지질 이중층', bx - 10, MEMBRANE_Y + 4);
}

function updateLegendAndDesc(mode) {
  const conf = MODE_CONFIG[mode];
  modeDescEl.innerHTML = conf.desc;
  legendBox.innerHTML = '<strong>물질 범례</strong><br>';
  conf.legend.forEach(item => {
    const div = document.createElement('div');
    div.className = 'legend-item';
    let icon = `<span class="legend-icon legend-circle" style="background-color: ${item.color};"></span>`;
    if (item.type === 'hex') {
      icon = `<span class="legend-icon legend-hex" style="background-color: ${item.color};"></span>`;
    }
    div.innerHTML = `${icon}<span>${item.label}</span>`;
    legendBox.appendChild(div);
  });
}

function initSimulation() {
  const mode = modeSelect.value;
  particles = [];
  setupProteins(mode);
  updateLegendAndDesc(mode);

  const topZone = MEMBRANE_Y - MEMBRANE_THICKNESS / 2 - 25;
  const botStart = MEMBRANE_Y + MEMBRANE_THICKNESS / 2 + 25;
  const botH = canvas.height - botStart - 15;

  if (mode === 'all') {
    // 산소 16개 (직접 통과)
    for (let i = 0; i < 16; i++) particles.push(new Particle(Math.random() * 260 + 20, Math.random() * topZone + 15, 'oxygen'));
    // 포도당 14개 + 과당 10개 (운반체 구역)
    for (let i = 0; i < 14; i++) particles.push(new Particle(Math.random() * 180 + 340, Math.random() * topZone + 15, 'glucose'));
    for (let i = 0; i < 10; i++) particles.push(new Particle(Math.random() * 180 + 340, Math.random() * topZone + 15, 'fructose'));
    // 이온 16개 (통로 구역)
    for (let i = 0; i < 16; i++) particles.push(new Particle(Math.random() * 180 + 580, Math.random() * topZone + 15, 'ion'));
  } 
  else if (mode === 'simple') {
    for (let i = 0; i < 28; i++) particles.push(new Particle(Math.random() * (canvas.width - 40) + 20, Math.random() * topZone + 15, 'oxygen'));
    for (let i = 0; i < 18; i++) particles.push(new Particle(Math.random() * (canvas.width - 40) + 20, Math.random() * topZone + 15, 'ion'));
    for (let i = 0; i < 4; i++) particles.push(new Particle(Math.random() * (canvas.width - 40) + 20, Math.random() * botH + botStart, 'oxygen'));
  } 
  else if (mode === 'carrier') {
    for (let i = 0; i < 24; i++) particles.push(new Particle(Math.random() * (canvas.width - 40) + 20, Math.random() * topZone + 15, 'glucose'));
    for (let i = 0; i < 18; i++) particles.push(new Particle(Math.random() * (canvas.width - 40) + 20, Math.random() * topZone + 15, 'fructose'));
    for (let i = 0; i < 3; i++) particles.push(new Particle(Math.random() * (canvas.width - 40) + 20, Math.random() * botH + botStart, 'glucose'));
  } 
  else if (mode === 'channel') {
    for (let i = 0; i < 30; i++) particles.push(new Particle(Math.random() * (canvas.width - 40) + 20, Math.random() * topZone + 15, 'ion'));
    for (let i = 0; i < 4; i++) particles.push(new Particle(Math.random() * (canvas.width - 40) + 20, Math.random() * botH + botStart, 'ion'));
  } 
  else if (mode === 'active') {
    for (let i = 0; i < 32; i++) particles.push(new Particle(Math.random() * (canvas.width - 40) + 20, Math.random() * topZone + 15, 'ion'));
    for (let i = 0; i < 14; i++) particles.push(new Particle(Math.random() * (canvas.width - 40) + 20, Math.random() * botH + botStart, 'ion'));
  }
}

function calculateNetDirection() {
  let outCount = 0, inCount = 0;
  particles.forEach(p => {
    if (p.kind !== 'fructose') {
      if (p.y < MEMBRANE_Y) outCount++;
      else inCount++;
    }
  });

  if (modeSelect.value === 'active') {
    return inCount > 2 ? -1 : 0;
  }
  if (Math.abs(outCount - inCount) <= 4) return 0;
  return outCount > inCount ? 1 : -1;
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
  
  drawBackgroundAndLabels();
  drawPhospholipidBilayer();
  drawProteins();

  const mode = modeSelect.value;
  const netDir = calculateNetDirection();

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
