class AimLockEngine {
  constructor(config) {
    this.config = config;
    this.recoilAccumulated = { x: 0, y: 0 };
    this.smoothedAim = { x: 0, y: 0 };
  }

  smooth(value, prev, alpha = 0.3) {
    return alpha * value + (1 - alpha) * prev;
  }

  applyRecoil(weapon) {
    const recoil = this.config.recoil[weapon];
    if (!recoil) return { x: 0, y: 0 };
    this.recoilAccumulated.x += recoil.x;
    this.recoilAccumulated.y += recoil.y;
    this.recoilAccumulated.x *= 0.85;
    this.recoilAccumulated.y *= 0.85;
    return { x: -this.recoilAccumulated.x, y: -this.recoilAccumulated.y };
  }

  getSpread(weapon) {
    return { x: 0, y: 0 };
  }

  dynamicSensitivity(baseSpeed, offsetMagnitude, isFiring) {
    const minSpeed = baseSpeed * 0.5;
    const maxSpeed = baseSpeed * 1.5;
    const scale = Math.min(offsetMagnitude * 2, 1);
    if (isFiring) {
      return minSpeed + (maxSpeed - minSpeed) * scale;
    }
    return baseSpeed;
  }

  updateAimAndFire(player, enemy, weapon, state) {
    const recoilOffset = this.applyRecoil(weapon);
    const spreadOffset = this.getSpread(weapon);
    const rawOffsetX = recoilOffset.x + spreadOffset.x;
    const rawOffsetY = recoilOffset.y + spreadOffset.y;

    const offsetMag = Math.sqrt(rawOffsetX * rawOffsetX + rawOffsetY * rawOffsetY);
    const baseSpeed = this.config.weapon_profiles[weapon]?.tracking_speed || 1.0;
    const currentSensitivity = this.dynamicSensitivity(baseSpeed, offsetMag, state.firing || false);
    const alpha = Math.min(0.1 + currentSensitivity * 0.1, 0.7);

    this.smoothedAim.x = this.smooth(rawOffsetX, this.smoothedAim.x, alpha);
    this.smoothedAim.y = this.smooth(rawOffsetY, this.smoothedAim.y, alpha);

    const finalOffsetX = this.smoothedAim.x;
    const finalOffsetY = this.smoothedAim.y;

    console.log(`Aim offset: X=${finalOffsetX.toFixed(3)}, Y=${finalOffsetY.toFixed(3)}, Sensitivity=${currentSensitivity.toFixed(2)}`);
  }
}
class Vector3 {
  constructor(x=0,y=0,z=0){
    this.x=x;this.y=y;this.z=z;
  }
  add(v){return new Vector3(this.x+v.x,this.y+v.y,this.z+v.z);}
  subtract(v){return new Vector3(this.x-v.x,this.y-v.y,this.z-v.z);}
  multiplyScalar(s){return new Vector3(this.x*s,this.y*s,this.z*s);}
  length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z);}
  normalize(){const len=this.length();return len>0?this.multiplyScalar(1/len):new Vector3();}
  clone(){return new Vector3(this.x,this.y,this.z);}
  static zero(){return new Vector3(0,0,0);}
}

function worldToCameraSpace(worldVec, cameraForward, cameraRight, cameraUp){
  return new Vector3(
    worldVec.x*cameraRight.x + worldVec.y*cameraRight.y + worldVec.z*cameraRight.z,
    worldVec.x*cameraUp.x + worldVec.y*cameraUp.y + worldVec.z*cameraUp.z,
    worldVec.x*cameraForward.x + worldVec.y*cameraForward.y + worldVec.z*cameraForward.z,
  );
}

function cameraToWorldSpace(localVec, cameraForward, cameraRight, cameraUp){
  return new Vector3(
    cameraRight.x*localVec.x + cameraUp.x*localVec.y + cameraForward.x*localVec.z,
    cameraRight.y*localVec.x + cameraUp.y*localVec.y + cameraForward.y*localVec.z,
    cameraRight.z*localVec.x + cameraUp.z*localVec.y + cameraForward.z*localVec.z,
  );
}

class AimLockHeadLock {
  constructor(config = {}) {
    this.config = {
      leadTime: 0.12,
      smoothFactor: 0.85,
      maxLeadDistance: 2.0,
      recoilSmoothFactor: 0.7,
      ...config,
    };
    this.prevEnemyPos = null;
    this.enemyVelocity = Vector3.zero();
    this.smoothAimPos = Vector3.zero();
    this.recoilOffset = Vector3.zero();
    this.smoothedRecoilOffset = Vector3.zero();
    this.lastUpdateTime = null;
  }

