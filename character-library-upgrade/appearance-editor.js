  var APPEARANCE_HANDS=[['auto','Theo động tác'],['rl','Thả lỏng'],['cv','Khum tay'],['wv','Xoè tay'],['cl','Khép tay'],['rc','Xoè rộng'],['fist','Nắm tay'],['point','Chỉ tay'],['peace','Chữ V']];
  var APPEARANCE_SLEEVES=[['auto','Theo trang phục'],['none','Không tay'],['short','Tay ngắn'],['half','Tay lửng'],['long','Tay dài'],['wide','Tay rộng']];
  var APPEARANCE_SOCKS=[['auto','Theo trang phục'],['none','Không tất'],['ankle','Tất ngắn'],['knee','Tất cao']];
  TABS[0][2].splice(1,0,{id:'sleeves',t:'Tay áo',list:[]},{id:'hands',t:'Tay & bàn tay',list:[]});
  TABS[0][2].push({id:'socks',t:'Tất',list:[]});
  function appearanceLabel(list,id){var item=list.filter(function(x){return x[0]===id;})[0];return item?item[1]:list[0][1];}
  function summary(sec){
    if(sec.id==='hands')return S.handL&&S.handL!=='auto'||S.handR&&S.handR!=='auto'?'Hai tay riêng':S.armPose&&S.armPose!=='auto'?'Đã đổi tư thế':'Theo động tác';
    if(sec.id==='sleeves')return appearanceLabel(APPEARANCE_SLEEVES,S.sleeveStyle||'auto');
    if(sec.id==='socks')return appearanceLabel(APPEARANCE_SOCKS,S.socksStyle||'auto');
    return baseSummary(sec);
  }
  function secBody(sec){
    if(sec.id==='hands'){
      var h='<label class="appearance-select-label">Tư thế hai tay<select id="armPose" aria-label="Tư thế hai tay">'+[['auto','Theo động tác'],['idle','Thả lỏng'],['hips','Chống hông'],['cross','Khoanh tay'],['wave','Vẫy tay'],['explain','Giải thích'],['reach','Đưa tay'],['cheer','Giơ hai tay']].map(function(x){return '<option value="'+x[0]+'"'+((S.armPose||'auto')===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></label><button class="appearance-link" type="button" data-link-hands aria-pressed="'+!!S.linkHands+'">'+ic(S.linkHands?'lock':'unlock')+'Đổi cùng lúc hai bàn tay</button>';
      ['L','R'].forEach(function(k){h+='<div class="hand-editor-group" data-hand-panel="'+k+'"><b>Bàn tay '+(k==='L'?'trái':'phải')+'</b><div class="hand-options">'+APPEARANCE_HANDS.map(function(x){return '<button type="button" data-hand-choice="'+k+'" data-value="'+x[0]+'" aria-pressed="'+((S['hand'+k]||'auto')===x[0])+'">'+RIG.handPreview(x[0]==='auto'?'rl':x[0],S.skin)+'<span>'+x[1]+'</span></button>';}).join('')+'</div></div>';});
      return h+'<button class="appearance-reset" type="button" data-appearance-reset="hands">Đặt lại theo động tác</button>';
    }
    if(sec.id==='sleeves')return '<div class="appearance-choice-grid">'+APPEARANCE_SLEEVES.map(function(x){return '<button type="button" data-sleeve-choice="'+x[0]+'" aria-pressed="'+((S.sleeveStyle||'auto')===x[0])+'">'+x[1]+'</button>';}).join('')+'</div>';
    if(sec.id==='socks')return '<div class="appearance-choice-grid">'+APPEARANCE_SOCKS.map(function(x){return '<button type="button" data-sock-choice="'+x[0]+'" aria-pressed="'+((S.socksStyle||'auto')===x[0])+'">'+x[1]+'</button>';}).join('')+'</div>';
    var h=standardSecBody(sec);
    return h;
  }
  function appearanceColorGrid(){
    var resolved=RIG.colors(S),fields=[['skin','Da'],['hair','Tóc'],['eye','Mắt'],['c1','Áo chính'],['c2','Áo phụ'],['c3','Điểm nhấn'],['bottomColor','Quần / váy'],['shoesColor','Giày'],['socksColor','Tất'],['accessoryColor','Phụ kiện']];
    return '<div class="appearance-colors"><p>Chọn màu từng phần. Các màu chưa đổi sẽ theo trang phục.</p><div class="color-field-grid">'+fields.map(function(f){var value=S[f[0]]||resolved[f[0]],optional=f[0].length>4,missing=f[0]==='socksColor'&&!resolved.hasSocks?'socks':f[0]==='accessoryColor'&&S.acc==='none'?'acc':'';return '<div class="color-field"><label class="sws" data-sw="'+f[0]+'"><input type="color" data-color-key="'+f[0]+'" value="'+value+'" aria-label="Màu '+f[1]+'"'+(missing?' disabled':'')+'><span>'+f[1]+'</span></label><button type="button" data-reset-color="'+f[0]+'" aria-label="Đặt lại màu '+f[1]+'" title="'+(optional?'Theo trang phục':'Đặt lại màu')+'">'+ic('undo')+'</button>'+(missing?'<button type="button" class="color-availability" data-open-appearance="'+missing+'">'+(missing==='socks'?'Chọn tất trước':'Chọn phụ kiện trước')+'</button>':'')+'</div>';}).join('')+'</div><button type="button" class="appearance-reset" data-reset-color="all">Đặt lại toàn bộ màu</button></div>';
  }
  function mountEditExtras(){
    mountStandardEditExtras();
    if(TAB===1){var scroll=$('edscroll');Array.prototype.forEach.call(scroll.querySelectorAll('.sec'),function(e){e.remove();});var div=document.createElement('div');div.innerHTML=appearanceColorGrid();scroll.insertBefore(div,scroll.firstChild);}
  }
  $('edit').addEventListener('click',function(e){
    var b=e.target.closest('[data-hand-choice],[data-link-hands],[data-sleeve-choice],[data-sock-choice],[data-appearance-reset],[data-reset-color],[data-open-appearance]');if(!b)return;
    if(b.hasAttribute('data-open-appearance')){TAB=0;OPEN=b.dataset.openAppearance;renderEdit();return;}
    if(b.hasAttribute('data-hand-choice')){RIGED=false;var k=b.dataset.handChoice;S['hand'+k]=b.dataset.value;if(S.linkHands)S['hand'+(k==='L'?'R':'L')]=b.dataset.value;}
    else if(b.hasAttribute('data-link-hands'))S.linkHands=!S.linkHands;
    else if(b.hasAttribute('data-sleeve-choice'))S.sleeveStyle=b.dataset.sleeveChoice;
    else if(b.hasAttribute('data-sock-choice'))S.socksStyle=b.dataset.sockChoice;
    else if(b.hasAttribute('data-appearance-reset')){S.handL='auto';S.handR='auto';S.armPose='auto';S.linkHands=false;}
    else {var optional=['bottomColor','shoesColor','socksColor','accessoryColor'],original=JSON.parse(BASE||'{}'),key=b.dataset.resetColor;var keys=key==='all'?['skin','hair','eye','c1','c2','c3'].concat(optional):[key];keys.forEach(function(k){if(optional.indexOf(k)>=0)delete S[k];else S[k]=original[k]||DEFS[k];});}
    change();
  });
  $('edit').addEventListener('change',function(e){
    if(e.target.id==='armPose'){RIGED=false;S.armPose=e.target.value;change();}
    else if(e.target.id==='fringeChoice'){S.fringe=e.target.value;change();}
    else if(e.target.hasAttribute('data-color-key'))renderEdit();
  });
