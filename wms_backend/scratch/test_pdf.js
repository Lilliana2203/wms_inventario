const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument();
const outputPath = path.join(__dirname, 'test_output.pdf');
doc.pipe(fs.createWriteStream(outputPath));

doc.fontSize(16).text('Probar caracteres de colón en PDFKit con Helvetica estándar:');
doc.moveDown();

// Probando con colón original
try {
  doc.fontSize(12).text('₡ 55 000,00 (Original)');
} catch (e) {
  doc.text(`Error original: ${e.message}`);
}

// Probando con cent sign (¢)
doc.text('¢55 000,00 (Con cent sign unicode)');
doc.text('¢ 55 000,00 (Con cent sign y espacio)');

// Probando con CRC
doc.text('CRC 55 000,00 (Con CRC)');

doc.end();
console.log('PDF de prueba generado en:', outputPath);
