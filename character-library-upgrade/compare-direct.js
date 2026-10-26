  var COMPARE=!!pref('compareViews'),COMPARE_SIDE='side',STAGE_SCENES=[],DIRECT_SIDE=null,DIRECT_PENDING=null,DIRECT_SUPPRESS_CLICK=null;
  function stageSceneSVG(step){
    var views=COMPARE?['front',COMPARE_SIDE,'back']:[VIEW],savedDt=RIGDT,E=eff(PREVIEW||S),parts=[];STAGE_SCENES=[];
    views.forEach(function(view,i){
      RIGDT=i===0?(step||0):0;
      var svg=charSvg(E,{vb:vbStr(),view:view,live:true,skeleton:RIGED});
      STAGE_SCENES.push({view:view,pose:clone(RIGFRAME.pose)});
      if(COMPARE)svg=svg.replace('<svg ','<svg data-compare-view="'+view+'" x="'+(i*380)+'" y="28" width="380" height="740" style="width:380px;height:740px;overflow:hidden" ');
      else svg=svg.replace('<svg ','<svg data-stage-root="true" data-scene-view="'+view+'" ');
      parts.push(svg);
    });RIGDT=savedDt;
    if(!COMPARE)return parts[0];
    var labels=['Trước',COMPARE_SIDE==='right'?'Nghiêng phải':'Nghiêng','Sau'];
    return '<svg data-stage-root="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1140 780" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Đối chiếu cùng một nhân vật ở góc trước, nghiêng và sau">'+labels.map(function(label,i){return '<g><rect x="'+(i*380+134)+'" y="0" width="112" height="27" rx="6" style="fill:var(--surf)"/><text x="'+(i*380+190)+'" y="19" text-anchor="middle" style="font-family:inherit;font-size:18px;fill:var(--fg)">'+label+'</text></g>';}).join('')+parts.join('')+'</svg>';
  }
  function compareButton(){return '<button type="button" class="compare-toggle" id="compareToggle" aria-pressed="'+COMPARE+'" aria-label="'+(COMPARE?'Trở về một góc nhìn':'Đối chiếu trước, nghiêng và sau')+'" title="Đối chiếu 3 góc"><svg class="i" viewBox="0 0 24 24"><rect x="2" y="5" width="6" height="14" rx="1.5"/><rect x="9" y="5" width="6" height="14" rx="1.5"/><rect x="16" y="5" width="6" height="14" rx="1.5"/></svg><span>3 góc</span></button>';}
  function renderStage(){
    var st=$('stage');if(!st)return;CT=camTarget();st.style.background='#15131a';
    var oldRail=st.querySelector('.compare-rail'),oldScroll=oldRail?oldRail.scrollLeft:null;
    st.classList.toggle('compare-stage',COMPARE);
    st.innerHTML=(COMPARE?'<div class="compare-rail" aria-label="Các góc nhìn, vuốt ngang trên điện thoại">'+stageSceneSVG(0)+'</div><span class="compare-swipe-hint">Vuốt để xem góc khác</span>':stageSceneSVG(0))+compareButton()+previewTools();
    var rail=st.querySelector('.compare-rail');if(rail&&innerWidth<760)rail.scrollLeft=oldScroll!==null?oldScroll:(VIEW==='back'?2:VIEW==='side'||VIEW==='right'?1:0)*rail.clientWidth;
    paintPreviewTools();paintUndo();paintCompareControls();
  }
  function paintCompareControls(){
    var toggle=$('compareToggle');if(toggle){toggle.setAttribute('aria-pressed',String(COMPARE));toggle.setAttribute('aria-label',COMPARE?'Trở về một góc nhìn':'Đối chiếu trước, nghiêng và sau');}
    if(COMPARE)Array.prototype.forEach.call(document.querySelectorAll('.preview-controls [data-view]'),function(b){b.setAttribute('aria-pressed','false');});
    var tools=document.querySelector('.preview-tools-panel');
    if(tools&&!tools.querySelector('.direct-edit-links')){
      var section=document.createElement('div');section.className='direct-edit-links';section.innerHTML='<b>Chỉnh nhanh</b><div>'+[['hairStyle','Tóc'],['eyes','Mắt'],['outfit','Trang phục'],['hands','Bàn tay']].map(function(p){return '<button type="button" data-open-part="'+p[0]+'">'+p[1]+'</button>';}).join('')+'</div>';tools.appendChild(section);
    }
  }
  function renderMid(){baseRenderMid();paintCompareControls();}
  function updateStageCamera(){
    var stage=$('stage');if(!stage)return;var nodes=COMPARE?stage.querySelectorAll('svg[data-compare-view]'):stage.querySelectorAll('svg[data-stage-root]');
    Array.prototype.forEach.call(nodes,function(svg){svg.setAttribute('viewBox',vbStr());});
  }
  function frame(ts){
    requestAnimationFrame(frame);var dt=Math.min(.05,(ts-t0)/1000||.016);t0=ts;RIGDT=0;
    var root=document.querySelector('#stage svg[data-stage-root]');if(!root)return;
    var factor=reduce?1:1-Math.exp(-dt*8),changed=false;
    for(var i=0;i<4;i++){CAM[i]+=(CT[i]-CAM[i])*factor;if(Math.abs(CT[i]-CAM[i])>.05)changed=true;else CAM[i]=CT[i];}
    if(PLAY&&!RIGED&&!document.hidden&&$('mid').getClientRects().length&&ts-RIGLAST>1000/30){
      RIGDT=Math.min(.06,(ts-RIGLAST)/1000||dt);RIGLAST=ts;RIGTIME+=RIGDT;root.outerHTML=stageSceneSVG(RIGDT);
    }else{
      if(!PLAY||RIGED||document.hidden||!$('mid').getClientRects().length)RIGLAST=ts;
      if(changed||root.dataset.camera!==vbStr()){updateStageCamera();var current=document.querySelector('#stage svg[data-stage-root]');if(current)current.dataset.camera=vbStr();}
    }
  }
  function openPartEditor(part,side,view){
    var sections={hairStyle:'hairStyle',eyes:'eyeStyle',outfit:'outfit',hands:'hands',sleeves:'sleeves',expr:'expr',acc:'acc',socks:'socks',identity:'identity'},section=sections[part];if(!section)return;
    if(view)VIEW=view;DIRECT_SIDE=part==='hands'?side:null;TAB=0;OPEN=section;
    if(typeof closeMotionPicker==='function')closeMotionPicker(false);var tools=$('previewTools');if(tools)tools.open=false;
    renderEdit();renderMid();
    if(innerWidth<760){app.dataset.view='edit';renderNav();}
    var body=part==='hands'&&side?document.querySelector('[data-hand-panel="'+side+'"]'):document.querySelector('#edit [data-sec="'+section+'"]');
    var heading=document.querySelector('#edit [data-sec="'+section+'"]');if(heading)heading.focus({preventScroll:true});
    if(body)body.scrollIntoView({block:'nearest',behavior:'instant'});
  }
  $('mid').addEventListener('pointerdown',function(e){
    if(e.button!==0)return;var target=e.target.closest&&e.target.closest('[data-edit-part]');if(!target||!target.closest('#stage'))return;
    var scene=target.closest('svg[data-compare-view],svg[data-scene-view]'),view=scene&&(scene.dataset.compareView||scene.dataset.sceneView);
    if(e.pointerType==='touch'){DIRECT_PENDING={id:e.pointerId,part:target.dataset.editPart,side:target.dataset.editSide,view:view,x:e.clientX,y:e.clientY};return;}
    e.preventDefault();openPartEditor(target.dataset.editPart,target.dataset.editSide,view);
  });
  document.addEventListener('pointermove',function(e){if(DIRECT_PENDING&&e.pointerId===DIRECT_PENDING.id&&Math.hypot(e.clientX-DIRECT_PENDING.x,e.clientY-DIRECT_PENDING.y)>10)DIRECT_PENDING=null;});
  document.addEventListener('pointercancel',function(){DIRECT_PENDING=null;});
  document.addEventListener('pointerdown',function(){DIRECT_SUPPRESS_CLICK=null;},true);
  document.addEventListener('pointerup',function(e){if(!DIRECT_PENDING||e.pointerId!==DIRECT_PENDING.id)return;var pick=DIRECT_PENDING;DIRECT_PENDING=null;if(Math.hypot(e.clientX-pick.x,e.clientY-pick.y)<=10){DIRECT_SUPPRESS_CLICK={until:performance.now()+500,x:e.clientX,y:e.clientY};openPartEditor(pick.part,pick.side,pick.view);}});
  // Opening the mobile editor moves controls under the finger. Consume only
  // the compatibility click belonging to that tap, before it hits those controls.
  document.addEventListener('click',function(e){var pending=DIRECT_SUPPRESS_CLICK;if(pending&&e.detail>0&&performance.now()<pending.until&&Math.hypot(e.clientX-pending.x,e.clientY-pending.y)<12){DIRECT_SUPPRESS_CLICK=null;e.preventDefault();e.stopImmediatePropagation();}},true);
  $('mid').addEventListener('click',function(e){
    var toggle=e.target.closest('#compareToggle');if(toggle){COMPARE=!COMPARE;pref('compareViews',COMPARE);renderStage();renderMid();return;}
    var part=e.target.closest('[data-open-part]');if(part)openPartEditor(part.dataset.openPart,null,VIEW);
  });
  $('mid').addEventListener('click',function(e){var view=e.target.closest('[data-view]');if(view&&view.closest('.vw')){if(view.dataset.view==='side')COMPARE_SIDE='side';if(COMPARE){COMPARE=false;pref('compareViews',false);}}
    if(e.target.closest('[data-preview-view="right"]'))COMPARE_SIDE='right';
  },true);
  function secBody(sec){
    var html=appearanceSecBody(sec),key=sec.id==='eyeStyle'?'eye':sec.id==='hairStyle'?'hair':null;
    if(key)html+='<label class="direct-color sws" data-sw="'+key+'"><span>'+(key==='eye'?'Màu mắt':'Màu tóc')+'</span><input type="color" data-direct-color="'+key+'" data-color-key="'+key+'" value="'+S[key]+'" aria-label="'+(key==='eye'?'Màu mắt':'Màu tóc')+'"></label>';
    return html;
  }
  window.CharacterStudioV2.previewState=function(){return {compare:COMPARE,time:RIGTIME,views:clone(STAGE_SCENES)};};
