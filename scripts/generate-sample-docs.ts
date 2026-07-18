/**
 * Generate realistic mock OPD documents (prescription + bill) as PDFs, following
 * the layouts in sample_documents_guide.md. Upload these to the app's "Upload
 * docs" tab to exercise Gemini extraction -> adjudication end-to-end.
 *
 * Run: npm run gen:docs   (outputs to ./sample-documents)
 */
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

interface SampleSpec {
  file: string;
  expected: string;
  clinic: string;
  gst: string;
  doctor: string;
  qualification: string;
  reg: string;
  date: string; // DD/MM/YYYY
  patient: string;
  age: string;
  diagnosis: string;
  complaints: string[];
  rx: string[];
  investigations: string[];
  billLines: Array<[string, number]>;
}

const OUT_DIR = path.join(process.cwd(), "sample-documents");

const SAMPLES: SampleSpec[] = [
  {
    file: "tc001-consultation-APPROVED.pdf",
    expected: "APPROVED ~Rs.1350 (10% co-pay on Rs.1500)",
    clinic: "Sunrise Family Clinic",
    gst: "29ABCDE1234F1Z5",
    doctor: "Dr. A. Sharma",
    qualification: "MBBS, MD (Internal Medicine)",
    reg: "KA/45678/2015",
    date: "01/11/2024",
    patient: "Rajesh Kumar",
    age: "34 / Male",
    diagnosis: "Viral fever",
    complaints: ["Fever x 3 days", "Body ache", "Headache"],
    rx: ["Tab. Paracetamol 650mg  1-1-1 x 5 days", "Tab. Vitamin C  0-1-0 x 5 days"],
    investigations: ["Complete Blood Count (CBC)", "Dengue NS1 Antigen"],
    billLines: [
      ["Consultation Fee", 1000],
      ["Diagnostic Tests (CBC + Dengue)", 500],
    ],
  },
  {
    file: "tc002-dental-PARTIAL.pdf",
    expected: "PARTIAL Rs.8000 (root canal covered, whitening = cosmetic, rejected)",
    clinic: "SmileCare Dental Studio",
    gst: "27PQRSX6789K2Z1",
    doctor: "Dr. R. Patel",
    qualification: "BDS, MDS (Endodontics)",
    reg: "MH/23456/2018",
    date: "15/10/2024",
    patient: "Priya Singh",
    age: "29 / Female",
    diagnosis: "Tooth decay requiring root canal",
    complaints: ["Severe tooth pain (lower right molar)", "Sensitivity to cold"],
    rx: ["Tab. Amoxicillin 500mg  1-0-1 x 5 days", "Tab. Ibuprofen 400mg  SOS"],
    investigations: ["Dental X-Ray (IOPA)"],
    billLines: [
      ["Root Canal Treatment", 8000],
      ["Teeth Whitening", 4000],
    ],
  },
  {
    file: "tc010-network-cashless-APPROVED.pdf",
    expected: "APPROVED Rs.3600 (20% network discount), cashless",
    clinic: "Apollo Hospitals",
    gst: "33APOLL9876H1Z9",
    doctor: "Dr. S. Iyer",
    qualification: "MBBS, MD (Pulmonology)",
    reg: "TN/56789/2013",
    date: "03/11/2024",
    patient: "Deepak Shah",
    age: "41 / Male",
    diagnosis: "Acute bronchitis",
    complaints: ["Persistent cough x 1 week", "Chest congestion", "Low-grade fever"],
    rx: ["Tab. Azithromycin 500mg  1-0-0 x 3 days", "Syp. Bronchodilator  10ml TDS"],
    investigations: ["Chest X-Ray"],
    billLines: [
      ["Consultation Fee", 1500],
      ["Medicines", 3000],
    ],
  },
  {
    file: "tc003-over-limit-REJECTED.pdf",
    expected: "REJECTED (PER_CLAIM_EXCEEDED — Rs.7500 > Rs.5000 per-claim limit)",
    clinic: "City Care Polyclinic",
    gst: "07GUPTA4321M1Z3",
    doctor: "Dr. M. Gupta",
    qualification: "MBBS, MD (Gastroenterology)",
    reg: "DL/34567/2016",
    date: "20/10/2024",
    patient: "Amit Verma",
    age: "38 / Male",
    diagnosis: "Gastroenteritis",
    complaints: ["Loose stools x 2 days", "Abdominal cramps", "Dehydration"],
    rx: ["Tab. Ofloxacin + Ornidazole  1-0-1 x 5 days", "Cap. Probiotics  1-0-1 x 7 days"],
    investigations: ["Stool Routine", "Serum Electrolytes"],
    billLines: [
      ["Consultation Fee", 2000],
      ["Medicines", 5500],
    ],
  },
];

