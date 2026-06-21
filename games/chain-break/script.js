const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const TILE = 48;
const COLS = 16;
const ROWS = 11;
canvas.width = COLS * TILE;
canvas.height = ROWS * TILE;

const T = { EMPTY:0,WALL:1,DOMINO:2,BALL:3,SPRING:4,BOMB:5,GATE:6,GOAL:7 };
const DIR = { N:0,E:1,S:2,W:3 };
const DX = [0,1,0,-1];
const DY = [-1,0,1,0];
function opp(d) { return (d+2)%4; }

const LEVELS = [
  // L1: All on row 5: S(2,5) → domino(3,5,E)→domino(4,5,E)→ball(5,5,E)→rolls E→goal(14,5)
  {
    name: 'First Spark',
    desc: 'Place 2 dominoes beside S to start the chain',
    grid: ['................','................','................','................','................','..S..3.........G.','................','................','................','................','................'],
    inventory: { domino: 2 },
    elements: [{x:5,y:5,t:T.BALL,d:DIR.E}],
    goals: [{x:14,y:5}],
  },
  // L2: Vertical: S(2,10)→dominoes N→ball(2,5,N)→rolls N→goal(2,0)
  {
    name: 'Long Roll',
    desc: 'Build dominoes upward to reach the ball',
    grid: ['..G.............','................','................','................','..3.............','................','................','................','................','................','..S.............'],
    inventory: { domino: 5 },
    elements: [{x:2,y:4,t:T.BALL,d:DIR.N}],
    goals: [{x:2,y:0}],
  },
  // L3: Ball at (2,5) rolls N but wall at (2,3)(2,2)(2,1) blocks. Bomb placed at (2,3) destroys walls.
  {
    name: 'Bomb Breaker',
    desc: 'Bomb the wall blocking the goal',
    grid: ['..G.............','..W.............','..W.............','................','..3.............','................','................','................','................','................','..S.............'],
    inventory: { domino: 6, bomb: 1 },
    elements: [{x:2,y:4,t:T.BALL,d:DIR.N}],
    goals: [{x:2,y:0}],
  },
  // L4: Ball at (3,4) rolls E, gate at (10,4) blocks. Domino triggers gate to open.
  {
    name: 'Gate Crasher',
    desc: 'Trigger the gate open so the ball can pass',
    grid: ['................','................','................','..............G.','................','...3.......6....','................','................','................','................','..S.............'],
    inventory: { domino: 8 },
    elements: [{x:3,y:4,t:T.BALL,d:DIR.E},{x:10,y:4,t:T.GATE,d:null}],
    goals: [{x:14,y:3}],
  },
  // L5: Two balls, vertical wall, domino chain around
  {
    name: 'Double Chain',
    desc: 'Connect both balls with dominoes — one leads to the other',
    grid: ['....G...........','................','....3...........','................','....3...........','......W.........','......W.........','................','................','................','..S.............'],
    inventory: { domino: 8 },
    elements: [{x:4,y:2,t:T.BALL,d:DIR.E},{x:4,y:4,t:T.BALL,d:DIR.N}],
    goals: [{x:4,y:0}],
  },
  // L6: Complex maze with walls, 3 balls, bomb
  {
    name: 'Grand Chain',
    desc: 'Weave the chain through walls using everything you know',
    grid: ['..G.............','..W.............','..W.............','................','..W..3..........','..W.............','..W..3..........','..W.............','................','................','..S.............'],
    inventory: { domino: 8, bomb: 1 },
    elements: [{x:5,y:4,t:T.BALL,d:DIR.N},{x:5,y:6,t:T.BALL,d:DIR.W}],
    goals: [{x:2,y:0}],
  },
];

class Game {
  constructor() {
    this.levelIndex = 0;
    this.selected = null;
    this.animating = false;
    this.speed = 1;
    this._init();
  }

