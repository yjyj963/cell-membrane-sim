const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

const modeSelect = document.getElementById('modeSelect');
const resetBtn = document.getElementById('resetBtn');
const outsideCountEl = document.getElementById('outsideCount');
const insideCountEl = document.getElementById('insideCount');
const modeDescEl = document.getElementById('modeDesc');

const MEMBRANE_Y = canvas.height / 2;
const MEMBRANE_THICKNESS = 40;
let particles = [];
let channels = [];

const DESCRIPTIONS = {
  simple: "고농도에서 저농도로 인지질 2중층을 직접 통과합니다. (에너지 소모 X)",
  facilitated: "인지질 2중층을 직접 통과하지 못해 통로/운반체 단백질을 통해 이동합니다. (농도 기울기 순응)",
  active: "ATP 에너지를 소모하여 저농도에서 고농도로 역방향 수송합니다. (능동 펌프 작동)",
  osmosis: "반투과성 막을 통해 용질 대신 물 분자가 저농도(용질)에서 고농도(용질)로 확산합니다."
};

class Particle {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'small_nonpolar', 'polar_large', 'water'
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.radius = type === 'water' ? 3 : 5;
  }

  update(mode) {
    this.x += this.vx;
    this.y += this.vy;

    // 좌우 벽면 반사
    if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) {
      this.vx *= -1;
    }
    // 상하 벽면 반사
    if (this.y - this.radius < 0 || this.y + this.radius > canvas.height) {
      this.vy *= -1;
    }

    // 막 충돌 처리
    const topMembrane = MEMBRANE_Y - MEMBRANE_THICKNESS / 2;
    const bottomMembrane = MEMBRANE_Y + MEMBRANE_THICKNESS / 2;

    if (this.y + this.radius > topMembrane && this.y - this.radius < bottomMembrane) {
      if (mode === 'simple') {
        // 단순 확산: 지용성/작은 기체 분자는 막을 통과 가능 (속도 저하 효과)
        this.y += this.vy * 0.5;
      } else if (mode === 'facilitated' || mode === 'active') {
        let insideChannel = channels.some(ch => Math.abs(this.x - ch.x) < ch.width / 2);
        if (insideChannel) {
          if (mode === 'active') {
            // 능동 수송: 펌프를 통해 세포 내부(아래)에서 세포 외부(위)로 밀어냄
            if (this.y > MEMBRANE_Y) this.vy = -3;
          }
          // 통로 내부 통과 허용
        } else {
          // 인지질 층 충돌 시 반사
          if (this.y < MEMBRANE_Y) this.y = topMembrane - this.radius;
          else this.y = bottomMembrane + this.radius;
          this.vy *= -1;
        }
      } else if (mode === 'osmosis') {
        // 아쿠아포린 또는 반투과막을 통한 물 이동
        let insideAqp = channels.some(ch => Math.abs(this.x - ch.x) < ch.width / 2);
        if (!insideAqp) {
          if (this.y < MEMBRANE_Y) this.y = topMembrane - this.radius;
          else this.y = bottomMembrane + this.radius;
          this.vy *= -1;
        }
      }
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    if (this.type === 'water') ctx.fillStyle = '#38bdf8';
    else if (this.type === 'polar_large') ctx.fillStyle = '#ef4444';
    else ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.closePath();
  }
}

function initSimulation() {
  const mode = modeSelect.value;
  particles = [];
  channels = [];
  modeDescEl.textContent = DESCRIPTIONS[mode];

  // 수송 단백질/채널 배치
  if (mode === 'facilitated' || mode === 'active' || mode === 'osmosis') {
    channels.push({ x: canvas.width * 0.3, width: 25 });
    channels.push({ x: canvas.width * 0.7, width: 25 });
  }

  // 입자 생성 (세포 밖/세포 안 초기 농도 설정)
  let outsideN = mode === 'active' ? 10 : 60;
  let insideN = mode === 'active' ? 60 : 10;
  let particleType = mode === 'simple' ? 'small_nonpolar' : (mode === 'osmosis' ? 'water' : 'polar_large');

  for (let i = 0; i < outsideN; i++) {
    particles.push(new Particle(
      Math.random() * canvas.width,
      Math.random() * (MEMBRANE_Y - MEMBRANE_THICKNESS) + 10,
      particleType
    ));
  }
  for (let i = 0; i < insideN; i++) {
    particles.push(new Particle(
      Math.random() * canvas.width,
      Math.random() * (canvas.height - (MEMBRANE_Y + MEMBRANE_THICKNESS)) + MEMBRANE_Y + MEMBRANE_THICKNESS / 2,
      particleType
    ));
  }
}

function drawMembrane() {
  const top = MEMBRANE_Y - MEMBRANE_THICKNESS / 2;
  
  // 인지질 이중층 배경
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(0, top, canvas.width, MEMBRANE_THICKNESS);

  // 막 구획 라인
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(canvas.width, top);
  ctx.moveTo(0, top + MEMBRANE_THICKNESS);
  ctx.lineTo(canvas.width, top + MEMBRANE_THICKNESS);
  ctx.stroke();

  // 막 단백질 / 통로 렌더링
  channels.forEach(ch => {
    ctx.fillStyle = '#818cf8';
    ctx.fillRect(ch.x - ch.width / 2, top - 4, ch.width, MEMBRANE_THICKNESS + 8);
    
    // 통로 내부 공간 표시
    ctx.clearRect(ch.x - ch.width / 4, top, ch.width / 2, MEMBRANE_THICKNESS);
  });

  // 라벨 표시
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText('세포 외액 (Outside)', 10, 20);
  ctx.fillText('세포막 (Lipid Bilayer)', 10, MEMBRANE_Y - 5);
  ctx.fillText('세포질 (Inside)', 10, canvas.height - 15);
}

function updateCounts() {
  let outCount = 0;
  let inCount = 0;
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

// 시작
initSimulation();
loop();
