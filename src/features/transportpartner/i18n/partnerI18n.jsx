import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "transport-partner-language";
const SUPPORTED_LANGUAGES = new Set(["en", "hi"]);

const COPY = {
  en: {
    chooseLanguage: "Choose language",
    english: "English",
    hindi: "हिन्दी",
    required: "required",
    optional: "optional",
    details: "Your details",
    fleetRates: "Vehicles & rates",
    openFailed: "We could not open this registration link.",
    saveFailed: "Could not save. Check your connection.",
    uploadFailed: "Could not upload that photo.",
    submitFailed: "Could not submit. Please try again.",
    inactiveLink: "This registration link is no longer active.",
    stillNeeded: "Still needed",
    expiredTitle: "This link has expired",
    expiredBody: "Registration links are only valid for a few days. Please ask the person who invited you to send a new one — replying to their invitation email is the quickest way.",
    expiredSaved: "Anything you had already saved is kept, and the new link will open it.",
    unavailable: "Link unavailable",
    registerFleet: "Register your fleet",
    welcome: "Welcome, {name}",
    readySubmit: "Ready to submit",
    thankTitle: "Thank you — we have your fleet details.",
    thankBody: "Our team will review them and get in touch. You can keep this link to check back on what you sent.",
    rejected: "This registration was not accepted.",
    updateThings: "Please update a few things:",
    underReview: "This registration is being reviewed and cannot be edited.",
    expiresSoon: "This link stops working on {date}. Finish and submit before then, or ask for a new one — your saved answers are kept either way.",
    savingStopped: "Saving has stopped. Please ask for a new registration link — anything you had already saved is kept, and the new link will open it.",
    retry: "Retry",
    detailsHint: "A company or owner name, city and country are the only three we need before you can save. Everything else can wait.",
    company: "Company",
    companyOwner: "Company name / Owner name",
    aboutFleet: "About your fleet",
    aboutPlaceholder: "How long you have operated, the kind of work you do, anything a travel agent should know.",
    website: "Website",
    whereYouAre: "Where you are",
    whereHint: "The city you are based in is how travel agents find your vehicles.",
    city: "City",
    countryCode: "Country code",
    countryHint: "2–3 letters, e.g. IN",
    stateRegion: "State / region",
    cityAirportCode: "City / airport code",
    officeAddress: "Office address",
    contact: "Contact",
    contactHint: "Who we call when a booking needs confirming.",
    contactPerson: "Contact person",
    phone: "Phone",
    email: "Email",
    coverageTerms: "Coverage & terms",
    whereRun: "Where you run",
    routesHint: "routes and corridors, in your own words",
    coveragePlaceholder: "Anywhere in Maharashtra, Goa on request. Up to 300 km one way.",
    noticeNeed: "Notice you need",
    leaveBlank: "leave blank to make no promise",
    hours: "hours",
    cancellationTerms: "Cancellation terms",
    cancellationPlaceholder: "Free cancellation up to 24 hours before pickup. 50% within 12 hours…",
    fleetHint: "Each vehicle here becomes its own listing. Give us your net rate — what we pay you. Agents never see it.",
    vehicle: "vehicle",
    vehicles: "vehicles",
    rate: "rate",
    rates: "rates",
    photo: "photo",
    photos: "photos",
    noVehicles: "No vehicles yet. Add at least one to submit.",
    addVehicle: "Add a vehicle",
    everythingFilled: "Everything we need is filled in",
    thingLeft: "{count} thing left",
    thingsLeft: "{count} things left",
    seeWhat: "see what",
    submitReview: "Submit for review",
    stillFill: "Still to fill in",
    close: "Close",
    go: "Go",
    cityOperate: "City you operate from",
    atLeastVehicle: "At least one vehicle",
    vehicleN: "Vehicle {number}",
    nameForVehicle: "Name for vehicle {number}",
    typeFor: "Vehicle type for {name}",
    seatsIn: "Seats in {name}",
    photoOf: "A photo of {name}",
    ratesFor: "Rates for {name}",
    saving: "Saving",
    savedCompleteTitle: "Saved, and everything we need is filled in",
    savedIncompleteTitle: "Your progress is saved — but the form is not finished yet",
    draftSaved: "Draft saved",
    notSavedRetry: "Not saved · Retry",
    seats: "seats",
    from: "from",
    removeVehicle: "Remove vehicle {number}",
    whatSell: "What you sell it as",
    sellHint: "The name an agent sees — not a number plate",
    vehicleType: "Vehicle type",
    airConditioning: "Air conditioning",
    notSpecified: "Not specified",
    airConditioned: "Air-conditioned",
    nonAc: "Non-AC",
    ownerCompany: "Owner company",
    blankOwn: "blank if it's your own",
    ownerName: "Owner name",
    whoCall: "who we call about this vehicle",
    passengerSeats: "Passenger seats",
    notDriver: "not counting the driver",
    suitcases: "Suitcases",
    seatsFull: "with the seats full",
    seatExplanation: "We cannot list a vehicle without a seat count: agents search and quote on that number, so a vehicle nobody can size never gets chosen for a family of six.",
    description: "Description",
    onBoard: "What's on board",
    somethingElse: "Something else…",
    add: "Add",
    removeItem: "Remove {name}",
    photoAtLeast: "at least one",
    photoNotice: "Every vehicle needs a photo. The catalog shows one cover image per vehicle, so the first photo — or whichever you make the cover — is what a travel agent actually sees.",
    photosLeft: "{count} left for this registration",
    netRates: "Net rates",
    addRate: "Add rate",
    rateExplanation: "One line per kind of journey and how you price it — an airport run at a flat fee and an outstation run per kilometre are two lines, not one.",
    addOneRate: "Add at least one rate.",
    removeRate: "Remove rate {number}",
    kindJourney: "Kind of journey",
    howPrice: "How you price it",
    netUnit: "Net {unit}",
    wePay: "we pay you",
    currency: "Currency",
    customQuoteHelp: "Even a quoted-each-time line needs a figure before you can submit — put your usual starting price here and say what changes it in the inclusions box below.",
    includedKm: "Included km",
    beyondKm: "Beyond that, per km",
    driverAllowance: "Driver allowance",
    perDay: "per day",
    includedHours: "Included hours",
    beyondHour: "Beyond that, per hour",
    nightHalt: "Night halt",
    driverOut: "driver stays out",
    rateCovers: "What this rate covers",
    rateCode: "Your rate code",
    duplicateRate: "Another line already covers {service} · {model}. Only the last one will be kept — change the journey or the pricing method.",
    decrease: "Decrease",
    increase: "Increase",
    photoFitLimit: "Only {fitted} of {picked} photos fitted — you have reached the limit for this registration.",
    genericUploadFailed: "Upload failed.",
    uploading: "Uploading {progress}",
    photoLimit: "Photo limit reached",
    addMorePhotos: "Add more photos",
    addPhotos: "Add photos",
    removeAnyPhoto: "Remove a photo from any vehicle to add another.",
    cover: "Cover",
    removePhoto: "Remove photo",
    makeCover: "Make cover",
    defaultError: "Something went wrong. Please try again.",
    invalidLink: "This registration link is not valid.",
    expiredLink: "This registration link has expired. Please ask for a new one.",
    tooManyRequests: "Too many requests. Please wait a moment and try again.",
    timedOut: "The connection timed out. Please try again.",
    offline: "You appear to be offline. Your changes are not saved yet.",
    submitIncomplete: "Please complete the highlighted items before submitting.",
  },
  hi: {
    chooseLanguage: "भाषा चुनें",
    english: "English",
    hindi: "हिन्दी",
    required: "ज़रूरी",
    optional: "वैकल्पिक",
    details: "आपकी जानकारी",
    fleetRates: "वाहन और किराये",
    openFailed: "यह रजिस्ट्रेशन लिंक नहीं खुल सका।",
    saveFailed: "जानकारी सेव नहीं हो सकी। अपना इंटरनेट कनेक्शन जाँचें।",
    uploadFailed: "यह फोटो अपलोड नहीं हो सका।",
    submitFailed: "फॉर्म जमा नहीं हो सका। कृपया दोबारा कोशिश करें।",
    inactiveLink: "यह रजिस्ट्रेशन लिंक अब सक्रिय नहीं है।",
    stillNeeded: "अभी भरना है",
    expiredTitle: "यह लिंक समाप्त हो चुका है",
    expiredBody: "रजिस्ट्रेशन लिंक केवल कुछ दिनों के लिए मान्य होता है। जिसने आपको आमंत्रित किया था, उनसे नया लिंक भेजने को कहें—आमंत्रण ईमेल का जवाब देना सबसे आसान तरीका है।",
    expiredSaved: "आपकी पहले से सेव की गई जानकारी सुरक्षित है और नया लिंक उसे खोल देगा।",
    unavailable: "लिंक उपलब्ध नहीं है",
    registerFleet: "अपने वाहन रजिस्टर करें",
    welcome: "स्वागत है, {name}",
    readySubmit: "जमा करने की तैयारी",
    thankTitle: "धन्यवाद—हमें आपके वाहनों की जानकारी मिल गई है।",
    thankBody: "हमारी टीम इसकी जाँच करके आपसे संपर्क करेगी। भेजी गई जानकारी देखने के लिए यह लिंक सुरक्षित रखें।",
    rejected: "यह रजिस्ट्रेशन स्वीकार नहीं किया गया।",
    updateThings: "कृपया ये जानकारी सुधारें:",
    underReview: "इस रजिस्ट्रेशन की जाँच चल रही है, इसलिए इसे अभी बदला नहीं जा सकता।",
    expiresSoon: "यह लिंक {date} को बंद हो जाएगा। उससे पहले फॉर्म पूरा करके जमा करें या नया लिंक माँगें—आपके सेव किए उत्तर सुरक्षित रहेंगे।",
    savingStopped: "सेव होना बंद हो गया है। कृपया नया रजिस्ट्रेशन लिंक माँगें—पहले से सेव जानकारी सुरक्षित है और नए लिंक में खुल जाएगी।",
    retry: "दोबारा कोशिश करें",
    detailsHint: "सेव करने के लिए केवल कंपनी/मालिक का नाम, शहर और देश ज़रूरी हैं। बाकी जानकारी बाद में भर सकते हैं।",
    company: "कंपनी",
    companyOwner: "कंपनी का नाम / मालिक का नाम",
    aboutFleet: "अपने वाहनों के बारे में",
    aboutPlaceholder: "आप कब से काम कर रहे हैं, किस तरह की सेवाएँ देते हैं और ट्रैवल एजेंट को क्या जानना चाहिए।",
    website: "वेबसाइट",
    whereYouAre: "आप कहाँ हैं",
    whereHint: "ट्रैवल एजेंट आपके शहर के आधार पर आपके वाहन खोजते हैं।",
    city: "शहर",
    countryCode: "देश का कोड",
    countryHint: "2–3 अक्षर, जैसे IN",
    stateRegion: "राज्य / क्षेत्र",
    cityAirportCode: "शहर / एयरपोर्ट कोड",
    officeAddress: "ऑफिस का पता",
    contact: "संपर्क",
    contactHint: "बुकिंग की पुष्टि के लिए हम किससे बात करें।",
    contactPerson: "संपर्क व्यक्ति",
    phone: "फोन",
    email: "ईमेल",
    coverageTerms: "सेवा क्षेत्र और शर्तें",
    whereRun: "आप कहाँ सेवा देते हैं",
    routesHint: "अपने शब्दों में रूट और इलाके",
    coveragePlaceholder: "पूरे महाराष्ट्र में, अनुरोध पर गोवा। एक तरफ 300 किमी तक।",
    noticeNeed: "कितने समय पहले सूचना चाहिए",
    leaveBlank: "कोई वादा न करना हो तो खाली छोड़ें",
    hours: "घंटे",
    cancellationTerms: "कैंसलेशन की शर्तें",
    cancellationPlaceholder: "पिकअप से 24 घंटे पहले तक मुफ्त कैंसलेशन। 12 घंटे के अंदर 50%…",
    fleetHint: "यहाँ हर वाहन की अलग लिस्टिंग बनेगी। अपना नेट किराया भरें—वह राशि जो हम आपको देंगे। एजेंट इसे नहीं देखेंगे।",
    vehicle: "वाहन",
    vehicles: "वाहन",
    rate: "किराया",
    rates: "किराये",
    photo: "फोटो",
    photos: "फोटो",
    noVehicles: "अभी कोई वाहन नहीं है। फॉर्म जमा करने के लिए कम से कम एक वाहन जोड़ें।",
    addVehicle: "वाहन जोड़ें",
    everythingFilled: "सारी ज़रूरी जानकारी भर दी गई है",
    thingLeft: "{count} जानकारी बाकी है",
    thingsLeft: "{count} जानकारियाँ बाकी हैं",
    seeWhat: "देखें क्या",
    submitReview: "जाँच के लिए जमा करें",
    stillFill: "अभी यह भरना है",
    close: "बंद करें",
    go: "जाएँ",
    cityOperate: "वह शहर जहाँ से आप काम करते हैं",
    atLeastVehicle: "कम से कम एक वाहन",
    vehicleN: "वाहन {number}",
    nameForVehicle: "वाहन {number} का नाम",
    typeFor: "{name} का वाहन प्रकार",
    seatsIn: "{name} में सीटें",
    photoOf: "{name} की फोटो",
    ratesFor: "{name} के किराये",
    saving: "सेव हो रहा है",
    savedCompleteTitle: "सेव हो गया और सारी ज़रूरी जानकारी पूरी है",
    savedIncompleteTitle: "आपकी जानकारी सेव है, लेकिन फॉर्म अभी पूरा नहीं हुआ",
    draftSaved: "ड्राफ्ट सेव हो गया",
    notSavedRetry: "सेव नहीं हुआ · दोबारा कोशिश करें",
    seats: "सीटें",
    from: "से शुरू",
    removeVehicle: "वाहन {number} हटाएँ",
    whatSell: "एजेंट को दिखने वाला नाम",
    sellHint: "वाहन का नाम लिखें, नंबर प्लेट नहीं",
    vehicleType: "वाहन का प्रकार",
    airConditioning: "एयर कंडीशनिंग",
    notSpecified: "नहीं बताया",
    airConditioned: "AC",
    nonAc: "नॉन-AC",
    ownerCompany: "मालिक की कंपनी",
    blankOwn: "अपना वाहन हो तो खाली छोड़ें",
    ownerName: "मालिक का नाम",
    whoCall: "इस वाहन के बारे में किसे कॉल करें",
    passengerSeats: "यात्री सीटें",
    notDriver: "ड्राइवर को छोड़कर",
    suitcases: "सूटकेस",
    seatsFull: "सभी सीटें भरी होने पर",
    seatExplanation: "सीटों की संख्या के बिना वाहन लिस्ट नहीं किया जा सकता। एजेंट इसी संख्या से वाहन खोजते और कोट करते हैं।",
    description: "विवरण",
    onBoard: "वाहन में उपलब्ध सुविधाएँ",
    somethingElse: "कुछ और…",
    add: "जोड़ें",
    removeItem: "{name} हटाएँ",
    photoAtLeast: "कम से कम एक",
    photoNotice: "हर वाहन की फोटो ज़रूरी है। कैटलॉग में हर वाहन की एक कवर फोटो दिखती है—पहली फोटो या आपके द्वारा चुनी गई फोटो एजेंट देखेगा।",
    photosLeft: "इस रजिस्ट्रेशन में {count} फोटो बाकी",
    netRates: "नेट किराये",
    addRate: "किराया जोड़ें",
    rateExplanation: "हर यात्रा प्रकार और उसके किराये के तरीके के लिए एक लाइन रखें—एयरपोर्ट का तय किराया और आउटस्टेशन का प्रति किमी किराया अलग लाइनें हैं।",
    addOneRate: "कम से कम एक किराया जोड़ें।",
    removeRate: "किराया {number} हटाएँ",
    kindJourney: "यात्रा का प्रकार",
    howPrice: "किराया कैसे लेते हैं",
    netUnit: "नेट {unit}",
    wePay: "हम आपको देंगे",
    currency: "मुद्रा",
    customQuoteHelp: "हर बार कोट करने वाली सेवा के लिए भी शुरुआती राशि भरें और नीचे लिखें कि किन बातों से राशि बदलती है।",
    includedKm: "शामिल किमी",
    beyondKm: "उसके बाद प्रति किमी",
    driverAllowance: "ड्राइवर भत्ता",
    perDay: "प्रतिदिन",
    includedHours: "शामिल घंटे",
    beyondHour: "उसके बाद प्रति घंटा",
    nightHalt: "रात्रि ठहराव",
    driverOut: "ड्राइवर बाहर रुकता है",
    rateCovers: "इस किराये में क्या शामिल है",
    rateCode: "आपका रेट कोड",
    duplicateRate: "{service} · {model} के लिए एक और लाइन पहले से है। केवल आखिरी लाइन सेव होगी—यात्रा या किराये का तरीका बदलें।",
    decrease: "घटाएँ",
    increase: "बढ़ाएँ",
    photoFitLimit: "{picked} में से केवल {fitted} फोटो जोड़े गए—इस रजिस्ट्रेशन की सीमा पूरी हो गई है।",
    genericUploadFailed: "अपलोड असफल रहा।",
    uploading: "अपलोड हो रहा है {progress}",
    photoLimit: "फोटो की सीमा पूरी हो गई",
    addMorePhotos: "और फोटो जोड़ें",
    addPhotos: "फोटो जोड़ें",
    removeAnyPhoto: "नई फोटो जोड़ने के लिए किसी वाहन से एक फोटो हटाएँ।",
    cover: "कवर",
    removePhoto: "फोटो हटाएँ",
    makeCover: "कवर बनाएँ",
    defaultError: "कुछ गलत हुआ। कृपया दोबारा कोशिश करें।",
    invalidLink: "यह रजिस्ट्रेशन लिंक मान्य नहीं है।",
    expiredLink: "यह रजिस्ट्रेशन लिंक समाप्त हो चुका है। कृपया नया लिंक माँगें।",
    tooManyRequests: "बहुत अधिक अनुरोध किए गए हैं। थोड़ी देर बाद दोबारा कोशिश करें।",
    timedOut: "कनेक्शन में बहुत समय लग गया। कृपया दोबारा कोशिश करें।",
    offline: "आप ऑफलाइन लग रहे हैं। आपके बदलाव अभी सेव नहीं हुए हैं।",
    submitIncomplete: "जमा करने से पहले चिन्हित जानकारी पूरी करें।",
  },
};

