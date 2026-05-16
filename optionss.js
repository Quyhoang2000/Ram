const HEADSHOT_PIPELINE_CONFIG = {
foreheadOffset: { x: 0.0025, y: 0.083 },
headBiasOffset: { x: 0.0105, y: 0.070 },
centerHeadBiasFactor: 0.045,
smoothing: 0.10,
magneticStrength: 0.68,
aimAngleCorrectionRate: 0.0145,
angleSnapStabilization: 0.018,
snapZone: 4.0,
lockForceWhenStill: 1.68,
fireTriggerWhenSnapped: true,
postKillAutoSwitch: true,
recoilCompensation: true,
recoilPatternDefault: [0.52, 0.62, 0.74, 0.82, 0.97],
recoilRecoveryDelay: 190,
fovAngle: 70,
adaptiveSmoothing: true,
hardLockNearHeadZone: true,
subpixelControl: true,
snapWhenJumpingReduction: 0.61,
trackZigzagTolerance: 0.19,
velocityPredictionStrength: 0.77,
hardLockFrameThreshold: 2,
missedShotThreshold: 1,
edgeFOVCling: true,
enableGravityLock: true,
headVisibleRatioThreshold: 0.25,
decayMissedRecoil: true,
frameRateSmoothing: true,l
enableElasticLock: true,
elasticZoneRadius: 3.1,
elasticPullStrength: 0.55,
elasticDecay: 0.86,
headCenterRealignFactor: 0.1,
fovEdgeTolerance: 0.05,
dragDirectionProfile: {
straight: { pullScale: 1.15, verticalBoost: 0.11 },
curvedLeft: { xBias: -0.05, curveTension: 0.07 },
curvedRight: { xBias: 0.05, curveTension: 0.07 },
wide: { pullScale: 0.95, smoothing: 0.21 },
flick: { flickBoost: 1.75, lockSnap: true } // TÄƒng máº¡nh khi flick
},
resolutionProfiles: {
"1920x1080": { crosshairOffset: { x: 960, y: 540 }, pullScale: 1.25, sensitivity: 1.25 },
"1280x720": { crosshairOffset: { x: 640, y: 360 }, pullScale: 1.1, sensitivity: 1.3 },
"2340x1080": { crosshairOffset: { x: 1170, y: 540 }, pullScale: 1.18, sensitivity: 1.2 },
"2560x1440": { crosshairOffset: { x: 1280, y: 720 }, pullScale: 1.3, sensitivity: 1.15 },
"3917x1728": { crosshairOffset: { x: 1958.5, y: 864 }, pullScale: 1.35, sensitivity: 1.22 }
},
defaultResolution: "3917x1728",
stanceOffsetMap: {
crouch: { x: 0.002, y: 0.07 },
stand: { x: 0.0025, y: 0.083 },
prone: { x: 0.0015, y: 0.062 }
}
};

class Vec2 {
constructor(x = 0, y = 0) {
this.x = Number(x);
this.y = Number(y);
}

add(v) {
return new Vec2(this.x + v.x, this.y + v.y);
}

sub(v) {
return new Vec2(this.x - v.x, this.y - v.y);
}

mul(s) {
return new Vec2(this.x * s, this.y * s);
}

div(s) {
return new Vec2(this.x / s, this.y / s);
}

length() {
return Math.sqrt(this.x * this.x + this.y * this.y);
}

normalize() {
const len = this.length();
return len === 0 ? new Vec2(0, 0) : this.div(len);
}

clone() {
return new Vec2(this.x, this.y);
}
}

class KalmanFilter {
constructor() {
this.estimate = new Vec2(0, 0);
this.error = new Vec2(1, 1);
this.q = 0.01;
this.r = 0.1;
}

update(measurement) {
const gainX = this.error.x / (this.error.x + this.r);
const gainY = this.error.y / (this.error.y + this.r);

this.estimate.x += gainX * (measurement.x - this.estimate.x);
this.estimate.y += gainY * (measurement.y - this.estimate.y);

this.error.x *= (1 - gainX);
this.error.y *= (1 - gainY);

return this.estimate.clone();

}
}

