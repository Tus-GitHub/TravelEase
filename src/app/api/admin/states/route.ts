import {NextResponse} from "next/server";
import {requireRole} from "@/lib/server/auth-guard";
import {dbErrorResponse} from "@/lib/server/api-errors";
import {createState,listStates} from "@/lib/server/admin/geography";
import {cleanGeographyName} from "@/lib/geography";
import {readBoundedJsonObject} from "@/lib/server/http-json";
export async function GET(){const auth=await requireRole("admin");if(!auth.ok)return auth.response;return NextResponse.json({items:await listStates()});}
export async function POST(request:Request){
 const auth=await requireRole("admin");if(!auth.ok)return auth.response;
 let body:Record<string,unknown>;try{body=await readBoundedJsonObject(request.body,8192);}catch{return NextResponse.json({error:"Invalid request body."},{status:400});}
 const name=typeof body.name==="string"?cleanGeographyName(body.name):"",regionId=Number(body.regionId);
 if(name.length<2||name.length>100||!Number.isSafeInteger(regionId)||regionId<1)return NextResponse.json({error:"Choose a region and enter a state name (2–100 characters)."},{status:400});
 try{return NextResponse.json({item:await createState({name,regionId},auth.user.id)},{status:201});}
 catch(error){const response=dbErrorResponse(error,{fk:"Choose an existing region.",unique:"That state already exists in this region."});if(response)return response;throw error;}
}