const SERVICE_COPY = {
  AIRPORT_TRANSFER: ["Airport transfer", "एयरपोर्ट ट्रांसफर"],
  RAILWAY_TRANSFER: ["Railway transfer", "रेलवे ट्रांसफर"],
  POINT_TO_POINT: ["Point to point", "एक स्थान से दूसरे स्थान"],
  LOCAL_PACKAGE: ["Local package", "लोकल पैकेज"],
  OUTSTATION_ONE_WAY: ["Outstation — one way", "आउटस्टेशन—एक तरफ"],
  OUTSTATION_ROUND_TRIP: ["Outstation — round trip", "आउटस्टेशन—आना-जाना"],
  MULTI_DAY_TOUR: ["Multi-day tour", "कई दिनों का टूर"],
  HOURLY_RENTAL: ["Hourly rental", "प्रति घंटे किराया"],
  CUSTOM: ["Something else", "कुछ और"],
};

const MODEL_COPY = {
  FLAT_PER_TRANSFER: ["Flat per transfer", "प्रति ट्रांसफर तय", "per transfer", "प्रति ट्रांसफर"],
  FLAT_PER_VEHICLE: ["Flat per vehicle", "प्रति वाहन तय", "per vehicle", "प्रति वाहन"],
  PER_KILOMETRE: ["Per kilometre", "प्रति किलोमीटर", "per km", "प्रति किमी"],
  PER_DAY: ["Per day", "प्रतिदिन", "per day", "प्रतिदिन"],
  PER_HOUR: ["Per hour", "प्रति घंटा", "per hour", "प्रति घंटा"],
  PACKAGE: ["Package rate", "पैकेज किराया", "per package", "प्रति पैकेज"],
  ROUTE_FIXED: ["Fixed for one route", "एक रूट का तय किराया", "per route", "प्रति रूट"],
  CUSTOM_QUOTE: ["Quoted each time", "हर बार कोट", "starting price", "शुरुआती राशि"],
};

