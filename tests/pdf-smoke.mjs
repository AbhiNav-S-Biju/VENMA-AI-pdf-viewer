import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const validSinglePage = createTextPdf(["VENMA local text PDF smoke test."]);
const validMultiPage = createTextPdf([
  "VENMA multi page PDF page one.",
  "VENMA multi page PDF page two."
]);
const invalidFile = new TextEncoder().encode("This is not a PDF.");

await assertPdfText(validSinglePage, 1, ["VENMA local text PDF smoke test."]);
await assertPdfText(validMultiPage, 2, [
  "VENMA multi page PDF page one.",
  "VENMA multi page PDF page two."
]);
await assertInvalidPdf(invalidFile);

console.log("pdf-smoke ok: 2 valid PDFs opened, invalid file rejected");

async function assertPdfText(bytes, expectedPageCount, expectedTextByPage) {
  const document = await getDocument({ data: bytes }).promise;

  if (document.numPages !== expectedPageCount) {
    throw new Error(`Expected ${expectedPageCount} pages, got ${document.numPages}.`);
  }

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str).join(" ");

    if (!text.includes(expectedTextByPage[pageNumber - 1])) {
      throw new Error(`Expected page ${pageNumber} text to include expected fixture text.`);
    }

    page.cleanup();
  }

  await document.cleanup();
}

async function assertInvalidPdf(bytes) {
  try {
    await getDocument({ data: bytes }).promise;
  } catch {
    return;
  }

  throw new Error("Invalid PDF fixture unexpectedly opened.");
}

function createTextPdf(pageTexts) {
  const objects = [];
  const pageObjectIds = [];
  const contentObjectIds = [];
  const fontObjectId = 3 + pageTexts.length;

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";

  for (let index = 0; index < pageTexts.length; index += 1) {
    const pageObjectId = 3 + index;
    const contentObjectId = fontObjectId + 1 + index;

    pageObjectIds.push(pageObjectId);
    contentObjectIds.push(contentObjectId);

    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 ${fontObjectId} 0 R >> >> ` +
      `/Contents ${contentObjectId} 0 R >>`;
  }

  objects[2] =
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] ` +
    `/Count ${pageTexts.length} >>`;

  objects[fontObjectId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  for (let index = 0; index < pageTexts.length; index += 1) {
    const stream = `BT /F1 18 Tf 72 720 Td (${escapePdfText(pageTexts[index])}) Tj ET`;
    objects[contentObjectIds[index]] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }

  let body = "%PDF-1.7\n";
  const offsets = [0];

  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    if (!objects[objectId]) {
      continue;
    }

    offsets[objectId] = byteLength(body);
    body += `${objectId} 0 obj\n${objects[objectId]}\nendobj\n`;
  }

  const xrefOffset = byteLength(body);
  body += `xref\n0 ${objects.length}\n`;
  body += "0000000000 65535 f \n";

  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    body += `${String(offsets[objectId]).padStart(10, "0")} 00000 n \n`;
  }

  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(body);
}

function escapePdfText(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}
