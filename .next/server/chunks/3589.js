"use strict";exports.id=3589,exports.ids=[3589],exports.modules={24313:(e,a,t)=>{t.d(a,{v:()=>s});var o=t(82361),i=t(39357);class r extends o.EventEmitter{constructor(){super(),this.dispatchedEventsCache=new Map,this.CACHE_TTL_MS=6e5,this.setMaxListeners(50),this.setupListeners()}static getInstance(){return r.instance||(globalThis.__admissionsEventManager?r.instance=globalThis.__admissionsEventManager:(r.instance=new r,globalThis.__admissionsEventManager=r.instance)),r.instance}setupListeners(){this.on("lead.inquiry",e=>{setImmediate(async()=>{try{await (0,i.LV)({lead:e.lead,leadId:e.leadId,school:e.school,schoolId:e.schoolId})}catch(e){console.error("[ADMISSIONS_EVENT_MANAGER] Error processing inquiry email event:",e)}})})}triggerInquiryNotification(e){let{leadId:a,schoolId:t,lead:o,school:i,force:r}=e;if(!a)return;let n=`inquiry:${a}`,s=Date.now();if(!(!r&&this.dispatchedEventsCache.has(n)&&s-(this.dispatchedEventsCache.get(n)||0)<this.CACHE_TTL_MS)){if(this.dispatchedEventsCache.set(n,s),this.dispatchedEventsCache.size>2e3)for(let[e,a]of this.dispatchedEventsCache.entries())s-a>this.CACHE_TTL_MS&&this.dispatchedEventsCache.delete(e);this.emit("lead.inquiry",{leadId:a,schoolId:t,lead:o,school:i})}}}let n=r.getInstance();function s(e){n.triggerInquiryNotification(e)}},39357:(e,a,t)=>{t.d(a,{$4:()=>d,LS:()=>c,LV:()=>l,pr:()=>p});var o=t(68476),i=t(57147),r=t.n(i),n=t(71017),s=t.n(n);async function l(e){try{let a=e.lead,t=e.school;if(!a&&e.leadId&&(a=await o.basePrisma.admissionLead.findUnique({where:{id:e.leadId},include:{tier:!0}})),!a)return console.warn("[EMAIL_SERVICE] Cannot send inquiry acknowledgment: Lead not found.",e),null;let i=a.schoolId||e.schoolId;!t&&i&&(t=await o.basePrisma.school.findUnique({where:{id:i}}));let n=t?.name||"Udoka International School",l=t?.subdomain||"udoka",d=t?.branding?.primaryColor||"#312e81",c="#4338ca",p="https://bonaveeict.com.ng".replace(/\/$/,""),f=a.uploadToken,g=a.uploadExpiresAt&&new Date(a.uploadExpiresAt)<new Date;if(!f||g){f=crypto.randomUUID();let e=new Date;e.setDate(e.getDate()+30);try{await o.basePrisma.admissionLead.update({where:{id:a.id},data:{uploadToken:f,uploadExpiresAt:e}}),a.uploadToken=f,a.uploadExpiresAt=e}catch(e){console.warn("[EMAIL_SERVICE] Warning: Could not persist uploadToken to DB:",e)}}let u=`${p}/${l}/admissions/upload/${a.id}?token=${f}`,m=a.parentName||"Parent / Guardian",h=a.parentEmail||a.studentEmail||(a.parentContact?.includes("@")?a.parentContact:null),b=h||`${m} (No registered email - simulated dispatch)`,x=(a.id||"INQ").split("-")[0].toUpperCase(),y=a.applicantName||"Applicant",v=a.targetGrade||"Unspecified Grade",E=a.tier?.name||"Standard Tier",w=E.toUpperCase().includes("NURSERY")||E.toUpperCase().includes("PRIMARY")||E.toUpperCase().includes("DAYCARE"),I=`<inquiry-ack-${Date.now()}-${Math.random().toString(36).slice(2,8)}@${l}.internal>`,A=`Application Inquiry Acknowledged & Required Credentials - ${n}`,S=`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${A}</title>
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
      <h1>${n}</h1>
      <p>Official Admission & Application Intake Notice</p>
    </div>

    <div class="body">
      <h2 class="greeting">Dear ${m},</h2>
      <p class="intro-text">
        Thank you for your interest in <strong>${n}</strong>. We are pleased to formally acknowledge that your admission inquiry for <strong>${y}</strong> has been received and enrolled in our active admissions pipeline.
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
        <a href="${u}" class="btn" style="display: inline-block; font-size: 15px; font-weight: 700; padding: 15px 36px; text-decoration: none; border-radius: 10px; background-color: ${d}; color: #ffffff; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.39);">
          Upload Required Credentials &rarr;
        </a>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6; word-break: break-all;">
          <strong>Direct Secure Access Link:</strong><br />
          <a href="${u}" style="color: ${c}; font-weight: 600;">${u}</a><br />
          <span style="color: #94a3b8;">(Unique temporary link &bull; Valid for 30 days &bull; No password required)</span>
        </div>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px;">
        If you have any questions regarding these credential requirements, please do not hesitate to contact our Admissions Office at <strong>${t?.contactPhone||"+234 (0) 800-SCHOOL-ERP"}</strong>.
      </p>
    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()} ${n}. All rights reserved.<br>
      Admissions & Records Bureau &bull; Multi-Tenant Academic Management System
    </div>
  </div>
</body>
</html>
    `.trim();console.log("\n"+"=".repeat(80)),console.log("\uD83D\uDCE8 [SIMULATED EMAIL TRANSPORT - NODEMAILER / SMTP DISPATCH]"),console.log("=".repeat(80)),console.log("STATUS:       250 OK (Simulated Transport Delivered)"),console.log(`MESSAGE-ID:   ${I}`),console.log(`TIMESTAMP:    ${new Date().toISOString()}`),console.log(`TENANT:       ${n} (${l})`),console.log(`RECIPIENT:    ${m} <${b}>`),console.log(`APPLICANT:    ${y} (Target: ${v} • Tier: ${E})`),console.log(`SUBJECT:      ${A}`),console.log(`UPLOAD LINK:  ${u}`),console.log("-".repeat(80)),console.log("REQUESTED CREDENTIAL DOCUMENTS:"),console.log("  1. Recent Passport Photograph (Color photo within last 6 months)"),console.log("  2. Scanned Copy of Previous Academic Results / Report Cards (Past 1-2 years)"),console.log("  3. Birth Certificate or Valid ID Verification (Government-issued)"),console.log(`  4. Any Relevant Medical or Behavioral Records (${w?"Mandatory for Nursery/Primary":"If applicable"})`),console.log("-".repeat(80)),console.log(`PAYLOAD SIZE: ~${Math.round(Buffer.byteLength(S,"utf8")/1024)} KB | FORMAT: Responsive HTML`),console.log("=".repeat(80)+"\n");try{let e=s().join(process.cwd(),"logs");r().existsSync(e)||r().mkdirSync(e,{recursive:!0});let a=s().join(e,"admissions-email-transport.log"),t=`[${new Date().toISOString()}] [250 OK] ID=${I} TO="${b}" TENANT="${n}" APPLICANT="${y}" CREDENTIALS="1.Passport, 2.Report Cards, 3.Birth Certificate, 4.Medical/Behavioral"
`;r().appendFileSync(a,t,"utf8")}catch(e){}return i&&h&&setImmediate(async()=>{try{await o.basePrisma.messageLog.create({data:{schoolId:i,recipientEmail:h,recipientType:"PARENT",messageType:"EMAIL",subject:A,body:S,sentAt:new Date}})}catch(e){}}),{success:!0,messageId:I,recipient:b,tenantName:n,applicantName:y,subject:A,emailHtml:S}}catch(e){return console.error("[EMAIL_SERVICE] Failed to send inquiry acknowledgment email:",e),null}}async function d(e,a,t){let o="https://bonaveeict.com.ng".replace(/\/$/,""),i=`${o}/${a.subdomain}/admissions/accept?token=${t}`,r=a.branding?.primaryColor||"#0f172a",n=`
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
  `;return console.log("----------------------------------------------------------------"),console.log(`[EMAIL DISPATCH] Mocking email send to: ${e.parentEmail||e.parentContact}`),console.log(`Subject: 🎉 Admission Offer - ${a.name}`),console.log(`Token Link: ${i}`),console.log("----------------------------------------------------------------"),n}async function c(e){try{let{school:a,recipientEmail:t,recipientName:i,resetUrl:r,expiresMinutes:n=60}=e,s=a?.name||"Institution",l=a?.branding?.primaryColor||"#312e81",d=`<reset-${Date.now()}-${Math.random().toString(36).slice(2,7)}@schoolerp.internal>`,c=`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request - ${s}</title>
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
            <h1>${s}</h1>
            <p>Institutional Security Desk</p>
          </div>
          <div class="content">
            <h2>Password Recovery Request</h2>
            <p>Hello <strong>${i||"User"}</strong>,</p>
            <p>We received a request to reset the password associated with your account for <strong>${s}</strong>.</p>
            <p>Click the secure button below to choose a brand-new password:</p>
            
            <div class="action-container">
              <a href="${r}" class="button" target="_blank" rel="noopener noreferrer">Reset Your Password</a>
            </div>

            <div class="security-callout">
              <strong>Security Notice:</strong> This recovery link is strictly time-limited and will automatically expire in <strong>${n} minutes</strong>. If you did not initiate this password reset request, you can safely disregard this email; your current password remains secure.
            </div>

            <p style="font-size: 13px; color: #64748b;">If the button above does not work, copy and paste this secure link directly into your browser:</p>
            <div class="link-fallback">${r}</div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${s}. All rights reserved.<br/>
            Automated security dispatch. Please do not reply directly to this message.
          </div>
        </div>
      </body>
      </html>
    `.trim();console.log("----------------------------------------------------------------"),console.log(`[PASSWORD_RESET_EMAIL] Dispatched to: ${t} for ${s}`),console.log(`Reset Link: ${r}`),console.log("----------------------------------------------------------------");try{a?.id&&await o.basePrisma.messageLog.create({data:{schoolId:a.id,recipientEmail:t.toLowerCase().trim(),recipientType:"STAFF",messageType:"EMAIL",subject:`[SECURITY] Password Reset Request - ${s}`,body:`Password recovery initiated. Reset link: ${r}`,sentAt:new Date}})}catch(e){console.warn("[EMAIL_SERVICE] Notice log warning:",e)}return{success:!0,messageId:d,html:c}}catch(e){return console.error("[EMAIL_SERVICE] Failed to dispatch password reset email:",e),{success:!1,error:e.message}}}async function p(e){try{let{schoolName:a,subdomain:i,adminEmail:n,adminPassword:l,contactPhone:d,schoolId:c}=e,p="https://bonaveeict.com.ng".replace(/\/$/,""),f=`${p}/login?school=${encodeURIComponent(i)}`,g="#4f46e5";Date.now(),Math.random().toString(36).slice(2,7);let u=`🎉 Welcome to School ERP - ${a} Portal Access Credentials`,m=`
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
                <span class="cred-value">${n}</span>
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
    `.trim(),h="SIMULATED";if(console.log(`[EMAIL_SERVICE] Initiating registration success email for: ${n}`),console.log(`[EMAIL_SERVICE] Config check: RESEND_API_KEY=${!!process.env.RESEND_API_KEY} (length: ${process.env.RESEND_API_KEY?.length||0}), SMTP_HOST=${process.env.SMTP_HOST||"none"}`),process.env.RESEND_API_KEY)try{let e=process.env.EMAIL_FROM||"School ERP <noreply@bonaveeict.com.ng>";console.log(`[EMAIL_SERVICE] Sending via Resend API (From: "${e}", To: "${n}")...`);let a=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:e,to:[n],subject:u,html:m})}),t=await a.json();if(console.log(`[EMAIL_SERVICE] Resend HTTP Status: ${a.status}`),console.log("[EMAIL_SERVICE] Resend API Response:",JSON.stringify(t)),a.ok)h=`DELIVERED_RESEND (id: ${t.id})`,console.log(`[EMAIL_DISPATCH] Resend email successfully delivered to ${n} (id: ${t.id})`);else if(console.error(`[EMAIL_DISPATCH] Resend returned error status ${a.status} for ${n}:`,t),"onboarding@resend.dev"!==e&&"School ERP <onboarding@resend.dev>"!==e){console.warn(`[EMAIL_SERVICE] Primary sender '${e}' failed. Retrying dispatch with fallback 'onboarding@resend.dev'...`);try{let e=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:"School ERP <onboarding@resend.dev>",to:[n],subject:u,html:m})}),a=await e.json();console.log(`[EMAIL_SERVICE] Fallback Resend HTTP Status: ${e.status}`),console.log("[EMAIL_SERVICE] Fallback Resend API Response:",JSON.stringify(a)),e.ok&&(h=`DELIVERED_RESEND_FALLBACK (id: ${a.id})`,console.log(`[EMAIL_DISPATCH] Fallback Resend email delivered to ${n} (id: ${a.id})`))}catch(e){console.error("[EMAIL_DISPATCH] Fallback Resend exception:",e?.message||e)}}}catch(e){console.error("[EMAIL_DISPATCH] Resend fetch exception:",e?.message||e)}if("SIMULATED"===h&&process.env.SMTP_HOST&&process.env.SMTP_USER)try{console.log(`[EMAIL_SERVICE] Attempting SMTP dispatch via ${process.env.SMTP_HOST}...`);let e=(await t.e(5127).then(t.bind(t,45127))).createTransport({host:process.env.SMTP_HOST,port:parseInt(process.env.SMTP_PORT||"587"),secure:"true"===process.env.SMTP_SECURE||"465"===process.env.SMTP_PORT,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS||process.env.SMTP_PASSWORD}}),a=await e.sendMail({from:process.env.EMAIL_FROM||process.env.SMTP_USER||"School ERP <noreply@bonaveeict.com.ng>",to:n,subject:u,html:m});h=`DELIVERED_SMTP (id: ${a.messageId})`,console.log(`[EMAIL_DISPATCH] SMTP email sent successfully to ${n}:`,a.messageId)}catch(e){console.error("[EMAIL_DISPATCH] SMTP dispatch exception:",e?.message||e)}"SIMULATED"!==h||process.env.RESEND_API_KEY||process.env.SMTP_HOST||console.warn("[EMAIL_SERVICE] NOTICE: No email provider configured on Render! Add RESEND_API_KEY to Render Environment Variables."),console.log("----------------------------------------------------------------"),console.log(`[REGISTRATION_EMAIL] Dispatched to: ${n}`),console.log(`School: ${a} (${i})`),console.log(`Portal URL: ${f}`),console.log(`Delivery Status: ${h}`),console.log("----------------------------------------------------------------");try{let e=s().join(process.cwd(),"logs");r().existsSync(e)||r().mkdirSync(e,{recursive:!0});let t=s().join(e,"registration-emails.log"),o=`[${new Date().toISOString()}] STATUS=${h} TO="${n}" SCHOOL="${a}" PORTAL="${f}"
`;r().appendFileSync(t,o,"utf8")}catch{}if(c)try{await o.basePrisma.messageLog.create({data:{schoolId:c,recipientEmail:n.toLowerCase().trim(),recipientType:"STAFF",messageType:"EMAIL",subject:u,body:m,sentAt:new Date}})}catch(e){console.warn("[EMAIL_SERVICE] Warning: Could not save message log to DB:",e)}return{success:!0,deliveryStatus:h,recipient:n,schoolName:a,portalUrl:f,subject:u}}catch(e){return console.error("[EMAIL_SERVICE] Failed to dispatch registration success email:",e),{success:!1,error:e.message}}}},68476:(e,a,t)=>{t.d(a,{Ed:()=>f,basePrisma:()=>n,pK:()=>u,rG:()=>p,uQ:()=>g});var o=t(53524),i=t(24313);let r=globalThis.__prismaBaseClient,n=r&&r.paymentProof?r:new o.PrismaClient;globalThis.__prismaBaseClient=n,globalThis.__admissionsPrismaMiddlewareAttached||"function"!=typeof n.$use||(globalThis.__admissionsPrismaMiddlewareAttached=!0,n.$use(async(e,a)=>{let t=await a(e);return"AdmissionLead"===e.model&&("create"!==e.action||t?.status!=="INQUIRY"&&t?.status?("update"===e.action||"upsert"===e.action)&&t?.status==="INQUIRY"&&e.args?.data?.status==="INQUIRY"&&(0,i.v)({leadId:t.id,schoolId:t.schoolId,lead:t}):(0,i.v)({leadId:t.id,schoolId:t.schoolId,lead:t})),t}));let s=globalThis.__prismaTierConnectionPool||new Map;globalThis.__prismaTierConnectionPool=s;let l=["User","Student","Staff","Classroom","Course","FeeTemplate","Invoice","Payment","PaymentProof","Timetable","StudentAttendance","StaffAttendance","Exam","ExamResult","GradeRecord","AcademicRecord","ReportCard","Notice","MessageLog","AcademicTier","Department","PayrollRecord","Transaction","AdmissionLead","TenantTierDatabase","PasswordResetToken","RefreshToken"];function d(e,a,t=!1){return e.$extends({query:{$allModels:{async $allOperations({model:o,operation:r,args:n,query:s}){if(!t&&l.includes(o)&&a){if("create"===r||"createMany"===r)n.data&&(Array.isArray(n.data)?n.data=n.data.map(e=>({...e,schoolId:a})):n.data={...n.data,schoolId:a});else if("findUnique"===r||"findUniqueOrThrow"===r){let t=e[o];if(t&&"function"==typeof t.findFirst){let e={...n.where||{},schoolId:a},i=await t.findFirst({...n,where:e});if(!i&&"findUniqueOrThrow"===r)throw Error(`Record in ${o} not found for tenant ${a}`);return i}}else n.where?n.where={...n.where,schoolId:a}:n.where={schoolId:a}}let d=await s(n);if("AdmissionLead"===o){if("create"===r||"createMany"===r){if(Array.isArray(d))for(let e of d)e?.id&&(e?.status==="INQUIRY"||!e?.status)&&(0,i.v)({leadId:e.id,schoolId:e.schoolId||a,lead:e});else d?.id&&("INQUIRY"===d.status||!d.status)&&(0,i.v)({leadId:d.id,schoolId:d.schoolId||a,lead:d})}else if("update"===r||"upsert"===r){let e=n?.data?.status==="INQUIRY";d?.id&&e&&"INQUIRY"===d.status&&(0,i.v)({leadId:d.id,schoolId:d.schoolId||a,lead:d})}}return d}}}})}class c{static getClientForUrl(e){if(!s.has(e)){let a=new o.PrismaClient({datasources:{db:{url:e}}});s.set(e,a)}return s.get(e)}static async resolveTierDbUrl(e,a){if(!a)return null;try{let t="string"==typeof a?a:a.tierName,o="object"==typeof a?a.tierId:void 0;if("string"==typeof a&&(a.length>20||a.includes("-")))try{let e=await n.academicTier.findUnique({where:{id:a},select:{id:!0,name:!0,databaseUrl:!0}});if(e){if(e.databaseUrl)return e.databaseUrl;t=e.name,o=e.id}}catch{}if(o){let e=await n.academicTier.findUnique({where:{id:o},select:{databaseUrl:!0}});if(e?.databaseUrl)return e.databaseUrl}if(t){let a=await n.tenantTierDatabase.findFirst({where:{schoolId:e,status:"ACTIVE",OR:[{tierName:{equals:t,mode:"insensitive"}},{tierName:{contains:t,mode:"insensitive"}}]},select:{databaseUrl:!0}});if(a?.databaseUrl)return a.databaseUrl;let o=await n.academicTier.findFirst({where:{schoolId:e,OR:[{name:{equals:t,mode:"insensitive"}},{name:{contains:t,mode:"insensitive"}}]},select:{databaseUrl:!0}});if(o?.databaseUrl)return o.databaseUrl}return null}catch(e){return console.warn(`[CONNECTION_ROUTER] Error resolving tier database URL (${e?.message||e}). Falling back to primary DB.`),null}}static async getClient(e,a){let t=await this.resolveTierDbUrl(e,a);if(t)try{let a=this.getClientForUrl(t);return d(a,e)}catch(e){console.warn(`[CONNECTION_ROUTER] Failed connecting to tier DB: ${t}. Falling back to default database.`)}return d(n,e)}}function p(e,a){return d(n,e)}async function f(e,a){try{if(!e||!a)return d(n,e||"");let t=await n.school.findUnique({where:{id:e},select:{databaseUrl:!0,tierDatabasesConfig:!0,nurseryDbUrl:!0,primaryDbUrl:!0,secondaryDbUrl:!0,isMultiDbEnabled:!0}}),o=null,i=a.toUpperCase().trim();if((i.includes("NURSERY")||i.includes("DAYCARE"))&&t?.nurseryDbUrl?o=t.nurseryDbUrl:i.includes("PRIMARY")&&!i.includes("SECONDARY")&&t?.primaryDbUrl?o=t.primaryDbUrl:i.includes("SECONDARY")&&!i.includes("PRIMARY")&&t?.secondaryDbUrl&&(o=t.secondaryDbUrl),!o&&t?.tierDatabasesConfig&&"object"==typeof t.tierDatabasesConfig){let e=t.tierDatabasesConfig;for(let[a,t]of Object.entries(e))if(i.includes(a.toUpperCase())||a.toUpperCase().includes(i)){o=t;break}}if(o||(o=await c.resolveTierDbUrl(e,a)),o)try{let a=c.getClientForUrl(o);return d(a,e)}catch(t){console.warn(`[SAFETY_FALLBACK] Failed to initialize dynamic PrismaClient for tier "${a}" on tenant "${e}" (${t?.message||t}). Falling back to main tenant database.`)}return d(n,e)}catch(t){return console.warn(`[SAFETY_FALLBACK] getPrismaClientForTier caught exception for tenant "${e}", tier "${a}":`,t?.message||t),d(n,e)}}function g(e){e?s.delete(e):s.clear()}async function u(e,a,t){try{let o=await e.academicTier.findFirst({where:{schoolId:a,OR:[...t.id?[{id:t.id}]:[],...t.name?[{name:{equals:t.name,mode:"insensitive"}},{name:{contains:t.name,mode:"insensitive"}}]:[]]}});if(!o&&t.name)try{o=await e.academicTier.create({data:{id:t.id||`${a}-${t.name.toLowerCase().replace(/[^a-z0-9]/g,"-")}`,name:t.name,schoolId:a,level:t.level??1}})}catch{o=await e.academicTier.findFirst({where:{schoolId:a}})}return o||(o=await e.academicTier.findFirst()),o?.id||t.id||"default-tier"}catch(e){return console.warn("[ROUTER] Failed to resolve tier ID in tier database:",e?.message||e),t.id||"default-tier"}}}};