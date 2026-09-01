const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

const modeSelect = document.getElementById('modeSelect');
const speedRange = document.getElementById('speedRange');
const speedVal = document.getElementById('speedVal');
const resetBtn = document.getElementById('resetBtn');
const modeDescEl = document.getElementById('modeDesc');
const legendBox = document.getElementById('legendBox');
const statsBody = document.getElementById('statsBody');

const MEMBRANE_Y = canvas.height / 2;
const MEMBRANE_THICKNESS = 46;
let particles = [];
let channels = [];
let simSpeed = 2.5;

const MODE_CONFIG = {
  simple: {
    desc: "<strong>단순 확산:</strong> 산소(O₂) 같은 소수성·소형 무극성 분자는 인지질 2중층을 직접 빠르게 통과하지만, 전하를 띤 이온(Na⁺)은 투과하지 못하고 튕겨 나갑니다.",
    legend: [
      { color: '#10b981', label: '산소/지용성 분자 (투과 가능)' },
      { color: '#ef4444', label: '이온/수용성 거대 분자 (투과 불가)' }
    ]
  },
  facilitated: {
    desc: "<strong>촉진 확산 & 기질 특이성:</strong> 포도당(Glucose)은 전용 수송 단백질(GLUT) 통로를 통해 빠르게 확산하지만, 구조가 맞지 않는 다른 당류(과당/갈락토스)는 통로를 통과하지 못합니다.",
    legend: [
      { color: '#3b82f6', label: '포도당 (전용 통로 통과 가능)' },
      { color: '#f97316', label: '타 당류 (기질 특이성 불일치, 통과 불가)' }
    ]
  },
  active: {
    desc: "<strong>능동 수송:</strong> ATP 에너지를 소모하여 저농도 영역에서 고농도 영역으로 물질을 농도 기울기에 역행하여 빠르게 펌핑합니다.",
    legend: [
      { color: '#8b5cf6', label: '수송 이온/용질 (ATP 펌프 수송)' }
    ]
  },
  osmosis: {
    desc: "<strong>삼투 현상:</strong> 세포막의 아쿠아포린(물 통로)을 통해 용질 대신 물 분자가 저농도 용액(물 많음)에서 고농도 용액(물 적음)으로 빠르게 이동합니다.",
    legend: [
      { color: '#0ea5e9', label: '물 분자 (아쿠아포린 통과)' },
      { color: '#64748b', label: '비투과성 용질 (설탕/단백질 등)' }
    ]
  }
};

class Particle {
  constructor(x, y, type, canPass = true) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.canPass = canPass;
    
    // 기본 속도 상향
    const baseSpeed = (type === 'water') ? 3.0 : 2.2;
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * baseSpeed;
    this.vy = Math.sin(angle) * baseSpeed;
    this.radius = (type === 'water') ? 3.5 : 5.5;
  }

  update(mode, speedMult) {
    this.x += this.vx * speedMult;
    this.y += this.vy * speedMult;

    // 좌우 벽 충돌
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx *= -1;
    } else if (this.x + this.radius > canvas.width) {
      this.x = canvas.width - this.radius;
      this.vx *= -1;
    }

    // 상하 벽 충돌
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy *= -1;
    } else if (this.y + this.radius > canvas.height) {
      this.y = canvas.height - this.radius;
      this.vy *= -1;
    }

    const topM = MEMBRANE_Y - MEMBRANE_THICKNESS / 2;
    const botM = MEMBRANE_Y + MEMBRANE_THICKNESS / 2;

    // 막 영역 진입 시 처리
    if (this.y + this.radius > topM && this.y - this.radius < botM) {
      if (mode === 'simple') {
        if (!this.canPass) {
          // 투과 불가 물질: 인지질 표면에서 튕김
          this.bounceFromMembrane(topM, botM);
        }
        // 투과 가능 물질은 감속 없이 자유롭게 통과
      } 
      else if (mode === 'facilitated') {
        let matchedChannel = channels.find(ch => Math.abs(this.x - ch.x) < ch.width / 2);
        if (matchedChannel && this.canPass) {
          // 기질 특이성이 맞는 포도당: 통로 진입 시 세로 이동 가속
          this.vy = (this.vy > 0 ? 1 : -1) * 3.5;
        } else {
          // 기질 특이성이 없거나 통로 외 인지질 부위 충돌 시 반사
          this.bounceFromMembrane(topM, botM);
        }
      } 
      else if (mode === 'active') {
        let pump = channels.find(ch => Math.abs(this.x - ch.x) < ch.width / 2);
        if (pump) {
          // 능동 수송: 세포 안(아래)에서 세포 밖(위)으로 강제 펌핑
          if (this.y > MEMBRANE_Y - 5) {
            this.vy = -4.5;
            this.vx = (Math.random() - 0.5) * 0.5;
          }
        } else {
          this.bounceFromMembrane(topM, botM);
        }
      } 
      else if (mode === 'osmosis') {
        if (this.type === 'water') {
          let aqp = channels.find(ch => Math.abs(this.x - ch.x) < ch.width / 2);
          if (aqp) {
            // 아쿠아포린 고속 통과
            this.vy = (this.vy > 0 ? 1 : -1) * 4.0;
          } else {
            this.bounceFromMembrane(topM, botM);
          }
        } else {
          // 비투과성 용질 반사
          this.bounceFromMembrane(topM, botM);
        }
      }
    }
  }

  bounceFromMembrane(topM, botM) {
    if (this.y < MEMBRANE_Y) {
      this.y = topM - this.radius;
      if (this.vy > 0) this.vy *= -1;
    } else {
      this.y = botM + this.radius;
      if (this.vy < 0) this.vy *= -1;
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

    switch (this.type) {
      case 'o2': ctx.fillStyle = '#10b981'; break;
      case 'ion': ctx.fillStyle = '#ef4444'; break;
      case 'glucose': ctx.fillStyle = '#3b82f6'; break;
      case 'other_sugar': ctx.fillStyle = '#f97316'; break;
      case 'active_ion': ctx.fillStyle = '#8b5cf6'; break;
      case 'water': ctx.fillStyle = '#0ea5e9'; break;
      case 'solute': ctx.fillStyle = '#64748b'; break;
      default: ctx.fillStyle = '#64748b';
    }

    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.closePath();
  }
}