const AMENITY_COPY = {
  WiFi: "वाई-फाई",
  "Charging point": "चार्जिंग पॉइंट",
  "Bottled water": "पानी की बोतल",
  "Music system": "म्यूज़िक सिस्टम",
  "Push-back seats": "पुश-बैक सीटें",
  "Reading lights": "रीडिंग लाइट",
  "Luggage carrier": "लगेज कैरियर",
  Curtains: "पर्दे",
  "First-aid kit": "फर्स्ट-एड किट",
  "Child seat": "बच्चों की सीट",
  "GPS tracking": "GPS ट्रैकिंग",
  "Wheelchair accessible": "व्हीलचेयर सुविधा",
};

const interpolate = (value, vars = {}) => Object.entries(vars).reduce(
  (text, [key, replacement]) => text.replaceAll(`{${key}}`, String(replacement)), value,
);

function initialLanguage() {
  const query = new URLSearchParams(window.location.search).get("lang")?.toLowerCase();
  if (SUPPORTED_LANGUAGES.has(query)) return query;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (SUPPORTED_LANGUAGES.has(saved)) return saved;
  return window.navigator.language?.toLowerCase().startsWith("hi") ? "hi" : "en";
}

const PartnerLanguageContext = createContext(null);

export function PartnerLanguageProvider({ children }) {
  const [language, setLanguage] = useState(initialLanguage);
  const t = useCallback(
    (key, vars) => interpolate(COPY[language]?.[key] ?? COPY.en[key] ?? key, vars),
    [language],
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);
  return <PartnerLanguageContext.Provider value={value}>{children}</PartnerLanguageContext.Provider>;
}

