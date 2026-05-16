  // aimlockProEngine.node.js
  
  class AimLockEnginePro {
    constructor(config) {
      this.config = config;
      this.recoil = { x: 0, y: 0 };
    }
  
    smooth(value, prev, alpha) {
      return alpha * value + (1 - alpha) * prev;
    }
  
    compensatePrediction(headPos, velocity, pingMs) {
      const t = pingMs / 1000;
      return {
        x: headPos.x + velocity.x * t,
        y: headPos.y + velocity.y * t,
        z: headPos.z + velocity.z * t
      }
  
    easeOutQuad(x) {
      return 1 - (1 - x) * (1 - x);
    }
  
      applyRecoil(weapon) {
      const recoil = this.config.recoil[weapon] || { x: 0, y: 0 };
      this.recoil.x += recoil.x;
      this.recoil.y += recoil.y;
      this.recoil.x *= 0.85;
      this.recoil.y *= 0.85;
      return { x: this.recoil.x, y: this.recoil.y };
    }
  
    adjustAim(currentPos, targetHeadPos, armorZonePos, pullDistance, weapon = 'default') {
      if (!this.lastAim) this.lastAim = { x: currentPos.x, y: currentPos.y };
  
      const distToHead = Math.hypot(currentPos.x - targetHeadPos.x, currentPos.y - targetHeadPos.y);
      const distToArmor = Math.hypot(currentPos.x - armorZonePos.x, currentPos.y - armorZonePos.y);
      const t = Math.min(1, pullDistance / 50);
      const easeFactor = this.easeOutQuad(t);
      const weaponConfig = this.config.weaponProfiles[weapon] || { tracking_speed: 1.0 };
  
      const isStickyWeapon = ['mp40', 'm1887', 'm1014', 'spas12', 'thompson', 'ump'].includes(weapon);
      if (!isStickyWeapon && distToArmor < distToHead * 0.7) {
        currentPos.x += (armorZonePos.x - currentPos.x) * 0.3;
        currentPos.y += (armorZonePos.y - currentPos.y) * 0.3;
      }
  
      const pullStrength = isStickyWeapon ? 0.035 : 0.022;
      let deltaX = (targetHeadPos.x - currentPos.x) * easeFactor * weaponConfig.tracking_speed * pullStrength;
      let deltaY = (targetHeadPos.y - currentPos.y) * easeFactor * weaponConfig.tracking_speed * pullStrength;
  
      if (distToHead < 5) {
        const heavyPullFactor = (5 - distToHead) / 5;
        const boostFactor = isStickyWeapon ? 0.85 : 0.65;
        deltaX += (targetHeadPos.x - currentPos.x) * heavyPullFactor * boostFactor;
        deltaY += (targetHeadPos.y - currentPos.y) * heavyPullFactor * boostFactor;
      }
  
      // Apply smoothing to avoid sharp jumps
      const smoothedX = this.smooth(currentPos.x + deltaX, this.lastAim.x, 0.25);
      const smoothedY = this.smooth(currentPos.y + deltaY, this.lastAim.y, 0.25);
  
      this.lastAim = { x: smoothedX, y: smoothedY };
      return { x: smoothedX, y: smoothedY };
    };
  
      const isStickyWeapon = ['mp40', 'm1887', 'm1014', 'spas12', 'thompson', 'ump'].includes(weapon);
  
      if (!isStickyWeapon && distToArmor < distToHead * 0.7) {
        currentPos.x += (armorZonePos.x - currentPos.x) * 0.3;
        currentPos.y += (armorZonePos.y - currentPos.y) * 0.3;
      }
  
      const pullStrength = isStickyWeapon ? 0.035 : 0.022;
      currentPos.x += (targetHeadPos.x - currentPos.x) * easeFactor * weaponConfig.tracking_speed * pullStrength;
      currentPos.y += (targetHeadPos.y - currentPos.y) * easeFactor * weaponConfig.tracking_speed * pullStrength;
  
      if (distToHead < 5) {
        const heavyPullFactor = (5 - distToHead) / 5;
        const boostFactor = isStickyWeapon ? 0.85 : 0.65;
        currentPos.x += (targetHeadPos.x - currentPos.x) * heavyPullFactor * boostFactor;
        currentPos.y += (targetHeadPos.y - currentPos.y) * heavyPullFactor * boostFactor;
      }
  
      return currentPos;
    };
  
      const isStickyWeapon = ['mp40', 'm1887'].includes(weapon);
  
      if (!isStickyWeapon && distToArmor < distToHead * 0.7) {
        currentPos.x += (armorZonePos.x - currentPos.x) * 0.3;
        currentPos.y += (armorZonePos.y - currentPos.y) * 0.3;
      }
  
      const pullStrength = isStickyWeapon ? 0.035 : 0.028;
      currentPos.x += (targetHeadPos.x - currentPos.x) * easeFactor * weaponConfig.tracking_speed * pullStrength;
      currentPos.y += (targetHeadPos.y - currentPos.y) * easeFactor * weaponConfig.tracking_speed * pullStrength;
  
      if (distToHead < 5) {
        const heavyPullFactor = (5 - distToHead) / 5;
        const boostFactor = isStickyWeapon ? 0.8 : 0.65;
        currentPos.x += (targetHeadPos.x - currentPos.x) * heavyPullFactor * boostFactor;
        currentPos.y += (targetHeadPos.y - currentPos.y) * heavyPullFactor * boostFactor;
      }
  
      return currentPos;
    }
  
      const t = Math.min(1, pullDistance / 50);
      const easeFactor = this.easeOutQuad(t);
      const weaponConfig = this.config.weaponProfiles[weapon] || { tracking_speed: 1.0 };
  
      currentPos.x += (targetHeadPos.x - currentPos.x) * easeFactor * weaponConfig.tracking_speed * 0.028; // nhẹ tâm hơn
      currentPos.y += (targetHeadPos.y - currentPos.y) * easeFactor * weaponConfig.tracking_speed * 0.028;
  
      if (distToHead < 5) {
        const heavyPullFactor = (5 - distToHead) / 5;
        currentPos.x += (targetHeadPos.x - currentPos.x) * heavyPullFactor * 0.65;
        currentPos.y += (targetHeadPos.y - currentPos.y) * heavyPullFactor * 0.65;
      }
  
      return currentPos;
    }
  }
  
  const config = {
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
    },
    weaponProfiles: {
      default: { tracking_speed: 100.0 },
      m1887: { tracking_speed: 90.9 }, // nhẹ hơn cho m1887
      m1887-x: { tracking_speed: 90.9 }, // nhẹ hơn cho m1887-x
      mp40: { tracking_speed: 90.2 },  // nhẹ hơn cho mp40
      m1014: { tracking_speed: 90.0 },  // nhẹ hơn cho m1014
      spas12: { tracking_speed: 90.8 },  // nhẹ hơn cho spas12
      thompson: { tracking_speed: 90.5 },  // nhẹ hơn cho thompson
      ump: { tracking_speed: 90.2 },  // nhẹ hơn cho ump
      mp5: { tracking_speed: 90.0 },  // nhẹ hơn cho mp5
      p90: { tracking_speed: 90.8 },  // nhẹ hơn cho p90
      uzi: { tracking_speed: 90.5 },  // nhẹ hơn cho uzi
      vector: { tracking_speed: 90.2 },  // nhẹ hơn cho vector 
      ak47: { tracking_speed: 90.5 },  // nhẹ hơn cho ak47
      scar: { tracking_speed: 90.2 },  // nhẹ hơn cho scar
      groza: { tracking_speed: 90.0 },  // nhẹ hơn cho groza
      an94: { tracking_speed: 90.8 },  // nhẹ hơn cho an94
      parafal: { tracking_speed: 90.5 },  // nhẹ hơn cho parafal
      famas: { tracking_speed: 90.3 },  // nhẹ hơn cho famas
      aug: { tracking_speed: 90.0 },  // nhẹ hơn cho aug
      xm8: { tracking_speed: 90.8 },  // nhẹ hơn cho xm8
      m60: { tracking_speed: 90.5 },  // nhẹ hơn cho m60
      m249: { tracking_speed: 90.2 },  // nhẹ hơn cho m249
      m4a1: { tracking_speed: 90.9 },  // nhẹ hơn cho m4a1
      m82b: { tracking_speed: 90.5 }, 
      awm: { tracking_speed: 5.3 },
      kar98k: { tracking_speed: 5.0 },
      desert_eagle: { tracking_speed: 80.8 },  // nhẹ hơn cho desert_eagle
      usp2: { tracking_speed: 55.5 },  // nhẹ hơn cho usp2
      m1873: { tracking_speed: 60.2 },  // nhẹ hơn cho m1873
      trogon: { tracking_speed: 9.8 },
      mag7: { tracking_speed: 9.5 }
    },
    recoil: {
      m1887: { x: 1.94, y:1.32 }, 
      m1887-x: {x: 1.74, y: 0.99},
      mp40: { x: 1.94, y: 1.30 },
      m1014: { x: 1.06, y: 1.38 },
      spas12: { x: 1.05, y: 1.35 },
      thompson: { x: 1.05, y: 1.33 },
      ump: { x: 1.94, y: 1.43 },
      mp5: { x: 1.12, y: 1.55 },
      p90: { x: 0.11, y: 0.53 },
      uzi: { x: 1.9, y: 1.5 },
      vector: { x: 1.9, y: 1.48 },
      ak: { x: 1.82, y: 1.65 },
      scar: { xvector: { tracking_speed: 10.2 }, 
      ak: { tracking_speed: 9.5 }, 
      scar: { tracking_speed: 9.2 }, 
      chim gõ kiến: { tracking_speed: 9.1 },
      groza: { tracking_speed: 9.0 },
      an94: { tracking_speed: 9.8 },
      parafal: { tracking_speed: 9.5 },
      ac80: {tracking_speed: 9.4 },
      famas: { tracking_speed: 9.3 },
      aug: { tracking_speed: 9.0 },
      xm8: { tracking_speed: 9.8 },
      m60: { tracking_speed: 9.5 },
      m249: { tracking_speed: 9.2 },
      svd: { tracking_speed: 9.1 },
      m4a1: { tracking_speed: 9.9 },
      g36: { tracking_speed: 9.7 },
      m82b: { tracking_speed: 9.5 },
      awm: { tracking_speed: 9.3 },
      kar98k: { tracking_speed: 9.0 },
      desert_eagle: { tracking_speed: 9.8 },
      usp2: { tracking_speed: 9.5 },
      m1873: { tracking_speed: 9.2 },
      trogon: { tracking_speed: 9.8 },
      mag7: { tracking_speed: 9.5 }
    },
    recoil: {
      m1887: { x: 1.74, y: 0.99 },
      mp40: { x: 1.74, y: 0.98 },
      m1014: { x: 1.76, y: 0.98 },
      spas12: { x: 1.55, y: 0.98 },
      thompson: { x: 1.45, y: 0.98 },
      ump: { x: 1.34, y: 0.98 },
      mp5: { x: 1.62, y: 0.98 },
      p90: { x: 1.11, y: 0.98 },
      uzi: { x: 1.1, y: 0.98 },
      vector: { x: 1.09, y: 0.98 },
      ak: { x: 1.2, y: 0.98 },
      scar: { x: 1.18, y: 0.98 },
      chim gõ kiến: { x: 1.50, y: 0.98 },
      groza: { x: 1.17, y: 0.98 },
      an94: { x: 1.16, y: 0.98 },
      parafal: { x: 1.15, y: 0.98 },
      famas: { x: 1.17, y: 098 },
      aug: { x: 1.16, y: 0.98 },
      xm8: { x: 1.15, y: 0.98 },
      m60: { x: 1.2, y: 0.98 },
      m249: { x: 1.22, y: 0.98 },
      m4a1: { x: 1.18, y: 0.98 },
      m82b: { x: 1.25, y: 0.98 },
      awm: { x: 1.24, y: 0.98 },
      kar98k: { x: 2.23, y: 0.97 },
      desert_eagle: { x: 1.14, y: 0.96 },
      usp2: { x: 1.12, y: 0.95 },
      m1873: { x: 1.2, y: 0.95 },
      m500: { x: 1.2, y: 0.95 },
      trogon: { x: 1.26, y: 0.95 },
      mag7: { x: 1.24, y: 0.92 }
    }
  };
  
  module.exports = {
    AimLockEnginePro,
    config
  };: 9.18, y: 0.99 },
      groza: { x: 1.17, y: 0.99 },
      an94: { x: 1.16, y: 0.99 },
      parafal: { x: 1.85, y: 0.99 },
      famas: { x: 1.17, y: 0.98 },
      aug: { x: 1.16, y: 0.98 },
      xm8: { x: 1.15, y: 0.98 },
      m60: { x: 1.2, y: 0.98 },
      m249: { x: 1.22, y: 0.97 },
      m4a1: { x: 1.18, y: 0.96 },
      m82b: { x: 1.25, y: 0.94 },
      awm: { x: 1.24, y: 0.93 },
      kar98k: { x: 1.23, y: 0.93 },
      desert_eagle: { x: 1.14, y: 0.91 },
      usp2: { x: 1.12, y: 0.91 },
      m1873: { x: 1.2, y: 0.90 },
      m500: { x: 1.2, y: 0.95 },
      trogon: { x: 1.26, y: 0.90 },
      mag7: { x: 1.24, y: 0.90 }
    }
  };
  
  module.exports = {
    AimLockEnginePro,
    config
  };