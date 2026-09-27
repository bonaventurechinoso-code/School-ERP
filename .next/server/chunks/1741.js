"use strict";exports.id=1741,exports.ids=[1741],exports.modules={11741:(e,s,a)=>{a.d(s,{qZ:()=>o,c_:()=>i,Z7:()=>n,tN:()=>u,Qc:()=>d});var t=a(68939),r=a(1080);function d(e){if(!e||"string"!=typeof e)return{valid:!1,error:"Password is required."};if(e.length<8)return{valid:!1,error:"Password must be at least 8 characters long."};if(e.length>128)return{valid:!1,error:"Password cannot exceed 128 characters."};let s=/[A-Z]/.test(e),a=/[0-9]/.test(e),t=/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(e);return s?a?t?{valid:!0}:{valid:!1,error:"Password must contain at least 1 special character (e.g., !@#$%^&*)."}:{valid:!1,error:"Password must contain at least 1 numeric digit."}:{valid:!1,error:"Password must contain at least 1 uppercase letter."}}async function i(e){return r.ZP.hash(e,12)}async function o(){try{await t.ZZ.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS bonavee_password_resets (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        email TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_type TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `),await t.ZZ.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS bonavee_user_security (
        user_id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        must_change_password BOOLEAN DEFAULT FALSE,
        is_temporary_password BOOLEAN DEFAULT FALSE,
        password_updated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)}catch(e){}}async function n(e){try{let s=await t.ZZ.user.findFirst({where:{OR:[{id:e},{staff:{id:e}},{student:{id:e}}]},select:{mustChangePassword:!0}});if(s?.mustChangePassword)return!0;await o();let a=await t.ZZ.$queryRawUnsafe("SELECT must_change_password, is_temporary_password FROM bonavee_user_security WHERE user_id = $1 LIMIT 1",e);if(a&&a.length>0)return!!(a[0].must_change_password||a[0].is_temporary_password)}catch{}return!1}async function u(e,s,a){try{await t.ZZ.user.updateMany({where:{OR:[{id:e},{staff:{id:e}},{student:{id:e}}]},data:{mustChangePassword:a,updatedAt:new Date}}),await o(),await t.ZZ.$executeRawUnsafe(`
      INSERT INTO bonavee_user_security (user_id, school_id, must_change_password, is_temporary_password, password_updated_at)
      VALUES ($1, $2, $3, $3, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET must_change_password = $3, is_temporary_password = $3;
    `,e,s,a)}catch(e){console.error("[SECURITY_SERVICE] Error setting user must_change_password:",e)}}a(6113)}};