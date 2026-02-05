// game.js - VERZE 2.0: GRAFIKA & OSVĚTLENÍ
async function start() {
  const app = new PIXI.Application();
  await app.init({ 
    width: window.innerWidth, 
    height: window.innerHeight,
    backgroundColor: 0x2d5a27 // Základní tráva
  });
  document.body.appendChild(app.canvas);

  // --- VRSTVY (LAYERS) ---
  const world = new PIXI.Container(); // Všechno ve hře
  const ui = new PIXI.Container();    // Texty a tlačítka
  app.stage.addChild(world);
  app.stage.addChild(ui);

  // Pozadí - Textura trávy a řeka
  const ground = new PIXI.Graphics();
  ground.rect(0,0,4000,4000).fill(0x2d5a27); // Tráva
  // Řeka
  ground.moveTo(0, 300).bezierCurveTo(500, 200, 700, 600, 1500, 400).stroke({ width: 80, color: 0x4fa4b8 });
  world.addChild(ground);

  const state = { wood: 50, stone: 20, food: 100, day: 1, wave: 1, time: 0 };
  const entities = { villagers: [], enemies: [], resources: [], lights: [] };

  // --- GRAFICKÉ FUNKCE (ART) ---
  
  function drawShadow(target, scale = 1) {
    const s = new PIXI.Graphics().ellipse(0,0, 10 * scale, 4 * scale).fill({color: 0x000000, alpha: 0.3});
    s.y = 10; 
    target.addChildAt(s, 0); // Stín je vždy vespod
  }

  function drawTree(g) {
    g.clear();
    // Kmen
    g.rect(-3, 0, 6, 15).fill(0x5d4037);
    // Koruna (3 kruhy pro "huňatý" efekt)
    g.circle(0, -10, 12).fill(0x1e6f26);
    g.circle(-8, -5, 10).fill(0x165a1d);
    g.circle(8, -5, 10).fill(0x228b22);
    // Stín
    drawShadow(g, 1.5);
  }

  function drawRock(g) {
    g.clear();
    g.poly([-10,0, -5,-15, 5,-12, 12,0, 5,5, -8,5]).fill(0x7a7a7a).stroke({width:1, color:0x555});
    drawShadow(g);
  }

  function drawBush(g) {
    g.clear();
    g.circle(0,0,10).fill(0x228B22);
    // Bobule
    g.circle(-3,-3,2).fill(0xff0000);
    g.circle(4,0,2).fill(0xff0000);
    g.circle(0,5,2).fill(0xff0000);
    drawShadow(g, 0.8);
  }

  function drawCastle(g) {
    g.clear();
    // Základna
    g.rect(-40,-40,80,60).fill(0x7a7a7a).stroke({width:2, color:0x000});
    // Věž
    g.rect(-20,-70,40,40).fill(0x8a8a8a).stroke({width:2, color:0x000});
    // Brána
    g.rect(-15,-10,30,30).fill(0x3e2723);
    // Střecha (červená)
    g.poly([-25,-70, 0,-100, 25,-70]).fill(0x8b0000);
    // Okno (svítící)
    g.rect(-5,-50,10,15).fill(0xffff00); 
    drawShadow(g, 4);
  }

  function drawVillager(vSprite, job, lvl) {
    vSprite.removeChildren(); // Vyčistit starou grafiku
    
    const g = new PIXI.Graphics();
    // Stín
    drawShadow(vSprite, 0.8);
    // Tělo
    let color = job === 'soldier' ? 0xcc0000 : (lvl > 1 ? 0xffd700 : 0xffcc80);
    g.circle(0, -10, 8).fill(color).stroke({width:1, color:0x000}); 
    // Oči
    g.rect(-3, -12, 2, 2).fill(0x000);
    g.rect(3, -12, 2, 2).fill(0x000);
    
    // Nástroj do ruky
    const tool = new PIXI.Graphics();
    if (job === 'lumber') tool.rect(6, -8, 2, 10).fill(0x654321).circle(7,-8,4).fill(0xaaa); // Sekera
    if (job === 'soldier') tool.rect(6, -15, 2, 20).fill(0xaaa).rect(4,-5,6,2).fill(0x654321); // Meč
    if (job === 'miner') tool.rect(6, -8, 2, 8).fill(0x654321).rect(4,-8,6,3).fill(0x333); // Krumpáč
    
    vSprite.addChild(g);
    vSprite.addChild(tool);
    
    // Hvězdičky levelu
    for(let i=0; i<lvl; i++) {
        const star = new PIXI.Graphics().poly([0,-2, 1,0, 0,2, -1,0]).fill(0xffffff);
        star.y = -25 - (i*4);
        vSprite.addChild(star);
    }
  }

  // --- SVĚT ---
  const town = new PIXI.Container();
  town.x = app.screen.width/2; town.y = app.screen.height/2;
  world.addChild(town);
  
  const castleGfx = new PIXI.Graphics();
  drawCastle(castleGfx);
  town.addChild(castleGfx);

  // Generování zdrojů
  function spawnRes(type) {
    const r = new PIXI.Container();
    const g = new PIXI.Graphics();
    r.addChild(g);
    
    r.type = type; r.hp = 50; r.maxHp = 50;
    
    if(type==='tree') drawTree(g);
    else if(type==='rock') drawRock(g);
    else drawBush(g);
    
    // Náhodná pozice (ale ne v řece nebo hradě)
    r.x = Math.random() * app.screen.width;
    r.y = Math.random() * app.screen.height;
    
    world.addChild(r);
    entities.resources.push(r);
  }
  for(let i=0; i<15; i++) spawnRes('tree');
  for(let i=0; i<10; i++) spawnRes('rock');
  for(let i=0; i<15; i++) spawnRes('bush');

  // --- LIGHTING (NOČNÍ EFEKT) ---
  const darkness = new PIXI.Graphics().rect(0,0,4000,4000).fill({color:0x000022, alpha:0.6});
  darkness.visible = false;
  ui.addChild(darkness); // Tma je nad světem, ale pod UI textem

  // --- LOGIKA ---
  class Villager {
    constructor() {
      this.container = new PIXI.Container();
      this.container.x = town.x; this.container.y = town.y;
      this.job = 'idle'; this.lvl = 1; this.xp = 0; this.hp = 100;
      this.walkOffset = Math.random() * 100;
      
      this.draw();
      world.addChild(this.container);
    }
    
    draw() { drawVillager(this.container, this.job, this.lvl); }
    
    update(dt) {
        if (this.hp <= 0) { this.container.destroy(); return; } // Smrt

        // Animace chůze (pohupování)
        if (this.target || this.hasItem) {
            this.container.y += Math.sin(Date.now() * 0.01 + this.walkOffset) * 0.5;
            this.container.rotation = Math.sin(Date.now() * 0.01) * 0.1;
        } else {
            this.container.rotation = 0;
        }

        // --- ZJEDNODUŠENÁ AI (abychom se vešli do limitu) ---
        const speed = (1.5 + (this.lvl * 0.2)) * dt;
        let dest = town; 

        if (!this.hasItem) {
            if (!this.target || this.target.hp <= 0) {
                 // Najdi zdroj
                 let tType = this.job==='lumber'?'tree':this.job==='miner'?'rock':this.job==='forager'?'bush':null;
                 this.target = entities.resources.find(r => r.type === tType && r.hp > 0 && Math.random() > 0.5);
            }
            if (this.target) dest = this.target;
        }

        // Pohyb
        const dx = dest.x - this.container.x;
        const dy = dest.y - this.container.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > 10) {
            this.container.x += (dx/dist) * speed;
            this.container.y += (dy/dist) * speed;
        } else {
            // Interakce
            if (!this.hasItem && this.target) {
                this.target.hp -= 0.5;
                // Efekt těžby (otřes stromu)
                this.target.rotation = (Math.random()-0.5) * 0.2;
                if (this.target.hp <= 0) {
                    this.hasItem = true; 
                    this.target.visible = false; 
                    spawnRes(this.target.type); // Respawn
                }
            } else if (this.hasItem) {
                this.hasItem = false;
                if(this.job==='lumber') state.wood += 10 * this.lvl;
                this.xp += 10;
                if(this.xp > this.lvl*50) { this.lvl++; this.xp=0; this.draw(); }
            }
        }
    }
  }

  // --- UI TLAČÍTKA ---
  function createBtn(label, y, cb) {
      const b = new PIXI.Container(); b.x = 20; b.y = y; b.eventMode='static'; b.cursor='pointer';
      b.addChild(new PIXI.Graphics().roundRect(0,0,140,30,5).fill(0x333).stroke({width:2,color:0xfff}));
      const t = new PIXI.Text({text:label, style:{fill:'#fff', fontSize:14}}); t.x=10; t.y=5; b.addChild(t);
      b.on('pointerdown', cb);
      ui.addChild(b);
  }
  createBtn("Dřevorubec", 60, () => { let v=new Villager(); v.job='lumber'; v.draw(); entities.villagers.push(v); });
  createBtn("Horník", 100, () => { let v=new Villager(); v.job='miner'; v.draw(); entities.villagers.push(v); });
  
  // Startovní lidi
  for(let i=0; i<3; i++) entities.villagers.push(new Villager());

  // Text Info
  const info = new PIXI.Text({text:"", style:{fill:"#fff", stroke:"#000", strokeThickness:3}});
  info.x=20; info.y=20; ui.addChild(info);

  // --- LOOP ---
  app.ticker.add((t) => {
      const dt = t.deltaTime;
      state.time += 0.05 * dt;
      if (state.time > 200) { state.time = 0; state.day++; }
      
      // Den/Noc cyklus
      let isNight = state.time > 130;
      darkness.visible = isNight;
      
      info.text = `Den: ${state.day} | Dřevo: ${state.wood}`;
      
      entities.villagers.forEach(v => v.update(dt));
  });
}
start();
