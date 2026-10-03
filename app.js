(() => {
  'use strict';
  const cards = [...document.querySelectorAll('[data-service]')];
  const panels = [...document.querySelectorAll('.service-detail')];
  function select(id) {
    if (!panels.some(panel => panel.id === id)) return;
    panels.forEach(panel => { panel.hidden = panel.id !== id; });
    cards.forEach(card => {
      if (card.dataset.service === id) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
    });
  }
  cards.forEach(card => card.addEventListener('click', event => {
    select(card.dataset.service);
    if (matchMedia('(min-width: 701px)').matches) {
      event.preventDefault();
      history.replaceState(null, '', card.getAttribute('href'));
    }
  }));
  select('marriage');
  function route() {
    select(location.hash.slice(1));
    if (location.hash === '#privacy') document.querySelector('#privacy').open = true;
  }
  route();
  window.addEventListener('hashchange', route);
  const core = window.MZIntake;
  const url = window.MAAZOUNY_CONFIG?.INTAKE_URL || '';
  const ready = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url);
  const serviceMap = {marriage:'marriage',ratification:'ratification','present-divorce':'divorce_in_person','absent-divorce':'divorce_in_absentia'};
  const request = document.querySelector('#service-form');
  function serviceChanged() {
    const marriage=request.elements.service.value==='marriage';
    const field=request.elements.marital_case;
    field.closest('.form-field').hidden=!marriage;
    field.disabled=!marriage;
    field.required=marriage;
    const key=Object.keys(serviceMap).find(key=>serviceMap[key]===request.elements.service.value);
    document.querySelector('#service-fallback').href=document.querySelector(`[data-message="${key}"]`).href;
  }
  document.querySelectorAll('[data-request-service]').forEach(link=>link.addEventListener('click',()=>{
    request.elements.service.value=serviceMap[link.dataset.requestService];
    serviceChanged();
  }));
  request.elements.service.addEventListener('change',serviceChanged);
  serviceChanged();
  document.querySelectorAll('form[data-kind]').forEach(form=>{
    const kind=form.dataset.kind;
    const status=form.querySelector('.form-status');
    const fieldset=form.querySelector('fieldset');
    const button=form.querySelector('[type="submit"]');
    const success=form.querySelector('.form-success');
    let started=null, sending=false, completed=false;
    const observer=new IntersectionObserver(entries=>{
      if(started===null && entries.some(e=>e.isIntersecting)){started=Date.now();observer.disconnect();}
    });
    observer.observe(form);
    if(ready){fieldset.disabled=false;status.textContent='مفيش حجز مؤكد قبل مراجعة الفريق والاتفاق على التكلفة والتحقق من العربون.';}
    function dates(){if(kind==='service'){const limits=core.dateLimits();form.elements.preferred_date.min=limits.min;form.elements.preferred_date.max=limits.max;}}
    dates();
    form.addEventListener('focusin',dates);
    form.addEventListener('input',event=>{
      if(event.target.setCustomValidity) event.target.setCustomValidity('');
      event.target.removeAttribute('aria-invalid');
      if(kind==='service' && ['preferred_date','preferred_time'].includes(event.target.name)){
        form.elements.preferred_date.setCustomValidity('');
        form.elements.preferred_date.removeAttribute('aria-invalid');
      }
    });
    function flag(name,message){
      const field=form.elements.namedItem(name);
      if(field && typeof field.setCustomValidity==='function' && !field.disabled){
        field.setCustomValidity(message);field.setAttribute('aria-invalid','true');field.reportValidity();field.focus();
      }
    }
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(sending||completed)return;
      if(!ready){status.focus();return;}
      dates();
      if(!form.reportValidity())return;
      const values=Object.fromEntries(new FormData(form));
      values.consent=form.elements.consent.checked;
      if(!core.phone(values.phone)){flag('phone','اكتب رقم موبايل مصري صحيح.');return;}
      if(values.full_name.trim().length<2){flag('full_name','اكتب الاسم بحرفين على الأقل.');return;}
      // Keep accidentally entered national IDs out of the request entirely.
      for(const [key,value] of Object.entries(values)){
        if(key!=='website' && key!=='phone' && typeof value==='string' && /\d{14,}/.test(core.latin(value).replace(/[\s-]/g,''))){
          flag(key,'متكتبش الرقم القومي أو بيانات البطاقة في الفورم.');return;
        }
      }
      const data=core.payload(kind,values,Date.now()-(started??Date.now()));
      const preference=data.contact_pref==='call'?'بمكالمة':'على واتساب';
      sending=true;fieldset.disabled=true;button.textContent='جاري الإرسال…';form.setAttribute('aria-busy','true');
      status.textContent='جاري إرسال الطلب، استنى نتيجة الإرسال.';
      const out=await core.send(url,data);
      sending=false;form.removeAttribute('aria-busy');button.textContent='إرسال الطلب';
      if(out.ok){
        completed=true;form.reset();fieldset.hidden=true;status.hidden=true;success.hidden=false;
        const title=document.createElement('h3');title.textContent=kind==='service'?'استلمنا طلبك ✓':'استلمنا طلب الانضمام ✓';
        const ref=document.createElement('p');ref.textContent='رقم طلبك: '+out.ref+' — احتفظ بيه للمتابعة';
        const followup=document.createElement('p');followup.textContent=kind==='service'?`فريق مأذوني هيراجع الطلب ويتواصل معاك ${preference} على رقمك، خلال مواعيد الرد يوميًا من ٢ ظهرًا لـ١٠ مساءً بتوقيت القاهرة.`:'الإدارة هتراجع البيانات وتتواصل معاك خلال مواعيد الرد.';
        const note=document.createElement('p');note.className='note';note.textContent=kind==='service'?'الطلب لسه مش حجز مؤكد. التأكيد بيكون بعد مراجعة الفريق والاتفاق على التكلفة وسداد العربون والتحقق من وصوله.':'إرسال الطلب مش معناه قبول.';
        success.replaceChildren(title,ref,followup,note);success.focus();return;
      }
      fieldset.disabled=false;serviceChanged();
      const errors={
        invalid_input:'راجع الخانة المحددة وحاول تاني.',
        lead_time:`الحجز قبل الموعد بـ٣ أيام على الأقل. اختار موعدًا يبعد ٧٢ ساعة على الأقل؛ أقرب يوم للاختيار ${new Intl.DateTimeFormat('ar-EG',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'}).format(new Date(core.dateLimits().min+'T00:00:00Z'))}.`,
        rate_limited:'وصلنا أكتر من طلب من الرقم ده. الفريق هيتواصل معاك، أو كلمنا واتساب.',
        not_configured:'خدمة استقبال الطلبات من الموقع لسه بتتجهز.'
      };
      status.textContent=errors[out.error]||'تعذر تأكيد الإرسال دلوقتي. ممكن يكون الطلب وصل؛ كلمنا واتساب قبل إعادة الإرسال لتجنب تكراره.';
      if(out.error==='invalid_request')console.error('MZ intake: invalid_request');
      status.focus();
      if(out.error==='invalid_input') flag(out.field,'راجع الخانة دي');
      if(out.error==='lead_time') flag('preferred_date','اختار موعد يبعد ٧٢ ساعة على الأقل بتوقيت القاهرة.');
    });
  });
})();
