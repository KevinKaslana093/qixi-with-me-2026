(() => {
  'use strict';

  const scenes = ['cover','boy','question','man','game','ai','re0','outro'];
  const sceneLabels = ['邀请','男孩','转折','男人','游戏','AI','Re:0','尾声'];
  const panels = [...document.querySelectorAll('.panel')];
  const experience = document.querySelector('#experience');
  const loader = document.querySelector('#loader');
  const enterButton = document.querySelector('#enterButton');
  const loaderBar = document.querySelector('#loaderBar');
  const loaderStatus = document.querySelector('#loaderStatus');
  const progressRail = document.querySelector('#progressRail');
  const chapterBadge = document.querySelector('#chapterBadge');
  const scrollHint = document.querySelector('#scrollHint');
  const introAudio = document.querySelector('#introAudio');
  const aizoAudio = document.querySelector('#aizoAudio');
  const soundButton = document.querySelector('#soundButton');
  const soundLabel = document.querySelector('#soundLabel');
  const cursor = document.querySelector('#cursor');
  const modal = document.querySelector('#mediaModal');
  const modalVideo = document.querySelector('#modalVideo');
  const modalTitle = document.querySelector('#modalTitle');
  const closeModalButton = document.querySelector('#closeModal');
  const genshinPreview = document.querySelector('#genshinPreview');
  const aiPreview = document.querySelector('#aiPreview');
  const re0Preview = document.querySelector('#re0Preview');

  async function hydrateMultipartMedia(element, mime) {
    const parts = element.dataset.parts?.split(',').map(item => item.trim()).filter(Boolean);
    if (!parts?.length) return;
    try {
      const responses = await Promise.all(parts.map(part => fetch(part)));
      if (responses.some(response => !response.ok)) throw new Error('media part unavailable');
      const blobs = await Promise.all(responses.map(response => response.blob()));
      element.src = URL.createObjectURL(new Blob(blobs, { type: mime }));
      element.load();
    } catch (error) {
      console.error('媒体装载失败', error);
    }
  }

  hydrateMultipartMedia(aizoAudio, 'audio/mpeg');
  hydrateMultipartMedia(re0Preview, 'video/mp4');

  let current = 0;
  let transitioning = false;
  let entered = false;
  let globalMuted = false;
  let aizoStarted = false;
  let questionTimer = 0;
  let wheelTimer = 0;
  let wheelLocked = false;
  let boyAnimation = 0;
  let romanceBranch = null;
  let choicePending = false;
  let audioBeforeModal = null;

  introAudio.volume = .72;
  aizoAudio.volume = .78;

  sceneLabels.forEach((label, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `前往${label}`);
    button.title = label;
    button.addEventListener('click', () => goTo(index));
    progressRail.appendChild(button);
  });

  const railButtons = [...progressRail.querySelectorAll('button')];

  function updateUI() {
    railButtons.forEach((button, index) => button.classList.toggle('is-active', index === current));
    const scene = scenes[current];
    const showBoy = scene === 'boy';
    const showMan = ['man','game','ai','re0'].includes(scene);
    chapterBadge.textContent = showBoy ? '男孩的七夕' : '男人的七夕';
    chapterBadge.classList.toggle('is-visible', showBoy || showMan);
    scrollHint.style.opacity = scene === 'question' ? '0' : '.65';
  }

  function fadeAudio(audio, target, duration = 450, pauseAfter = false) {
    if (!audio) return Promise.resolve();
    const start = audio.volume;
    const startAt = performance.now();
    return new Promise(resolve => {
      const tick = now => {
        const p = Math.min(1, (now - startAt) / duration);
        audio.volume = start + (target - start) * (1 - Math.pow(1 - p, 3));
        if (p < 1) requestAnimationFrame(tick);
        else {
          if (pauseAfter) audio.pause();
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  async function startIntro() {
    if (globalMuted) return;
    aizoAudio.pause();
    introAudio.currentTime = 0;
    introAudio.volume = .05;
    try { await introAudio.play(); } catch (_) {}
    fadeAudio(introAudio, .72, 700);
  }

  async function startAizo() {
    if (!aizoStarted) {
      aizoAudio.currentTime = 0;
      aizoStarted = true;
    }
    if (globalMuted || modal.classList.contains('is-open')) return;
    introAudio.pause();
    aizoAudio.volume = .05;
    try { await aizoAudio.play(); } catch (_) {}
    fadeAudio(aizoAudio, .78, 700);
  }

  function handleSceneAudio(scene) {
    if (!entered || globalMuted || modal.classList.contains('is-open')) return;
    if (scene === 'cover' || scene === 'boy') {
      aizoAudio.pause();
      if (introAudio.paused) startIntro();
    } else if (scene === 'question') {
      fadeAudio(introAudio, 0, 260, true);
    } else {
      startAizo();
    }
  }

  function resetPanelInteractions(leavingScene) {
    if (leavingScene === 'game') genshinPreview.pause();
    if (leavingScene === 'ai') aiPreview.pause();
    if (leavingScene === 're0') re0Preview.pause();
  }

  function activatePreview(scene) {
    if (scene === 'game' && document.querySelector('#gameStage').classList.contains('is-open')) {
      if (!Number.isFinite(genshinPreview.currentTime) || genshinPreview.currentTime < 14) genshinPreview.currentTime = 14.2;
      genshinPreview.play().catch(() => {});
    }
    if (scene === 're0' && document.querySelector('#re0Stage').classList.contains('is-open')) {
      if (re0Preview.currentTime < 4) re0Preview.currentTime = 7;
      re0Preview.play().catch(() => {});
    }
    if (scene === 'ai' && document.querySelector('#aiStage').classList.contains('is-open')) {
      if (aiPreview.currentTime < 1) aiPreview.currentTime = 1;
      aiPreview.play().catch(() => {});
    }
  }

  function goTo(index, options = {}) {
    index = Math.max(0, Math.min(scenes.length - 1, index));
    if ((transitioning && !options.force) || index === current) return;
    clearTimeout(questionTimer);
    transitioning = true;
    const oldScene = scenes[current];
    resetPanelInteractions(oldScene);
    panels[current].classList.remove('is-active');
    current = index;
    panels[current].classList.add('is-active');
    updateUI();
    handleSceneAudio(scenes[current]);
    if (scenes[current] === 'boy') startBoyAnimation();
    activatePreview(scenes[current]);
    setTimeout(() => { transitioning = false; }, 760);
    if (scenes[current] === 'question') {
      questionTimer = setTimeout(() => goTo(3, { force: true }), 2350);
    }
  }

  function move(direction) {
    if (!entered || modal.classList.contains('is-open')) return;
    goTo(current + direction);
  }

  document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => move(1)));
  document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => goTo(Number(button.dataset.go))));

  addEventListener('wheel', event => {
    if (!entered || modal.classList.contains('is-open') || Math.abs(event.deltaY) < 10) return;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelLocked = false; }, 360);
    if (wheelLocked) return;
    wheelLocked = true;
    move(event.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) return closeModal();
    if (modal.classList.contains('is-open')) return;
    if (['ArrowDown','PageDown','Enter',' '].includes(event.key)) { event.preventDefault(); move(1); }
    if (['ArrowUp','PageUp'].includes(event.key)) { event.preventDefault(); move(-1); }
  });

  let touchStart = 0;
  addEventListener('touchstart', event => { touchStart = event.touches[0].clientY; }, { passive: true });
  addEventListener('touchend', event => {
    if (!touchStart || modal.classList.contains('is-open')) return;
    const delta = touchStart - event.changedTouches[0].clientY;
    if (Math.abs(delta) > 45) move(delta > 0 ? 1 : -1);
    touchStart = 0;
  }, { passive: true });

  document.querySelectorAll('.stage-trigger').forEach(trigger => {
    trigger.addEventListener('click', event => {
      event.stopPropagation();
      const stage = document.querySelector(`#${trigger.dataset.stage}`);
      stage.classList.add('is-open');
      activatePreview(scenes[current]);
      navigator.vibrate?.(28);
    });
  });

  genshinPreview.addEventListener('loadedmetadata', () => { genshinPreview.currentTime = 14.2; });
  genshinPreview.addEventListener('timeupdate', () => {
    if (genshinPreview.currentTime > 14.35) document.querySelector('#genshinPreviewWrap').classList.add('has-frame');
    if (genshinPreview.currentTime >= 22.25) genshinPreview.currentTime = 14.2;
  });
  re0Preview.addEventListener('loadedmetadata', () => { re0Preview.currentTime = 7; });
  re0Preview.addEventListener('ended', () => { re0Preview.currentTime = 7; re0Preview.play().catch(() => {}); });
  aiPreview.addEventListener('loadedmetadata', () => { aiPreview.currentTime = 1; });
  aiPreview.addEventListener('ended', () => { aiPreview.currentTime = 1; aiPreview.play().catch(() => {}); });

  document.querySelectorAll('[data-video]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (!button.closest('.scatter-stage').classList.contains('is-open')) return;
      openModal(button.dataset.video);
    });
  });

  async function openModal(kind) {
    const isGenshin = kind === 'genshin';
    const isAi = kind === 'ai';
    const preview = isGenshin ? genshinPreview : (isAi ? aiPreview : re0Preview);
    preview.pause();
    audioBeforeModal = !aizoAudio.paused ? aizoAudio : (!introAudio.paused ? introAudio : null);
    if (audioBeforeModal) await fadeAudio(audioBeforeModal, 0, 320, true);
    modalVideo.src = isGenshin ? 'assets/genshin-start.mp4' : (isAi ? 'assets/ai-shinjuku.mp4' : re0Preview.src);
    modalTitle.textContent = isGenshin ? 'GENSHIN IMPACT · START' : (isAi ? '牛来：新宿决战 · 非本人作品' : 'RE:ZERO · OPENING');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    modalVideo.load();
    modalVideo.addEventListener('loadedmetadata', function onMeta() {
      modalVideo.removeEventListener('loadedmetadata', onMeta);
      modalVideo.currentTime = isGenshin ? 12.3 : (isAi ? 0 : 0);
      if (!globalMuted) modalVideo.play().catch(() => {});
    });
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    modalVideo.pause();
    modalVideo.removeAttribute('src');
    modalVideo.load();
    if (audioBeforeModal && !globalMuted) {
      audioBeforeModal.volume = .05;
      audioBeforeModal.play().catch(() => {});
      fadeAudio(audioBeforeModal, audioBeforeModal === aizoAudio ? .78 : .72, 650);
    }
    audioBeforeModal = null;
    activatePreview(scenes[current]);
  }

  closeModalButton.addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  modalVideo.addEventListener('ended', closeModal);

  soundButton.addEventListener('click', () => {
    globalMuted = !globalMuted;
    soundButton.classList.toggle('is-muted', globalMuted);
    soundLabel.textContent = globalMuted ? 'SOUND OFF' : 'SOUND ON';
    if (globalMuted) {
      introAudio.pause();
      aizoAudio.pause();
      modalVideo.muted = true;
    } else {
      modalVideo.muted = false;
      handleSceneAudio(scenes[current]);
    }
  });

  document.querySelector('#contactButton').addEventListener('click', event => {
    const button = event.currentTarget;
    button.firstChild.textContent = '联系方式即将揭晓 ';
    setTimeout(() => { button.firstChild.textContent = '和我聊聊 '; }, 2300);
  });

  // Custom cursor and gentle scene parallax.
  let pointerX = innerWidth / 2, pointerY = innerHeight / 2, cursorX = pointerX, cursorY = pointerY;
  addEventListener('pointermove', event => {
    pointerX = event.clientX; pointerY = event.clientY;
    const activeStage = panels[current]?.querySelector('.scatter-stage.is-open');
    if (activeStage) {
      const dx = (pointerX / innerWidth - .5) * 9;
      const dy = (pointerY / innerHeight - .5) * 7;
      activeStage.style.transform = `translate3d(${dx}px,${dy}px,0)`;
    }
  });
  document.querySelectorAll('button,.scatter-card').forEach(el => {
    el.addEventListener('pointerenter', () => cursor.classList.add('is-over'));
    el.addEventListener('pointerleave', () => cursor.classList.remove('is-over'));
  });
  function animateCursor() {
    cursorX += (pointerX - cursorX) * .17;
    cursorY += (pointerY - cursorY) * .17;
    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // Hand-drawn, scroll-era romance animation.
  const boyCanvas = document.querySelector('#boyCanvas');
  const boyCtx = boyCanvas.getContext('2d');
  const captions = [...document.querySelectorAll('#boyCaption p')];
  let boyProgress = 0;

  function resizeCanvas(canvas, ctx) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resizeCanvas(boyCanvas, boyCtx);

  function line(ctx, x1, y1, x2, y2, color = '#171513', width = 3) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }
  function stickPerson(ctx, x, y, scale, facing = 1, wave = 0, color = '#171513') {
    ctx.save(); ctx.translate(x,y); ctx.scale(scale*facing,scale);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3/scale; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0,-58,16,0,Math.PI*2); ctx.stroke();
    line(ctx,0,-42,0,24,color,3/scale);
    line(ctx,0,-18,-28,6,color,3/scale);
    line(ctx,0,-18,28,-2-wave*13,color,3/scale);
    line(ctx,0,24,-20,70,color,3/scale);
    line(ctx,0,24,23,70,color,3/scale);
    ctx.beginPath(); ctx.arc(6,-61,2.2,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  function drawFlower(ctx, x, y, size, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x,y);
    line(ctx,0,0,-8,54,'#356247',2);
    ctx.fillStyle = '#a81720';
    for (let i=0;i<6;i++) { ctx.rotate(Math.PI/3); ctx.beginPath(); ctx.ellipse(0,-size*.46,size*.22,size*.45,0,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='#6c1016'; ctx.beginPath(); ctx.arc(0,0,size*.17,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
  function drawUmbrella(ctx,x,y,size,alpha){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#171513';ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(x,y,size,Math.PI,Math.PI*2);ctx.stroke();line(ctx,x,y,x,y+78,'#171513',2.4);ctx.beginPath();ctx.arc(x-12,y+78,12,0,Math.PI);ctx.stroke();ctx.restore()}
  function drawBench(ctx,x,y,w,alpha){ctx.save();ctx.globalAlpha=alpha;line(ctx,x-w/2,y,x+w/2,y,'#171513',5);line(ctx,x-w*.36,y,x-w*.4,y+42,'#171513',3);line(ctx,x+w*.36,y,x+w*.4,y+42,'#171513',3);ctx.restore()}
  function drawHeart(ctx,x,y,size,alpha){ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.scale(size,size);ctx.fillStyle='#a81720';ctx.beginPath();ctx.moveTo(0,7);ctx.bezierCurveTo(-24,-9,-18,-27,0,-14);ctx.bezierCurveTo(18,-27,24,-9,0,7);ctx.fill();ctx.restore()}
  function drawSparkles(ctx,w,h,amount,alpha){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#a81720';for(let i=0;i<amount;i++){const x=(i*137.5%100)/100*w;const y=(i*71.3%72)/100*h+h*.08;const r=1+(i%3)*.65;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}ctx.restore()}
  function drawTears(ctx,x,y,amount,alpha){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#527fa4';ctx.fillStyle='#527fa4';ctx.lineWidth=2;for(let i=0;i<amount;i++){const dx=(i%2?8:-8)+(i-1)*3;ctx.beginPath();ctx.moveTo(x+dx,y+i*7);ctx.quadraticCurveTo(x+dx-4,y+13+i*8,x+dx,y+19+i*9);ctx.stroke();ctx.beginPath();ctx.arc(x+dx,y+22+i*9,2.5,0,Math.PI*2);ctx.fill()}ctx.restore()}
  function easeOut(x){ return 1-Math.pow(1-Math.max(0,Math.min(1,x)),3); }

  function drawRomanceScene(index,local,alpha,w,h,scale){
    const baseY=h*.59;const center=w*.5;const arrive=easeOut(local);
    boyCtx.save();boyCtx.globalAlpha=alpha;
    if(index===0){
      const gap=w*.16+(1-arrive)*w*.23;
      stickPerson(boyCtx,center-gap,baseY,scale,1,arrive*.45);
      stickPerson(boyCtx,center+gap,baseY,scale,-1,0);
      boyCtx.strokeStyle=`rgba(168,23,32,${.18+arrive*.45})`;boyCtx.lineWidth=1.2;boyCtx.setLineDash([5,8]);boyCtx.beginPath();boyCtx.moveTo(center-gap+22,baseY-18);boyCtx.quadraticCurveTo(center,baseY-72,center+gap-22,baseY-18);boyCtx.stroke();boyCtx.setLineDash([]);
    }else if(index===1){
      stickPerson(boyCtx,center-w*.075,baseY,scale,1,.35);stickPerson(boyCtx,center+w*.075,baseY,scale,-1,.35);
      for(let i=0;i<3;i++){boyCtx.strokeStyle=`rgba(23,21,19,${.16+i*.1})`;boyCtx.beginPath();boyCtx.arc(center+(i-1)*24,baseY-112-i*7,3+i,0,Math.PI*2);boyCtx.stroke()}
      drawHeart(boyCtx,center,baseY-145,.55,.25+arrive*.75);
    }else if(index===2){
      const step=Math.sin(local*Math.PI*8)*5;stickPerson(boyCtx,center-w*.055,baseY+step,scale,1,.25);stickPerson(boyCtx,center+w*.055,baseY-step,scale,-1,.25);
      drawUmbrella(boyCtx,center,baseY-102,82*scale,.35+arrive*.65);
      for(let i=0;i<18;i++)line(boyCtx,center-150+(i*37)%300,baseY-150+(i%4)*18,center-158+(i*37)%300,baseY-132+(i%4)*18,'rgba(82,102,117,.25)',1);
    }else if(index===3&&romanceBranch!=='failure'){
      drawBench(boyCtx,center,baseY+45,250*scale,1);stickPerson(boyCtx,center-w*.045,baseY,scale*.92,1,.1);stickPerson(boyCtx,center+w*.045,baseY,scale*.92,-1,.1);
      boyCtx.strokeStyle='rgba(168,23,32,.35)';boyCtx.beginPath();boyCtx.arc(center,baseY-68,118*scale,Math.PI*1.08,Math.PI*1.92);boyCtx.stroke();
    }else if(index===4&&romanceBranch!=='failure'){
      const gap=w*.09;stickPerson(boyCtx,center-gap,baseY,scale,1,arrive*.75);stickPerson(boyCtx,center+gap,baseY,scale,-1,.15);drawFlower(boyCtx,center,baseY-26,18*scale,arrive);drawHeart(boyCtx,center+gap+8,baseY-102,.48,arrive);
    }else if(index>=3&&romanceBranch==='failure'){
      if(index===3){
        stickPerson(boyCtx,center-w*.12-arrive*w*.08,baseY,scale,1,0);stickPerson(boyCtx,center+w*.12+arrive*w*.2,baseY,scale,-1,0);drawFlower(boyCtx,center-w*.02,baseY+52,15*scale,.85);for(let i=0;i<16;i++)line(boyCtx,center-210+(i*41)%420,baseY-170+(i%3)*19,center-219+(i*41)%420,baseY-148+(i%3)*19,'rgba(82,102,117,.28)',1);
      }else if(index===4){
        drawBench(boyCtx,center,baseY+45,230*scale,1);stickPerson(boyCtx,center,baseY,scale*.92,1,-.2);drawTears(boyCtx,center+7,baseY-56,3,.4+arrive*.6);drawFlower(boyCtx,center+92,baseY+51,13*scale,.6);
      }else{
        stickPerson(boyCtx,center,baseY,scale,1,-.35);drawTears(boyCtx,center+7,baseY-56,4,1);boyCtx.strokeStyle=`rgba(168,23,32,${.5+arrive*.3})`;boyCtx.setLineDash([5,7]);boyCtx.beginPath();boyCtx.arc(center,baseY-26,(90+arrive*65)*scale,0,Math.PI*2);boyCtx.stroke();boyCtx.setLineDash([]);line(boyCtx,center-24,baseY-144,center+25,baseY-112,'#a81720',2);line(boyCtx,center+25,baseY-144,center-24,baseY-112,'#a81720',2);
      }
    }else{
      stickPerson(boyCtx,center-w*.025,baseY,scale,1,.2);stickPerson(boyCtx,center+w*.025,baseY,scale,-1,.2);drawSparkles(boyCtx,w,h,34,arrive);
      const ring=80+arrive*130;boyCtx.strokeStyle=`rgba(168,23,32,${.65-arrive*.3})`;boyCtx.lineWidth=1.3;boyCtx.beginPath();boyCtx.arc(center,baseY-20,ring*scale,0,Math.PI*2);boyCtx.stroke();drawHeart(boyCtx,center,baseY-142,.8,arrive);
    }
    boyCtx.restore();
  }

  function drawBoy() {
    const w = innerWidth, h = innerHeight;
    boyCtx.clearRect(0,0,w,h);
    const warmth=Math.min(1,boyProgress*1.2);boyCtx.fillStyle=`rgb(${Math.round(241+warmth*6)},${Math.round(236-warmth*5)},${Math.round(228-warmth*10)})`; boyCtx.fillRect(0,0,w,h);
    boyCtx.strokeStyle='rgba(0,0,0,.035)'; boyCtx.lineWidth=1;
    for(let y=40;y<h;y+=56){boyCtx.beginPath();boyCtx.moveTo(0,y);boyCtx.lineTo(w,y+10);boyCtx.stroke();}
    const scale = Math.max(.82,Math.min(1.28,w/1100));
    const sequence=boyProgress*6;const scene=Math.min(5,Math.floor(sequence));const local=sequence-scene;const mix=easeOut((local-.82)/.18);
    drawRomanceScene(scene,local,1-mix,w,h,scale);if(scene<5&&mix>0)drawRomanceScene(scene+1,0,mix,w,h,scale);
    boyCtx.fillStyle='rgba(0,0,0,.42)'; boyCtx.font='11px serif'; boyCtx.letterSpacing='4px';
    boyCtx.fillText('A SMALL STORY ABOUT TWO PEOPLE',w*.08,h*.84);
  }
  function boyLoop() {
    drawBoy();
    requestAnimationFrame(boyLoop);
  }
  boyLoop();

  function startBoyAnimation() {
    cancelAnimationFrame(boyAnimation);
    boyProgress = 0;
    romanceBranch = null;
    choicePending = false;
    const choice=document.querySelector('#storyChoice');choice.classList.remove('is-show');choice.setAttribute('aria-hidden','true');
    const successCopy=['遇见一个人','交换一些心事','陪她走一段路','分享安静的时刻','送上一束花','把今晚写进星光里'];
    captions.forEach((caption,index)=>caption.textContent=successCopy[index]);
    captions.forEach(c => c.classList.remove('is-show'));
    if(!globalMuted){introAudio.currentTime=0;introAudio.volume=.72;introAudio.play().catch(()=>{})}
    const start = performance.now();
    let lastTick=start,fallbackProgress=0;
    const tick = now => {
      const duration=Number.isFinite(introAudio.duration)&&introAudio.duration>1?introAudio.duration:75;
      const delta=now-lastTick;lastTick=now;if(!choicePending&&globalMuted)fallbackProgress+=delta/(duration*1000);
      if(!choicePending)boyProgress = Math.min(1,globalMuted?fallbackProgress:introAudio.currentTime/duration);
      if(boyProgress>=.46&&!romanceBranch&&!choicePending){choicePending=true;boyProgress=.46;introAudio.pause();choice.classList.add('is-show');choice.setAttribute('aria-hidden','false')}
      const cue=[.06,.2,.37,.54,.7,.86];captions.forEach((caption,index)=>caption.classList.toggle('is-show',boyProgress>cue[index]&&boyProgress<cue[index]+.2));
      if (boyProgress < 1 && scenes[current] === 'boy') boyAnimation=requestAnimationFrame(tick);
    };
    boyAnimation=requestAnimationFrame(tick);
  }
  document.querySelectorAll('#storyChoice [data-branch]').forEach(button=>button.addEventListener('click',()=>{
    romanceBranch=button.dataset.branch;choicePending=false;const choice=document.querySelector('#storyChoice');choice.classList.remove('is-show');choice.setAttribute('aria-hidden','true');
    if(romanceBranch==='failure'){const copy=['遇见一个人','交换一些心事','差一点说出口','她走向了远处','花没有送出去','有些七夕，只剩一个人'];captions.forEach((caption,index)=>caption.textContent=copy[index])}
    if(!globalMuted)introAudio.play().catch(()=>{});
  }));
  introAudio.addEventListener('ended',()=>{if(scenes[current]==='boy')goTo(2,{force:true})});

  // Living background for the "man" reveal.
  const energyCanvas = document.querySelector('#energyCanvas');
  const energyCtx = energyCanvas.getContext('2d');
  const particles = Array.from({length:72},()=>({x:Math.random(),y:Math.random(),r:Math.random()*1.8+.3,s:Math.random()*.0015+.0004,a:Math.random()*.5+.1}));
  resizeCanvas(energyCanvas,energyCtx);
  function energyLoop(t) {
    const w=innerWidth,h=innerHeight;
    energyCtx.clearRect(0,0,w,h);
    const grad=energyCtx.createRadialGradient(w*.72,h*.45,0,w*.72,h*.45,w*.55);
    grad.addColorStop(0,'rgba(167,22,31,.17)');grad.addColorStop(1,'rgba(0,0,0,0)');
    energyCtx.fillStyle=grad;energyCtx.fillRect(0,0,w,h);
    particles.forEach(p=>{p.y-=p.s;if(p.y<-.02){p.y=1.02;p.x=Math.random()}energyCtx.fillStyle=`rgba(255,255,255,${p.a})`;energyCtx.beginPath();energyCtx.arc(p.x*w,p.y*h,p.r,0,Math.PI*2);energyCtx.fill()});
    energyCtx.strokeStyle='rgba(226,43,52,.16)';energyCtx.lineWidth=1;
    for(let i=0;i<3;i++){energyCtx.beginPath();energyCtx.arc(w*.78,h*.5,120+i*64+Math.sin(t/1300+i)*14,0,Math.PI*2);energyCtx.stroke()}
    requestAnimationFrame(energyLoop);
  }
  requestAnimationFrame(energyLoop);
  addEventListener('resize',()=>{resizeCanvas(boyCanvas,boyCtx);resizeCanvas(energyCanvas,energyCtx)});

  // Asset-aware preloader.
  const imageSources = [...document.images].map(img => img.getAttribute('src')).filter(Boolean);
  const media = [introAudio,aizoAudio,genshinPreview,aiPreview,re0Preview];
  let loaded = 0;
  const total = imageSources.length + media.length;
  let ready = false;
  function markLoaded() {
    loaded++;
    const percent = Math.min(100,Math.round(loaded/total*100));
    loaderBar.style.width = `${percent}%`;
    loaderStatus.textContent = `正在整理今晚的可能性 · ${percent}%`;
    if (loaded >= total) finishLoading();
  }
  function finishLoading(){
    if(ready)return;ready=true;loaderBar.style.width='100%';loaderStatus.textContent='今晚已经准备好';enterButton.disabled=false;
  }
  imageSources.forEach(src=>{const img=new Image();img.onload=markLoaded;img.onerror=markLoaded;img.src=src});
  media.forEach(item=>{
    if(item.readyState>=1)markLoaded();
    else{item.addEventListener('loadedmetadata',markLoaded,{once:true});item.addEventListener('error',markLoaded,{once:true})}
  });
  setTimeout(finishLoading,9000);

  enterButton.addEventListener('click', async () => {
    entered = true;
    loader.classList.add('is-gone');
    experience.classList.add('is-ready');
    experience.setAttribute('aria-hidden','false');
    await startIntro();
    updateUI();
  });

  updateUI();
})();
