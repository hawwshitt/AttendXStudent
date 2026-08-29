const $=id=>document.getElementById(id);
const today=()=>new Date().toISOString().slice(0,10);
let students=JSON.parse(localStorage.getItem("axs_students")||"null")||[
 {id:1,roll:"101",name:"Aarav Sharma",branch:"CSE 2nd Year",phone:"9876543210",email:"aarav@gmail.com"},
 {id:2,roll:"102",name:"Aditya Singh",branch:"CSE 2nd Year",phone:"9412934280",email:"aditya@gmail.com"},
 {id:3,roll:"103",name:"Priya Rawat",branch:"CSE 2nd Year",phone:"9123456780",email:"priya@gmail.com"},
 {id:4,roll:"104",name:"Riya Joshi",branch:"CSE 2nd Year",phone:"9988776655",email:"riya@gmail.com"}
];
let attendance=JSON.parse(localStorage.getItem("axs_attendance")||"{}");
let reminders=JSON.parse(localStorage.getItem("axs_reminders")||"[]");
let currentDate=today();

function save(){localStorage.setItem("axs_students",JSON.stringify(students));localStorage.setItem("axs_attendance",JSON.stringify(attendance));localStorage.setItem("axs_reminders",JSON.stringify(reminders));}
function toast(t){$("toast").textContent=t;$("toast").style.display="block";setTimeout(()=>$("toast").style.display="none",2200)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function getRecords(date){return attendance[date]||{}}
function overall(s){let vals=[];for(const d of Object.keys(attendance)){if(attendance[d][s.id]!=null)vals.push(attendance[d][s.id])}return vals.length?Math.round(vals.filter(Boolean).length/vals.length*100):0}
function updateDashboard(){
 const r=getRecords(currentDate), present=students.filter(s=>r[s.id]===true).length, absent=students.filter(s=>r[s.id]===false).length, rate=students.length?Math.round(present/students.length*100):0;
 $("totalStudents").textContent=students.length;$("presentToday").textContent=present;$("absentToday").textContent=absent;$("rateToday").textContent=rate+"%";$("donutRate").textContent=rate+"%";$("legPresent").textContent=present;$("legAbsent").textContent=absent;
 $("donut").style.background=`conic-gradient(#fff ${rate*3.6}deg,#24282e ${rate*3.6}deg)`;
 $("dashboardReminder").innerHTML=absent?`<p style="margin-top:15px;color:#aaa">${absent} absent student${absent>1?"s":""} detected. ${reminders.filter(x=>x.date===currentDate).length} reminder draft(s) created.</p>`:`<p style="margin-top:15px;color:#777">No absent students recorded for today.</p>`;
 $("reminderBadge").textContent=reminders.filter(x=>x.date===currentDate).length;
}
function renderAttendance(){
 const q=$("attSearch").value.toLowerCase(), r=getRecords($("attDate").value||currentDate);
 const list=students.filter(s=>(s.name+" "+s.roll).toLowerCase().includes(q));
 $("attendanceBody").innerHTML=list.map(s=>`<tr><td>${esc(s.roll)}</td><td>${esc(s.name)}</td><td>${esc(s.branch)}</td><td>${esc(s.email)}</td><td><button class="status ${r[s.id]===false?"absent":"present"}" data-att="${s.id}">${r[s.id]===false?"Absent":"Present"}</button></td></tr>`).join("");
 const vals=students.map(s=>r[s.id]).filter(v=>v!=null);$("attCount").textContent=students.length+" students";$("attPresent").textContent=vals.filter(Boolean).length;$("attAbsent").textContent=vals.filter(v=>!v).length;
 document.querySelectorAll("[data-att]").forEach(b=>b.onclick=()=>{const id=b.dataset.att;r[id]=r[id]===false?true:false;attendance[$("attDate").value]=r;renderAttendance();});
}
function renderStudents(){
 const q=$("studentSearch").value.toLowerCase();
 $("studentBody").innerHTML=students.filter(s=>(s.name+" "+s.roll+" "+s.email).toLowerCase().includes(q)).map(s=>`<tr><td>${esc(s.roll)}</td><td>${esc(s.name)}</td><td>${esc(s.branch)}</td><td>${esc(s.phone)}</td><td>${esc(s.email)}</td><td>${overall(s)}%</td><td><div class="actions"><button class="action" onclick="editStudent(${s.id})">Edit</button><button class="action" onclick="deleteStudent(${s.id})">Delete</button></div></td></tr>`).join("");
 $("historyStudent").innerHTML='<option value="all">All Students</option>'+students.map(s=>`<option value="${s.id}">${esc(s.name)} (${esc(s.roll)})</option>`).join("");
}
function renderHistory(){
 let rows=[];const sid=$("historyStudent").value,from=$("fromDate").value,to=$("toDate").value;
 for(const d of Object.keys(attendance).sort()){if(from&&d<from||to&&d>to)continue;for(const s of students){if(sid!=="all"&&String(s.id)!==sid)continue;if(attendance[d][s.id]!=null)rows.push({d,s,v:attendance[d][s.id]})}}
 $("historyBody").innerHTML=rows.map(x=>`<tr><td>${x.d}</td><td>${esc(x.s.roll)}</td><td>${esc(x.s.name)}</td><td><span class="status ${x.v?"present":"absent"}">${x.v?"Present":"Absent"}</span></td></tr>`).join("");
 const p=rows.filter(x=>x.v).length,a=rows.length-p;$("recordCount").textContent=rows.length;$("historyPresent").textContent=p;$("historyAbsent").textContent=a;$("historyRate").textContent=(rows.length?Math.round(p/rows.length*100):0)+"%";
}
function makeReminder(s,date){
 return {id:Date.now()+Math.random(),studentId:s.id,date,to:s.email,studentName:s.name,roll:s.roll,branch:s.branch,subject:`Attendance Reminder – AttendXStudent`,body:`Dear ${s.name},\n\nYou were marked Absent for today's class.\n\nStudent: ${s.name}\nRoll No: ${s.roll}\nClass: ${s.branch}\nDate: ${date}\n\nPlease contact your faculty if this absence was incorrect.\n\nRegards,\nAttendXStudent`,status:"pending"};
}
async function sendReminderEmail(r){
 try{
  const response=await fetch('/api/send-absent-reminder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentName:r.studentName,studentEmail:r.to,roll:r.roll,branch:r.branch,date:r.date})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok) throw new Error(data.error||'Email sending failed');
  r.status='sent'; r.sentAt=new Date().toISOString();
  return true;
 }catch(error){
  console.error('Absent reminder email error:',error);
  r.status='failed'; r.error=error.message;
  return false;
 }
}
async function createReminders(date=$('attDate').value||currentDate){
 const r=getRecords(date), absent=students.filter(s=>r[s.id]===false&&s.email);
 let added=0, sent=0, failed=0;
 const jobs=[];
 absent.forEach(s=>{
  let reminder=reminders.find(x=>x.studentId===s.id&&x.date===date);
  if(!reminder){ reminder=makeReminder(s,date); reminders.push(reminder); added++; }
  if(reminder.status!=='sent') jobs.push(reminder);
 });
 save(); renderReminders(); updateDashboard();
 for(const reminder of jobs){
  const ok=await sendReminderEmail(reminder);
  if(ok) sent++; else failed++;
  save(); renderReminders(); updateDashboard();
 }
 if(absent.length===0) toast('No absent students with an email address.');
 else toast(`${sent} email${sent===1?'':'s'} sent${failed?`, ${failed} failed`:''}.`);
}
function renderReminders(){
 const list=reminders.slice().sort((a,b)=>b.id-a.id);
 $('queueText').textContent=list.length+" reminder"+(list.length===1?"":"s");
 $('reminderList').innerHTML=list.length?list.map(r=>{
  const status=r.status||'pending';
  const statusText=status==='sent'?'Email Sent':status==='failed'?'Send Failed':'Sending';
  return `<div class="reminder-item"><div class="reminder-top"><div><b>${esc(r.to)}</b><div class="reminder-meta">${r.date} · ${esc(r.subject)}</div></div><span class="status ${status==='sent'?'present':'absent'}">${statusText}</span></div><div class="reminder-body">${esc(r.body).replace(/\n/g,"<br>")}</div>${r.error?`<div class="reminder-meta">Error: ${esc(r.error)}</div>`:''}<div class="reminder-actions">${status==='sent'?'<span class="reminder-meta">Automatically sent via Gmail SMTP</span>':`<button class="primary" onclick="resendReminder('${r.id}')">Send Email</button>`}<button class="secondary" onclick="openMail('${r.id}')">Open Mail</button><button class="secondary" onclick="copyReminder('${r.id}')">Copy</button><button class="secondary" onclick="removeReminder('${r.id}')">Remove</button></div></div>`
 }).join(''):'<p style="color:#777">No reminder drafts yet. Save attendance with one or more students marked Absent.</p>';
}
async function resendReminder(id){
 const r=reminders.find(x=>String(x.id)===String(id)); if(!r)return;
 r.status='pending'; r.error=''; save(); renderReminders();
 const ok=await sendReminderEmail(r); save(); renderReminders(); updateDashboard(); toast(ok?'Email sent successfully.':'Email sending failed. Check the server console.');
}
function openMail(id){const r=reminders.find(x=>String(x.id)===String(id));if(!r)return;location.href=`mailto:${encodeURIComponent(r.to)}?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.body)}`}
function showPage(p){document.querySelectorAll(".page").forEach(x=>x.classList.remove("active-page"));$(p).classList.add("active-page");document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===p));$("pageTitle").textContent={dashboard:"Dashboard",attendance:"Take Attendance",students:"Students",history:"History & Reports",reminders:"Absent Reminders"}[p];if(p==="attendance")renderAttendance();if(p==="students")renderStudents();if(p==="history")renderHistory();if(p==="reminders")renderReminders()}
function editStudent(id){const s=students.find(x=>x.id===id);if(!s)return;$("modalTitle").textContent="Edit Student";$("editId").value=s.id;$("roll").value=s.roll;$("name").value=s.name;$("branch").value=s.branch;$("phone").value=s.phone;$("email").value=s.email;$("modal").classList.add("open")}
function deleteStudent(id){if(!confirm("Delete this student?"))return;students=students.filter(s=>s.id!==id);for(const d in attendance)delete attendance[d][id];reminders=reminders.filter(r=>r.studentId!==id);save();renderStudents();renderAttendance();renderReminders();updateDashboard();toast("Student deleted")}
$("loginForm").onsubmit=e=>{e.preventDefault();if($("loginUsername").value==="admin"&&$("loginPassword").value==="admin123"){$("loginScreen").classList.add("hidden");$("app").classList.remove("hidden");document.body.style.overflow="auto";}else $("loginError").textContent="Invalid login. Use admin / admin123."};
$("showPassword").onclick=()=>{$("loginPassword").type=$("loginPassword").type==="password"?"text":"password"};
$("logoutBtn").onclick=()=>{$("app").classList.add("hidden");$("loginScreen").classList.remove("hidden");document.body.style.overflow="hidden"};
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
$("attDate").value=currentDate;$("todayText").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",year:"numeric",month:"long",day:"numeric"});
$("attSearch").oninput=renderAttendance;$("studentSearch").oninput=renderStudents;$("attDate").onchange=()=>{currentDate=$("attDate").value;renderAttendance();updateDashboard()};
$("markAll").onclick=()=>{const d=$("attDate").value||today();attendance[d]={};students.forEach(s=>attendance[d][s.id]=true);renderAttendance();toast("All students marked present")};
$("saveAttendance").onclick=()=>{const d=$("attDate").value||today();attendance[d]=attendance[d]||{};students.forEach(s=>{if(attendance[d][s.id]==null)attendance[d][s.id]=true});save();createReminders(d);updateDashboard();toast("Attendance saved")};
$("createAllReminders").onclick=()=>createReminders();
$("clearReminders").onclick=()=>{if(confirm("Clear all reminder drafts?")){reminders=[];save();renderReminders();updateDashboard()}};
$("filterHistory").onclick=renderHistory;$("historyStudent").onchange=renderHistory;
$("exportCsv").onclick=()=>{let csv="Date,Roll No,Student,Status\n";for(const d in attendance)for(const s of students)if(attendance[d][s.id]!=null)csv+=`${d},${s.roll},"${s.name}",${attendance[d][s.id]?"Present":"Absent"}\n`;const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="AttendXStudent_Attendance.csv";a.click()};
$("addStudent").onclick=()=>{$("studentForm").reset();$("editId").value="";$("modalTitle").textContent="Add Student";$("modal").classList.add("open")};
$("closeModal").onclick=$("cancelModal").onclick=()=>$("modal").classList.remove("open");
$("studentForm").onsubmit=e=>{e.preventDefault();const id=$("editId").value,s={id:id?Number(id):Date.now(),roll:$("roll").value.trim(),name:$("name").value.trim(),branch:$("branch").value.trim(),phone:$("phone").value.trim(),email:$("email").value.trim()};if(id)students=students.map(x=>x.id===Number(id)?s:x);else students.push(s);save();$("modal").classList.remove("open");renderStudents();renderAttendance();updateDashboard();toast(id?"Student updated":"Student added")};
$("resetBtn").onclick=()=>{if(confirm("Reset all demo data?")){localStorage.clear();location.reload()}};
function toggleTheme(){document.body.classList.toggle("light");$("themeBtn").querySelector("span").textContent=document.body.classList.contains("light")?"Light mode":"Dark mode"}$("themeBtn").onclick=toggleTheme;$("themeTop").onclick=toggleTheme;
renderStudents();renderAttendance();renderHistory();renderReminders();updateDashboard();document.body.style.overflow="hidden";
