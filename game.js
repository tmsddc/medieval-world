async function start() {
  const app = new PIXI.Application();
  await app.init({ 
    width: window.innerWidth, 
    height: window.innerHeight,
    backgroundColor: 0x2d5a27 
  });
  document.body.appendChild(app.canvas);

  // --- STAV HRY ---
  const state = {
    wood: 20, stone: 10, food: 50,
    day: 1, time: 0, isNight: false,
    wave: 1
  };

  const entities = { villagers: [], enemies: [], resources: [], particles: [] };

  // --- UI ---
  const ui = new PIXI.Container();
  app.stage.addChild(ui);
  const infoText = new PIXI.Text({
    text: '',
    style: { fill: '#ffffff', fontSize: 18, fontWeight: 'bold', stroke: '#000', strokeThickness: 4 }
  });
  infoText.position.set(20, 20);
  ui.addChild(infoText);

  function createBtn(label, color, y, clickFn) {
    const b = new PIXI.Container();
    b.position.set(20, y);
    b.eventMode = 'static'; b.cursor = 'pointer';
    const g = new PIXI.Graphics().roundRect(0,0,160,35,8).fill(color).stroke({width:2, color:0xffffff});
    const t = new PIXI.Text({text: label, style: {fill:'#fff', fontSize:13, fontWeight:'bold'}});
    t.anchor.set(0.5); t.position.set(80, 17);
    b.addChild(g, t);
    b.on('pointerdown', clickFn);
    ui.addChild(b);
  }

  createBtn("Dřevorubec (+)", 0x8B4513, 80, () => assign('lumber'));
  createBtn("Horník (+)", 0x707070, 120, () => assign('miner'));
  createBtn("Sběrač (+)", 0x228B22, 160, () => assign('forager'));
  createBtn("Voják (+)", 0xDC143C, 200, () => assign('soldier'));
  createBtn("Nový dům (50D, 20K)", 0xDAA520, 250, () => build());

  // --- SVĚT ---
  const town = new PIXI.Graphics().rect(-35,-35,70,70).fill(0x5d4037).stroke({width:4, color:0x000});
  town.position.set(app.screen.width/2, app.screen.height/2);
  app.stage.addChild(town);

  const nightOverlay = new PIXI.Graphics().rect(0,0,app.screen.width, app.screen.height).fill({color:0x000033, alpha:0});
  app.stage.addChild(nightOverlay);

  function spawnRes(type) {
    const r = new PIXI.Graphics();
    r.type = type; r.hp = type === 'rock' ? 100 : 40; r.maxHp = r.hp;
    if(type==='tree') r.circle(0,0,15).fill(0x0b3d0b);
    else if(type==='rock') r.poly([-12,-12, 12,-12, 15,12, -15,12]).fill(0x808080);
    else r.circle(0,0,10).fill(0xFF4500);
    
    r.x = Math.random()*app.screen.width; r.y = Math.random()*app.screen.height;
    if(Math.abs(r.x - town.x) < 100) r.x += 200;
    app.stage.addChildAt(r, 1);
    entities.resources.push(r);
  }
  for(let i=0; i<40; i++) spawnRes(i<20?'tree':i<30?'rock':'bush');

  // --- AI SYSTÉM ---
  class Villager {
    constructor() {
      this.sprite = new PIXI.Graphics();
      this.job = 'idle'; this.hp = 100; this.hunger = 0;
      this.hasItem = false; this.target = null;
      this.sprite.position.set(town.x, town.y);
      app.stage.addChild(this.sprite);
      this.draw();
    }
    draw() {
      this.sprite.clear();
      let c = this.job === 'soldier' ? 0xDC143C : 0xffcc80;
      this.sprite.circle(0,0,8).fill(c).stroke({width:1, color:0x000});
      if(this.hp < 100) this.sprite.rect(-10,-15,20,3).fill(0xff0000).rect(-10,-15,20*(this.hp/100),3).fill(0x00ff00);
    }
    update(dt) {
      if(this.hp <= 0) return this.die();
      this.hunger += 0.03 * dt;
      if(this.hunger > 100 && state.food > 0) { state.food--; this.hunger = 0; }
      if(this.hunger > 150) { this.hp -= 0.1 * dt; this.draw(); }

      if(this.job === 'soldier') {
        let e = findNearest(this.sprite, entities.enemies);
        if(e) { move(this.sprite, e.sprite, 3*dt); if(dist(this.sprite, e.sprite)<25) e.hp -= 0.5; }
        else move(this.sprite, town, 1*dt);
      } else {
        if(this.hasItem) {
          move(this.sprite, town, 2*dt);
          if(dist(this.sprite, town) < 10) { 
            this.hasItem = false; this.sprite.tint = 0xffffff;
            if(this.job==='lumber') state.wood += 5;
            if(this.job==='miner') state.stone += 3;
            if(this.job==='forager') state.food += 6;
          }
        } else {
          let type = this.job==='lumber'?'tree':this.job==='miner'?'rock':this.job==='forager'?'bush':null;
          if(!this.target || this.target.hp <= 0) this.target = findRes(this.sprite, type);
          if(this.target) {
            move(this.sprite, this.target, 2*dt);
            if(dist(this.sprite, this.target) < 20) {
              this.target.hp -= 0.2 * dt;
              if(this.target.hp <= 0) { this.hasItem = true; this.sprite.tint = 0x795548; spawnRes(this.target.type); }
            }
          }
        }
      }
    }
    die() { this.sprite.destroy(); entities.villagers = entities.villagers.filter(v=>v!==this); }
  }

  class Enemy {
    constructor() {
      this.sprite = new PIXI.Graphics().circle(0,0,9).fill(0x000).stroke({width:2, color:0xff0000});
      this.hp = 50 + (state.wave * 10);
      let a = Math.random()*Math.PI*2;
      this.sprite.x = town.x + Math.cos(a)*600; this.sprite.y = town.y + Math.sin(a)*600;
      app.stage.addChild(this.sprite);
    }
    update(dt) {
      if(this.hp <= 0) { this.sprite.destroy(); entities.enemies = entities.enemies.filter(e=>e!==this); return; }
      let v = findNearest(this.sprite, entities.villagers);
      let t = v ? v.sprite : town;
      move(this.sprite, t, 1.5 * dt);
      if(dist(this.sprite, t) < 20 && v) { v.hp -= 0.2 * dt; v.draw(); }
    }
  }

  // --- POMOCNÉ ---
  const dist = (a,b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
  const move = (a,b,s) => {
    let dx = b.x-a.x, dy = b.y-a.y, d = dist(a,b);
    if(d>1) { a.x += dx/d*s; a.y += dy/d*s; }
  };
  const findNearest = (o, list) => {
    let n=null, m=Infinity;
    list.forEach(i => { let d=dist(o, i.sprite||i); if(d<m){m=d; n=i;} });
    return n;
  };
  const findRes = (o, t) => {
    let n=null, m=Infinity;
    entities.resources.forEach(r => { if(r.type===t && r.hp>0){let d=dist(o,r); if(d<m){m=d; n=r;}} });
    return n;
  };

  function assign(j) { let i = entities.villagers.find(v=>v.job==='idle'); if(i){i.job=j; i.draw();} }
  function build() {
    if(state.wood>=50 && state.stone>=20) {
      state.wood-=50; state.stone-=20;
      let v = new Villager(); entities.villagers.push(v);
      let h = new PIXI.Graphics().rect(-15,-15,30,30).fill(0x8b4513).stroke({width:2, color:0xfff});
      h.x = town.x + (Math.random()-0.5)*200; h.y = town.y + (Math.random()-0.5)*200;
      app.stage.addChildAt(h, 1);
    }
  }

  for(let i=0; i<5; i++) entities.villagers.push(new Villager());

  // --- SMYČKA ---
  app.ticker.add((t) => {
    state.time += 0.05 * t.deltaTime;
    if(state.time > 200) { state.time = 0; state.day++; state.wave++; }
    
    state.isNight = state.time > 120;
    nightOverlay.alpha = state.isNight ? 0.5 : 0;
    
    if(state.isNight && Math.random() < 0.01 * state.wave) entities.enemies.push(new Enemy());

    infoText.text = `DEN: ${state.day} | VLNA: ${state.wave}\nDŘEVO: ${state.wood} | KÁMEN: ${state.stone} | JÍDLO: ${state.food}\nLIDÉ: ${entities.villagers.length}`;

    entities.villagers.forEach(v => v.update(t.deltaTime));
    entities.enemies.forEach(e => e.update(t.deltaTime));
  });
}
start(); 
