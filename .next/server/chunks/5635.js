"use strict";exports.id=5635,exports.ids=[5635],exports.modules={35635:(e,a,t)=>{t.d(a,{Go:()=>u,Ix:()=>p,LA:()=>m,MB:()=>g,WW:()=>E,Yl:()=>T,aB:()=>f,aW:()=>l,zs:()=>N});var n=t(68476),o=t(6113),i=t.n(o),s=t(45127);function r(e){if(!e)return"Recently";let a="string"==typeof e?new Date(e):e,t=Math.floor((new Date().getTime()-a.getTime())/1e3);if(t<45)return"Just now";let n=Math.floor(t/60);if(n<60)return`${n}m ago`;let o=Math.floor(n/60);if(o<24)return`${o}h ago`;let i=Math.floor(o/24);if(i<30)return`${i}d ago`;let s=Math.floor(i/30);return s<12?`${s}mo ago`:`${Math.floor(i/365)}y ago`}async function d(){try{await n.basePrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS platform_notifications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT DEFAULT '/admin/tenants',
        type TEXT DEFAULT 'TENANT_REGISTERED',
        read BOOLEAN DEFAULT FALSE,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `),await n.basePrisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_platform_notifications_read ON platform_notifications(read)
    `),await n.basePrisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_platform_notifications_created_at ON platform_notifications(created_at DESC)
    `)}catch(e){console.error("[NOTIFICATION_TABLE_INIT_ERROR]:",e?.message||e)}}async function c(e){try{await d();let a=i().randomUUID(),t=e.link||"/admin/tenants",o=e.type||"TENANT_REGISTERED",s=JSON.stringify(e.metadata||{});return await n.basePrisma.$executeRawUnsafe(`
      INSERT INTO platform_notifications (id, title, message, link, type, read, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, FALSE, $6::jsonb, NOW())
    `,a,e.title,e.message,t,o,s),a}catch(e){return console.error("[CREATE_NOTIFICATION_ERROR]:",e?.message||e),null}}async function l(e){let a=`New tenant registered: ${e.schoolName}`,t=`New tenant registered: ${e.schoolName} (${e.subdomain})`;await c({title:a,message:t,link:"/admin/tenants",type:"TENANT_REGISTERED",metadata:e});try{await n.basePrisma.auditLog.create({data:{actorId:"super_admin",action:"create_tenant",schoolId:e.schoolId||null,tenantId:e.schoolId||null,target:e.schoolName,metadata:e}})}catch{}}async function m(e){let a=`Tenant suspended: ${e.schoolName}`,t=`Tenant suspended: ${e.schoolName}${e.reason?` - ${e.reason}`:""}`;await c({title:a,message:t,link:"/admin/tenants",type:"TENANT_SUSPENDED",metadata:e});try{await n.basePrisma.auditLog.create({data:{actorId:"super_admin",action:"suspend_tenant",schoolId:e.schoolId||null,tenantId:e.schoolId||null,target:e.schoolName,metadata:e}})}catch{}}async function E(e){let a=`Tenant reactivated: ${e.schoolName}`,t=`Tenant reactivated: ${e.schoolName}`;await c({title:a,message:t,link:"/admin/tenants",type:"TENANT_ACTIVATED",metadata:e});try{await n.basePrisma.auditLog.create({data:{actorId:"super_admin",action:"reactivate_tenant",schoolId:e.schoolId||null,tenantId:e.schoolId||null,target:e.schoolName,metadata:e}})}catch{}}async function f(e){let a=`Tenant deleted: ${e.schoolName}`,t=`Tenant deleted: ${e.schoolName}`;await c({title:a,message:t,link:"/admin/tenants",type:"TENANT_DELETED",metadata:e});try{await n.basePrisma.auditLog.create({data:{actorId:"super_admin",action:"delete_tenant",schoolId:e.schoolId||null,tenantId:e.schoolId||null,target:e.schoolName,metadata:e}})}catch{}}async function T(e=20){try{await d();let a=await n.basePrisma.$queryRawUnsafe(`
      SELECT 
        id, 
        title, 
        message, 
        link, 
        type, 
        read, 
        metadata, 
        created_at as "createdAt"
      FROM platform_notifications
      ORDER BY created_at DESC
      LIMIT $1
    `,e),t=await n.basePrisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as count 
      FROM platform_notifications 
      WHERE read = FALSE
    `),o=Number(t?.[0]?.count||0);if(!a||0===a.length)try{for(let e of(await n.basePrisma.school.findMany({take:5,orderBy:{createdAt:"desc"},select:{id:!0,name:!0,subdomain:!0,createdAt:!0}}))){let a=i().randomUUID();await n.basePrisma.$executeRawUnsafe(`
            INSERT INTO platform_notifications (id, title, message, link, type, read, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, FALSE, $6::jsonb, $7)
            ON CONFLICT (id) DO NOTHING
          `,a,`New tenant registered: ${e.name}`,`New tenant registered: ${e.name} (${e.subdomain})`,"/admin/tenants","TENANT_REGISTERED",JSON.stringify({schoolId:e.id,schoolName:e.name,subdomain:e.subdomain}),e.createdAt)}let a=await n.basePrisma.$queryRawUnsafe(`
          SELECT 
            id, 
            title, 
            message, 
            link, 
            type, 
            read, 
            metadata, 
            created_at as "createdAt"
          FROM platform_notifications
          ORDER BY created_at DESC
          LIMIT $1
        `,e),t=await n.basePrisma.$queryRawUnsafe(`
          SELECT COUNT(*)::int as count 
          FROM platform_notifications 
          WHERE read = FALSE
        `);return{notifications:a||[],unreadCount:Number(t?.[0]?.count||0)}}catch{}return{notifications:a||[],unreadCount:o}}catch(e){return console.error("[GET_NOTIFICATIONS_ERROR]:",e?.message||e),{notifications:[],unreadCount:0}}}async function p(e){try{return await d(),await n.basePrisma.$executeRawUnsafe(`
      UPDATE platform_notifications SET read = TRUE WHERE id = $1
    `,e),!0}catch(e){return console.error("[MARK_READ_ERROR]:",e?.message||e),!1}}async function u(){try{return await d(),await n.basePrisma.$executeRawUnsafe(`
      UPDATE platform_notifications SET read = TRUE WHERE read = FALSE
    `),!0}catch(e){return console.error("[MARK_ALL_READ_ERROR]:",e?.message||e),!1}}async function N(e=10){try{await d();let a=await n.basePrisma.$queryRawUnsafe(`
      SELECT 
        id, 
        title, 
        message, 
        type, 
        metadata, 
        created_at as "createdAt"
      FROM platform_notifications
      WHERE type IN ('TENANT_REGISTERED', 'TENANT_SUSPENDED', 'TENANT_ACTIVATED', 'TENANT_DELETED')
      ORDER BY created_at DESC
      LIMIT $1
    `,e),t=[];if(a&&a.length>0)for(let e of a){let a="CREATED";"TENANT_SUSPENDED"===e.type?a="SUSPENDED":"TENANT_ACTIVATED"===e.type?a="ACTIVATED":"TENANT_DELETED"===e.type&&(a="DELETED");let n="string"==typeof e.metadata?JSON.parse(e.metadata||"{}"):e.metadata||{},o=n.schoolName||e.title.replace(/^New tenant registered:\s*|^Tenant suspended:\s*|^Tenant reactivated:\s*|^Tenant deleted:\s*/i,"");t.push({id:e.id,type:a,title:e.title,description:e.message,schoolName:o||"Institution",subdomain:n.subdomain,timestamp:e.createdAt,timeAgo:r(e.createdAt)})}if(t.length<e)try{for(let a of(await n.basePrisma.auditLog.findMany({where:{action:{in:["create_tenant","suspend_tenant","reactivate_tenant","delete_tenant"]}},take:e,orderBy:{createdAt:"desc"}}))){if(t.some(e=>e.id===a.id))continue;let e="CREATED",n="Tenant Created";a.action.includes("suspend")?(e="SUSPENDED",n="Tenant Suspended"):a.action.includes("reactivate")?(e="ACTIVATED",n="Tenant Reactivated"):a.action.includes("delete")&&(e="DELETED",n="Tenant Deleted");let o=a.metadata||{},i=o.schoolName||a.target||"Institutional Tenant";t.push({id:a.id,type:e,title:`${n}: ${i}`,description:`${n}: ${i}${o.subdomain?` (${o.subdomain})`:""}`,schoolName:i,subdomain:o.subdomain,timestamp:a.createdAt,timeAgo:r(a.createdAt)})}}catch{}if(t.length<e)try{for(let a of(await n.basePrisma.school.findMany({take:e,orderBy:{createdAt:"desc"}})))t.some(e=>e.schoolName===a.name||e.subdomain===a.subdomain)||t.push({id:`sch-${a.id}`,type:a.isActive?"CREATED":"SUSPENDED",title:a.isActive?`Tenant Registered: ${a.name}`:`Tenant Suspended: ${a.name}`,description:a.isActive?`Tenant registered: ${a.name} (${a.subdomain})`:`Tenant is currently suspended: ${a.name}`,schoolName:a.name,subdomain:a.subdomain,timestamp:a.createdAt,timeAgo:r(a.createdAt)})}catch{}return t.sort((e,a)=>new Date(a.timestamp).getTime()-new Date(e.timestamp).getTime()),t.slice(0,e)}catch(e){return console.error("[GET_TIMELINE_ERROR]:",e?.message||e),[]}}async function g(e){if(!(process.env.SMTP_HOST&&process.env.SMTP_USER))return console.log(`[SUPER_ADMIN_EMAIL] SMTP not configured (SMTP_HOST/SMTP_USER missing). Skipped email delivery for new tenant: "${e.schoolName}".`),{delivered:!1,mode:"SKIPPED_NOT_CONFIGURED"};let a=process.env.SUPER_ADMIN_EMAIL||process.env.ADMIN_EMAIL||"admin@bonaveeict.com.ng",t="https://bonaveeict.com.ng".replace(/\/$/,""),n=`${t}/admin/tenants`,o=`${t}/${e.subdomain}`,i=Array.isArray(e.tiers)&&e.tiers.length>0?e.tiers.join(", "):"Standard Tier",r=new Date().toLocaleString("en-US",{dateStyle:"full",timeStyle:"short"}),d=`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>New Tenant Registered</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 24px 32px; text-align: left; }
    .badge { display: inline-block; background: #3b82f6; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; margin-bottom: 8px; letter-spacing: 0.05em; }
    .title { font-size: 22px; font-weight: 800; margin: 0; }
    .content { padding: 32px; }
    .field-row { margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
    .label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
    .value { font-size: 15px; font-weight: 600; color: #0f172a; }
    .subdomain-tag { font-family: monospace; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 6px; font-size: 13px; font-weight: 700; }
    .btn { display: inline-block; background: #0f172a; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 10px; margin-top: 20px; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">Super-Admin Alert</span>
      <h1 class="title">New Tenant Provisioned</h1>
    </div>
    <div class="content">
      <p style="font-size: 14px; color: #475569; margin-top: 0; margin-bottom: 24px;">
        A new institutional tenant has registered and completed automated provisioning on the School ERP platform.
      </p>

      <div class="field-row">
        <div class="label">School Name</div>
        <div class="value">${e.schoolName}</div>
      </div>

      <div class="field-row">
        <div class="label">Subdomain Slug</div>
        <div class="value"><span class="subdomain-tag">${e.subdomain}</span> &bull; <a href="${o}" style="color: #4f46e5; text-decoration: none; font-size: 13px;">${e.subdomain}.bonaveeict.com.ng</a></div>
      </div>

      <div class="field-row">
        <div class="label">Primary Administrator Email</div>
        <div class="value">${e.adminEmail}</div>
      </div>

      ${e.contactPhone?`
      <div class="field-row">
        <div class="label">Contact Phone</div>
        <div class="value">${e.contactPhone}</div>
      </div>`:""}

      <div class="field-row">
        <div class="label">Academic Tiers</div>
        <div class="value">${i}</div>
      </div>

      <div class="field-row">
        <div class="label">Registered At</div>
        <div class="value">${r}</div>
      </div>

      <a href="${n}" class="btn">Open Super-Admin Console &rarr;</a>
    </div>
    <div class="footer">
      Automated dispatch from School ERP Platform Notification Service &bull; BonaVee ICT
    </div>
  </div>
</body>
</html>
  `;try{console.log(`[SUPER_ADMIN_EMAIL] Attempting SMTP dispatch to ${a} via ${process.env.SMTP_HOST}...`);let t=s.default.createTransport({host:process.env.SMTP_HOST,port:parseInt(process.env.SMTP_PORT||"587"),secure:"true"===process.env.SMTP_SECURE||"465"===process.env.SMTP_PORT,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS||process.env.SMTP_PASSWORD}}),n=await t.sendMail({from:process.env.EMAIL_FROM||process.env.SMTP_USER||"School ERP Platform <noreply@bonaveeict.com.ng>",to:a,subject:`[New Tenant] ${e.schoolName} (${e.subdomain})`,html:d});return console.log(`[SUPER_ADMIN_EMAIL] Successfully sent notification to ${a}:`,n.messageId),{delivered:!0,mode:`SMTP (${n.messageId})`}}catch(e){return console.error("[SUPER_ADMIN_EMAIL_EXCEPTION]:",e?.message||e),{delivered:!1,mode:"FAILED"}}}}};