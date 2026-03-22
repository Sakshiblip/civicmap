import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { issue_type, lat, lng, new_status, email } = await req.json()

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not set")
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "NagarSeva <onboarding@resend.dev>",
        to: [email],
        subject: `Status Update: ${issue_type}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #10b981;">NagarSeva Update</h2>
            <p>Dear Citizen,</p>
            <p>We are writing to inform you that the status of your reported issue has been updated.</p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Issue Type:</strong> ${issue_type}</p>
              <p style="margin: 5px 0;"><strong>Location:</strong> [${lat.toFixed(4)}, ${lng.toFixed(4)}]</p>
              <p style="margin: 5px 0;"><strong>New Status:</strong> <span style="text-transform: uppercase; font-weight: bold; color: ${new_status === 'resolved' ? '#10b981' : new_status === 'in_progress' ? '#f59e0b' : '#ef4444'};">${new_status.replace('_', ' ')}</span></p>
            </div>
            <p>Thank you for helping us keep our city clean and safe.</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
              This is an automated notification from NagarSeva. Please do not reply to this email.
            </p>
          </div>
        `,
      }),
    })

    const data = await res.json()
    console.log("Resend API response:", data)

    return new Response(JSON.stringify({ success: res.ok, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: res.ok ? 200 : 400,
    })
  } catch (error) {
    console.error("Error in notify-status-change:", error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
