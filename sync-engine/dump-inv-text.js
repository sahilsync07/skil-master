const fs = require('fs');
const { PDFParse } = require('pdf-parse');

(async () => {
  const parser66 = new PDFParse({ url: 'android-app/www/documents/ajanta/066 - 1900422215 - Alaka Nayagarh - 28-10-26.pdf' });
  const text66 = await parser66.getText();
  
  // Find invoice 73
  const files = fs.readdirSync('android-app/www/documents/ajanta');
  const f73 = files.find(f => f.includes('1900424231'));
  let text73 = { text: '' };
  if (f73) {
    const parser73 = new PDFParse({ url: 'android-app/www/documents/ajanta/' + f73 });
    text73 = await parser73.getText();
  }

  fs.writeFileSync('sync-engine/inv66_text.txt', text66.text);
  if (f73) fs.writeFileSync('sync-engine/inv73_text.txt', text73.text);
  console.log('Saved PDF text for 66 and 73');
})();