export function usePartnerI18n() {
  const value = useContext(PartnerLanguageContext);
  if (!value) throw new Error("usePartnerI18n must be used inside PartnerLanguageProvider");
  return value;
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = usePartnerI18n();
  return (
    <div className="inline-flex min-h-11 shrink-0 items-center rounded-xl border-2 border-blue-600 bg-blue-100 p-1 shadow-sm"
      role="group" aria-label={t("chooseLanguage")}>
      {["en", "hi"].map((code) => (
        <button key={code} type="button" onClick={() => setLanguage(code)}
          aria-pressed={language === code}
          className={`min-h-9 rounded-lg px-3.5 py-2 text-[13px] font-extrabold transition ${
            language === code
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-transparent text-slate-600 hover:bg-white hover:text-blue-700"
          }`}>
          {t(code === "en" ? "english" : "hindi")}
        </button>
      ))}
    </div>
  );
}

export function serviceLabel(value, language) {
  const labels = SERVICE_COPY[value];
  return labels?.[language === "hi" ? 1 : 0] ?? value;
}

export function modelLabel(value, language) {
  const labels = MODEL_COPY[value];
  return labels?.[language === "hi" ? 1 : 0] ?? value;
}

export function modelUnit(value, language) {
  const labels = MODEL_COPY[value];
  return labels?.[language === "hi" ? 3 : 2] ?? "";
}

export function amenityLabel(value, language) {
  return language === "hi" ? (AMENITY_COPY[value] ?? value) : value;
}