  _init() {
    const lvl = LEVELS[this.levelIndex];
    document.getElementById('level-info').textContent = 'Level '+(this.levelIndex+1)+' — '+lvl.name;
    document.getElementById('message').textContent = lvl.desc;

    this.grid = [];
    for (let y=0;y<ROWS;y++) {
      this.grid[y]=[];
      const line = lvl.grid[y]||'';
      for (let x=0;x<COLS;x++) {
        const ch = line[x]||'.';
        if (ch==='W') this.grid[y][x]=T.WALL;
        else if (ch==='.') this.grid[y][x]=T.EMPTY;
        else if (ch==='S') { this.grid[y][x]=T.EMPTY; this.startPos={x,y}; }
        else if (ch==='G') { this.grid[y][x]=T.GOAL; }
        else this.grid[y][x]=T.EMPTY;
      }
    }

    this.elements = [];
    for (const el of (lvl.elements||[])) {
      this.elements.push({...el});
      if (el.t===T.WALL) this.grid[el.y][el.x]=T.WALL;
      else this.grid[el.y][el.x]=el.t;
    }

    this.goals = lvl.goals||[];
    for (const g of this.goals) this.grid[g.y][g.x]=T.GOAL;

    this.placed = [];
    this.inv = {...(lvl.inventory||{})};
    this.selected = null;
    this.animating = false;
    this.overlay = null;
    this.particles = [];
    this.anims = [];
    this.fallen = new Set();

    this._buildPalette();
    this.draw();
  }

  _buildPalette() {
    const c = document.getElementById('palette-items');
    c.innerHTML = '';
    const arrows = ['▲ N','▶ E','▼ S','◀ W'];
    const types = [
      {t:T.DOMINO,k:'domino',icon:'icon-domino'},
      {t:T.BALL,k:'ball',icon:'icon-ball'},
      {t:T.SPRING,k:'spring',icon:'icon-spring'},
      {t:T.BOMB,k:'bomb',icon:'icon-bomb'},
      {t:T.GATE,k:'gate',icon:'icon-gate'},
    ];
    for (const tp of types) {
      for (let d=0;d<4;d++) {
        const key = tp.k+'_'+d;
        const cnt = this.inv[tp.k]||0;
        const div = document.createElement('div');
        div.className='palette-item';
        div.dataset.key=key;
        div.innerHTML='<div class="icon '+tp.icon+'"></div><div class="info"><div class="name">'+arrows[d]+' '+tp.k.charAt(0).toUpperCase()+tp.k.slice(1)+'</div><div class="count">'+(cnt>0?cnt+' left':'—')+'</div></div>';
        div.addEventListener('click',()=>this._select(key,tp.t,d,tp.k));
        c.appendChild(div);
      }
    }
    if (this.selected) {
      const k = this.selected.k+'_'+this.selected.dir;
      const el = document.querySelector('[data-key="'+k+'"]');
      if (el) el.classList.add('selected');
    }
  }

  _select(key,tile,dir,k) {
    if (k!=='bomb'&&k!=='gate'&&(!this.inv[k]||this.inv[k]<=0)) {
      document.getElementById('message').textContent='No more '+k+'s left!';
      return;
    }
    document.querySelectorAll('.palette-item').forEach(e=>e.classList.remove('selected'));
    const el = document.querySelector('[data-key="'+key+'"]');
    if (el) el.classList.add('selected');
    this.selected={tile,dir,k};
  }

  place(x,y) {
    if (this.animating||!this.selected) return;
    if (x<0||x>=COLS||y<0||y>=ROWS) return;
    if (this.grid[y][x]!==T.EMPTY) return;
    const s=this.selected;
    if (s.k!=='bomb'&&s.k!=='gate') {
      if (!this.inv[s.k]||this.inv[s.k]<=0) return;
      this.inv[s.k]--;
    }
    this.grid[y][x]=s.tile;
    this.placed.push({x,y,tile:s.tile,dir:s.dir,k:s.k});
    this._buildPalette();
    if (this.selected) {
      const k=this.selected.k+'_'+this.selected.dir;
      const el=document.querySelector('[data-key="'+k+'"]');
      if (el) el.classList.add('selected');
    }
    this.draw();
  }

