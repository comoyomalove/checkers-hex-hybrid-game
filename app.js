'use strict';
// =============================================================
// CHECKERS+HEX MVP — v8 — final rules-correct build
//
// BOARD  : 8×8 hex rhombus, pointy-top, axial q/r 0..7
// ADJACENCY (connection + occupancy): all 6 hex dirs
// CAPTURE AXES (2 only, NOT E/W):
//   Axis A  NE[+1,-1] ↔ SW[-1,+1]
//   Axis B  NW[ 0,-1] ↔ SE[ 0,+1]
//
// TURN   : place on ANY empty cell freely.
//          if placement creates a jump → capture fires automatically.
//          chain captures continue from landing cell.
//          capture is NEVER forced; it is a consequence of where you place.
//
// WIN    : Either player wins by connecting ANY two opposite sides.
//          top↔bottom (r=0 to r=7) OR left↔right (q=0 to q=7).
//          No side assignment — both axes open to both players.
// =============================================================

var SIZE = CheckersHexRules.SIZE;
var ALL_DIRS = CheckersHexRules.ALL_DIRS;
var CAP_DIRS = CheckersHexRules.CAP_DIRS;
var findWinPathAxis = CheckersHexRules.findWinPathAxis;
var findWinPath = CheckersHexRules.findWinPath;
var createBoard = CheckersHexRules.createBoard;
var copyBoard = CheckersHexRules.copyBoard;
var inBounds = CheckersHexRules.inBounds;
var hasConnectionAxis = CheckersHexRules.hasConnectionAxis;
var hasConnection = CheckersHexRules.hasConnection;
var jumpsFrom = CheckersHexRules.jumpsFrom;
var resolveChain = CheckersHexRules.resolveChain;
var applySingleJump = CheckersHexRules.applySingleJump;
var jumpsFromPiece = CheckersHexRules.jumpsFromPiece;
var resolveFromPos = CheckersHexRules.resolveFromPos;
var existingCaptures = CheckersHexRules.existingCaptures;
var placementCaptures = CheckersHexRules.placementCaptures;
var legalMoves = CheckersHexRules.legalMoves;
var applyCapture = CheckersHexRules.applyCapture;
var applyTurn = CheckersHexRules.applyTurn;

var SQRT3 = Math.sqrt(3);
var R     = 32;    // hex radius px
var PAD   = 44;    // canvas padding

// ── geometry ──────────────────────────────────────────────────
function hexCenter(q,r){
  return [ PAD + R*SQRT3*(q + r/2),  PAD + R*1.5*r ];
}
function pixelToHex(px,py){
  var best=null, bestD=Infinity;
  for(var r=0;r<SIZE;r++) for(var q=0;q<SIZE;q++){
    var c=hexCenter(q,r), d=(px-c[0])*(px-c[0])+(py-c[1])*(py-c[1]);
    if(d<bestD){bestD=d;best=[q,r];}
  }
  return bestD<R*R?best:null;
}

// ── canvas ────────────────────────────────────────────────────
var canvas=document.getElementById('board');
var ctx=canvas.getContext('2d');
(function(){
  var br=hexCenter(SIZE-1,SIZE-1);
  canvas.width=Math.ceil(br[0]+R+PAD);
  canvas.height=Math.ceil(br[1]+R+PAD);
}());

// ── hex drawing ───────────────────────────────────────────────
function fillHex(cx,cy,radius,fill,stroke){
  ctx.beginPath();
  for(var i=0;i<6;i++){
    var a=Math.PI/3*i-Math.PI/6;
    if(i===0) ctx.moveTo(cx+radius*Math.cos(a),cy+radius*Math.sin(a));
    else       ctx.lineTo(cx+radius*Math.cos(a),cy+radius*Math.sin(a));
  }
  ctx.closePath();
  if(fill)  {ctx.fillStyle=fill;   ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.2;ctx.stroke();}
}
function hexVertex(q,r,i){
  var c=hexCenter(q,r), a=Math.PI/3*i-Math.PI/6;
  return [c[0]+(R+3)*Math.cos(a), c[1]+(R+3)*Math.sin(a)];
}

