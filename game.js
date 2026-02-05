// ==========================================
// MEDIEVAL REALITY ENGINE v4.0 (CORE)
// ==========================================

async function start() {
    // 1. INICIALIZACE PIXIJS APLIKACE (S maximální kvalitou)
    const app = new PIXI.Application();
    await app.init({ 
        width: window.innerWidth, 
        height: window.innerHeight,
        backgroundColor: 0x050505, // Hluboká tma (dokud se nevygeneruje svět)
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
    });
    document.body.appendChild(app.canvas);

    // 2. NASTAVENÍ VRSTEV (LAYERING SYSTEM)
    // Abychom mohli dělat efekty jako mlha, stíny a UI, musíme mít vrstvy.
    const camera = new PIXI.Container(); // Celý svět se hýbe tady (pro budoucí posouvání kamery)
    
    const layers = {
        ground: new PIXI.Container(),    // Tráva, voda, cesty
        shadows: new PIXI.Container(),   // Stíny vržené objekty
        objects: new PIXI.Container(),   // Stromy, kameny, budovy
        units: new PIXI.Container(),     // Pohyblivé jednotky
        effects: new PIXI.Container(),   // Částice, krev, kouř
        weather: new PIXI.Container(),   // Déšť, tma, mraky
        ui: new PIXI.Container()         // UI, tlačítka, texty (nehýbe se s kamerou)
    };

    // Přidání vrstev do světa
    camera.addChild(layers.ground);
    camera.addChild(layers.shadows);
    camera.addChild(layers.objects);
    camera.addChild(layers.units);
    camera.addChild(layers.effects);
    camera.addChild(layers.weather);
    
    app.stage.addChild(camera);
    app.stage.addChild(layers.ui); // UI je mimo kameru

    // 3. GLOBÁLNÍ STAV HRY (STATE MANAGEMENT)
    const GameState = {
        wood: 100,
        stone: 50,
        food: 200,
        gold: 0,
        population: 0,
        maxPopulation: 5,
        day: 1,
        time: 0,          // 0.0 až 1.0 (denní cyklus)
        isNight: false,
        paused: false,
        selectedUnit: null,
        buildMode: null,  // Co zrovna stavíme
        camera: { x: 0, y: 0, zoom: 1 }
    };

    // Seznamy entit pro rychlý přístup
    const Entities = {
        all: [],
        units: [],
        buildings: [],
        resources: [],
        particles: []
    };

    // 4. POMOCNÉ KONSTANTY A KONFIGURACE
    const Config = {
        tileSize: 64,
        mapWidth: 4000,
        mapHeight: 4000,
        dayLength: 1000, // Jak dlouho trvá den (ticků)
        colors: {
            grass: 0x2d4c1e,
            water: 0x4fa4b8,
            night: 0x000022
        }
    };

    // ==========================================
    // PROSTOR PRO MODULY (TADY BUDEME VKLÁDAT)
    // ==========================================

    /* Tento objekt bude držet naše grafické funkce.
       Zatím je prázdný, naplníme ho v další části.
    */
    const GraphicsEngine = {
        // --- ZAČÁTEK MODULU GRAFIKA ---

    // Pomocná funkce pro kreslení nepravidelných "blobů" (koruny stromů, keře)
    drawOrganicBlob: (g, x, y, size, color) => {
        g.beginPath();
        const segments = 12; // Více segmentů = detailnější tvar
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            // Náhodná variace poloměru dělá tvar "přírodním"
            const radius = size + (Math.random() - 0.5) * (size * 0.35);
            points.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
        }
        g.poly(points).fill(color);
        g.closePath();
    },

    // Univerzální stín (automaticky se přizpůsobuje velikosti objektu)
    createShadow: (target, width, height) => {
        const shadow = new PIXI.Graphics();
        shadow.ellipse(0, 0, width, height).fill({color: 0x000000, alpha: 0.3});
        // Stín posuneme pod objekt
        shadow.y = 10; 
        // Přidáme ho do vrstvy stínů, ne do objektu (aby se nepřekrývaly špatně)
        layers.shadows.addChild(shadow);
        target.shadowRef = shadow; // Uložíme odkaz, abychom s ním mohli hýbat
        return shadow;
    },

    // Vykreslení ultra-detailního stromu
    renderTree: (x, y) => {
        const tree = new PIXI.Container();
        tree.x = x; tree.y = y;

        // 1. Stín
        GraphicsEngine.createShadow(tree, 22, 8);

        const g = new PIXI.Graphics();
        
        // 2. Kmen (texturovaný proužky)
        g.rect(-5, -15, 10, 30).fill(0x3e2723); // Základ
        g.rect(-2, -15, 2, 25).fill(0x4e342e); // Světlejší kůra

        // 3. Listí (3 vrstvy pro 3D efekt a hloubku)
        // Spodní tmavá vrstva (stín uvnitř stromu)
        GraphicsEngine.drawOrganicBlob(g, 0, -35, 22, 0x142b08);
        // Střední vrstva
        GraphicsEngine.drawOrganicBlob(g, -8, -40, 18, 0x1e420b);
        GraphicsEngine.drawOrganicBlob(g, 8, -38, 18, 0x265c0d);
        // Horní světlá vrstva (osvětlená sluncem)
        GraphicsEngine.drawOrganicBlob(g, 0, -45, 15, 0x3d8c16);

        tree.addChild(g);
        
        // Přidáme náhodný offset pro animaci větru (aby se nehýbaly synchronizovaně)
        tree.windOffset = Math.random() * 100;
        
        return tree;
    },

    // Vykreslení kamene s fasetami (odlesky)
    renderRock: (x, y) => {
        const rock = new PIXI.Container();
        rock.x = x; rock.y = y;

        GraphicsEngine.createShadow(rock, 28, 10);

        const g = new PIXI.Graphics();
        
        // Hlavní hmota kamene
        g.poly([-20,0, -15,-25, 5,-30, 25,-10, 15,10, -10,8]).fill(0x555555);
        
        // Světlá faseta (odlesk shora)
        g.poly([-10,-20, 5,-25, 20,-10, 5,-5, -5,-10]).fill({color: 0x777777, alpha: 0.8});
        
        // Tmavá prasklina/detail
        g.poly([0,-5, 5,5, 3,8]).fill({color: 0x333333, alpha: 0.5});

        rock.addChild(g);
        return rock;
    },

    // Vykreslení detailní postavy (s vybavením podle profese)
    renderUnit: (unitData) => {
        const con = new PIXI.Container();
        const g = new PIXI.Graphics();
        con.addChild(g);

        // Stín postavy
        const shadow = GraphicsEngine.createShadow(con, 10, 4);
        
        // Barvy podle profese
        const colors = {
            skin: 0xffdbac,
            lumber: { body: 0x5d4037, tool: 0xaaaaff }, // Hnědá + Sekera
            miner: { body: 0x455a64, tool: 0x555555 },  // Šedá + Krumpáč
            soldier: { body: 0xb71c1c, tool: 0xeeeeee }, // Červená + Meč
            idle: { body: 0xe0e0e0, tool: null }        // Bílá
        };
        
        const style = colors[unitData.job] || colors.idle;

        // --- Kreslení postavy ---
        g.clear();
        
        // 1. Tělo (není kulička, má tvar)
        g.roundRect(-7, -18, 14, 16, 4).fill(style.body); // Trup
        
        // 2. Hlava
        g.circle(0, -22, 6).fill(colors.skin); 
        
        // 3. Detaily obličeje (oči)
        g.rect(-2, -23, 1, 2).fill(0x000000);
        g.rect(2, -23, 1, 2).fill(0x000000);

        // 4. Batoh (pokud nese surovinu)
        if (unitData.hasItem) {
            g.rect(-5, -10, 10, 8).fill(0x8d6e63).stroke({width:1, color:0x3e2723});
        }

        // 5. Ruce (budou se animovat zvlášť)
        con.handL = new PIXI.Graphics().circle(0,0, 2.5).fill(colors.skin);
        con.handR = new PIXI.Graphics().circle(0,0, 2.5).fill(colors.skin);
        // Pozicování rukou
        con.handL.position.set(-8, -12);
        con.handR.position.set(8, -12);
        
        // Nástroj v pravé ruce
        if (style.tool) {
            const tool = new PIXI.Graphics();
            if (unitData.job === 'lumber') {
                tool.rect(-2,-10, 4, 20).fill(0x6d4c41); // Násada
                tool.poly([-5,-8, 5,-8, 8,0, -5,0]).fill(0xcccccc); // Čepel sekery
            } else if (unitData.job === 'soldier') {
                tool.rect(-2,-15, 4, 25).fill(0xcccccc); // Čepel meče
                tool.rect(-5,-5, 10, 2).fill(0x3e2723); // Záštita
            }
            tool.rotation = -0.5; // Mírně nakloněný
            con.handR.addChild(tool);
        }

        con.addChild(con.handL);
        con.addChild(con.handR);

        // 6. Level indikátor (Hvězdičky nad hlavou)
        if (unitData.lvl > 1) {
            for(let i=0; i < unitData.lvl; i++) {
                const star = new PIXI.Graphics().poly([0,-3, 1,0, 0,3, -1,0]).fill(0xffd700);
                star.y = -32 - (i*5);
                con.addChild(star);
            }
        }

        return con;
    },

    // Vytvoření efektu ohně (Táborák)
    createFireEffect: (x, y) => {
        const fireContainer = new PIXI.Container();
        fireContainer.x = x; fireContainer.y = y;

        // Polena na zemi
        const wood = new PIXI.Graphics();
        wood.roundRect(-12, -5, 24, 6, 2).fill(0x3e2723);
        wood.roundRect(-12, -5, 24, 6, 2).fill(0x5d4037);
        wood.children[1].rotation = Math.PI / 2; // Křížem
        fireContainer.addChild(wood);

        // Plamen (Grafika, která se bude měnit v update loopu)
        const flame = new PIXI.Graphics();
        fireContainer.addChild(flame);
        fireContainer.flame = flame; // Reference pro animaci

        // Světlo (Glow)
        const light = new PIXI.Graphics().circle(0,0, 180).fill({color: 0xffaa00, alpha: 0.15});
        light.blendMode = 'add'; // Režim prolnutí pro "svícení"
        
        // Přidáme světlo do vrstvy weather (aby bylo nad terénem ale pod UI)
        layers.weather.addChild(light);
        fireContainer.light = light;

        return fireContainer;
    }

    // --- KONEC MODULU GRAFIKA ---
    };

    /*
       Tento objekt bude generovat mapu, stromy a řeky.
    */
    const MapGenerator = {
        // --- ZAČÁTEK MODULU MAPA ---

    init: () => {
        console.log("Generuji procedurální svět...");

        // 1. GENERACE TERÉNU (Tráva a hluk)
        const ground = new PIXI.Graphics();
        ground.rect(0, 0, Config.mapWidth, Config.mapHeight).fill(Config.colors.grass);
        
        // Přidáme "Noise Filter" pro realistickou hlínu/trávu
        const noiseFilter = new PIXI.NoiseFilter({
            noise: 0.15, 
            seed: Math.random()
        });
        layers.ground.filters = [noiseFilter];
        layers.ground.addChild(ground);

        // 2. GENERACE VODY (Obří řeka křížem krážem)
        const river = new PIXI.Graphics();
        river.moveTo(0, Config.mapHeight * 0.3);
        // Bezierova křivka pro hladký tok
        river.bezierCurveTo(
            Config.mapWidth * 0.3, Config.mapHeight * 0.1, 
            Config.mapWidth * 0.7, Config.mapHeight * 0.9, 
            Config.mapWidth, Config.mapHeight * 0.6
        );
        river.stroke({ width: 300, color: Config.colors.water, alpha: 0.9 });
        layers.ground.addChild(river);

        // 3. ROZMÍSTĚNÍ ZDROJŮ (Stromy a kameny)
        // Vygenerujeme 150 náhodných objektů
        for (let i = 0; i < 150; i++) {
            const x = Math.random() * Config.mapWidth;
            const y = Math.random() * Config.mapHeight;
            
            // Jednoduchá kontrola, aby se nespawnovaly věci přímo uprostřed řeky
            // (Simulujeme to kontrolou vzdálenosti od středu mapy, kde řeka teče)
            // Pro opravdovou kontrolu bychom potřebovali složitější matematiku, 
            // ale pro vizuální efekt stačí náhoda.
            
            const isTree = Math.random() > 0.3; // 70% šance na strom
            let resource;

            if (isTree) {
                resource = GraphicsEngine.renderTree(x, y);
                resource.type = 'tree';
                resource.hp = 100;
                resource.maxHp = 100;
            } else {
                resource = GraphicsEngine.renderRock(x, y);
                resource.type = 'rock';
                resource.hp = 200; // Kámen vydrží víc
                resource.maxHp = 200;
            }

            // Přidáme do světa a do seznamu entit
            layers.objects.addChild(resource);
            Entities.resources.push(resource);
        }

        // 4. STARTOVNÍ OBLAST (Centrum mapy)
        const centerX = Config.mapWidth / 2;
        const centerY = Config.mapHeight / 2;

        // Vytvoříme hlavní táborák (Main Base)
        const mainFire = GraphicsEngine.createFireEffect(centerX, centerY);
        layers.objects.addChild(mainFire);
        // Uložíme jako budovu
        Entities.buildings.push({
            type: 'fire',
            x: centerX,
            y: centerY,
            sprite: mainFire
        });

        // 5. NASTAVENÍ KAMERY
        // Posuneme "kameru" tak, abychom začínali uprostřed mapy u ohně
        camera.x = -centerX + (window.innerWidth / 2);
        camera.y = -centerY + (window.innerHeight / 2);
        
        // Uložíme pozici do GameState
        GameState.camera.x = camera.x;
        GameState.camera.y = camera.y;

        console.log("Svět vygenerován: " + Entities.resources.length + " objektů.");
    }

    // --- KONEC MODULU MAPA ---
        init: () => { console.log("Mapa zatím prázdná..."); }
    };

    /*
       Tento objekt bude řídit chování (AI) jednotek.
    */
    const AISystem = {
       // --- ZAČÁTEK MODULU AI ---

    init: () => {
        console.log("Inicializuji AI a populaci...");
        // Spawne startovní populaci kolem ohně
        for (let i = 0; i < 5; i++) {
            // Rozdělíme role: 2 Dřevorubci, 1 Horník, 2 Flákači (Idle)
            let job = 'idle';
            if (i < 2) job = 'lumber';
            else if (i === 2) job = 'miner';
            
            AISystem.spawnUnit(job, 
                Config.mapWidth/2 + (Math.random()-0.5)*100, 
                Config.mapHeight/2 + (Math.random()-0.5)*100
            );
        }
    },

    // Funkce pro vytvoření jednotky
    spawnUnit: (job, x, y) => {
        const unitData = {
            id: Math.random().toString(36).substr(2, 9),
            x: x, y: y,
            job: job,
            state: 'IDLE', // IDLE, MOVE, WORK, RETURN
            target: null,
            hp: 100,
            xp: 0,
            lvl: 1,
            hasItem: false,
            speed: 2 + Math.random() * 0.5, // Každý je jinak rychlý
            
            // Grafická reprezentace (získáme z Grafického modulu)
            container: null 
        };

        // Vykreslení
        unitData.container = GraphicsEngine.renderUnit(unitData);
        unitData.container.x = x; 
        unitData.container.y = y;

        // Přidání do světa
        layers.units.addChild(unitData.container);
        Entities.units.push(unitData);
        Entities.all.push(unitData);
        
        GameState.population++;
    },

    // Pomocná funkce: Najdi nejbližší zdroj podle profese
    findTarget: (unit) => {
        let bestTarget = null;
        let minDst = Infinity;
        
        // Co hledáme?
        let searchType = null;
        if (unit.job === 'lumber') searchType = 'tree';
        else if (unit.job === 'miner') searchType = 'rock';

        if (!searchType) return null; // Flákači nic nehledají

        // Projdeme zdroje
        Entities.resources.forEach(res => {
            if (res.type === searchType && res.hp > 0) {
                const dst = Math.sqrt((res.x - unit.x)**2 + (res.y - unit.y)**2);
                if (dst < minDst) {
                    minDst = dst;
                    bestTarget = res;
                }
            }
        });
        return bestTarget;
    },

    // Hlavní AI smyčka (volána každým snímkem pro každou jednotku)
    updateUnit: (unit, dt) => {
        const sprite = unit.container;
        
        // 1. ROZHODOVÁNÍ (State Machine)
        if (unit.state === 'IDLE') {
            // Pokud nemá práci a má profesi, najdi zdroj
            if (!unit.hasItem && unit.job !== 'idle') {
                unit.target = AISystem.findTarget(unit);
                if (unit.target) unit.state = 'MOVE';
            } 
            // Pokud je flákač, jen se potuluj
            else if (Math.random() < 0.01) {
                unit.target = {
                    x: unit.x + (Math.random()-0.5)*200, 
                    y: unit.y + (Math.random()-0.5)*200
                };
                unit.state = 'MOVE';
            }
        }

        // 2. POHYB
        if (unit.state === 'MOVE' || unit.state === 'RETURN') {
            if (unit.target) {
                const dx = unit.target.x - unit.x;
                const dy = unit.target.y - unit.y;
                const dst = Math.sqrt(dx*dx + dy*dy);
                
                if (dst > 30) { // Ještě tam nejsme
                    unit.x += (dx / dst) * unit.speed * (dt * 60); // dt normalizace
                    unit.y += (dy / dst) * unit.speed * (dt * 60);
                    
                    // Animace chůze (pohupování)
                    sprite.rotation = Math.sin(GameState.time * 100 + unit.id) * 0.1;
                } else {
                    // Došli jsme k cíli
                    sprite.rotation = 0;
                    if (unit.state === 'RETURN') {
                        // Jsme doma, odevzdat suroviny
                        unit.hasItem = false;
                        unit.state = 'IDLE';
                        // Zisk suroviny
                        if (unit.job === 'lumber') GameState.wood += 10;
                        if (unit.job === 'miner') GameState.stone += 5;
                        
                        // Překreslit postavu (bez batohu)
                        const parent = sprite.parent;
                        parent.removeChild(sprite);
                        unit.container = GraphicsEngine.renderUnit(unit);
                        unit.container.x = unit.x; unit.container.y = unit.y;
                        parent.addChild(unit.container);

                    } else if (unit.state === 'MOVE' && unit.target.hp !== undefined) {
                        // Jsme u zdroje, začít těžit
                        unit.state = 'WORK';
                    } else {
                        unit.state = 'IDLE'; // Došel na náhodné místo
                    }
                }
            }
        }

        // 3. PRÁCE (Těžba)
        if (unit.state === 'WORK') {
            if (unit.target && unit.target.hp > 0) {
                // Sekání / Kopání
                unit.target.hp -= 0.5 * (dt * 60);
                
                // Efekt otřesu zdroje
                unit.target.rotation = (Math.random()-0.5) * 0.1;
                
                // Efekt částic (Třísky)
                if (Math.random() < 0.1) {
                    AISystem.spawnParticle(unit.target.x, unit.target.y, unit.job === 'lumber' ? 0x8d6e63 : 0x777777);
                }

                // Animace nástroje (kmitání rukou)
                sprite.children[0].handR.rotation = Math.sin(GameState.time * 500) * 1.5;

                if (unit.target.hp <= 0) {
                    // Zdroj vytěžen
                    unit.target.visible = false; // Zmizí
                    unit.hasItem = true;
                    unit.state = 'RETURN';
                    unit.target = {x: Config.mapWidth/2, y: Config.mapHeight/2}; // Jdi do středu
                    
                    // Překreslit postavu (s batohem)
                    const parent = sprite.parent;
                    parent.removeChild(sprite);
                    unit.container = GraphicsEngine.renderUnit(unit);
                    unit.container.x = unit.x; unit.container.y = unit.y;
                    parent.addChild(unit.container);
                }
            } else {
                // Zdroj zmizel dřív, než jsme dotěžili (např. někdo jiný ho vzal)
                unit.state = 'IDLE';
            }
        }

        // Synchronizace grafiky s daty
        sprite.x = unit.x;
        sprite.y = unit.y;
        
        // Stín následuje postavu
        if (sprite.shadowRef) {
            sprite.shadowRef.x = sprite.x;
            sprite.shadowRef.y = sprite.y;
        }
    },

    // Efekt částic (létající třísky)
    spawnParticle: (x, y, color) => {
        const p = new PIXI.Graphics();
        p.rect(0,0, 4, 4).fill(color);
        p.x = x; p.y = y;
        p.vx = (Math.random()-0.5) * 5;
        p.vy = (Math.random()-0.5) * 5 - 2; // Spíš nahoru
        p.life = 1.0;
        
        layers.effects.addChild(p);
        Entities.particles.push({
            sprite: p,
            update: (dt) => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2; // Gravitace
                p.life -= 0.05;
                p.alpha = p.life;
                p.rotation += 0.1;
                return p.life > 0;
            },
            destroy: () => p.destroy()
        });
    }

    // --- KONEC MODULU AI ---
    };

    /*
       Tento objekt bude řešit Interakci a UI.
    */
    const UIManager = {
        // --- ZAČÁTEK MODULU UI ---

    // Kontejnery pro UI prvky
    hudContainer: new PIXI.Container(),
    selectionPanel: new PIXI.Container(),
    cursorMarker: new PIXI.Graphics(), // Ukazatel kam klikáme

    // Stav pro ovládání kamery
    dragState: { isDragging: false, lastX: 0, lastY: 0 },

    init: () => {
        console.log("Startuji UI a ovládání kamery...");
        
        // 1. VYTVOŘENÍ HORNÍ LIŠTY (Zdroje)
        const topBar = new PIXI.Graphics();
        topBar.rect(0, 0, window.innerWidth, 50).fill({color: 0x000000, alpha: 0.7});
        topBar.stroke({width: 2, color: 0x444444});
        UIManager.hudContainer.addChild(topBar);

        // Styly textu
        const style = { fontFamily: 'Arial', fontSize: 16, fill: '#ffffff', fontWeight: 'bold', dropShadow: true, dropShadowDistance: 2 };
        const labelStyle = { fontFamily: 'Arial', fontSize: 12, fill: '#aaaaaa' };

        // Helper pro vytvoření počítadla
        const createCounter = (icon, label, x) => {
            const c = new PIXI.Container();
            c.x = x; c.y = 10;
            const t = new PIXI.Text({text: `${icon} ${label}: 0`, style: style});
            t.name = label.toLowerCase(); // Pro update
            c.addChild(t);
            UIManager.hudContainer.addChild(c);
            return t;
        };

        // Rozmístění počítadel
        UIManager.woodText = createCounter('🌲', 'Wood', 20);
        UIManager.stoneText = createCounter('🪨', 'Stone', 150);
        UIManager.foodText = createCounter('🍖', 'Food', 280);
        UIManager.popText = createCounter('zzz', 'Pop', 410); // Ikona panáčka nefunguje vždy, zzz je ok
        
        // Ukazatel času (Den/Noc)
        UIManager.timeText = new PIXI.Text({text: "Den 1 | 12:00", style: { ...style, fill: '#ffd700' }});
        UIManager.timeText.anchor.set(1, 0);
        UIManager.timeText.x = window.innerWidth - 20;
        UIManager.timeText.y = 10;
        UIManager.hudContainer.addChild(UIManager.timeText);

        // 2. VYTVOŘENÍ INSPEKTORA JEDNOTEK (Levý dolní roh)
        UIManager.createSelectionPanel();

        // 3. PŘIDÁNÍ DO SCÉNY
        layers.ui.addChild(UIManager.hudContainer);
        layers.ui.addChild(UIManager.selectionPanel);

        // 4. NASTAVENÍ OVLÁDÁNÍ KAMERY A KLIKÁNÍ
        UIManager.setupInput();
        
        // Kurzory
        UIManager.cursorMarker.circle(0,0,5).fill(0xffffff);
        UIManager.cursorMarker.visible = false;
        layers.ui.addChild(UIManager.cursorMarker);
    },

    createSelectionPanel: () => {
        const p = UIManager.selectionPanel;
        p.visible = false; // Na začátku skryté
        p.x = 20;
        p.y = window.innerHeight - 150;

        // Pozadí
        const bg = new PIXI.Graphics();
        bg.rect(0, 0, 300, 130).fill({color: 0x111111, alpha: 0.9}).stroke({width: 2, color: 0xffd700});
        p.addChild(bg);

        // Prvky panelu (uložíme reference pro update)
        const titleStyle = { fontSize: 18, fill: '#ffd700', fontWeight: 'bold' };
        const infoStyle = { fontSize: 14, fill: '#cccccc' };

        p.lblName = new PIXI.Text({text: "Jednotka", style: titleStyle});
        p.lblName.position.set(15, 10);
        
        p.lblJob = new PIXI.Text({text: "Povolání: ---", style: infoStyle});
        p.lblJob.position.set(15, 40);

        p.lblAction = new PIXI.Text({text: "Činnost: ---", style: infoStyle});
        p.lblAction.position.set(15, 65);

        // HP Bar
        p.hpBar = new PIXI.Graphics();
        p.hpBar.position.set(15, 95);
        
        p.addChild(p.lblName, p.lblJob, p.lblAction, p.hpBar);
    },

    setupInput: () => {
        // Použijeme interactionPlate z Core pro chytání událostí na celé ploše
        interactionPlate.eventMode = 'static';
        
        // --- ZOOMOVÁNÍ (Kolečko) ---
        document.addEventListener('wheel', (e) => {
            const zoomSpeed = 0.1;
            const direction = e.deltaY > 0 ? -1 : 1;
            let newScale = GameState.camera.zoom + (direction * zoomSpeed);
            
            // Limity zoomu
            newScale = Math.max(0.3, Math.min(newScale, 2.5));
            
            // Aplikace zoomu na kameru
            GameState.camera.zoom = newScale;
            camera.scale.set(newScale);
            
            // (Pokročilé: Zoomování k myši by vyžadovalo posun x/y, 
            // pro jednoduchost zoomujeme do středu obrazovky nebo zachováme pozici)
        });

        // --- POSUN KAMERY (Drag) & KLIKÁNÍ ---
        interactionPlate.on('pointerdown', (e) => {
            UIManager.dragState.isDragging = true;
            UIManager.dragState.lastX = e.global.x;
            UIManager.dragState.lastY = e.global.y;
            
            // Zjistíme, jestli jsme klikli na jednotku
            // Převedeme souřadnice obrazovky na souřadnice světa
            const worldPos = UIManager.screenToWorld(e.global.x, e.global.y);
            UIManager.handleClick(worldPos.x, worldPos.y);
        });

        interactionPlate.on('pointerup', () => {
            UIManager.dragState.isDragging = false;
        });

        interactionPlate.on('pointerupoutside', () => {
            UIManager.dragState.isDragging = false;
        });

        interactionPlate.on('pointermove', (e) => {
            if (UIManager.dragState.isDragging) {
                const dx = e.global.x - UIManager.dragState.lastX;
                const dy = e.global.y - UIManager.dragState.lastY;
                
                // Posun kamery
                camera.x += dx;
                camera.y += dy;
                
                UIManager.dragState.lastX = e.global.x;
                UIManager.dragState.lastY = e.global.y;
            }
        });
    },

    // Převod souřadnic z obrazovky do herního světa (bere v potaz zoom a posun)
    screenToWorld: (screenX, screenY) => {
        return {
            x: (screenX - camera.x) / camera.scale.x,
            y: (screenY - camera.y) / camera.scale.y
        };
    },

    handleClick: (x, y) => {
        // Efekt kliknutí (Visual Marker)
        UIManager.cursorMarker.x = x * camera.scale.x + camera.x; // Jen pro efekt v UI vrstvě
        UIManager.cursorMarker.y = y * camera.scale.y + camera.y;
        UIManager.cursorMarker.visible = true;
        setTimeout(() => { UIManager.cursorMarker.visible = false; }, 200);

        // 1. Zkusíme vybrat jednotku
        let clickedUnit = null;
        // Projdeme všechny jednotky a zjistíme vzdálenost k myši
        Entities.units.forEach(u => {
            const dist = Math.sqrt((u.x - x)**2 + (u.y - y)**2);
            if (dist < 30) { // Tolerance kliknutí
                clickedUnit = u;
            }
        });

        if (clickedUnit) {
            UIManager.selectUnit(clickedUnit);
        } else {
            // Kliknutí do prázdna
            if (GameState.selectedUnit) {
                // Pokud máme vybráno, pošleme jednotku na toto místo (pokud to není flákač)
                // (Toto by šlo vylepšit v AI modulu o nucený pohyb)
                GameState.selectedUnit = null;
                UIManager.selectionPanel.visible = false;
                
                // Odznačení vizuálně (zrušíme kroužek pod postavou)
                Entities.units.forEach(u => {
                    if(u.container.selectionRing) u.container.selectionRing.visible = false;
                });
            }
        }
    },

    selectUnit: (unit) => {
        GameState.selectedUnit = unit;
        UIManager.selectionPanel.visible = true;

        // Vizuální kroužek pod postavou
        Entities.units.forEach(u => {
            if (!u.container.selectionRing) {
                const ring = new PIXI.Graphics();
                ring.circle(0,0, 15).stroke({width:2, color:0x00ff00});
                ring.visible = false;
                u.container.addChildAt(ring, 0); // Pod postavu
                u.container.selectionRing = ring;
            }
            u.container.selectionRing.visible = (u === unit);
        });
    },

    update: () => {
        // 1. Update textů
        UIManager.woodText.text = `🌲 Dřevo: ${Math.floor(GameState.wood)}`;
        UIManager.stoneText.text = `🪨 Kámen: ${Math.floor(GameState.stone)}`;
        UIManager.foodText.text = `🍖 Jídlo: ${Math.floor(GameState.food)}`;
        UIManager.popText.text = `👤 Lidé: ${GameState.population}`;

        // Čas
        const hour = Math.floor(GameState.time * 24);
        const minute = Math.floor((GameState.time * 24 * 60) % 60);
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        UIManager.timeText.text = `Den ${GameState.day} | ${timeStr}`;
        
        // Barva času (červená v noci)
        UIManager.timeText.style.fill = (hour > 20 || hour < 5) ? '#ff4444' : '#ffd700';

        // 2. Update panelu výběru
        if (GameState.selectedUnit && UIManager.selectionPanel.visible) {
            const u = GameState.selectedUnit;
            const p = UIManager.selectionPanel;
            
            p.lblName.text = `Vesničan ${u.job.toUpperCase()}`;
            p.lblJob.text = `Povolání: ${u.job}`;
            p.lblAction.text = `Stav: ${u.state} (Lvl ${u.lvl})`;
            
            // HP Bar update
            p.hpBar.clear();
            p.hpBar.rect(0,0, 200, 10).fill(0x330000);
            p.hpBar.rect(0,0, 200 * (u.hp / 100), 10).fill(0x00ff00);
        }
    }

    // --- KONEC MODULU UI ---
        update: () => {}
    };

    // ==========================================
    // INPUT SYSTEM (OVLÁDÁNÍ MYŠÍ A KLÁVESNICÍ)
    // ==========================================
    
    // Interaktivní plocha (chytá kliknutí do světa)
    const interactionPlate = new PIXI.Graphics();
    interactionPlate.rect(0, 0, Config.mapWidth, Config.mapHeight).fill({color: 0x000000, alpha: 0});
    interactionPlate.eventMode = 'static';
    layers.ground.addChildAt(interactionPlate, 0);

    interactionPlate.on('pointerdown', (e) => {
        const pos = e.getLocalPosition(layers.ground);
        // Logika kliknutí (bude rozšířena v UI modulu)
        console.log(`Kliknuto na: ${Math.round(pos.x)}, ${Math.round(pos.y)}`);
        
        if (GameState.buildMode) {
            // Placeholder pro stavění
            // --- ZDE PŘIJDE LOGIKA STAVĚNÍ ---
            GameState.buildMode = null;
            document.body.style.cursor = 'default';
        } else {
            // Placeholder pro pohyb jednotky
            if (GameState.selectedUnit) {
                GameState.selectedUnit.target = {x: pos.x, y: pos.y};
            }
        }
    });

    // ==========================================
    // HLAVNÍ HERNÍ SMYČKA (GAME LOOP)
    // ==========================================
    
    app.ticker.add((ticker) => {
        if (GameState.paused) return;

        const dt = ticker.deltaTime;
        
        // 1. Aktualizace času
        GameState.time += (1 / Config.dayLength) * dt;
        if (GameState.time >= 1) {
            GameState.time = 0;
            GameState.day++;
            console.log(`Začíná den ${GameState.day}`);
        }

        // 2. Cyklus Den/Noc (Efekt tmy)
        // Vypočítáme intenzitu tmy (křivka sinus)
        const dayPhase = (Math.sin(GameState.time * Math.PI * 2 - Math.PI/2) + 1) / 2; 
        // dayPhase 0 = půlnoc, 1 = poledne
        
        // --- ZDE BUDEME PŘIDÁVAT KÓD: [MODUL_POCASI] ---
        // (Zatím jen jednoduché stmívání)
        // layers.weather... nastavíme alpha podle času

        // 3. Update Entit (AI a Pohyb)
        Entities.all.forEach(entity => {
            if (entity.update) entity.update(dt, GameState.time);
        });

        // 4. Update Částic (Kouř, oheň)
        Entities.particles.forEach((p, index) => {
            if (p.update) {
                const alive = p.update(dt);
                if (!alive) {
                    p.destroy();
                    Entities.particles.splice(index, 1);
                }
            }
        });

        // 5. Update UI
        UIManager.update();
        
        // Třídění objektů podle Y (aby postavy byly před/za stromy)
        layers.objects.children.sort((a, b) => a.y - b.y);
        layers.units.children.sort((a, b) => a.y - b.y);
    });

    // Spuštění generátoru (zatím prázdný)
    MapGenerator.init();

    console.log("Jádro motoru spuštěno. Čekám na moduly...");
}

// Spuštění
start();
UIManager.init();
