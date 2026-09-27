"use strict";exports.id=7639,exports.ids=[7639],exports.modules={15821:(e,a,t)=>{t.d(a,{v:()=>s});var o=t(82361),i=t(44641);class n extends o.EventEmitter{constructor(){super(),this.dispatchedEventsCache=new Map,this.CACHE_TTL_MS=6e5,this.setMaxListeners(50),this.setupListeners()}static getInstance(){return n.instance||(globalThis.__admissionsEventManager?n.instance=globalThis.__admissionsEventManager:(n.instance=new n,globalThis.__admissionsEventManager=n.instance)),n.instance}setupListeners(){this.on("lead.inquiry",e=>{setImmediate(async()=>{try{await (0,i.LV)({lead:e.lead,leadId:e.leadId,school:e.school,schoolId:e.schoolId})}catch(e){console.error("[ADMISSIONS_EVENT_MANAGER] Error processing inquiry email event:",e)}})})}triggerInquiryNotification(e){let{leadId:a,schoolId:t,lead:o,school:i,force:n}=e;if(!a)return;let r=`inquiry:${a}`,s=Date.now();if(!(!n&&this.dispatchedEventsCache.has(r)&&s-(this.dispatchedEventsCache.get(r)||0)<this.CACHE_TTL_MS)){if(this.dispatchedEventsCache.set(r,s),this.dispatchedEventsCache.size>2e3)for(let[e,a]of this.dispatchedEventsCache.entries())s-a>this.CACHE_TTL_MS&&this.dispatchedEventsCache.delete(e);this.emit("lead.inquiry",{leadId:a,schoolId:t,lead:o,school:i})}}}let r=n.getInstance();function s(e){r.triggerInquiryNotification(e)}},44641:(e,a,t)=>{t.d(a,{$4:()=>d,Fq:()=>c,LV:()=>l,kx:()=>p,nh:()=>f});var o=t(68939),i=t(57147),n=t.n(i),r=t(71017),s=t.n(r);async function l(e){try{let a=e.lead,t=e.school;if(!a&&e.leadId&&(a=await o.ZZ.admissionLead.findUnique({where:{id:e.leadId},include:{tier:!0}})),!a)return console.warn("[EMAIL_SERVICE] Cannot send inquiry acknowledgment: Lead not found.",e),null;let i=a.schoolId||e.schoolId;!t&&i&&(t=await o.ZZ.school.findUnique({where:{id:i}}));let r=t?.name||"Udoka International School",l=t?.subdomain||"udoka",d=t?.branding?.primaryColor||"#312e81",c="#4338ca",p="https://bonaveeict.com.ng".replace(/\/$/,""),f=a.uploadToken,g=a.uploadExpiresAt&&new Date(a.uploadExpiresAt)<new Date;if(!f||g){f=crypto.randomUUID();let e=new Date;e.setDate(e.getDate()+30);try{await o.ZZ.admissionLead.update({where:{id:a.id},data:{uploadToken:f,uploadExpiresAt:e}}),a.uploadToken=f,a.uploadExpiresAt=e}catch(e){console.warn("[EMAIL_SERVICE] Warning: Could not persist uploadToken to DB:",e)}}let m=`${p}/${l}/admissions/upload/${a.id}?token=${f}`,u=a.parentName||"Parent / Guardian",h=a.parentEmail||a.studentEmail||(a.parentContact?.includes("@")?a.parentContact:null),b=h||`${u} (No registered email - simulated dispatch)`,x=(a.id||"INQ").split("-")[0].toUpperCase(),y=a.applicantName||"Applicant",v=a.targetGrade||"Unspecified Grade",E=a.tier?.name||"Standard Tier",w=E.toUpperCase().includes("NURSERY")||E.toUpperCase().includes("PRIMARY")||E.toUpperCase().includes("DAYCARE"),I=`<inquiry-ack-${Date.now()}-${Math.random().toString(36).slice(2,8)}@${l}.internal>`,T=`Application Inquiry Acknowledged & Required Credentials - ${r}`,$=`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${T}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 30px 15px;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 620px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, ${d} 0%, ${c} 100%);
      padding: 36px 32px;
      text-align: center;
      color: #ffffff;
    }
    .badge {
      display: inline-block;
      background-color: rgba(255, 255, 255, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 5px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .header h1 {
      margin: 0 0 6px 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .header p {
      margin: 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .body {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .intro-text {
      font-size: 15px;
      line-height: 1.65;
      color: #334155;
      margin-bottom: 24px;
    }
    .info-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 28px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dashed #e2e8f0;
      font-size: 14px;
    }
    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .info-label {
      color: #64748b;
      font-weight: 500;
    }
    .info-value {
      color: #0f172a;
      font-weight: 700;
      text-align: right;
    }
    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 28px 0 14px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .credentials-container {
      margin-bottom: 28px;
    }
    .credential-item {
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 4px solid ${d};
      border-radius: 8px;
      padding: 16px 18px;
      margin-bottom: 12px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }
    .credential-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .credential-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .credential-tag {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 6px;
      background-color: #eff6ff;
      color: #2563eb;
      border: 1px solid #dbeafe;
    }
    .credential-tag-special {
      background-color: #fef3c7;
      color: #d97706;
      border: 1px solid #fde68a;
    }
    .credential-desc {
      font-size: 13px;
      line-height: 1.5;
      color: #475569;
      margin: 0;
    }
    .action-box {
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 32px 0 20px 0;
    }
    .action-box p {
      margin: 0 0 16px 0;
      font-size: 14px;
      color: #334155;
      font-weight: 500;
    }
    .btn {
      display: inline-block;
      background-color: ${d};
      color: #ffffff !important;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      padding: 13px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 32px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.6;
    }
    .footer a {
      color: #64748b;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">Admissions Registry</div>
      <h1>${r}</h1>
      <p>Official Admission & Application Intake Notice</p>
    </div>

    <div class="body">
      <h2 class="greeting">Dear ${u},</h2>
      <p class="intro-text">
        Thank you for your interest in <strong>${r}</strong>. We are pleased to formally acknowledge that your admission inquiry for <strong>${y}</strong> has been received and enrolled in our active admissions pipeline.
      </p>

      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Application Reference:</span>
          <span class="info-value">#${x}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Applicant Name:</span>
          <span class="info-value">${y}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Target Grade:</span>
          <span class="info-value">${v}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Academic Tier:</span>
          <span class="info-value">${E}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Current Status:</span>
          <span class="info-value" style="color: #4338ca;">INQUIRY / INITIAL REVIEW</span>
        </div>
      </div>

      <div class="section-title">
        <span>Required Credential Documents</span>
      </div>
      <p style="font-size: 14px; color: #475569; margin: 0 0 16px 0;">
        To advance your application to the admissions review and interview stage, please prepare and submit the following required documents:
      </p>

      <div class="credentials-container">
        <div class="credential-item">
          <div class="credential-header">
            <span class="credential-title">1. Recent Passport Photograph</span>
            <span class="credential-tag">Required</span>
          </div>
          <p class="credential-desc">Clear, color passport-sized photograph of the applicant taken against a plain background within the last 6 months.</p>
        </div>

        <div class="credential-item">
          <div class="credential-header">
            <span class="credential-title">2. Scanned Copy of Previous Academic Results / Report Cards</span>
            <span class="credential-tag">Required</span>
          </div>
          <p class="credential-desc">Certified termly report cards or official academic transcripts from the most recent 1-2 years of schooling.</p>
        </div>

        <div class="credential-item">
          <div class="credential-header">
            <span class="credential-title">3. Birth Certificate or Valid ID Verification</span>
            <span class="credential-tag">Required</span>
          </div>
          <p class="credential-desc">Government-issued birth certificate, statutory declaration of age, or valid international passport biodata page.</p>
        </div>

        <div class="credential-item">
          <div class="credential-header">
            <span class="credential-title">4. Any Relevant Medical or Behavioral Records</span>
            <span class="credential-tag ${w?"credential-tag-special":""}">
              ${w?"Mandatory for Tier":"If Applicable"}
            </span>
          </div>
          <p class="credential-desc">Immunization card, medical emergency contacts, allergy profiles, or behavioral/developmental records (mandatory for Nursery and Primary tier applicants).</p>
        </div>
      </div>

      <div class="action-box">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #0f172a;">
          Upload Your Credentials Online
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.5;">
          To complete your file and advance to the interview stage, please use your dedicated secure upload portal:
        </p>
        <a href="${m}" class="btn" style="display: inline-block; font-size: 15px; font-weight: 700; padding: 15px 36px; text-decoration: none; border-radius: 10px; background-color: ${d}; color: #ffffff; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.39);">
          Upload Required Credentials &rarr;
        </a>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6; word-break: break-all;">
          <strong>Direct Secure Access Link:</strong><br />
          <a href="${m}" style="color: ${c}; font-weight: 600;">${m}</a><br />
          <span style="color: #94a3b8;">(Unique temporary link &bull; Valid for 30 days &bull; No password required)</span>
        </div>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px;">
        If you have any questions regarding these credential requirements, please do not hesitate to contact our Admissions Office at <strong>${t?.contactPhone||"+234 (0) 800-SCHOOL-ERP"}</strong>.
      </p>
    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()} ${r}. All rights reserved.<br>
      Admissions & Records Bureau &bull; Multi-Tenant Academic Management System
    </div>
  </div>
</body>
</html>
    `.trim();console.log("\n"+"=".repeat(80)),console.log("\uD83D\uDCE8 [SIMULATED EMAIL TRANSPORT - NODEMAILER / SMTP DISPATCH]"),console.log("=".repeat(80)),console.log("STATUS:       250 OK (Simulated Transport Delivered)"),console.log(`MESSAGE-ID:   ${I}`),console.log(`TIMESTAMP:    ${new Date().toISOString()}`),console.log(`TENANT:       ${r} (${l})`),console.log(`RECIPIENT:    ${u} <${b}>`),console.log(`APPLICANT:    ${y} (Target: ${v} • Tier: ${E})`),console.log(`SUBJECT:      ${T}`),console.log(`UPLOAD LINK:  ${m}`),console.log("-".repeat(80)),console.log("REQUESTED CREDENTIAL DOCUMENTS:"),console.log("  1. Recent Passport Photograph (Color photo within last 6 months)"),console.log("  2. Scanned Copy of Previous Academic Results / Report Cards (Past 1-2 years)"),console.log("  3. Birth Certificate or Valid ID Verification (Government-issued)"),console.log(`  4. Any Relevant Medical or Behavioral Records (${w?"Mandatory for Nursery/Primary":"If applicable"})`),console.log("-".repeat(80)),console.log(`PAYLOAD SIZE: ~${Math.round(Buffer.byteLength($,"utf8")/1024)} KB | FORMAT: Responsive HTML`),console.log("=".repeat(80)+"\n");try{let e=s().join(process.cwd(),"logs");n().existsSync(e)||n().mkdirSync(e,{recursive:!0});let a=s().join(e,"admissions-email-transport.log"),t=`[${new Date().toISOString()}] [250 OK] ID=${I} TO="${b}" TENANT="${r}" APPLICANT="${y}" CREDENTIALS="1.Passport, 2.Report Cards, 3.Birth Certificate, 4.Medical/Behavioral"
`;n().appendFileSync(a,t,"utf8")}catch(e){}return i&&h&&setImmediate(async()=>{try{await o.ZZ.messageLog.create({data:{schoolId:i,recipientEmail:h,recipientType:"PARENT",messageType:"EMAIL",subject:T,body:$,sentAt:new Date}})}catch(e){}}),{success:!0,messageId:I,recipient:b,tenantName:r,applicantName:y,subject:T,emailHtml:$}}catch(e){return console.error("[EMAIL_SERVICE] Failed to send inquiry acknowledgment email:",e),null}}async function d(e,a,t){let o="https://bonaveeict.com.ng".replace(/\/$/,""),i=`${o}/${a.subdomain}/admissions/accept?token=${t}`,n=a.branding?.primaryColor||"#0f172a",r=`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admission Offer - ${a.name}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background-color: ${n}; padding: 30px 40px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 40px; color: #334155; line-height: 1.6; }
        .content p { margin: 0 0 16px 0; font-size: 16px; }
        .details-box { background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${n}; }
        .details-box p { margin: 8px 0; font-size: 15px; }
        .details-box strong { color: #0f172a; }
        .action-container { text-align: center; margin: 40px 0 20px 0; }
        .button { background-color: ${n}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: opacity 0.2s; }
        .footer { padding: 20px 40px; text-align: center; color: #94a3b8; font-size: 14px; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${a.name}</h1>
        </div>
        <div class="content">
          <p>Dear ${e.parentName||"Parent/Guardian"},</p>
          <p>We are absolutely thrilled to inform you that <strong>${e.applicantName}</strong> has been offered admission to ${a.name}!</p>
          
          <div class="details-box">
            <p><strong>Applicant:</strong> ${e.applicantName}</p>
            <p><strong>Target Class:</strong> ${e.targetGrade}</p>
            <p><strong>Reference ID:</strong> ${e.id.split("-")[0].toUpperCase()}</p>
          </div>
          
          <p>To finalize enrollment and secure the placement, please review the offer details and submit your decision through our secure portal.</p>
          
          <div class="action-container">
            <a href="${i}" class="button">Review Admission Offer</a>
          </div>
          
          <p style="font-size: 14px; color: #64748b; text-align: center;">This secure link is unique to your application and will expire in 7 days.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ${a.name}. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;return console.log("----------------------------------------------------------------"),console.log(`[EMAIL DISPATCH] Mocking email send to: ${e.parentEmail||e.parentContact}`),console.log(`Subject: 🎉 Admission Offer - ${a.name}`),console.log(`Token Link: ${i}`),console.log("----------------------------------------------------------------"),r}async function c(e){try{let a=await o.ZZ.school.findUnique({where:{id:e.schoolId}}),t=a?.name||"Institution",i=a?.branding?.primaryColor||"#312e81",n=`<msg-${Date.now()}-${Math.random().toString(36).slice(2,7)}@schoolerp.internal>`,r=`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: ${i}; padding: 24px 28px; color: #ffffff; text-align: left; }
          .header h2 { margin: 0; font-size: 20px; font-weight: 700; }
          .content { padding: 28px; line-height: 1.6; }
          .subject { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .body-text { font-size: 15px; color: #334155; white-space: pre-wrap; }
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2>${t}</h2>
          </div>
          <div class="content">
            <div class="subject">${e.subject}</div>
            <div class="body-text">${e.body}</div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${t} &bull; Direct Communication Bureau
          </div>
        </div>
      </body>
      </html>
    `.trim();return console.log(`[EMAIL_DISPATCH] Sent direct message to ${e.recipientEmail} (${e.recipientType}) | Subject: ${e.subject}`),{success:!0,messageId:n,html:r}}catch(e){return console.error("[EMAIL_SERVICE] Failed to send direct communication:",e),{success:!1,error:e.message}}}async function p(e){try{let a=await o.ZZ.school.findUnique({where:{id:e.schoolId}}),t=await o.ZZ.notice.findUnique({where:{id:e.noticeId}});if(!t||!a)return{success:!1,error:"Notice or School record not found."};let i=[];("ALL"===t.targetAudience||"STAFF"===t.targetAudience)&&(await o.ZZ.staff.findMany({where:{schoolId:e.schoolId,status:{not:"TERMINATED"}},select:{email:!0}})).forEach(e=>{e.email&&!i.includes(e.email)&&i.push(e.email)}),("ALL"===t.targetAudience||"STUDENTS"===t.targetAudience)&&(await o.ZZ.student.findMany({where:{schoolId:e.schoolId,status:{in:["ENROLLED","ACTIVE"]}},select:{email:!0,parentEmail:!0}})).forEach(e=>{e.email&&!i.includes(e.email)&&i.push(e.email),e.parentEmail&&!i.includes(e.parentEmail)&&i.push(e.parentEmail)}),console.log(`[BROADCAST_EMAIL] Broadcasting "${t.title}" to ${i.length} recipients for ${a.name}`);let n=i.slice(0,50).map(a=>o.ZZ.messageLog.create({data:{schoolId:e.schoolId,recipientEmail:a,recipientType:t.targetAudience,messageType:"EMAIL",subject:`[ANNOUNCEMENT] ${t.title}`,body:t.content,sentAt:new Date}}));return await Promise.allSettled(n),{success:!0,recipientsCount:i.length,noticeTitle:t.title}}catch(e){return console.error("[EMAIL_SERVICE] Failed to broadcast notice email:",e),{success:!1,error:e.message}}}async function f(e){try{let{schoolId:a,studentId:i,studentName:r,admissionNumber:l,currentClass:d,tierName:c,studentEmail:p,parentEmail:f,parentName:g,temporaryPassword:m}=e,u=e.schoolName,h=e.subdomain;if((!u||!h)&&a)try{let e=await o.ZZ.school.findUnique({where:{id:a},select:{name:!0,subdomain:!0}});e&&(u=u||e.name,h=h||e.subdomain)}catch(e){console.warn("[EMAIL_SERVICE] Warning: Could not fetch school for student enrollment email:",e)}let b=u||"School ERP",x="https://bonaveeict.com.ng".replace(/\/$/,""),y=h?`${x}/login?school=${encodeURIComponent(h)}`:`${x}/login`,v="#4f46e5";Date.now(),Math.random().toString(36).slice(2,7);let E=`🎉 Enrollment Confirmation - ${r} (${b})`,w=[f,p].filter(e=>"string"==typeof e&&e.trim().length>0&&e.includes("@")),I=Array.from(new Set(w.map(e=>e.trim().toLowerCase())));if(0===I.length)return console.warn(`[EMAIL_SERVICE] Cannot dispatch student enrollment confirmation: No valid recipient email provided for ${r} (ID: ${i||"unknown"})`),{success:!1,error:"No recipient email address"};let T=`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Student Enrollment Confirmed - ${b}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { background: ${v}; padding: 36px 32px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
          .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; font-weight: 500; }
          .content { padding: 36px 32px; line-height: 1.6; }
          .welcome-text { font-size: 16px; color: #334155; margin-bottom: 24px; }
          .credentials-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 5px solid ${v}; }
          .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
          .cred-row:last-child { border-bottom: none; }
          .cred-label { font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; }
          .cred-value { font-size: 15px; font-weight: 700; color: #0f172a; word-break: break-all; }
          .action-area { text-align: center; margin: 32px 0 20px 0; }
          .login-btn { display: inline-block; background-color: ${v}; color: #ffffff !important; text-decoration: none; padding: 15px 36px; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.35); }
          .direct-link { font-size: 13px; color: #64748b; word-break: break-all; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-top: 20px; }
          .footer { padding: 24px 32px; text-align: center; color: #94a3b8; font-size: 13px; border-top: 1px solid #e2e8f0; background: #fafafa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${b}</h1>
            <p>Student Enrollment Confirmation</p>
          </div>
          <div class="content">
            <p class="welcome-text">
              ${g?`Dear <strong>${g}</strong>,<br/><br/>`:""}Congratulations! We are delighted to confirm that <strong>${r}</strong> has been successfully enrolled at <strong>${b}</strong>. Welcome to our academic community!
            </p>

            <div class="credentials-card">
              <div class="cred-row">
                <span class="cred-label">Student Name</span>
                <span class="cred-value">${r}</span>
              </div>
              ${l?`
              <div class="cred-row">
                <span class="cred-label">Admission Number</span>
                <span class="cred-value">${l}</span>
              </div>`:""}
              ${d?`
              <div class="cred-row">
                <span class="cred-label">Class / Grade</span>
                <span class="cred-value">${d}</span>
              </div>`:""}
              ${c?`
              <div class="cred-row">
                <span class="cred-label">Academic Tier</span>
                <span class="cred-value">${c}</span>
              </div>`:""}
              <div class="cred-row">
                <span class="cred-label">Portal URL</span>
                <span class="cred-value">${y}</span>
              </div>
              ${p?`
              <div class="cred-row">
                <span class="cred-label">Student Login</span>
                <span class="cred-value">${p}</span>
              </div>`:""}
              ${m?`
              <div class="cred-row">
                <span class="cred-label">Temporary Password</span>
                <span class="cred-value">${m}</span>
              </div>`:""}
            </div>

            <div class="action-area">
              <a href="${y}" class="login-btn" target="_blank" rel="noopener noreferrer">
                Access Student Portal &rarr;
              </a>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
              You can access the portal directly anytime at:
            </p>
            <div class="direct-link">
              <a href="${y}" style="color: ${v}; font-weight: 600;">${y}</a>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${b} &bull; Powered by School ERP<br/>
            Need assistance? Contact the school admissions office or reply directly to this notification.
          </div>
        </div>
      </body>
      </html>
    `.trim(),$="SIMULATED",A="School ERP <noreply@bonaveeict.com.ng>";if(console.log(`[EMAIL_SERVICE] Initiating student enrollment confirmation for: ${I.join(", ")}`),process.env.RESEND_API_KEY)try{console.log(`[EMAIL_SERVICE] Sending student enrollment confirmation via Resend API (From: "${A}", To: ${JSON.stringify(I)})...`);let e=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:A,to:I,subject:E,html:T})}),a=await e.json();if(console.log(`[EMAIL_SERVICE] Resend HTTP Status: ${e.status}`),console.log("[EMAIL_SERVICE] Resend API Response:",JSON.stringify(a)),e.ok)$=`DELIVERED_RESEND (id: ${a.id})`,console.log(`[EMAIL_DISPATCH] Student enrollment confirmation delivered to ${I.join(", ")} (id: ${a.id})`);else{console.error(`[EMAIL_DISPATCH] Resend returned error status ${e.status} for ${I.join(", ")}:`,a),console.warn(`[EMAIL_SERVICE] Primary sender '${A}' failed. Retrying dispatch with fallback 'onboarding@resend.dev'...`);try{let e=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:"School ERP <onboarding@resend.dev>",to:I,subject:E,html:T})}),a=await e.json();console.log(`[EMAIL_SERVICE] Fallback Resend HTTP Status: ${e.status}`),console.log("[EMAIL_SERVICE] Fallback Resend API Response:",JSON.stringify(a)),e.ok&&($=`DELIVERED_RESEND_FALLBACK (id: ${a.id})`,console.log(`[EMAIL_DISPATCH] Fallback Resend email delivered to ${I.join(", ")} (id: ${a.id})`))}catch(e){console.error("[EMAIL_DISPATCH] Fallback Resend exception:",e?.message||e)}}}catch(e){console.error("[EMAIL_DISPATCH] Resend fetch exception:",e?.message||e)}if("SIMULATED"===$&&process.env.SMTP_HOST&&process.env.SMTP_USER)try{console.log(`[EMAIL_SERVICE] Attempting SMTP dispatch via ${process.env.SMTP_HOST}...`);let e=(await t.e(8812).then(t.bind(t,78812))).createTransport({host:process.env.SMTP_HOST,port:parseInt(process.env.SMTP_PORT||"587"),secure:"true"===process.env.SMTP_SECURE||"465"===process.env.SMTP_PORT,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS||process.env.SMTP_PASSWORD}}),a=await e.sendMail({from:A,to:I,subject:E,html:T});$=`DELIVERED_SMTP (id: ${a.messageId})`,console.log(`[EMAIL_DISPATCH] SMTP email sent successfully to ${I.join(", ")}:`,a.messageId)}catch(e){console.error("[EMAIL_DISPATCH] SMTP dispatch exception:",e?.message||e)}console.log("----------------------------------------------------------------"),console.log(`[STUDENT_ENROLLMENT_EMAIL] Dispatched to: ${I.join(", ")}`),console.log(`School: ${b} (${h||"default"})`),console.log(`Student: ${r} (${l||"N/A"})`),console.log(`Delivery Status: ${$}`),console.log("----------------------------------------------------------------");try{let e=s().join(process.cwd(),"logs");n().existsSync(e)||n().mkdirSync(e,{recursive:!0});let a=s().join(e,"enrollment-emails.log"),t=`[${new Date().toISOString()}] TYPE=STUDENT STATUS=${$} TO="${I.join(", ")}" SCHOOL="${b}" STUDENT="${r}"
`;n().appendFileSync(a,t,"utf8")}catch{}if(a)for(let e of I)try{await o.ZZ.messageLog.create({data:{schoolId:a,recipientEmail:e,recipientType:e===f?.toLowerCase().trim()?"PARENT":"STUDENT",messageType:"EMAIL",subject:E,body:T,sentAt:new Date}})}catch(e){console.warn("[EMAIL_SERVICE] Warning: Could not save student enrollment message log to DB:",e)}return{success:!0,deliveryStatus:$,recipients:I,studentName:r,schoolName:b,subject:E}}catch(e){return console.error("[EMAIL_SERVICE] Failed to dispatch student enrollment confirmation email:",e),{success:!1,error:e.message}}}},68939:(e,a,t)=>{t.d(a,{Ed:()=>f,ZZ:()=>r,pK:()=>m,rG:()=>p,uQ:()=>g});var o=t(53524),i=t(15821);let n=globalThis.__prismaBaseClient,r=n&&n.paymentProof?n:new o.PrismaClient;globalThis.__prismaBaseClient=r,globalThis.__admissionsPrismaMiddlewareAttached||"function"!=typeof r.$use||(globalThis.__admissionsPrismaMiddlewareAttached=!0,r.$use(async(e,a)=>{let t=await a(e);return"AdmissionLead"===e.model&&("create"!==e.action||t?.status!=="INQUIRY"&&t?.status?("update"===e.action||"upsert"===e.action)&&t?.status==="INQUIRY"&&e.args?.data?.status==="INQUIRY"&&(0,i.v)({leadId:t.id,schoolId:t.schoolId,lead:t}):(0,i.v)({leadId:t.id,schoolId:t.schoolId,lead:t})),t}));let s=globalThis.__prismaTierConnectionPool||new Map;globalThis.__prismaTierConnectionPool=s;let l=["User","Student","Staff","Classroom","Course","FeeTemplate","Invoice","Payment","PaymentProof","Timetable","StudentAttendance","StaffAttendance","Exam","ExamResult","GradeRecord","AcademicRecord","ReportCard","Notice","MessageLog","AcademicTier","Department","PayrollRecord","Transaction","AdmissionLead","TenantTierDatabase","PasswordResetToken","RefreshToken"];function d(e,a,t=!1){return e.$extends({query:{$allModels:{async $allOperations({model:o,operation:n,args:r,query:s}){if(!t&&l.includes(o)&&a){if("create"===n||"createMany"===n)r.data&&(Array.isArray(r.data)?r.data=r.data.map(e=>({...e,schoolId:a})):r.data={...r.data,schoolId:a});else if("findUnique"===n||"findUniqueOrThrow"===n){let t=e[o];if(t&&"function"==typeof t.findFirst){let e={...r.where||{},schoolId:a},i=await t.findFirst({...r,where:e});if(!i&&"findUniqueOrThrow"===n)throw Error(`Record in ${o} not found for tenant ${a}`);return i}}else r.where?r.where={...r.where,schoolId:a}:r.where={schoolId:a}}let d=await s(r);if("AdmissionLead"===o){if("create"===n||"createMany"===n){if(Array.isArray(d))for(let e of d)e?.id&&(e?.status==="INQUIRY"||!e?.status)&&(0,i.v)({leadId:e.id,schoolId:e.schoolId||a,lead:e});else d?.id&&("INQUIRY"===d.status||!d.status)&&(0,i.v)({leadId:d.id,schoolId:d.schoolId||a,lead:d})}else if("update"===n||"upsert"===n){let e=r?.data?.status==="INQUIRY";d?.id&&e&&"INQUIRY"===d.status&&(0,i.v)({leadId:d.id,schoolId:d.schoolId||a,lead:d})}}return d}}}})}class c{static getClientForUrl(e){if(!s.has(e)){let a=new o.PrismaClient({datasources:{db:{url:e}}});s.set(e,a)}return s.get(e)}static async resolveTierDbUrl(e,a){if(!a)return null;try{let t="string"==typeof a?a:a.tierName,o="object"==typeof a?a.tierId:void 0;if("string"==typeof a&&(a.length>20||a.includes("-")))try{let e=await r.academicTier.findUnique({where:{id:a},select:{id:!0,name:!0,databaseUrl:!0}});if(e){if(e.databaseUrl)return e.databaseUrl;t=e.name,o=e.id}}catch{}if(o){let e=await r.academicTier.findUnique({where:{id:o},select:{databaseUrl:!0}});if(e?.databaseUrl)return e.databaseUrl}if(t){let a=await r.tenantTierDatabase.findFirst({where:{schoolId:e,status:"ACTIVE",OR:[{tierName:{equals:t,mode:"insensitive"}},{tierName:{contains:t,mode:"insensitive"}}]},select:{databaseUrl:!0}});if(a?.databaseUrl)return a.databaseUrl;let o=await r.academicTier.findFirst({where:{schoolId:e,OR:[{name:{equals:t,mode:"insensitive"}},{name:{contains:t,mode:"insensitive"}}]},select:{databaseUrl:!0}});if(o?.databaseUrl)return o.databaseUrl}return null}catch(e){return console.warn(`[CONNECTION_ROUTER] Error resolving tier database URL (${e?.message||e}). Falling back to primary DB.`),null}}static async getClient(e,a){let t=await this.resolveTierDbUrl(e,a);if(t)try{let a=this.getClientForUrl(t);return d(a,e)}catch(e){console.warn(`[CONNECTION_ROUTER] Failed connecting to tier DB: ${t}. Falling back to default database.`)}return d(r,e)}}function p(e,a){return d(r,e)}async function f(e,a){try{if(!e||!a)return d(r,e||"");let t=await r.school.findUnique({where:{id:e},select:{databaseUrl:!0,tierDatabasesConfig:!0,nurseryDbUrl:!0,primaryDbUrl:!0,secondaryDbUrl:!0,isMultiDbEnabled:!0}}),o=null,i=a.toUpperCase().trim();if((i.includes("NURSERY")||i.includes("DAYCARE"))&&t?.nurseryDbUrl?o=t.nurseryDbUrl:i.includes("PRIMARY")&&!i.includes("SECONDARY")&&t?.primaryDbUrl?o=t.primaryDbUrl:i.includes("SECONDARY")&&!i.includes("PRIMARY")&&t?.secondaryDbUrl&&(o=t.secondaryDbUrl),!o&&t?.tierDatabasesConfig&&"object"==typeof t.tierDatabasesConfig){let e=t.tierDatabasesConfig;for(let[a,t]of Object.entries(e))if(i.includes(a.toUpperCase())||a.toUpperCase().includes(i)){o=t;break}}if(o||(o=await c.resolveTierDbUrl(e,a)),o)try{let a=c.getClientForUrl(o);return d(a,e)}catch(t){console.warn(`[SAFETY_FALLBACK] Failed to initialize dynamic PrismaClient for tier "${a}" on tenant "${e}" (${t?.message||t}). Falling back to main tenant database.`)}return d(r,e)}catch(t){return console.warn(`[SAFETY_FALLBACK] getPrismaClientForTier caught exception for tenant "${e}", tier "${a}":`,t?.message||t),d(r,e)}}function g(e){e?s.delete(e):s.clear()}async function m(e,a,t){try{let o=await e.academicTier.findFirst({where:{schoolId:a,OR:[...t.id?[{id:t.id}]:[],...t.name?[{name:{equals:t.name,mode:"insensitive"}},{name:{contains:t.name,mode:"insensitive"}}]:[]]}});if(!o&&t.name)try{o=await e.academicTier.create({data:{id:t.id||`${a}-${t.name.toLowerCase().replace(/[^a-z0-9]/g,"-")}`,name:t.name,schoolId:a,level:t.level??1}})}catch{o=await e.academicTier.findFirst({where:{schoolId:a}})}return o||(o=await e.academicTier.findFirst()),o?.id||t.id||"default-tier"}catch(e){return console.warn("[ROUTER] Failed to resolve tier ID in tier database:",e?.message||e),t.id||"default-tier"}}}};