  remove(x,y) {
    if (this.animating) return;
    const idx=this.placed.findIndex(p=>p.x===x&&p.y===y);
    if (idx===-1) return;
    const p=this.placed[idx];
    if (p.k!=='bomb'&&p.k!=='gate') this.inv[p.k]=(this.inv[p.k]||0)+1;
    this.grid[y][x]=T.EMPTY;
    this.placed.splice(idx,1);
    this._buildPalette();
    this.draw();
  }

  async test() {
    if (this.animating||!this.startPos) return;
    this.animating=true;
    this.fallen=new Set();
    this.particles=[];
    this.anims=[];
    document.getElementById('message').textContent='Chain running...';

    const allEls=[...this.elements,...this.placed];
    const queue=[];

    for (let d=0;d<4;d++) {
      const nx=this.startPos.x+DX[d];
      const ny=this.startPos.y+DY[d];
      if (nx<0||nx>=COLS||ny<0||ny>=ROWS) continue;
      const tile=this.grid[ny][nx];
      if (tile===T.DOMINO||tile===T.BALL||tile===T.SPRING||tile===T.BOMB||tile===T.GATE) {
        const el=allEls.find(e=>e.x===nx&&e.y===ny);
        queue.push({x:nx,y:ny,dir:el?el.dir:DIR.E,from:opp(d)});
      }
    }

    if (queue.length===0) {
      document.getElementById('message').textContent='Nothing next to S! Place a domino adjacent.';
      this.animating=false;
      return;
    }

    const visited=new Set();
    let won=false;

    for (let i=0;i<queue.length;i++) {
      const q=queue[i];
      const key=q.x+','+q.y;
      if (visited.has(key)) continue;
      visited.add(key);

      this._addAnim(q.x,q.y,q.dir);

      if (this.goals.some(g=>g.x===q.x&&g.y===q.y)) { won=true; break; }

      const newItems=this._propagate(q,allEls,visited);
      for (const ni of newItems) {
        const nk=ni.x+','+ni.y;
        if (!visited.has(nk)) queue.push(ni);
      }

      await this._delay(300/this.speed);
    }

    await this._delay(600);
    this.animating=false;

    if (won) {
      document.getElementById('message').textContent='GOAL! Chain complete!';
      this.overlay='win';
    } else {
      document.getElementById('message').textContent='Chain ended. Adjust and try again.';
    }
    this.draw();
  }