  updateEnemyVelocity(currentPos, currentTime) {
    if (this.prevEnemyPos == null) {
      this.prevEnemyPos = currentPos.clone();
      this.lastUpdateTime = currentTime;
      return;
    }
    const dt = (currentTime - this.lastUpdateTime) / 1000;
    if (dt <= 0) return;
    const newVelocity = currentPos.subtract(this.prevEnemyPos).multiplyScalar(1 / dt);
    this.enemyVelocity = new Vector3(
      this.enemyVelocity.x * this.config.smoothFactor + newVelocity.x * (1 - this.config.smoothFactor),
      this.enemyVelocity.y * this.config.smoothFactor + newVelocity.y * (1 - this.config.smoothFactor),
      this.enemyVelocity.z * this.config.smoothFactor + newVelocity.z * (1 - this.config.smoothFactor),
    );
    this.prevEnemyPos = currentPos.clone();
    this.lastUpdateTime = currentTime;
  }

  predictHeadPosition(headPos, leadTime) {
    let predicted = headPos.add(this.enemyVelocity.multiplyScalar(leadTime));
    const offsetVec = predicted.subtract(headPos);
    if (offsetVec.length() > this.config.maxLeadDistance) {
      predicted = headPos.add(offsetVec.normalize().multiplyScalar(this.config.maxLeadDistance));
    }
    return predicted;
  }

  updateRecoilOffset(newRecoilOffset) {
    this.smoothedRecoilOffset = new Vector3(
      this.smoothedRecoilOffset.x * this.config.recoilSmoothFactor + newRecoilOffset.x * (1 - this.config.recoilSmoothFactor),
      this.smoothedRecoilOffset.y * this.config.recoilSmoothFactor + newRecoilOffset.y * (1 - this.config.recoilSmoothFactor),
      this.smoothedRecoilOffset.z * this.config.recoilSmoothFactor + newRecoilOffset.z * (1 - this.config.recoilSmoothFactor),
    );
  }

  smoothAim(targetPos) {
    this.smoothAimPos = new Vector3(
      this.smoothAimPos.x * this.config.smoothFactor + targetPos.x * (1 - this.config.smoothFactor),
      this.smoothAimPos.y * this.config.smoothFactor + targetPos.y * (1 - this.config.smoothFactor),
      this.smoothAimPos.z * this.config.smoothFactor + targetPos.z * (1 - this.config.smoothFactor),
    );
    return this.smoothAimPos.clone();
  }

  getAimPosition(playerPos, enemyHeadPos, cameraForward, cameraRight, cameraUp, recoilOffset, currentTime) {
    this.updateEnemyVelocity(enemyHeadPos, currentTime);
    this.updateRecoilOffset(recoilOffset);
    const predictedHead = this.predictHeadPosition(enemyHeadPos, this.config.leadTime);
    const worldAimVec = predictedHead.subtract(playerPos);
    const cameraForwardNorm = cameraForward.normalize();
    const cameraRightNorm = cameraRight.normalize();
    const cameraUpNorm = cameraUp.normalize();
    let localAimVec = worldToCameraSpace(worldAimVec, cameraForwardNorm, cameraRightNorm, cameraUpNorm);
    const localRecoilOffset = worldToCameraSpace(this.smoothedRecoilOffset, cameraForwardNorm, cameraRightNorm, cameraUpNorm);
    localAimVec = localAimVec.subtract(localRecoilOffset);
    const smoothLocalAim = this.smoothAim(localAimVec);
    const smoothWorldAim = cameraToWorldSpace(smoothLocalAim, cameraForwardNorm, cameraRightNorm, cameraUpNorm);
    const finalAimPos = playerPos.add(smoothWorldAim);
    return finalAimPos;
  }
}

function demoAimLock() {
  const aimLock = new AimLockHeadLock({
    leadTime: 0.15,
    smoothFactor: 0.9,
    maxLeadDistance: 3,
    recoilSmoothFactor: 0.8,
  });
  let playerPos = new Vector3(0, 1.7, 0);
  let enemyHeadPos = new Vector3(10, 1.75, 10);
  let recoilOffset = new Vector3(0, 0, 0);
  let cameraForward = new Vector3(0, 0, 1);
  let cameraRight = new Vector3(1, 0, 0);
  let cameraUp = new Vector3(0, 1, 0);
  let time = Date.now();
  setInterval(() => {
    const t = (Date.now() - time) / 1000;
    enemyHeadPos = new Vector3(10 + Math.sin(t * 2) * 2, 1.75, 10 + Math.cos(t * 2) * 2);
    recoilOffset = new Vector3(Math.sin(t * 10) * 0.05, Math.cos(t * 10) * 0.03, 0);
    const aimPos = aimLock.getAimPosition(playerPos, enemyHeadPos, cameraForward, cameraRight, cameraUp, recoilOffset, Date.now());
    console.log(`Aim Position: x=${aimPos.x.toFixed(2)} y=${aimPos.y.toFixed(2)} z=${aimPos.z.toFixed(2)}`);
  }, 16);
}

