import {useMemo} from 'react';
import {shuffleChoices} from './choice-order.js';
export function useChoiceOrder(identity, options, enabled = true) {
 const serialized = JSON.stringify(options || []);
 return useMemo(() => enabled ? shuffleChoices(JSON.parse(serialized)) : JSON.parse(serialized), [identity, serialized, enabled]);
}