const RUPEE = "Rs."; // Helvetica has no rupee glyph; use "Rs." so amounts read cleanly.

function buildPdf(spec: SampleSpec): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = fs.createWriteStream(path.join(OUT_DIR, spec.file));
    doc.pipe(stream);
    stream.on("finish", () => resolve());
    stream.on("error", reject);

    const line = () => doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke().moveDown(0.5);
    const total = spec.billLines.reduce((s, [, a]) => s + a, 0);

    // ── Prescription ─────────────────────────────────────────────
    doc.fontSize(18).fillColor("#5b21b6").text(spec.clinic, { align: "center" });
    doc.fontSize(10).fillColor("#444").text(`${spec.doctor}, ${spec.qualification}`, { align: "center" });
    doc.text(`Reg. No: ${spec.reg}`, { align: "center" });
    doc.moveDown(0.5);
    line();

    doc.fillColor("#000").fontSize(11);
    doc.text(`Date: ${spec.date}`);
    doc.moveDown(0.3);
    doc.text(`Patient Name: ${spec.patient}`);
    doc.text(`Age / Sex: ${spec.age}`);
    doc.moveDown(0.5);

    doc.font("Helvetica-Bold").text("Chief Complaints:");
    doc.font("Helvetica");
    spec.complaints.forEach((c) => doc.text(`  - ${c}`));
    doc.moveDown(0.3);

    doc.font("Helvetica-Bold").text("Diagnosis:");
    doc.font("Helvetica").text(`  ${spec.diagnosis}`);
    doc.moveDown(0.3);

    doc.font("Helvetica-Bold").text("Rx (Prescription):");
    doc.font("Helvetica");
    spec.rx.forEach((r, i) => doc.text(`  ${i + 1}. ${r}`));
    doc.moveDown(0.3);

    doc.font("Helvetica-Bold").text("Investigations Advised:");
    doc.font("Helvetica");
    spec.investigations.forEach((t) => doc.text(`  - ${t}`));
    doc.moveDown(1);
    doc.text("Signature: ____________________        [Doctor's Stamp]");

    // ── Bill ─────────────────────────────────────────────────────
    doc.moveDown(2);
    line();
    doc.fontSize(14).fillColor("#5b21b6").text("TAX INVOICE / MEDICAL BILL", { align: "center" });
    doc.fontSize(10).fillColor("#444").text(`${spec.clinic}   |   GST No: ${spec.gst}`, { align: "center" });
    doc.moveDown(0.5);
    line();

    doc.fillColor("#000").fontSize(11);
    doc.text(`Bill No: INV-${spec.reg.replace(/\W/g, "").slice(-5)}        Date: ${spec.date}`);
    doc.text(`Patient: ${spec.patient}        Ref. By: ${spec.doctor}`);
    doc.moveDown(0.5);

    // Render each row as two INDEPENDENT positioned texts (no `continued`, which
    // makes pdfkit ignore the column x-position and jumble the amounts).
    const labelX = 50;
    const amtX = 380;
    const amtW = 165;
    const row = (label: string, amount: string, bold = false) => {
      const y = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica");
      doc.text(label, labelX, y, { width: 300 });
      doc.text(amount, amtX, y, { width: amtW, align: "right" });
      doc.font("Helvetica");
      doc.y = y + 18;
    };

    row("PARTICULARS", "AMOUNT", true);
    line();
    spec.billLines.forEach(([label, amt]) => row(label, `${RUPEE} ${amt.toLocaleString("en-IN")}`));
    line();
    row("TOTAL", `${RUPEE} ${total.toLocaleString("en-IN")}`, true);
    doc.moveDown(1);
    doc.text("Payment Mode: UPI        [Authorized Signatory]");

    // Footer note (visible label for the tester; harmless to extraction).
    doc.moveDown(2).fontSize(8).fillColor("#999").text(`Sample document — expected outcome: ${spec.expected}`, {
      align: "center",
    });

    doc.end();
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const spec of SAMPLES) {
    await buildPdf(spec);
    console.log(`✓ ${spec.file}  →  ${spec.expected}`);
  }
  console.log(`\nGenerated ${SAMPLES.length} PDF(s) in ./sample-documents`);
  console.log("Upload one in the app's 'Upload docs' tab to test extraction + adjudication.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
