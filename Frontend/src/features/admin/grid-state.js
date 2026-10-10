export function toggleSort(current,key,additive=false) {
 const previous=current.find(item=>item.key===key);
 const next={key,desc:previous?!previous.desc:false};
 return additive ? (previous ? current.map(item=>item.key===key?next:item) : [...current,next]) : [next];
}
export const sortQuery=sort=>sort.map(s=>(s.desc?'-':'')+s.key).join(',');
