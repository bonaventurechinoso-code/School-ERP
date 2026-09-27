"use strict";exports.id=1741,exports.ids=[1741],exports.modules={11741:(s,e,a)=>{a.d(e,{Z7:()=>T,tN:()=>d});var t=a(68939);async function r(){try{await t.ZZ.$executeRawUnsafe(`
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
    `)}catch(s){}}async function T(s){try{let e=await t.ZZ.user.findFirst({where:{OR:[{id:s},{staff:{id:s}},{student:{id:s}}]},select:{mustChangePassword:!0}});if(e?.mustChangePassword)return!0;await r();let a=await t.ZZ.$queryRawUnsafe("SELECT must_change_password, is_temporary_password FROM bonavee_user_security WHERE user_id = $1 LIMIT 1",s);if(a&&a.length>0)return!!(a[0].must_change_password||a[0].is_temporary_password)}catch{}return!1}async function d(s,e,a){try{await t.ZZ.user.updateMany({where:{OR:[{id:s},{staff:{id:s}},{student:{id:s}}]},data:{mustChangePassword:a,updatedAt:new Date}}),await r(),await t.ZZ.$executeRawUnsafe(`
      INSERT INTO bonavee_user_security (user_id, school_id, must_change_password, is_temporary_password, password_updated_at)
      VALUES ($1, $2, $3, $3, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET must_change_password = $3, is_temporary_password = $3;
    `,s,e,a)}catch(s){console.error("[SECURITY_SERVICE] Error setting user must_change_password:",s)}}a(1080),a(6113)}};