  _addAnim(x,y,dir) {
    const tile=this.grid[y][x];
    if (tile===T.DOMINO) {
      this.fallen.add(x+','+y);
      this.anims.push({x,y,dir,progress:0,type:'domino'});
    } else if (tile===T.BALL) {
      this.anims.push({x,y,dir,progress:0,type:'ball'});
    } else if (tile===T.BOMB) {
      this.anims.push({x,y,dir,progress:0,type:'bomb'});
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
        const px=x+dx,py=y+dy;
        if (px>=0&&px<COLS&&py>=0&&py<ROWS) {
          for (let j=0;j<3;j++) {
            this.particles.push({
              x:px*TILE+TILE/2,y:py*TILE+TILE/2,
              vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4,
              life:1,color:'#ff6644'
            });
          }
          if (this.grid[py][px]===T.WALL) this.grid[py][px]=T.EMPTY;
          if (this.grid[py][px]===T.GATE) this.grid[py][px]=T.EMPTY;
        }
      }
    } else if (tile===T.GATE) {
      this.grid[y][x]=T.EMPTY;
      this.anims.push({x,y,dir,progress:0,type:'gate'});
      for (let j=0;j<5;j++) this.particles.push({
        x:x*TILE+TILE/2,y:y*TILE+TILE/2,
        vx:(Math.random()-0.5)*6,vy:(Math.random()-0.5)*6,
        life:1,color:'#44ff66'
      });
    }
  }

  _propagate(q,allEls,visited) {
    const results=[];
    const tile=this.grid[q.y][q.x];
    const dir=q.dir;

    if (tile===T.DOMINO) {
      const nx=q.x+DX[dir],ny=q.y+DY[dir];
      if (nx<0||nx>=COLS||ny<0||ny>=ROWS) return results;
      const nt=this.grid[ny][nx];
      if (nt===T.WALL||nt===T.EMPTY) return results;
      const el=allEls.find(e=>e.x===nx&&e.y===ny);
      results.push({x:nx,y:ny,dir:el?el.dir:dir});
    } else if (tile===T.BALL) {
      let bx=q.x,by=q.y;
      while (true) {
        const nx=bx+DX[dir],ny=by+DY[dir];
        if (nx<0||nx>=COLS||ny<0||ny>=ROWS) break;
        const nt=this.grid[ny][nx];
        if (nt===T.WALL) break;
        if (nt!==T.EMPTY) {
          const el=allEls.find(e=>e.x===nx&&e.y===ny);
          results.push({x:nx,y:ny,dir:el?el.dir:dir});
          break;
        }
        bx=nx;by=ny;
      }
    } else if (tile===T.BOMB) {
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
        const nx=q.x+dx,ny=q.y+dy;
        if (nx<0||nx>=COLS||ny<0||ny>=ROWS) continue;
        const nt=this.grid[ny][nx];
        if (nt!==T.WALL&&nt!==T.EMPTY) {
          const key=nx+','+ny;
          if (!visited.has(key)) {
            const el=allEls.find(e=>e.x===nx&&e.y===ny);
            results.push({x:nx,y:ny,dir:el?el.dir:DIR.E});
          }
        }
      }
    }

    return results;
  }

  _delay(ms) { return new Promise(r=>setTimeout(r,ms)); }

  reset() { this._init(); }
  nextLevel() {
    if (this.levelIndex<LEVELS.length-1) { this.levelIndex++; this._init(); }
  }

  draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);

    for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) {
      const rx=x*TILE,ry=y*TILE;
      ctx.fillStyle=(x+y)%2===0?'#11111c':'#151520';
      ctx.fillRect(rx,ry,TILE,TILE);

      const tile=this.grid[y][x];
      const dk=x+','+y;
      if (tile===T.WALL) this._drawWall(rx,ry);
      else if (tile===T.DOMINO&&!this.fallen.has(dk)) this._drawDomino(rx,ry);
      else if (tile===T.BALL) this._drawBall(rx,ry);
      else if (tile===T.SPRING) this._drawSpring(rx,ry);
      else if (tile===T.BOMB) this._drawBomb(rx,ry);
      else if (tile===T.GATE) this._drawGate(rx,ry);
      else if (tile===T.GOAL) this._drawGoal(rx,ry);
    }

    for (const p of this.placed) {
      if (p.dir!==null&&!this.fallen.has(p.x+','+p.y)) {
        this._drawArrow(p.x*TILE,p.y*TILE,p.dir);
      }
    }
    for (const e of this.elements) {
      if (e.t===T.DOMINO||e.t===T.BALL||e.t===T.SPRING) {
        if (e.dir!==null&&!this.fallen.has(e.x+','+e.y)) {
          this._drawArrow(e.x*TILE,e.y*TILE,e.dir);
        }
      }
    }

    if (this.startPos) {
      const sx=this.startPos.x*TILE,sy=this.startPos.y*TILE;
      ctx.fillStyle='#e8a840';ctx.shadowColor='#e8a840';ctx.shadowBlur=18;
      ctx.beginPath();ctx.arc(sx+TILE/2,sy+TILE/2,10,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle='#fff';ctx.font='bold 16px monospace';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('S',sx+TILE/2,sy+TILE/2);
      ctx.fillStyle='rgba(232,168,64,0.15)';
      ctx.fillRect(sx,sy,TILE,TILE);
    }

    for (const a of this.anims) {
      a.progress=Math.min(1,a.progress+0.15*this.speed);
      const rx=a.x*TILE,ry=a.y*TILE;
      if (a.type==='domino') {
        ctx.save();ctx.translate(rx+TILE/2,ry+TILE/2);
        ctx.rotate(a.progress*Math.PI*0.5*(a.dir===DIR.N?-1:a.dir===DIR.S?1:a.dir===DIR.E?1:-1));
        ctx.fillStyle='#4a90d9';ctx.fillRect(-TILE/2+6,-TILE/2+2,TILE-12,TILE-4);
        ctx.fillStyle='#3570b0';ctx.fillRect(-TILE/2+10,-TILE/2+6,TILE-20,TILE-12);
        ctx.restore();
      } else if (a.type==='gate') {
        ctx.globalAlpha=1-a.progress;
        this._drawGate(rx,ry);
        ctx.globalAlpha=1;
      }
    }

    for (const p of this.particles) {
      if (p.life<=0) continue;
      p.x+=p.vx;p.y+=p.vy;p.life-=0.025;
      ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;

    ctx.strokeStyle='#1a1a2a';ctx.lineWidth=0.5;
    for (let x=0;x<=COLS;x++) { ctx.beginPath();ctx.moveTo(x*TILE,0);ctx.lineTo(x*TILE,canvas.height);ctx.stroke(); }
    for (let y=0;y<=ROWS;y++) { ctx.beginPath();ctx.moveTo(0,y*TILE);ctx.lineTo(canvas.width,y*TILE);ctx.stroke(); }

    if (this.overlay==='win') {
      ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#e8a840';ctx.font='bold 30px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('CHAIN COMPLETE!',canvas.width/2,canvas.height/2-16);
      ctx.fillStyle='#ccc';ctx.font='13px monospace';
      ctx.fillText('Press N for next level',canvas.width/2,canvas.height/2+16);
    }
  }

  _drawWall(rx,ry) {
    ctx.fillStyle='#2a2a3a';ctx.fillRect(rx+2,ry+2,TILE-4,TILE-4);
    ctx.strokeStyle='#4a4a5a';ctx.lineWidth=1;ctx.strokeRect(rx+3,ry+3,TILE-6,TILE-6);
    ctx.fillStyle='#1a1a28';ctx.fillRect(rx+6,ry+6,TILE-12,TILE-12);
  }
  _drawDomino(rx,ry) {
    ctx.fillStyle='#4a90d9';ctx.fillRect(rx+8,ry+4,TILE-16,TILE-8);
    ctx.fillStyle='#3570b0';ctx.fillRect(rx+12,ry+8,TILE-24,TILE-16);
    ctx.strokeStyle='#6ab0f0';ctx.lineWidth=1;ctx.strokeRect(rx+8,ry+4,TILE-16,TILE-8);
  }
  _drawSpring(rx,ry) {
    ctx.fillStyle='#5a5a30';ctx.fillRect(rx+8,ry+6,TILE-16,TILE-12);
    ctx.strokeStyle='#8a8a30';ctx.lineWidth=1;ctx.strokeRect(rx+8,ry+6,TILE-16,TILE-12);
    for (let i=0;i<3;i++) {
      ctx.fillStyle='#7a7a20';
      ctx.fillRect(rx+10,ry+10+i*8,12,4);
    }
  }
  _drawBall(rx,ry) {
    ctx.fillStyle='#e85d3a';ctx.shadowColor='#e85d3a';ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(rx+TILE/2,ry+TILE/2,16,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='#ff7d5a';
    ctx.beginPath();ctx.arc(rx+TILE/2-4,ry+TILE/2-4,6,0,Math.PI*2);ctx.fill();
  }
  _drawBomb(rx,ry) {
    ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(rx+TILE/2,ry+TILE/2,17,0,Math.PI*2);
    ctx.fill();ctx.strokeStyle='#ff4466';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#ff4466';ctx.font='16px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('\uD83D\uDCA5',rx+TILE/2,ry+TILE/2);
  }
  _drawGate(rx,ry) {
    ctx.fillStyle='#8a2a50';ctx.fillRect(rx+4,ry+4,TILE-8,TILE-8);
    ctx.strokeStyle='#ff4466';ctx.lineWidth=2;ctx.strokeRect(rx+4,ry+4,TILE-8,TILE-8);
    ctx.fillStyle='#ff4466';ctx.font='18px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('\u2716',rx+TILE/2,ry+TILE/2);
  }
  _drawGoal(rx,ry) {
    ctx.fillStyle='#3a6a20';ctx.fillRect(rx+TILE/2-12,ry+4,24,TILE-8);
    ctx.strokeStyle='#44ff66';ctx.lineWidth=2;ctx.strokeRect(rx+TILE/2-12,ry+4,24,TILE-8);
    ctx.fillStyle='#44ff66';ctx.shadowColor='#44ff66';ctx.shadowBlur=15;
    ctx.font='22px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('\u2691',rx+TILE/2,ry+TILE/2-2);ctx.shadowBlur=0;
  }
  _drawArrow(rx,ry,dir) {
    ctx.fillStyle='rgba(255,255,255,0.35)';ctx.beginPath();
    const cx=rx+TILE/2,cy=ry+TILE/2,s=6;
    if (dir===DIR.N) { ctx.moveTo(cx,cy-s-4);ctx.lineTo(cx-s,cy+s-4);ctx.lineTo(cx+s,cy+s-4); }
    else if (dir===DIR.S) { ctx.moveTo(cx,cy+s+4);ctx.lineTo(cx-s,cy-s+4);ctx.lineTo(cx+s,cy-s+4); }
    else if (dir===DIR.E) { ctx.moveTo(cx+s+4,cy);ctx.lineTo(cx-s+4,cy-s);ctx.lineTo(cx-s+4,cy+s); }
    else { ctx.moveTo(cx-s-4,cy);ctx.lineTo(cx+s-4,cy-s);ctx.lineTo(cx+s-4,cy+s); }
    ctx.fill();
  }
}

const game = new Game();

canvas.addEventListener('click', e => {
  const r=canvas.getBoundingClientRect();
  game.place(Math.floor((e.clientX-r.left)/TILE),Math.floor((e.clientY-r.top)/TILE));
});
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const r=canvas.getBoundingClientRect();
  game.remove(Math.floor((e.clientX-r.left)/TILE),Math.floor((e.clientY-r.top)/TILE));
});

document.getElementById('btn-test').addEventListener('click',()=>game.test());
document.getElementById('btn-reset').addEventListener('click',()=>game.reset());
document.getElementById('btn-speed').addEventListener('click',()=>{
  game.speed=game.speed===1?2:game.speed===2?4:1;
  document.getElementById('btn-speed').textContent=
    game.speed===1?'\u23E9 FASTER':game.speed===2?'\u23E9\u23E9 FAST':'\u23E9\u23E9\u23E9 MAX';
});
document.addEventListener('keydown',e=>{
  if (e.key==='t'||e.key==='T') game.test();
  if (e.key==='r'||e.key==='R') game.reset();
  if ((e.key==='n'||e.key==='N')&&game.overlay==='win') game.nextLevel();
  if (e.key==='Escape') { game.selected=null;document.querySelectorAll('.palette-item').forEach(el=>el.classList.remove('selected'));game.draw(); }
});

function loop() { game.draw(); requestAnimationFrame(loop); }
loop();
