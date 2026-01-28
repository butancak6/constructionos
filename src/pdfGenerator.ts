import jsPDF from "jspdf";
import { invoke } from "@tauri-apps/api/core";

interface Invoice {
    id: string;
    client: string;
    amount: number;
    status: string;
    description: string;
    client_phone?: string;
    client_company?: string;
}

export async function generateInvoicePDF(invoice: Invoice) {
    try {
        console.log("Starting PDF generation...");
        // alert("Starting PDF generation..."); // Removed intrusive alert

        const doc = new jsPDF();

        // 1. Large Header
        doc.setFontSize(30);
        doc.setTextColor(40);
        doc.text("INVOICE", 105, 30, { align: "center" });

        // 2. Client & ID Info
        doc.setFontSize(14);
        doc.setTextColor(0);

        let yPos = 60;
        doc.text(`Client:  ${invoice.client}`, 20, yPos);
        yPos += 7;

        if (invoice.client_company) {
            doc.setFontSize(12);
            doc.setTextColor(100);
            doc.text(invoice.client_company, 20, yPos);
            yPos += 7;
            doc.setFontSize(14);
            doc.setTextColor(0);
        }

        if (invoice.client_phone) {
            doc.setFontSize(12);
            doc.setTextColor(100);
            doc.text(invoice.client_phone, 20, yPos);
            yPos += 10; // Extra spacing
            doc.setFontSize(14);
            doc.setTextColor(0);
        } else {
            yPos += 3;
        }

        doc.text(`ID:      ${invoice.id}`, 20, yPos);
        yPos += 10;
        doc.text(`Date:    ${new Date().toLocaleDateString()}`, 20, yPos);

        // 3. Horizontal Line
        yPos += 10;
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(20, yPos, 190, yPos);

        // 4. Line Item (Dynamic Description)
        yPos += 20;
        doc.setFontSize(16);
        doc.text(invoice.description || "General Services", 20, yPos);
        doc.text(`$${invoice.amount.toFixed(2)}`, 160, yPos);

        // 5. Total Amount (Large at bottom)
        doc.setFontSize(40);
        doc.setTextColor(0);
        doc.text(`$${invoice.amount.toFixed(2)}`, 105, 160, { align: "center" });

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text("Total Due", 105, 175, { align: "center" });

        // 6. Save via Backend
        const pdfData = doc.output("datauristring");
        console.log(`Frontend: Generated PDF data of length: ${pdfData.length}`);
        
        const path = await invoke("save_invoice_pdf", {
            id: invoice.id,
            pdfData: pdfData
        });

        console.log("PDF saved successfully to:", path);
        return path as string;

    } catch (e: any) {
        console.error("PDF Gen Error:", e);
        throw new Error("PDF Generation Failed: " + e.message);
    }
}
