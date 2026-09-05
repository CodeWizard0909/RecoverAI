import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  try {
    const targetEmail = process.env.RESEND_TARGET_EMAIL;

    if (!targetEmail) {
      throw new Error("Missing RESEND_TARGET_EMAIL in env");
    }

    const { data, error } = await resend.emails.send({
      from: 'RecoverAI <onboarding@resend.dev>', // resend.dev allows sending to your own verified email without domain verification
      to: [targetEmail],
      subject: 'Action Required: Secure Payment Link',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; background-color: #f9fafb; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #10b981; margin: 0;">RecoverAI</h1>
            <p style="color: #6b7280; margin-top: 5px;">Secure Financial Retention Team</p>
          </div>
          
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h2 style="color: #111827; margin-top: 0;">Secure Payment Link</h2>
            <p style="color: #374151; font-size: 16px; line-height: 1.5;">
              Hi there,
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.5;">
              As discussed with Sarah, your AI support agent, here is your secure fallback payment link to resolve your recent transaction failure.
            </p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="https://rzp.io/l/demo-recover-link" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
                Pay Securely via Razorpay
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
              If you have any questions, simply reply to this email or request another call with Sarah.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
            &copy; ${new Date().getFullYear()} RecoverAI Demo
          </div>
        </div>
      `
    });

    if (error) {
      console.error("[Resend Error]", error);
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[Email Route Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
