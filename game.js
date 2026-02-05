// game.js - VERZE 3.1: STAVĚNÍ & SVĚTLO
async function start() {
  const app = new PIXI.Application();
  await app.init({ 
    width: window.innerWidth, 
    height: window.innerHeight,
    backgroundColor: 0x1a1a1a,
    antialias: true
  });
  document.body.appendChild(app.canvas);

  // --- ENGINE VRSTVY ---
  const world = new PIXI.Container();
  const groundLayer = new PIXI.Container();
  const shadowLayer = new PIXI.Container();
  const objectLayer = new PIXI.Container();
  const uiLayer = new PIXI.Container();
  
  world.addChild(groundLayer);
  world.addChild(shadowLayer);
  world.addChild(objectLayer);
  app.stage.addChild(world);
  app.stage.addChild(uiLayer);

  // --- STAV HRY ---
  // Tady už je přidaný "buildMode"
  const state = { wood: 60, stone: 20, food: 100, day: 1, wave: 1, time: 0, buildMode: null };

  // --- 1. TERÉN ---
  const ground = new PIXI.Graphics();
  ground.rect(0,0,4000,4000).fill(0x2d4c1e);
  const noiseFilter = new PIXI.NoiseFilter({noise: 0.2, seed: Math.random()});
  groundLayer.filters = [noiseFilter];
  groundLayer.addChild(ground);

  const river = new PIXI.Graphics();
  river.moveTo(0, 400);
  river.bezierCurveTo(500, 300, 800, 700, 1500, 500);
  river.stroke({ width: 120, color: 0x4fa4b8, alpha: 0.8 });
  groundLayer.addChild(river);

  // --- KLIKÁNÍ MYŠÍ (STAVĚNÍ) ---
  groundLayer.eventMode = 'static';
  groundLayer.on('pointerdown', (event) => {
      if (state.buildMode) {
          const pos = event.getLocalPosition(groundLayer);
          const cost = state.buildMode === 'fire' ? 10 : 30;
          
          if (state.wood >= cost) {
              state.wood -= cost;
              createBuilding(state.buildMode, pos.x, pos.y);
              state.buildMode = null; 
              document.body.style.cursor = 'default';
          } else {
              alert("Nedostatek dřeva!");
          }
      }
  });

  // --- 2. GRAFICKÉ FUNKCE ---
  
  function drawOrganicBlob(g, x, y, size, color) {
    g.beginPath();
    const segments = 10;
    const points = [];
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const radius = size + (Math.random() - 0.5) * (size * 0.4);
        points.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
    g.poly(points).fill(color);
  }

  function createTree(x, y) {
    const tree = new PIXI.Container();
    const g = new PIXI.Graphics();
    
    const shadow = new PIXI.Graphics().ellipse(0,0, 20, 8).fill({color:0x000, alpha:0.3});
    shadow.x = x; shadow.y = y + 15;
    shadowLayer.addChild(shadow);
    tree.shadow = shadow;

    g.rect(-4, -10, 8, 20).fill(0x3e2723);
    drawOrganicBlob(g, 0, -25, 18, 0x1b3c02); 
    drawOrganicBlob(g, -5, -30, 15, 0x2e5a06);
    drawOrganicBlob(g, 5, -35, 12, 0x477a06);

    tree.addChild(g);
    tree.x = x; tree.y = y;
    tree.type = 'tree'; tree.hp = 100; tree.windOffset = Math.random() * 100;
    
    objectLayer.addChild(tree);
    return tree;
  }

  function createRock(x, y) {
    const rock = new PIXI.Graphics();
    const shadow = new PIXI.Graphics().ellipse(0,0, 25, 10).fill({color:0x000, alpha:0.3});
    shadow.x = x; shadow.y = y + 10;
    shadowLayer.addChild(shadow);
    rock.shadow = shadow;

    rock.poly([-15,0, -10,-20, 5,-25, 20,-5, 10,10, -10,5]).fill(0x555555);
    rock.poly([-5,-15, 2,-18, 10,-5, 0,-5]).fill({color:0x777777, alpha:0.5});
    
    rock.x = x; rock.y = y; rock.type = 'rock'; rock.hp = 100;
    objectLayer.addChild(rock);
    return rock;
  }

  // --- NOVÁ FUNKCE: STAVĚNÍ ---
  function createBuilding(type, x, y) {
      const b = new PIXI.Container();
      b.x = x; b.y = y; b.type = type;
      
      const shadow = new PIXI.Graphics().ellipse(0,5, 25, 8).fill({color:0x000, alpha:0.4});
      shadowLayer.addChild(shadow);

      if (type === 'fire') {
          const g = new PIXI.Graphics();
          g.roundRect(-10, -5, 20, 4, 2).fill(0x3e2723);
          g.roundRect(-10, -5, 20, 4, 2).fill(0x4e342e);
          g.rotation = Math.PI / 4;
          b.addChild(g);

          b.flame = new PIXI.Graphics();
          b.addChild(b.flame);
          
          b.light = new PIXI.Graphics().circle(0,0, 150).fill({color: 0xffaa00, alpha: 0.2});
          b.light.blendMode = 'add';
          b.light.visible = false;
          uiLayer.addChildAt(b.light, 0); 
      } 
      else if (type === 'tent') {
          const g = new PIXI.Graphics();
          g.poly([-20,10, 0,-25, 20,10]).fill(0xcfa676).stroke({width:1, color:0x8d6e63});
          g.poly([-5,10, 0,-5, 5,10]).fill(0x3e2723);
          b.addChild(g);
      }

      objectLayer.addChild(b);
      entities.resources.push(b);
      return b;
  }

  // --- 3. POSTAVY ---
  class Unit {
    constructor(job) {
        this.con = new PIXI.Container();
        this.gfx = new PIXI.Graphics();
        this.con.addChild(this.gfx);
        
        this.job = job;
        this.x = app.screen.width/2; this.y = app.screen.height/2;
        this.target = null;
        this.walkAnim = 0;
        
        this.shadow = new PIXI.Graphics().ellipse(0,0,8,3).fill({color:0x000, alpha:0.4});
        shadowLayer.addChild(this.shadow);
        objectLayer.addChild(this.con);
        
        this.redraw();
    }

    redraw() {
        const g = this.gfx;
        g.clear();
        const skin = 0xffdbac;
        const clothes = this.job === 'lumber' ? 0x8d6e63 : (this.job === 'miner' ? 0x546e7a : 0xb71c1c);
        
        g.roundRect(-6, -14, 12, 14, 3).fill(clothes);
        g.circle(0, -18, 5).fill(skin);
        g.rect(-6, -8, 12, 2).fill(0x3e2723);
        
        this.handL = new PIXI.Graphics().circle(0,0,2.5).fill(skin);
        this.handR = new PIXI.Graphics().circle(0,0,2.5).fill(skin);
        this.handL.position.set(-7, -10);
        this.handR.position.set(7, -10);
        this.con.addChild(this.handL);
        this.con.addChild(this.handR);
    }

    update(dt, time) {
        this.shadow.x = this.con.x;
        this.shadow.y = this.con.y;

        if (this.target) {
            const dx = this.target.x - this.con.x;
            const dy = this.target.y - this.con.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > 5) {
                this.con.x += (dx/dist) * 2;
                this.con.y += (dy/dist) * 2;
                
                this.walkAnim += 0.2;
                this.con.y += Math.sin(this.walkAnim) * 0.5;
                this.con.rotation = Math.sin(this.walkAnim * 0.5) * 0.05;
                this.handL.y = -10 + Math.sin(this.walkAnim) * 3;
                this.handR.y = -10 - Math.sin(this.walkAnim) * 3;
            } else {
                this.con.rotation = 0;
            }
        }
    }
  }

  // --- ENTITY MANAŽER ---
  const entities = { resources: [], units: [] };
  
  for(let i=0; i<20; i++) entities.resources.push(createTree(Math.random()*app.screen.width, Math.random()*app.screen.height));
  for(let i=0; i<10; i++) entities.resources.push(createRock(Math.random()*app.screen.width, Math.random()*app.screen.height));
  
  entities.units.push(new Unit('lumber'));
  entities.units.push(new Unit('miner'));
  entities.units.push(new Unit('soldier'));
  entities.units.forEach(u => u.target = entities.resources[Math.floor(Math.random() * entities.resources.length)]);

  // --- UI ---
  const overlay = new PIXI.Graphics().rect(0,0,4000,4000).fill({color:0x000044, alpha:0});
  uiLayer.addChild(overlay);

  const infoStyle = { fill: '#fff', fontSize: 16, fontWeight: 'bold', dropShadow: true, dropShadowDistance: 2 };
  const info = new PIXI.Text({text: "Medieval Reality 3.1", style: infoStyle});
  info.x = 20; info.y = 20;
  uiLayer.addChild(info);

  // Tlačítka pro stavění
  function createBuildBtn(label, type, x) {
      const btn = new PIXI.Container();
      btn.x = x; btn.y = 60; 
      btn.eventMode='static'; btn.cursor='pointer';
      
      const bg = new PIXI.Graphics().roundRect(0,0,100,30,5).fill(0x444).stroke({width:2,color:0xfff});
      const txt = new PIXI.Text({text:label, style:{fill:'#fff', fontSize:12}});
      txt.anchor.set(0.5); txt.x = 50; txt.y = 15;
      
      btn.addChild(bg, txt);
      btn.on('pointerdown', () => {
          state.buildMode = type;
          document.body.style.cursor = 'crosshair';
      });
      uiLayer.addChild(btn);
  }
  
  createBuildBtn("Táborák (10D)", 'fire', 20);
  createBuildBtn("Stan (30D)", 'tent', 130);

  // --- MAIN LOOP ---
  let time = 0;
  
  app.ticker.add((t) => {
    time += 0.01;
    
    // Den/Noc
    const dayProgress = (Math.sin(time * 0.5) + 1) / 2;
    overlay.alpha = 0.5 - (dayProgress * 0.5); 
    
    info.text = `Dřevo: ${state.wood} | Čas: ${dayProgress > 0.5 ? 'Den ☀️' : 'Noc 🌙'}`;

    // Animace prostředí
    entities.resources.forEach(r => {
        if(r.type === 'tree') {
            r.rotation = Math.sin(time + r.windOffset) * 0.02;
            r.shadow.width = 20 + Math.cos(time) * 10;
            r.shadow.x = r.x + Math.cos(time) * 5;
        }
        // Animace ohně
        if (r.type === 'fire') {
            r.flame.clear();
            const flicker = Math.random() * 0.5 + 0.5;
            r.flame.poly([-5,0, 5,0, 0,-15 * flicker]).fill(Math.random()>0.5 ? 0xff4500 : 0xffa500);
            
            if (dayProgress < 0.3) { 
                r.light.visible = true;
                r.light.alpha = 0.1 + (Math.random() * 0.05);
                r.light.x = r.x; r.light.y = r.y;
            } else {
                r.light.visible = false;
            }
        }
    });

    entities.units.forEach(u => u.update(t.deltaTime, time));
  });
}
start();
