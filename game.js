// game.js - VERZE 1.2: EXPERIENCE & LEVELS
async function start() {
  const app = new PIXI.Application();
  await app.init({ 
    width: window.innerWidth, 
    height: window.innerHeight,
    backgroundColor: 0x2d5a27 
  });
  document.body.appendChild(app.canvas);

  const state = { wood: 50, stone: 20, food: 100, day: 1, wave: 1 };
  const entities = { villagers: [], enemies: [], resources: [] };

  // --- UI ---
  const info = new PIXI.Text({
    text: '',
    style: { fill: '#fff', fontSize: 18, fontWeight: 'bold', stroke: '#000', strokeThickness: 4 }
  });
  info.position.set(20, 20);
  app.stage.addChild(info);

  // --- Třída pro vylepšeného vesničana ---
  class Villager {
    constructor() {
      this.sprite = new PIXI.Graphics();
      this.job = 'idle';
      this.hp = 100;
      this.xp = 0;
      this.lvl = 1;
      this.hasItem = false;
      this.target = null;
      
      this.sprite.position.set(app.screen.width/2, app.screen.height/2);
      app.stage.addChild(this.sprite);
      this.draw();
    }

    draw() {
      this.sprite.clear();
      // Barva podle levelu
      let bodyColor = this.lvl > 2 ? 0xffd700 : 0xffcc80; 
      this.sprite.circle(0, 0, 8 + this.lvl).fill(bodyColor).stroke({width: 1, color: 0x000});
      
      // Indikátor levelu (malé tečky nad hlavou)
      for(let i=0; i < this.lvl; i++) {
        this.sprite.circle(-5 + (i*5), -15, 2).fill(0xffffff);
      }
    }

    gainXP(amount) {
      this.xp += amount;
      if (this.xp >= this.lvl * 50) { // Každý level stojí víc
        this.lvl++;
        this.xp = 0;
        this.draw(); // Překreslit postavičku (bude větší/jiná)
        console.log("Vesničan postoupil na level " + this.lvl);
      }
    }

    update(dt) {
      if(this.hp <= 0) return;
      
      // Efekt levelu: Rychlost se zvyšuje s levelem
      const speed = (2 + (this.lvl * 0.5)) * dt;

      if (this.hasItem) {
        // Nese domů
        const townPos = {x: app.screen.width/2, y: app.screen.height/2};
        move(this.sprite, townPos, speed);
        if (dist(this.sprite, townPos) < 10) {
          this.hasItem = false;
          const gain = 5 + (this.lvl * 2); // Level zvyšuje výnos!
          if(this.job==='lumber') state.wood += gain;
          this.gainXP(20); // XP za úspěšnou práci
        }
      } else {
        // Jde těžit... (zbytek logiky pohybu k resources)
      }
    }
  }

  // --- POMOCNÉ FUNKCE (dist, move atd.) ---
  // ... (vlož zbytek logiky z předchozí verze) ...
}
start();
