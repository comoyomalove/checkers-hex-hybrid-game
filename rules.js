(function (root) {
'use strict';
var SIZE     = 8;
var ALL_DIRS = [[1,-1],[1,0],[0,1],[-1,1],[-1,0],[0,-1]];
var CAP_DIRS = [[1,-1],[-1,1],[0,-1],[0,1]];   // NE SW NW SE

function findWinPathAxis(b, player, axis){
  var seen=new Set(), prev={}, queue=[];
  if(axis==='tb'){
    for(var q=0;q<SIZE;q++) if(b[0][q]===player){var k0=q+',0';prev[k0]=null;queue.push([q,0]);}
  } else {
    for(var r=0;r<SIZE;r++) if(b[r][0]===player){var k0r='0,'+r;prev[k0r]=null;queue.push([0,r]);}
  }
  var endCell=null;
  outer: while(queue.length){
    var cur=queue.shift(),cq=cur[0],cr=cur[1],k=cq+','+cr;
    if(seen.has(k))continue;seen.add(k);
    if(axis==='tb'&&cr===SIZE-1){endCell=cur;break outer;}
    if(axis==='lr'&&cq===SIZE-1){endCell=cur;break outer;}
    for(var i=0;i<ALL_DIRS.length;i++){
      var d=ALL_DIRS[i],nq=cq+d[0],nr=cr+d[1],nk=nq+','+nr;
      if(inBounds(nq,nr)&&b[nr][nq]===player&&!seen.has(nk)&&!(nk in prev)){
        prev[nk]=cur;queue.push([nq,nr]);
      }
    }
  }
  if(!endCell)return [];
  var path=[],c=endCell;
  while(c!==null&&c!==undefined){
    path.push(c);
    var ck=c[0]+','+c[1];
    c=(ck in prev)?prev[ck]:undefined;
  }
  return path;
}

function findWinPath(b,player){
  var p=findWinPathAxis(b,player,'tb');
  if(p.length>0)return p;
  return findWinPathAxis(b,player,'lr');
}

function createBoard(){return Array.from({length:SIZE},function(){return Array(SIZE).fill(null);});}
function copyBoard(b){return b.map(function(row){return row.slice();});}
function inBounds(q,r){return q>=0&&r>=0&&q<SIZE&&r<SIZE;}

// Win condition: either player wins by connecting ANY two opposite sides.
// Two axes:
//   top↔bottom : r=0 connected to r=7
//   left↔right : q=0 connected to q=7
// Either axis works for either player — no assignment.
function hasConnectionAxis(b, player, axis){
  // axis='tb': top(r=0) to bottom(r=7)
  // axis='lr': left(q=0) to right(q=7)
  var seen=new Set(), stack=[];
  if(axis==='tb'){
    for(var q=0;q<SIZE;q++) if(b[0][q]===player) stack.push([q,0]);
  } else {
    for(var r=0;r<SIZE;r++) if(b[r][0]===player) stack.push([0,r]);
  }
  while(stack.length){
    var cur=stack.pop(), cq=cur[0], cr=cur[1], k=cq+','+cr;
    if(seen.has(k)) continue; seen.add(k);
    if(axis==='tb' && cr===SIZE-1) return true;
    if(axis==='lr' && cq===SIZE-1) return true;
    for(var i=0;i<ALL_DIRS.length;i++){
      var d=ALL_DIRS[i], nq=cq+d[0], nr=cr+d[1];
      if(inBounds(nq,nr)&&b[nr][nq]===player&&!seen.has(nq+','+nr)) stack.push([nq,nr]);
    }
  }
  return false;
}

function hasConnection(b, player){
  return hasConnectionAxis(b,player,'tb') || hasConnectionAxis(b,player,'lr');
}

function jumpsFrom(b,q,r,player){
  var enemy=3-player, jumps=[];
  for(var i=0;i<CAP_DIRS.length;i++){
    var d=CAP_DIRS[i], aq=q+d[0], ar=r+d[1], lq=q+d[0]*2, lr=r+d[1]*2;
    if(!inBounds(aq,ar)||!inBounds(lq,lr)) continue;
    if(b[ar][aq]===enemy&&b[lr][lq]===null) jumps.push({aq:aq,ar:ar,lq:lq,lr:lr});
  }
  return jumps;
}

// Auto-resolve chain (used by agent only — picks first jump each time)
function resolveChain(b,q,r,player){
  var next=copyBoard(b), captured=[], pos=[q,r];
  while(true){
    var jumps=jumpsFrom(next,pos[0],pos[1],player);
    if(!jumps.length) break;
    var j=jumps[0];
    next[j.lr][j.lq]=player;
    next[pos[1]][pos[0]]=null;
    next[j.ar][j.aq]=null;
    captured.push([j.aq,j.ar]);
    pos=[j.lq,j.lr];
  }
  return {board:next, captured:captured, finalPos:pos};
}

// Apply a single jump step (used by human interactive chain)
function applySingleJump(b, player, jump){
  var next=copyBoard(b);
  next[jump.lr][jump.lq]=player;
  next[jump.ar][jump.aq]=null;        // remove enemy
  next[b.findIndex ? 0 : 0]=next[0]; // no-op to avoid lint
  // find the from-cell: the piece must be somewhere — find it via jump coords
  // jump: {fromQ,fromR,aq,ar,lq,lr} OR {aq,ar,lq,lr} with pos tracked outside
  if(jump.fromQ!==undefined){
    next[jump.fromR][jump.fromQ]=null;
  }
  return next;
}

// ── capture helpers ───────────────────────────────────────────
// All jumps available from a single piece at (q,r).
// Used for both existing-piece captures and placement-triggered captures.
function jumpsFromPiece(b, q, r, player){
  return jumpsFrom(b, q, r, player); // reuses existing jumpsFrom
}

// Resolve full chain from (q,r): piece jumps repeatedly until no more jumps.
function resolveFromPos(b, q, r, player){
  return resolveChain(b, q, r, player);
}

// All EXISTING pieces of player that can currently jump (before any placement).
// Returns [{fromQ,fromR,overQ,overR,landQ,landR}, ...]
function existingCaptures(b, player){
  var caps=[], enemy=3-player;
  for(var r=0;r<SIZE;r++){
    for(var q=0;q<SIZE;q++){
      if(b[r][q]!==player) continue;
      var jumps=jumpsFrom(b,q,r,player);
      for(var i=0;i<jumps.length;i++){
        var j=jumps[i];
        caps.push({fromQ:q,fromR:r,overQ:j.aq,overR:j.ar,landQ:j.lq,landR:j.lr});
      }
    }
  }
  return caps;
}

// All PLACEMENT cells where placing would immediately trigger a capture.
// Returns [[q,r], ...] — empty cells that create a jump for the placed piece.
function placementCaptures(b, player){
  var cells=[];
  for(var r=0;r<SIZE;r++){
    for(var q=0;q<SIZE;q++){
      if(b[r][q]!==null) continue;
      // temporarily place piece
      var tmp=copyBoard(b);
      tmp[r][q]=player;
      if(jumpsFrom(tmp,q,r,player).length>0) cells.push([q,r]);
    }
  }
  return cells;
}

// ── legal moves ───────────────────────────────────────────────
// RULE:
//   1. If any EXISTING piece can jump → must use one of those (type:'existing-capture')
//   2. Otherwise → free placement on any empty cell (type:'place')
//      Note: placement-triggered capture is VOLUNTARY — the player may choose
//      to place on a capture-triggering cell, but is never forced to.
//      If they do, the capture resolves automatically.
//
// Returns {type, moves}
//   type='existing-capture': moves=[{fromQ,fromR,overQ,overR,landQ,landR}]
//   type='place':            moves=[[q,r], ...]
function legalMoves(b, player){
  // 1. existing piece captures — mandatory
  var excaps=existingCaptures(b,player);
  if(excaps.length>0) return {type:'existing-capture', moves:excaps};

  // 2. free placement — placement-triggered capture is voluntary
  var places=[];
  for(var r=0;r<SIZE;r++) for(var q=0;q<SIZE;q++) if(b[r][q]===null) places.push([q,r]);
  return {type:'place', moves:places};
}

// ── apply moves ───────────────────────────────────────────────
// Apply an EXISTING-PIECE capture: piece moves from (fromQ,fromR), jumps over enemy, chain resolves.
function applyCapture(b, player, cap){
  var next=copyBoard(b);
  next[cap.fromR][cap.fromQ]=null;         // lift piece
  next[cap.overR][cap.overQ]=null;         // remove first enemy
  next[cap.landR][cap.landQ]=player;       // land
  var captured=[[cap.overQ,cap.overR]];
  // chain from landing
  var pos=[cap.landQ,cap.landR];
  while(true){
    var jumps=jumpsFrom(next,pos[0],pos[1],player);
    if(!jumps.length) break;
    var j=jumps[0];
    next[j.lr][j.lq]=player;
    next[pos[1]][pos[0]]=null;
    next[j.ar][j.aq]=null;
    captured.push([j.aq,j.ar]);
    pos=[j.lq,j.lr];
  }
  return {
    board:    next,
    placed:   [cap.fromQ,cap.fromR],
    finalPos: pos,
    captured: captured,
    win:      hasConnection(next,player)
  };
}

// Apply a PLACEMENT (with optional immediate capture chain).
// Places piece at (q,r), then resolves any jump chain from that cell.
function applyTurn(b, player, q, r){
  var next=copyBoard(b);
  next[r][q]=player;
  var chain=resolveChain(next,q,r,player);
  return {
    board:    chain.board,
    placed:   [q,r],
    finalPos: chain.finalPos,
    captured: chain.captured,
    win:      hasConnection(chain.board,player)
  };
}


root.CheckersHexRules = Object.freeze({
  SIZE, ALL_DIRS, CAP_DIRS, findWinPathAxis, findWinPath, createBoard, copyBoard, inBounds, hasConnectionAxis, hasConnection, jumpsFrom, resolveChain, applySingleJump, jumpsFromPiece, resolveFromPos, existingCaptures, placementCaptures, legalMoves, applyCapture, applyTurn
});
})(globalThis);
