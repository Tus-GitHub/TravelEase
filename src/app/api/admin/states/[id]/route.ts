import {NextResponse} from "next/server";
import {requireRole} from "@/lib/server/auth-guard";
import {dbErrorResponse} from "@/lib/server/api-errors";
import {deleteState,updateState,type StateInput} from "@/lib/server/admin/geography";
import {cleanGeographyName} from "@/lib/geography";
import {readBoundedJsonObject} from "@/lib/server/http-json";
export async function PATCH(request:Request,{params}:{params:{id:string}}){
 const auth=await requireRole("admin");if(!auth.ok)return auth.response;const id=Number(params.id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:"Invalid state."},{status:400});
 let body:Record<string,unknown>;try{body=await readBoundedJsonObject(request.body,8192);}catch{return NextResponse.json({error:"Invalid request body."},{status:400});}
 const input:Partial<StateInput>={};
 if(body.name!==undefined){if(typeof body.name!=="string")return NextResponse.json({error:"Invalid state name."},{status:400});input.name=cleanGeographyName(body.name);if(input.name.length<2||input.name.length>100)return NextResponse.json({error:"Enter a state name (2–100 characters)."},{status:400});}
 if(body.regionId!==undefined){input.regionId=Number(body.regionId);if(!Number.isSafeInteger(input.regionId)||input.regionId<1)return NextResponse.json({error:"Choose a region."},{status:400});}
 if(typeof body.isActive==="boolean")input.isActive=body.isActive;
 try{const item=await updateState(id,input,auth.user.id);return item?NextResponse.json({item}):NextResponse.json({error:"Not found."},{status:404});}
 catch(error){const response=dbErrorResponse(error,{fk:"Choose an existing region.",unique:"That state already exists in this region."});if(response)return response;throw error;}
}
export async function DELETE(_request:Request,{params}:{params:{id:string}}){
 const auth=await requireRole("admin");if(!auth.ok)return auth.response;const id=Number(params.id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:"Invalid state."},{status:400});
 try{return await deleteState(id,auth.user.id)?NextResponse.json({ok:true}):NextResponse.json({error:"Not found."},{status:404});}catch(error){const response=dbErrorResponse(error);if(response)return response;throw error;}
}