class HeadshotEngineUltra {
constructor(player, targets, camera) {
this.player = player;
this.targets = targets;
this.camera = camera;
this.config = HEADSHOT_PIPELINE_CONFIG;

this.applyResolutionProfile(this.config.defaultResolution);

this.recoilStep = 0;
this.lockFrameCounter = 0;
this.kalman = new KalmanFilter();
this.previousPull = new Vec2(0, 0);
this.lastFireTime = Date.now();
this.lastHitTime = Date.now();
this.missedShots = 0;
this.weaponRecoil = this.config.recoilPatternDefault;

}

applyResolutionProfile(res) {
const profile = this.config.resolutionProfiles?.[res];
if (!profile) return;
this.resProfile = profile;
this.camera.crosshair = new Vec2(profile.crosshairOffset.x, profile.crosshairOffset.y);
this.pullScale = profile.pullScale;
this.sensitivity = profile.sensitivity;
}

update(mode = "drag", deltaTime = 16) {
const visibleTargets = this.targets.filter(t => this.isHeadVisible(t));
const target = this.selectTarget(visibleTargets);
if (!target) return;

const predictedPos = this.predictHeadPosition(target);
const smoothedPos = this.kalman.update(new Vec2(predictedPos.x, predictedPos.y));
let pull = this.calculateSnapVector(smoothedPos);

const dragDir = this.detectDragDirection(pull);
pull = this.applyDirectionalDragTuning(pull, dragDir);
pull = this.applySnapDeceleration(pull);
pull = this.calculateMagneticPull(pull);
pull = this.applyOvershootPrevention(pull);
pull = this.applyCurveSmoothing(pull, mode, target);
pull = this.enhanceDragPull(pull, mode);
pull = this.applyFlickCorrection(pull, mode);
pull = this.stabilizeHardLock(pull);
pull = this.applyElasticAimLock(pull, smoothedPos);
pull = this.stabilizeAngle(pull);
pull = this.smoothJerk(pull);

if (this.config.recoilCompensation) pull.y -= this.getRecoilOffset();

if (this.config.frameRateSmoothing) {
pull = pull.mul(deltaTime / 16);
}

if (this.pullScale) pull = pull.mul(this.pullScale);
if (this.sensitivity) pull = pull.mul(this.sensitivity);

this.camera.aim(pull);

if (typeof aimcamDebugger !== "undefined" && aimcamDebugger.drawAimPath) {
aimcamDebugger.drawAimPath(pull);
}

if (this.isSnappedToHead(smoothedPos)) {
this.lockFrameCounter++;
if (this.config.fireTriggerWhenSnapped && this.lockFrameCounter >= this.config.hardLockFrameThreshold) {
this.player.fire();
this.lastFireTime = Date.now();
this.missedShots = 0;
}
} else {
this.lockFrameCounter = 0;
if (Date.now() - this.lastFireTime > 100) {
this.missedShots++;
if (this.missedShots >= this.config.missedShotThreshold && this.config.postKillAutoSwitch) {
const next = this.selectTarget(this.targets.filter(t => t !== target));
if (next) this.updateTarget(next);
this.missedShots = 0;
}
}
}

}

applyDirectionalDragTuning(pull, dir) {
const profile = this.config.dragDirectionProfile[dir];
if (!profile) return pull;
let adjusted = pull.clone();
if (profile.pullScale) adjusted = adjusted.mul(profile.pullScale);
if (profile.verticalBoost) adjusted.y += profile.verticalBoost;
if (profile.xBias) adjusted.x += profile.xBias;
if (profile.curveTension)
adjusted.x += Math.sin(profile.curveTension * adjusted.y) * profile.curveTension * 10;
if (profile.flickBoost)
adjusted = adjusted.mul(profile.flickBoost);
return adjusted;
}

enhanceDragPull(pull, mode) {
if (mode === "drag") {
const dist = pull.length();
if (dist < 6.0) {
const factor = 1.12 + (1.8 - dist * 0.15);
return pull.mul(factor);
}
}
return pull;
}

applyFlickCorrection(pull, mode) {
if (mode === "flick" && pull.length() > 4.0)
return pull.mul(1.35);
return pull;
}

stabilizeHardLock(pull) {
return this.lockFrameCounter >= this.config.hardLockFrameThreshold ? pull.mul(0.2) : pull;
}

applyElasticAimLock(pull, pos) {
if (!this.config.enableElasticLock) return pull;
const offset = new Vec2(pos.x, pos.y).sub(this.camera.crosshair);
const dist = offset.length();
if (dist < this.config.elasticZoneRadius) {
const force = this.config.elasticPullStrength * (1 - dist / this.config.elasticZoneRadius);
return pull.add(offset.mul(force * this.config.elasticDecay));
}
return pull;
}

stabilizeAngle(pull) {
const angleError = Math.atan2(pull.y, pull.x);
const correction = -angleError * this.config.angleSnapStabilization;
return pull.add(new Vec2(Math.cos(correction) * 0.1, Math.sin(correction) * 0.1));
}

smoothJerk(v) {
const a = 0.3;
const smoothed = new Vec2(
(1 - a) * this.previousPull.x + a * v.x,
(1 - a) * this.previousPull.y + a * v.y
);
this.previousPull = smoothed;
return smoothed;
}

isHeadVisible(t) {
isHeadVisible(t) {
if (t.isBehindWall) return false; // ðŸš« Má»¥c tiÃªu bá»‹ tÆ°á»ng che
if (t.headVisibleRatio < this.config.headVisibleRatioThreshold) return false;

const aim = this.camera.direction;
const to = new Vec2(t.headPos.x, t.headPos.y).sub(this.camera.position);
const dot = (to.x * aim.x + to.y * aim.y) / to.length();

const cosFOV = Math.cos((this.config.fovAngle / 2) * Math.PI / 180);
const dotThreshold = this.config.edgeFOVCling
? cosFOV - this.config.fovEdgeTolerance
: cosFOV;

return dot >= dotThreshold;
}
if (t.headVisibleRatio < this.config.headVisibleRatioThreshold) return false;

const aim = this.camera.direction;
const to = new Vec2(t.headPos.x, t.headPos.y).sub(this.camera.position);
const dot = (to.x * aim.x + to.y * aim.y) / to.length();

const cosFOV = Math.cos((this.config.fovAngle / 2) * Math.PI / 180);
const dotThreshold = this.config.edgeFOVCling
? cosFOV - this.config.fovEdgeTolerance
: cosFOV;

return dot >= dotThreshold;
}

selectTarget(list) {
return list.map(t => {
const d = new Vec2(t.headPos.x, t.headPos.y).sub(this.camera.crosshair).length();
const visible = t.headVisibleRatio || 1.0;
const priority = d - visible * 100;
return { t, priority };
}).sort((a, b) => a.priority - b.priority)[0]?.t;
}

predictHeadPosition(t) {
const v = t.velocity, a = t.acceleration || { x: 0, y: 0 };
const stance = t.stance || "stand";
const offset = this.config.stanceOffsetMap[stance] || this.config.foreheadOffset;

const centerBias = {
x: offset.x + this.config.headBiasOffset.x * this.config.centerHeadBiasFactor,
y: offset.y + this.config.headBiasOffset.y * this.config.centerHeadBiasFactor,
};

const tSec = this.config.velocityPredictionStrength;
const gAdjust = t.recentlyGrounded ? 0.006 : 0;

const predicted = {
x: t.headPos.x + v.x * tSec + 0.5 * a.x * tSec * tSec + centerBias.x,
y: t.headPos.y + v.y * tSec + 0.5 * a.y * tSec * tSec + centerBias.y - gAdjust
};

if (this.config.enableGravityLock && !t.recentlyGrounded) {
predicted.y += 0.004;
}

return predicted;
}

calculateSnapVector(pos) {
return new Vec2(pos.x, pos.y).sub(this.camera.crosshair);
}

applySnapDeceleration(v) {
const d = v.length();
const zone = this.config.snapZone * 0.5;
const s = d < zone ? d / zone : 1;
return v.mul(s);
}

calculateMagneticPull(v) {
return v.mul(this.config.magneticStrength);
}

applyOvershootPrevention(v) {
return v.length() < this.config.snapZone * 0.3 ? v.mul(0.75) : v;
}

applyCurveSmoothing(v, mode, target) {
const f = this.config.smoothing;

if (mode === "flick") return v.mul(1.5);
if (mode === "hold") return v.mul(0.5);

if (target.isJumping)
v = v.mul(this.config.snapWhenJumpingReduction);

if (Math.abs(target.velocity.x) > 0.4 && Math.abs(target.velocity.y) > 0.4)
v = v.mul(this.config.trackZigzagTolerance);

return v.mul(f);
}

getRecoilOffset() {
const s = Math.min(this.recoilStep, this.weaponRecoil.length - 1);
const o = this.weaponRecoil[s];

if (Date.now() - this.lastFireTime > this.config.recoilRecoveryDelay) {
this.recoilStep = 0;
} else {
this.recoilStep++;
}

if (this.config.decayMissedRecoil && this.missedShots > 0) {
return o * (1 - 0.2 * this.missedShots);
}

return o || 0;
}

isSnappedToHead(pos) {
return new Vec2(pos.x, pos.y).sub(this.camera.crosshair).length() < this.config.snapZone;
}

updateTarget(newTarget) {
this.lockFrameCounter = 0;
this.kalman = new KalmanFilter();
this.previousPull = new Vec2(0, 0);
}
}

