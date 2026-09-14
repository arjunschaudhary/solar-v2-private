/* Solar V2 bridge. Run setupSolar once, then deploy as a web app executing as you.
 * Copy the generated Core.gs into this same Apps Script project.
 * Enable the Google Sheets advanced service, as declared in appsscript.json.
 */
var SOLAR_SHEET_ID = '17mExQ2XRc9me6NvG3ZpNjbnDOUt-ePt0FcicME_RFWY';
function setupSolar(){
 var properties=PropertiesService.getScriptProperties();
 if(!properties.getProperty('SOLAR_AUTOMATION_TOKEN'))properties.setProperty('SOLAR_AUTOMATION_TOKEN',Utilities.getUuid()+Utilities.getUuid());
 SpreadsheetApp.openById(SOLAR_SHEET_ID).getName();
 // View the generated secret in Project Settings > Script properties. Never log it.
 return 'Ready. Get the token from Script properties and deploy a web app.';
}
function doGet(){return jsonSolar_({ok:true,service:'Solar V2',message:'Use authenticated POST requests.'});}
function doPost(e){
 var lock=LockService.getScriptLock();
 try{
  if(!e||!e.postData||e.postData.contents.length>100000)throw new Error('Invalid request body.');
  var request=JSON.parse(e.postData.contents),secret=PropertiesService.getScriptProperties().getProperty('SOLAR_AUTOMATION_TOKEN');
  if(!secret||!constantEqual_(String(request.token||''),secret))throw new Error('Unauthorized.');
  if(!lock.tryLock(20000))throw new Error('Workspace busy. Retry this same request identifier.');
  var store=readSolar_(),state=store.state;
  if(request.type==='snapshot')return jsonSolar_({ok:true,state:state});
  if(request.type==='generate_document')return jsonSolar_({ok:true,result:generateDocument_(state,request.payload)});
  if(request.expected_version!==undefined&&Number(request.expected_version)!==state.version)throw new Error('The workspace changed. Refresh and try again.');
  var outcome=SolarCore.applyAction(state,{type:request.type,request_id:request.request_id,payload:request.payload||{}},request.actor||'n8n');
  saveSolar_(store,outcome.state);
  // Workers only need result; the app additionally receives state.
  return jsonSolar_({ok:true,result:outcome.result,state:request.expected_version!==undefined?outcome.state:undefined});
 }catch(error){return jsonSolar_({ok:false,error:String(error.message||error)});}finally{if(lock.hasLock())lock.releaseLock();}
}
function constantEqual_(a,b){var out=a.length^b.length;for(var i=0;i<b.length;i++)out|=(a.charCodeAt(i)||0)^b.charCodeAt(i);return out===0;}
function jsonSolar_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function readSolar_(){
 var ss=SpreadsheetApp.openById(SOLAR_SHEET_ID),state=SolarCore.emptyWorkspace(),tables={};
 Object.keys(SolarCore.TABLES).forEach(function(key){
  var sheet=ss.getSheetByName(SolarCore.TABLES[key]);if(!sheet)throw new Error('Missing tab: '+SolarCore.TABLES[key]);
  var count=Math.max(sheet.getLastRow(),1),width=sheet.getLastColumn(),values=sheet.getRange(1,1,count,width).getValues(),headers=values[0].map(String),rows={},lastData=1;
  var pk=SolarCore.KEYS[key],pkCol=headers.indexOf(pk);if(pkCol<0)throw new Error('Missing identifier column: '+pk);
  state[key]=[];
  for(var i=1;i<values.length;i++){
   if(!values[i][pkCol])continue;var record={};headers.forEach(function(h,j){if(!h)return;var v=values[i][j];record[h]=v instanceof Date?(/date$/.test(h)?Utilities.formatDate(v,'Asia/Kolkata','yyyy-MM-dd'):v.toISOString()):v;});
   if(rows[String(record[pk])])throw new Error('Duplicate identifier in '+sheet.getName()+': '+record[pk]);rows[String(record[pk])]=i+1;lastData=i+1;state[key].push(record);
  }
  tables[key]={sheet:sheet,headers:headers,rows:rows,nextRow:lastData+1};
 });
 var cfg=ss.getSheetByName('V2_Config');var configRows=cfg.getRange(1,1,Math.max(1,cfg.getLastRow()),3).getValues();var versionRow=0;
 configRows.slice(1).forEach(function(row,i){if(row[0])state.config[row[0]]=String(row[1]);if(row[0]==='DATA_VERSION')versionRow=i+2;});
 if(!versionRow)throw new Error('Missing DATA_VERSION configuration.');state.version=Number(state.config.DATA_VERSION||0);
 return {state:state,tables:tables,configSheet:cfg,versionRow:versionRow};
}
function nativeValue_(value,key){
 if(value===undefined||value===null||value==='')return {stringValue:''};
 if(typeof value==='number')return {numberValue:value};if(typeof value==='boolean')return {boolValue:value};
 if(['followup_due_date','next_followup_date','visit_date'].indexOf(key)>=0&&/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return {numberValue:Math.round(Date.parse(value+'T00:00:00Z')/86400000)+25569};
 // Explicit stringValue prevents formula injection, including values starting '='.
 return {stringValue:String(value)};
}
function saveSolar_(store,state){
 var requests=[];
 Object.keys(SolarCore.TABLES).forEach(function(key){
  var table=store.tables[key],pk=SolarCore.KEYS[key],before={};store.state[key].forEach(function(r){before[r[pk]]=r;});
  state[key].forEach(function(record){
   var old=before[record[pk]],row=table.rows[record[pk]]||table.nextRow++;
   if(!table.gridRows)table.gridRows=table.sheet.getMaxRows();if(row>table.gridRows){requests.push({appendDimension:{sheetId:table.sheet.getSheetId(),dimension:'ROWS',length:1000}});table.gridRows+=1000;}
   table.headers.forEach(function(header,col){
    if(!header||record[header]===undefined||(old&&JSON.stringify(old[header])===JSON.stringify(record[header])))return;
    if(key==='followups'&&['escalation_status','escalation_reason'].indexOf(header)>=0)return;
    if(key==='team'&&['current_lead_count','hot_leads_assigned','followups_due_today','overdue_followups'].indexOf(header)>=0)return;
    var cell={userEnteredValue:nativeValue_(record[header],header)};var fields='userEnteredValue';
    if(['followup_due_date','next_followup_date','visit_date'].indexOf(header)>=0){cell.userEnteredFormat={numberFormat:{type:'DATE',pattern:'yyyy-mm-dd'}};fields+=',userEnteredFormat.numberFormat';}
    requests.push({updateCells:{start:{sheetId:table.sheet.getSheetId(),rowIndex:row-1,columnIndex:col},rows:[{values:[cell]}],fields:fields}});
   });
  });
 });
 if(state.version!==store.state.version)requests.push({updateCells:{start:{sheetId:store.configSheet.getSheetId(),rowIndex:store.versionRow-1,columnIndex:1},rows:[{values:[{userEnteredValue:{stringValue:String(state.version)}}]}],fields:'userEnteredValue'}});
 // A single Sheets batch is atomic across the master, trackers, queue, and log.
 if(requests.length)Sheets.Spreadsheets.batchUpdate({requests:requests},SOLAR_SHEET_ID);
}
function generateDocument_(state,p){
 var d=state.deliveries.find(function(d){return d.delivery_id===p.delivery_id;});
 if(!d||d.kind!=='document'||d.status!=='Sending'||d.claim_token!==p.claim_token)throw new Error('Invalid document claim.');
 var source=JSON.parse(d.payload_json),proposal=state.proposals.find(function(r){return r.proposal_id===source.source_id;}),lead=state.leads.find(function(l){return l.lead_id===proposal.lead_id;});
 if(Number(source.proposal_version)!==Number(proposal.proposal_version))throw new Error('Proposal version changed.');
 if(SolarCore.isStopped(lead))throw new Error('Enquiry is stopped.');
 if(!state.config.PROPOSAL_FOLDER_ID)throw new Error('Set PROPOSAL_FOLDER_ID first.');
 var folder=DriveApp.getFolderById(state.config.PROPOSAL_FOLDER_ID),name='Solar_'+proposal.proposal_id+'_v'+proposal.proposal_version;
 var existing=folder.getFilesByName(name),doc;
 if(existing.hasNext())doc=DocumentApp.openById(existing.next().getId());else{doc=DocumentApp.create(name);DriveApp.getFileById(doc.getId()).moveTo(folder);}
 var body=doc.getBody();body.clear();body.appendParagraph('SOLAR PROJECT PROPOSAL').setHeading(DocumentApp.ParagraphHeading.TITLE);
 body.appendParagraph('Version '+proposal.proposal_version+' · '+proposal.proposal_id);
 body.appendParagraph(lead.company_name||lead.client_name).setHeading(DocumentApp.ParagraphHeading.HEADING1);
 body.appendParagraph('Contact: '+lead.client_name+' | '+lead.location);
 body.appendParagraph('Project: '+lead.project_type+' · '+lead.estimated_capacity);
 body.appendParagraph('Scope and bill of quantities').setHeading(DocumentApp.ParagraphHeading.HEADING2);body.appendParagraph(proposal.notes);
 body.appendParagraph('Proposal amount: INR '+Number(proposal.amount).toLocaleString('en-IN'));
 body.appendParagraph('Commercial terms, tax treatment and engineering specifications require review before sharing.');
 doc.saveAndClose();var pdfs=folder.getFilesByName(name+'.pdf'),pdf=pdfs.hasNext()?pdfs.next():folder.createFile(DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF).setName(name+'.pdf'));
 return {provider_id:doc.getId(),document_url:doc.getUrl(),pdf_url:pdf.getUrl(),pdf_file_id:pdf.getId()};
}
