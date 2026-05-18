// ===== SPPG App - Complete Application =====
'use strict';

// Auth check
const SESSION = JSON.parse(localStorage.getItem('sppg_session')||'null');
if(!SESSION) location.href='index.html';

// ===== DATABASE =====
const DB = {
    prefix: 'sppg_',
    get(k){ return JSON.parse(localStorage.getItem(this.prefix+k)||'[]'); },
    set(k,v){ localStorage.setItem(this.prefix+k, JSON.stringify(v)); },
    id(){ return Date.now().toString(36)+Math.random().toString(36).substr(2,8); },
    add(col, item){ const d=this.get(col); item.id=this.id(); item._at=new Date().toISOString(); d.push(item); this.set(col,d); this.log('add',col,item.nama||item.noNota||''); return item; },
    update(col, id, data){ const d=this.get(col); const i=d.findIndex(x=>x.id===id); if(i>-1){d[i]={...d[i],...data,_up:new Date().toISOString()};this.set(col,d);this.log('edit',col,d[i].nama||d[i].noNota||'');return d[i];} return null; },
    del(col, id){ const d=this.get(col); const item=d.find(x=>x.id===id); this.set(col, d.filter(x=>x.id!==id)); if(item)this.log('delete',col,item.nama||item.noNota||''); },
    find(col,id){ return this.get(col).find(x=>x.id===id)||null; },
    log(act,col,name){ const a=this.get('activity'); a.unshift({act,col,name,t:new Date().toISOString()}); if(a.length>50)a.length=50; this.set('activity',a); },
    stats(){ const p=this.get('penerima'),n=this.get('nota'),today=new Date().toISOString().split('T')[0],mo=today.slice(0,7); return{penerima:p.filter(x=>x.aktif!==false).length,notaToday:n.filter(x=>x.tgl===today).length,pending:n.filter(x=>x.status==='pending').length,done:n.filter(x=>x.status==='completed'&&x.tgl&&x.tgl.startsWith(mo)).length}; },
    exportAll(){ return JSON.stringify({penerima:this.get('penerima'),nota:this.get('nota'),activity:this.get('activity'),_export:new Date().toISOString()}); },
    importAll(json){ try{const d=JSON.parse(json);if(d.penerima)this.set('penerima',d.penerima);if(d.nota)this.set('nota',d.nota);if(d.activity)this.set('activity',d.activity);return true;}catch(e){return false;} }
};

// Seed data from Excel if empty
if(DB.get('penerima').length===0){
    DB.add('penerima',{nik:'3209376507960002',nama:'MIANA',tglLahir:'1996-07-25',jk:'P',ortu:'-',posisi:'1',aktif:true});
}


// ===== INIT =====
document.addEventListener('DOMContentLoaded',()=>{
    initUI();
    initNav();
    initDashboard();
    initMaster();
    initNota();
    initLaporan();
    initSettings();
    tick();
    setInterval(tick,30000);
});

function tick(){ 
    const el=document.getElementById('dateTime');
    if(el) el.textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

// ===== UI INIT =====
function initUI(){
    document.getElementById('userName').textContent=SESSION.name;
    document.getElementById('userRole').textContent=SESSION.role==='admin'?'Administrator':'Operator';
    document.getElementById('btnLogout').onclick=()=>{if(confirm('Keluar?')){localStorage.removeItem('sppg_session');location.href='index.html';}};
    // Mobile
    document.getElementById('menuToggle').onclick=()=>{document.getElementById('sidebar').classList.add('open');document.getElementById('overlay').classList.add('active');};
    document.getElementById('overlay').onclick=()=>{document.getElementById('sidebar').classList.remove('open');document.getElementById('overlay').classList.remove('active');};
}

// ===== NAV =====
function initNav(){
    document.querySelectorAll('.nav-link').forEach(a=>{
        a.onclick=()=>goTo(a.dataset.page);
    });
}
function goTo(page){
    document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active',a.dataset.page===page));
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));
    const titles={dashboard:'Dashboard',master:'Master Data',nota:'Nota Pesanan',laporan:'Laporan',settings:'Pengaturan'};
    document.getElementById('pageTitle').textContent=titles[page]||'';
    if(page==='dashboard')refreshDashboard();
    if(page==='master')refreshMaster();
    if(page==='nota')refreshNota();
    // close mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
}

