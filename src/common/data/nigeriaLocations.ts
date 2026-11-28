export interface CityEntry {
  name: string;
  areas: string[];
}

export interface StateEntry {
  state: string;
  cities: CityEntry[];
}

export interface ServiceArea {
  country: string;
  state: string;
  city: string;
  area?: string;
}

export const NIGERIA_COUNTRY = 'Nigeria';

export const NIGERIA_STATES: StateEntry[] = [
  {
    state: 'Abia',
    cities: [
      { name: 'Aba', areas: ['Ariaria', 'Eziukwu', 'Ogbor Hill', 'Osisioma', 'Umuocham', 'Aba South'] },
      { name: 'Umuahia', areas: ['World Bank', 'Ubakala', 'Amuzukwu', 'Low Cost Housing', 'Isi Gate'] },
      { name: 'Ohafia', areas: ['Ebem', 'Amaekpu', 'Nkporo'] },
      { name: 'Arochukwu', areas: ['Amannagwu', 'Oror', 'Ibom'] },
    ],
  },
  {
    state: 'Adamawa',
    cities: [
      { name: 'Yola', areas: ['Jimeta', 'Yola Town', 'Dougirei', 'Karewa', 'Bekaji', 'Jambutu'] },
      { name: 'Mubi', areas: ['Lokuwa', 'Sabon Layi', 'Kolere'] },
      { name: 'Numan', areas: ['Numan Town', 'Sabon Pegi', 'Imburu'] },
    ],
  },
  {
    state: 'Akwa Ibom',
    cities: [
      { name: 'Uyo', areas: ['Ewet Housing', 'Shelter Afrique', 'Osongama', 'Nwaniba', 'Oron Road', 'Itam', 'Abak Road'] },
      { name: 'Eket', areas: ['Marina Road', 'Grace Bill', 'Idua', 'Afaha Eket'] },
      { name: 'Ikot Ekpene', areas: ['GRA', 'Abak Road', 'Umuahia Road', 'Itak'] },
      { name: 'Oron', areas: ['Oron Beach', 'Idua Assang', 'Esin Ufot'] },
    ],
  },
  {
    state: 'Anambra',
    cities: [
      { name: 'Awka', areas: ['Aroma', 'Temp Site', 'Unizik', 'Ifite', 'Agu Awka', 'Okpuno'] },
      { name: 'Onitsha', areas: ['GRA', 'Fegge', 'Woliwo', 'Odoakpu', 'Inland Town', '3-3'] },
      { name: 'Nnewi', areas: ['Otolo', 'Umudim', 'Uruagu', 'Nnewichi'] },
      { name: 'Ekwulobia', areas: ['Nkwo', 'Umuchi', 'Agba'] },
    ],
  },
  {
    state: 'Bauchi',
    cities: [
      { name: 'Bauchi', areas: ['GRA', 'Fadamar Mada', 'Yelwa', 'Wunti', 'Ibrahim Bako', 'Kobi'] },
      { name: 'Azare', areas: ['Central Market', 'Fatara', 'Sabon Gari'] },
      { name: 'Misau', areas: ['Misau Town', 'Zadawa'] },
    ],
  },
  {
    state: 'Bayelsa',
    cities: [
      { name: 'Yenagoa', areas: ['Opolo', 'Kpansia', 'Ekeki', 'Biogbolo', 'Amarata', 'Okutukutu', 'Swali'] },
      { name: 'Brass', areas: ['Twon-Brass', 'Okpoama'] },
      { name: 'Ogbia', areas: ['Otuoke', 'Imiringi', 'Kolo'] },
    ],
  },
  {
    state: 'Benue',
    cities: [
      { name: 'Makurdi', areas: ['High Level', 'Wurukum', 'North Bank', 'Modern Market', 'Kanshio', 'Old GRA'] },
      { name: 'Gboko', areas: ['Gboko South', 'GRA', 'Adekaa'] },
      { name: 'Otukpo', areas: ['GRA', 'Sabon Gari', 'Upu'] },
    ],
  },
  {
    state: 'Borno',
    cities: [
      { name: 'Maiduguri', areas: ['Old GRA', 'New GRA', 'Bulumkutu', 'Gwange', 'Pompomari', 'Custom'] },
      { name: 'Biu', areas: ['Biu Town', 'Dugja'] },
      { name: 'Bama', areas: ['Bama Town', 'Kasugula'] },
    ],
  },
  {
    state: 'Cross River',
    cities: [
      { name: 'Calabar', areas: ['State Housing', 'Marian', 'Ekorinim', '8 Miles', 'Ikot Ansa', 'Satellite Town', 'Calabar South', 'Parliamentary', 'Etta Agbor', 'Unical'] },
      { name: 'Ikom', areas: ['Four Corners', 'Okuni', 'Ikom Town'] },
      { name: 'Ogoja', areas: ['Igoli', 'Abakpa', 'Ishibori'] },
      { name: 'Obudu', areas: ['Obudu Town', 'Bebi', 'Ranch Road'] },
      { name: 'Ugep', areas: ['Ijiman', 'Ikpakapit', 'Biko-Biko'] },
    ],
  },
  {
    state: 'Delta',
    cities: [
      { name: 'Asaba', areas: ['GRA', 'Okpanam', 'Summit Road', 'DBS', 'Cable Point', 'Nnebisi'] },
      { name: 'Warri', areas: ['Effurun', 'GRA', 'Airport Road', 'Jakpa', 'Ekpan', 'Udu'] },
      { name: 'Sapele', areas: ['Amukpe', 'Ogodo', 'Olimpic'] },
      { name: 'Ughelli', areas: ['Otovwodo', 'Afiesere', 'Ekiugbo'] },
    ],
  },
  {
    state: 'Ebonyi',
    cities: [
      { name: 'Abakaliki', areas: ['Kpirikpiri', 'Presco', 'GRA', 'Mile 50', 'Ntezi Abba', 'Ezza Road'] },
      { name: 'Afikpo', areas: ['Eke Market', 'Ndibe', 'Ozizza'] },
      { name: 'Onueke', areas: ['Onueke Town', 'Ezza'] },
    ],
  },
  {
    state: 'Edo',
    cities: [
      { name: 'Benin City', areas: ['GRA', 'Ugbowo', 'Ring Road', 'Sapele Road', 'Uselu', 'Ikpoba Hill', 'Aduwawa', 'Ekenwan'] },
      { name: 'Auchi', areas: ['Auchi Poly', 'Jattu', 'Iyekhei'] },
      { name: 'Ekpoma', areas: ['Ujoelen', 'Iruekpen', 'Ihumudumu'] },
    ],
  },
  {
    state: 'Ekiti',
    cities: [
      { name: 'Ado Ekiti', areas: ['GRA', 'Basiri', 'Ajilosun', 'Fajuyi', 'Opopogbooro', 'Adebayo'] },
      { name: 'Ikere Ekiti', areas: ['Odo Oja', 'Uro', 'Oke Osun'] },
      { name: 'Oye Ekiti', areas: ['Oye Town', 'FUOYE'] },
    ],
  },
  {
    state: 'Enugu',
    cities: [
      { name: 'Enugu', areas: ['Independence Layout', 'New Haven', 'GRA', 'Trans-Ekulu', 'Achara Layout', 'Abakpa Nike', 'Coal Camp', 'Uwani'] },
      { name: 'Nsukka', areas: ['UNN', 'Odenigbo', 'Ogui', 'Onuiyi'] },
      { name: 'Agbani', areas: ['Agbani Town', 'ESUT'] },
    ],
  },
  {
    state: 'FCT',
    cities: [
      { name: 'Abuja', areas: ['Wuse', 'Wuse 2', 'Maitama', 'Garki', 'Gwarinpa', 'Asokoro', 'Jabi', 'Utako', 'Kubwa', 'Lugbe', 'Lokogoma', 'Guzape', 'Life Camp', 'Karu'] },
      { name: 'Gwagwalada', areas: ['Phase 1', 'Phase 2', 'Phase 3', 'UniAbuja'] },
      { name: 'Kuje', areas: ['Kuje Town', 'Chibiri'] },
    ],
  },
  {
    state: 'Gombe',
    cities: [
      { name: 'Gombe', areas: ['GRA', 'Federal Low Cost', 'Tudun Wada', 'Pantami', 'Jekadafari'] },
      { name: 'Kaltungo', areas: ['Kaltungo Town', 'Poshereng'] },
    ],
  },
  {
    state: 'Imo',
    cities: [
      { name: 'Owerri', areas: ['New Owerri', 'World Bank', 'Ikenegbu', 'Aladinma', 'Douglas', 'Wetheral', 'Amakohia', 'Orji'] },
      { name: 'Orlu', areas: ['Amaifeke', 'Mgbee', 'Orlu Town'] },
      { name: 'Okigwe', areas: ['Okigwe Town', 'Ubahu'] },
    ],
  },
  {
    state: 'Jigawa',
    cities: [
      { name: 'Dutse', areas: ['Takur', 'Gida Dubu', 'Yalwawa', 'GRA'] },
      { name: 'Hadejia', areas: ['Hadejia Town', 'Atafi'] },
      { name: 'Gumel', areas: ['Gumel Town'] },
    ],
  },
  {
    state: 'Kaduna',
    cities: [
      { name: 'Kaduna', areas: ['Barnawa', 'Malali', 'Ungwan Rimi', 'Kawo', 'Sabo', 'Narayi', 'Kakuri', 'GRA'] },
      { name: 'Zaria', areas: ['Samaru', 'Sabon Gari', 'Tudun Wada', 'GRA'] },
      { name: 'Kafanchan', areas: ['Kafanchan Town', 'Fantsuam'] },
    ],
  },
  {
    state: 'Kano',
    cities: [
      { name: 'Kano', areas: ['Nassarawa GRA', 'Sabon Gari', 'Tarauni', 'Hotoro', 'Gyadi-Gyadi', 'Fagge', 'Bompai', 'Kano Municipal'] },
      { name: 'Wudil', areas: ['Wudil Town'] },
    ],
  },
  {
    state: 'Katsina',
    cities: [
      { name: 'Katsina', areas: ['GRA', 'Kofar Kaura', 'Kofar Marusa', 'Dutsinma Road', 'Batagarawa'] },
      { name: 'Daura', areas: ['Daura Town', 'Sabon Gari'] },
      { name: 'Funtua', areas: ['Funtua Town', 'BCGA'] },
    ],
  },
  {
    state: 'Kebbi',
    cities: [
      { name: 'Birnin Kebbi', areas: ['GRA', 'Badariya', 'Gwadangaji', 'Nassarawa'] },
      { name: 'Argungu', areas: ['Argungu Town'] },
      { name: 'Yauri', areas: ['Yelwa Yauri'] },
    ],
  },
  {
    state: 'Kogi',
    cities: [
      { name: 'Lokoja', areas: ['GRA', 'Ganaja', 'Lokongoma', 'Adankolo', 'Felele'] },
      { name: 'Okene', areas: ['Okene Town', 'Agassa'] },
      { name: 'Idah', areas: ['Idah Town', 'Sabon Gari'] },
    ],
  },
  {
    state: 'Kwara',
    cities: [
      { name: 'Ilorin', areas: ['GRA', 'Tanke', 'Taiwo', 'Fate', 'Adewole', 'Sango', 'Challenge', 'Basin'] },
      { name: 'Offa', areas: ['Offa Town', 'Irra Road'] },
      { name: 'Omu-Aran', areas: ['Omu-Aran Town'] },
    ],
  },
  {
    state: 'Lagos',
    cities: [
      { name: 'Lagos', areas: ['Lekki', 'Victoria Island', 'Ikoyi', 'Ikeja', 'Yaba', 'Surulere', 'Gbagada', 'Ajah', 'Ogba', 'Maryland', 'Festac', 'Magodo', 'Ikorodu', 'Badagry'] },
      { name: 'Ikeja', areas: ['Allen Avenue', 'Opebi', 'GRA', 'Alausa', 'Omole', 'Ogba'] },
      { name: 'Lekki', areas: ['Lekki Phase 1', 'Chevron', 'Ikate', 'Jakande', 'Ajah', 'Sangotedo'] },
      { name: 'Ikorodu', areas: ['Ikorodu Town', 'Agric', 'Igbogbo', 'Ebute'] },
      { name: 'Epe', areas: ['Epe Town', 'Poka'] },
    ],
  },
  {
    state: 'Nasarawa',
    cities: [
      { name: 'Lafia', areas: ['GRA', 'Shabu', 'Doma Road', 'Akurba'] },
      { name: 'Keffi', areas: ['Keffi Town', 'Angwan Lambu'] },
      { name: 'Karu', areas: ['Mararaba', 'Masaka', 'New Nyanya', 'Ado'] },
    ],
  },
  {
    state: 'Niger',
    cities: [
      { name: 'Minna', areas: ['Bosso', 'Chanchaga', 'Tunga', 'GRA', 'Maitumbi'] },
      { name: 'Suleja', areas: ['Suleja Town', 'Madalla', 'Kwamba'] },
      { name: 'Bida', areas: ['Bida Town', 'GRA'] },
    ],
  },
  {
    state: 'Ogun',
    cities: [
      { name: 'Abeokuta', areas: ['Oke-Mosan', 'Panseke', 'Kuto', 'Obantoko', 'Lafenwa', 'Asero'] },
      { name: 'Sagamu', areas: ['Sagamu Town', 'Sabo'] },
      { name: 'Ijebu Ode', areas: ['GRA', 'Oke-Aje', 'Iwade'] },
      { name: 'Ota', areas: ['Sango Ota', 'Bells', 'Canaanland'] },
    ],
  },
  {
    state: 'Ondo',
    cities: [
      { name: 'Akure', areas: ['Alagbaka', 'Ijapo Estate', 'Oba Adesida', 'FUTA', 'Oda Road', 'Oke-Aro'] },
      { name: 'Ondo', areas: ['Yaba', 'Adeyemi', 'Laje'] },
      { name: 'Owo', areas: ['Owo Town', 'Iyere'] },
    ],
  },
  {
    state: 'Osun',
    cities: [
      { name: 'Osogbo', areas: ['GRA', 'Oke-Fia', 'Olaiya', 'Dada Estate', 'Ota-Efun'] },
      { name: 'Ile-Ife', areas: ['OAU', 'Mayfair', 'Lagere', 'Modakeke'] },
      { name: 'Ilesa', areas: ['Ilesa Town', 'Oke-Omiru'] },
    ],
  },
  {
    state: 'Oyo',
    cities: [
      { name: 'Ibadan', areas: ['Bodija', 'Ring Road', 'Akobo', 'Dugbe', 'Jericho', 'Mokola', 'Oluyole', 'UI', 'Challenge', 'Agodi'] },
      { name: 'Ogbomoso', areas: ['LAUTECH', 'Takie', 'Sabo'] },
      { name: 'Oyo', areas: ['Oyo Town', 'Durbar'] },
    ],
  },
  {
    state: 'Plateau',
    cities: [
      { name: 'Jos', areas: ['Rayfield', 'Bukuru', 'Terminus', 'Lamingo', 'Rantya', 'Tudun Wada', 'GRA'] },
      { name: 'Pankshin', areas: ['Pankshin Town'] },
    ],
  },
  {
    state: 'Rivers',
    cities: [
      { name: 'Port Harcourt', areas: ['GRA Phase 1', 'GRA Phase 2', 'GRA Phase 3', 'Trans-Amadi', 'Rumuokoro', 'Eliozu', 'Rumuola', 'Choba', 'Woji', 'D-Line', 'Peter Odili', 'Ada George'] },
      { name: 'Obio-Akpor', areas: ['Rumuigbo', 'Rumuodara', 'Eneka', 'Rukpokwu'] },
      { name: 'Bonny', areas: ['Bonny Town', 'Finima'] },
    ],
  },
  {
    state: 'Sokoto',
    cities: [
      { name: 'Sokoto', areas: ['GRA', 'Arkilla', 'Runjin Sambo', 'Gawon Nama', 'Mabera'] },
      { name: 'Tambuwal', areas: ['Tambuwal Town'] },
    ],
  },
  {
    state: 'Taraba',
    cities: [
      { name: 'Jalingo', areas: ['GRA', 'Mile Six', 'Magami', 'Nukkai'] },
      { name: 'Wukari', areas: ['Wukari Town'] },
    ],
  },
  {
    state: 'Yobe',
    cities: [
      { name: 'Damaturu', areas: ['GRA', 'Nayinawa', 'Bindigari', 'Pompomari'] },
      { name: 'Potiskum', areas: ['Potiskum Town', 'Sabon Layi'] },
    ],
  },
  {
    state: 'Zamfara',
    cities: [
      { name: 'Gusau', areas: ['GRA', 'Tudun Wada', 'Samaru', 'Sabon Gari'] },
      { name: 'Kaura Namoda', areas: ['Kaura Namoda Town'] },
    ],
  },
];

export function getNigeriaStateNames(): string[] {
  return NIGERIA_STATES.map((s) => s.state);
}

export function getCitiesForState(stateName?: string): string[] {
  if (!stateName) return [];
  const norm = stateName.trim().toLowerCase();
  const entry = NIGERIA_STATES.find((s) => s.state.toLowerCase() === norm);
  return entry ? entry.cities.map((c) => c.name) : [];
}

export function getAreasForCity(stateName?: string, cityName?: string): string[] {
  if (!stateName || !cityName) return [];
  const normState = stateName.trim().toLowerCase();
  const normCity = cityName.trim().toLowerCase();
  const stateEntry = NIGERIA_STATES.find((s) => s.state.toLowerCase() === normState);
  if (!stateEntry) return [];
  const cityEntry = stateEntry.cities.find((c) => c.name.toLowerCase() === normCity);
  return cityEntry ? cityEntry.areas : [];
}

export function formatServiceAreaLabel(area: Partial<ServiceArea>): string {
  const parts = [area.area, area.city, area.state].filter(
    (p) => typeof p === 'string' && p.trim().length > 0
  );
  return parts.join(', ');
}
