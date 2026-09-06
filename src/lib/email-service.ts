import { AdmissionLead, School } from "@prisma/client";

/**
 * Mock Email Service for sending transactional emails.
 * In a real production environment, this would integrate with SendGrid, AWS SES, or Nodemailer.
 */
export async function sendAdmissionOfferEmail(
  lead: AdmissionLead,
  school: School,
  token: string
) {
  // Generate the absolute secure link
  // Use localhost in dev, or real domain in prod
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const secureLink = `${baseUrl}/${school.subdomain}/admissions/accept?token=${token}`;

  const brandColor = (school as any).branding?.primaryColor || "#0f172a";

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admission Offer - ${school.name}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px; }
        .container { max-w-lg: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background-color: ${brandColor}; padding: 30px 40px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 40px; color: #334155; line-height: 1.6; }
        .content p { margin: 0 0 16px 0; font-size: 16px; }
        .details-box { background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${brandColor}; }
        .details-box p { margin: 8px 0; font-size: 15px; }
        .details-box strong { color: #0f172a; }
        .action-container { text-align: center; margin: 40px 0 20px 0; }
        .button { background-color: ${brandColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: opacity 0.2s; }
        .footer { padding: 20px 40px; text-align: center; color: #94a3b8; font-size: 14px; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${school.name}</h1>
        </div>
        <div class="content">
          <p>Dear ${lead.parentName || "Parent/Guardian"},</p>
          <p>We are absolutely thrilled to inform you that <strong>${lead.applicantName}</strong> has been offered admission to ${school.name}!</p>
          
          <div class="details-box">
            <p><strong>Applicant:</strong> ${lead.applicantName}</p>
            <p><strong>Target Class:</strong> ${lead.targetGrade}</p>
            <p><strong>Reference ID:</strong> ${lead.id.split('-')[0].toUpperCase()}</p>
          </div>
          
          <p>To finalize enrollment and secure the placement, please review the offer details and submit your decision through our secure portal.</p>
          
          <div class="action-container">
            <a href="${secureLink}" class="button">Review Admission Offer</a>
          </div>
          
          <p style="font-size: 14px; color: #64748b; text-align: center;">This secure link is unique to your application and will expire in 7 days.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ${school.name}. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  // In a real application, you would use a service like Nodemailer here.
  console.log("----------------------------------------------------------------");
  console.log(`[EMAIL DISPATCH] Mocking email send to: ${lead.parentEmail || lead.parentContact}`);
  console.log(`Subject: 🎉 Admission Offer - ${school.name}`);
  console.log(`Token Link: ${secureLink}`);
  console.log("----------------------------------------------------------------");
  
  // Return the HTML for local testing or debugging
  return emailHtml;
}