demoAimLock();

function predictEnemyHead(enemy, deltaTime) {
  const futurePos = {
    x: enemy.head.x + enemy.velocity.x * deltaTime,
    y: enemy.head.y + enemy.velocity.y * deltaTime,
    z: enemy.head.z + enemy.velocity.z * deltaTime
  };
  return futurePos;
}

function applyKalmanFilter(current, previous, kalmanState) {
  const alpha = kalmanState.alpha || 0.75;
  return {
    x: alpha * current.x + (1 - alpha) * previous.x,
    y: alpha * current.y + (1 - alpha) * previous.y,
    z: alpha * current.z + (1 - alpha) * previous.z
  };
}

function applyEMASmoothing(current, last, factor = 0.65) {
  return {
    x: factor * current.x + (1 - factor) * last.x,
    y: factor * current.y + (1 - factor) * last.y,
    z: factor * current.z + (1 - factor) * last.z
  };
}

function compensateArmor(headPos, enemy) {
  const armorFactor = enemy.armorLevel ? (1 - enemy.armorLevel * 0.1) : 1;
  return {
    x: headPos.x,
    y: headPos.y + 0.015 * armorFactor, // tinh chỉnh bám đỉnh đầu qua nón
    z: headPos.z
  };
}

function computeFinalAim(localPlayer, enemy, lastTracked, kalmanState) {
  const deltaTime = getFrameDeltaTime();
  const predictedHead = predictEnemyHead(enemy, deltaTime);
  const armorAdjusted = compensateArmor(predictedHead, enemy);

  const smoothed = applyEMASmoothing(armorAdjusted, lastTracked);
  const filtered = applyKalmanFilter(smoothed, lastTracked, kalmanState);

  return filtered;
}

function aimAtVector(camera, targetVec) {
  const aimVec = {
    x: targetVec.x - camera.x,
    y: targetVec.y - camera.y,
    z: targetVec.z - camera.z
  };

  // normalize
  const length = Math.sqrt(aimVec.x ** 2 + aimVec.y ** 2 + aimVec.z ** 2);
  const norm = {
    x: aimVec.x / length,
    y: aimVec.y / length,
    z: aimVec.z / length
  };

  // convert to pitch/yaw
  const pitch = -Math.asin(norm.y);
  const yaw = Math.atan2(norm.x, norm.z);

  return { pitch, yaw };
}

function lockToHead(localPlayer, enemy, camera, state) {
  const targetVec = computeFinalAim(localPlayer, enemy, state.lastVec, state.kalman);
  const aimAngles = aimAtVector(camera, targetVec);

  if (state.autoFire && isCrosshairNearHead(camera, targetVec)) {
    triggerAutoFire();
  }

  applyAimAngles(aimAngles.pitch, aimAngles.yaw);
  state.lastVec = targetVec;
}

function isCrosshairNearHead(camera, headVec) {
  const dx = Math.abs(camera.target.x - headVec.x);
  const dy = Math.abs(camera.target.y - headVec.y);
  const dz = Math.abs(camera.target.z - headVec.z);
  const distance = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
  return distance < 0.1; // ngưỡng auto fire
}

function triggerAutoFire() {
  if (!isFiring()) {
    simulateMouseDown();
    setTimeout(() => simulateMouseUp(), 60); // auto-tap
  }
}

function updateKalmanState(state, newVec) {
  state.lastEstimate = newVec;
  return state;
}

function getFrameDeltaTime() {
  const now = performance.now();
  const dt = (now - (globalThis.lastFrame || now)) / 1000;
  globalThis.lastFrame = now;
  return dt;
}

function applyAimAngles(pitch, yaw) {
  // Hook hệ thống hoặc inject trực tiếp vào bộ xử lý chuột
  sendInputToMouse({
    deltaX: yaw * sensitivityConfig.yaw,
    deltaY: pitch * sensitivityConfig.pitch
  });
}

