// Names for FIRST's FTC region codes (the codes come from FIRST; unknown codes are shown as-is).
const NAMES = {
  USAK: 'Alaska', USAL: 'Alabama', USAR: 'Arkansas', USAZ: 'Arizona', USCA: 'California',
  USCALA: 'California – Los Angeles', USCANO: 'California – Northern', USCASD: 'California – San Diego',
  USCHS: 'Chesapeake (MD, VA, DC)', USCO: 'Colorado', USCT: 'Connecticut', USDE: 'Delaware', USFL: 'Florida',
  USGA: 'Georgia', USHI: 'Hawaii', USIA: 'Iowa', USID: 'Idaho', USIL: 'Illinois', USIN: 'Indiana', USKY: 'Kentucky',
  USLA: 'Louisiana', USMA: 'Massachusetts', USMD: 'Maryland', USME: 'Maine', USMI: 'Michigan', USMN: 'Minnesota',
  USMOKS: 'Kansas–Missouri', USKSMO: 'Kansas–Missouri', USMS: 'Mississippi', USMT: 'Montana', USNC: 'North Carolina', USND: 'North Dakota',
  USNE: 'Nebraska', USNH: 'New Hampshire', USNJ: 'New Jersey', USNM: 'New Mexico', USNV: 'Nevada', USNY: 'New York',
  USNYEX: 'New York – Excelsior', USNYLI: 'New York – Long Island', USNYNYC: 'New York City', USOH: 'Ohio',
  USOK: 'Oklahoma', USOR: 'Oregon', USPA: 'Pennsylvania', USPR: 'Puerto Rico', USRI: 'Rhode Island',
  USSC: 'South Carolina', USSD: 'South Dakota', USTN: 'Tennessee', USTX: 'Texas', USTXCE: 'Texas – Central',
  USTXHO: 'Texas – Houston', USTXNO: 'Texas – North', USTXSO: 'Texas – South', USTXWP: 'Texas – West & Panhandle',
  USUT: 'Utah', USVA: 'Virginia', USVT: 'Vermont', USWA: 'Washington', USWI: 'Wisconsin', USWV: 'West Virginia',
  USWY: 'Wyoming',
  CAAB: 'Canada – Alberta', CABC: 'Canada – British Columbia', CAON: 'Canada – Ontario', CAQC: 'Canada – Québec',
  AE: 'United Arab Emirates', AM: 'Armenia', AR: 'Argentina', AT: 'Austria', AU: 'Australia', AZ: 'Azerbaijan',
  BD: 'Bangladesh', BE: 'Belgium', BG: 'Bulgaria', BH: 'Bahrain', BR: 'Brazil', CH: 'Switzerland', CL: 'Chile',
  CN: 'China', CO: 'Colombia', CY: 'Cyprus', CZ: 'Czechia', DE: 'Germany', DK: 'Denmark', DO: 'Dominican Republic',
  EC: 'Ecuador', EG: 'Egypt', ES: 'Spain', ET: 'Ethiopia', FI: 'Finland', FR: 'France', GB: 'United Kingdom',
  GH: 'Ghana', GR: 'Greece', HR: 'Croatia', HU: 'Hungary', ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IN: 'India',
  IS: 'Iceland', IT: 'Italy', JM: 'Jamaica', JO: 'Jordan', JP: 'Japan', KE: 'Kenya', KR: 'South Korea', KW: 'Kuwait',
  KZ: 'Kazakhstan', LK: 'Sri Lanka', LY: 'Libya', MA: 'Morocco', MX: 'Mexico', MY: 'Malaysia', NG: 'Nigeria',
  NL: 'Netherlands', NO: 'Norway', NZ: 'New Zealand', OM: 'Oman', PA: 'Panama', PE: 'Peru', PH: 'Philippines',
  PK: 'Pakistan', PL: 'Poland', PT: 'Portugal', QA: 'Qatar', RO: 'Romania', RU: 'Russia', RW: 'Rwanda',
  SA: 'Saudi Arabia', SE: 'Sweden', SG: 'Singapore', SK: 'Slovakia', TH: 'Thailand', TR: 'Türkiye',
  TT: 'Trinidad and Tobago', TW: 'Taiwan', TZ: 'Tanzania', UA: 'Ukraine', UG: 'Uganda', VN: 'Vietnam',
  ZA: 'South Africa',
};

export function regionName(code) {
  code = String(code || '').toUpperCase();
  return NAMES[code] || code;
}
