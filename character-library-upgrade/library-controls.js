  var LIB_OUTFIT='all',LIB_GENDER='all',LIB_AGE='all',LIB_SELECT=false,MOTION_GROUP='all',MOTION_ACTIVE=0;
  function outfitName(id){var x=OUTFITS.filter(function(o){return o[0]===id;})[0];return x?x[1]:id;}
  function hairName(id){var x=HAIRS.filter(function(o){return o[0]===id;})[0];return x?x[1]:id;}
  function listItems(){
    var q=norm(F.q),a=DB.items.filter(function(it){
      if(F.tag==='@fav'&&!it.fav)return false;
      if(F.tag!=='all'&&F.tag!=='@fav'&&F.tag!=='@recent'&&it.tags.indexOf(F.tag)<0)return false;
      if(LIB_OUTFIT!=='all'&&it.s.outfit!==LIB_OUTFIT)return false;
      var group=characterCategory(it.s,it.name);
      if(LIB_GENDER!=='all'&&group.gender!==LIB_GENDER)return false;
      if(LIB_AGE!=='all'&&group.age!==LIB_AGE)return false;
      return !q||norm(it.name+' '+it.tags.join(' ')+' '+outfitName(it.s.outfit)+' '+hairName(it.s.hairStyle)+' '+characterGroupLabel(it.s,it.name)).indexOf(q)>=0;
    });
    if(F.tag==='@recent'){var recent=pref('recentCharacters')||[];a.sort(function(x,y){var ix=recent.indexOf(x.id),iy=recent.indexOf(y.id);return (ix<0?999:ix)-(iy<0?999:iy)||y.t-x.t;});return a.slice(0,8);}
    return a.sort(F.sort==='name'?function(x,y){return x.name.localeCompare(y.name,'vi');}:F.sort==='fav'?function(x,y){return Number(y.fav)-Number(x.fav)||y.t-x.t;}:function(x,y){return y.t-x.t;});
  }
  function libraryFilterLabel(){return [LIB_GENDER==='all'?'':LIB_GENDER==='male'?'Nam':'Nữ',({child:'Trẻ em',teen:'Thiếu niên',adult:'Người lớn',elder:'Cao tuổi'})[LIB_AGE]||'',LIB_OUTFIT==='all'?'':outfitName(LIB_OUTFIT)].filter(Boolean).join(' · ');}
  function libraryGroupFilters(){
    var fields=[['libraryGenderFilter','Giới tính',[['all','Tất cả'],['female','Nữ'],['male','Nam']],LIB_GENDER,'gender'],['libraryAgeFilter','Độ tuổi',[['all','Mọi độ tuổi'],['child','Trẻ em'],['teen','Thiếu niên'],['adult','Người lớn'],['elder','Cao tuổi']],LIB_AGE,'age'],['libraryOutfitFilter','Trang phục',[['all','Tất cả trang phục']].concat(OUTFITS),LIB_OUTFIT,'outfit']];
    return '<div class="library-group-filter"><b>Lọc nhân vật</b>'+fields.map(function(f){return '<label for="'+f[0]+'">'+f[1]+'<select id="'+f[0]+'">'+f[2].map(function(o){var count=o[0]==='all'?DB.items.length:DB.items.filter(function(it){return (f[4]==='outfit'?it.s.outfit:characterCategory(it.s,it.name)[f[4]])===o[0];}).length;return '<option value="'+esc(o[0])+'"'+(o[0]===f[3]?' selected':'')+'>'+esc(o[1])+' ('+count+')</option>';}).join('')+'</select></label>';}).join('')+'<div class="library-filter-actions"><button type="button" data-reset-library-filters>Đặt lại</button><button type="button" data-apply-library-filters>Áp dụng</button></div></div>';
  }
  function renderLib(){
    var oldScroll=$('libraryScroll'),scroll=oldScroll?oldScroll.scrollTop:0,items=listItems(),nsel=Object.keys(SEL).length,nfav=DB.items.filter(function(x){return x.fav;}).length;
    var h='<div class="library-head"><h2>Thư viện <span class="library-count">'+DB.items.length+'</span></h2><button class="library-new" type="button" id="newC">'+ic('plus')+'Mới</button><button class="library-collapse collapse" type="button" id="libMin" aria-label="Thu gọn thư viện" title="Thu gọn thư viện">'+ic('side')+'</button></div>';
    h+='<div class="library-search"><label for="q">'+ic('search')+'<input type="search" id="q" placeholder="Tìm nhân vật…" value="'+esc(F.q)+'" aria-label="Tìm theo tên, thẻ, trang phục hoặc kiểu tóc" autocomplete="off"></label></div>';
    h+='<div class="library-tabs" role="group" aria-label="Lọc thư viện">'+[['all','Tất cả',DB.items.length],['@fav','Yêu thích',nfav],['@recent','Gần đây',null]].map(function(t){return '<button type="button" data-f="'+t[0]+'" aria-pressed="'+(F.tag===t[0])+'">'+t[1]+(t[2]!==null?'<span>'+t[2]+'</span>':'')+'</button>';}).join('')+'</div>';
    h+='<div class="library-toolbar"><select id="sort" aria-label="Sắp xếp nhân vật">'+[['upd','Mới cập nhật'],['name','Theo tên A–Z'],['fav','Yêu thích trước']].map(function(s){return '<option value="'+s[0]+'"'+(F.sort===s[0]?' selected':'')+'>'+s[1]+'</option>';}).join('')+'</select><button type="button" id="libraryFilter" class="library-icon" aria-label="Lọc nhân vật theo giới tính, độ tuổi và trang phục" title="Lọc nhân vật" aria-pressed="'+(LIB_OUTFIT!=='all'||LIB_GENDER!=='all'||LIB_AGE!=='all')+'">'+ic('sliders')+'</button><button type="button" id="librarySelect" class="library-icon" aria-label="Chọn nhiều nhân vật" title="Chọn nhiều" aria-pressed="'+LIB_SELECT+'">'+ic('check')+'</button><button type="button" id="vw" class="library-icon" aria-label="'+(F.view==='grid'?'Hiện dạng danh sách':'Hiện dạng lưới')+'" title="'+(F.view==='grid'?'Danh sách':'Lưới')+'">'+ic(F.view==='grid'?'list':'grid')+'</button></div>';
    if(F.q||libraryFilterLabel()||(F.tag!=='all'&&F.tag.charAt(0)!=='@'))h+='<div class="library-filter-status"><span>'+items.length+' kết quả'+(libraryFilterLabel()?' · '+esc(libraryFilterLabel()):'')+'</span><button type="button" data-clear-library>Bỏ lọc</button></div>';
    if(nsel&&LIB_SELECT)h+='<div class="bulk"><b>'+nsel+' đã chọn</b><span class="sp"></span><button type="button" id="bTag" aria-label="Gắn thẻ cho các nhân vật đã chọn">'+ic('tag')+'</button><button type="button" id="bDel" aria-label="Xoá các nhân vật đã chọn">'+ic('trash')+(EXP.del?'Xác nhận':'')+'</button><button type="button" id="bClr" aria-label="Bỏ chọn tất cả">'+ic('x')+'</button></div>';
    h+='<div class="scroll library-scroll" id="libraryScroll"><div class="grid library-grid'+(F.view==='list'?' list':'')+'" id="grid">';
    if(!items.length)h+='<div class="library-empty">'+ic('search')+'<b>Không tìm thấy nhân vật</b><p>Thử tên, trang phục hoặc kiểu tóc khác.</p><button type="button" data-clear-library>Xem tất cả nhân vật</button></div>';
    items.forEach(function(it){
      var current=it.id===DB.cur,E=eff(Object.assign(clone(DEFS),it.s,{pose:'stand'}));
      h+='<div class="card library-card" data-id="'+it.id+'" role="button" tabindex="0" aria-current="'+current+'" aria-label="Mở '+esc(it.name)+'"><div class="th">'+charSvg(E,{vb:'62 0 256 276'})+'<button class="st" type="button" data-fav="'+it.id+'" aria-pressed="'+it.fav+'" aria-label="'+(it.fav?'Bỏ yêu thích ':'Yêu thích ')+esc(it.name)+'">'+ic('star')+'</button>'+(LIB_SELECT?'<button class="ck" type="button" data-ck="'+it.id+'" role="checkbox" aria-checked="'+!!SEL[it.id]+'" aria-label="Chọn '+esc(it.name)+'">'+(SEL[it.id]?ic('check'):'')+'</button>':'')+'</div><div class="card-info"><b title="'+esc(it.name)+'">'+esc(it.name)+'</b><button class="mo" type="button" data-mo="'+it.id+'" aria-label="Thao tác với '+esc(it.name)+'" title="Thao tác">'+ic('more')+'</button></div></div>';
    });
    $('lib').innerHTML=h+'</div></div>';$('libraryScroll').scrollTop=scroll;
    if(F._focus){var qi=$('q');qi.focus({preventScroll:true});qi.setSelectionRange(qi.value.length,qi.value.length);}
  }
  $('lib').addEventListener('click',function(e){
    var t=e.target,b=t.closest('#librarySelect,#libraryFilter,[data-clear-library]');
    if(b){if(b.id==='librarySelect'){LIB_SELECT=!LIB_SELECT;if(!LIB_SELECT)SEL={};renderLib();}
      else if(b.hasAttribute('data-clear-library')){F.q='';F.tag='all';LIB_OUTFIT='all';LIB_GENDER='all';LIB_AGE='all';renderLib();}
      else {pop(b,libraryGroupFilters(),function(ev){var apply=ev.target.closest('[data-apply-library-filters]'),reset=ev.target.closest('[data-reset-library-filters]');if(apply||reset){LIB_GENDER=reset?'all':$('libraryGenderFilter').value;LIB_AGE=reset?'all':$('libraryAgeFilter').value;LIB_OUTFIT=reset?'all':$('libraryOutfitFilter').value;closePop();renderLib();}});}return;}
    if(LIB_SELECT&&!t.closest('button')){var card=t.closest('.card');if(card){e.stopImmediatePropagation();if(SEL[card.dataset.id])delete SEL[card.dataset.id];else SEL[card.dataset.id]=1;EXP.del=false;renderLib();}}
  },true);
  $('lib').addEventListener('keydown',function(e){if(LIB_SELECT&&(e.key===' '||e.key==='Enter')&&e.target.matches('.card')){e.preventDefault();e.stopImmediatePropagation();var id=e.target.dataset.id;if(SEL[id])delete SEL[id];else SEL[id]=1;EXP.del=false;renderLib();}},true);

  function syncMotionTrigger(){
    var select=$('poseSelect'),button=$('motionTrigger');if(!select||!button)return;
    var option=select.options[select.selectedIndex],label=option?option.textContent:'Chọn động tác';
    button.querySelector('.motion-current').textContent=label;button.setAttribute('aria-label','Chọn động tác: '+label);button.title=label;
  }
  function motionRows(){
    var select=$('poseSelect');return Array.prototype.map.call(select.options,function(o){return {id:o.value,name:o.textContent,group:o.parentElement.label||'Tuỳ chỉnh'};}).filter(function(x){return x.id!=='g_custom';});
  }
  function placeMotionPicker(){
    var box=$('motionPicker'),trigger=$('motionTrigger');if(!box||!trigger)return;
    var r=trigger.getBoundingClientRect(),above=r.top-16,below=innerHeight-r.bottom-16,up=above>=below,space=Math.max(100,up?above:below),width=Math.min(368,innerWidth-24);
    box.style.width=width+'px';box.style.maxHeight=Math.min(500,space)+'px';
    box.style.left=Math.max(12,Math.min(innerWidth-width-12,r.left+(r.width-width)/2))+'px';
    var height=box.getBoundingClientRect().height;box.style.top=Math.max(8,Math.min(innerHeight-height-8,up?r.top-height-10:r.bottom+10))+'px';
  }
  function closeMotionPicker(focus){var box=$('motionPicker');if(box)box.remove();var trigger=$('motionTrigger');if(trigger){trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus({preventScroll:true});}}
  function applyMotion(id){
    closeMotionPicker(false);var select=$('poseSelect');if(!select)return;
    if(id!=='g_custom'){var recent=(pref('recentMotions')||[]).filter(function(x){return x!==id;});recent.unshift(id);pref('recentMotions',recent.slice(0,5));}
    select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));if(id!=='g_custom')$('motionTrigger').focus({preventScroll:true});
  }
  function renderMotionResults(){
    var input=$('motionSearch'),list=$('motionList');if(!input||!list)return;
    var q=norm(input.value),rows=motionRows().filter(function(x){return (MOTION_GROUP==='all'||x.group===MOTION_GROUP)&&(!q||norm(x.name+' '+x.group).indexOf(q)>=0);}),selected=$('poseSelect').value;
    MOTION_ACTIVE=Math.max(0,Math.min(MOTION_ACTIVE,rows.length-1));
    var group='',h='';rows.forEach(function(x,i){if(x.group!==group){group=x.group;h+='<div class="motion-section" aria-hidden="true">'+esc(group)+'</div>';}
      h+='<button type="button" id="motion-option-'+i+'" role="option" tabindex="-1" data-motion-id="'+esc(x.id)+'" aria-selected="'+(selected===x.id)+'" class="motion-option'+(i===MOTION_ACTIVE?' focused':'')+'"><span>'+esc(x.name)+'</span>'+(selected===x.id?ic('check'):'')+'</button>';});
    list.innerHTML=h||'<div class="motion-empty">Không tìm thấy động tác.<br><span>Thử từ khoá khác hoặc chọn Tất cả.</span></div>';
    if(rows.length)input.setAttribute('aria-activedescendant','motion-option-'+MOTION_ACTIVE);else input.removeAttribute('aria-activedescendant');
    $('motionResultCount').textContent=rows.length+' động tác';
    var recents=$('motionRecents'),history=pref('recentMotions')||[];
    var recentRows=history.map(function(id){return motionRows().filter(function(x){return x.id===id;})[0];}).filter(Boolean).slice(0,3);
    recents.innerHTML=!q&&MOTION_GROUP==='all'&&recentRows.length?'<span>Gần dùng</span><div>'+recentRows.map(function(x){return '<button type="button" data-motion-id="'+esc(x.id)+'">'+esc(x.name)+'</button>';}).join('')+'</div>':'';
    recents.hidden=!recents.innerHTML;placeMotionPicker();
  }
  function openMotionPicker(){
    if($('motionPicker')){closeMotionPicker(true);return;}closePop();MOTION_GROUP='all';MOTION_ACTIVE=Math.max(0,motionRows().map(function(x){return x.id;}).indexOf($('poseSelect').value));
    var box=document.createElement('div');box.id='motionPicker';box.className='motion-picker';box.setAttribute('role','dialog');box.setAttribute('aria-label','Chọn động tác');
    box.innerHTML='<div class="motion-search-row">'+ic('search')+'<input id="motionSearch" type="search" placeholder="Tìm động tác…" aria-label="Tìm động tác" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="motionList" aria-autocomplete="list"><button type="button" class="motion-close" aria-label="Đóng bảng động tác">'+ic('x')+'</button></div><div class="motion-groups" role="group" aria-label="Nhóm động tác">'+['all','Cơ bản','Giao tiếp','Cảm xúc','Tạo dáng','Đã lưu'].filter(function(g){return g!=='Đã lưu'||(pref('posesV2')||[]).length;}).map(function(g){return '<button type="button" data-motion-group="'+g+'" aria-pressed="'+(g==='all')+'">'+(g==='all'?'Tất cả':g)+'</button>';}).join('')+'</div><div id="motionRecents" class="motion-recent" hidden></div><div id="motionList" class="motion-list" role="listbox" aria-label="Danh sách động tác"></div><div class="motion-picker-footer"><button type="button" data-motion-id="g_custom">'+ic('plus')+'Tạo động tác</button><span id="motionResultCount" role="status" aria-live="polite"></span></div>';
    $('layer').appendChild(box);$('motionTrigger').setAttribute('aria-expanded','true');renderMotionResults();$('motionSearch').focus({preventScroll:true});
    box.addEventListener('input',function(e){if(e.target.id==='motionSearch'){MOTION_ACTIVE=0;renderMotionResults();}});
    box.addEventListener('click',function(e){var b=e.target.closest('[data-motion-id],[data-motion-group],.motion-close');if(!b)return;
      if(b.hasAttribute('data-motion-id'))applyMotion(b.dataset.motionId);
      else if(b.hasAttribute('data-motion-group')){MOTION_GROUP=b.dataset.motionGroup;MOTION_ACTIVE=0;Array.prototype.forEach.call(box.querySelectorAll('[data-motion-group]'),function(x){x.setAttribute('aria-pressed',String(x===b));});renderMotionResults();$('motionSearch').focus({preventScroll:true});}
      else closeMotionPicker(true);
    });
    box.addEventListener('keydown',function(e){
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMotionPicker(true);return;}
      var options=box.querySelectorAll('.motion-option');if((e.key==='ArrowDown'||e.key==='ArrowUp')&&options.length){e.preventDefault();MOTION_ACTIVE=(MOTION_ACTIVE+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;Array.prototype.forEach.call(options,function(o,i){o.classList.toggle('focused',i===MOTION_ACTIVE);});$('motionSearch').setAttribute('aria-activedescendant',options[MOTION_ACTIVE].id);options[MOTION_ACTIVE].scrollIntoView({block:'nearest'});}
      else if(e.key==='Enter'&&e.target.id==='motionSearch'&&options.length){e.preventDefault();applyMotion(options[MOTION_ACTIVE].dataset.motionId);}
    });
    box.addEventListener('focusout',function(){setTimeout(function(){var current=$('motionPicker');if(current&&!current.contains(document.activeElement)&&document.activeElement!==$('motionTrigger'))closeMotionPicker(false);},0);});
  }
  $('mid').addEventListener('click',function(e){if(e.target.closest('#motionTrigger'))openMotionPicker();});
  document.addEventListener('pointerdown',function(e){var box=$('motionPicker');if(box&&!box.contains(e.target)&&!e.target.closest('#motionTrigger'))closeMotionPicker(false);});
  window.addEventListener('resize',function(){closeMotionPicker(false);});