function smartEnemySelector(localPlayer, enemies, maxDistance = 120) {
  let closest = null;
  let bestScore = Infinity;

  enemies.forEach(enemy => {
    if (enemy.health <= 0) return;

    const dx = enemy.head.x - localPlayer.x;
    const dy = enemy.head.y - localPlayer.y;
    const dz = enemy.head.z - localPlayer.z;
    const dist = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);

    const angleDiff = Math.abs(getAngleTo(enemy.head, localPlayer.camera) - localPlayer.cameraYaw);
    const score = dist + angleDiff * 15;

    if (dist <= maxDistance && score < bestScore) {
      bestScore = score;
      closest = enemy;
    }
  });

  return closest;
}

function mainAimLoop(localPlayer, enemies, state) {
  const target = smartEnemySelector(localPlayer, enemies);

  if (target) {
    lockToHead(localPlayer, target, localPlayer.camera, state);
    state.kalman = updateKalmanState(state.kalman, state.lastVec);
  }
}

const sensitivityConfig = {
  yaw: 0.55,   // tỉ lệ điều chỉnh ngang
  pitch: 0.48  // tỉ lệ điều chỉnh dọc
};

function getAngleTo(targetVec, camera) {
  const dx = targetVec.x - camera.position.x;
  const dy = targetVec.y - camera.position.y;
  const dz = targetVec.z - camera.position.z;

  const distance = Math.sqrt(dx ** 2 + dz ** 2);
  const pitch = -Math.atan2(dy, distance); // góc dọc
  const yaw = Math.atan2(dx, dz);          // góc ngang

  return { pitch, yaw };
}

function sendInputToMouse({ deltaX, deltaY }) {
  // Cần hook hoặc thư viện native để tương tác với input chuột
  nativeMouse.moveRelative(deltaX, deltaY);
}

function simulateMouseDown() {
  nativeMouse.pressButton('left');
}

function simulateMouseUp() {
  nativeMouse.releaseButton('left');
} 
function adjustForTerrainElevation(headVec, terrainMap) {
  const groundHeight = terrainMap.getHeightAt(headVec.x, headVec.z);
  const elevationOffset = headVec.y - groundHeight;

  if (elevationOffset > 2.5) {
    headVec.y -= 0.05; // hạ đầu khi trên cao
  } else if (elevationOffset < 0.5) {
    headVec.y += 0.04; // nâng đầu nếu ở thấp
  }

  return headVec;
}
function predictByPing(vec, velocity, pingMs) {
  const t = pingMs / 1000;
  return {
    x: vec.x + velocity.x * t,
    y: vec.y + velocity.y * t,
    z: vec.z + velocity.z * t
  };
}

const { getEnemyHead, predictHeadPosition } = require('./Predict');
const { updateKalmanFilter } = require('./Kalman');
const { smoothAim, getAngleTo, sendInputToMouse, simulateMouseDown, simulateMouseUp } = require('./AimLogicUtils');
const { getClosestEnemy } = require('./Targeting');
const terrainMap = require('./TerrainMap');

let currentTarget = null;
let trackingData = {};

function AimLoop(localPlayer, enemyList, camera, config) {
  if (!localPlayer || !enemyList || enemyList.length === 0) return;

  const enemy = getClosestEnemy(enemyList, localPlayer.position, camera.direction, config.fov, currentTarget);
  if (!enemy) {
    currentTarget = null;
    return;
  }

  const rawHead = getEnemyHead(enemy);
  const adjustedHead = adjustForTerrainElevation(rawHead, terrainMap);
  const predictedHead = predictHeadPosition(adjustedHead, enemy.velocity, config.frameDelay, config.ping);

  const kalmanHead = updateKalmanFilter(enemy.id, predictedHead, trackingData);
  const aimAngle = getAngleTo(kalmanHead, camera);

  const smoothedAngle = smoothAim(aimAngle, camera.rotation, config.smoothness, config.randomize);
  const deltaYaw = smoothedAngle.yaw - camera.rotation.yaw;
  const deltaPitch = smoothedAngle.pitch - camera.rotation.pitch;

  sendInputToMouse({
    deltaX: deltaYaw * config.sensitivity.yaw,
    deltaY: deltaPitch * config.sensitivity.pitch
  });

  if (config.autoFire && Math.abs(deltaYaw) < 0.01 && Math.abs(deltaPitch) < 0.01) {
    simulateMouseDown();
    setTimeout(simulateMouseUp, config.fireDelay);
  }

  currentTarget = enemy.id;
}

module.exports = {
  AimLoop
};
const { AimLoop } = require('./AimLoop');
const { getLocalPlayer, getEnemies, getCamera } = require('./GameMemory');
const terrainMap = require('./TerrainMap');

