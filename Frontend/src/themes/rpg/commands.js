export const destinations = {cards:'flashcard', practice:'practice', explore:'explore', create:'create', journey:'profile', classes:'classes', settings:'settings'};
export function parseCommand(input, lang) {
 const command = input.trim().toLowerCase().replace(/\s+/g,' ');
 if(command === 'help' || command === 'clear') return {type:command};
 const raw = command.replace(/^(open|cd) /,'');
 const key = ({flashcard:'cards',profile:'journey'})[raw] || raw;
 return Object.hasOwn(destinations,key) ? {type:'navigate', path:`/${lang}/${destinations[key]}`, label:key} : {type:'error'};
}
