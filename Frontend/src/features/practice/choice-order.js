// Presentation only: stored answers always retain their text identity.
export function shuffleChoices(options, random = Math.random) {
 const result = [...options];
 for (let i=result.length-1; i>0; i--) {
  const j=Math.floor(random()*(i+1));
  [result[i],result[j]]=[result[j],result[i]];
 }
 return result;
}
