"use strict";
/* Minimal .xlsx writer: stored (uncompressed) zip + inline strings. No dependencies.
   XL.build([{name, rtl, widths:[..], rows:[[cell,...],...]}]) -> Uint8Array
   cell = string | number | null | {v, s}   (s: 1 title, 2 section, 3 table head, 4 bordered) */
const XL=(()=>{
  const enc=new TextEncoder();
  const crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
  const crc=b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=crcT[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
  function zip(files){
    const parts=[],cen=[];let off=0;
    for(const f of files){
      const nm=enc.encode(f.name),d=enc.encode(f.text),c=crc(d);
      const h=new DataView(new ArrayBuffer(30));
      h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(12,0x21,true);
      h.setUint32(14,c,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nm.length,true);
      parts.push(new Uint8Array(h.buffer),nm,d);
      const e=new DataView(new ArrayBuffer(46));
      e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x0800,true);e.setUint16(14,0x21,true);
      e.setUint32(16,c,true);e.setUint32(20,d.length,true);e.setUint32(24,d.length,true);e.setUint16(28,nm.length,true);e.setUint32(42,off,true);
      cen.push(new Uint8Array(e.buffer),nm);
      off+=30+nm.length+d.length;
    }
    const cs=cen.reduce((a,b)=>a+b.length,0);
    const end=new DataView(new ArrayBuffer(22));
    end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,cs,true);end.setUint32(16,off,true);
    const all=[...parts,...cen,new Uint8Array(end.buffer)];
    const out=new Uint8Array(all.reduce((a,b)=>a+b.length,0));let p=0;
    for(const a of all){out.set(a,p);p+=a.length;}
    return out;
  }
  const esc=s=>String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const colName=i=>{let s="";i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=(i-m-1)/26;}return s;};
  const HEAD='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const NS='xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const STYLES=HEAD+`<styleSheet ${NS}>`
    +'<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    +'<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    +'<fill><patternFill patternType="solid"><fgColor rgb="FFF2D9C7"/><bgColor indexed="64"/></patternFill></fill>'
    +'<fill><patternFill patternType="solid"><fgColor rgb="FFE4E9ED"/><bgColor indexed="64"/></patternFill></fill></fills>'
    +'<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'
    +'<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>'
    +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    +'<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    +'<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    +'<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
    +'<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" wrapText="1"/></xf>'
    +'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/></cellXfs>'
    +'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  function sheetXml(sh){
    let x=HEAD+`<worksheet ${NS}><sheetViews><sheetView workbookViewId="0"${sh.rtl?' rightToLeft="1"':''}/></sheetViews>`;
    if(sh.widths&&sh.widths.length)x+="<cols>"+sh.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")+"</cols>";
    x+="<sheetData>";
    sh.rows.forEach((row,r)=>{
      x+=`<row r="${r+1}">`;
      row.forEach((cell,c)=>{
        let v=cell,s=0; if(cell&&typeof cell==="object"){v=cell.v;s=cell.s||0;}
        if(v==null||v===""){ if(s)x+=`<c r="${colName(c)}${r+1}" s="${s}"/>`; return; }
        const ref=`r="${colName(c)}${r+1}"`+(s?` s="${s}"`:"");
        if(typeof v==="number"&&isFinite(v))x+=`<c ${ref}><v>${v}</v></c>`;
        else x+=`<c ${ref} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
      });
      x+="</row>";
    });
    return x+"</sheetData></worksheet>";
  }
  function build(sheets){
    const names=[];
    sheets.forEach((s,i)=>{let n=String(s.name||"Sheet"+(i+1)).replace(/[\[\]:*?\/\\]/g," ").slice(0,31)||"Sheet"+(i+1);while(names.includes(n))n=n.slice(0,28)+" "+(i+1);names.push(n);});
    const files=[
      {name:"[Content_Types].xml",text:HEAD+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        +sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")+"</Types>"},
      {name:"_rels/.rels",text:HEAD+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
      {name:"xl/workbook.xml",text:HEAD+`<workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>`
        +names.map((n,i)=>`<sheet name="${esc(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")+"</sheets></workbook>"},
      {name:"xl/_rels/workbook.xml.rels",text:HEAD+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        +sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")
        +`<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
      {name:"xl/styles.xml",text:STYLES},
      ...sheets.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,text:sheetXml(s)}))
    ];
    return zip(files);
  }
  return {build};
})();
if(typeof module!=="undefined")module.exports=XL;
