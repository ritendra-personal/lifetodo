const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const opm='https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/';
const indiaSource=year=>`https://www.timeanddate.com/holidays/india/${year}`;
// Festival reference dates, checked October 2026. Local observance may differ.
const festivals={
 2026:[['01-14','Makar Sankranti / Pongal'],['02-15','Maha Shivaratri'],['03-04','Holi'],['03-21','Eid al-Fitr',true],['03-26','Rama Navami'],['05-28','Eid al-Adha',true],['08-28','Raksha Bandhan'],['09-04','Janmashtami'],['09-14','Ganesh Chaturthi'],['10-11','Navratri begins'],['10-17','Durga Puja begins'],['10-20','Dussehra'],['11-08','Diwali'],['11-24','Guru Nanak Jayanti']],
 2027:[['01-14','Makar Sankranti'],['01-15','Pongal'],['03-06','Maha Shivaratri'],['03-10','Eid al-Fitr',true],['03-22','Holi'],['04-15','Rama Navami'],['05-17','Eid al-Adha',true],['08-17','Raksha Bandhan'],['08-25','Janmashtami'],['09-04','Ganesh Chaturthi'],['09-30','Navratri begins'],['10-05','Durga Puja begins'],['10-09','Dussehra'],['10-29','Diwali'],['11-14','Guru Nanak Jayanti']],
 2028:[['01-15','Makar Sankranti / Pongal'],['02-23','Maha Shivaratri'],['02-27','Eid al-Fitr',true],['03-11','Holi'],['04-03','Rama Navami'],['05-06','Eid al-Adha',true],['08-05','Raksha Bandhan'],['08-13','Janmashtami'],['08-23','Ganesh Chaturthi'],['09-19','Navratri begins'],['09-24','Durga Puja begins'],['09-27','Dussehra'],['10-17','Diwali']]
};
const nthMonday=(year,month,n)=>new Date(year,month,1+((1-new Date(year,month,1).getDay()+7)%7)+(n-1)*7);

export function planningHolidays(firstYear,lastYear){
 const holidays=[];
 const add=(date,name,group,source,provisional=false)=>holidays.push({date:typeof date==='string'?date:dateKey(date),name,group,source,provisional});
 // Include adjacent years because observed New Year's Day can fall in December.
 for(let year=firstYear-1;year<=lastYear+1;year++){
  for(const [month,day,name] of [[0,1,"New Year's Day"],[5,19,'Juneteenth'],[6,4,'Independence Day (U.S.)'],[10,11,'Veterans Day'],[11,25,'Christmas Day']]){
   const actual=new Date(year,month,day);add(actual,name,'us',opm);
   if([0,6].includes(actual.getDay()))add(new Date(year,month,day+(actual.getDay()===6?-1:1)),`${name} (observed)`,'us',opm);
  }
  for(const [month,n,name] of [[0,3,'Martin Luther King Jr. Day'],[1,3,"Washington's Birthday"],[8,1,'Labor Day'],[9,2,'Columbus Day (federal)']])add(nthMonday(year,month,n),name,'us',opm);
  const lastMay=new Date(year,5,0);add(new Date(year,4,lastMay.getDate()-((lastMay.getDay()+6)%7)),'Memorial Day','us',opm);
  add(new Date(year,10,1+((4-new Date(year,10,1).getDay()+7)%7)+21),'Thanksgiving','us',opm);
  for(const [date,name] of [['01-26','Republic Day (India)'],['08-15','Independence Day (India)'],['10-02','Gandhi Jayanti']])add(`${year}-${date}`,name,'india',indiaSource(year));
  for(const [date,name,provisional] of festivals[year]||[])add(`${year}-${date}`,name,'india',indiaSource(year),Boolean(provisional));
 }
 return holidays.filter(holiday=>Number(holiday.date.slice(0,4))>=firstYear&&Number(holiday.date.slice(0,4))<=lastYear).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
}

export function holidaysInRange(holidays,start,end,groups={us:true,india:true}){
 return holidays.filter(holiday=>groups[holiday.group]&&holiday.date>=start&&holiday.date<=end);
}
