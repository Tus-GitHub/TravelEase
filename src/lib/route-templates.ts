import {validateRouteTree, type RouteTree} from './package-content';
import {TripError} from './weekend-trips';
export interface SuggestedNode {spotId:number;next:number[];canFinish:boolean}
export interface SuggestedTree {roots:number[];nodes:SuggestedNode[]}
export interface RoutePlace {id:number;name:string;cityName:string;imageUrl:string}
export interface RouteTemplate {id:number;regionId:number;name:string;slug:string;tree:SuggestedTree;version:number;isActive:boolean;places:RoutePlace[]}
export function expandedSuggestionTree(tree:SuggestedTree):RouteTree{return {...tree,nodes:tree.nodes.map(node=>({...node,nights:0,extraPricePerPerson:0,description:'',meals:{breakfast:0,lunch:0,dinner:0}}))};}
/** Reuse proven DAG/size checks; suggestion records carry no commercial fields. */
export function validateSuggestionTree(value:unknown,allowIncomplete=false):SuggestedTree{
 if(!value||typeof value!=='object')throw new TripError('Add a route and its destinations.');
 const data=value as SuggestedTree;
 if(!Array.isArray(data.roots)||!Array.isArray(data.nodes)||data.nodes.length>32)throw new TripError('Use at most 32 destinations.');
 const nodes=data.nodes.map(node=>{if(!node||typeof node!=='object'||!Number.isSafeInteger(node.spotId)||node.spotId<1||node.spotId>2147483647||!Array.isArray(node.next)||node.next.length>8||node.next.some(id=>!Number.isSafeInteger(id)||id<1||id>2147483647)||new Set(node.next).size!==node.next.length||typeof node.canFinish!=='boolean')throw new TripError('Choose valid destinations and connections.');return {spotId:node.spotId,next:[...node.next],canFinish:node.canFinish};});
 const tree={roots:[...data.roots],nodes};
 if(allowIncomplete){if(new Set(nodes.map(n=>n.spotId)).size!==nodes.length||tree.roots.length>8||tree.roots.some(id=>!Number.isSafeInteger(id)||!nodes.some(n=>n.spotId===id))||new Set(tree.roots).size!==tree.roots.length||nodes.some(n=>n.next.some(id=>!nodes.some(next=>next.spotId===id))))throw new TripError('Remove duplicate or missing destinations.');}
 else validateRouteTree(expandedSuggestionTree(tree));
 return tree;
}
export function suggestionPath(tree:SuggestedTree,value:unknown):SuggestedNode[]{
 if(!Array.isArray(value)||!value.length||value.length>32||value.some(id=>!Number.isSafeInteger(id))||new Set(value).size!==value.length)throw new TripError('Choose your route again.');
 const byId=new Map(tree.nodes.map(node=>[node.spotId,node]));
 if(!tree.roots.includes(value[0]))throw new TripError('Choose an available starting point.');
 return value.map((id,i)=>{const node=byId.get(id);if(!node||(i&&!byId.get(value[i-1])?.next.includes(id)))throw new TripError('This connection changed. Review your route before sending.');return node;});
}