let config = {
  fov: 25,
  smoothness: 0.65,
  randomize: true,
  autoFire: true,
  fireDelay: 15,
  frameDelay: 2,
  ping: 40,
  sensitivity: {
    yaw: 1.1,
    pitch: 1.15
  }
};

function initEngine(customConfig) {
  if (customConfig) Object.assign(config, customConfig);
  console.log('[AimLockEngine] Initialized with config:', config);
}

function updateFrame() {
  const localPlayer = getLocalPlayer();
  const enemyList = getEnemies();
  const camera = getCamera();

  AimLoop(localPlayer, enemyList, camera, config);
}

module.exports = {
  initEngine,
  updateFrame
};
targetSwitching: {
  enabled: true,
  prioritize: "headWeakArmor", // headWeakArmor | closest | lowestHP
  refreshRateMs: 45,
  predictiveLead: true,
  targetMemoryFrames: 3
}
const validTargets = enemies.filter(e => e.visible && e.headExposed);
validTargets.sort((a, b) => {
  if (config.targetSwitching.prioritize === "headWeakArmor") {
    return (a.armorLevel - b.armorLevel) || (a.distance - b.distance);
  }
  return a.distance - b.distance;
});
const selectedTarget = validTargets[0];
autoLearn: {
  enabled: true,
  learningRate: 0.015,
  curvatureMemory: 6,
  adjustForFlick: true,
  decayRate: 0.005,
  realtimeFeedback: true
}
if (config.autoLearn.enabled) {
  engine.learnTrackingCurve(enemy, weapon, feedback); // feedback = kết quả bắn gần nhất
}
class TargetSelector {
  constructor() {
    this.currentTarget = null;
    this.flickCooldownMs = 200;
    this.lastSwitchTime = 0;
  }
/**
 * Điều chỉnh tâm aim sau khi kéo:
 * - Không giật về giáp (neck/shoulder)
 * - Kéo nhẹ tới giữa đầu
 * - Kéo nặng khi gần sát đỉnh đầu
 * 
 * @param {object} currentPos - {x, y} vị trí tâm hiện tại
 * @param {object} targetHeadPos - {x, y} vị trí đỉnh đầu mục tiêu
 * @param {object} armorZonePos - {x, y} vị trí vùng giáp (neck/shoulder)
 * @param {number} pullDistance - khoảng cách kéo từ tâm cũ tới đỉnh đầu (px)
 * @returns {object} vị trí tâm mới đã điều chỉnh
 */
function adjustAimAfterPull(currentPos, targetHeadPos, armorZonePos, pullDistance) {
  const distToHead = Math.hypot(currentPos.x - targetHeadPos.x, currentPos.y - targetHeadPos.y);
  const distToArmor = Math.hypot(currentPos.x - armorZonePos.x, currentPos.y - armorZonePos.y);

  // 1. Hạn chế giật về giáp (chỉ kéo nhẹ 30%)
  if (distToArmor < distToHead * 0.7) {
    currentPos.x += (armorZonePos.x - currentPos.x) * 0.3;
    currentPos.y += (armorZonePos.y - currentPos.y) * 0.3;
  }

  // 2. Kéo nhẹ tới giữa đầu bằng easing easeOutQuad
  const t = Math.min(1, pullDistance / 50);
  const easeOutQuad = (x) => 1 - (1 - x) * (1 - x);
  const easeFactor = easeOutQuad(t);

  currentPos.x += (targetHeadPos.x - currentPos.x) * easeFactor * 0.6;
  currentPos.y += (targetHeadPos.y - currentPos.y) * easeFactor * 0.6;

  // 3. Kéo nặng hơn khi gần đỉnh đầu (dưới 5px)
  if (distToHead < 5) {
    const heavyPullFactor = (5 - distToHead) / 5;
    currentPos.x += (targetHeadPos.x - currentPos.x) * heavyPullFactor * 0.7;
    currentPos.y += (targetHeadPos.y - currentPos.y) * heavyPullFactor * 0.7;
  }

  return currentPos;
}
class PcSimAimSensitivity {
  constructor({
    baseSensitivity = 0.8,       // base nhạy thấp hơn do DPI cao
    maxSensitivity = 2.0,        // max nhạy giảm chút để mượt
    rampUpTimeMs = 180,          // ramp-up nhanh hơn
    sensitivityScale = 1.0       // scale tổng cuối áp dụng cho màn giả lập
  } = {}) {
    this.baseSensitivity = baseSensitivity;
    this.maxSensitivity = maxSensitivity;
    this.rampUpTimeMs = rampUpTimeMs;
    this.sensitivityScale = sensitivityScale;

    this.currentSensitivity = baseSensitivity;
    this.isShooting = false;
    this.shootStartTime = 0;
    this.lastMouseDelta = 0;
  }

