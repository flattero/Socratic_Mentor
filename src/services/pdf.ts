import { jsPDF } from "jspdf";
import { Message } from "./ai";

export const generatePDF = (messages: Message[], taskSummary: string, feedback?: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(22);
  doc.setTextColor(79, 70, 229); // Brand color
  doc.text("Socratic Session Report", 20, y);
  y += 15;

  // Task Summary
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Learning Goal:", 20, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(taskSummary, pageWidth - 40);
  doc.text(summaryLines, 20, y);
  y += (summaryLines.length * 7) + 10;

  // Feedback Section
  if (feedback) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 70, 229);
    doc.text("Mentor Feedback:", 20, y);
    y += 7;
    doc.setFont("helvetica", "italic");
    doc.setTextColor(50, 50, 50);
    const feedbackLines = doc.splitTextToSize(feedback, pageWidth - 40);
    doc.text(feedbackLines, 20, y);
    y += (feedbackLines.length * 7) + 15;
  }

  // Conversation
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Conversation History:", 20, y);
  y += 10;

  messages.forEach((msg) => {
    const roleText = msg.role === 'user' ? "Student: " : "Mentor: ";
    const contentLines = doc.splitTextToSize(msg.content, pageWidth - 40);
    
    if (y + (contentLines.length * 7) + 10 > 280) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.text(roleText, 20, y);
    
    doc.setFont("helvetica", "normal");
    doc.text(contentLines, 20, y + 7);
    y += (contentLines.length * 7) + 12;
  });

  doc.save("socratic-session-report.pdf");
};