// ── goal-edge border strips ───────────────────────────────────
function drawGoalStrips(){
  ctx.lineWidth=5; ctx.lineCap='round'; ctx.lineJoin='round';

  // P1 green — top edge of row 0  (vertices 4→5→0 per cell)
  ctx.strokeStyle='#3aaa3a';
  ctx.beginPath();
  for(var q=0;q<SIZE;q++){
    var v4=hexVertex(q,0,4),v5=hexVertex(q,0,5),v0=hexVertex(q,0,0);
    if(q===0) ctx.moveTo(v4[0],v4[1]); else ctx.lineTo(v4[0],v4[1]);
    ctx.lineTo(v5[0],v5[1]); ctx.lineTo(v0[0],v0[1]);
  }
  ctx.stroke();

  // P1 green — bottom edge of row SIZE-1  (vertices 1→2→3)
  ctx.beginPath();
  for(var q2=0;q2<SIZE;q2++){
    var v1=hexVertex(q2,SIZE-1,1),v2=hexVertex(q2,SIZE-1,2),v3=hexVertex(q2,SIZE-1,3);
    if(q2===0) ctx.moveTo(v1[0],v1[1]); else ctx.lineTo(v1[0],v1[1]);
    ctx.lineTo(v2[0],v2[1]); ctx.lineTo(v3[0],v3[1]);
  }
  ctx.stroke();

  // P2 red — left edge of col 0  (vertices 4→3 per cell)
  ctx.strokeStyle='#cc3333';
  ctx.beginPath();
  for(var r=0;r<SIZE;r++){
    var lv4=hexVertex(0,r,4),lv3=hexVertex(0,r,3);
    if(r===0) ctx.moveTo(lv4[0],lv4[1]); else ctx.lineTo(lv4[0],lv4[1]);
    ctx.lineTo(lv3[0],lv3[1]);
  }
  ctx.stroke();

  // P2 red — right edge of col SIZE-1  (vertices 0→1 per cell)
  ctx.beginPath();
  for(var r2=0;r2<SIZE;r2++){
    var rv0=hexVertex(SIZE-1,r2,0),rv1=hexVertex(SIZE-1,r2,1);
    if(r2===0) ctx.moveTo(rv0[0],rv0[1]); else ctx.lineTo(rv0[0],rv0[1]);
    ctx.lineTo(rv1[0],rv1[1]);
  }
  ctx.stroke();
}