  update(isShootingNow, mouseDelta) {
    const now = Date.now();

    if (isShootingNow) {
      if (!this.isShooting) {
        this.isShooting = true;
        this.shootStartTime = now;
      }
      const elapsed = now - this.shootStartTime;
      const rampFactor = Math.min(1, elapsed / this.rampUpTimeMs);

      // adaptive sensitivity theo tốc độ chuột (mouseDelta)
      const speedFactor = Math.min(1, mouseDelta / 15); // 15 là ngưỡng tốc độ lớn
      const adaptiveRamp = rampFactor * (0.5 + 0.5 * speedFactor);

      this.currentSensitivity = this.baseSensitivity +
        adaptiveRamp * (this.maxSensitivity - this.baseSensitivity);
    } else {
      this.isShooting = false;
      this.currentSensitivity = this.baseSensitivity;
    }
    // Áp scale màn giả lập
    return this.currentSensitivity * this.sensitivityScale;
  }
}
  autoSwitchTarget(enemies) {
    const now = Date.now();
    const candidates = enemies.filter(e => e.visible && e.health > 0);

    if (candidates.length === 0) {
      this.currentTarget = null;
      return null;
    }

    // Sắp xếp ưu tiên giáp đầu yếu, gần, góc nhỏ
    candidates.sort((a, b) => {
      if (a.headArmor !== b.headArmor) {
        return a.headArmor - b.headArmor;
      }
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return a.angle - b.angle;
    });

    if (
      this.currentTarget &&
      candidates.includes(this.currentTarget) &&
      (now - this.lastSwitchTime) < this.flickCooldownMs
    ) {
      return this.currentTarget;
    }

    this.currentTarget = candidates[0];
    this.lastSwitchTime = now;
    return this.currentTarget;
  }
}
class FlickRecovery {
  constructor(flickRecoveryMs = 150) {
    this.flickRecoveryMs = flickRecoveryMs;
    this.active = false;
    this.lastFlickTime = 0;
    this.flickCount = 0;
  }

  update() {
    const now = Date.now();

    if (!this.active) {
      // Bắt đầu flick
      this.active = true;
      this.lastFlickTime = now;
      this.flickCount = 1;
      return false; // chưa recover
    } else {
      const interval = now - this.lastFlickTime;
      this.lastFlickTime = now;

      if (interval < 100) {
        this.flickCount++;
        this.flickRecoveryMs = Math.min(300, 150 + this.flickCount * 20);
      } else {
        this.flickCount = 1;
        this.flickRecoveryMs = 150;
      }

      if (now - this.lastFlickTime > this.flickRecoveryMs) {
        this.active = false;
        return true; // flick recovered
      }
      return false; // flick chưa recover
    }
  }

