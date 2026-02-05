// game.js - VERZE 3.0: ULTRA-DETAILNÍ PROCEDURÁLNÍ GRAFIKA
async function start() {
  const app = new PIXI.Application();
  await app.init({ 
    width: window.innerWidth, 
    height: window.innerHeight,
    backgroundColor: 0x1a1a1a,
    antialias: true // Vyhlazování hran
  });
  document.body.appendChild(app.canvas);

  // --- ENGINE PRO VYKRESLOVÁNÍ ---
  const world = new PIXI.Container();
  const groundLayer = new PIXI.Container();
  const objectLayer = new PIXI.Container();
  const uiLayer = new PIXI.Container();
  const shadowLayer = new PIXI.Container(); // Vrstva pro stíny
  
  // Řazení vrstev
  world.addChild(groundLayer);
  world.addChild(shadowLayer); // Stíny pod objekty
  world.addChild(objectLayer);
  app.stage.addChild(world);
  app.stage.addChild(uiLayer);

  // --- 1. REALISTICKÝ TERÉN (Noise Filter) ---
  const ground = new PIXI.Graphics();
  // Tráva není jednolitá - vykreslíme základ
  ground.rect(0,0,4000,4000).fill(0x2d4c1e);
  
  // Přidáme "Noise" (zrnitost), aby to vypadalo jako hlína/tráva
  const noiseFilter = new PIXI.NoiseFilter({noise: 0.2, seed: Math.random()});
  groundLayer.filters = [noiseFilter];
  groundLayer.addChild(ground);

  // Voda s odlesky
  const river = new PIXI.Graphics();
  river.moveTo(0, 400);
  river.bezierCurveTo(500, 300, 800, 700, 1500, 500);
  river.stroke({ width: 120, color: 0x4fa4b8, alpha: 0.8 });
  groundLayer.addChild(river);

  // --- 2. GENERÁTOR ORGANICKÝCH TVARŮ ---
  
  // Funkce pro "šišatý" kruh (koruna stromu)
  function drawOrganicBlob(g, x, y, size, color) {
    g.beginPath();
    const points = [];
    const segments = 10;
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const radius = size + (Math.random() - 0.5) * (size * 0.4); // Náhodná variace
        points.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
    g.poly(points).fill(color);
  }

  function createTree(x, y) {
    const tree = new PIXI.Container();
    const g = new PIXI.Graphics();
    
    // Stín (bude se hýbat)
    const shadow = new PIXI.Graphics().ellipse(0,0, 20, 8).fill({color:0x000, alpha:0.3});
    shadow.x = x; shadow.y = y + 15;
    shadowLayer.addChild(shadow);
    tree.shadow = shadow; // Odkaz pro update

    // Kmen (tmavý, detailní)
    g.rect(-4, -10, 8, 20).fill(0x3e2723);
    
    // Listí - 3 vrstvy pro hloubku
    drawOrganicBlob(g, 0, -25, 18, 0x1b3c02); // Tmavá spodní
    drawOrganicBlob(g, -5, -30, 15, 0x2e5a06); // Střední
    drawOrganicBlob(g, 5, -35, 12, 0x477a06); // Světlá horní (highlights)

    tree.addChild(g);
    tree.x = x; tree.y = y;
    tree.type = 'tree'; tree.hp = 100;
    
    // Náhodná animace větru
    tree.windOffset = Math.random() * 100;
    
    objectLayer.addChild(tree);
    return tree;
  }

  function createRock(x, y) {
    const rock = new PIXI.Graphics();
    // Stín
    const shadow = new PIXI.Graphics().ellipse(0,0, 25, 10).fill({color:0x000, alpha:0.3});
    shadow.x = x; shadow.y = y + 10;
    shadowLayer.addChild(shadow);
    rock.shadow = shadow;

    // Kámen (fasetovaný vzhled)
    rock.poly([-15,0, -10,-20, 5,-25, 20,-5, 10,10, -10,5]).fill(0x555555);
    // Odlesk na kameni (pro 3D efekt)
    rock.poly([-5,-15, 2,-18, 10,-5, 0,-5]).fill({color:0x777777, alpha:0.5});
    
    rock.x = x; rock.y = y; rock.type = 'rock'; rock.hp = 100;
    objectLayer.addChild(rock);
    return rock;
  }

  // --- 3. POSTAVY S DETAILY ---
  class Unit {
    constructor(job) {
        this.con = new PIXI.Container();
        this.gfx = new PIXI.Graphics();
        this.con.addChild(this.gfx);
        
        this.job = job;
        this.x = app.screen.width/2; 
        this.y = app.screen.height/2;
        this.target = null;
        this.walkAnim = 0;
        
        // Stín postavy
        this.shadow = new PIXI.Graphics().ellipse(0,0,8,3).fill({color:0x000, alpha:0.4});
        shadowLayer.addChild(this.shadow);
        objectLayer.addChild(this.con);
        
        this.redraw();
    }

    redraw() {
        const g = this.gfx;
        g.clear();
        
        // Barvy oblečení
        const skin = 0xffdbac;
        const clothes = this.job === 'lumber' ? 0x8d6e63 : (this.job === 'miner' ? 0x546e7a : 0xb71c1c);
        
        // Tělo (není to kulička, má ramena)
        g.roundRect(-6, -14, 12, 14, 3).fill(clothes); // Trups
        g.circle(0, -18, 5).fill(skin); // Hlava
        
        // Detaily (pásek, vlasy)
        g.rect(-6, -8, 12, 2).fill(0x3e2723); // Pásek
        
        // Ruce (budou se hýbat při animaci)
        this.handL = new PIXI.Graphics().circle(0,0,2.5).fill(skin);
        this.handR = new PIXI.Graphics().circle(0,0,2.5).fill(skin);
        this.handL.position.set(-7, -10);
        this.handR.position.set(7, -10);
        this.con.addChild(this.handL);
        this.con.addChild(this.handR);
    }

    update(dt, time) {
        // Synchronizace pozice stínu
        this.shadow.x = this.con.x;
        this.shadow.y = this.con.y;

        // Pohyb
        if (this.target) {
            const dx = this.target.x - this.con.x;
            const dy = this.target.y - this.con.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > 5) {
                this.con.x += (dx/dist) * 2;
                this.con.y += (dy/dist) * 2;
                
                // Realistická chůze (pohupování)
                this.walkAnim += 0.2;
                this.con.y += Math.sin(this.walkAnim) * 0.5;
                this.con.rotation = Math.sin(this.walkAnim * 0.5) * 0.05;
                
                // Kmitání rukou
                this.handL.y = -10 + Math.sin(this.walkAnim) * 3;
                this.handR.y = -10 - Math.sin(this.walkAnim) * 3;
            } else {
                this.con.rotation = 0; // Stůj klidně
            }
        }
    }
  }

  // --- ENTITY MANAŽER ---
  const entities = { resources: [], units: [] };
  
  // Generování světa
  for(let i=0; i<20; i++) entities.resources.push(createTree(Math.random()*app.screen.width, Math.random()*app.screen.height));
  for(let i=0; i<10; i++) entities.resources.push(createRock(Math.random()*app.screen.width, Math.random()*app.screen.height));
  
  // Přidání lidí
  entities.units.push(new Unit('lumber'));
  entities.units.push(new Unit('miner'));
  entities.units.push(new Unit('soldier'));

  // Přiřadit cíle (demo)
  entities.units.forEach(u => {
      u.target = entities.resources[Math.floor(Math.random() * entities.resources.length)];
  });

  // --- SVĚTLO A ATMOSFÉRA (Vignette & Day/Night) ---
  const overlay = new PIXI.Graphics().rect(0,0,4000,4000).fill({color:0x000044, alpha:0});
  uiLayer.addChild(overlay);

  // UI Text (Moderní font)
  const infoStyle = { 
      fill: '#fff', 
      fontFamily: 'Segoe UI, Arial', 
      fontSize: 16, 
      fontWeight: 'bold', 
      dropShadow: true,
      dropShadowDistance: 2
  };
  const info = new PIXI.Text({text: "Medieval Reality 3.0", style: infoStyle});
  info.x = 20; info.y = 20;
  uiLayer.addChild(info);

  // --- MAIN LOOP ---
  let time = 0;
  
  app.ticker.add((t) => {
    time += 0.01;
    
    // 1. Cyklus Den/Noc (Smooth color transition)
    // Simulujeme západ slunce barvou overlaye
    const dayProgress = (Math.sin(time * 0.5) + 1) / 2; // 0 (noc) až 1 (den)
    overlay.alpha = 0.5 - (dayProgress * 0.5); // Noc = 0.5 opacity, Den = 0 opacity
    
    // 2. Stromy ve větru (Vertex shader simulace)
    entities.resources.forEach(r => {
        if(r.type === 'tree') {
            // Vršek stromu se kýve, spodek stojí
            r.rotation = Math.sin(time + r.windOffset) * 0.02;
            // Stín se protahuje podle "slunce"
            r.shadow.width = 20 + Math.cos(time) * 10;
            r.shadow.x = r.x + Math.cos(time) * 5;
        }
    });

    // 3. Update jednotek
    entities.units.forEach(u => u.update(t.deltaTime, time));

    // Update UI
    info.text = `Čas: ${dayProgress > 0.5 ? 'Den ☀️' : 'Noc 🌙'} | FPS: ${Math.round(app.ticker.FPS)}`;
  });
}
start();