// ===== TOAST =====
function toast(msg){document.getElementById('toastMsg').textContent=msg;new bootstrap.Toast(document.getElementById('toast'),{delay:3000}).show();}

// ===== DASHBOARD =====
function initDashboard(){refreshDashboard();}
function refreshDashboard(){
    const s=DB.stats();
    document.getElementById('statPenerima').textContent=s.penerima;
    document.getElementById('statNotaToday').textContent=s.notaToday;
    document.getElementById('statPending').textContent=s.pending;
    document.getElementById('statDone').textContent=s.done;
    // Recent nota
    const nota=DB.get('nota').sort((a,b)=>b._at.localeCompare(a._at)).slice(0,5);
    const tb=document.getElementById('recentNota');
    tb.innerHTML=nota.length?nota.map(n=>`<tr><td><strong>${n.noNota}</strong></td><td>${fmtDate(n.tgl)}</td><td>${n.namaPenerima||'-'}</td><td><span class="badge-s badge-${n.status}">${statusLabel(n.status)}</span></td><td><button class="btn btn-icon btn-outline-primary" onclick="goTo('nota')"><i class="fas fa-eye"></i></button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">Belum ada data</td></tr>';
    // Activity
    const acts=DB.get('activity').slice(0,8);
    const al=document.getElementById('activityList');
    al.innerHTML=acts.length?acts.map(a=>`<div class="act-item"><div class="act-dot ${a.act}"></div><div><div class="act-text">${actText(a)}</div><div class="act-time">${timeAgo(a.t)}</div></div></div>`).join(''):'<p class="empty">Belum ada aktivitas</p>';
}

// ===== MASTER DATA =====
let editId=null;
function initMaster(){
    document.getElementById('btnAddPenerima').onclick=()=>openMasterModal();
    document.getElementById('btnSavePenerima').onclick=savePenerima;
    document.getElementById('searchMaster').oninput=e=>refreshMaster(e.target.value);
    document.getElementById('btnImport').onclick=()=>new bootstrap.Modal(document.getElementById('modalImport')).show();
    document.getElementById('btnExport').onclick=exportExcel;
    // Import
    const uz=document.getElementById('uploadZone'),fi=document.getElementById('excelInput');
    uz.onclick=()=>fi.click();
    fi.onchange=e=>{if(e.target.files[0])handleExcel(e.target.files[0]);};
    document.getElementById('btnDoImport').onclick=doImport;
    refreshMaster();
}
function refreshMaster(q=''){
    let data=DB.get('penerima');
    if(q){const t=q.toLowerCase();data=data.filter(p=>p.nama.toLowerCase().includes(t)||p.nik.includes(t));}
    const tb=document.getElementById('masterBody');
    tb.innerHTML=data.length?data.map((p,i)=>`<tr><td>${i+1}</td><td><code style="color:var(--blue)">${p.nik}</code></td><td><strong>${p.nama}</strong></td><td>${fmtDate(p.tglLahir)}</td><td>${p.jk==='L'?'L':p.jk==='P'?'P':'-'}</td><td>${p.ortu||'-'}</td><td><span class="badge-s ${p.aktif!==false?'badge-active':'badge-inactive'}">${p.aktif!==false?'Aktif':'Non'}</span></td><td><button class="btn btn-icon btn-outline-primary me-1" onclick="editPenerima('${p.id}')"><i class="fas fa-pen"></i></button><button class="btn btn-icon btn-outline-danger" onclick="hapusPenerima('${p.id}')"><i class="fas fa-trash"></i></button></td></tr>`).join(''):'<tr><td colspan="8" class="empty">Tidak ada data</td></tr>';
}
function openMasterModal(id=null){
    editId=id;
    const m=new bootstrap.Modal(document.getElementById('modalPenerima'));
    if(id){const p=DB.find('penerima',id);document.getElementById('modalPenerimaTitle').textContent='Edit Penerima';document.getElementById('inpNIK').value=p.nik;document.getElementById('inpNama').value=p.nama;document.getElementById('inpTglLahir').value=p.tglLahir||'';document.getElementById('inpJK').value=p.jk||'';document.getElementById('inpPosisi').value=p.posisi||'';document.getElementById('inpOrtu').value=p.ortu||'';document.getElementById('inpAktif').checked=p.aktif!==false;}
    else{document.getElementById('modalPenerimaTitle').textContent='Tambah Penerima';document.getElementById('formPenerima').reset();document.getElementById('inpAktif').checked=true;}
    m.show();
}
function savePenerima(){
    const d={nik:document.getElementById('inpNIK').value.trim(),nama:document.getElementById('inpNama').value.trim(),tglLahir:document.getElementById('inpTglLahir').value,jk:document.getElementById('inpJK').value,posisi:document.getElementById('inpPosisi').value.trim(),ortu:document.getElementById('inpOrtu').value.trim(),aktif:document.getElementById('inpAktif').checked};
    if(!d.nik||!d.nama)return toast('NIK & Nama wajib diisi!');
    if(editId)DB.update('penerima',editId,d);else DB.add('penerima',d);
    bootstrap.Modal.getInstance(document.getElementById('modalPenerima')).hide();
    refreshMaster();refreshDashboard();toast(editId?'Berhasil diupdate':'Berhasil ditambah');editId=null;
}
window.editPenerima=id=>openMasterModal(id);
window.hapusPenerima=id=>{if(confirm('Hapus data ini?')){DB.del('penerima',id);refreshMaster();refreshDashboard();toast('Dihapus');}};


// ===== EXCEL =====
let importRows=[];
function handleExcel(file){
    const r=new FileReader();
    r.onload=e=>{try{const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});const js=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);if(!js.length)return toast('File kosong!');importRows=js;showPreview(js);}catch(er){toast('Gagal baca: '+er.message);}};
    r.readAsArrayBuffer(file);
}
function showPreview(data){
    const h=Object.keys(data[0]);
    document.getElementById('prevHead').innerHTML='<tr>'+h.map(x=>'<th>'+x+'</th>').join('')+'</tr>';
    document.getElementById('prevBody').innerHTML=data.slice(0,5).map(r=>'<tr>'+h.map(x=>'<td>'+(r[x]||'')+'</td>').join('')+'</tr>').join('');
    document.getElementById('importPreview').classList.remove('d-none');
    document.getElementById('btnDoImport').classList.remove('d-none');
}
function doImport(){
    let c=0;
    importRows.forEach(r=>{
        const nik=String(r['NISN/NIK']||r['NIK']||'').trim(),nama=String(r['Nama Penerima']||r['Nama']||'').trim();
        if(nik&&nama&&!DB.get('penerima').find(p=>p.nik===nik)){
            DB.add('penerima',{nik,nama,tglLahir:parseDate(r['Tanggal Lahir']||''),jk:mapJK(r['Jenis Kelamin ID']),ortu:String(r['Nama Orang Tua']||'-'),posisi:String(r['Posisi']||''),aktif:r['Status Menerima']==='true'||r['Status Menerima']===true});c++;
        }
    });
    bootstrap.Modal.getInstance(document.getElementById('modalImport')).hide();
    refreshMaster();refreshDashboard();toast(c+' data diimport!');importRows=[];
}
function exportExcel(){
    const d=DB.get('penerima');
    const ws=XLSX.utils.json_to_sheet(d.map(p=>({'NISN/NIK':p.nik,'Nama':p.nama,'Tgl Lahir':p.tglLahir,'JK':p.jk,'Ortu':p.ortu,'Status':p.aktif!==false?'Aktif':'Non'})));
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Data');XLSX.writeFile(wb,'Master_Data.xlsx');toast('Exported!');
}

// ===== NOTA =====
let editNotaId=null;
function initNota(){
    document.getElementById('btnAddNota').onclick=()=>openNotaModal();
    document.getElementById('btnSaveNota').onclick=saveNota;
    document.getElementById('btnAddItem').onclick=addItem;
    document.getElementById('btnPDFToday').onclick=pdfToday;
    document.getElementById('searchNota').oninput=e=>refreshNota(e.target.value);
    refreshNota();
}
function refreshNota(q=''){
    let data=DB.get('nota');
    if(q){const t=q.toLowerCase();data=data.filter(n=>n.noNota.toLowerCase().includes(t)||(n.namaPenerima||'').toLowerCase().includes(t));}
    data.sort((a,b)=>(b._at||'').localeCompare(a._at||''));
    const tb=document.getElementById('notaBody');
    tb.innerHTML=data.length?data.map(n=>`<tr><td><strong>${n.noNota}</strong></td><td>${fmtDate(n.tgl)}</td><td>${n.namaPenerima||'-'}</td><td>${(n.items||[]).length} item</td><td><span class="badge-s badge-${n.status}">${statusLabel(n.status)}</span></td><td><button class="btn btn-icon btn-outline-success me-1" onclick="cycleStatus('${n.id}')" title="Status"><i class="fas fa-check"></i></button><button class="btn btn-icon btn-outline-danger me-1" onclick="dlNotaPDF('${n.id}')" title="PDF"><i class="fas fa-file-pdf"></i></button><button class="btn btn-icon btn-outline-secondary" onclick="delNota('${n.id}')" title="Hapus"><i class="fas fa-trash"></i></button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">Belum ada nota</td></tr>';
}
function openNotaModal(id=null){
    editNotaId=id;
    const sel=document.getElementById('inpPenerima');
    const pen=DB.get('penerima').filter(p=>p.aktif!==false);
    sel.innerHTML='<option value="">Pilih...</option>'+pen.map(p=>`<option value="${p.id}" data-n="${p.nama}">${p.nama} (${p.nik})</option>`).join('');
    if(id){const n=DB.find('nota',id);document.getElementById('modalNotaTitle').textContent='Edit Nota';document.getElementById('inpNoNota').value=n.noNota;document.getElementById('inpTglNota').value=n.tgl;sel.value=n.penerimaId||'';document.getElementById('inpCatatan').value=n.catatan||'';document.getElementById('itemsContainer').innerHTML='';(n.items||[]).forEach(it=>addItem(null,it));}
    else{document.getElementById('modalNotaTitle').textContent='Buat Nota';document.getElementById('inpNoNota').value=genNota();document.getElementById('inpTglNota').value=new Date().toISOString().split('T')[0];document.getElementById('inpCatatan').value='';document.getElementById('itemsContainer').innerHTML='';addItem();}
    new bootstrap.Modal(document.getElementById('modalNota')).show();
}
function addItem(e,data=null){
    const c=document.getElementById('itemsContainer');
    const div=document.createElement('div');div.className='item-row';
    div.innerHTML=`<input type="text" class="form-control form-control-sm" placeholder="Nama item" value="${data?data.name:''}"><input type="number" class="form-control form-control-sm" placeholder="Jml" min="1" value="${data?data.qty:'1'}"><input type="text" class="form-control form-control-sm" placeholder="Satuan" value="${data?data.unit:'porsi'}"><input type="text" class="form-control form-control-sm" placeholder="Ket" value="${data?(data.note||''):''}"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
    c.appendChild(div);
}
function saveNota(){
    const tgl=document.getElementById('inpTglNota').value;
    const sel=document.getElementById('inpPenerima');
    const penerimaId=sel.value;
    const namaPenerima=sel.options[sel.selectedIndex]?.dataset?.n||'';
    if(!tgl||!penerimaId)return toast('Tanggal & Penerima wajib!');
    const items=[];
    document.querySelectorAll('.item-row').forEach(r=>{const inputs=r.querySelectorAll('input');const name=inputs[0].value.trim(),qty=parseInt(inputs[1].value)||0,unit=inputs[2].value.trim(),note=inputs[3].value.trim();if(name&&qty>0)items.push({name,qty,unit,note});});
    if(!items.length)return toast('Min 1 item!');
    const d={noNota:document.getElementById('inpNoNota').value,tgl,penerimaId,namaPenerima,items,catatan:document.getElementById('inpCatatan').value,status:'pending'};
    if(editNotaId)DB.update('nota',editNotaId,d);else DB.add('nota',d);
    bootstrap.Modal.getInstance(document.getElementById('modalNota')).hide();
    refreshNota();refreshDashboard();toast('Nota disimpan!');editNotaId=null;
}
window.cycleStatus=id=>{const n=DB.find('nota',id);const next={pending:'process',process:'completed',completed:'pending'};DB.update('nota',id,{status:next[n.status]||'pending'});refreshNota();refreshDashboard();toast('Status: '+statusLabel(next[n.status]));};
window.delNota=id=>{if(confirm('Hapus nota?')){DB.del('nota',id);refreshNota();refreshDashboard();toast('Dihapus');}};
window.dlNotaPDF=id=>{const n=DB.find('nota',id);if(n)genPDF([n],'Nota_'+n.noNota);};
function pdfToday(){const today=new Date().toISOString().split('T')[0];const d=DB.get('nota').filter(n=>n.tgl===today);if(!d.length)return toast('Tidak ada nota hari ini');genPDF(d,'Nota_Harian_'+today);}


// ===== PDF =====
function genPDF(list,filename){
    const{jsPDF}=window.jspdf;const doc=new jsPDF('p','mm','a4');const pw=doc.internal.pageSize.getWidth();const m=15;
    list.forEach((nota,idx)=>{
        if(idx>0)doc.addPage();let y=m;
        doc.setFontSize(15);doc.setFont('helvetica','bold');doc.text('NOTA PESANAN MAKANAN GIZI',pw/2,y,{align:'center'});y+=6;
        doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text('SPPG Battu Winangun',pw/2,y,{align:'center'});y+=5;
        doc.setDrawColor(59,130,246);doc.setLineWidth(.5);doc.line(m,y,pw-m,y);y+=10;
        doc.setFontSize(10);doc.setFont('helvetica','bold');
        doc.text('No. Nota',m,y);doc.setFont('helvetica','normal');doc.text(': '+nota.noNota,m+28,y);
        doc.setFont('helvetica','bold');doc.text('Tanggal',pw/2,y);doc.setFont('helvetica','normal');doc.text(': '+fmtDate(nota.tgl),pw/2+22,y);y+=6;
        doc.setFont('helvetica','bold');doc.text('Penerima',m,y);doc.setFont('helvetica','normal');doc.text(': '+(nota.namaPenerima||'-'),m+28,y);
        doc.setFont('helvetica','bold');doc.text('Status',pw/2,y);doc.setFont('helvetica','normal');doc.text(': '+statusLabel(nota.status),pw/2+22,y);y+=10;
        if(nota.items&&nota.items.length){
            doc.autoTable({startY:y,head:[['No','Item','Jumlah','Satuan','Keterangan']],body:nota.items.map((it,i)=>[i+1,it.name,it.qty,it.unit||'porsi',it.note||'-']),theme:'grid',headStyles:{fillColor:[59,130,246],textColor:255,fontStyle:'bold',fontSize:9},bodyStyles:{fontSize:9},margin:{left:m,right:m},styles:{cellPadding:3}});
            y=doc.lastAutoTable.finalY+8;
        }
        if(nota.catatan){doc.setFontSize(9);doc.setFont('helvetica','italic');doc.text('Catatan: '+nota.catatan,m,y);y+=8;}
        // TTD
        y=Math.max(y+15,200);doc.setFontSize(9);
        const sw=(pw-2*m)/3;
        [{x:m,t:'Ahli Gizi',n:"Neti Is'ad Anggraini"},{x:m+sw,t:'KaSPPG',n:'Alfiansah Prastyo'},{x:m+sw*2,t:'Owner',n:'Endang Resminingsih'}].forEach(p=>{
            doc.setFont('helvetica','normal');doc.text(p.t,p.x+sw/2,y,{align:'center'});
            doc.setDrawColor(0);doc.setLineWidth(.3);doc.line(p.x+5,y+22,p.x+sw-5,y+22);
            doc.setFont('helvetica','bold');doc.text(p.n,p.x+sw/2,y+27,{align:'center'});
        });
        doc.setFontSize(7);doc.setFont('helvetica','italic');doc.setTextColor(120);
        doc.text('Dicetak: '+new Date().toLocaleString('id-ID'),m,doc.internal.pageSize.getHeight()-8);
        doc.text('Hal '+(idx+1)+'/'+list.length,pw-m,doc.internal.pageSize.getHeight()-8,{align:'right'});doc.setTextColor(0);
    });
    doc.save(filename+'.pdf');toast('PDF didownload!');
}

// ===== LAPORAN =====
function initLaporan(){
    document.getElementById('laporanDate').value=new Date().toISOString().split('T')[0];
    document.getElementById('btnLoadLaporan').onclick=loadLaporan;
    document.getElementById('btnLaporanPDF').onclick=laporanPDF;
}
function loadLaporan(){
    const dt=document.getElementById('laporanDate').value;if(!dt)return toast('Pilih tanggal!');
    const nota=DB.get('nota').filter(n=>n.tgl===dt);
    document.getElementById('lsNota').textContent=nota.length;
    document.getElementById('lsPenerima').textContent=[...new Set(nota.map(n=>n.penerimaId))].length;
    const ti=nota.reduce((s,n)=>s+(n.items||[]).reduce((a,i)=>a+i.qty,0),0);
    document.getElementById('lsItem').textContent=ti;
    const tb=document.getElementById('laporanBody');let num=0;
    const rows=[];nota.forEach(n=>(n.items||[]).forEach(it=>{num++;rows.push(`<tr><td>${num}</td><td>${n.noNota}</td><td>${n.namaPenerima}</td><td>${it.name}</td><td>${it.qty} ${it.unit||'porsi'}</td><td>${it.note||'-'}</td></tr>`);}));
    tb.innerHTML=rows.length?rows.join(''):'<tr><td colspan="6" class="empty">Tidak ada data</td></tr>';
}
function laporanPDF(){
    const dt=document.getElementById('laporanDate').value;if(!dt)return toast('Pilih tanggal!');
    const nota=DB.get('nota').filter(n=>n.tgl===dt);if(!nota.length)return toast('Tidak ada data!');
    const{jsPDF}=window.jspdf;const doc=new jsPDF('p','mm','a4');const pw=doc.internal.pageSize.getWidth();const m=15;let y=m;
    doc.setFontSize(14);doc.setFont('helvetica','bold');doc.text('LAPORAN HARIAN PESANAN GIZI',pw/2,y,{align:'center'});y+=6;
    doc.setFontSize(11);doc.text('SPPG Battu Winangun',pw/2,y,{align:'center'});y+=5;
    doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text('Tanggal: '+fmtDate(dt),pw/2,y,{align:'center'});y+=4;
    doc.setDrawColor(59,130,246);doc.setLineWidth(.5);doc.line(m,y,pw-m,y);y+=10;
    const ti=nota.reduce((s,n)=>s+(n.items||[]).reduce((a,i)=>a+i.qty,0),0);
    doc.setFont('helvetica','bold');doc.text('Total Nota: '+nota.length,m,y);doc.text('Total Item: '+ti+' porsi',pw/2,y);y+=8;
    const rows=[];let num=0;nota.forEach(n=>(n.items||[]).forEach(it=>{num++;rows.push([num,n.noNota,n.namaPenerima,it.name,it.qty+' '+(it.unit||'porsi'),it.note||'-']);}));
    doc.autoTable({startY:y,head:[['#','No Nota','Penerima','Item','Jumlah','Ket']],body:rows,theme:'grid',headStyles:{fillColor:[59,130,246],textColor:255,fontStyle:'bold',fontSize:8},bodyStyles:{fontSize:8},margin:{left:m,right:m}});
    y=doc.lastAutoTable.finalY+15;y=Math.max(y,200);
    doc.setFontSize(9);const sw=(pw-2*m)/3;
    [{x:m,t:'Ahli Gizi',n:"Neti Is'ad Anggraini"},{x:m+sw,t:'KaSPPG',n:'Alfiansah Prastyo'},{x:m+sw*2,t:'Owner',n:'Endang Resminingsih'}].forEach(p=>{
        doc.setFont('helvetica','normal');doc.text(p.t,p.x+sw/2,y,{align:'center'});
        doc.setDrawColor(0);doc.line(p.x+5,y+22,p.x+sw-5,y+22);
        doc.setFont('helvetica','bold');doc.text(p.n,p.x+sw/2,y+27,{align:'center'});
    });
    doc.save('Laporan_'+dt+'.pdf');toast('Laporan PDF didownload!');
}

// ===== SETTINGS =====
function initSettings(){
    document.getElementById('siUsername').textContent=SESSION.username;
    document.getElementById('siRole').textContent=SESSION.role;
    document.getElementById('siLogin').textContent=new Date(SESSION.loginTime).toLocaleString('id-ID');
    document.getElementById('siTotal').textContent=(DB.get('penerima').length+DB.get('nota').length)+' records';
    document.getElementById('btnSyncExport').onclick=()=>{const blob=new Blob([DB.exportAll()],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='sppg_sync_'+SESSION.username+'_'+new Date().toISOString().split('T')[0]+'.json';a.click();toast('Data diexport!');};
    document.getElementById('btnSyncImport').onclick=()=>document.getElementById('syncFileInput').click();
    document.getElementById('syncFileInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{if(DB.importAll(ev.target.result)){toast('Data berhasil diimport!');refreshDashboard();refreshMaster();refreshNota();}else toast('Gagal import!');};r.readAsText(f);};
}

// ===== HELPERS =====
function fmtDate(d){if(!d)return'-';try{return new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});}catch{return d;}}
function statusLabel(s){return{pending:'Menunggu',process:'Diproses',completed:'Selesai'}[s]||s;}
function actText(a){const acts={add:'Menambah',edit:'Mengubah',delete:'Menghapus'};return(acts[a.act]||a.act)+' '+a.col+': '+a.name;}
function timeAgo(t){const d=Math.floor((Date.now()-new Date(t))/1000);if(d<60)return'Baru saja';if(d<3600)return Math.floor(d/60)+'m lalu';if(d<86400)return Math.floor(d/3600)+'j lalu';return Math.floor(d/86400)+'h lalu';}
function genNota(){return'NOTA-'+new Date().toISOString().split('T')[0].replace(/-/g,'')+'-'+String(DB.get('nota').length+1).padStart(4,'0');}
function parseDate(s){if(!s)return'';const p=String(s).split('-');if(p.length===3&&p[2].length===4)return p[2]+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0');return String(s);}
function mapJK(v){if(v==='L'||v===1)return'L';if(v==='P'||v===2||v===64)return'P';return'';}
