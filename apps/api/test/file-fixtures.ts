/** PDF vetorial sintético, duas páginas de cores distintas. Sem dados de clientes. */
export function syntheticPdf(pages = 2): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({length:pages},(_,i) => `${3+i*2} 0 R`).join(' ')}] /Count ${pages} >>`,
  ];
  for (let i=0;i<pages;i++) {
    const stream = `${i%2 ? '0.2 0.4 0.8' : '0.8 0.3 0.2'} rg 20 20 360 260 re f 1 1 1 RG 2 w 40 40 320 220 re S`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Resources << >> /Contents ${4+i*2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  let content = '%PDF-1.7\n', offsets = [0];
  objects.forEach((object,i) => { offsets.push(Buffer.byteLength(content)); content += `${i+1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(content);
  content += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(content);
}
