export const cleanGeographyName = (value: string) => value.trim().replace(/\s+/g, " ");
export const geographyKey = (value: string) => cleanGeographyName(value).toLocaleLowerCase();
export function matchingState(states: {id:number;name:string}[], state: string | undefined, current: string): string {
  if (!state) return current;
  const found=states.filter(item=>geographyKey(item.name)===geographyKey(state));
  if (found.some(item=>String(item.id)===current)) return current;
  return found.length===1 ? String(found[0].id) : "";
}
export function matchingCity(cities: {id:number;name:string;stateName:string}[],city: string,state: string | undefined,current: string): string {
  const found=cities.filter(item=>geographyKey(item.name)===geographyKey(city)&&(!state||geographyKey(item.stateName)===geographyKey(state)));
  if(found.some(item=>String(item.id)===current)) return current;
  return found.length===1 ? String(found[0].id) : "";
}