function initSimulation() {
  const mode = modeSelect.value;
  particles = [];
  channels = [];

  // 설명 및 범례 업데이트
  modeDescEl.innerHTML = MODE_CONFIG[mode].desc;
  legendBox.innerHTML = MODE_CONFIG[mode].legend
    .map(item => `<div class="legend-item"><span class="dot" style="background:${item.color};"></span><span>${item.label}</span></div>`)
    .join('');

  const topAreaY = () => Math.random() * (MEMBRANE_Y - MEMBRANE_THICKNESS / 2 - 20) + 10;
  const botAreaY = () => Math.random() * (canvas.height - (MEMBRANE_Y + MEMBRANE_THICKNESS / 2) - 20) + MEMBRANE_Y + MEMBRANE_THICKNESS / 2 + 10;

  if (mode === 'simple') {
    // 산소 (밖 50, 안 10)
    for (let i = 0; i < 45; i++) particles.push(new Particle(Math.random() * canvas.width, topAreaY(), 'o2', true));
    for (let i = 0; i < 5; i++) particles.push(new Particle(Math.random() * canvas.width, botAreaY(), 'o2', true));
    
    // 이온 (밖 30, 안 5 - 통과 불가)
    for (let i = 0; i < 30; i++) particles.push(new Particle(Math.random() * canvas.width, topAreaY(), 'ion', false));
    for (let i = 0; i < 5; i++) particles.push(new Particle(Math.random() * canvas.width, botAreaY(), 'ion', false));
  } 
  else if (mode === 'facilitated') {
    // 3개의 포도당 전용 수송 통로 배치
    channels.push({ x: canvas.width * 0.25, width: 34, name: 'GLUT' });
    channels.push({ x: canvas.width * 0.50, width: 34, name: 'GLUT' });
    channels.push({ x: canvas.width * 0.75, width: 34, name: 'GLUT' });

    // 포도당 (밖 40, 안 5 - 통과 가능)
    for (let i = 0; i < 40; i++) particles.push(new Particle(Math.random() * canvas.width, topAreaY(), 'glucose', true));
    for (let i = 0; i < 5; i++) particles.push(new Particle(Math.random() * canvas.width, botAreaY(), 'glucose', true));

    // 과당/타 당류 (밖 30, 안 5 - 기질 특이성으로 통과 불가)
    for (let i = 0; i < 30; i++) particles.push(new Particle(Math.random() * canvas.width, topAreaY(), 'other_sugar', false));
    for (let i = 0; i < 5; i++) particles.push(new Particle(Math.random() * canvas.width, botAreaY(), 'other_sugar', false));
  } 
  else if (mode === 'active') {
    // ATP 펌프 단백질 배치
    channels.push({ x: canvas.width * 0.35, width: 40, name: 'ATP 펌프' });
    channels.push({ x: canvas.width * 0.65, width: 40, name: 'ATP 펌프' });

    // 세포 밖(고농도 40), 세포 안(저농도 10) -> 안에서 밖으로 강제 수송
    for (let i = 0; i < 40; i++) particles.push(new Particle(Math.random() * canvas.width, topAreaY(), 'active_ion', true));
    for (let i = 0; i < 15; i++) particles.push(new Particle(Math.random() * canvas.width, botAreaY(), 'active_ion', true));
  } 
  else if (mode === 'osmosis') {
    // 아쿠아포린 수송 통로 4개 배치 (속도감 향상)
    channels.push({ x: canvas.width * 0.2, width: 28, name: 'AQP' });
    channels.push({ x: canvas.width * 0.4, width: 28, name: 'AQP' });
    channels.push({ x: canvas.width * 0.6, width: 28, name: 'AQP' });
    channels.push({ x: canvas.width * 0.8, width: 28, name: 'AQP' });

    // 물 분자 (위쪽: 저장액 70개, 아래쪽: 고장액 15개)
    for (let i = 0; i < 70; i++) particles.push(new Particle(Math.random() * canvas.width, topAreaY(), 'water', true));
    for (let i = 0; i < 15; i++) particles.push(new Particle(Math.random() * canvas.width, botAreaY(), 'water', true));

    // 비투과성 용질 (위쪽 5개, 아래쪽 35개)
    for (let i = 0; i < 5; i++) particles.push(new Particle(Math.random() * canvas.width, topAreaY(), 'solute', false));
    for (let i = 0; i < 35; i++) particles.push(new Particle(Math.random() * canvas.width, botAreaY(), 'solute', false));
  }
}

