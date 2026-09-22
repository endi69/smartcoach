const sessions=[
{d:"Lun",t:"Lower + core",x:["Goblet squat · 3×8–12","Romanian deadlift · 3×8–10","Split squat · 3×8/side","Calf raise · 3×12–15","Dead bug · 3×8/side"]},
{d:"Mar",t:"Z2",x:["Corsa o cyclette · 30–40 min","Intensità conversazionale"]},
{d:"Gio",t:"Upper",x:["Pull-up · 4×5–8","Dip · 3×8–12","DB press · 3×8–12","Row · 3×8–12","Lateral raise · 3×12–15"]},
{d:"Sab",t:"Lower + posterior",x:["Squat · 3×6–10","Hip thrust · 3×8–12","Reverse lunge · 3×8/side","Back extension · 3×10–15","Side plank · 3×30s"]},
{d:"Dom",t:"Z2 easy",x:["Corsa o cyclette · 35–50 min"]}];
const w=document.querySelector("#workout"); sessions[0].x.forEach(x=>{let [a,b]=x.split(" · ");w.insertAdjacentHTML("beforeend",`<div class="exercise"><b>${a}</b><span>${b||""}</span></div>`)});
const week=document.querySelector("#week");sessions.forEach(s=>week.insertAdjacentHTML("beforeend",`<div class="day"><small>${s.d}</small><h3>${s.t}</h3><p>${s.x.length} blocchi</p></div>`));
document.querySelector("#start").onclick=()=>{const n=prompt("Dove ti alleni? Scrivi CASA o PALESTRA","CASA");if(n) localStorage.setItem("smartcoach-place",n.toUpperCase()); alert("Sessione pronta · "+(n||"CASA").toUpperCase()+". Registra RPE e carichi nella prossima versione.");};
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");alert(b.dataset.tab==="log"?"Storico in arrivo nel prossimo step.":"Profilo e adattamento automatico nel prossimo step.");});