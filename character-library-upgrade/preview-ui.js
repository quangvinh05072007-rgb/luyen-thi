  /* The preview keeps one row; editing tools belong to the editor. */
  var DESCRIPTION_NODE=$('qbar');
  function poseOptions(){
    var groups=[['Cơ bản',['idle','stand','walk','run','sit','kneel']],['Giao tiếp',['talk','wave','pointF','pointU','explain','clasp','bow','salute','reach']],['Cảm xúc',['fear','sad','joy','shy','cover','heart']],['Tạo dáng',['dance','look','sword','hips','think','cross','cheer']]];
    var h=groups.map(function(g){return '<optgroup label="'+g[0]+'">'+g[1].map(function(id){return RIG.poses.filter(function(p){return p[0]===id;})[0];}).filter(Boolean).map(function(p){return '<option value="'+p[0]+'">'+p[1]+'</option>';}).join('')+'</optgroup>';}).join('');
    var lib=pref('posesV2')||[];
    if(lib.length)h+='<optgroup label="Đã lưu">'+lib.map(function(p){return '<option value="saved:'+esc(p.id)+'">'+esc(p.n)+'</option>';}).join('')+'</optgroup>';
    return h+'<optgroup label="Tuỳ chỉnh"><option value="g_custom">Tự tạo động tác…</option></optgroup>';
  }
  function paintPoseSelect(){
    var el=$('poseSelect');if(!el)return;
    var html=poseOptions();if(el.innerHTML!==html)el.innerHTML=html;
    var id=RIG.resolve(S.pose||'stand');
    if(id==='g_custom'&&S.rig){var saved=(pref('posesV2')||[]).filter(function(p){return JSON.stringify(p.rig)===JSON.stringify(S.rig);})[0];if(saved)id='saved:'+saved.id;}
    el.value=id;if(el.selectedIndex<0)el.value='stand';syncMotionTrigger();
  }
  function renderMid(){
    if(!$('stage')){
      $('mid').innerHTML='<div class="stage" id="stage"></div><div class="preview-controls" aria-label="Điều khiển nhân vật"><div class="seg vw" role="group" aria-label="Góc nhìn"><button type="button" data-view="front" aria-pressed="true">Trước</button><button type="button" data-view="side" aria-pressed="false">Nghiêng</button><button type="button" data-view="back" aria-pressed="false">Sau</button></div><div class="motion-field"><select id="poseSelect" class="sr-only" aria-hidden="true" tabindex="-1"></select><button id="motionTrigger" type="button" aria-label="Chọn động tác" aria-haspopup="dialog" aria-expanded="false" aria-controls="motionPicker"><span class="motion-label"><span class="motion-caption">Động tác</span><span class="motion-current">Đứng nghiêm</span></span>'+ic('chev')+'</button></div><button class="preview-play" type="button" id="playTg" aria-pressed="true" aria-label="Tạm dừng chuyển động"></button></div>';
      renderStage();
    }
    paintPoseSelect();paintRig();
    var pt=$('playTg');pt.setAttribute('aria-pressed',String(PLAY&&!RIGED));pt.setAttribute('aria-label',PLAY&&!RIGED?'Tạm dừng chuyển động':'Phát chuyển động');pt.title=RIGED?'Hoàn tất chỉnh khớp để phát chuyển động':(PLAY?'Tạm dừng':'Phát');pt.disabled=RIGED;
    pt.innerHTML='<svg class="i" viewBox="0 0 24 24">'+(PLAY&&!RIGED?'<path d="M8 5v14M16 5v14"/>':'<path d="M8 5v14l11-7z"/>')+'</svg>';
    Array.prototype.forEach.call(document.querySelectorAll('.preview-controls [data-view]'),function(b){b.setAttribute('aria-pressed',String(b.dataset.view===(VIEW==='right'?'side':VIEW)));});
    paintPreviewTools();paintHead();
  }
  function previewTools(){
    return '<details class="preview-tools" id="previewTools"><summary aria-label="Khung hình và thu phóng" title="Khung hình và thu phóng">'+ic('more')+'</summary><div class="preview-tools-panel"><b>Khung hình</b><div class="seg" role="group" aria-label="Khung hình"><button type="button" data-cam="full">Toàn thân</button><button type="button" data-cam="bust">Chân dung</button><button type="button" data-cam="face">Khuôn mặt</button></div><button class="tool-option" type="button" id="autoTg" aria-pressed="false">Tự đổi khung khi chỉnh</button><button class="tool-option" type="button" data-preview-view="right">Góc nghiêng phải</button><div class="preview-zoom" role="group" aria-label="Thu phóng"><button class="ib" type="button" data-z="-" aria-label="Thu nhỏ">'+ic('minus')+'</button><button type="button" class="zv" data-z="0" id="zoomv" aria-label="Đặt lại thu phóng">100%</button><button class="ib" type="button" data-z="+" aria-label="Phóng to">'+ic('plus')+'</button><button class="ib" type="button" id="bFull" aria-label="Toàn màn hình">'+ic('full')+'</button></div></div></details>';
  }
  function paintPreviewTools(){
    Array.prototype.forEach.call(document.querySelectorAll('#previewTools [data-cam]'),function(b){b.setAttribute('aria-pressed',String(b.dataset.cam===CAMM));});
    var auto=$('autoTg');if(auto)auto.setAttribute('aria-pressed',String(AUTO));
    var zoom=$('zoomv');if(zoom)zoom.textContent=Math.round(ZOOM*100)+'%';
  }
  function renderStage(){
    var st=$('stage');if(!st)return;CT=camTarget();st.style.background='#15131a';
    st.innerHTML=charSvg(eff(PREVIEW||S),{vb:vbStr(),view:VIEW,live:true,skeleton:RIGED})+previewTools();
    paintPreviewTools();paintUndo();
  }
  function secBody(sec){
    var h=baseSecBody(sec);
    if(sec.id==='expr')h+='<label class="expression-mood" for="mood"><span>Sắc thái <output id="moodValue">'+Math.round((S.mood||0)*100)+'%</output></span><input type="range" id="mood" min="0" max="100" value="'+Math.round((S.mood||0)*100)+'" aria-label="Mức kinh dị"><span class="mood-labels"><span>Dễ thương</span><span>Kinh dị</span></span></label>';
    return h;
  }
  function mountEditExtras(){
    var scroll=$('edscroll');if(!scroll)return;
    if(TAB===3){var section=document.createElement('div');section.className='motion-editor';section.innerHTML='<div class="motion-editor-head"><div><b>Tạo động tác</b><p>Chỉnh từng khớp và lưu để dùng lại.</p></div><button type="button" class="btn sm" data-rig="tg" aria-pressed="false">Chỉnh khớp</button></div><div class="rigp" id="rigp"></div>';scroll.appendChild(section);paintRig();}
    var details=document.createElement('details');details.className='description-panel';details.innerHTML='<summary>Chỉnh bằng mô tả</summary>';details.appendChild(DESCRIPTION_NODE);scroll.appendChild(details);
  }
  function openMotionEditor(){TAB=3;OPEN=null;renderEdit();if(innerWidth<760){app.dataset.view='edit';renderNav();}}
  $('mid').addEventListener('change',function(e){
    if(e.target.id!=='poseSelect')return;var id=e.target.value;
    if(id.indexOf('saved:')===0){var p=(pref('posesV2')||[]).filter(function(x){return x.id===id.slice(6);})[0];if(!p)return;S.rig=clone(p.rig);S.pose='g_custom';RIGED=false;}
    else if(id==='g_custom'){if(S.pose!=='g_custom'||!S.rig)S.rig=RIG.pose(S,RIGTIME);S.armPose='auto';S.handL='auto';S.handR='auto';S.pose=id;RIGED=true;CAMM='full';ZOOM=1;openMotionEditor();}
    else {S.pose=id;RIGED=false;}
    change({nopanel:true});
  });
  $('mid').addEventListener('click',function(e){var b=e.target.closest('[data-preview-view]');if(b){VIEW=b.dataset.previewView;renderStage();renderMid();}});
  $('edit').addEventListener('input',function(e){if(e.target.id!=='mood')return;S.mood=+e.target.value/100;var out=$('moodValue');if(out)out.textContent=e.target.value+'%';touch();renderStage();});
  $('edit').addEventListener('change',function(e){if(e.target.id==='mood'){snap();renderMid();renderEdit();}});
  document.addEventListener('pointerdown',function(e){var tools=$('previewTools');if(tools&&!tools.contains(e.target))tools.open=false;});
  $('mid').addEventListener('toggle',function(e){if(e.target.id!=='previewTools'||!e.target.open)return;var panel=e.target.querySelector('.preview-tools-panel');panel.style.maxHeight=Math.max(48,$('stage').clientHeight-64)+'px';},true);
  window.addEventListener('resize',function(){var tools=$('previewTools');if(tools)tools.open=false;});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){var tools=$('previewTools');if(tools&&tools.open){tools.open=false;tools.querySelector('summary').focus();}}});