function drawMembrane() {
  const top = MEMBRANE_Y - MEMBRANE_THICKNESS / 2;
  
  // 인지질 이중층
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(0, top, canvas.width, MEMBRANE_THICKNESS);

  // 인지질 친수성 머리 장식선
  ctx.fillStyle = '#f59e0b';
  for (let x = 6; x < canvas.width; x += 14) {
    ctx.beginPath();
    ctx.arc(x, top + 4, 3.5, 0, Math.PI * 2);
    ctx.arc(x, top + MEMBRANE_THICKNESS - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 막 경계선
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(canvas.width, top);
  ctx.moveTo(0, top + MEMBRANE_THICKNESS);
  ctx.lineTo(canvas.width, top + MEMBRANE_THICKNESS);
  ctx.stroke();

  // 수송 단백질 렌더링
  channels.forEach(ch => {
    ctx.fillStyle = (modeSelect.value === 'active') ? '#a855f7' : '#6366f1';
    ctx.beginPath();
    ctx.roundRect(ch.x - ch.width / 2, top - 6, ch.width, MEMBRANE_THICKNESS + 12, [6]);
    ctx.fill();

    // 단백질 통로 내부 구멍
    ctx.clearRect(ch.x - ch.width / 4, top - 2, ch.width / 2, MEMBRANE_THICKNESS + 4);

    // 단백질 이름 라벨
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ch.name || '통로', ch.x, MEMBRANE_Y + 3);
  });

  // 영역 라벨
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('세포 외액 (Extracellular)', 12, 22);
  ctx.fillText('세포막 (Phospholipid Bilayer)', 12, MEMBRANE_Y - 8);
  ctx.fillText('세포질 (Cytoplasm)', 12, canvas.height - 15);
}

function updateStats() {
  const counts = {};
  particles.forEach(p => {
    const loc = p.y < MEMBRANE_Y ? 'out' : 'in';
    if (!counts[p.type]) counts[p.type] = { out: 0, in: 0 };
    counts[p.type][loc]++;
  });

  const typeLabels = {
    o2: '산소 (O₂)',
    ion: '이온 (Na⁺)',
    glucose: '포도당 (Glucose)',
    other_sugar: '과당 (Fructose)',
    active_ion: '수송 이온',
    water: '물 분자 (H₂O)',
    solute: '용질 (설탕)'
  };

  statsBody.innerHTML = Object.keys(counts).map(t => `
    <tr>
      <td>${typeLabels[t] || t}</td>
      <td style="color:#2563eb; font-weight:600;">${counts[t].out}개</td>
      <td style="color:#16a34a; font-weight:600;">${counts[t].in}개</td>
    </tr>
  `).join('');
}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMembrane();

  const mode = modeSelect.value;
  particles.forEach(p => {
    p.update(mode, simSpeed);
    p.draw();
  });

  updateStats();
  requestAnimationFrame(loop);
}

// 이벤트 리스너
modeSelect.addEventListener('change', initSimulation);
resetBtn.addEventListener('click', initSimulation);
speedRange.addEventListener('input', (e) => {
  simSpeed = parseFloat(e.target.value);
  speedVal.textContent = `${simSpeed.toFixed(1)}x`;
});

// 초기 실행
initSimulation();
loop();