// --- Setup ---
function generateRandomTarget() {
const isHidden = Math.random() < 0.2; // 20% bá»‹ che
return {
headPos: { x: 500 + Math.random() * 150, y: 270 + Math.random() * 60 },
velocity: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.4 },
acceleration: { x: (Math.random() - 0.5) * 0.03, y: (Math.random() - 0.5) * 0.03 },
isBehindWall: isHidden,
headVisibleRatio: isHidden ? 0.1 : 1.0,
isJumping: Math.random() > 0.85,
recentlyGrounded: !isHidden,
stance: ["stand", "crouch", "prone"][Math.floor(Math.random() * 3)],
distance: 20 + Math.random() * 40
};
}

// ðŸ‘‰ Gáº¯n vÃ o camera debugger
const aimcamDebugger = {
drawAimPath: (pull) => {
console.log("[ðŸŽ¯ PATH]", Î”x=${pull.x.toFixed(3)} | Î”y=${pull.y.toFixed(3)});
}
};

function simulateAdvancedInfiniteHeadshotDemo() {
const modeCycle = ["drag", "hold"];
let currentMode = 0;
let tick = 0;
let headshotCount = 0;
let lastSnapped = false;

const totalTargets = 15;
const targets = Array.from({ length: totalTargets }, () => generateRandomTarget());

const aimEngine = new HeadshotEngineUltra(player, targets, camera);

function tickLoop() {
tick++;

// Mode luÃ¢n phiÃªn
if (tick % 600 === 0) {
currentMode = (currentMode + 1) % modeCycle.length;
console.log([Tick ${tick}] â–¶ï¸ Cháº¿ Ä‘á»™: ${modeCycle[currentMode].toUpperCase()});
}

// Update target
for (let t of targets) {
t.headPos.x += t.velocity.x + Math.sin(tick / 90) * 0.2;
t.headPos.y += t.velocity.y + Math.cos(tick / 85) * 0.18;

t.velocity.x = Math.max(-0.3, Math.min(0.3, t.velocity.x + (Math.random() - 0.5) * 0.04));
t.velocity.y = Math.max(-0.25, Math.min(0.25, t.velocity.y + (Math.random() - 0.5) * 0.04));

// Cáº­p nháº­t láº¡i tráº¡ng thÃ¡i mÃ´ phá»ng
t.isJumping = Math.random() > 0.88;
t.stance = ["stand", "crouch", "prone"][Math.floor(Math.random() * 3)];
if (t.isBehindWall) {
t.headVisibleRatio = 0.1;
} else {
t.headVisibleRatio = 1.0;
}
}

aimEngine.update(modeCycle[currentMode], 16);

const snapped = aimEngine.lockFrameCounter >= HEADSHOT_PIPELINE_CONFIG.hardLockFrameThreshold;

// Náº¿u Ä‘Ã£ lock â†’ headshot
if (snapped && !lastSnapped) {
headshotCount++;
console.log(âœ… Tick ${tick} | Headshot #${headshotCount});

// Thay tháº¿ 1 má»¥c tiÃªu ngáº«u nhiÃªn
const idx = Math.floor(Math.random() * targets.length);
targets[idx] = generateRandomTarget();
}

lastSnapped = snapped;

// Váº½ Ä‘Æ°á»ng aim
if (typeof aimEngine.previousPull === 'object') {
aimcamDebugger.drawAimPath(aimEngine.previousPull);
}

if (tick % 120 === 0) {
console.log(ðŸ“Š Tick ${tick} | Tá»•ng Headshot: ${headshotCount});
}

setTimeout(tickLoop, 16); // láº·p liÃªn tá»¥c

}

tickLoop();
}

simulateAdvancedInfiniteHeadshotDemo();