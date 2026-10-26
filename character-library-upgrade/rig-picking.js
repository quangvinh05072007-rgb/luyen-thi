/* Semantic SVG groups only: no geometry, paint or typography changes. */
function pickableItem(item){
  var part=/^(hair|lock|bun|tie|braid)/.test(item.id)?'hairStyle':item.id==='head'?'expr':/^arm/.test(item.id)?'sleeves':/^(leg|pel|skirt|torso|aodai|outfit)/.test(item.id)?'outfit':'';
  return part?'<g data-edit-part="'+part+'">'+item.svg+'</g>':item.svg;
}