// ── draw board ────────────────────────────────────────────────
// opts: { boardOverride, captured[], placedAt, landedAt,
//         animPlaced, animEnemies[], winPath[],
//         mustCapture[],   purple  = pieces that must capture this turn
//         selectedPiece,   cyan    = the piece the human just selected
//         landingCells[], bright green = valid landing cells to click
//         captureCells[] } yellow (legacy)
function drawBoard(opts){
  opts=opts||{};
  var src          = opts.boardOverride || board;
  var captured     = opts.captured      || [];
  var placedAt     = opts.placedAt      || null;
  var landedAt     = opts.landedAt      || null;
  var animPlace    = opts.animPlaced    || null;
  var animEnem     = opts.animEnemies   || [];
  var winPath      = opts.winPath       || [];
  var mustCap      = opts.mustCapture   || [];  // purple
  var selectedPiece= opts.selectedPiece || null; // cyan
  var landingCells = opts.landingCells  || [];   // bright green
  var capCells     = opts.captureCells  || [];   // yellow (legacy)

  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawGoalStrips();

  for(var r=0;r<SIZE;r++){
    for(var q=0;q<SIZE;q++){
      var c=hexCenter(q,r), cx=c[0], cy=c[1];

      // base fill
      var fill='#262626';
      if(captured.some(function(cp){return cp[0]===q&&cp[1]===r;})) fill='#7a3a00';
      if(placedAt  && placedAt[0]===q  && placedAt[1]===r)  fill='#1f3d20';
      if(landedAt  && landedAt[0]===q  && landedAt[1]===r)  fill='#1a2c3d';
      // animation overrides
      if(animPlace && animPlace[0]===q && animPlace[1]===r) fill='#2d6030';
      if(animEnem.some(function(e){return e[0]===q&&e[1]===r;}))   fill='#bb4400';
      // purple: existing piece that must capture this turn
      if(mustCap.some(function(c){return c[0]===q&&c[1]===r;}))         fill='#4a2060';
      // yellow: empty cell where placing triggers capture (legacy)
      if(capCells.some(function(c){return c[0]===q&&c[1]===r;}))        fill='#4a3a00';
      // cyan: the piece the human has selected to capture with
      if(selectedPiece&&selectedPiece[0]===q&&selectedPiece[1]===r)     fill='#006060';
      // bright green: valid landing cells the human can click
      if(landingCells.some(function(c){return c[0]===q&&c[1]===r;}))    fill='#1a5a20';
      // win path highlight (on top of everything except landing)
      if(winPath.some(function(wp){return wp[0]===q&&wp[1]===r;}))      fill='#1a3550';

      fillHex(cx,cy,R-1.5,fill,'#484848');

      var piece=src[r][q];
      if(piece){
        var pc=piece===1?'#44ccff':'#ff5555';
        ctx.shadowColor=pc; ctx.shadowBlur=10;
        ctx.fillStyle=pc;
        ctx.beginPath(); ctx.arc(cx,cy,R*0.38,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        ctx.fillStyle='#fff';
        ctx.font='bold '+Math.round(R*0.37)+'px system-ui';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(piece===1?'X':'O',cx,cy);
      }
    }
  }

  // win overlay on top
  if(winPath.length){
    var wcx=canvas.width/2, wcy=canvas.height/2;
    ctx.fillStyle='rgba(0,0,0,0.72)';
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(wcx-170,wcy-52,340,104,14);
    else              ctx.rect(wcx-170,wcy-52,340,104);
    ctx.fill();
    var winner=winPath[0] ? (src[winPath[0][1]][winPath[0][0]]) : 0;
    ctx.fillStyle=winner===1?'#44ccff':'#ff5555';
    ctx.font='bold 30px system-ui';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('Player '+winner+' wins!',wcx,wcy-12);
    ctx.fillStyle='#aaa';
    ctx.font='13px system-ui';
    ctx.fillText('Connection complete — press New Game to play again',wcx,wcy+20);
  }
}

// ── win path finder (BFS) ─────────────────────────────────────
// Tries both axes (top↔bottom, left↔right) — returns first found path.
// ── rules engine ─────────────────────────────────────────────
var board, currentPlayer, logs, gameOver, mode, replayIdx, replayTimer, animating;

// ── interactive capture state ─────────────────────────────────
// When a human must capture, we walk them through step by step:
//   phase=null        → normal play
//   phase='pick-piece'→ must click a purple (capturable) piece
//   phase='pick-land' → piece selected, must click a green landing cell
//   phase='chain'     → mid-chain, must click next landing cell
var capturePhase  = null;   // null | 'pick-piece' | 'pick-land' | 'chain'
var captureState  = {
  board:      null,   // working board during chain
  pieceQ:     null,   // current piece position
  pieceR:     null,
  jumps:      [],     // available jumps from current position
  captured:   [],     // accumulated captured cells [[q,r],...]
  placed:     null,   // original placement cell (for log)
  scheduleFn: null    // called when chain ends
};

function resetCaptureState(){
  capturePhase = null;
  captureState = {board:null,pieceQ:null,pieceR:null,
                  jumps:[],captured:[],placed:null,scheduleFn:null};
}

// ── session state (names, tree, stats) ───────────────────────
var playerNames = {1:'Player 1', 2:'Player 2'};
var gameTree    = [];   // [{meta, branches:[{startTurn, turns:[...]}]}]
var currentMeta = null; // set at newGame
var currentBranchIdx = 0;
var totalCaptures = {1:0, 2:0};

function getPlayerName(p){ return playerNames[p] || ('Player '+p); }

function isoNow(){ return new Date().toISOString(); }

function startNewBranch(fromTurn){
  var branch = {startTurn: fromTurn, turns: [], startedAt: isoNow()};
  currentMeta.branches.push(branch);
  currentBranchIdx = currentMeta.branches.length - 1;
  return branch;
}

function currentBranch(){
  return currentMeta ? currentMeta.branches[currentBranchIdx] : null;
}

// ── capture animation ─────────────────────────────────────────
// Step 1 (800ms): piece shows at placed cell, enemy cells glow orange
// Step 2 (700ms): enemy cells removed, piece still at placed cell
// Step 3 (500ms): piece at landing cell — final board state
function animateCapture(result, player, boardBefore, onDone){
  animating=true;
  var placed  = result.placed;
  var caps    = result.captured;
  var landed  = result.finalPos;

  // boardA: piece at placed cell, enemies still present
  var boardA=copyBoard(boardBefore);
  boardA[placed[1]][placed[0]]=player;

  // boardB: piece at placed cell, enemies removed
  var boardB=copyBoard(boardA);
  caps.forEach(function(cp){boardB[cp[1]][cp[0]]=null;});

  // step 1 — show placement + highlight enemies
  drawBoard({boardOverride:boardA, animPlaced:placed, animEnemies:caps});
  setLog('Player '+player+' placed at ('+placed[0]+','+placed[1]+') — capturing…');

  setTimeout(function(){
    // step 2 — enemies gone, piece still at placed cell
    drawBoard({boardOverride:boardB, animPlaced:placed});
    setLog('Captured '+caps.length+' piece(s)!');

    setTimeout(function(){
      // step 3 — piece at landing
      board=result.board;
      drawBoard({captured:caps, placedAt:placed, landedAt:landed});
      animating=false;
      onDone();
    }, 500);
  }, 700);
}

// ── agent (connection-first) ──────────────────────────────────
function connectionScore(b,player){
  // Both axes are valid win conditions for either player.
  // Score = max progress along either axis.
  var score=0;
  for(var r=0;r<SIZE;r++) for(var q=0;q<SIZE;q++){
    if(b[r][q]===player){
      var tbProgress = r;           // top→bottom progress
      var lrProgress = q;           // left→right progress
      var best = Math.max(tbProgress, lrProgress);
      score += best * 2;
      // small centrality bonus
      score += (3.5 - Math.abs(3.5 - q)) * 0.3;
      score += (3.5 - Math.abs(3.5 - r)) * 0.3;
    } else if(b[r][q]===3-player){
      // penalise opponent's best progress
      var oppBest = Math.max(SIZE-1-r, SIZE-1-q);
      score -= oppBest * 0.5;
    }
  }
  return score;
}
function agentChoose(b,player){
  var legal=legalMoves(b,player);

  if(legal.type==='existing-capture'){
    // must move existing piece — pick highest scoring capture
    var best=legal.moves[0], bestScore=-Infinity;
    for(var i=0;i<legal.moves.length;i++){
      var cap=legal.moves[i];
      var res=applyCapture(b,player,cap);
      if(res.win) return cap;
      var score=connectionScore(res.board,player)+res.captured.length*4;
      if(score>bestScore){bestScore=score;best=cap;}
    }
    return best;
  }

  // free placement — pick best connection move
  var best3=legal.moves[0], bestScore3=-Infinity;
  for(var k=0;k<legal.moves.length;k++){
    var m3=legal.moves[k];
    var res3=applyTurn(b,player,m3[0],m3[1]);
    if(res3.win) return m3;
    var score3=connectionScore(res3.board,player);
    if(score3>bestScore3){bestScore3=score3;best3=m3;}
  }
  return best3;
}

// ── UI helpers ────────────────────────────────────────────────
function setStatus(msg){document.getElementById('status').textContent=msg;}
function setLog(msg)   {document.getElementById('log').textContent=msg;}

function updateStatus(){
  if(gameOver){
    var w=currentPlayer===1?2:1;
    setStatus('Player '+w+' wins!\nTurns: '+logs.length+'\nPress New Game to play again.');
    return;
  }
  var legal=legalMoves(board,currentPlayer);
  var txt='Turn '+(logs.length+1)+'\nPlayer '+currentPlayer
         +(currentPlayer===1?' — X (blue)':' — O (red)');
  if(legal.type==='existing-capture'){
    txt+='\n⚠ Must capture — move a purple piece.\n'+legal.moves.length+' capture(s) available.';
  } else {
    txt+='\nPlace a piece anywhere.\nEmpty cells: '+legal.moves.length;
  }
  if(mode==='hva') txt+='\nYou are Player 1 (X)';
  setStatus(txt);
}

// ── log serialisation helpers ─────────────────────────────────
function boardToLog(b){
  // returns 8x8 array: null=empty, 1=P1, 2=P2
  return b.map(function(row){return row.slice();});
}

function legalMovesToLog(legal){
  if(legal.type==='existing-capture'){
    return {type:'existing-capture', count:legal.moves.length,
            moves:legal.moves.map(function(c){return{from:[c.fromQ,c.fromR],land:[c.landQ,c.landR]};})};
  }
  return {type:'place', count:legal.moves.length};
}

function moveToLog(result){
  return {
    type:     result.captured.length>0 ? 'capture' : 'place',
    placed:   result.placed,
    finalPos: result.finalPos,
    captured: result.captured
  };
}

function updateCaptureCount(){
  var el=document.getElementById('captureCount');
  if(!el) return;
  el.textContent =
    getPlayerName(1)+': '+( totalCaptures[1]||0)+' capture(s)  |  '+
    getPlayerName(2)+': '+(totalCaptures[2]||0)+' capture(s)';
}

// ── game flow ─────────────────────────────────────────────────
function newGame(){
  clearInterval(replayTimer);
  board=createBoard(); currentPlayer=1; logs=[];
  gameOver=false; replayIdx=-1; animating=false;
  totalCaptures={1:0,2:0};
  resetCaptureState();
  mode=document.getElementById('mode').value;

  // read player names from inputs (fallback to defaults)
  playerNames[1] = (document.getElementById('name1').value.trim()||'Player 1');
  playerNames[2] = (document.getElementById('name2').value.trim()||'Player 2');

  // start new game record in tree
  currentMeta = {
    gameId:    'game_'+(gameTree.length+1)+'_'+Date.now(),
    startedAt: isoNow(),
    mode:      mode,
    players:   {1:playerNames[1], 2:playerNames[2]},
    branches:  [],
    finishedAt: null,
    winner:    null
  };
  gameTree.push(currentMeta);
  startNewBranch(1);

  drawBoard({}); updateStatus();
  setLog('New game — '+playerNames[1]+' vs '+playerNames[2]);
  updateCaptureCount();
}

function finishTurn(result, boardSnapshotBefore, legalBefore){
  var winner = currentPlayer;   // capture before it changes

  // update capture counts
  totalCaptures[winner] = (totalCaptures[winner]||0) + result.captured.length;

  // boardSnapshotBefore + legalBefore are captured by the caller BEFORE the move
  // If not supplied (legacy path), fall back to current board (less accurate)
  var bBefore  = boardSnapshotBefore || boardToLog(board);
  var lBefore  = legalBefore         || legalMovesToLog(legalMoves(board, winner));

  // build rich turn entry
  var turnEntry = {
    turn:            logs.length+1,
    timestamp:       isoNow(),
    player:          winner,
    playerName:      getPlayerName(winner),
    boardBefore:     bBefore,
    legalMovesBefore:lBefore,
    selectedMove:    moveToLog(result),
    boardAfter:      boardToLog(result.board),
    placed:          result.placed,
    finalPos:        result.finalPos,
    captured:        result.captured,
    captureCount:    result.captured.length,
    totalCaptures:   {1:totalCaptures[1], 2:totalCaptures[2]},
    wasLegal:        true,
    win:             result.win,
    status:          result.win ? 'win' : 'ongoing'
  };

  logs.push(turnEntry);
  replayIdx=logs.length-1;

  // also push into current branch
  var br=currentBranch();
  if(br) br.turns.push(turnEntry);

  updateCaptureCount();

  if(result.win){
    gameOver=true;
    board=result.board;
    if(currentMeta){
      currentMeta.finishedAt = isoNow();
      currentMeta.winner     = winner;
      currentMeta.winnerName = getPlayerName(winner);
      currentMeta.totalTurns = logs.length;
      currentMeta.totalCaptures = {1:totalCaptures[1],2:totalCaptures[2]};
      if(currentBranch()) currentBranch().finishedAt=isoNow();
    }
    var winPath=findWinPath(board,winner);
    drawBoard({captured:result.captured, landedAt:result.finalPos, winPath:winPath});
    setStatus(getPlayerName(winner)+' wins!\nTurns: '+logs.length
             +'\nCaptures — '+getPlayerName(1)+': '+totalCaptures[1]
             +' / '+getPlayerName(2)+': '+totalCaptures[2]
             +'\nPress New Game to play again.');
    setLog(getPlayerName(winner)+' wins by connection!');
    return false;
  }

  // normal turn — draw board with highlights for next player's mandatory moves
  var nextPlayer = currentPlayer===1 ? 2 : 1;
  var nextLegal  = legalMoves(result.board, nextPlayer);
  var mustCap    = nextLegal.type==='existing-capture'
    ? nextLegal.moves.map(function(c){return[c.fromQ,c.fromR];})
    : [];
  drawBoard({
    placedAt:    result.placed,
    landedAt:    result.finalPos,
    mustCapture: mustCap
  });

  if(!result.captured.length)
    setLog('Player '+winner+' placed at ('+result.placed[0]+','+result.placed[1]+').'
          +(mustCap.length?' Opponent must capture!':''));
  else
    setLog('Player '+winner+' captured '+result.captured.length+' piece(s).');

  currentPlayer = nextPlayer;
  updateStatus();
  return true;
}

// ── interactive capture helpers ───────────────────────────────

// Show the board in "pick-piece" state: all capturable pieces highlighted purple
function showPickPiece(legal){
  var mustCells = legal.moves.map(function(c){return[c.fromQ,c.fromR];});
  drawBoard({mustCapture: mustCells});
  setLog('⚠ Capture mandatory! Click a highlighted (purple) piece to select it.');
  updateStatus();
}

// Show the board in "pick-landing" state: selected piece cyan, landings bright green
function showPickLanding(){
  var landings = captureState.jumps.map(function(j){return[j.lq,j.lr];});
  drawBoard({
    boardOverride: captureState.board,
    selectedPiece: [captureState.pieceQ, captureState.pieceR],
    landingCells:  landings
  });
  setLog('Click a green landing cell to complete the capture.');
}

// Called when the full human chain is done — build result and finish turn
function humanChainDone(scheduleFn, boardBefore, legalBefore){
  var finalBoard = captureState.board;
  var finalPos   = [captureState.pieceQ, captureState.pieceR];
  var result = {
    board:    finalBoard,
    placed:   captureState.placed || finalPos,
    finalPos: finalPos,
    captured: captureState.captured,
    win:      hasConnection(finalBoard, currentPlayer)
  };
  resetCaptureState();
  board = result.board;
  var cont = finishTurn(result, boardBefore, legalBefore);
  if(cont) scheduleFn();
}

// ── main human turn handler ───────────────────────────────────
function doTurn(q,r){
  if(gameOver||animating) return;

  // ── mid-chain: human is choosing a landing cell ──────────────
  if(capturePhase==='pick-land'||capturePhase==='chain'){
    var chosen = captureState.jumps.filter(function(j){return j.lq===q&&j.lr===r;});
    if(!chosen.length){
      // allow re-clicking a capturable piece to re-select (pick-land phase only)
      if(capturePhase==='pick-land'){
        var legal2=legalMoves(board,currentPlayer);
        var resel=legal2.moves.filter(function(c){return c.fromQ===q&&c.fromR===r;});
        if(resel.length){
          captureState.pieceQ=q; captureState.pieceR=r;
          captureState.jumps=jumpsFrom(board,q,r,currentPlayer);
          showPickLanding(); return;
        }
      }
      setLog('Click a green landing cell.'); return;
    }
    var jump = chosen[0];
    // apply single jump to working board
    var nb = copyBoard(captureState.board);
    nb[jump.lr][jump.lq] = currentPlayer;
    nb[captureState.pieceR][captureState.pieceQ] = null;
    nb[jump.ar][jump.aq]  = null;
    captureState.captured.push([jump.aq,jump.ar]);
    captureState.board   = nb;
    captureState.pieceQ  = jump.lq;
    captureState.pieceR  = jump.lr;

    // check for further jumps from landing cell
    var nextJumps = jumpsFrom(nb, jump.lq, jump.lr, currentPlayer);
    if(nextJumps.length){
      captureState.jumps = nextJumps;
      capturePhase = 'chain';
      showPickLanding();
    } else {
      // chain complete — scheduleFn already has snapBoard/snapLegal baked in
      captureState.scheduleFn();
    }
    return;
  }

  // ── pick-piece phase: human clicks a capturable piece ────────
  if(capturePhase==='pick-piece'){
    var legal3=legalMoves(board,currentPlayer);
    var sel=legal3.moves.filter(function(c){return c.fromQ===q&&c.fromR===r;});
    if(!sel.length){ setLog('Click a purple piece to select it.'); return; }
    captureState.board  = copyBoard(board);
    captureState.pieceQ = q;
    captureState.pieceR = r;
    captureState.jumps  = jumpsFrom(board,q,r,currentPlayer);
    capturePhase = 'pick-land';
    showPickLanding();
    return;
  }

  // ── normal turn start ─────────────────────────────────────────
  checkFork();

  var legal=legalMoves(board,currentPlayer);

  function scheduleAgent(){
    if(mode==='hva'&&!gameOver&&currentPlayer===2){
      setTimeout(function(){if(gameOver||animating)return;agentAct();},500);
    }
  }

  // snapshot BEFORE the move — used for accurate log
  var snapBoard  = boardToLog(board);
  var snapLegal  = legalMovesToLog(legal);

  if(legal.type==='existing-capture'){
    // enter interactive capture flow
    captureState.board      = copyBoard(board);
    captureState.captured   = [];
    captureState.placed     = null;
    captureState.scheduleFn = function(){ humanChainDone(scheduleAgent, snapBoard, snapLegal); };
    capturePhase = 'pick-piece';
    showPickPiece(legal);

  } else {
    // Free placement — click any empty cell
    if(board[r][q]!==null){ setLog('That cell is already occupied.'); return; }
    var res3=applyTurn(board,currentPlayer,q,r);
    if(res3.captured.length>0){
      var bb3=copyBoard(board);
      animateCapture(res3,currentPlayer,bb3,function(){
        var cont=finishTurn(res3, snapBoard, snapLegal);
        if(cont) scheduleAgent();
      });
    } else {
      board=res3.board;
      var cont=finishTurn(res3, snapBoard, snapLegal);
      if(cont) scheduleAgent();
    }
  }
}

// Agent turn — respects same legalMoves() rules
function agentAct(){
  if(gameOver||animating) return;
  var legal=legalMoves(board,2);
  var c=agentChoose(board,2);

  function afterAgent(){
    // after agent move, finishTurn switches currentPlayer back to 1
    // nothing else needed — human click handler takes over
  }

  // snapshot BEFORE agent move
  var aSnapBoard = boardToLog(board);
  var aSnapLegal = legalMovesToLog(legal);

  if(legal.type==='existing-capture'){
    var bb=copyBoard(board);
    var res=applyCapture(board,2,c);
    animateCapture(res,2,bb,function(){
      finishTurn(res, aSnapBoard, aSnapLegal);
      afterAgent();
    });

  } else {
    // free placement — c is [q,r]
    var res2=applyTurn(board,2,c[0],c[1]);
    if(res2.captured.length>0){
      var bb2=copyBoard(board);
      animateCapture(res2,2,bb2,function(){
        finishTurn(res2, aSnapBoard, aSnapLegal);
        afterAgent();
      });
    } else {
      board=res2.board;
      finishTurn(res2, aSnapBoard, aSnapLegal);
      afterAgent();
    }
  }
}

// ── click ─────────────────────────────────────────────────────
canvas.addEventListener('click',function(e){
  if(gameOver||animating) return;
  if(mode==='hva'&&currentPlayer===2) return;
  var rect=canvas.getBoundingClientRect(), scale=canvas.width/rect.width;
  var cell=pixelToHex((e.clientX-rect.left)*scale,(e.clientY-rect.top)*scale);
  if(!cell) return;
  doTurn(cell[0],cell[1]);
});

// ── replay helpers ────────────────────────────────────────────
function replayShow(e){
  board=copyBoard(e.boardAfter);
  drawBoard({captured:e.captured,placedAt:e.placed,landedAt:e.finalPos,
             winPath:e.win?findWinPath(board,e.player):[]});
  setStatus('Replay turn '+e.turn+'/'+logs.length
    +'\n'+e.playerName+' (P'+e.player+')'
    +'\nCaptured this turn: '+e.captureCount
    +'\n'+getPlayerName(1)+' total: '+e.totalCaptures[1]
    +' | '+getPlayerName(2)+' total: '+e.totalCaptures[2]);
}

// ── replay buttons ────────────────────────────────────────────
document.getElementById('newGame').onclick=newGame;

document.getElementById('prevTurn').onclick=function(){
  clearInterval(replayTimer);
  if(!logs.length) return;
  if(replayIdx<=0){
    replayIdx=-1;board=createBoard();drawBoard({});
    setStatus('Start of game.');return;
  }
  replayIdx--;
  replayShow(logs[replayIdx]);
};

document.getElementById('nextTurn').onclick=function(){
  clearInterval(replayTimer);
  // if we are mid-game (not replaying finished game), warn about fork
  if(replayIdx < logs.length-1 && !gameOver){
    // player went back and is now going forward — fork path
    var forkAt = replayIdx+1;
    setLog('Replaying forward — play a move to create a fork from turn '+forkAt+'.');
  }
  if(replayIdx>=logs.length-1){setLog('End of replay.');return;}
  replayIdx++;
  replayShow(logs[replayIdx]);
};

document.getElementById('playReplay').onclick=function(){
  clearInterval(replayTimer);
  if(replayIdx>=logs.length-1) replayIdx=-1;
  replayTimer=setInterval(function(){
    if(replayIdx>=logs.length-1){clearInterval(replayTimer);setLog('Replay finished.');return;}
    replayIdx++;
    replayShow(logs[replayIdx]);
  },700);
};

document.getElementById('pauseReplay').onclick=function(){
  clearInterval(replayTimer);
  setLog('Paused at turn '+(replayIdx+1)+'.');
};

// ── fork detection ────────────────────────────────────────────
// Called at the start of doTurn — if replayIdx < logs.length-1 a fork is happening
function checkFork(){
  if(replayIdx >= logs.length-1) return; // no fork — at end of log
  // player went back in replay and is now making a new move
  var forkTurn = replayIdx+1;
  setLog('Fork! New branch from turn '+forkTurn+'.');
  // trim logs to replay point
  logs = logs.slice(0, replayIdx+1);
  // start a new branch in the game tree
  if(currentBranch()) currentBranch().finishedAt=isoNow();
  startNewBranch(forkTurn);
  totalCaptures={1:0,2:0};
  // recompute captures from kept logs
  logs.forEach(function(e){
    totalCaptures[e.player]=(totalCaptures[e.player]||0)+e.captureCount;
  });
  updateCaptureCount();
}

// ── download log ──────────────────────────────────────────────
function downloadLog(){
  var payload = {
    exportedAt: isoNow(),
    totalGames: gameTree.length,
    games: gameTree
  };
  var blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'checkers-hex-log-'+Date.now()+'.json';
  a.click();
  URL.revokeObjectURL(url);
  setLog('Log downloaded — '+gameTree.length+' game(s), all branches included.');
}
document.getElementById('downloadLog').onclick=downloadLog;

// ── boot ─────────────────────────────────────────────────────
newGame();
