  /* ----- Bộ chỉnh khớp dùng cùng dữ liệu 3D với chuyển động ----- */
  var RIG_FIELDS=[
    ['lum',0,'Lưng: cúi / ngửa',-35,45],['lum',1,'Lưng: nghiêng',-30,30],['lum',2,'Lưng: xoay',-50,50],
    ['thor',0,'Ngực: cúi / ngửa',-35,45],['thor',1,'Ngực: nghiêng',-30,30],['thor',2,'Ngực: xoay',-60,60],
    ['neck',0,'Đầu: cúi / ngửa',-40,45],['neck',1,'Đầu: nghiêng',-35,35],['neck',2,'Đầu: xoay',-75,75]
  ];
  ['L','R'].forEach(function(k){var n=k==='L'?'Trái':'Phải';[['sh',0,'Vai: đưa',-60,170],['sh',1,'Vai: nâng',-20,155],['sh',2,'Vai: xoay',-100,100],['el',0,'Khuỷu',0,150],['wr',1,'Cổ tay',-65,65],['hip',0,'Hông: đưa',-50,100],['hip',1,'Hông: dạng',-10,50],['kn',0,'Gối',0,165],['an',0,'Cổ chân',-70,85]].forEach(function(f){RIG_FIELDS.push([k+'.'+f[0],f[1],n+' · '+f[2],f[3],f[4]]);});});
  function rigInit(){if(!S.rig)S.rig=RIG.pose(S,RIGTIME);}
  function rigArray(p,key){return key.split('.').reduce(function(o,k){return o[k];},p);}
  function paintRig(){
    var el=$('rigp');if(!el)return;var lib=pref('posesV2')||[],h='';
    if(RIGED){rigInit();h='<span class="rh">Chỉnh góc xoay, áp dụng ở mọi góc nhìn. Nhấn Xong để trở lại chuyển động.</span><div class="rig-fields">';
      RIG_FIELDS.forEach(function(f,i){var v=Math.round(rigArray(S.rig,f[0])[f[1]]);h+='<label>'+f[2]+' <output id="rout'+i+'">'+v+'°</output><input type="range" data-rig-field="'+i+'" min="'+f[3]+'" max="'+f[4]+'" value="'+v+'" aria-label="'+f[2]+'"></label>';});
      h+='</div>';
      ['L','R'].forEach(function(k){h+='<label>Bàn tay '+(k==='L'?'trái':'phải')+' <select data-v2-hand="'+k+'">'+[['rl','Thả lỏng'],['cv','Khum'],['wv','Xoè vẫy'],['cl','Khép'],['rc','Xoè rộng'],['fist','Nắm tay'],['point','Chỉ tay'],['peace','Chữ V']].map(function(a){return '<option value="'+a[0]+'"'+(S.rig[k].hand===a[0]?' selected':'')+'>'+a[1]+'</option>';}).join('')+'</select></label>';});
      h+='<input type="text" id="rigName" placeholder="Tên động tác" maxlength="40" aria-label="Tên động tác"><button type="button" class="rc" data-rig="save">Lưu động tác</button><button type="button" class="rc" data-rig="reset">Đặt lại</button><button type="button" class="rc" data-rig="json">Chép JSON</button>';
    }
    if(lib.length)h+='<span class="rh">Động tác đã lưu:</span>'+lib.map(function(x){return '<span class="rl"><button class="rc" type="button" data-lib="'+x.id+'">'+esc(x.n)+'</button><button class="rc rx" type="button" data-libdel="'+x.id+'" aria-label="Xoá '+esc(x.n)+'">×</button></span>';}).join('');
    el.innerHTML=h;var tg=document.querySelector('[data-rig="tg"]');if(tg){tg.setAttribute('aria-pressed',String(RIGED));tg.textContent=RIGED?'Xong':'Chỉnh khớp';}paintPoseSelect();
  }
  $('edit').addEventListener('click',function(e){var b=e.target.closest('[data-rig],[data-lib],[data-libdel]');if(!b)return;
    if(b.dataset.rig){var a=b.dataset.rig;if(a==='tg'){RIGED=!RIGED;if(RIGED){S.rig=RIG.pose(S,RIGTIME);S.armPose='auto';S.handL='auto';S.handR='auto';S.pose='g_custom';CAMM='full';ZOOM=1;}CT=camTarget();change({nopanel:true});return;}
      if(a==='reset'){S.rig=RIG.pose({pose:'idle'},0);S.pose='g_custom';change({nopanel:true});}
      if(a==='save'){rigInit();var lib=(pref('posesV2')||[]).slice(),nm=$('rigName').value.trim()||'Động tác '+(lib.length+1);lib.push({id:uid_(),n:nm,rig:clone(S.rig)});pref('posesV2',lib);paintRig();toast('Đã lưu động tác');}
      if(a==='json'){rigInit();var txt=JSON.stringify(S.rig,null,2);modal('Động tác nữ v2 · JSON',txt,[['cp','Chép',true]],function(){copyText(txt,$('mm'));});}return;}
    if(b.dataset.lib){var it=(pref('posesV2')||[]).filter(function(x){return x.id===b.dataset.lib;})[0];if(it){S.rig=clone(it.rig);S.pose='g_custom';change({nopanel:true});}}
    if(b.dataset.libdel){pref('posesV2',(pref('posesV2')||[]).filter(function(x){return x.id!==b.dataset.libdel;}));paintRig();}
  });
  $('edit').addEventListener('input',function(e){var el=e.target;if(el.dataset.rigField===undefined)return;rigInit();var i=+el.dataset.rigField,f=RIG_FIELDS[i];rigArray(S.rig,f[0])[f[1]]=+el.value;S.pose='g_custom';$('rout'+i).textContent=el.value+'°';touch();renderStage();});
  $('edit').addEventListener('change',function(e){var el=e.target;if(el.dataset.v2Hand){rigInit();S.rig[el.dataset.v2Hand].hand=el.value;S['hand'+el.dataset.v2Hand]='auto';S.pose='g_custom';change({nopanel:true});}else if(el.dataset.rigField!==undefined)snap();});
