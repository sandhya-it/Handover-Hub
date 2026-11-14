import { jsPDF } from 'jspdf';
import { Handover, Project } from '../types.ts';

export function exportHandoverToPdf(handover: Handover, project?: Project) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxLineWidth = pageWidth - margin * 2;
  let y = 48;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 48;
    }
  };

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 88, 'F');
  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('HANDOVER HUB  ·  KNOWLEDGE CONTINUITY RECORD', margin, 30);

  doc.setTextColor(248, 250, 252);
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(handover.title, maxLineWidth);
  doc.text(titleLines, margin, 52);

  y = 112;
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);

  const metaLines = [
    `Handover ID: ${handover.id}   |   Version: v${handover.version}   |   Status: ${handover.status}`,
    `Project: ${project?.name || handover.projectId}   |   Scope: ${handover.scope}`,
    `Departing: ${handover.departingMemberName}   ->   Incoming: ${handover.incomingMemberName} (${handover.incomingRole})`,
    `Generated: ${new Date(handover.updatedAt).toLocaleString()}${
      handover.reviewerName ? `   |   Reviewed By: ${handover.reviewerName}` : ''
    }${handover.acknowledgedAt ? `   |   Acknowledged: ${new Date(handover.acknowledgedAt).toLocaleString()}` : ''}`,
  ];

  metaLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, maxLineWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 13;
  });

  y += 10;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  for (const sec of handover.sections) {
    ensureSpace(64);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${sec.number}. ${sec.title}`, margin, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    const bodyLines = doc.splitTextToSize(sec.content || 'No content recorded.', maxLineWidth);
    for (const line of bodyLines) {
      ensureSpace(16);
      doc.text(line, margin, y);
      y += 13;
    }

    if (sec.manualNote) {
      ensureSpace(24);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(71, 85, 105);
      const noteLines = doc.splitTextToSize(`Manual Note: ${sec.manualNote}`, maxLineWidth);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 13;
    }

    if (sec.evidenceRefs.length > 0) {
      ensureSpace(22);
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(37, 99, 235);
      const refStr = `Evidence: ${sec.evidenceRefs
        .map((r) => `${r.claimId} (${r.label} - ${r.verificationStatus})`)
        .join(' | ')}`;
      const refLines = doc.splitTextToSize(refStr, maxLineWidth);
      for (const rl of refLines) {
        ensureSpace(12);
        doc.text(rl, margin, y);
        y += 11;
      }
    }

    y += 12;
  }

  if (handover.nextActions.length > 0) {
    ensureSpace(60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Assigned Next Action Checklist', margin, y);
    y += 16;

    for (const act of handover.nextActions) {
      ensureSpace(28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      const line = `[${act.priority}] ${act.title} — Owner: ${act.owner} | Due: ${act.dueDate}`;
      const wrapped = doc.splitTextToSize(line, maxLineWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 13 + 4;
    }
  }

  const safeFilename = handover.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  doc.save(`${safeFilename || handover.id}-v${handover.version}.pdf`);
}
