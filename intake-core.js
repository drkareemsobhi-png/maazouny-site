(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MZIntake = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';
  function latin(value) {
    return String(value).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776));
  }
  function phone(value) {
    let n=latin(value).replace(/[\s()+-]/g,'');
    if(n.startsWith('0020')) n=n.slice(4);
    else if(n.startsWith('20')) n=n.slice(2);
    if(/^1[0125]\d{8}$/.test(n)) n='0'+n;
    return /^01[0125]\d{8}$/.test(n) ? '+2'+n : null;
  }
  function dateLimits(now=new Date()) {
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
    const base=Date.UTC(+parts.year,+parts.month-1,+parts.day);
    const day=n=>new Date(base+n*86400000).toISOString().slice(0,10);
    return {min:day(3),max:day(365)};
  }
  function payload(kind, values, elapsed) {
    const common=['full_name','phone','contact_pref','notes','website'];
    const fields=kind==='service'?['service','governorate','area','preferred_date','preferred_time','attire','delivery']:['jurisdiction','service_areas','availability'];
    const out={kind,consent:values.consent===true,elapsed_ms:Math.max(0,Math.floor(elapsed))};
    for(const key of [...common,...fields]) out[key]=String(values[key]||'').trim();
    out.phone=phone(out.phone)||out.phone;
    if(kind==='service' && out.service==='marriage') out.marital_case=values.marital_case;
    return out;
  }
  async function send(url, data, transport=globalThis.fetch) {
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) return {ok:false,error:'not_configured'};
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),25000);
    try {
      const res=await transport(url,{method:'POST',body:JSON.stringify(data),signal:controller.signal});
      if(!res.ok) return {ok:false,error:'network'};
      const out=await res.json();
      const refPattern=data.kind==='join'?/^MZN-[A-Z2-9]{6}$/:/^MZ-[A-Z2-9]{6}$/;
      if(out?.ok===true && refPattern.test(out.ref)) return {ok:true,ref:out.ref};
      if(out?.ok===false && typeof out.error==='string') return {ok:false,error:out.error,field:out.field};
      return {ok:false,error:'network'};
    } catch {return {ok:false,error:'network'};}
    finally {clearTimeout(timer);}
  }
  return {latin,phone,dateLimits,payload,send};
});
