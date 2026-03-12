import { jsPDF } from "jspdf";
import { Message } from "./ai";

export const generatePDF = (messages: Message[], taskSummary: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(20);
  doc.text("Socratic Session Transcript", 20, y);
  y += 15;

  // Task Summary
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Task Expectations:", 20, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(taskSummary, pageWidth - 40);
  doc.text(summaryLines, 20, y);
  y += (summaryLines.length * 7) + 10;

  // Conversation
  doc.setFont("helvetica", "bold");
  doc.text("Conversation History:", 20, y);
  y += 10;

  messages.forEach((msg) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    const roleText = msg.role === 'user' ? "Student: " : "Mentor: ";
    doc.text(roleText, 20, y);
    
    doc.setFont("helvetica", "normal");
    const contentLines = doc.splitTextToSize(msg.content, pageWidth - 40);
    
    // Check if we need a new page for the content
    if (y + (contentLines.length * 7) > 280) {
        doc.addPage();
        y = 20;
    }
    
    doc.text(contentLines, 20, y + 7);
    y += (contentLines.length * 7) + 12;
  });

  doc.save("socratic-session.pdf");
};
