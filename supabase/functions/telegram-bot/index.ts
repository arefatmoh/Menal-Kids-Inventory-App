import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1?target=deno";
import autoTable from "https://esm.sh/jspdf-autotable@3.8.2?target=deno";

const ABYSSINICA_SIL_BASE64 = ""; // Leave blank or fill with valid base64

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();

    // 1. Handle Telegram Webhook Updates
    if (body.message && body.message.text) {
      const text = body.message.text.trim();
      const chatId = body.message.chat.id.toString();

      if (text === "/start menal") {
        const { error } = await supabaseClient
          .from("menal_telegram_subscribers")
          .upsert(
            {
              chat_id: chatId,
              username: body.message.chat.username || "",
              first_name: body.message.chat.first_name || "",
              last_name: body.message.chat.last_name || "",
              last_interaction: new Date().toISOString()
            },
            { onConflict: 'chat_id' }
          );

        const { data: config } = await supabaseClient.from("menal_telegram_config").select("bot_token").single();

        if (config?.bot_token) {
          const msg = error 
            ? `❌ DB Error: ${error.message}` 
            : `✅ Connection Successful!\n\nWelcome ${body.message.chat.first_name || 'User'}, you are now connected to the Menal Kids Inventory System.`;
            
          await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: msg }),
          });
        }
      }
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // 2. Handle Admin Actions
    if (body.action) {
      const { data: config } = await supabaseClient.from("menal_telegram_config").select("bot_token").single();
      if (!config?.bot_token) throw new Error("Bot token not configured");
      const TELEGRAM_API = `https://api.telegram.org/bot${config.bot_token}`;

      if (body.action === "setup_webhook") {
        const url = new URL(req.url);
        const webhookUrl = `${url.origin}${url.pathname}`;
        const res = await fetch(`${TELEGRAM_API}/setWebhook?url=${webhookUrl}`);
        const data = await res.json();
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (body.action === "blast_test") {
        const { data: subscribers } = await supabaseClient.from("menal_telegram_subscribers").select("chat_id, first_name");
        if (subscribers) {
          for (const sub of subscribers) {
            await fetch(`${TELEGRAM_API}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: sub.chat_id, text: `🔔 Test Message from Menal Kids Admin.\n\nHello ${sub.first_name}, if you see this, your connection is active!` }),
            });
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (body.action === "push_daily_report") {
        const targetChatId = body.target_chat_id;
        if (!targetChatId) throw new Error("Missing target_chat_id");

        const { data: branches } = await supabaseClient.from('menal_branches').select('id, name');
        if (!branches || branches.length === 0) throw new Error("No branches found");

        const todayStr = new Date().toISOString().split('T')[0];
        let overallMessage = `🌙 *Menal Kids Daily Flash* (${todayStr})\n\n`;

        // Generate PDF securely in Deno
        const doc = new jsPDF();
        if (ABYSSINICA_SIL_BASE64) {
          doc.addFileToVFS("AbyssinicaSIL.ttf", ABYSSINICA_SIL_BASE64);
          doc.addFont("AbyssinicaSIL.ttf", "Abyssinica", "normal");
          doc.setFont("Abyssinica");
        }

        doc.setFontSize(18);
        doc.text("Menal Kids - Daily Sales Report", 14, 20);
        doc.setFontSize(12);
        doc.text(`Date: ${todayStr}`, 14, 28);

        let startY = 35;

        for (const branch of branches) {
          const { data: sales } = await supabaseClient
            .from('menal_sales')
            .select(`
              id, final_total, payment_method,
              menal_sale_items(quantity, price, product_name)
            `)
            .eq('branch_id', branch.id)
            .gte('created_at', `${todayStr}T00:00:00Z`)
            .lte('created_at', `${todayStr}T23:59:59Z`);

          const branchSales = sales || [];
          const totalSales = branchSales.reduce((sum, s) => sum + (s.final_total || 0), 0);

          overallMessage += `🏪 *Branch: ${branch.name}*\n`;
          overallMessage += `💰 Total Sales: ${totalSales} br\n`;
          overallMessage += `📦 Transactions: ${branchSales.length}\n\n`;

          doc.setFontSize(14);
          doc.text(`Branch: ${branch.name}`, 14, startY);
          
          const tableData = branchSales.flatMap(sale => {
            return sale.menal_sale_items.map((item: any) => [
              sale.id.slice(0, 8),
              item.product_name || 'Unknown',
              item.quantity,
              item.price,
              item.quantity * item.price,
              sale.payment_method
            ]);
          });

          if (tableData.length > 0) {
            autoTable(doc, {
              startY: startY + 5,
              head: [['Sale ID', 'Product', 'Qty', 'Price', 'Total', 'Payment']],
              body: tableData,
              styles: { font: ABYSSINICA_SIL_BASE64 ? "Abyssinica" : "helvetica" }
            });
            startY = (doc as any).lastAutoTable.finalY + 15;
          } else {
            doc.setFontSize(10);
            doc.text("No sales recorded today.", 14, startY + 8);
            startY += 15;
          }
        }

        // Safely extract ArrayBuffer and convert to Blob for Deno compatibility
        const arrayBuffer = doc.output('arraybuffer');
        const pdfBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
        
        const formData = new FormData();
        formData.append("chat_id", targetChatId);
        formData.append("caption", overallMessage);
        formData.append("parse_mode", "Markdown");
        formData.append("document", pdfBlob, `Menal_Daily_Report_${todayStr}.pdf`);

        const res = await fetch(`${TELEGRAM_API}/sendDocument`, {
          method: "POST",
          body: formData,
        });
        
        const resData = await res.json();
        return new Response(JSON.stringify(resData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Function error:", error);
    // Return standard error response instead of crashing connection
    return new Response(JSON.stringify({ error: error?.message || "Unknown Function Error" }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