  reset() {
    this.active = false;
    this.flickCount = 0;
    this.lastFlickTime = 0;
    this.flickRecoveryMs = 150;
  }
const targetSelector = new TargetSelector();
const flickRecovery = new FlickRecovery(150);

function update(enemies) {
  const target = targetSelector.autoSwitchTarget(enemies);

  if (target) {
    const recovered = flickRecovery.update();
    if (recovered) {
      // xử lý flick recovered: micro correction, etc
    } else {
      // đang flick, giữ aim ổn định
    }
  }
}
const config = {
  fake_screen: {
    resolution: "1920x864",
    dpi: 600,
    emulate_pc_crosshair: { x: 1.46, y: 1.62 },
    tweaks: 22080,
    location_pc_crosshair: { x: 80.0, y: 56.7 }
  },
  auto_fov: {
    dynamic_adjust: true,
    max: 7.5
  },
  math: {
    predictive_offset: 0.27
  },
  headlock: {
    enabled: true,
    biasFactor: 1.68,
    lockHeightRatio: 0.988,
    crosshairMagnetism: true,
    adaptiveRange: true,
    distanceCompensation: true,
    velocityAdaption: true,
    headTopSnap: true,
    fallbackToNeck: false,
    smoothTracking: "EMA+Kalman",
    zigzagPrediction: true,
    autoFireOnSnap: true
  },
  aiTopHeadLock: {
    enabled: true,
    scanPrecision: 0.98,
    stabilityCurve: "sigmoid",
    curveFactor: 0.87,
    autoCorrect: true,
    adaptiveZ: true,
    momentumInertia: 0.92,
    headBoneZone: { offsetY: -4.8, radius: 6 },
    predictJitterFix: true,
    verticalBias: -0.5,
    horizontalSwayControl: 0.4,
    smartAnchor: {
      dynamicWeight: true,
      weightDecayRate: 0.02,
      lockRefreshRateMs: 32
    },
    neuralFilter: {
      useKalman: true,
      combineEMA: true,
      blendingRate: 0.6
    },
    deepTargetingMatrix: {
      depthWeighting: true,
      frameLookBack: 4,
      learningMomentum: 0.04
    },
    prediction: {
      leadFactor: 1.12
    }
  },
  weapon_profiles: {
    default: { tracking_speed: 1.1, flick_speed:1.5}, lighter heart for all guns
    M1887: { tracking_speed: 12.82, flick_speed: 1.45)
    M1887-X;{ tracking_speef: 12.78, flick_speed: 1.43
    M590: { tracking_speed: 12.44, flick_speed: 1.42},
 snapBias: 1.12, pull_strength: 1.1 },
    MP40: { tracking_speed: 12.20, flick_speed: 1.4 },
    M1014: { tracking_speed: 12.10, flick_speed: 1.35 },
    SPAS12: { tracking_speed: 11.82, flick_speed: 1.3 },
    THOMPSON: { tracking_speed: 11.52, flick_speed: 1.35 },
    UMP: { tracking_speed: 11.42, flick_speed: 1.3 },
    MP5: { tracking_speed: 10.81, flick_speed: 1.28 },
    P90: { tracking_speed: 10.52, flick_speed: 1.27 },
    UZI: { tracking_speed: 10.42, flick_speed: 1.25 },
    VECTOR: { tracking_speed: 10.97, flick_speed: 1.23 },
    PARAFAL: { tracking_speed: 10.59, flick_speed: 1.35 },
    AK47: { tracking_speed: 9.57, flick_speed: 1.35 },
    SCAR: { tracking_speed: 9.48, flick_speed: 1.28 },
    GROZA: { tracking_speed: 9.30, flick_speed: 1.25 },
    CHIM BÓI CÁ: { tracking_speed: 8.91, flick_speed: 1.24},
    AN94: { tracking_speed: 8.82, flick_speed: 1.22 },
    CHIM GÕ KIẾN: { tracking_speed: 8.68,flick_speed:1.21},
    AC80: { tracking_speed: 8.47, flick_speed: 1.6 , recoilcontrol: true },
    M14: { tracking_speed: 7.97, flick_speed: 1.32 },
    FAMMAS: { tracking_speed: 9.0, flick_speed: 1.25 },
    AUG: { tracking_speed: 9.3, flick_speed: 1.27 },
    XM8: { tracking_speed: 8.5, flick_speed: 1.22 },
    M60: { tracking_speed: 8.2, flick_speed: 1.18 },
    M249: { tracking_speed: 8.0, flick_speed: 1.15 },
    M4A1: { tracking_speed: 9.0, flick_speed: 1.25 },
    M82B: { tracking_speed: 6.5, flick_speed: 1.1 },
    AWM: { tracking_speed: 6.8, flick_speed: 1.12 },
    KAR98K: { tracking_speed: 6.6, flick_speed: 1.1 },
    desert_eagle: { tracking_speed: 10.2, flick_speed: 1.3 },
    USP2: { tracking_speed: 10.0, flick_speed: 1.27 },
    M1873: { tracking_speed: 11.5, flick_speed: 1.4 },
    TROGON: { tracking_speed: 13.0, flick_speed: 1.5 },
    PP19: { tracking_speed: 12.8, flick_speed: 1.48},
    MAG7: { tracking_speed: 12.5, flick_speed: 1.45 }
  },
  recoil: {
    M1887: { x: 10.18, y: 10.85 },
    M1887-X: { x: 10.16, y: 10.83 },
    MP40: { x: 10.15, y: 10.78 },
    M590: { x: 10.16, y: 10.64 },
    M1014: { x: 10.17, y: 10.75 },
    SPAS12: { x: 10.16, y: 10.7 },
    THOMPSON: { x: 10.14, y: 10.6 },
    UMP: { x: 10.13, y: 10.58 },
    MP5: { x: 10.12, y: 10.55 },
    P90: { x: 10.11, y: 10.53 },
    UZI: { x: 10.1, y: 10.5 },
    VECTOR: { x: 10.09, y: 10.48 },
    AK47: { x: 10.2, y: 10.85 },
    SCAR: { x: 10.18, y: 10.82 },
    GROZA: { x: 10.17, y: 10.8 },
    CHIM BÓI CÁ: { x: 10.16 , y: 10.79 },
    AN94: { x: 10.16, y: 10.78 },
    CHIM GÕ KIẾN: { 10.16, y: 10.77 },
    AC80: { 10.15, y: 10.76 },
    M14: { 10.15, y: 10.76 },
    PARAFAL: { x: 10.15, y: 10.75 },
    FAMAS: { x: 10.17, y: 10.8 },
    AUG: { x: 10.16, y: 10.78 },
    XM8: { x: 10.15, y: 10.76 },
    M60: { x: 10.2, y: 10.85 },
    M249: { x: 10.22, y: 10.88 },
    M4A1: { x: 10.18, y: 10.8 },
    M82B: { x: 0.25, y: 0.95 },
    AWM: { x: 0.24, y: 0.92 },
    KAR98K: { x: 0.23, y: 0.9 },
    DESERT_EAGLE: { x: 10.14, y: 10.6 },
    USP2: { x: 10.12, y: 10.55 },
    M1873: { x: 10.2, y: 10.75 },
    TROGON: { x: 10.26, y: 10.95 },
    PP19: { x: 10.25, y: 10.93},
    MAG7: { x: 10.24, y: 10.92 }
  },
  antiban: {
    randomizeTiming: true,
    noiseInjection: true,
    hideSignature: true,
    humanizeInput: true,
    eventMasking: true,
    packetDelayJitter: true,
    frameDropSimulator: true,
    aimRandomBias: true,
    detectionBypass: true,
    obfuscationLayer: true,
    safeThreadExecution: true,
    systemHookBypass: true,
    memoryFootprintReducer: true,
    antiScreenSpy: true,
    codeShuffler: true,
    secureKeyRotation: true,
    inputRateLimiter: true,
    dynamicResponseTime: true,
    internalAPIEncrypt: true
  }
};
const engine = new AimLockEngine(config);

let prevMousePos = { x: 960, y: 432 };  // Bắt đầu ở giữa màn hình (fake resolution 1920x864)
let currentMousePos = { x: 960, y: 432 };

// Giả lập cập nhật vị trí chuột
function updateMousePosition(newX, newY) {
  currentMousePos.x = newX;
  currentMousePos.y = newY;
}

// Hàm lấy delta chuột (khoảng cách dịch chuyển chuột giữa các lần gọi)
function getMouseDelta() {
  const deltaX = Math.abs(currentMousePos.x - prevMousePos.x);
  const deltaY = Math.abs(currentMousePos.y - prevMousePos.y);

  prevMousePos.x = currentMousePos.x;
  prevMousePos.y = currentMousePos.y;

  return deltaX + deltaY;
}

// Khởi tạo sensitivity controller với hệ số tăng nhạy khi bắn và kéo
const sensitivityController = new SensitivityController(
  1.0,    // base sensitivity
  1.3,    // tăng 30% nhạy khi đang bắn
  1.2     // tăng 20% nhạy khi kéo chuột (delta > 1)
);
// Demo chạy loop 100ms
const engine = new AimLockEngine(config);
const player = { fps_stable: true };
const enemy = {
  position: { x: 20, y: 4, z: 0 },
  velocity: { x: 0.12, y: 0.01, z: 0 },
  visible: true,
  distance: 13,
  angle: 2.5,
  height: 1.8
};
setInterval(() => {
  // Giả lập di chuyển chuột nhẹ, ±2 pixel ngẫu nhiên
  const newX = currentMousePos.x + (Math.random() * 4 - 2);
  const newY = currentMousePos.y + (Math.random() * 4 - 2);
  updateMousePosition(newX, newY);

  const mouseDelta = getMouseDelta();

  const isFiring = true;  // Ví dụ trạng thái đang bắn
  
const engine = new AimLockEngine(config);
const player = { fps_stable: true };
let t = 0;

setInterval(() => {
  const jitterX = Math.sin(t / 10) * 0.05;
  const jitterZ = Math.cos(t / 15) * 0.07;

  const enemySim = {
    position: { x: 20 + jitterX, y: 4, z: jitterZ },
    velocity: { x: 0.12 + jitterX, y: 0.01, z: jitterZ },
    visible: true,
    distance: 13,
    angle: 2.5,
    height: 1.8
  };

  engine.updateAimAndFire(player, enemySim, 'm1887', { jumping: true });
  t++;
}, 100);

