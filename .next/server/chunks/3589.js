"use strict";exports.id=3589,exports.ids=[3589],exports.modules={24313:(e,a,o)=>{o.d(a,{v:()=>i});var t=o(82361),n=o(39357);class r extends t.EventEmitter{constructor(){super(),this.dispatchedEventsCache=new Map,this.CACHE_TTL_MS=6e5,this.setMaxListeners(50),this.setupListeners()}static getInstance(){return r.instance||(globalThis.__admissionsEventManager?r.instance=globalThis.__admissionsEventManager:(r.instance=new r,globalThis.__admissionsEventManager=r.instance)),r.instance}setupListeners(){this.on("lead.inquiry",e=>{setImmediate(async()=>{try{await (0,n.LV)({lead:e.lead,leadId:e.leadId,school:e.school,schoolId:e.schoolId})}catch(e){console.error("[ADMISSIONS_EVENT_MANAGER] Error processing inquiry email event:",e)}})})}triggerInquiryNotification(e){let{leadId:a,schoolId:o,lead:t,school:n,force:r}=e;if(!a)return;let s=`inquiry:${a}`,i=Date.now();if(!(!r&&this.dispatchedEventsCache.has(s)&&i-(this.dispatchedEventsCache.get(s)||0)<this.CACHE_TTL_MS)){if(this.dispatchedEventsCache.set(s,i),this.dispatchedEventsCache.size>2e3)for(let[e,a]of this.dispatchedEventsCache.entries())i-a>this.CACHE_TTL_MS&&this.dispatchedEventsCache.delete(e);this.emit("lead.inquiry",{leadId:a,schoolId:o,lead:t,school:n})}}}let s=r.getInstance();function i(e){s.triggerInquiryNotification(e)}},39357:(e,a,o)=>{o.d(a,{$4:()=>c,EG:()=>g,LS:()=>d,LV:()=>l,nh:()=>f,pr:()=>p});var t=o(68476),n=o(57147),r=o.n(n),s=o(71017),i=o.n(s);async function l(e){try{let a=e.lead,o=e.school;if(!a&&e.leadId&&(a=await t.basePrisma.admissionLead.findUnique({where:{id:e.leadId},include:{tier:!0}})),!a)return console.warn("[EMAIL_SERVICE] Cannot send inquiry acknowledgment: Lead not found.",e),null;let n=a.schoolId||e.schoolId;!o&&n&&(o=await t.basePrisma.school.findUnique({where:{id:n}}));let s=o?.name||"Udoka International School",l=o?.subdomain||"udoka",c=o?.branding?.primaryColor||"#312e81",d="#4338ca",p="https://bonaveeict.com.ng".replace(/\/$/,""),f=a.uploadToken,g=a.uploadExpiresAt&&new Date(a.uploadExpiresAt)<new Date;if(!f||g){f=crypto.randomUUID();let e=new Date;e.setDate(e.getDate()+30);try{await t.basePrisma.admissionLead.update({where:{id:a.id},data:{uploadToken:f,uploadExpiresAt:e}}),a.uploadToken=f,a.uploadExpiresAt=e}catch(e){console.warn("[EMAIL_SERVICE] Warning: Could not persist uploadToken to DB:",e)}}let m=`${p}/${l}/admissions/upload/${a.id}?token=${f}`,h=a.parentName||"Parent / Guardian",u=a.parentEmail||a.studentEmail||(a.parentContact?.includes("@")?a.parentContact:null),b=u||`${h} (No registered email - simulated dispatch)`,x=(a.id||"INQ").split("-")[0].toUpperCase(),E=a.applicantName||"Applicant",v=a.targetGrade||"Unspecified Grade",S=a.tier?.name||"Standard Tier",y=S.toUpperCase().includes("NURSERY")||S.toUpperCase().includes("PRIMARY")||S.toUpperCase().includes("DAYCARE"),w=`<inquiry-ack-${Date.now()}-${Math.random().toString(36).slice(2,8)}@${l}.internal>`,I=`Application Inquiry Acknowledged & Required Credentials - ${s}`,$=`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${I}</title>
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
      background: linear-gradient(135deg, ${c} 0%, ${d} 100%);
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
      border-left: 4px solid ${c};
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
      background-color: ${c};
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
      <h1>${s}</h1>
      <p>Official Admission & Application Intake Notice</p>
    </div>

    <div class="body">
      <h2 class="greeting">Dear ${h},</h2>
      <p class="intro-text">
        Thank you for your interest in <strong>${s}</strong>. We are pleased to formally acknowledge that your admission inquiry for <strong>${E}</strong> has been received and enrolled in our active admissions pipeline.
      </p>

      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Application Reference:</span>
          <span class="info-value">#${x}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Applicant Name:</span>
          <span class="info-value">${E}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Target Grade:</span>
          <span class="info-value">${v}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Academic Tier:</span>
          <span class="info-value">${S}</span>
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
            <span class="credential-tag ${y?"credential-tag-special":""}">
              ${y?"Mandatory for Tier":"If Applicable"}
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
        <a href="${m}" class="btn" style="display: inline-block; font-size: 15px; font-weight: 700; padding: 15px 36px; text-decoration: none; border-radius: 10px; background-color: ${c}; color: #ffffff; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.39);">
          Upload Required Credentials &rarr;
        </a>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6; word-break: break-all;">
          <strong>Direct Secure Access Link:</strong><br />
          <a href="${m}" style="color: ${d}; font-weight: 600;">${m}</a><br />
          <span style="color: #94a3b8;">(Unique temporary link &bull; Valid for 30 days &bull; No password required)</span>
        </div>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px;">
        If you have any questions regarding these credential requirements, please do not hesitate to contact our Admissions Office at <strong>${o?.contactPhone||"+234 (0) 800-SCHOOL-ERP"}</strong>.
      </p>
    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()} ${s}. All rights reserved.<br>
      Admissions & Records Bureau &bull; Multi-Tenant Academic Management System
    </div>
  </div>
</body>
</html>
    `.trim();console.log("\n"+"=".repeat(80)),console.log("\uD83D\uDCE8 [SIMULATED EMAIL TRANSPORT - NODEMAILER / SMTP DISPATCH]"),console.log("=".repeat(80)),console.log("STATUS:       250 OK (Simulated Transport Delivered)"),console.log(`MESSAGE-ID:   ${w}`),console.log(`TIMESTAMP:    ${new Date().toISOString()}`),console.log(`TENANT:       ${s} (${l})`),console.log(`RECIPIENT:    ${h} <${b}>`),console.log(`APPLICANT:    ${E} (Target: ${v} • Tier: ${S})`),console.log(`SUBJECT:      ${I}`),console.log(`UPLOAD LINK:  ${m}`),console.log("-".repeat(80)),console.log("REQUESTED CREDENTIAL DOCUMENTS:"),console.log("  1. Recent Passport Photograph (Color photo within last 6 months)"),console.log("  2. Scanned Copy of Previous Academic Results / Report Cards (Past 1-2 years)"),console.log("  3. Birth Certificate or Valid ID Verification (Government-issued)"),console.log(`  4. Any Relevant Medical or Behavioral Records (${y?"Mandatory for Nursery/Primary":"If applicable"})`),console.log("-".repeat(80)),console.log(`PAYLOAD SIZE: ~${Math.round(Buffer.byteLength($,"utf8")/1024)} KB | FORMAT: Responsive HTML`),console.log("=".repeat(80)+"\n");try{let e=i().join(process.cwd(),"logs");r().existsSync(e)||r().mkdirSync(e,{recursive:!0});let a=i().join(e,"admissions-email-transport.log"),o=`[${new Date().toISOString()}] [250 OK] ID=${w} TO="${b}" TENANT="${s}" APPLICANT="${E}" CREDENTIALS="1.Passport, 2.Report Cards, 3.Birth Certificate, 4.Medical/Behavioral"
`;r().appendFileSync(a,o,"utf8")}catch(e){}return n&&u&&setImmediate(async()=>{try{await t.basePrisma.messageLog.create({data:{schoolId:n,recipientEmail:u,recipientType:"PARENT",messageType:"EMAIL",subject:I,body:$,sentAt:new Date}})}catch(e){}}),{success:!0,messageId:w,recipient:b,tenantName:s,applicantName:E,subject:I,emailHtml:$}}catch(e){return console.error("[EMAIL_SERVICE] Failed to send inquiry acknowledgment email:",e),null}}async function c(e,a,o){let t="https://bonaveeict.com.ng".replace(/\/$/,""),n=`${t}/${a.subdomain}/admissions/accept?token=${o}`,r=a.branding?.primaryColor||"#0f172a",s=`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admission Offer - ${a.name}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background-color: ${r}; padding: 30px 40px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 40px; color: #334155; line-height: 1.6; }
        .content p { margin: 0 0 16px 0; font-size: 16px; }
        .details-box { background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${r}; }
        .details-box p { margin: 8px 0; font-size: 15px; }
        .details-box strong { color: #0f172a; }
        .action-container { text-align: center; margin: 40px 0 20px 0; }
        .button { background-color: ${r}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: opacity 0.2s; }
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
            <a href="${n}" class="button">Review Admission Offer</a>
          </div>
          
          <p style="font-size: 14px; color: #64748b; text-align: center;">This secure link is unique to your application and will expire in 7 days.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ${a.name}. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;return console.log("----------------------------------------------------------------"),console.log(`[EMAIL DISPATCH] Mocking email send to: ${e.parentEmail||e.parentContact}`),console.log(`Subject: 🎉 Admission Offer - ${a.name}`),console.log(`Token Link: ${n}`),console.log("----------------------------------------------------------------"),s}async function d(e){try{let{school:a,recipientEmail:o,recipientName:n,resetUrl:r,expiresMinutes:s=60}=e,i=a?.name||"Institution",l=a?.branding?.primaryColor||"#312e81",c=`<reset-${Date.now()}-${Math.random().toString(36).slice(2,7)}@schoolerp.internal>`,d=`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request - ${i}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b; }
          .container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { background: ${l}; padding: 32px 36px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
          .header p { margin: 6px 0 0 0; opacity: 0.85; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
          .content { padding: 36px; line-height: 1.6; }
          .content h2 { margin-top: 0; font-size: 18px; color: #0f172a; font-weight: 600; }
          .content p { margin: 0 0 16px 0; font-size: 15px; color: #334155; }
          .security-callout { background-color: #f1f5f9; padding: 18px 20px; border-radius: 10px; margin: 24px 0; border-left: 4px solid ${l}; font-size: 14px; color: #475569; }
          .action-container { text-align: center; margin: 32px 0; }
          .button { background-color: ${l}; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .link-fallback { word-break: break-all; font-size: 12px; color: #64748b; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 20px; }
          .footer { padding: 24px 36px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; background: #fafafa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${i}</h1>
            <p>Institutional Security Desk</p>
          </div>
          <div class="content">
            <h2>Password Recovery Request</h2>
            <p>Hello <strong>${n||"User"}</strong>,</p>
            <p>We received a request to reset the password associated with your account for <strong>${i}</strong>.</p>
            <p>Click the secure button below to choose a brand-new password:</p>
            
            <div class="action-container">
              <a href="${r}" class="button" target="_blank" rel="noopener noreferrer">Reset Your Password</a>
            </div>

            <div class="security-callout">
              <strong>Security Notice:</strong> This recovery link is strictly time-limited and will automatically expire in <strong>${s} minutes</strong>. If you did not initiate this password reset request, you can safely disregard this email; your current password remains secure.
            </div>

            <p style="font-size: 13px; color: #64748b;">If the button above does not work, copy and paste this secure link directly into your browser:</p>
            <div class="link-fallback">${r}</div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${i}. All rights reserved.<br/>
            Automated security dispatch. Please do not reply directly to this message.
          </div>
        </div>
      </body>
      </html>
    `.trim();console.log("----------------------------------------------------------------"),console.log(`[PASSWORD_RESET_EMAIL] Dispatched to: ${o} for ${i}`),console.log(`Reset Link: ${r}`),console.log("----------------------------------------------------------------");try{a?.id&&await t.basePrisma.messageLog.create({data:{schoolId:a.id,recipientEmail:o.toLowerCase().trim(),recipientType:"STAFF",messageType:"EMAIL",subject:`[SECURITY] Password Reset Request - ${i}`,body:`Password recovery initiated. Reset link: ${r}`,sentAt:new Date}})}catch(e){console.warn("[EMAIL_SERVICE] Notice log warning:",e)}return{success:!0,messageId:c,html:d}}catch(e){return console.error("[EMAIL_SERVICE] Failed to dispatch password reset email:",e),{success:!1,error:e.message}}}async function p(e){try{let{schoolName:a,subdomain:n,adminEmail:s,adminPassword:l,contactPhone:c,schoolId:d}=e,p="https://bonaveeict.com.ng".replace(/\/$/,""),f=`${p}/login?school=${encodeURIComponent(n)}`,g="#4f46e5";Date.now(),Math.random().toString(36).slice(2,7);let m=`🎉 Welcome to School ERP - ${a} Portal Access Credentials`,h=`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>School Registration Successful - ${a}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { background: ${g}; padding: 36px 32px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
          .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; font-weight: 500; }
          .content { padding: 36px 32px; line-height: 1.6; }
          .welcome-text { font-size: 16px; color: #334155; margin-bottom: 24px; }
          .credentials-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 5px solid ${g}; }
          .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
          .cred-row:last-child { border-bottom: none; }
          .cred-label { font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; }
          .cred-value { font-size: 15px; font-weight: 700; color: #0f172a; word-break: break-all; }
          .action-area { text-align: center; margin: 32px 0 20px 0; }
          .login-btn { display: inline-block; background-color: ${g}; color: #ffffff !important; text-decoration: none; padding: 15px 36px; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.35); }
          .direct-link { font-size: 13px; color: #64748b; word-break: break-all; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-top: 20px; }
          .footer { padding: 24px 32px; text-align: center; color: #94a3b8; font-size: 13px; border-top: 1px solid #e2e8f0; background: #fafafa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${a}</h1>
            <p>School Administrative Workspace Provisioned</p>
          </div>
          <div class="content">
            <p class="welcome-text">
              Congratulations! Your institutional workspace for <strong>${a}</strong> has been successfully configured and activated on the School ERP platform.
            </p>

            <div class="credentials-card">
              <div class="cred-row">
                <span class="cred-label">School Name</span>
                <span class="cred-value">${a}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Portal URL</span>
                <span class="cred-value">${f}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Admin Login</span>
                <span class="cred-value">${s}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Password</span>
                <span class="cred-value">${l||"(Configured during registration)"}</span>
              </div>
            </div>

            <div class="action-area">
              <a href="${f}" class="login-btn" target="_blank" rel="noopener noreferrer">
                Access School Admin Portal &rarr;
              </a>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
              You can access your portal directly anytime at:
            </p>
            <div class="direct-link">
              <a href="${f}" style="color: ${g}; font-weight: 600;">${f}</a>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${a} &bull; Powered by School ERP<br/>
            Need assistance? Contact support or reply directly to this notification.
          </div>
        </div>
      </body>
      </html>
    `.trim(),u="SIMULATED";if(console.log(`[EMAIL_SERVICE] Initiating registration success email for: ${s}`),console.log(`[EMAIL_SERVICE] Config check: RESEND_API_KEY=${!!process.env.RESEND_API_KEY} (length: ${process.env.RESEND_API_KEY?.length||0}), SMTP_HOST=${process.env.SMTP_HOST||"none"}`),process.env.RESEND_API_KEY)try{let e=process.env.EMAIL_FROM||"School ERP <noreply@bonaveeict.com.ng>";console.log(`[EMAIL_SERVICE] Sending via Resend API (From: "${e}", To: "${s}")...`);let a=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:e,to:[s],subject:m,html:h})}),o=await a.json();if(console.log(`[EMAIL_SERVICE] Resend HTTP Status: ${a.status}`),console.log("[EMAIL_SERVICE] Resend API Response:",JSON.stringify(o)),a.ok)u=`DELIVERED_RESEND (id: ${o.id})`,console.log(`[EMAIL_DISPATCH] Resend email successfully delivered to ${s} (id: ${o.id})`);else if(console.error(`[EMAIL_DISPATCH] Resend returned error status ${a.status} for ${s}:`,o),"onboarding@resend.dev"!==e&&"School ERP <onboarding@resend.dev>"!==e){console.warn(`[EMAIL_SERVICE] Primary sender '${e}' failed. Retrying dispatch with fallback 'onboarding@resend.dev'...`);try{let e=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:"School ERP <onboarding@resend.dev>",to:[s],subject:m,html:h})}),a=await e.json();console.log(`[EMAIL_SERVICE] Fallback Resend HTTP Status: ${e.status}`),console.log("[EMAIL_SERVICE] Fallback Resend API Response:",JSON.stringify(a)),e.ok&&(u=`DELIVERED_RESEND_FALLBACK (id: ${a.id})`,console.log(`[EMAIL_DISPATCH] Fallback Resend email delivered to ${s} (id: ${a.id})`))}catch(e){console.error("[EMAIL_DISPATCH] Fallback Resend exception:",e?.message||e)}}}catch(e){console.error("[EMAIL_DISPATCH] Resend fetch exception:",e?.message||e)}if("SIMULATED"===u&&process.env.SMTP_HOST&&process.env.SMTP_USER)try{console.log(`[EMAIL_SERVICE] Attempting SMTP dispatch via ${process.env.SMTP_HOST}...`);let e=(await o.e(5127).then(o.bind(o,45127))).createTransport({host:process.env.SMTP_HOST,port:parseInt(process.env.SMTP_PORT||"587"),secure:"true"===process.env.SMTP_SECURE||"465"===process.env.SMTP_PORT,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS||process.env.SMTP_PASSWORD}}),a=await e.sendMail({from:process.env.EMAIL_FROM||process.env.SMTP_USER||"School ERP <noreply@bonaveeict.com.ng>",to:s,subject:m,html:h});u=`DELIVERED_SMTP (id: ${a.messageId})`,console.log(`[EMAIL_DISPATCH] SMTP email sent successfully to ${s}:`,a.messageId)}catch(e){console.error("[EMAIL_DISPATCH] SMTP dispatch exception:",e?.message||e)}"SIMULATED"!==u||process.env.RESEND_API_KEY||process.env.SMTP_HOST||console.warn("[EMAIL_SERVICE] NOTICE: No email provider configured on Render! Add RESEND_API_KEY to Render Environment Variables."),console.log("----------------------------------------------------------------"),console.log(`[REGISTRATION_EMAIL] Dispatched to: ${s}`),console.log(`School: ${a} (${n})`),console.log(`Portal URL: ${f}`),console.log(`Delivery Status: ${u}`),console.log("----------------------------------------------------------------");try{let e=i().join(process.cwd(),"logs");r().existsSync(e)||r().mkdirSync(e,{recursive:!0});let o=i().join(e,"registration-emails.log"),t=`[${new Date().toISOString()}] STATUS=${u} TO="${s}" SCHOOL="${a}" PORTAL="${f}"
`;r().appendFileSync(o,t,"utf8")}catch{}if(d)try{await t.basePrisma.messageLog.create({data:{schoolId:d,recipientEmail:s.toLowerCase().trim(),recipientType:"STAFF",messageType:"EMAIL",subject:m,body:h,sentAt:new Date}})}catch(e){console.warn("[EMAIL_SERVICE] Warning: Could not save message log to DB:",e)}return{success:!0,deliveryStatus:u,recipient:s,schoolName:a,portalUrl:f,subject:m}}catch(e){return console.error("[EMAIL_SERVICE] Failed to dispatch registration success email:",e),{success:!1,error:e.message}}}async function f(e){try{let{schoolId:a,studentId:n,studentName:s,admissionNumber:l,currentClass:c,tierName:d,studentEmail:p,parentEmail:f,parentName:g,temporaryPassword:m}=e,h=e.schoolName,u=e.subdomain;if((!h||!u)&&a)try{let e=await t.basePrisma.school.findUnique({where:{id:a},select:{name:!0,subdomain:!0}});e&&(h=h||e.name,u=u||e.subdomain)}catch(e){console.warn("[EMAIL_SERVICE] Warning: Could not fetch school for student enrollment email:",e)}let b=h||"School ERP",x="https://bonaveeict.com.ng".replace(/\/$/,""),E=u?`${x}/login?school=${encodeURIComponent(u)}`:`${x}/login`,v="#4f46e5";Date.now(),Math.random().toString(36).slice(2,7);let S=`🎉 Enrollment Confirmation - ${s} (${b})`,y=[f,p].filter(e=>"string"==typeof e&&e.trim().length>0&&e.includes("@")),w=Array.from(new Set(y.map(e=>e.trim().toLowerCase())));if(0===w.length)return console.warn(`[EMAIL_SERVICE] Cannot dispatch student enrollment confirmation: No valid recipient email provided for ${s} (ID: ${n||"unknown"})`),{success:!1,error:"No recipient email address"};let I=`
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
              ${g?`Dear <strong>${g}</strong>,<br/><br/>`:""}Congratulations! We are delighted to confirm that <strong>${s}</strong> has been successfully enrolled at <strong>${b}</strong>. Welcome to our academic community!
            </p>

            <div class="credentials-card">
              <div class="cred-row">
                <span class="cred-label">Student Name</span>
                <span class="cred-value">${s}</span>
              </div>
              ${l?`
              <div class="cred-row">
                <span class="cred-label">Admission Number</span>
                <span class="cred-value">${l}</span>
              </div>`:""}
              ${c?`
              <div class="cred-row">
                <span class="cred-label">Class / Grade</span>
                <span class="cred-value">${c}</span>
              </div>`:""}
              ${d?`
              <div class="cred-row">
                <span class="cred-label">Academic Tier</span>
                <span class="cred-value">${d}</span>
              </div>`:""}
              <div class="cred-row">
                <span class="cred-label">Portal URL</span>
                <span class="cred-value">${E}</span>
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
              <a href="${E}" class="login-btn" target="_blank" rel="noopener noreferrer">
                Access Student Portal &rarr;
              </a>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
              You can access the portal directly anytime at:
            </p>
            <div class="direct-link">
              <a href="${E}" style="color: ${v}; font-weight: 600;">${E}</a>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${b} &bull; Powered by School ERP<br/>
            Need assistance? Contact the school admissions office or reply directly to this notification.
          </div>
        </div>
      </body>
      </html>
    `.trim(),$="SIMULATED",T="School ERP <noreply@bonaveeict.com.ng>";if(console.log(`[EMAIL_SERVICE] Initiating student enrollment confirmation for: ${w.join(", ")}`),process.env.RESEND_API_KEY)try{console.log(`[EMAIL_SERVICE] Sending student enrollment confirmation via Resend API (From: "${T}", To: ${JSON.stringify(w)})...`);let e=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:T,to:w,subject:S,html:I})}),a=await e.json();if(console.log(`[EMAIL_SERVICE] Resend HTTP Status: ${e.status}`),console.log("[EMAIL_SERVICE] Resend API Response:",JSON.stringify(a)),e.ok)$=`DELIVERED_RESEND (id: ${a.id})`,console.log(`[EMAIL_DISPATCH] Student enrollment confirmation delivered to ${w.join(", ")} (id: ${a.id})`);else{console.error(`[EMAIL_DISPATCH] Resend returned error status ${e.status} for ${w.join(", ")}:`,a),console.warn(`[EMAIL_SERVICE] Primary sender '${T}' failed. Retrying dispatch with fallback 'onboarding@resend.dev'...`);try{let e=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:"School ERP <onboarding@resend.dev>",to:w,subject:S,html:I})}),a=await e.json();console.log(`[EMAIL_SERVICE] Fallback Resend HTTP Status: ${e.status}`),console.log("[EMAIL_SERVICE] Fallback Resend API Response:",JSON.stringify(a)),e.ok&&($=`DELIVERED_RESEND_FALLBACK (id: ${a.id})`,console.log(`[EMAIL_DISPATCH] Fallback Resend email delivered to ${w.join(", ")} (id: ${a.id})`))}catch(e){console.error("[EMAIL_DISPATCH] Fallback Resend exception:",e?.message||e)}}}catch(e){console.error("[EMAIL_DISPATCH] Resend fetch exception:",e?.message||e)}if("SIMULATED"===$&&process.env.SMTP_HOST&&process.env.SMTP_USER)try{console.log(`[EMAIL_SERVICE] Attempting SMTP dispatch via ${process.env.SMTP_HOST}...`);let e=(await o.e(5127).then(o.bind(o,45127))).createTransport({host:process.env.SMTP_HOST,port:parseInt(process.env.SMTP_PORT||"587"),secure:"true"===process.env.SMTP_SECURE||"465"===process.env.SMTP_PORT,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS||process.env.SMTP_PASSWORD}}),a=await e.sendMail({from:T,to:w,subject:S,html:I});$=`DELIVERED_SMTP (id: ${a.messageId})`,console.log(`[EMAIL_DISPATCH] SMTP email sent successfully to ${w.join(", ")}:`,a.messageId)}catch(e){console.error("[EMAIL_DISPATCH] SMTP dispatch exception:",e?.message||e)}console.log("----------------------------------------------------------------"),console.log(`[STUDENT_ENROLLMENT_EMAIL] Dispatched to: ${w.join(", ")}`),console.log(`School: ${b} (${u||"default"})`),console.log(`Student: ${s} (${l||"N/A"})`),console.log(`Delivery Status: ${$}`),console.log("----------------------------------------------------------------");try{let e=i().join(process.cwd(),"logs");r().existsSync(e)||r().mkdirSync(e,{recursive:!0});let a=i().join(e,"enrollment-emails.log"),o=`[${new Date().toISOString()}] TYPE=STUDENT STATUS=${$} TO="${w.join(", ")}" SCHOOL="${b}" STUDENT="${s}"
`;r().appendFileSync(a,o,"utf8")}catch{}if(a)for(let e of w)try{await t.basePrisma.messageLog.create({data:{schoolId:a,recipientEmail:e,recipientType:e===f?.toLowerCase().trim()?"PARENT":"STUDENT",messageType:"EMAIL",subject:S,body:I,sentAt:new Date}})}catch(e){console.warn("[EMAIL_SERVICE] Warning: Could not save student enrollment message log to DB:",e)}return{success:!0,deliveryStatus:$,recipients:w,studentName:s,schoolName:b,subject:S}}catch(e){return console.error("[EMAIL_SERVICE] Failed to dispatch student enrollment confirmation email:",e),{success:!1,error:e.message}}}async function g(e){try{let{schoolId:a,staffId:n,staffName:s,staffEmail:l,role:c,departmentId:d,temporaryPassword:p}=e,f=e.schoolName,g=e.subdomain;if((!f||!g)&&a)try{let e=await t.basePrisma.school.findUnique({where:{id:a},select:{name:!0,subdomain:!0}});e&&(f=f||e.name,g=g||e.subdomain)}catch(e){console.warn("[EMAIL_SERVICE] Warning: Could not fetch school for staff enrollment email:",e)}let m=e.departmentName;if(!m&&d)try{let e=await t.basePrisma.department.findUnique({where:{id:d},select:{name:!0}});e&&(m=e.name)}catch{}let h=f||"School ERP",u="https://bonaveeict.com.ng".replace(/\/$/,""),b=g?`${u}/login?school=${encodeURIComponent(g)}`:`${u}/login`,x="#4f46e5";Date.now(),Math.random().toString(36).slice(2,7);let E=`🎉 Staff Enrollment Confirmation - Welcome to ${h}`,v=l?.trim().toLowerCase();if(!v||!v.includes("@"))return console.warn(`[EMAIL_SERVICE] Cannot dispatch staff enrollment confirmation: No valid email provided for ${s} (ID: ${n||"unknown"})`),{success:!1,error:"No valid staff email address"};let S=`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Staff Enrollment Confirmed - ${h}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { background: ${x}; padding: 36px 32px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
          .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; font-weight: 500; }
          .content { padding: 36px 32px; line-height: 1.6; }
          .welcome-text { font-size: 16px; color: #334155; margin-bottom: 24px; }
          .credentials-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 5px solid ${x}; }
          .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
          .cred-row:last-child { border-bottom: none; }
          .cred-label { font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; }
          .cred-value { font-size: 15px; font-weight: 700; color: #0f172a; word-break: break-all; }
          .action-area { text-align: center; margin: 32px 0 20px 0; }
          .login-btn { display: inline-block; background-color: ${x}; color: #ffffff !important; text-decoration: none; padding: 15px 36px; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.35); }
          .direct-link { font-size: 13px; color: #64748b; word-break: break-all; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-top: 20px; }
          .footer { padding: 24px 32px; text-align: center; color: #94a3b8; font-size: 13px; border-top: 1px solid #e2e8f0; background: #fafafa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${h}</h1>
            <p>Staff Enrollment & Onboarding Confirmation</p>
          </div>
          <div class="content">
            <p class="welcome-text">
              Congratulations! Your staff account for <strong>${h}</strong> has been successfully configured and enrolled on the School ERP platform.
            </p>

            <div class="credentials-card">
              <div class="cred-row">
                <span class="cred-label">Staff Name</span>
                <span class="cred-value">${s}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Role / Position</span>
                <span class="cred-value">${c||"Staff Member"}</span>
              </div>
              ${m?`
              <div class="cred-row">
                <span class="cred-label">Department</span>
                <span class="cred-value">${m}</span>
              </div>`:""}
              <div class="cred-row">
                <span class="cred-label">Portal URL</span>
                <span class="cred-value">${b}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Staff Login</span>
                <span class="cred-value">${v}</span>
              </div>
              ${p?`
              <div class="cred-row">
                <span class="cred-label">Temporary Password</span>
                <span class="cred-value">${p}</span>
              </div>`:""}
            </div>

            <div class="action-area">
              <a href="${b}" class="login-btn" target="_blank" rel="noopener noreferrer">
                Access Staff Portal &rarr;
              </a>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
              You can access the portal directly anytime at:
            </p>
            <div class="direct-link">
              <a href="${b}" style="color: ${x}; font-weight: 600;">${b}</a>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${h} &bull; Powered by School ERP<br/>
            Need assistance? Contact the school administration or reply directly to this notification.
          </div>
        </div>
      </body>
      </html>
    `.trim(),y="SIMULATED",w="School ERP <noreply@bonaveeict.com.ng>";if(console.log(`[EMAIL_SERVICE] Initiating staff enrollment confirmation for: ${v}`),process.env.RESEND_API_KEY)try{console.log(`[EMAIL_SERVICE] Sending staff enrollment confirmation via Resend API (From: "${w}", To: "${v}")...`);let e=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:w,to:[v],subject:E,html:S})}),a=await e.json();if(console.log(`[EMAIL_SERVICE] Resend HTTP Status: ${e.status}`),console.log("[EMAIL_SERVICE] Resend API Response:",JSON.stringify(a)),e.ok)y=`DELIVERED_RESEND (id: ${a.id})`,console.log(`[EMAIL_DISPATCH] Staff enrollment confirmation delivered to ${v} (id: ${a.id})`);else{console.error(`[EMAIL_DISPATCH] Resend returned error status ${e.status} for ${v}:`,a),console.warn(`[EMAIL_SERVICE] Primary sender '${w}' failed. Retrying dispatch with fallback 'onboarding@resend.dev'...`);try{let e=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:"School ERP <onboarding@resend.dev>",to:[v],subject:E,html:S})}),a=await e.json();console.log(`[EMAIL_SERVICE] Fallback Resend HTTP Status: ${e.status}`),console.log("[EMAIL_SERVICE] Fallback Resend API Response:",JSON.stringify(a)),e.ok&&(y=`DELIVERED_RESEND_FALLBACK (id: ${a.id})`,console.log(`[EMAIL_DISPATCH] Fallback Resend email delivered to ${v} (id: ${a.id})`))}catch(e){console.error("[EMAIL_DISPATCH] Fallback Resend exception:",e?.message||e)}}}catch(e){console.error("[EMAIL_DISPATCH] Resend fetch exception:",e?.message||e)}if("SIMULATED"===y&&process.env.SMTP_HOST&&process.env.SMTP_USER)try{console.log(`[EMAIL_SERVICE] Attempting SMTP dispatch via ${process.env.SMTP_HOST}...`);let e=(await o.e(5127).then(o.bind(o,45127))).createTransport({host:process.env.SMTP_HOST,port:parseInt(process.env.SMTP_PORT||"587"),secure:"true"===process.env.SMTP_SECURE||"465"===process.env.SMTP_PORT,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS||process.env.SMTP_PASSWORD}}),a=await e.sendMail({from:w,to:v,subject:E,html:S});y=`DELIVERED_SMTP (id: ${a.messageId})`,console.log(`[EMAIL_DISPATCH] SMTP email sent successfully to ${v}:`,a.messageId)}catch(e){console.error("[EMAIL_DISPATCH] SMTP dispatch exception:",e?.message||e)}console.log("----------------------------------------------------------------"),console.log(`[STAFF_ENROLLMENT_EMAIL] Dispatched to: ${v}`),console.log(`School: ${h} (${g||"default"})`),console.log(`Staff: ${s} (${c||"Staff Member"})`),console.log(`Delivery Status: ${y}`),console.log("----------------------------------------------------------------");try{let e=i().join(process.cwd(),"logs");r().existsSync(e)||r().mkdirSync(e,{recursive:!0});let a=i().join(e,"enrollment-emails.log"),o=`[${new Date().toISOString()}] TYPE=STAFF STATUS=${y} TO="${v}" SCHOOL="${h}" STAFF="${s}"
`;r().appendFileSync(a,o,"utf8")}catch{}if(a)try{await t.basePrisma.messageLog.create({data:{schoolId:a,recipientEmail:v,recipientType:"STAFF",messageType:"EMAIL",subject:E,body:S,sentAt:new Date}})}catch(e){console.warn("[EMAIL_SERVICE] Warning: Could not save staff enrollment message log to DB:",e)}return{success:!0,deliveryStatus:y,recipient:v,staffName:s,schoolName:h,subject:E}}catch(e){return console.error("[EMAIL_SERVICE] Failed to dispatch staff enrollment confirmation email:",e),{success:!1,error:e.message}}}},68476:(e,a,o)=>{o.d(a,{Ed:()=>f,basePrisma:()=>s,pK:()=>m,rG:()=>p,uQ:()=>g});var t=o(53524),n=o(24313);let r=globalThis.__prismaBaseClient,s=r&&r.paymentProof?r:new t.PrismaClient;globalThis.__prismaBaseClient=s,globalThis.__admissionsPrismaMiddlewareAttached||"function"!=typeof s.$use||(globalThis.__admissionsPrismaMiddlewareAttached=!0,s.$use(async(e,a)=>{let o=await a(e);return"AdmissionLead"===e.model&&("create"!==e.action||o?.status!=="INQUIRY"&&o?.status?("update"===e.action||"upsert"===e.action)&&o?.status==="INQUIRY"&&e.args?.data?.status==="INQUIRY"&&(0,n.v)({leadId:o.id,schoolId:o.schoolId,lead:o}):(0,n.v)({leadId:o.id,schoolId:o.schoolId,lead:o})),o}));let i=globalThis.__prismaTierConnectionPool||new Map;globalThis.__prismaTierConnectionPool=i;let l=["User","Student","Staff","Classroom","Course","FeeTemplate","Invoice","Payment","PaymentProof","Timetable","StudentAttendance","StaffAttendance","Exam","ExamResult","GradeRecord","AcademicRecord","ReportCard","Notice","MessageLog","AcademicTier","Department","PayrollRecord","Transaction","AdmissionLead","TenantTierDatabase","PasswordResetToken","RefreshToken"];function c(e,a,o=!1){return e.$extends({query:{$allModels:{async $allOperations({model:t,operation:r,args:s,query:i}){if(!o&&l.includes(t)&&a){if("create"===r||"createMany"===r)s.data&&(Array.isArray(s.data)?s.data=s.data.map(e=>({...e,schoolId:a})):s.data={...s.data,schoolId:a});else if("findUnique"===r||"findUniqueOrThrow"===r){let o=e[t];if(o&&"function"==typeof o.findFirst){let e={...s.where||{},schoolId:a},n=await o.findFirst({...s,where:e});if(!n&&"findUniqueOrThrow"===r)throw Error(`Record in ${t} not found for tenant ${a}`);return n}}else s.where?s.where={...s.where,schoolId:a}:s.where={schoolId:a}}let c=await i(s);if("AdmissionLead"===t){if("create"===r||"createMany"===r){if(Array.isArray(c))for(let e of c)e?.id&&(e?.status==="INQUIRY"||!e?.status)&&(0,n.v)({leadId:e.id,schoolId:e.schoolId||a,lead:e});else c?.id&&("INQUIRY"===c.status||!c.status)&&(0,n.v)({leadId:c.id,schoolId:c.schoolId||a,lead:c})}else if("update"===r||"upsert"===r){let e=s?.data?.status==="INQUIRY";c?.id&&e&&"INQUIRY"===c.status&&(0,n.v)({leadId:c.id,schoolId:c.schoolId||a,lead:c})}}return c}}}})}class d{static getClientForUrl(e){if(!i.has(e)){let a=new t.PrismaClient({datasources:{db:{url:e}}});i.set(e,a)}return i.get(e)}static async resolveTierDbUrl(e,a){if(!a)return null;try{let o="string"==typeof a?a:a.tierName,t="object"==typeof a?a.tierId:void 0;if("string"==typeof a&&(a.length>20||a.includes("-")))try{let e=await s.academicTier.findUnique({where:{id:a},select:{id:!0,name:!0,databaseUrl:!0}});if(e){if(e.databaseUrl)return e.databaseUrl;o=e.name,t=e.id}}catch{}if(t){let e=await s.academicTier.findUnique({where:{id:t},select:{databaseUrl:!0}});if(e?.databaseUrl)return e.databaseUrl}if(o){let a=await s.tenantTierDatabase.findFirst({where:{schoolId:e,status:"ACTIVE",OR:[{tierName:{equals:o,mode:"insensitive"}},{tierName:{contains:o,mode:"insensitive"}}]},select:{databaseUrl:!0}});if(a?.databaseUrl)return a.databaseUrl;let t=await s.academicTier.findFirst({where:{schoolId:e,OR:[{name:{equals:o,mode:"insensitive"}},{name:{contains:o,mode:"insensitive"}}]},select:{databaseUrl:!0}});if(t?.databaseUrl)return t.databaseUrl}return null}catch(e){return console.warn(`[CONNECTION_ROUTER] Error resolving tier database URL (${e?.message||e}). Falling back to primary DB.`),null}}static async getClient(e,a){let o=await this.resolveTierDbUrl(e,a);if(o)try{let a=this.getClientForUrl(o);return c(a,e)}catch(e){console.warn(`[CONNECTION_ROUTER] Failed connecting to tier DB: ${o}. Falling back to default database.`)}return c(s,e)}}function p(e,a){return c(s,e)}async function f(e,a){try{if(!e||!a)return c(s,e||"");let o=await s.school.findUnique({where:{id:e},select:{databaseUrl:!0,tierDatabasesConfig:!0,nurseryDbUrl:!0,primaryDbUrl:!0,secondaryDbUrl:!0,isMultiDbEnabled:!0}}),t=null,n=a.toUpperCase().trim();if((n.includes("NURSERY")||n.includes("DAYCARE"))&&o?.nurseryDbUrl?t=o.nurseryDbUrl:n.includes("PRIMARY")&&!n.includes("SECONDARY")&&o?.primaryDbUrl?t=o.primaryDbUrl:n.includes("SECONDARY")&&!n.includes("PRIMARY")&&o?.secondaryDbUrl&&(t=o.secondaryDbUrl),!t&&o?.tierDatabasesConfig&&"object"==typeof o.tierDatabasesConfig){let e=o.tierDatabasesConfig;for(let[a,o]of Object.entries(e))if(n.includes(a.toUpperCase())||a.toUpperCase().includes(n)){t=o;break}}if(t||(t=await d.resolveTierDbUrl(e,a)),t)try{let a=d.getClientForUrl(t);return c(a,e)}catch(o){console.warn(`[SAFETY_FALLBACK] Failed to initialize dynamic PrismaClient for tier "${a}" on tenant "${e}" (${o?.message||o}). Falling back to main tenant database.`)}return c(s,e)}catch(o){return console.warn(`[SAFETY_FALLBACK] getPrismaClientForTier caught exception for tenant "${e}", tier "${a}":`,o?.message||o),c(s,e)}}function g(e){e?i.delete(e):i.clear()}async function m(e,a,o){try{let t=await e.academicTier.findFirst({where:{schoolId:a,OR:[...o.id?[{id:o.id}]:[],...o.name?[{name:{equals:o.name,mode:"insensitive"}},{name:{contains:o.name,mode:"insensitive"}}]:[]]}});if(!t&&o.name)try{t=await e.academicTier.create({data:{id:o.id||`${a}-${o.name.toLowerCase().replace(/[^a-z0-9]/g,"-")}`,name:o.name,schoolId:a,level:o.level??1}})}catch{t=await e.academicTier.findFirst({where:{schoolId:a}})}return t||(t=await e.academicTier.findFirst()),t?.id||o.id||"default-tier"}catch(e){return console.warn("[ROUTER] Failed to resolve tier ID in tier database:",e?.message||e),o.id||"default-tier"}}}};