import {matchesSearch} from './search.mjs';

/** Filter only the catalog already authorized by the server. Keep totals stable. */
export function filterExamCatalog(exams,{scope='all',search='',dept=''}={}) {
  const result=exams.filter(e=>(scope==='mine' ? e.mine : scope==='shared'||scope==='hot' ? e.visibility==='school' : true) && (!dept||e.dept===dept) && matchesSearch(`${e.title} ${e.author ?? ''}`,search));
  return scope==='hot' ? result.sort((a,b)=>b.hot-a.hot||b.createdAt-a.createdAt).slice(0,20) : result;
}
