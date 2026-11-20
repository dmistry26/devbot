// The "Send to devbot" bookmark. It runs on PowerSchool's Grades and
// Attendance page (in your own signed-in browser), reads the grades table,
// and opens devbot's /import page with the grades in the URL fragment.
// Nothing is sent anywhere else, and the fragment never reaches a server.
//
// Table layout (vcsnet.powerschool.com/guardian/home.html, table.linkDescList.grid):
//   header row: Exp | Last Week (5) | This Week (5) | Course | S1 [| Q3 …] | Absences | Tardies
//   class row:  … | "AP Calculus BC <br> <a title='Details about Nie, Mr. Jacob'>" | <a href=scores.html?fg=S1>A<br>92</a> | …
//
// Kept as plain ES5-ish JavaScript text (not a compiled function) so the build
// can't change it. It defines `read()`, which returns the payload or throws.

export const READER_SOURCE = String.raw`function read(){
  var tables=document.querySelectorAll("table"),table=null;
  for(var i=0;i<tables.length;i++){var r0=tables[i].rows[0];if(r0&&/Course/.test(r0.textContent||"")){table=tables[i];break;}}
  if(!table)throw new Error("Open PowerSchool's Grades and Attendance page first, then tap the bookmark.");
  var cols=[];
  for(var c=0;c<table.rows[0].cells.length;c++){var h=table.rows[0].cells[c];for(var k=0;k<(h.colSpan||1);k++)cols.push((h.textContent||"").replace(/\s+/g," ").trim());}
  var courseIdx=cols.indexOf("Course"),terms=[];
  for(var j=courseIdx+1;j<cols.length;j++){if(/^(?:[QSTYEF]\d{1,2})$/.test(cols[j]))terms.push({name:cols[j],idx:j});}
  if(courseIdx<0||!terms.length)throw new Error("Couldn't find the grades columns on this page.");
  var classes=[];
  for(var r=0;r<table.rows.length;r++){
    var row=table.rows[r];if(row.cells.length!==cols.length)continue;
    var cell=row.cells[courseIdx],name="";
    for(var n=0;n<cell.childNodes.length;n++){var node=cell.childNodes[n];if(node.nodeName==="BR")break;name+=node.textContent||"";}
    name=name.replace(/ /g," ").replace(/\s+/g," ").trim();
    if(!name||name==="Course")continue;
    var link=cell.querySelector('a[title^="Details about"]'),teacher=null;
    if(link){var m=(link.getAttribute("title")||"").replace("Details about ","").match(/^([^,]+),\s*(\S+\.)?/);if(m)teacher=((m[2]?m[2]+" ":"")+m[1]).trim();}
    var g=[];
    for(var t=0;t<terms.length;t++){
      var gc=row.cells[terms[t].idx],a=gc&&gc.querySelector("a"),parts=[];
      if(a){var raw=a.innerHTML.split(/<br\s*\/?>/i);for(var p=0;p<raw.length;p++)parts.push(raw[p].replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").trim());}
      var letter=parts[0]&&/^(?:[A-F][+-]?|P|NP|I)$/.test(parts[0])?parts[0]:null;
      var pct=parts[1]&&/^\d+(?:\.\d+)?$/.test(parts[1])?Number(parts[1]):null;
      g.push([terms[t].name,letter,pct]);
    }
    classes.push({n:name,t:teacher,g:g});
  }
  if(!classes.length)throw new Error("No classes found in the grades table.");
  var tn=[];for(var q=0;q<terms.length;q++)tn.push(terms[q].name);
  return {v:1,terms:tn,classes:classes};
}`;

/** Build the javascript: URL for a given devbot address (e.g. https://devbot-6eut.vercel.app). */
export function bookmarkletFor(devbotOrigin: string): string {
  const body =
    `(function(){try{${READER_SOURCE};var p=read();var b=btoa(unescape(encodeURIComponent(JSON.stringify(p)))).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");` +
    `var u=${JSON.stringify(devbotOrigin)}+"/import#grades="+b;var w=window.open(u,"_blank");if(!w)location.href=u;}` +
    `catch(e){alert("devbot: "+(e&&e.message||e));}})()`;
  return "javascript:" + encodeURIComponent(body.replace(/\n\s*/g, ""));
}
