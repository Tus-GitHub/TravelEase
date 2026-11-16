import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanGeographyName,geographyKey,matchingState,matchingCity} from '../../src/lib/geography.ts';
test('names normalize whitespace/case without treating different parents as one place',()=>{assert.equal(cleanGeographyName('  North\t India  '),'North India');assert.equal(geographyKey(' NORTH\n India '),'north india');});
test('automatic state selection keeps an exact current match but does not guess across regions',()=>{const states=[{id:1,name:'Uttarakhand'},{id:2,name:'Uttarakhand'},{id:3,name:'Punjab'}];assert.equal(matchingState(states,'Punjab',''),'3');assert.equal(matchingState(states,'Uttarakhand',''),'');assert.equal(matchingState(states,'Uttarakhand','2'),'2');assert.equal(matchingState(states,'Unknown','1'),'');});
test('spot city matching uses state as well as name and rejects ambiguous names',()=>{const cities=[{id:1,name:'Same city',stateName:'Punjab'},{id:2,name:'Same city',stateName:'Haryana'}];assert.equal(matchingCity(cities,'Same city','Haryana',''),'2');assert.equal(matchingCity(cities,'Same city',undefined,''),'');assert.equal(matchingCity(cities,'Same city','Haryana','1'),'2');});
